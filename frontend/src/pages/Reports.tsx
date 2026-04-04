import { useEffect, useState } from 'react';
import api from '../api';
import { exportReportExcel, exportToExcel } from '../utils/exportExcel';

const fmt = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

type PeriodType = 'month' | 'quarter' | 'year' | 'custom';

const MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
                 'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

const QUARTERS = [
  { label: 'Q1 (Jan–Mar)', start: '01-01', end: '03-31' },
  { label: 'Q2 (Apr–Jun)', start: '04-01', end: '06-30' },
  { label: 'Q3 (Jul–Sep)', start: '07-01', end: '09-30' },
  { label: 'Q4 (Oct–Dec)', start: '10-01', end: '12-31' },
];

function getPeriodRange(type: PeriodType, year: number, month: number, quarter: number, from: string, to: string) {
  if (type === 'custom') return { from, to };
  if (type === 'year') return { from: `${year}-01-01`, to: `${year}-12-31` };
  if (type === 'quarter') {
    const q = QUARTERS[quarter];
    return { from: `${year}-${q.start}`, to: `${year}-${q.end}` };
  }
  // month
  const m = String(month + 1).padStart(2, '0');
  const lastDay = new Date(year, month + 1, 0).getDate();
  return { from: `${year}-${m}-01`, to: `${year}-${m}-${lastDay}` };
}

const thisYear  = new Date().getFullYear();
const thisMonth = new Date().getMonth();      // 0-indexed
const thisQ     = Math.floor(thisMonth / 3);  // 0-indexed

// Tạo danh sách năm từ 2020 đến năm hiện tại + 1
const YEARS = Array.from({ length: thisYear - 2019 + 1 }, (_, i) => 2020 + i);

