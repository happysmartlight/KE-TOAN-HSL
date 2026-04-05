import EmptyState from '../components/EmptyState';
import { toast } from '../components/Toast';
import { useEffect, useMemo, useState } from 'react';
import { useEscKey } from '../hooks/useKeyboard';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import SearchSelect from '../components/SearchSelect';
import FilterBar, { defaultFilter } from '../components/FilterBar';
import type { FilterState } from '../components/FilterBar';

const fmt = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

export default function Purchases() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [rows, setRows]           = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts]   = useState<any[]>([]);
  const [open, setOpen]           = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [note, setNote]           = useState('');
  const [items, setItems]         = useState([{ productId: '', quantity: 1, costPrice: 0 }]);
  const [filter, setFilter] = useState<FilterState>(defaultFilter);

  useEscKey(open ? () => setOpen(false) : null);

  const [loading, setLoading] = useState(true);
  const load = () => api.get('/purchases').then((r) => { setRows(r.data); setLoading(false); });
  useEffect(() => { load(); api.get('/suppliers').then((r) => setSuppliers(r.data)); api.get('/products').then((r) => setProducts(r.data)); }, []);

  const addItem = () => setItems([...items, { productId: '', quantity: 1, costPrice: 0 }]);
  const updateItem = (i: number, field: string, val: any) => {
    const updated = [...items];
    (updated[i] as any)[field] = val;
    if (field === 'productId') { const p = products.find((p) => p.id === Number(val)); if (p) updated[i].costPrice = p.costPrice; }
    setItems(updated);
  };
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const total = items.reduce((s, i) => s + Number(i.quantity) * Number(i.costPrice), 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/purchases', { supplierId: Number(supplierId), note, items: items.map((i) => ({ productId: Number(i.productId), quantity: Number(i.quantity), costPrice: Number(i.costPrice) })) });
      setOpen(false); setItems([{ productId: '', quantity: 1, costPrice: 0 }]); setSupplierId(''); setNote(''); load();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Lỗi'); }
  };

  const filtered = useMemo(() => {
    let r = [...rows];
    if (filter.search) {
      const q = filter.search.toLowerCase();
      r = r.filter((po) =>
        po.code?.toLowerCase().includes(q) ||
        po.supplier?.name?.toLowerCase().includes(q) ||
        po.supplier?.phone?.toLowerCase().includes(q)
      );
    }
    if (filter.status)    r = r.filter((po) => po.status === filter.status);
    if (filter.dateFrom)  r = r.filter((po) => new Date(po.createdAt) >= new Date(filter.dateFrom));
    if (filter.dateTo)    r = r.filter((po) => new Date(po.createdAt) <= new Date(filter.dateTo + 'T23:59:59'));
    if (filter.amountMin) r = r.filter((po) => po.totalAmount >= Number(filter.amountMin));
    if (filter.amountMax) r = r.filter((po) => po.totalAmount <= Number(filter.amountMax));
    r.sort((a, b) => {
      const dir = filter.sortDir === 'desc' ? -1 : 1;
      if (filter.sortBy === 'amount')   return dir * (a.totalAmount - b.totalAmount);
      if (filter.sortBy === 'supplier') return dir * (a.supplier?.name || '').localeCompare(b.supplier?.name || '');
      return dir * (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) * -1;
    });
    return r;
  }, [rows, filter]);

  const handleCancel = async (po: any) => {
    const msg = po.paidAmount > 0
      ? `Hủy đơn nhập "${po.code}"?\n⚠️ Đã trả ${fmt(po.paidAmount)} — phần này cần xử lý thủ công.`
      : `Hủy đơn nhập "${po.code}"?`;
    if (!confirm(msg)) return;
    try {
      await api.patch(`/purchases/${po.id}/cancel`);
      load();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Lỗi khi hủy'); }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Nhập hàng</h1>
        <button className="btn cyan" onClick={() => setOpen(!open)}>+ Tạo đơn nhập</button>
      </div>

      {open && (
        <div className="form-panel mb-16">
          <form onSubmit={submit}>
            <div className="fg2" style={{ marginBottom: 12 }}>
              <div>
                <label className="lbl">Nhà cung cấp *</label>
                <SearchSelect
                  required
                  value={supplierId}
                  onChange={setSupplierId}
                  placeholder="-- Tìm nhà cung cấp --"
                  options={suppliers.map((s) => ({
                    value: String(s.id),
                    label: s.name,
                    meta: [s.phone, s.debt > 0 ? `Nợ: ${s.debt.toLocaleString('vi-VN')} ₫` : ''].filter(Boolean).join(' · ') || undefined,
                  }))}
                />
              </div>
              <div><label className="lbl">Ghi chú</label><input className="inp" value={note} onChange={(e) => setNote(e.target.value)} /></div>
            </div>

            <div className="table-wrap mb-12">
              <table className="nt">
                <thead><tr><th>Sản phẩm</th><th>Số lượng</th><th>Giá vốn</th><th>Thành tiền</th><th></th></tr></thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i}>
                      <td>
                        <SearchSelect
                          value={item.productId}
                          onChange={(v) => updateItem(i, 'productId', v)}
                          placeholder="-- Chọn sản phẩm --"
                          options={products.map((p) => ({
                            value: String(p.id),
                            label: p.name,
                            sublabel: p.sku || undefined,
                            meta: `Tồn: ${p.stock} ${p.unit} · Giá vốn: ${p.costPrice.toLocaleString('vi-VN')} ₫`,
                          }))}
                        />
                      </td>
                      <td><input className="inp" type="number" min={1} value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} style={{ width: 70 }} /></td>
                      <td><input className="inp" type="number" value={item.costPrice} onChange={(e) => updateItem(i, 'costPrice', e.target.value)} style={{ width: 120 }} /></td>
                      <td className="c-cyan fw7">{fmt(Number(item.quantity) * Number(item.costPrice))}</td>
                      <td>{items.length > 1 && <button type="button" className="btn red btn-sm" onClick={() => removeItem(i)}>×</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="form-actions">
                <button type="button" className="btn ghost" onClick={addItem}>+ Thêm dòng</button>
                <button type="submit" className="btn cyan">[ Tạo đơn nhập ]</button>
                <button type="button" className="btn ghost" onClick={() => setOpen(false)}>[ Hủy ]</button>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--cyan)' }}>Tổng: {fmt(total)}</div>
            </div>
          </form>
        </div>
      )}

      <FilterBar
        value={filter} onChange={setFilter}
        totalCount={rows.length} resultCount={filtered.length}
        searchPlaceholder="Tìm mã đơn, tên NCC, SĐT..."
        statusOptions={[
          { value: 'unpaid',    label: 'Chưa TT' },
          { value: 'partial',   label: 'Một phần' },
          { value: 'paid',      label: 'Đã TT' },
          { value: 'cancelled', label: 'Đã hủy' },
        ]}
        sortOptions={[
          { value: 'date_desc',      label: '↓ Ngày mới nhất' },
          { value: 'date_asc',       label: '↑ Ngày cũ nhất' },
          { value: 'amount_desc',    label: '↓ Tiền nhiều nhất' },
          { value: 'amount_asc',     label: '↑ Tiền ít nhất' },
          { value: 'supplier_asc',   label: 'A→Z Nhà cung cấp' },
          { value: 'supplier_desc',  label: 'Z→A Nhà cung cấp' },
        ]}
      />

      <div className="table-wrap">
        <table className="nt">
          <thead><tr><th>Mã đơn</th><th>Nhà cung cấp</th><th>Tổng tiền</th><th>Trạng thái</th><th>Ngày tạo</th><th></th></tr></thead>
          <tbody>
            {loading ? Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} className="skeleton-row">
                <td><div className="skeleton w-sm"></div></td>
                <td><div className="skeleton w-md"></div></td>
                <td><div className="skeleton w-sm"></div></td>
                <td><div className="skeleton w-xs"></div></td>
                <td><div className="skeleton w-xs"></div></td>
                <td><div className="skeleton w-sm"></div></td>
              </tr>
            )) : <>
            {filtered.length === 0 && (
              <tr className="empty-row"><td colSpan={6}>
                <EmptyState icon="🛒" title={rows.length === 0 ? 'Chưa có đơn nhập hàng' : 'Không tìm thấy kết quả'}
                  description={rows.length === 0 ? 'Tạo đơn nhập hàng đầu tiên.' : 'Thử thay đổi từ khóa hoặc bộ lọc.'} />
              </td></tr>
            )}
            {filtered.map((p) => {
              const isCancelled = p.status === 'cancelled';
              return (
              <tr key={p.id} style={isCancelled ? { opacity: 0.5 } : {}}>
                <td className="c-cyan">{p.code}</td>
                <td className="c-bright">{p.supplier?.name}</td>
                <td>{fmt(p.totalAmount)}</td>
                <td><span className={`tag ${p.status === 'paid' ? 'green' : p.status === 'partial' ? 'yellow' : p.status === 'cancelled' ? 'red' : 'red'}`}>
                  {p.status === 'paid' ? 'Đã TT' : p.status === 'partial' ? 'Một phần' : p.status === 'cancelled' ? 'Đã hủy' : 'Chưa TT'}
                </span></td>
                <td className="c-dim">{new Date(p.createdAt).toLocaleDateString('vi-VN')}</td>
                <td>
                  {isAdmin && !isCancelled && (
                    <button className="btn red btn-sm" onClick={() => handleCancel(p)}>Hủy</button>
                  )}
                </td>
              </tr>
              );
            })}
            </>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
