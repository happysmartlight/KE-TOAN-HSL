import { toast } from '../components/Toast';
import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import FilterBar, { defaultFilter } from '../components/FilterBar';
import type { FilterState } from '../components/FilterBar';
import { useEscKey } from '../hooks/useKeyboard';
import DatePicker from '../components/DatePicker';
import HoloCard, { getUserRank } from '../components/HoloCard';
import type { HoloData } from '../components/HoloCard';
import { phoneError, emailError } from '../utils/validate';

const emptyForm = {
  username: '', password: '', name: '', role: 'staff',
  email: '', phone: '', startDate: '', employmentStatus: 'active',
};

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('vi-VN') : '—';

const fmtDateRange = (start: string, end?: string | null) => {
  const s = new Date(start).toLocaleDateString('vi-VN');
  const e = end ? new Date(end).toLocaleDateString('vi-VN') : 'nay';
  return `${s} → ${e}`;
};

const diffDays = (start: string, end?: string | null) => {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const days = Math.floor((e - s) / 86400000);
  if (days >= 365) return `${Math.floor(days / 365)}n ${Math.floor((days % 365) / 30)}th`;
  if (days >= 30)  return `${Math.floor(days / 30)} tháng`;
  return `${days} ngày`;
};

export default function Users() {
  const { user: me } = useAuth();
  const [rows, setRows]   = useState<any[]>([]);
  const [form, setForm]   = useState(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [prevStatus, setPrevStatus] = useState('active'); // status trước khi edit
  const [open, setOpen]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; username: string; name: string; role: string } | null>(null);

  // Resign modal
  const [resignModal, setResignModal] = useState<any>(null);
  const [resignDate, setResignDate] = useState('');
  const [resignNote, setResignNote] = useState('');

  // Reinstate modal
  const [reinstateModal, setReinstateModal] = useState<any>(null);
  const [reinstateDate, setReinstateDate] = useState('');
  const [reinstateNote, setReinstateNote] = useState('');

  // Employment history modal
  const [historyUser, setHistoryUser] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  const [filter, setFilter] = useState<FilterState>(defaultFilter);
  const [kpiMap, setKpiMap] = useState<Record<number, { totalRevenue: number; invoiceCount: number }>>({});
  const [cardData, setCardData] = useState<HoloData | null>(null);

  useEscKey(
    cardData       ? () => setCardData(null) :
    historyUser    ? () => setHistoryUser(null) :
    reinstateModal ? () => setReinstateModal(null) :
    resignModal    ? () => setResignModal(null) :
    open           ? () => setOpen(false) : null
  );

  const load = () => {
    api.get('/users').then((r) => setRows(r.data));
    api.get('/users/kpi').then((r) => setKpiMap(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (filter.search) {
      const q = filter.search.toLowerCase();
      r = r.filter((u) =>
        u.username?.toLowerCase().includes(q) ||
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      );
    }
    if (filter.status) r = r.filter((u) => u.role === filter.status);
    r.sort((a, b) => {
      const dir = filter.sortDir === 'desc' ? -1 : 1;
      if (filter.sortBy === 'name') return dir * a.name.localeCompare(b.name);
      return dir * (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) * -1;
    });
    return r;
  }, [rows, filter]);

  const openNew = () => { setEditId(null); setForm(emptyForm); setPrevStatus('active'); setOpen(true); };
  const openEdit = (u: any) => {
    setEditId(u.id);
    setPrevStatus(u.employmentStatus || 'active');
    setForm({
      username: u.username, password: '',
      name: u.name, role: u.role,
      email: u.email || '', phone: u.phone || '',
      startDate: u.startDate ? u.startDate.slice(0, 10) : '',
      employmentStatus: u.employmentStatus || 'active',
    });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      if (editId) {
        const data: any = { name: form.name, role: form.role, email: form.email, phone: form.phone };
        if (form.password) data.password = form.password;
        if (form.startDate) data.startDate = form.startDate;
        // Nếu chỉ thay đổi trạng thái → dùng dedicated endpoint
        if (form.employmentStatus === 'resigned' && prevStatus === 'active') {
          setOpen(false);
          setResignModal(rows.find((u) => u.id === editId));
          setResignDate(new Date().toISOString().slice(0, 10));
          await api.put(`/users/${editId}`, data); // lưu thông tin khác trước
          return;
        }
        await api.put(`/users/${editId}`, { ...data, employmentStatus: form.employmentStatus });
      } else {
        await api.post('/users', { ...form, startDate: form.startDate || undefined });
        // Tạo chu kỳ đầu tiên nếu có startDate
        if (form.startDate) {
          const newUser = (await api.get('/users')).data.find((u: any) => u.username === form.username);
          if (newUser) {
            await api.post(`/users/${newUser.id}/reinstate`, { startDate: form.startDate, note: 'Bắt đầu làm việc' }).catch(() => {});
          }
        }
      }
      setForm(emptyForm); setEditId(null); setOpen(false); load();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Lỗi'); }
  };

  // Resign action
  const doResign = async () => {
    if (!resignModal || !resignDate) return;
    try {
      await api.post(`/users/${resignModal.id}/resign`, { endDate: resignDate, note: resignNote || undefined });
      toast.success(`${resignModal.name} đã nghỉ việc từ ${fmtDate(resignDate)}`);
      setResignModal(null); setResignDate(''); setResignNote('');
      load();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Lỗi'); }
  };

  // Reinstate action
  const doReinstate = async () => {
    if (!reinstateModal || !reinstateDate) return;
    try {
      await api.post(`/users/${reinstateModal.id}/reinstate`, { startDate: reinstateDate, note: reinstateNote || undefined });
      toast.success(`${reinstateModal.name} đã được kích hoạt trở lại từ ${fmtDate(reinstateDate)}`);
      setReinstateModal(null); setReinstateDate(''); setReinstateNote('');
      load();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Lỗi'); }
  };

  // Load employment history
  const openHistory = async (u: any) => {
    setHistoryUser(u);
    const r = await api.get(`/users/${u.id}/employment-history`);
    setHistory(r.data);
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/users/${confirmDelete.id}`);
      setConfirmDelete(null); load();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Không thể xóa tài khoản'); }
  };

  const isResigned = (u: any) => u.employmentStatus === 'resigned';

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Nhân sự</h1>
        <button className="btn cyan" onClick={openNew}>+ Tạo tài khoản</button>
      </div>

      {open && (
        <div className="form-panel mb-16">
          <form onSubmit={submit}>
            <div className="fg2" style={{ marginBottom: 10 }}>
              <div>
                <label className="lbl">Tên đăng nhập {editId ? '(không đổi)' : '*'}</label>
                <input className="inp" required={!editId} disabled={!!editId} value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </div>
              <div>
                <label className="lbl">{editId ? 'Mật khẩu mới (để trống = giữ)' : 'Mật khẩu *'}</label>
                <input className="inp" type="password" required={!editId} value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div>
                <label className="lbl">Họ tên *</label>
                <input className="inp" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="lbl">Vai trò</label>
                <select className="inp" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="staff">Nhân viên</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="lbl">Email</label>
                <input className="inp" type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
                {emailError(form.email) && <span style={{ fontSize: 10, color: 'var(--red)' }}>{emailError(form.email)}</span>}
              </div>
              <div>
                <label className="lbl">Điện thoại</label>
                <input className="inp" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0901234567" />
                {phoneError(form.phone) && <span style={{ fontSize: 10, color: 'var(--red)' }}>{phoneError(form.phone)}</span>}
              </div>
              <div>
                <label className="lbl">Ngày vào làm</label>
                <DatePicker value={form.startDate}
                  onChange={(v) => setForm({ ...form, startDate: v })} />
              </div>
              {/* Trạng thái chỉ hiện khi đang edit và đang ở active → resigned */}
              {editId && (
                <div>
                  <label className="lbl">Trạng thái</label>
                  <select className="inp" value={form.employmentStatus}
                    onChange={(e) => setForm({ ...form, employmentStatus: e.target.value })}>
                    <option value="active">Đang làm</option>
                    <option value="resigned">Đã nghỉ</option>
                  </select>
                </div>
              )}
            </div>

            {/* Cảnh báo khi chuyển sang resigned */}
            {editId && form.employmentStatus === 'resigned' && prevStatus === 'active' && (
              <div style={{ marginBottom: 10, padding: '8px 12px', background: 'rgba(255,170,0,0.08)', border: '1px solid rgba(255,170,0,0.3)', borderRadius: 4, fontSize: 11, color: 'var(--yellow)' }}>
                ⚠ Chuyển sang "Đã nghỉ" sẽ mở form nhập Ngày nghỉ và đóng chu kỳ làm việc hiện tại.
              </div>
            )}

            <div className="form-actions">
              <button type="submit" className="btn cyan">{editId ? '[ Cập nhật ]' : '[ Tạo tài khoản ]'}</button>
              <button type="button" className="btn ghost" onClick={() => setOpen(false)}>[ Hủy ]</button>
            </div>
          </form>
        </div>
      )}

      <FilterBar
        value={filter} onChange={setFilter}
        totalCount={rows.length} resultCount={filtered.length}
        searchPlaceholder="Tìm username, họ tên, email..."
        statusOptions={[
          { value: 'admin', label: 'Admin' },
          { value: 'staff', label: 'Nhân viên' },
        ]}
        sortOptions={[
          { value: 'date_desc', label: '↓ Mới nhất' },
          { value: 'date_asc',  label: '↑ Cũ nhất' },
          { value: 'name_asc',  label: 'A→Z Họ tên' },
          { value: 'name_desc', label: 'Z→A Họ tên' },
        ]}
      />

      <div className="table-wrap">
        <table className="nt">
          <thead><tr>
            <th>Username</th>
            <th style={{ minWidth: 220, width: '22%' }}>Họ tên</th>
            <th>Vai trò</th>
            <th>Liên hệ</th><th>Ngày vào làm</th><th>Trạng thái</th><th></th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 && (
              <tr className="empty-row"><td colSpan={7}>{rows.length === 0 ? 'Chưa có tài khoản' : 'Không tìm thấy kết quả'}</td></tr>
            )}
            {filtered.map((u) => {
              const resigned = isResigned(u);
              const kpi = kpiMap[u.id];
              const rank = kpi ? getUserRank(kpi.totalRevenue) : null;
              return (
                <tr key={u.id} style={{
                  opacity: resigned ? 0.45 : 1,
                  filter: resigned ? 'grayscale(0.4)' : undefined,
                  background: rank ? `${rank.color}08` : u.id === me?.id ? 'rgba(0,255,136,0.03)' : undefined,
                }}>
                  <td className="c-cyan" style={rank ? { borderLeft: `2px solid ${rank.color}55` } : undefined}>
                    {u.username}
                    {u.id === me?.id && <span className="tag green" style={{ marginLeft: 8, fontSize: 9 }}>Bạn</span>}
                  </td>
                  <td style={{ fontWeight: 700, cursor: 'pointer' }}
                    onClick={() => setCardData({
                      type: 'user', id: u.id, name: u.name, createdAt: u.createdAt,
                      username: u.username, role: u.role,
                      email: u.email, phone: u.phone,
                      startDate: u.startDate, endDate: u.endDate,
                      employmentStatus: u.employmentStatus,
                      totalRevenue: kpi?.totalRevenue ?? 0,
                      invoiceCount: kpi?.invoiceCount ?? 0,
                    })}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {rank && <span title={rank.label} style={{ fontSize: 15, flexShrink: 0 }}>{rank.icon}</span>}
                      <div>
                        <div className="c-bright fw7" style={rank ? { color: rank.color } : undefined}>{u.name}</div>
                        {kpi && kpi.totalRevenue > 0 && (
                          <div style={{ fontSize: 10, color: rank ? rank.color : 'var(--text-dim)', marginTop: 2, fontWeight: 400 }}>
                            {(kpi.totalRevenue / 1_000_000).toFixed(1)}M ₫ · {kpi.invoiceCount} HĐ
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td><span className={`tag ${u.role === 'admin' ? 'purple' : 'cyan'}`}>{u.role === 'admin' ? 'Admin' : 'Staff'}</span></td>
                  <td>
                    {u.email && <div style={{ fontSize: 11 }}>{u.email}</div>}
                    {u.phone && <div className="c-dim" style={{ fontSize: 10 }}>{u.phone}</div>}
                    {!u.email && !u.phone && <span className="c-dim">—</span>}
                  </td>
                  <td className="c-dim" style={{ fontSize: 11 }}>
                    {u.startDate ? fmtDate(u.startDate) : '—'}
                    {u.endDate && <div style={{ color: 'var(--red)', fontSize: 10 }}>→ {fmtDate(u.endDate)}</div>}
                  </td>
                  <td>
                    <span className={`tag ${resigned ? 'red' : 'green'}`}>
                      {resigned ? 'Đã nghỉ' : 'Đang làm'}
                    </span>
                  </td>
                  <td><div className="td-act">
                    <button className="btn ghost btn-sm" onClick={() => openHistory(u)} title="Lịch sử nhân sự">📋</button>
                    {resigned ? (
                      <button className="btn green btn-sm" onClick={() => {
                        setReinstateModal(u);
                        setReinstateDate(new Date().toISOString().slice(0, 10));
                        setReinstateNote('');
                      }}>Khôi phục</button>
                    ) : (
                      <>
                        <button className="btn yellow btn-sm" onClick={() => openEdit(u)}>Sửa</button>
                        {u.id !== me?.id && !resigned && (
                          <button className="btn red btn-sm" onClick={() => {
                            setResignModal(u);
                            setResignDate(new Date().toISOString().slice(0, 10));
                            setResignNote('');
                          }}>Cho nghỉ</button>
                        )}
                      </>
                    )}
                    {u.id !== me?.id && (
                      <button className="btn ghost btn-sm" style={{ color: 'var(--red)', opacity: 0.6 }}
                        onClick={() => setConfirmDelete({ id: u.id, username: u.username, name: u.name, role: u.role })}>
                        Xóa
                      </button>
                    )}
                  </div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Modal: Cho nghỉ việc ── */}
      {resignModal && (
        <div className="modal-bg" onClick={() => setResignModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-title" style={{ color: 'var(--red)' }}>
              ◈ Cho nghỉ việc — {resignModal.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 14 }}>
              Thao tác này sẽ đóng chu kỳ làm việc hiện tại và ghi vào lịch sử nhân sự.
            </div>
            <label className="lbl">Ngày nghỉ *</label>
            <DatePicker value={resignDate} onChange={setResignDate} style={{ marginBottom: 10 }} />
            <label className="lbl">Ghi chú (tuỳ chọn)</label>
            <input className="inp" value={resignNote} placeholder="Lý do nghỉ, ghi chú..."
              onChange={(e) => setResignNote(e.target.value)} style={{ marginBottom: 14 }} />
            <div className="form-actions">
              <button className="btn red" onClick={doResign} disabled={!resignDate}>[ Xác nhận nghỉ ]</button>
              <button className="btn ghost" onClick={() => setResignModal(null)}>[ Hủy ]</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Khôi phục việc làm ── */}
      {reinstateModal && (
        <div className="modal-bg" onClick={() => setReinstateModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-title" style={{ color: 'var(--green)' }}>
              ◈ Khôi phục việc làm — {reinstateModal.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 14 }}>
              Bắt đầu chu kỳ làm việc mới. Lịch sử chu kỳ cũ vẫn được giữ nguyên.
            </div>
            <label className="lbl">Ngày bắt đầu lại *</label>
            <DatePicker value={reinstateDate} onChange={setReinstateDate} style={{ marginBottom: 10 }} />
            <label className="lbl">Ghi chú (tuỳ chọn)</label>
            <input className="inp" value={reinstateNote} placeholder="Lý do quay lại, ghi chú..."
              onChange={(e) => setReinstateNote(e.target.value)} style={{ marginBottom: 14 }} />
            <div className="form-actions">
              <button className="btn green" onClick={doReinstate} disabled={!reinstateDate}>[ Kích hoạt ]</button>
              <button className="btn ghost" onClick={() => setReinstateModal(null)}>[ Hủy ]</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Lịch sử nhân sự ── */}
      {historyUser && (
        <div className="modal-bg" onClick={() => setHistoryUser(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-title">📋 Lịch sử nhân sự — {historyUser.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 16 }}>
              <span className="c-dim">Username: </span><span className="c-cyan">{historyUser.username}</span>
              {' · '}
              <span className={`tag ${historyUser.employmentStatus === 'active' ? 'green' : 'red'}`} style={{ fontSize: 9 }}>
                {historyUser.employmentStatus === 'active' ? 'Đang làm' : 'Đã nghỉ'}
              </span>
            </div>

            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-dim)', fontSize: 12 }}>
                Chưa có lịch sử chu kỳ làm việc.
                {historyUser.startDate && (
                  <div style={{ marginTop: 8, fontSize: 11 }}>
                    (Ngày vào làm: {fmtDate(historyUser.startDate)} — chưa có record chu kỳ)
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {history.map((c, idx) => (
                  <div key={c.id} style={{
                    padding: '12px 14px', borderRadius: 4,
                    background: c.endDate ? 'rgba(255,255,255,0.03)' : 'rgba(0,245,255,0.04)',
                    border: c.endDate ? '1px solid var(--border-dim)' : '1px solid rgba(0,245,255,0.2)',
                    position: 'relative',
                  }}>
                    {/* Cycle badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 2,
                          background: c.endDate ? 'rgba(100,100,140,0.3)' : 'rgba(0,245,255,0.15)',
                          color: c.endDate ? 'var(--text-dim)' : 'var(--cyan)',
                          letterSpacing: 1, textTransform: 'uppercase',
                        }}>
                          Chu kỳ {c.cycleNo}
                        </span>
                        {!c.endDate && (
                          <span style={{ fontSize: 9, color: 'var(--green)', letterSpacing: 1 }}>● ĐANG LÀM</span>
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                        {diffDays(c.startDate, c.endDate)}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, marginBottom: c.note ? 6 : 0 }}>
                      <span className="c-dim">Từ </span>
                      <span className="c-bright">{fmtDateRange(c.startDate, c.endDate)}</span>
                    </div>
                    {c.note && (
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic', marginTop: 4 }}>
                        💬 {c.note}
                      </div>
                    )}

                    {/* Timeline connector */}
                    {idx < history.length - 1 && (
                      <div style={{
                        position: 'absolute', left: 22, bottom: -9, width: 1, height: 8,
                        background: 'var(--border-dim)',
                      }} />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 16 }} className="form-actions">
              <button className="btn ghost" onClick={() => setHistoryUser(null)}>[ Đóng ]</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title={`Xóa tài khoản "${confirmDelete.username}"`}
          message={`Tài khoản của ${confirmDelete.name} sẽ bị xóa vĩnh viễn khỏi hệ thống.`}
          warning={confirmDelete.role === 'admin' ? 'Đây là tài khoản Admin — hệ thống sẽ từ chối nếu đây là admin cuối cùng.' : undefined}
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
