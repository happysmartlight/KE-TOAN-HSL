import { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import api from '../api';

const fmt  = (n: number) => n.toLocaleString('vi-VN') + ' ₫';
const fmtK = (n: number) => n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M' : n >= 1_000 ? (n / 1_000).toFixed(0) + 'K' : String(n);

const PIE_COLORS = ['#00f5ff','#bf00ff','#00ff88','#ffcc00','#ff0055','#ff8c00'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#0d0d1a', border:'1px solid rgba(0,245,255,0.2)', borderRadius:4, padding:'8px 12px', fontSize:11 }}>
      <div style={{ color:'#9898b8', marginBottom:4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color, marginBottom:2 }}>
          {p.name}: <span style={{ fontWeight:700 }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

const KpiCard = ({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) => (
  <div className="stat-card" style={{ borderColor: `${color}33` }}>
    <div className="stat-label">{label}</div>
    <div className="stat-val" style={{ color, fontSize: 18 }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{sub}</div>}
  </div>
);

export default function Dashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.get('/dashboard').then((r) => setData(r.data));
  }, []);

  if (!data) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'var(--cyan)', fontSize:12 }}>
      <span>Đang tải dữ liệu<span className="blink"> _</span></span>
    </div>
  );

  const { kpis, monthlyRevenue, cashflowByCategory, customerGrowth, topProducts, topCustomers, year } = data;

  const RANK_DISPLAY = [
    { icon: '🥇', color: '#FFD700', bg: 'rgba(255,215,0,0.10)', border: 'rgba(255,215,0,0.30)' },
    { icon: '🥈', color: '#C0C0C0', bg: 'rgba(192,192,192,0.08)', border: 'rgba(192,192,192,0.25)' },
    { icon: '🥉', color: '#CD7F32', bg: 'rgba(205,127,50,0.08)', border: 'rgba(205,127,50,0.25)' },
  ];

  const incomeCategories  = cashflowByCategory.filter((c: any) => c.income  > 0);
  const expenseCategories = cashflowByCategory.filter((c: any) => c.expense > 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>HAPPY SMART LIGHT · NĂM {year}</span>
      </div>

      {/* ── KPI Row 1: Finance ── */}
      <div className="grid-4 mb-16">
        <KpiCard label="Doanh thu năm" value={fmt(kpis.totalRevenue)} color="var(--green)" />
        <KpiCard label="Tổng thu" value={fmt(kpis.totalIncome)} color="var(--cyan)" />
        <KpiCard label="Tổng chi" value={fmt(kpis.totalExpense)} color="var(--red)" />
        <KpiCard label="Số dư" value={fmt(kpis.balance)} color={kpis.balance >= 0 ? 'var(--cyan)' : 'var(--red)'} />
      </div>

      {/* ── KPI Row 2: Operations ── */}
      <div className="grid-4 mb-16">
        <KpiCard label="Khách hàng" value={String(kpis.totalCustomers)} color="var(--purple)" sub="đang hoạt động" />
        <KpiCard label="Sản phẩm" value={String(kpis.totalProducts)} color="var(--yellow)" sub="đang kinh doanh" />
        <KpiCard label="HĐ chưa TT" value={String(kpis.pendingInvoices)} color="var(--red)" sub="cần xử lý" />
        <KpiCard label="Phải thu" value={fmt(kpis.receivable)} color="var(--green)" sub={`Phải trả: ${fmt(kpis.payable)}`} />
      </div>

      {/* ── Charts row 1: Revenue trend + Customer growth + Top customers ── */}
      <div className="grid-3 mb-16">
        {/* Revenue / Profit area chart */}
        <div className="card">
          <div className="card-title c-cyan">📈 Doanh thu &amp; Lợi nhuận {year}</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyRevenue} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00ff88" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00f5ff" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#00f5ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill:'#6a6a90', fontSize:10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fill:'#6a6a90', fontSize:9 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" name="Doanh thu" stroke="#00ff88" strokeWidth={2} fill="url(#gRevenue)" dot={false} />
              <Area type="monotone" dataKey="profit"  name="Lợi nhuận" stroke="#00f5ff" strokeWidth={2} fill="url(#gProfit)"  dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Customer growth line chart */}
        <div className="card">
          <div className="card-title c-purple">👥 Tăng trưởng khách hàng {year}</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={customerGrowth} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill:'#6a6a90', fontSize:10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'#6a6a90', fontSize:9 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="total" name="Tổng KH" stroke="#bf00ff" strokeWidth={2}
                dot={{ fill:'#bf00ff', r:3 }} activeDot={{ r:5, stroke:'#bf00ff', strokeWidth:2, fill:'#0d0d1a' }} />
              <Line type="monotone" dataKey="new"   name="KH mới" stroke="#ffcc00" strokeWidth={1.5}
                strokeDasharray="4 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top customers */}
        <div className="card">
          <div className="card-title" style={{ color: '#FFD700' }}>🏆 Top khách hàng</div>
          {topCustomers.length === 0 ? (
            <div className="empty-chart">Chưa có dữ liệu</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, overflowY: 'auto', maxHeight: 210 }}>
              {/* Top 3 */}
              {topCustomers.slice(0, 3).map((c: any, i: number) => {
                const rank = RANK_DISPLAY[i];
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 5,
                    background: rank.bg, border: `1px solid ${rank.border}`,
                  }}>
                    <div style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{rank.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: rank.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                      {c.companyName && <div style={{ fontSize: 10, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.companyName}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-bright)' }}>{fmt(c.totalPurchased)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{c.invoiceCount} HĐ</div>
                    </div>
                  </div>
                );
              })}
              {/* #4+ */}
              {topCustomers.slice(3).map((c: any, i: number) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: 4,
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', flexShrink: 0 }}>#{i+4}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-bright)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cyan)', flexShrink: 0 }}>{fmt(c.totalPurchased)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Charts row 2: Income pie + Expense pie + Top products bar ── */}
      <div className="grid-3 mb-16">
        {/* Income by category */}
        <div className="card">
          <div className="card-title c-green">💰 Nguồn thu (theo danh mục)</div>
          {incomeCategories.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={incomeCategories} dataKey="income" nameKey="name"
                  cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                  paddingAngle={3} strokeWidth={0}>
                  {incomeCategories.map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{ background:'#0d0d1a', border:'1px solid rgba(0,245,255,0.2)', fontSize:11 }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize:10, color:'#9898b8' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="empty-chart">Chưa có dữ liệu</div>}
        </div>

        {/* Expense by category */}
        <div className="card">
          <div className="card-title c-red">💸 Chi phí (theo danh mục)</div>
          {expenseCategories.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={expenseCategories} dataKey="expense" nameKey="name"
                  cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                  paddingAngle={3} strokeWidth={0}>
                  {expenseCategories.map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{ background:'#0d0d1a', border:'1px solid rgba(0,245,255,0.2)', fontSize:11 }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize:10, color:'#9898b8' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="empty-chart">Chưa có dữ liệu</div>}
        </div>

        {/* Top products */}
        <div className="card">
          <div className="card-title c-yellow">🏆 Top sản phẩm doanh thu</div>
          {topProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 5, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tickFormatter={fmtK} tick={{ fill:'#6a6a90', fontSize:9 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill:'#9898b8', fontSize:9 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{ background:'#0d0d1a', border:'1px solid rgba(0,245,255,0.2)', fontSize:11 }} />
                <Bar dataKey="revenue" name="Doanh thu" radius={[0,3,3,0]}>
                  {topProducts.map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="empty-chart">Chưa có dữ liệu</div>}
        </div>
      </div>

      {/* ── Charts row 3: Monthly cashflow bar ── */}
      <div className="card mb-16">
        <div className="card-title c-cyan">⚡ Thu / Chi theo tháng — {year}</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={monthlyRevenue} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="month" tick={{ fill:'#6a6a90', fontSize:10 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtK} tick={{ fill:'#6a6a90', fontSize:9 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconSize={8} wrapperStyle={{ fontSize:10, color:'#9898b8' }} />
            <Bar dataKey="income"  name="Thu" fill="#00ff88" radius={[2,2,0,0]} maxBarSize={18}
              style={{ filter:'drop-shadow(0 0 4px #00ff88)' }} />
            <Bar dataKey="expense" name="Chi" fill="#ff0055" radius={[2,2,0,0]} maxBarSize={18}
              style={{ filter:'drop-shadow(0 0 4px #ff0055)' }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
