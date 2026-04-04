import { useEffect, useState } from 'react';
import api from '../api';

export default function CashflowCategories() {
  const [rows, setRows]   = useState<any[]>([]);
  const [form, setForm]   = useState({ type: 'income', name: '' });
  const [open, setOpen]   = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const load = () => api.get('/cashflow-categories').then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const income  = rows.filter((c) => c.type === 'income');
  const expense = rows.filter((c) => c.type === 'expense');

  const openNew = (type = 'income') => { setEditId(null); setForm({ type, name: '' }); setOpen(true); };
  const openEdit = (c: any) => { setEditId(c.id); setForm({ type: c.type, name: c.name }); setOpen(true); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editId) await api.put(`/cashflow-categories/${editId}`, { name: form.name });
    else        await api.post('/cashflow-categories', form);
    setOpen(false); setEditId(null); load();
  };

  const toggle = async (c: any) => {
    await api.put(`/cashflow-categories/${c.id}`, { isActive: !c.isActive });
    load();
  };

  const del = async (c: any) => {
    if (!confirm(`Xóa danh mục "${c.name}"?`)) return;
    try { await api.delete(`/cashflow-categories/${c.id}`); load(); }
    catch (err: any) { alert(err.response?.data?.error || 'Không thể xóa'); }
  };

  const renderGroup = (list: any[], label: string, icon: string, type: string) => (
    <div className="card mb-16">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: type === 'income' ? '#00ff88' : '#ff5577', fontSize: 13 }}>
          {icon} {label}
        </div>
        <button className="btn cyan btn-sm" onClick={() => openNew(type)}>+ Thêm</button>
      </div>
      <table className="nt">
        <thead><tr><th>Tên danh mục</th><th>Loại</th><th style={{ width: 80 }}>Trạng thái</th><th style={{ width: 100 }}></th></tr></thead>
        <tbody>
          {list.length === 0 && <tr className="empty-row"><td colSpan={4}>Chưa có danh mục</td></tr>}
          {list.map((c) => (
            <tr key={c.id} style={{ opacity: c.isActive ? 1 : 0.45 }}>
              <td className={c.isActive ? 'c-bright' : 'c-dim'}>
                {c.name}
                {c.isBuiltin && <span className="tag cyan" style={{ marginLeft: 6, fontSize: 9 }}>Mặc định</span>}
              </td>
              <td style={{ fontSize: 11, color: '#8898b8' }}>{c.slug}</td>
              <td>
                <span className={`tag ${c.isActive ? 'cyan' : ''}`} style={!c.isActive ? { opacity: 0.4 } : {}}>
                  {c.isActive ? 'Bật' : 'Tắt'}
                </span>
              </td>
              <td>
                <div className="td-act">
                  {!c.isBuiltin && <button className="btn yellow btn-sm" onClick={() => openEdit(c)}>Sửa</button>}
                  <button className={`btn btn-sm ${c.isActive ? 'ghost' : 'green'}`} onClick={() => toggle(c)}>
                    {c.isActive ? 'Tắt' : 'Bật'}
                  </button>
                  {!c.isBuiltin && <button className="btn red btn-sm" onClick={() => del(c)}>Xóa</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Danh mục Thu / Chi</h1>
      </div>

      {open && (
        <div className="form-panel mb-16">
          <form onSubmit={submit}>
            <div className="fg2" style={{ marginBottom: 10 }}>
              <div>
                <label className="lbl">Loại</label>
                <select className="inp" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} disabled={!!editId}>
                  <option value="income">Thu</option>
                  <option value="expense">Chi</option>
                </select>
              </div>
              <div>
                <label className="lbl">Tên danh mục *</label>
                <input className="inp" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: Thu phí dịch vụ..." />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn cyan">{editId ? '[ Cập nhật ]' : '[ Thêm ]'}</button>
              <button type="button" className="btn ghost" onClick={() => { setOpen(false); setEditId(null); }}>[ Hủy ]</button>
            </div>
          </form>
        </div>
      )}

      {renderGroup(income,  'Danh mục Thu', '💚', 'income')}
      {renderGroup(expense, 'Danh mục Chi', '🔴', 'expense')}
    </div>
  );
}
