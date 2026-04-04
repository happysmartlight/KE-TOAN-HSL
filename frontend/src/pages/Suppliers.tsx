import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import RequestDeleteModal from '../components/RequestDeleteModal';
import FilterBar, { defaultFilter } from '../components/FilterBar';
import type { FilterState } from '../components/FilterBar';

const fmt = (n: number) => n.toLocaleString('vi-VN') + ' ₫';
const empty = { name: '', phone: '', email: '', address: '' };

export default function Suppliers() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [payModal, setPayModal] = useState<any>(null);
  const [payAmount, setPayAmount] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ id: number; name: string } | null>(null);

  const [filter, setFilter] = useState<FilterState>(defaultFilter);

  const load = () => api.get('/suppliers').then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (filter.search) {
      const q = filter.search.toLowerCase();
      r = r.filter((s) =>
        s.name?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q)
      );
    }
    if (filter.status === 'has_debt') r = r.filter((s) => s.debt > 0);
    if (filter.status === 'no_debt')  r = r.filter((s) => s.debt <= 0);
    r.sort((a, b) => {
      const dir = filter.sortDir === 'desc' ? -1 : 1;
      if (filter.sortBy === 'name') return dir * a.name.localeCompare(b.name);
      if (filter.sortBy === 'debt') return dir * (a.debt - b.debt);
      return dir * (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) * -1;
    });
    return r;
  }, [rows, filter]);

  const openNew  = () => { setEditId(null); setForm(empty); setOpen(true); };
  const openEdit = (s: any) => { setEditId(s.id); setForm({ name: s.name, phone: s.phone||'', email: s.email||'', address: s.address||'' }); setOpen(true); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editId) await api.put(`/suppliers/${editId}`, form);
    else        await api.post('/suppliers', form);
    setOpen(false); setForm(empty); setEditId(null); load();
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

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Nhà cung cấp</h1>
        <button className="btn cyan" onClick={openNew}>+ Thêm mới</button>
      </div>

      {open && (
        <div className="form-panel mb-16">
          <form onSubmit={submit}>
            <div className="fg2" style={{ marginBottom: 10 }}>
              <div><label className="lbl">Tên *</label><input className="inp" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
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
        searchPlaceholder="Tìm tên, SĐT, email..."
        statusOptions={[
          { value: 'has_debt', label: 'Đang nợ' },
          { value: 'no_debt',  label: 'Không nợ' },
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
          <thead><tr><th>Tên NCC</th><th>Điện thoại</th><th>Email</th><th>Đang nợ</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr className="empty-row"><td colSpan={5}>{rows.length === 0 ? 'Chưa có nhà cung cấp' : 'Không tìm thấy kết quả'}</td></tr>}
            {filtered.map((s) => (
              <tr key={s.id}>
                <td className="c-bright fw7">{s.name}</td>
                <td>{s.phone || <span className="c-dim">—</span>}</td>
                <td>{s.email || <span className="c-dim">—</span>}</td>
                <td className={`fw7 ${s.debt > 0 ? 'c-red' : 'c-dim'}`}>{fmt(s.debt)}</td>
                <td><div className="td-act">
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
    </div>
  );
}
