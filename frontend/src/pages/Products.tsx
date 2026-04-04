import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import RequestDeleteModal from '../components/RequestDeleteModal';
import FilterBar, { defaultFilter } from '../components/FilterBar';
import type { FilterState } from '../components/FilterBar';

const fmt = (n: number) => n.toLocaleString('vi-VN') + ' ₫';
const empty = { name: '', sku: '', unit: 'cái', costPrice: '', sellingPrice: '', stock: '' };

export default function Products() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: number; name: string } | null>(null);

  const [filter, setFilter] = useState<FilterState>(defaultFilter);

  const load = () => api.get('/products').then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (filter.search) {
      const q = filter.search.toLowerCase();
      r = r.filter((p) =>
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.unit?.toLowerCase().includes(q)
      );
    }
    if (filter.status === 'out')  r = r.filter((p) => p.stock <= 0);
    if (filter.status === 'low')  r = r.filter((p) => p.stock > 0 && p.stock <= 5);
    if (filter.status === 'ok')   r = r.filter((p) => p.stock > 5);
    if (filter.amountMin) r = r.filter((p) => p.sellingPrice >= Number(filter.amountMin));
    if (filter.amountMax) r = r.filter((p) => p.sellingPrice <= Number(filter.amountMax));
    r.sort((a, b) => {
      const dir = filter.sortDir === 'desc' ? -1 : 1;
      if (filter.sortBy === 'name')  return dir * a.name.localeCompare(b.name);
      if (filter.sortBy === 'stock') return dir * (a.stock - b.stock);
      if (filter.sortBy === 'price') return dir * (a.sellingPrice - b.sellingPrice);
      return dir * (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) * -1;
    });
    return r;
  }, [rows, filter]);

  const openNew  = () => { setEditId(null); setForm(empty); setOpen(true); };
  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({ name: p.name, sku: p.sku||'', unit: p.unit, costPrice: String(p.costPrice), sellingPrice: String(p.sellingPrice), stock: String(p.stock) });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...form, costPrice: Number(form.costPrice), sellingPrice: Number(form.sellingPrice), stock: Number(form.stock) };
    if (editId) await api.put(`/products/${editId}`, data);
    else        await api.post('/products', data);
    setOpen(false); setForm(empty); setEditId(null); load();
  };

  const handleDelete = async (id: number, name: string) => {
    if (isAdmin) {
      if (!confirm(`Xóa sản phẩm "${name}"?`)) return;
      try { await api.delete(`/products/${id}`); load(); }
      catch (err: any) { alert(err.response?.data?.error || 'Không thể xóa'); }
    } else {
      setDeleteModal({ id, name });
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Sản phẩm</h1>
        <button className="btn cyan" onClick={openNew}>+ Thêm mới</button>
      </div>

      {open && (
        <div className="form-panel mb-16">
          <form onSubmit={submit}>
            <div className="fg3" style={{ marginBottom: 10 }}>
              <div><label className="lbl">Tên sản phẩm *</label><input className="inp" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="lbl">SKU</label><input className="inp" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
              <div><label className="lbl">Đơn vị</label><input className="inp" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
              <div><label className="lbl">Giá vốn</label><input className="inp" type="number" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} /></div>
              <div><label className="lbl">Giá bán</label><input className="inp" type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} /></div>
              <div><label className="lbl">Tồn kho</label><input className="inp" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn cyan">{editId ? '[ Cập nhật ]' : '[ Lưu ]'}</button>
              <button type="button" className="btn ghost" onClick={() => setOpen(false)}>[ Hủy ]</button>
            </div>
          </form>
        </div>
      )}

      <FilterBar
        value={filter} onChange={setFilter}
        totalCount={rows.length} resultCount={filtered.length}
        searchPlaceholder="Tìm tên SP, SKU, đơn vị..."
        statusOptions={[
          { value: 'out', label: 'Hết hàng' },
          { value: 'low', label: 'Sắp hết (≤5)' },
          { value: 'ok',  label: 'Còn hàng' },
        ]}
        sortOptions={[
          { value: 'date_desc',  label: '↓ Mới nhất' },
          { value: 'date_asc',   label: '↑ Cũ nhất' },
          { value: 'name_asc',   label: 'A→Z Tên SP' },
          { value: 'name_desc',  label: 'Z→A Tên SP' },
          { value: 'stock_asc',  label: '↑ Tồn ít nhất' },
          { value: 'stock_desc', label: '↓ Tồn nhiều nhất' },
          { value: 'price_desc', label: '↓ Giá bán cao nhất' },
          { value: 'price_asc',  label: '↑ Giá bán thấp nhất' },
        ]}
      />

      <div className="table-wrap">
        <table className="nt">
          <thead><tr><th>Tên SP</th><th>SKU</th><th>ĐVT</th><th>Giá vốn</th><th>Giá bán</th><th>Tồn kho</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr className="empty-row"><td colSpan={7}>{rows.length === 0 ? 'Chưa có sản phẩm' : 'Không tìm thấy kết quả'}</td></tr>}
            {filtered.map((p) => (
              <tr key={p.id}>
                <td className="c-bright fw7">{p.name}</td>
                <td className="c-dim">{p.sku || '—'}</td>
                <td>{p.unit}</td>
                <td className="c-dim">{fmt(p.costPrice)}</td>
                <td className="c-cyan">{fmt(p.sellingPrice)}</td>
                <td><span className={`tag ${p.stock <= 0 ? 'red' : p.stock <= 5 ? 'yellow' : 'green'}`}>{p.stock}</span></td>
                <td><div className="td-act">
                  <button className="btn yellow btn-sm" onClick={() => openEdit(p)}>Sửa</button>
                  <button className={`btn ${isAdmin ? 'red' : 'ghost'} btn-sm`} onClick={() => handleDelete(p.id, p.name)}>
                    {isAdmin ? 'Xóa' : '🗑 Yêu cầu'}
                  </button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteModal && (
        <RequestDeleteModal
          modelName="Product"
          recordId={deleteModal.id}
          recordLabel={deleteModal.name}
          onClose={() => setDeleteModal(null)}
        />
      )}
    </div>
  );
}
