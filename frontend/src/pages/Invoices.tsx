import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import SearchSelect from '../components/SearchSelect';
import FilterBar, { defaultFilter } from '../components/FilterBar';
import type { FilterState } from '../components/FilterBar';

const fmt = (n: number) => n.toLocaleString('vi-VN') + ' ₫';
const STATUS: Record<string, { label: string; cls: string }> = {
  unpaid:     { label: 'Chưa TT',   cls: 'red' },
  partial:    { label: 'Một phần',  cls: 'yellow' },
  paid:       { label: 'Đã TT',     cls: 'green' },
  cancelled:  { label: 'Đã hủy',    cls: 'red' },
};

const emptyNewCustomer = { name: '', phone: '', companyName: '', taxCode: '' };

export default function Invoices() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [rows, setRows]       = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts]   = useState<any[]>([]);
  const [open, setOpen]           = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [note, setNote]           = useState('');
  const [items, setItems]         = useState([{ productId: '', quantity: 1, price: 0 }]);
  const [payModal, setPayModal]   = useState<any>(null);
  const [payAmount, setPayAmount] = useState('');
  const [confirmModal, setConfirmModal] = useState<null | { type: 'cancel' | 'delete'; inv: any }>(null);
  const [filter, setFilter] = useState<FilterState>(defaultFilter);

  // Inline new customer
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState(emptyNewCustomer);
  const [ncTaxLoading, setNcTaxLoading] = useState(false);
  const [ncTaxError, setNcTaxError] = useState('');
  const ncTaxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadCustomers = () => api.get('/customers').then((r) => setCustomers(r.data));
  const load = () => api.get('/invoices').then((r) => setRows(r.data));
  useEffect(() => {
    load();
    loadCustomers();
    api.get('/products').then((r) => setProducts(r.data));
  }, []);

  const addItem = () => setItems([...items, { productId: '', quantity: 1, price: 0 }]);
  const updateItem = (i: number, field: string, val: any) => {
    const updated = [...items];
    (updated[i] as any)[field] = val;
    if (field === 'productId') {
      const p = products.find((p) => p.id === Number(val));
      if (p) updated[i].price = p.sellingPrice;
    }
    setItems(updated);
  };
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const total = items.reduce((s, i) => s + Number(i.quantity) * Number(i.price), 0);

  // Auto-lookup MST trong inline form
  const handleNcTaxCode = (val: string) => {
    setNewCustomer((f) => ({ ...f, taxCode: val }));
    setNcTaxError('');
    if (ncTaxTimerRef.current) clearTimeout(ncTaxTimerRef.current);
    if (val.trim().length >= 10) {
      ncTaxTimerRef.current = setTimeout(async () => {
        setNcTaxLoading(true);
        try {
          const { data } = await api.get(`/customers/tax-lookup/${val.trim()}`);
          setNewCustomer((f) => ({
            ...f,
            companyName: f.companyName || data.name || '',
          }));
        } catch (err: any) {
          setNcTaxError(err.response?.data?.error || 'Không tìm thấy MST');
        } finally {
          setNcTaxLoading(false);
        }
      }, 800);
    }
  };

  const saveNewCustomer = async () => {
    if (!newCustomer.name.trim()) { alert('Vui lòng nhập tên khách hàng'); return; }
    try {
      const { data } = await api.post('/customers', newCustomer);
      await loadCustomers();
      setCustomerId(String(data.id));
      setShowNewCustomer(false);
      setNewCustomer(emptyNewCustomer);
      setNcTaxError('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Lỗi khi thêm khách hàng');
    }
  };

  const submitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/invoices', {
        customerId: Number(customerId),
        note,
        items: items.map((i) => ({
          productId: Number(i.productId),
          quantity: Number(i.quantity),
          price: Number(i.price),
        })),
      });
      setOpen(false);
      setItems([{ productId: '', quantity: 1, price: 0 }]);
      setCustomerId(''); setNote('');
      setShowNewCustomer(false);
      load();
    } catch (err: any) { alert(err.response?.data?.error || 'Lỗi'); }
  };

  const submitPayment = async () => {
    try {
      await api.post('/payments', { invoiceId: payModal.id, amount: Number(payAmount) });
      setPayModal(null); setPayAmount(''); load();
    } catch (err: any) { alert(err.response?.data?.error || 'Lỗi'); }
  };

  const filtered = useMemo(() => {
    let r = [...rows];
    if (filter.search) {
      const q = filter.search.toLowerCase();
      r = r.filter((inv) =>
        inv.code?.toLowerCase().includes(q) ||
        inv.customer?.name?.toLowerCase().includes(q) ||
        inv.customer?.phone?.toLowerCase().includes(q) ||
        inv.customer?.taxCode?.toLowerCase().includes(q) ||
        inv.customer?.companyName?.toLowerCase().includes(q)
      );
    }
    if (filter.status)    r = r.filter((inv) => inv.status === filter.status);
    if (filter.dateFrom)  r = r.filter((inv) => new Date(inv.createdAt) >= new Date(filter.dateFrom));
    if (filter.dateTo)    r = r.filter((inv) => new Date(inv.createdAt) <= new Date(filter.dateTo + 'T23:59:59'));
    if (filter.amountMin) r = r.filter((inv) => inv.totalAmount >= Number(filter.amountMin));
    if (filter.amountMax) r = r.filter((inv) => inv.totalAmount <= Number(filter.amountMax));
    r.sort((a, b) => {
      const dir = filter.sortDir === 'desc' ? -1 : 1;
      if (filter.sortBy === 'amount')   return dir * (a.totalAmount - b.totalAmount);
      if (filter.sortBy === 'customer') return dir * (a.customer?.name || '').localeCompare(b.customer?.name || '');
      return dir * (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) * -1;
    });
    return r;
  }, [rows, filter]);

  const doCancel = async (inv: any) => {
    try {
      await api.patch(`/invoices/${inv.id}/cancel`);
      setConfirmModal(null); load();
    } catch (err: any) { alert(err.response?.data?.error || 'Lỗi khi hủy'); }
  };

  const doDelete = async (inv: any) => {
    try {
      await api.delete(`/invoices/${inv.id}`);
      setConfirmModal(null); load();
    } catch (err: any) { alert(err.response?.data?.error || 'Lỗi khi xóa'); }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Hóa đơn bán</h1>
        <button className="btn cyan" onClick={() => { setOpen(!open); setShowNewCustomer(false); }}>+ Tạo hóa đơn</button>
      </div>

      {open && (
        <div className="form-panel mb-16">
          <form onSubmit={submitInvoice}>
            <div className="fg2" style={{ marginBottom: 8 }}>
              {/* Chọn khách hàng */}
              <div>
                <label className="lbl">Khách hàng *</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <SearchSelect
                    style={{ flex: 1 }}
                    required
                    value={customerId}
                    onChange={(v) => { setCustomerId(v); setShowNewCustomer(false); }}
                    placeholder="-- Tìm khách hàng --"
                    options={customers.map((c) => ({
                      value: String(c.id),
                      label: c.name,
                      sublabel: c.companyName || undefined,
                      meta: [c.phone, c.debt > 0 ? `Nợ: ${c.debt.toLocaleString('vi-VN')} ₫` : ''].filter(Boolean).join(' · ') || undefined,
                    }))}
                  />
                  <button type="button"
                    className={`btn btn-sm ${showNewCustomer ? 'yellow' : 'ghost'}`}
                    onClick={() => setShowNewCustomer((v) => !v)}
                    title="Thêm khách hàng mới">
                    {showNewCustomer ? '✕' : '+ KH mới'}
                  </button>
                </div>

                {/* Thông tin KH đã chọn */}
                {customerId && !showNewCustomer && (() => {
                  const c = customers.find((x) => String(x.id) === customerId);
                  return c ? (
                    <div style={{ marginTop: 6, padding: '6px 10px', background: 'rgba(0,180,255,0.05)', borderRadius: 4, border: '1px solid rgba(0,180,255,0.15)', fontSize: 11 }}>
                      {c.companyName && <span className="c-dim">{c.companyName} · </span>}
                      {c.taxCode && <span className="c-dim">MST: {c.taxCode} · </span>}
                      {c.phone && <span className="c-dim">{c.phone}</span>}
                      {c.debt > 0 && <span className="c-red fw7" style={{ marginLeft: 8 }}>Nợ: {fmt(c.debt)}</span>}
                    </div>
                  ) : null;
                })()}
              </div>

              <div><label className="lbl">Ghi chú</label><input className="inp" value={note} onChange={(e) => setNote(e.target.value)} /></div>
            </div>

            {/* Form inline thêm KH mới */}
            {showNewCustomer && (
              <div style={{ marginBottom: 12, padding: '12px 14px', background: 'rgba(255,200,0,0.04)', borderRadius: 6, border: '1px solid rgba(255,200,0,0.2)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--yellow)', marginBottom: 10 }}>+ Thêm khách hàng mới</div>
                <div className="fg2" style={{ marginBottom: 8 }}>
                  <div>
                    <label className="lbl">Tên KH *</label>
                    <input className="inp" value={newCustomer.name} placeholder="Nguyễn Văn A"
                      onChange={(e) => setNewCustomer((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="lbl">Số điện thoại</label>
                    <input className="inp" value={newCustomer.phone} placeholder="0901..."
                      onChange={(e) => setNewCustomer((f) => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>
                <div className="fg2" style={{ marginBottom: 8 }}>
                  <div>
                    <label className="lbl">MST {ncTaxLoading && <span className="c-dim">⏳</span>}</label>
                    <input className="inp" value={newCustomer.taxCode} placeholder="0123456789 (tự động điền)"
                      onChange={(e) => handleNcTaxCode(e.target.value)} />
                    {ncTaxError && <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 3 }}>✗ {ncTaxError}</div>}
                  </div>
                  <div>
                    <label className="lbl">Tên công ty</label>
                    <input className="inp" value={newCustomer.companyName} placeholder="Tự điền từ MST hoặc nhập tay"
                      onChange={(e) => setNewCustomer((f) => ({ ...f, companyName: e.target.value }))} />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn cyan btn-sm" onClick={saveNewCustomer}>[ Lưu & chọn ]</button>
                  <button type="button" className="btn ghost btn-sm" onClick={() => { setShowNewCustomer(false); setNewCustomer(emptyNewCustomer); }}>[ Hủy ]</button>
                </div>
              </div>
            )}

            {/* Bảng sản phẩm */}
            <div className="table-wrap mb-12">
              <table className="nt">
                <thead><tr><th>Sản phẩm</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th><th></th></tr></thead>
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
                            meta: `Tồn: ${p.stock} ${p.unit}`,
                            disabled: p.stock <= 0,
                          }))}
                        />
                      </td>
                      <td><input className="inp" type="number" min={1} value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} style={{ width: 70 }} /></td>
                      <td><input className="inp" type="number" value={item.price} onChange={(e) => updateItem(i, 'price', e.target.value)} style={{ width: 120 }} /></td>
                      <td className="c-cyan fw7">{fmt(Number(item.quantity) * Number(item.price))}</td>
                      <td>{items.length > 1 && <button type="button" className="btn red btn-sm" onClick={() => removeItem(i)}>×</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="form-actions">
                <button type="button" className="btn ghost" onClick={addItem}>+ Thêm dòng</button>
                <button type="submit" className="btn cyan">[ Tạo hóa đơn ]</button>
                <button type="button" className="btn ghost" onClick={() => setOpen(false)}>[ Hủy ]</button>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--cyan)' }}>Tổng: {fmt(total)}</div>
            </div>
          </form>
        </div>
      )}

      {/* Search / Filter / Sort */}
      <FilterBar
        value={filter} onChange={setFilter}
        totalCount={rows.length} resultCount={filtered.length}
        searchPlaceholder="Tìm mã HĐ, tên KH, SĐT, MST..."
        statusOptions={[
          { value: 'unpaid',    label: 'Chưa TT' },
          { value: 'partial',   label: 'Một phần' },
          { value: 'paid',      label: 'Đã TT' },
          { value: 'cancelled', label: 'Đã hủy' },
        ]}
        sortOptions={[
          { value: 'date_desc',     label: '↓ Ngày mới nhất' },
          { value: 'date_asc',      label: '↑ Ngày cũ nhất' },
          { value: 'amount_desc',   label: '↓ Tiền nhiều nhất' },
          { value: 'amount_asc',    label: '↑ Tiền ít nhất' },
          { value: 'customer_asc',  label: 'A→Z Tên khách hàng' },
          { value: 'customer_desc', label: 'Z→A Tên khách hàng' },
        ]}
      />

      {/* Bảng danh sách hóa đơn */}
      <div className="table-wrap">
        <table className="nt">
          <thead><tr><th>Mã HĐ</th><th>Khách hàng</th><th>Tổng tiền</th><th>Đã thu</th><th>Còn nợ</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr className="empty-row"><td colSpan={7}>{rows.length === 0 ? 'Chưa có hóa đơn' : 'Không tìm thấy kết quả'}</td></tr>}
            {filtered.map((inv) => {
              const s = STATUS[inv.status] || STATUS.unpaid;
              const remaining = inv.totalAmount - inv.paidAmount;
              const isCancelled = inv.status === 'cancelled';
              return (
                <tr key={inv.id}>
                  <td className="c-cyan" style={isCancelled ? { opacity: 0.45 } : {}}>{inv.code}</td>
                  <td style={isCancelled ? { opacity: 0.45 } : {}}>
                    <div className="c-bright">{inv.customer?.name}</div>
                    {inv.customer?.companyName && <div className="c-dim" style={{ fontSize: 10 }}>{inv.customer.companyName}</div>}
                  </td>
                  <td style={isCancelled ? { opacity: 0.45 } : {}}>{fmt(inv.totalAmount)}</td>
                  <td className="c-green" style={isCancelled ? { opacity: 0.45 } : {}}>{fmt(inv.paidAmount)}</td>
                  <td className={`fw7 ${remaining > 0 && !isCancelled ? 'c-red' : 'c-dim'}`} style={isCancelled ? { opacity: 0.45 } : {}}>{fmt(remaining)}</td>
                  <td style={isCancelled ? { opacity: 0.45 } : {}}><span className={`tag ${s.cls}`}>{s.label}</span></td>
                  <td><div className="td-act">
                    {!isCancelled && inv.status !== 'paid' && (
                      <button className="btn green btn-sm" onClick={() => { setPayModal(inv); setPayAmount(String(remaining)); }}>Thu tiền</button>
                    )}
                    {isAdmin && !isCancelled && (
                      <button className="btn red btn-sm" onClick={() => setConfirmModal({ type: 'cancel', inv })}>Hủy</button>
                    )}
                    {isAdmin && isCancelled && (
                      <button className="btn red btn-sm" onClick={() => setConfirmModal({ type: 'delete', inv })}>Xóa</button>
                    )}
                  </div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {confirmModal?.type === 'cancel' && (
        <ConfirmModal
          title={`Hủy hóa đơn ${confirmModal.inv.code}`}
          message={`Hóa đơn sẽ chuyển sang trạng thái "Đã hủy". Tồn kho và công nợ sẽ được hoàn lại tự động.`}
          warning={confirmModal.inv.paidAmount > 0
            ? `Hóa đơn đã thu ${fmt(confirmModal.inv.paidAmount)} — phần tiền này cần xử lý hoàn trả thủ công.`
            : undefined}
          confirmLabel="Xác nhận hủy"
          onConfirm={() => doCancel(confirmModal.inv)}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {confirmModal?.type === 'delete' && (
        <ConfirmModal
          title={`Xóa vĩnh viễn hóa đơn ${confirmModal.inv.code}`}
          message="Hóa đơn và toàn bộ dữ liệu liên quan sẽ bị xóa khỏi hệ thống."
          warning="Hành động này không thể hoàn tác."
          confirmLabel="Xóa vĩnh viễn"
          onConfirm={() => doDelete(confirmModal.inv)}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {payModal && (
        <div className="modal-bg">
          <div className="modal">
            <div className="modal-title">◈ Thu tiền — {payModal.code}</div>
            <div className="report-row" style={{ marginBottom: 14 }}>
              <span className="lbl-r">Còn nợ</span>
              <span className="c-red fw7">{fmt(payModal.totalAmount - payModal.paidAmount)}</span>
            </div>
            <label className="lbl">Số tiền thu</label>
            <input className="inp" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} style={{ marginBottom: 14 }} />
            <div className="form-actions">
              <button className="btn green" onClick={submitPayment}>[ Xác nhận ]</button>
              <button className="btn ghost" onClick={() => setPayModal(null)}>[ Hủy ]</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
