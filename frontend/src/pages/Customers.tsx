import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import RequestDeleteModal from '../components/RequestDeleteModal';
import FilterBar, { defaultFilter } from '../components/FilterBar';
import type { FilterState } from '../components/FilterBar';

const fmt = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

const emptyForm = {
  name: '', phone: '', email: '', address: '',
  companyName: '', taxCode: '',
};

export default function Customers() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: number; name: string } | null>(null);

  // MST lookup state
  const [taxLoading, setTaxLoading] = useState(false);
  const [taxResult, setTaxResult] = useState<{ name: string; address: string; status: string } | null>(null);
  const [taxError, setTaxError] = useState('');
  const taxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [filter, setFilter] = useState<FilterState>(defaultFilter);

  const load = () => api.get('/customers').then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (filter.search) {
      const q = filter.search.toLowerCase();
      r = r.filter((c) =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.companyName?.toLowerCase().includes(q) ||
        c.taxCode?.toLowerCase().includes(q)
      );
    }
    if (filter.status === 'has_debt') r = r.filter((c) => c.debt > 0);
    if (filter.status === 'no_debt')  r = r.filter((c) => c.debt <= 0);
    r.sort((a, b) => {
      const dir = filter.sortDir === 'desc' ? -1 : 1;
      if (filter.sortBy === 'name')      return dir * a.name.localeCompare(b.name);
      if (filter.sortBy === 'purchased') return dir * (a.totalPurchased - b.totalPurchased);
      if (filter.sortBy === 'debt')      return dir * (a.debt - b.debt);
      return dir * (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) * -1;
    });
    return r;
  }, [rows, filter]);

  const openNew = () => {
    setEditId(null); setForm(emptyForm); setTaxResult(null); setTaxError(''); setOpen(true);
  };
  const openEdit = (c: any) => {
    setEditId(c.id);
    setForm({
      name: c.name, phone: c.phone || '', email: c.email || '',
      address: c.address || '', companyName: c.companyName || '', taxCode: c.taxCode || '',
    });
    setTaxResult(null); setTaxError('');
    setOpen(true);
  };

  // Auto-lookup khi taxCode đủ 10+ ký tự
  const handleTaxCodeChange = (val: string) => {
    setForm((f) => ({ ...f, taxCode: val }));
    setTaxResult(null); setTaxError('');
    if (taxTimerRef.current) clearTimeout(taxTimerRef.current);
    if (val.trim().length >= 10) {
      taxTimerRef.current = setTimeout(() => lookupTax(val.trim()), 800);
    }
  };

  const lookupTax = async (code: string) => {
    setTaxLoading(true); setTaxError('');
    try {
      const { data } = await api.get(`/customers/tax-lookup/${code}`);
      setTaxResult(data);
      // Auto-fill nếu chưa nhập
      setForm((f) => ({
        ...f,
        companyName: f.companyName || data.name || '',
        address: f.address || data.address || '',
      }));
    } catch (err: any) {
      setTaxError(err.response?.data?.error || 'Không tìm thấy MST');
    } finally {
      setTaxLoading(false);
    }
  };

  const applyTaxFill = () => {
    if (!taxResult) return;
    setForm((f) => ({
      ...f,
      companyName: taxResult.name || f.companyName,
      address: taxResult.address || f.address,
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editId) await api.put(`/customers/${editId}`, form);
    else        await api.post('/customers', form);
    setOpen(false); setForm(emptyForm); setEditId(null); setTaxResult(null); load();
  };

  const handleDelete = async (id: number, name: string) => {
    if (isAdmin) {
      if (!confirm(`Xóa khách hàng "${name}"?`)) return;
      try { await api.delete(`/customers/${id}`); load(); }
      catch (err: any) { alert(err.response?.data?.error || 'Không thể xóa'); }
    } else {
      setDeleteModal({ id, name });
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Khách hàng</h1>
        <button className="btn cyan" onClick={openNew}>+ Thêm mới</button>
      </div>

      {open && (
        <div className="form-panel mb-16">
          <form onSubmit={submit}>
            {/* Hàng 1: Tên + SĐT */}
            <div className="fg2" style={{ marginBottom: 10 }}>
              <div>
                <label className="lbl">Tên khách hàng *</label>
                <input className="inp" required value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nguyễn Văn A" />
              </div>
              <div>
                <label className="lbl">Số điện thoại</label>
                <input className="inp" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0901..." />
              </div>
            </div>

            {/* Hàng 2: MST + Tên công ty */}
            <div className="fg2" style={{ marginBottom: 6 }}>
              <div>
                <label className="lbl">Mã số thuế (MST)</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input className="inp" value={form.taxCode}
                    onChange={(e) => handleTaxCodeChange(e.target.value)}
                    placeholder="0123456789" style={{ flex: 1 }} />
                  <button type="button" className="btn ghost btn-sm"
                    disabled={taxLoading || form.taxCode.trim().length < 10}
                    onClick={() => lookupTax(form.taxCode.trim())}
                    style={{ whiteSpace: 'nowrap' }}>
                    {taxLoading ? '⏳' : '🔍 Tra cứu'}
                  </button>
                </div>
              </div>
              <div>
                <label className="lbl">Tên công ty</label>
                <input className="inp" value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  placeholder="Công ty TNHH..." />
              </div>
            </div>

            {/* Kết quả tra cứu MST */}
            {taxError && (
              <div style={{ marginBottom: 10, padding: '8px 12px', background: 'var(--red-dim)', borderRadius: 4, border: '1px solid rgba(255,0,85,0.25)', fontSize: 11, color: 'var(--red)' }}>
                ✗ {taxError}
              </div>
            )}
            {taxResult && (
              <div style={{ marginBottom: 10, padding: '10px 12px', background: 'rgba(0,200,140,0.06)', borderRadius: 4, border: '1px solid rgba(0,200,140,0.25)', fontSize: 11 }}>
                <div style={{ fontWeight: 700, color: 'var(--cyan)', marginBottom: 4 }}>✓ Tìm thấy doanh nghiệp</div>
                <div><span className="c-dim">Tên: </span><span className="c-bright">{taxResult.name}</span></div>
                {taxResult.address && <div><span className="c-dim">Địa chỉ: </span>{taxResult.address}</div>}
                {taxResult.status && <div><span className="c-dim">Trạng thái: </span><span style={{ color: 'var(--green)' }}>{taxResult.status}</span></div>}
                <button type="button" className="btn cyan btn-sm" style={{ marginTop: 6 }} onClick={applyTaxFill}>
                  ↓ Điền vào form
                </button>
              </div>
            )}

            {/* Hàng 3: Email + Địa chỉ */}
            <div className="fg2" style={{ marginBottom: 10 }}>
              <div>
                <label className="lbl">Email</label>
                <input className="inp" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@..." />
              </div>
              <div>
                <label className="lbl">Địa chỉ</label>
                <input className="inp" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Địa chỉ" />
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
        searchPlaceholder="Tìm tên, SĐT, MST, tên công ty..."
        statusOptions={[
          { value: 'has_debt', label: 'Đang nợ' },
          { value: 'no_debt',  label: 'Không nợ' },
        ]}
        sortOptions={[
          { value: 'date_desc',      label: '↓ Mới nhất' },
          { value: 'date_asc',       label: '↑ Cũ nhất' },
          { value: 'name_asc',       label: 'A→Z Tên' },
          { value: 'name_desc',      label: 'Z→A Tên' },
          { value: 'purchased_desc', label: '↓ Mua nhiều nhất' },
          { value: 'debt_desc',      label: '↓ Nợ nhiều nhất' },
        ]}
      />

      <div className="table-wrap">
        <table className="nt">
          <thead><tr>
            <th>Tên khách hàng</th><th>Công ty / MST</th><th>Điện thoại</th><th>Tổng mua</th><th>Công nợ</th><th></th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 && <tr className="empty-row"><td colSpan={6}>{rows.length === 0 ? 'Chưa có khách hàng' : 'Không tìm thấy kết quả'}</td></tr>}
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>
                  <div className="c-bright fw7">{c.name}</div>
                  {c.email && <div className="c-dim" style={{ fontSize: 10 }}>{c.email}</div>}
                </td>
                <td>
                  {c.companyName && <div style={{ fontSize: 11 }}>{c.companyName}</div>}
                  {c.taxCode && <div className="c-dim" style={{ fontSize: 10 }}>MST: {c.taxCode}</div>}
                  {!c.companyName && !c.taxCode && <span className="c-dim">—</span>}
                </td>
                <td>{c.phone || <span className="c-dim">—</span>}</td>
                <td>
                  {c.invoiceCount > 0 ? (
                    <>
                      <div className="fw7 c-cyan">{fmt(c.totalPurchased)}</div>
                      <div className="c-dim" style={{ fontSize: 10 }}>{c.invoiceCount} hóa đơn</div>
                    </>
                  ) : <span className="c-dim">—</span>}
                </td>
                <td className={`fw7 ${c.debt > 0 ? 'c-red' : 'c-green'}`}>{fmt(c.debt)}</td>
                <td><div className="td-act">
                  <button className="btn yellow btn-sm" onClick={() => openEdit(c)}>Sửa</button>
                  <button className={`btn ${isAdmin ? 'red' : 'ghost'} btn-sm`} onClick={() => handleDelete(c.id, c.name)}>
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
          modelName="Customer"
          recordId={deleteModal.id}
          recordLabel={deleteModal.name}
          onClose={() => setDeleteModal(null)}
        />
      )}
    </div>
  );
}
