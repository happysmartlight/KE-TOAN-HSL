import { toast } from '../components/Toast';
import { useEffect, useMemo, useState } from 'react';
import { useEscKey } from '../hooks/useKeyboard';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import RequestDeleteModal from '../components/RequestDeleteModal';
import ConfirmModal from '../components/ConfirmModal';
import FilterBar, { defaultFilter } from '../components/FilterBar';
import type { FilterState } from '../components/FilterBar';
import HoloCard, { getProductRank } from '../components/HoloCard';
import type { HoloData } from '../components/HoloCard';
import EmptyState from '../components/EmptyState';

const fmt = (n: number) => n.toLocaleString('vi-VN') + ' ₫';
const empty = { name: '', sku: '', unit: 'cái', costPrice: '', sellingPrice: '', stock: '', taxRate: '10%' };

const TAX_OPTIONS = ['0%', '5%', '8%', '10%', 'KCT'];
const TAX_COLOR: Record<string, string> = { '10%': 'cyan', '8%': 'yellow', '5%': 'yellow', '0%': 'purple', 'KCT': 'red' };

export default function Products() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: number; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string; stock: number } | null>(null);

  const [filter, setFilter] = useState<FilterState>({ ...defaultFilter, sortBy: 'sold', sortDir: 'desc' });
  const [cardData, setCardData] = useState<HoloData | null>(null);

  useEscKey(cardData ? () => setCardData(null) : open ? () => setOpen(false) : null);

  const [loading, setLoading] = useState(true);
  const load = () => api.get('/products').then((r) => { setRows(r.data); setLoading(false); });
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
      if (filter.sortBy === 'name')    return dir * a.name.localeCompare(b.name);
      if (filter.sortBy === 'stock')   return dir * (a.stock - b.stock);
      if (filter.sortBy === 'price')   return dir * (a.sellingPrice - b.sellingPrice);
      if (filter.sortBy === 'sold')    return dir * ((a.totalRevenue ?? 0) - (b.totalRevenue ?? 0));
      return dir * (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) * -1;
    });
    return r;
  }, [rows, filter]);

  const openNew  = () => { setEditId(null); setForm(empty); setOpen(true); };
  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({ name: p.name, sku: p.sku||'', unit: p.unit, costPrice: String(p.costPrice), sellingPrice: String(p.sellingPrice), stock: String(p.stock), taxRate: p.taxRate || '10%' });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...form, costPrice: Number(form.costPrice), sellingPrice: Number(form.sellingPrice), stock: Number(form.stock) };
    if (editId) await api.put(`/products/${editId}`, data);
    else        await api.post('/products', data);
    setOpen(false); setForm(empty); setEditId(null); load();
  };

  const handleDelete = (id: number, name: string, stock: number) => {
    if (isAdmin) {
      setConfirmDelete({ id, name, stock });
    } else {
      setDeleteModal({ id, name });
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/products/${confirmDelete.id}`);
      setConfirmDelete(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Không thể xóa');
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
              <div>
                <label className="lbl">Thuế suất VAT</label>
                <select className="inp" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })}>
                  {TAX_OPTIONS.map(t => <option key={t} value={t}>{t === 'KCT' ? 'KCT (không chịu thuế)' : t}</option>)}
                </select>
              </div>
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
          { value: 'sold_desc',  label: '↓ Bán chạy nhất' },
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
          <thead><tr><th>Tên SP</th><th>SKU</th><th>ĐVT</th><th>Giá vốn</th><th>Giá bán</th><th>VAT</th><th>Đã bán</th><th>Tồn kho</th><th></th></tr></thead>
          <tbody>
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="skeleton-row">
                <td><div className="skeleton w-lg"></div></td>
                <td><div className="skeleton w-xs"></div></td>
                <td><div className="skeleton w-xs"></div></td>
                <td><div className="skeleton w-sm"></div></td>
                <td><div className="skeleton w-sm"></div></td>
                <td><div className="skeleton w-xs"></div></td>
                <td><div className="skeleton w-sm"></div></td>
                <td><div className="skeleton w-xs"></div></td>
                <td><div className="skeleton w-sm"></div></td>
              </tr>
            )) : <>
            {filtered.length === 0 && (
              <tr className="empty-row"><td colSpan={9}>
                <EmptyState
                  icon="📦"
                  title={rows.length === 0 ? 'Chưa có sản phẩm' : 'Không tìm thấy kết quả'}
                  description={rows.length === 0 ? 'Thêm sản phẩm đầu tiên để bắt đầu quản lý kho.' : 'Thử thay đổi từ khóa hoặc bộ lọc.'}
                />
              </td></tr>
            )}
            {filtered.map((p) => {
              const rank = getProductRank(p.totalRevenue ?? 0);
              return (
              <tr key={p.id} style={rank ? { background: `${rank.color}08` } : undefined}>
                <td style={rank ? { borderLeft: `2px solid ${rank.color}55` } : undefined}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {rank && <span title={rank.label} style={{ fontSize: 14, flexShrink: 0 }}>{rank.icon}</span>}
                    <div>
                      <div className="fw7" style={rank ? { color: rank.color } : { color: 'var(--bright)' }}>{p.name}</div>
                      {rank && (
                        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, marginTop: 2, color: rank.color, textTransform: 'uppercase' }}>
                          {rank.label}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="c-dim">{p.sku || '—'}</td>
                <td>{p.unit}</td>
                <td className="c-dim">{fmt(p.costPrice)}</td>
                <td style={{ color: rank?.color ?? 'var(--cyan)' }} className="fw7">{fmt(p.sellingPrice)}</td>
                <td><span className={`tag ${TAX_COLOR[p.taxRate] || 'cyan'}`}>{p.taxRate || '10%'}</span></td>
                <td>
                  {(p.totalRevenue ?? 0) > 0 ? (
                    <>
                      <div className="fw7" style={{ color: rank?.color ?? 'var(--cyan)', fontSize: 12 }}>{fmt(p.totalRevenue)}</div>
                      <div className="c-dim" style={{ fontSize: 10 }}>{(p.totalSold ?? 0).toLocaleString('vi-VN')} {p.unit}</div>
                    </>
                  ) : <span className="c-dim">—</span>}
                </td>
                <td><span className={`tag ${p.stock <= 0 ? 'red' : p.stock <= 5 ? 'yellow' : 'green'}`}>{p.stock}</span></td>
                <td><div className="td-act">
                  <button className="btn green btn-sm" onClick={() => setCardData({ type: 'product', id: p.id, name: p.name, createdAt: p.createdAt, sku: p.sku, unit: p.unit, costPrice: p.costPrice, sellingPrice: p.sellingPrice, stock: p.stock, totalSold: p.totalSold, totalRevenue: p.totalRevenue })}>Xem</button>
                  <button className="btn yellow btn-sm" onClick={() => openEdit(p)}>Sửa</button>
                  <button className={`btn ${isAdmin ? 'red' : 'ghost'} btn-sm`} onClick={() => handleDelete(p.id, p.name, p.stock)}>
                    {isAdmin ? 'Xóa' : '🗑 Yêu cầu'}
                  </button>
                </div></td>
              </tr>
              );
            })}
            </>}
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

      {confirmDelete && (
        <ConfirmModal
          title={`Xóa sản phẩm "${confirmDelete.name}"`}
          message="Sản phẩm sẽ bị ẩn khỏi danh sách. Dữ liệu lịch sử hóa đơn và kho vẫn được giữ lại."
          warning={confirmDelete.stock > 0 ? `Sản phẩm còn ${confirmDelete.stock} đơn vị tồn kho — hãy kiểm tra trước khi xóa.` : undefined}
          confirmLabel="Xác nhận xóa"
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {cardData && (
        <div className="holo-modal-bg" onClick={() => setCardData(null)}>
          <div className="holo-modal-inner" onClick={(e) => e.stopPropagation()}>
            <HoloCard data={cardData} />
            <button className="holo-modal-close" onClick={() => setCardData(null)}>[ Đóng ]</button>
          </div>
        </div>
      )}
    </div>
  );
}