export default function Reports() {
  const [pl, setPl]           = useState<any>(null);
  const [debt, setDebt]       = useState<any>(null);
  const [cashflow, setCashflow] = useState<any>(null);

  // Period controls
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [year,  setYear]  = useState(thisYear);
  const [month, setMonth] = useState(thisMonth);
  const [quarter, setQuarter] = useState(thisQ);
  const [from, setFrom] = useState('');
  const [to,   setTo]   = useState('');

  // Monthly trend data
  const [trend, setTrend] = useState<any[]>([]);
  const [loadingTrend, setLoadingTrend] = useState(false);

  const load = async () => {
    const { from: f, to: t } = getPeriodRange(periodType, year, month, quarter, from, to);
    const params = new URLSearchParams();
    if (f) params.set('from', f);
    if (t) params.set('to', t);
    const q = params.toString() ? '?' + params : '';
    const [plRes, debtRes, cfRes] = await Promise.all([
      api.get('/reports/profit-loss' + q),
      api.get('/reports/debt'),
      api.get('/reports/cashflow' + q),
    ]);
    setPl(plRes.data);
    setDebt(debtRes.data);
    setCashflow(cfRes.data);
  };

  const loadTrend = async () => {
    // Tải 12 tháng của năm đang xem (hoặc year hiện tại nếu custom)
    const y = periodType === 'custom' ? thisYear : year;
    setLoadingTrend(true);
    try {
      const months = await Promise.all(
        Array.from({ length: 12 }, async (_, i) => {
          const m = String(i + 1).padStart(2, '0');
          const last = new Date(y, i + 1, 0).getDate();
          const params = `?from=${y}-${m}-01&to=${y}-${m}-${last}`;
          const [pl, cf] = await Promise.all([
            api.get('/reports/profit-loss' + params),
            api.get('/reports/cashflow' + params),
          ]);
          return {
            label: `T${i + 1}`,
            revenue: pl.data.revenue,
            netProfit: pl.data.netProfit,
            income: cf.data.income,
            expense: cf.data.expense,
          };
        })
      );
      setTrend(months);
    } finally {
      setLoadingTrend(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (periodType !== 'custom') loadTrend(); }, [year]);

  const handleLoad = () => { load(); if (periodType !== 'custom') loadTrend(); };

  const handleExport = () => { if (pl && debt) exportReportExcel(pl, debt, cashflow); };
  const handleExportInvoices = async () => {
    const res = await api.get('/invoices');
    exportToExcel(res.data.map((inv: any) => ({
      'Mã HĐ': inv.code, 'Khách hàng': inv.customer?.name,
      'Tổng tiền': inv.totalAmount, 'Đã thu': inv.paidAmount,
      'Còn nợ': inv.totalAmount - inv.paidAmount,
      'Trạng thái': inv.status === 'paid' ? 'Đã TT' : inv.status === 'partial' ? 'Một phần' : 'Chưa TT',
      'Ngày tạo': new Date(inv.createdAt).toLocaleDateString('vi-VN'),
    })), 'Hóa đơn', `hoa-don-${new Date().toISOString().slice(0,10)}`);
  };

  const { from: activeFrom, to: activeTo } = getPeriodRange(periodType, year, month, quarter, from, to);

  // bar chart helper
  const maxVal = trend.length ? Math.max(...trend.map((t) => Math.max(t.revenue, t.income, 1))) : 1;
  const bar = (val: number, color: string) => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ width: '100%', height: 60, display: 'flex', alignItems: 'flex-end' }}>
        <div style={{
          width: '100%', background: color, borderRadius: '2px 2px 0 0',
          height: `${Math.max(2, (val / maxVal) * 60)}px`,
          boxShadow: `0 0 6px ${color}`,
        }} />
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Báo cáo &amp; Phân tích</h1>
        <div className="btn-group">
          <button className="btn green" onClick={handleExportInvoices}>⬇ Hóa đơn Excel</button>
          <button className="btn purple" onClick={handleExport} disabled={!pl}>⬇ Báo cáo Excel</button>
        </div>
      </div>

      {/* ── Period selector ── */}
      <div className="form-panel mb-16">
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {/* Period type tabs */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['month','quarter','year','custom'] as PeriodType[]).map((t) => (
              <button key={t} onClick={() => setPeriodType(t)}
                className={`btn ${periodType === t ? 'cyan' : 'ghost'} btn-sm`}
                style={{ minWidth: 72 }}>
                {t === 'month' ? 'Tháng' : t === 'quarter' ? 'Quý' : t === 'year' ? 'Năm' : 'Tùy chọn'}
              </button>
            ))}
          </div>

          {/* Year (always shown except custom) */}
          {periodType !== 'custom' && (
            <div>
              <label className="lbl">Năm kế toán</label>
              <select className="inp" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 90 }}>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          {/* Month picker */}
          {periodType === 'month' && (
            <div>
              <label className="lbl">Tháng</label>
              <select className="inp" value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ width: 120 }}>
                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </div>
          )}

          {/* Quarter picker */}
          {periodType === 'quarter' && (
            <div>
              <label className="lbl">Quý</label>
              <select className="inp" value={quarter} onChange={(e) => setQuarter(Number(e.target.value))} style={{ width: 140 }}>
                {QUARTERS.map((q, i) => <option key={i} value={i}>{q.label}</option>)}
              </select>
            </div>
          )}

          {/* Custom date range */}
          {periodType === 'custom' && (
            <>
              <div><label className="lbl">Từ ngày</label><input className="inp" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 150 }} /></div>
              <div><label className="lbl">Đến ngày</label><input className="inp" type="date" value={to}   onChange={(e) => setTo(e.target.value)}   style={{ width: 150 }} /></div>
            </>
          )}

          <button className="btn cyan" onClick={handleLoad} style={{ marginBottom: 0 }}>[ Xem báo cáo ]</button>
        </div>

        {/* Active period display */}
        {(activeFrom || activeTo) && (
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--cyan)', opacity: 0.7 }}>
            ◆ Kỳ báo cáo: {activeFrom || '...'} → {activeTo || '...'}
          </div>
        )}
      </div>

      {/* ── Summary cards ── */}
      {cashflow && (
        <div className="grid-3 mb-16">
          <div className="stat-card c-green">
            <div className="stat-label">Tổng thu</div>
            <div className="stat-val c-green">{fmt(cashflow.income)}</div>
          </div>
          <div className="stat-card c-red">
            <div className="stat-label">Tổng chi</div>
            <div className="stat-val c-red">{fmt(cashflow.expense)}</div>
          </div>
          <div className="stat-card c-cyan">
            <div className="stat-label">Số dư</div>
            <div className={`stat-val ${cashflow.balance >= 0 ? 'c-cyan' : 'c-red'}`}>{fmt(cashflow.balance)}</div>
          </div>
        </div>
      )}

      {/* ── P&L + Debt ── */}
      {pl && (
        <div className="grid-2 mb-16">
          {/* P&L */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>◆ Lãi / Lỗ</div>
            <div className="report-row"><span className="lbl-r">Doanh thu</span><span className="c-green fw7">{fmt(pl.revenue)}</span></div>
            <div className="report-row"><span className="lbl-r">Giá vốn (COGS)</span><span className="c-red">— {fmt(pl.cogs)}</span></div>
            <div className="report-row"><span className="lbl-r">Lãi gộp</span><span className="c-cyan fw7">{fmt(pl.grossProfit)}</span></div>
            <div className="report-row"><span className="lbl-r">Chi phí khác</span><span className="c-red">— {fmt(pl.otherExpenses)}</span></div>
            <div className="report-row total">
              <span className="lbl-r">Lợi nhuận ròng</span>
              <span className={`fw7 ${pl.netProfit >= 0 ? 'c-green' : 'c-red'}`} style={{ fontSize: 15 }}>{fmt(pl.netProfit)}</span>
            </div>
          </div>

          {/* Debt */}
          {debt && (
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>◆ Công nợ (toàn thời gian)</div>
              <div className="report-row"><span className="lbl-r">Phải thu (KH)</span><span className="c-green fw7">{fmt(debt.totalReceivable)}</span></div>
              <div className="report-row" style={{ marginBottom: 12 }}><span className="lbl-r">Phải trả (NCC)</span><span className="c-red fw7">{fmt(debt.totalPayable)}</span></div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Top KH nợ</div>
              {debt.topDebtors?.map((c: any) => (
                <div key={c.id} className="report-row">
                  <span className="lbl-r">{c.name}</span>
                  <span className="c-red fw7">{fmt(c.debt)}</span>
                </div>
              ))}
              {!debt.topDebtors?.length && <div className="c-dim" style={{ fontSize: 11 }}>Không có công nợ</div>}
            </div>
          )}
        </div>
      )}

      {/* ── Monthly trend bar chart ── */}
      {periodType !== 'custom' && (
        <div className="card mb-16">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--yellow)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            ◆ Xu hướng 12 tháng — Năm {periodType === 'custom' ? thisYear : year}
            {loadingTrend && <span style={{ color: 'var(--text-dim)', fontWeight: 400, marginLeft: 10 }}>đang tải...</span>}
          </div>

          {trend.length > 0 && (
            <>
              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 10, color: 'var(--text-dim)' }}>
                <span><span style={{ color: 'var(--green)' }}>■</span> Doanh thu</span>
                <span><span style={{ color: 'var(--cyan)' }}>■</span> Lợi nhuận</span>
                <span><span style={{ color: 'var(--red)' }}>■</span> Chi phí</span>
              </div>

              {/* Bar chart */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                {trend.map((m, i) => {
                  const isCurrentPeriod =
                    (periodType === 'month' && i === month) ||
                    (periodType === 'quarter' && Math.floor(i / 3) === quarter) ||
                    periodType === 'year';
                  return (
                    <div key={i} style={{
                      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                      opacity: isCurrentPeriod ? 1 : 0.45,
                    }}>
                      <div style={{ width: '100%', height: 70, display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                        {/* Revenue bar */}
                        <div style={{ flex: 1, background: 'var(--green)', borderRadius: '2px 2px 0 0',
                          height: `${Math.max(2, (m.revenue / maxVal) * 70)}px`,
                          boxShadow: isCurrentPeriod ? 'var(--green-glow)' : 'none' }} />
                        {/* Net profit bar */}
                        <div style={{ flex: 1,
                          background: m.netProfit >= 0 ? 'var(--cyan)' : 'var(--red)',
                          borderRadius: '2px 2px 0 0',
                          height: `${Math.max(2, (Math.abs(m.netProfit) / maxVal) * 70)}px`,
                          boxShadow: isCurrentPeriod ? 'var(--cyan-glow)' : 'none' }} />
                        {/* Expense bar */}
                        <div style={{ flex: 1, background: 'var(--red)', borderRadius: '2px 2px 0 0',
                          height: `${Math.max(2, (m.expense / maxVal) * 70)}px`,
                          boxShadow: isCurrentPeriod ? 'var(--red-glow)' : 'none' }} />
                      </div>
                      <div style={{ fontSize: 9, color: isCurrentPeriod ? 'var(--cyan)' : 'var(--text-dim)' }}>{m.label}</div>
                    </div>
                  );
                })}
              </div>

              {/* Summary table */}
              <div className="table-wrap" style={{ marginTop: 14 }}>
                <table className="nt" style={{ fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th>Tháng</th>
                      <th>Doanh thu</th>
                      <th>Lợi nhuận</th>
                      <th>Tổng thu</th>
                      <th>Tổng chi</th>
                      <th>Số dư</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trend.map((m, i) => {
                      const isHighlight =
                        (periodType === 'month' && i === month) ||
                        (periodType === 'quarter' && Math.floor(i / 3) === quarter);
                      return (
                        <tr key={i} style={{ background: isHighlight ? 'rgba(0,245,255,0.04)' : '' }}>
                          <td className={isHighlight ? 'c-cyan fw7' : 'c-dim'}>{MONTHS[i]}</td>
                          <td className="c-green">{m.revenue > 0 ? fmt(m.revenue) : <span className="c-dim">—</span>}</td>
                          <td className={m.netProfit >= 0 ? 'c-cyan' : 'c-red'}>{m.revenue > 0 || m.netProfit !== 0 ? fmt(m.netProfit) : <span className="c-dim">—</span>}</td>
                          <td className="c-green">{m.income > 0 ? fmt(m.income) : <span className="c-dim">—</span>}</td>
                          <td className="c-red">{m.expense > 0 ? fmt(m.expense) : <span className="c-dim">—</span>}</td>
                          <td className={m.income - m.expense >= 0 ? 'c-cyan fw7' : 'c-red fw7'}>
                            {(m.income > 0 || m.expense > 0) ? fmt(m.income - m.expense) : <span className="c-dim">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Tổng năm */}
                    <tr style={{ borderTop: '1px solid var(--border)', background: 'rgba(0,245,255,0.03)' }}>
                      <td className="c-bright fw7">Cả năm</td>
                      <td className="c-green fw7">{fmt(trend.reduce((s,m)=>s+m.revenue,0))}</td>
                      <td className={trend.reduce((s,m)=>s+m.netProfit,0)>=0?'c-cyan fw7':'c-red fw7'}>{fmt(trend.reduce((s,m)=>s+m.netProfit,0))}</td>
                      <td className="c-green fw7">{fmt(trend.reduce((s,m)=>s+m.income,0))}</td>
                      <td className="c-red fw7">{fmt(trend.reduce((s,m)=>s+m.expense,0))}</td>
                      <td className={trend.reduce((s,m)=>s+m.income-m.expense,0)>=0?'c-cyan fw7':'c-red fw7'}>{fmt(trend.reduce((s,m)=>s+m.income-m.expense,0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
