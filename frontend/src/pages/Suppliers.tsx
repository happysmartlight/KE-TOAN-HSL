import { useEffect, useMemo, useState, useRef } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import RequestDeleteModal from '../components/RequestDeleteModal';
import FilterBar, { defaultFilter } from '../components/FilterBar';
import type { FilterState } from '../components/FilterBar';
import HoloCard from '../components/HoloCard';
import type { HoloData } from '../components/HoloCard';

const fmt = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

const SUPPLIER_TYPES = [
  { value: 'domestic',      label: 'Nội địa' },
  { value: 'intermediary',  label: 'Trung gian' },
  { value: 'international', label: 'Quốc tế' },
];

const empty = { name: '', phone: '', email: '', address: '', companyName: '', taxCode: '', supplierType: 'domestic' };

export default function Suppliers() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ ...empty });
  const [editId, setEditId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [payModal, setPayModal] = useState<any>(null);
  const [payAmount, setPayAmount] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ id: number; name: string } | null>(null);
  const [filter, setFilter] = useState<FilterState>(defaultFilter);
  const [cardData, setCardData] = useState<HoloData | null>(null);

  // MST lookup
  const [mstLoading, setMstLoading] = useState(false);
  const [mstResult, setMstResult] = useState<any>(null);
  const [mstError, setMstError]   = useState('');
  const mstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = () => api.get('/suppliers').then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  // Debounced MST lookup when taxCode changes and type is domestic
  useEffect(() => {
    if (form.supplierType !== 'domestic' || form.taxCode.length < 10) {
      setMstResult(null); setMstError(''); return;
    }
    if (mstTimer.current) clearTimeout(mstTimer.current);
    mstTimer.current = setTimeout(async () => {
      setMstLoading(true); setMstError(''); setMstResult(null);
      try {
        const r = await api.get(`/suppliers/tax-lookup/${form.taxCode}`);
        setMstResult(r.data);
      } catch (err: any) {
        setMstError(err.response?.data?.error || 'Không tra được MST');
      } finally { setMstLoading(false); }
    }, 800);
    return () => { if (mstTimer.current) clearTimeout(mstTimer.current); };
  }, [form.taxCode, form.supplierType]);

  const applyMst = () => {
    if (!mstResult) return;
    setForm((f) => ({ ...f, name: mstResult.name || f.name, address: mstResult.address || f.address, companyName: mstResult.name || f.companyName }));
    setMstResult(null);
  };

  const filtered = useMemo(() => {
    let r = [...rows];
    if (filter.search) {
      const q = filter.search.toLowerCase();
      r = r.filter((s) =>
        s.name?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.companyName?.toLowerCase().includes(q) ||
        s.taxCode?.toLowerCase().includes(q)
      );
    }
    if (filter.status === 'has_debt') r = r.filter((s) => s.debt > 0);
    if (filter.status === 'no_debt')  r = r.filter((s) => s.debt <= 0);
    if (filter.type) r = r.filter((s) => s.supplierType === filter.type);
    r.sort((a, b) => {
      const dir = filter.sortDir === 'desc' ? -1 : 1;
      if (filter.sortBy === 'name') return dir * a.name.localeCompare(b.name);
      if (filter.sortBy === 'debt') return dir * (a.debt - b.debt);
      return dir * (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) * -1;
    });
    return r;
  }, [rows, filter]);

  const openNew  = () => { setEditId(null); setForm({ ...empty }); setMstResult(null); setMstError(''); setOpen(true); };
  const openEdit = (s: any) => {
    setEditId(s.id);
    setForm({ name: s.name, phone: s.phone||'', email: s.email||'', address: s.address||'', companyName: s.companyName||'', taxCode: s.taxCode||'', supplierType: s.supplierType||'domestic' });
    setMstResult(null); setMstError('');
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editId) await api.put(`/suppliers/${editId}`, form);
    else        await api.post('/suppliers', form);
    setOpen(false); setForm({ ...empty }); setEditId(null); load();
  };

  const submitPayment = async () => {
    try {
      await api.post('/purchases/supplier-payments', { supplierId: payModal.id, amount: Number(payAmount) });
      setPayModal(null); setPayAmount(''); load();
    } catch (err: any) { alert(err.response?.data?.error || 'Lỗi'); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (isAdmin) {
      if (!confirm(`Xóa nhà cung cấp "${name}"?`)) return;
      try { await api.delete(`/suppliers/${id}`); load(); }
      catch (err: any) { alert(err.response?.data?.error || 'Không thể xóa'); }
    } else {
      setDeleteModal({ id, name });
    }
  };

  const typeLabel = (t: string) => SUPPLIER_TYPES.find((x) => x.value === t)?.label || t;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Nhà cung cấp</h1>
        <button className="btn cyan" onClick={openNew}>+ Thêm mới</button>
      </div>

      {open && (
        <div className="form-panel mb-16">
          <form onSubmit={submit}>
            {/* Row 1: type + name */}
            <div className="fg2" style={{ marginBottom: 10 }}>
              <div>
                <label className="lbl">Loại NCC *</label>
                <select className="inp" value={form.supplierType} onChange={(e) => setForm({ ...form, supplierType: e.target.value, taxCode: '', companyName: '' })}>
                  {SUPPLIER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div><label className="lbl">Tên hiển thị *</label><input className="inp" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            </div>

            {/* MST section — only for domestic */}
            {form.supplierType === 'domestic' && (
              <div className="fg2" style={{ marginBottom: 10 }}>
                <div>
                  <label className="lbl">Mã số thuế (MST)</label>
                  <input className="inp" placeholder="Nhập MST để tra cứu tự động…" value={form.taxCode} onChange={(e) => setForm({ ...form, taxCode: e.target.value })} />
                  {mstLoading && <div style={{ fontSize: 11, color: '#8898b8', marginTop: 4 }}>⟳ Đang tra cứu…</div>}
                  {mstResult && (
                    <div style={{ marginTop: 6, padding: '8px 10px', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.25)', borderRadius: 4, fontSize: 11 }}>
                      <div style={{ color: '#00ff88', fontWeight: 700 }}>{mstResult.name}</div>
                      {mstResult.address && <div style={{ color: '#9098b8', marginTop: 2 }}>{mstResult.address}</div>}
                      {mstResult.status  && <div style={{ color: '#9090b8', marginTop: 2 }}>Trạng thái: {mstResult.status}</div>}
                      <button type="button" className="btn green btn-sm" style={{ marginTop: 6 }} onClick={applyMst}>
                        ✓ Dùng thông tin này
                      </button>
                    </div>
                  )}
                  {mstError && <div style={{ fontSize: 11, color: '#ff5577', marginTop: 4 }}>{mstError}</div>}
                </div>
                <div><label className="lbl">Tên công ty</label><input className="inp" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></div>
              </div>
            )}

            {/* Row 3: contact */}
            <div className="fg2" style={{ marginBottom: 10 }}>
              <div><label className="lbl">Điện thoại</label><input className="inp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><label className="lbl">Email</label><input className="inp" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><label className="lbl">Địa chỉ</label><input className="inp" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
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
        searchPlaceholder="Tìm tên, SĐT, email, MST..."
        statusOptions={[
          { value: 'has_debt', label: 'Đang nợ' },
          { value: 'no_debt',  label: 'Không nợ' },
        ]}
        typeOptions={[
          { value: 'domestic',      label: 'Nội địa' },
          { value: 'intermediary',  label: 'Trung gian' },
          { value: 'international', label: 'Quốc tế' },
        ]}
        sortOptions={[
          { value: 'date_desc', label: '↓ Mới nhất' },
          { value: 'date_asc',  label: '↑ Cũ nhất' },
          { value: 'name_asc',  label: 'A→Z Tên' },
          { value: 'name_desc', label: 'Z→A Tên' },
          { value: 'debt_desc', label: '↓ Nợ nhiều nhất' },
          { value: 'debt_asc',  label: '↑ Nợ ít nhất' },
        ]}
      />

      <div className="table-wrap">
        <table className="nt">
          <thead><tr><th>Tên NCC</th><th>Loại</th><th>MST / Công ty</th><th>Điện thoại</th><th>Đang nợ</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr className="empty-row"><td colSpan={6}>{rows.length === 0 ? 'Chưa có nhà cung cấp' : 'Không tìm thấy kết quả'}</td></tr>}
            {filtered.map((s) => (
              <tr key={s.id}>
                <td className="c-bright fw7">{s.name}</td>
                <td><span className={`tag ${s.supplierType === 'international' ? 'purple' : s.supplierType === 'intermediary' ? 'yellow' : 'cyan'}`}>{typeLabel(s.supplierType)}</span></td>
                <td>
                  {s.taxCode && <div style={{ fontSize: 11, color: '#8898b8' }}>{s.taxCode}</div>}
                  {s.companyName && <div style={{ fontSize: 12 }}>{s.companyName}</div>}
                  {!s.taxCode && !s.companyName && <span className="c-dim">—</span>}
                </td>
                <td>{s.phone || <span className="c-dim">—</span>}</td>
                <td className={`fw7 ${s.debt > 0 ? 'c-red' : 'c-dim'}`}>{fmt(s.debt)}</td>
                <td><div className="td-act">
                  <button className="btn green btn-sm" onClick={() => setCardData({ type: 'supplier', id: s.id, name: s.name, createdAt: s.createdAt, phone: s.phone, email: s.email, address: s.address, companyName: s.companyName, taxCode: s.taxCode, debt: s.debt, supplierType: s.supplierType })}>Xem</button>
                  {s.debt > 0 && <button className="btn green btn-sm" onClick={() => { setPayModal(s); setPayAmount(String(s.debt)); }}>Trả tiền</button>}
                  <button className="btn yellow btn-sm" onClick={() => openEdit(s)}>Sửa</button>
                  <button className={`btn ${isAdmin ? 'red' : 'ghost'} btn-sm`} onClick={() => handleDelete(s.id, s.name)}>
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
          modelName="Supplier"
          recordId={deleteModal.id}
          recordLabel={deleteModal.name}
          onClose={() => setDeleteModal(null)}
        />
      )}

      {payModal && (
        <div className="modal-bg">
          <div className="modal">
            <div className="modal-title">◈ Trả tiền NCC — {payModal.name}</div>
            <div className="report-row" style={{ marginBottom: 14 }}>
              <span className="lbl-r">Đang nợ</span>
              <span className="c-red fw7">{fmt(payModal.debt)}</span>
            </div>
            <label className="lbl">Số tiền trả</label>
            <input className="inp" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} style={{ marginBottom: 14 }} />
            <div className="form-actions">
              <button className="btn green" onClick={submitPayment}>[ Xác nhận ]</button>
              <button className="btn ghost" onClick={() => setPayModal(null)}>[ Hủy ]</button>
            </div>
          </div>
        </div>
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
