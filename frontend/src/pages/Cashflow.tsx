import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import FilterBar, { defaultFilter } from '../components/FilterBar';
import type { FilterState } from '../components/FilterBar';

const fmt = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

export default function Cashflow() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [entries, setEntries] = useState<any[]>([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm]       = useState({ type: 'income', category: '', amount: '', description: '' });
  const [open, setOpen]       = useState(false);
  const [filter, setFilter]   = useState<FilterState>(defaultFilter);

  const load = () => {
    api.get('/cashflow').then((r) => setEntries(r.data));
    api.get('/cashflow/summary').then((r) => setSummary(r.data));
  };

  useEffect(() => {
    api.get('/cashflow-categories').then((r) => {
      const cats: any[] = r.data;
      setCategories(cats);
      // Set default category to first active income category
      const first = cats.find((c) => c.type === 'income' && c.isActive);
      if (first) setForm((f) => ({ ...f, category: first.slug }));
    });
    load();
  }, []);

  const activeByType = (type: string) => categories.filter((c) => c.type === type && c.isActive);

  const categoryLabel = (slug: string) => categories.find((c) => c.slug === slug)?.name || slug;

  // When type changes, reset category to first active of that type
  const handleTypeChange = (type: string) => {
    const first = categories.find((c) => c.type === type && c.isActive);
    setForm((f) => ({ ...f, type, category: first?.slug || '' }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/cashflow', { ...form, amount: Number(form.amount) });
    const defaultCat = categories.find((c) => c.type === 'income' && c.isActive);
    setForm({ type: 'income', category: defaultCat?.slug || '', amount: '', description: '' });
    setOpen(false); load();
  };

  const filtered = useMemo(() => {
    let r = [...entries];
    if (filter.search) {
      const q = filter.search.toLowerCase();
      r = r.filter((e) =>
        e.description?.toLowerCase().includes(q) ||
        categoryLabel(e.category).toLowerCase().includes(q)
      );
    }
    if (filter.type)      r = r.filter((e) => e.type === filter.type);
    if (filter.status)    r = r.filter((e) => e.category === filter.status);
    if (filter.dateFrom)  r = r.filter((e) => new Date(e.date) >= new Date(filter.dateFrom));
    if (filter.dateTo)    r = r.filter((e) => new Date(e.date) <= new Date(filter.dateTo + 'T23:59:59'));
    if (filter.amountMin) r = r.filter((e) => e.amount >= Number(filter.amountMin));
    if (filter.amountMax) r = r.filter((e) => e.amount <= Number(filter.amountMax));
    r.sort((a, b) => {
      const dir = filter.sortDir === 'desc' ? -1 : 1;
      if (filter.sortBy === 'amount') return dir * (a.amount - b.amount);
      return dir * (new Date(a.date).getTime() - new Date(b.date).getTime());
    });
    return r;
  }, [entries, filter, categories]);

  const handleDelete = async (e: any) => {
    if (!confirm(`Xóa bút toán "${e.description || categoryLabel(e.category)}"?`)) return;
    try {
      await api.delete(`/cashflow/${e.id}`);
      load();
    } catch (err: any) { alert(err.response?.data?.error || 'Lỗi khi xóa'); }
  };

  // Build dynamic category filter options
  const catStatusOptions = categories
    .filter((c) => c.isActive)
    .map((c) => ({ value: c.slug, label: c.name }));

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
                <select className="inp" value={form.type} onChange={(e) => handleTypeChange(e.target.value)}>
                  <option value="income">Thu</option>
                  <option value="expense">Chi</option>
                </select>
              </div>
              <div>
                <label className="lbl">Danh mục</label>
                <select className="inp" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {activeByType(form.type).map((c) => (
                    <option key={c.id} value={c.slug}>{c.name}</option>
                  ))}
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
        statusOptions={catStatusOptions}
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
                <td className="c-dim">{categoryLabel(e.category)}</td>
                <td className={`fw7 ${e.type === 'income' ? 'c-green' : 'c-red'}`}>{fmt(e.amount)}</td>
                <td>{e.description || <span className="c-dim">—</span>}</td>
                <td className="c-dim">{new Date(e.date).toLocaleDateString('vi-VN')}</td>
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
