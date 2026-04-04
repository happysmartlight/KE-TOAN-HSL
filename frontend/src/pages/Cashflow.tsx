import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import FilterBar, { defaultFilter } from '../components/FilterBar';
import type { FilterState } from '../components/FilterBar';

const fmt = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

const CATEGORY_LABEL: Record<string, string> = {
  sales: 'Doanh thu',
  payment_received: 'Thu tiền HĐ',
  purchase: 'Nhập hàng',
  salary: 'Lương',
  other: 'Khác',
};

export default function Cashflow() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [entries, setEntries] = useState<any[]>([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
  const [form, setForm]       = useState({ type: 'income', category: 'other', amount: '', description: '' });
  const [open, setOpen]       = useState(false);
  const [filter, setFilter]   = useState<FilterState>(defaultFilter);

  const load = () => {
    api.get('/cashflow').then((r) => setEntries(r.data));
    api.get('/cashflow/summary').then((r) => setSummary(r.data));
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/cashflow', { ...form, amount: Number(form.amount) });
    setForm({ type: 'income', category: 'other', amount: '', description: '' });
    setOpen(false); load();
  };

  const filtered = useMemo(() => {
    let r = [...entries];
    if (filter.search) {
      const q = filter.search.toLowerCase();
      r = r.filter((e) =>
        e.description?.toLowerCase().includes(q) ||
        (CATEGORY_LABEL[e.category] || e.category).toLowerCase().includes(q)
      );
    }
    if (filter.type)      r = r.filter((e) => e.type === filter.type);
    if (filter.status)    r = r.filter((e) => e.category === filter.status); // reuse status field for category
    if (filter.dateFrom)  r = r.filter((e) => new Date(e.createdAt) >= new Date(filter.dateFrom));
    if (filter.dateTo)    r = r.filter((e) => new Date(e.createdAt) <= new Date(filter.dateTo + 'T23:59:59'));
    if (filter.amountMin) r = r.filter((e) => e.amount >= Number(filter.amountMin));
    if (filter.amountMax) r = r.filter((e) => e.amount <= Number(filter.amountMax));
    r.sort((a, b) => {
      const dir = filter.sortDir === 'desc' ? -1 : 1;
      if (filter.sortBy === 'amount') return dir * (a.amount - b.amount);
      return dir * (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) * -1;
    });
    return r;
  }, [entries, filter]);

  const handleDelete = async (e: any) => {
    if (!confirm(`Xóa bút toán "${e.description || e.category}"?`)) return;
    try {
      await api.delete(`/cashflow/${e.id}`);
      load();
    } catch (err: any) { alert(err.response?.data?.error || 'Lỗi khi xóa'); }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Thu / Chi</h1>
        <button className="btn cyan" onClick={() => setOpen(!open)}>+ Ghi thu/chi</button>
      </div>

      <div className="grid-3 mb-16">
        <div className="stat-card c-green">
          <div className="stat-label">Tổng thu</div>
          <div className="stat-val c-green">{fmt(summary.income)}</div>
        </div>
        <div className="stat-card c-red">
          <div className="stat-label">Tổng chi</div>
          <div className="stat-val c-red">{fmt(summary.expense)}</div>
        </div>
        <div className="stat-card c-cyan">
          <div className="stat-label">Số dư</div>
          <div className={`stat-val ${summary.balance >= 0 ? 'c-cyan' : 'c-red'}`}>{fmt(summary.balance)}</div>
        </div>
      </div>

      {open && (
        <div className="form-panel mb-16">
          <form onSubmit={submit}>
            <div className="fg2" style={{ marginBottom: 10 }}>
              <div>
                <label className="lbl">Loại</label>
                <select className="inp" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="income">Thu</option>
                  <option value="expense">Chi</option>
                </select>
              </div>
              <div>
                <label className="lbl">Danh mục</label>
                <select className="inp" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="sales">Doanh thu</option>
                  <option value="payment_received">Thu tiền HĐ</option>
                  <option value="purchase">Nhập hàng</option>
                  <option value="salary">Lương</option>
                  <option value="other">Khác</option>
                </select>
              </div>
              <div><label className="lbl">Số tiền *</label><input className="inp" type="number" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><label className="lbl">Mô tả</label><input className="inp" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn cyan">[ Lưu ]</button>
              <button type="button" className="btn ghost" onClick={() => setOpen(false)}>[ Hủy ]</button>
            </div>
          </form>
        </div>
      )}

      <FilterBar
        value={filter} onChange={setFilter}
        totalCount={entries.length} resultCount={filtered.length}
        searchPlaceholder="Tìm mô tả, danh mục..."
        typeOptions={[
          { value: 'income',  label: 'Thu' },
          { value: 'expense', label: 'Chi' },
        ]}
        statusOptions={[
          { value: 'sales',            label: 'Doanh thu' },
          { value: 'payment_received', label: 'Thu tiền HĐ' },
          { value: 'purchase',         label: 'Nhập hàng' },
          { value: 'salary',           label: 'Lương' },
          { value: 'other',            label: 'Khác' },
        ]}
        sortOptions={[
          { value: 'date_desc',   label: '↓ Ngày mới nhất' },
          { value: 'date_asc',    label: '↑ Ngày cũ nhất' },
          { value: 'amount_desc', label: '↓ Tiền nhiều nhất' },
          { value: 'amount_asc',  label: '↑ Tiền ít nhất' },
        ]}
      />

      <div className="table-wrap">
        <table className="nt">
          <thead><tr><th>Loại</th><th>Danh mục</th><th>Số tiền</th><th>Mô tả</th><th>Ngày</th>{isAdmin && <th></th>}</tr></thead>
          <tbody>
            {filtered.length === 0 && <tr className="empty-row"><td colSpan={isAdmin ? 6 : 5}>{entries.length === 0 ? 'Chưa có dữ liệu' : 'Không tìm thấy kết quả'}</td></tr>}
            {filtered.map((e) => (
              <tr key={e.id}>
                <td><span className={`tag ${e.type === 'income' ? 'green' : 'red'}`}>{e.type === 'income' ? 'THU' : 'CHI'}</span></td>
                <td className="c-dim">{CATEGORY_LABEL[e.category] || e.category}</td>
                <td className={`fw7 ${e.type === 'income' ? 'c-green' : 'c-red'}`}>{fmt(e.amount)}</td>
                <td>{e.description || <span className="c-dim">—</span>}</td>
                <td className="c-dim">{new Date(e.createdAt).toLocaleDateString('vi-VN')}</td>
                {isAdmin && (
                  <td><button className="btn red btn-sm" onClick={() => handleDelete(e)}>Xóa</button></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
