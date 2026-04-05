import { useEffect, useState } from 'react';
import api from '../api';
import { toast } from '../components/Toast';

// ── Shared types & helpers ────────────────────────────────────────────────────
type FilterStatus = 'pending' | 'all' | 'approved' | 'rejected';

const STATUS_TAG:   Record<string, string> = { pending: 'yellow', approved: 'green', rejected: 'red' };
const STATUS_LABEL: Record<string, string> = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' };
const MODEL_LABEL:  Record<string, string> = {
  Customer: '👥 Khách hàng', Supplier: '🏭 Nhà cung cấp', Product: '📦 Sản phẩm',
};
const FIELD_LABEL: Record<string, string> = {
  name: 'Họ tên', email: 'Email', phone: 'Điện thoại', address: 'Địa chỉ',
};

const fmtDate     = (d: string)       => new Date(d).toLocaleDateString('vi-VN');
const fmtDateTime = (d: string|null)  => d ? new Date(d).toLocaleString('vi-VN') : '—';

// ── Shared filter bar ─────────────────────────────────────────────────────────
function FilterBar({
  rows, filter, onChange,
}: {
  rows: any[];
  filter: FilterStatus;
  onChange: (f: FilterStatus) => void;
}) {
  const count = (f: FilterStatus) =>
    f === 'all' ? rows.length : rows.filter((r) => r.status === f).length;

  const TABS: { key: FilterStatus; label: string }[] = [
    { key: 'pending',  label: '⏳ Chờ duyệt' },
    { key: 'all',      label: 'Tất cả' },
    { key: 'approved', label: '✅ Đã duyệt' },
    { key: 'rejected', label: '❌ Từ chối' },
  ];

  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
      {TABS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`btn ${filter === key ? 'cyan' : 'ghost'} btn-sm`}
        >
          {label}
          <span style={{ marginLeft: 5, opacity: 0.65, fontSize: 11 }}>({count(key)})</span>
        </button>
      ))}
    </div>
  );
}

// ── Tab 1: Yêu cầu xóa ───────────────────────────────────────────────────────
function DeleteTab() {
  const [rows, setRows]     = useState<any[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('pending');

  const load = () => api.get('/delete-requests').then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const review = async (id: number, action: 'approved' | 'rejected') => {
    try {
      await api.patch(`/delete-requests/${id}`, { action });
      load();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Lỗi'); }
  };

  const filtered = rows.filter((r) => filter === 'all' || r.status === filter);

  return (
    <div>
      <FilterBar rows={rows} filter={filter} onChange={setFilter} />

      <div className="table-wrap">
        <table className="nt">
          <thead><tr>
            <th>Loại</th>
            <th>Bản ghi</th>
            <th>Người yêu cầu</th>
            <th>Lý do</th>
            <th>Trạng thái</th>
            <th>Ngày gửi</th>
            <th></th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 && (
              <tr className="empty-row"><td colSpan={7}>Không có yêu cầu nào</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td style={{ fontSize: 11 }}>{MODEL_LABEL[r.modelName] || r.modelName}</td>
                <td className="c-bright fw7" style={{ fontSize: 12 }}>{r.recordLabel}</td>
                <td style={{ fontSize: 12 }}>
                  <div className="c-cyan">{r.requester?.name}</div>
                  <div className="c-dim" style={{ fontSize: 10 }}>@{r.requester?.username}</div>
                </td>
                <td style={{ maxWidth: 180, wordBreak: 'break-word', fontSize: 11, color: 'var(--text-dim)' }}>
                  {r.reason || <span className="c-dim">—</span>}
                </td>
                <td><span className={`tag ${STATUS_TAG[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
                <td className="c-dim" style={{ fontSize: 11 }}>{fmtDate(r.createdAt)}</td>
                <td>
                  {r.status === 'pending' ? (
                    <div className="td-act">
                      <button className="btn green btn-sm" onClick={() => review(r.id, 'approved')}>✓ Duyệt</button>
                      <button className="btn red btn-sm"   onClick={() => review(r.id, 'rejected')}>✗ Từ chối</button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                      <div>{r.reviewer?.name}</div>
                      <div>{r.reviewedAt ? fmtDate(r.reviewedAt) : ''}</div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab 2: Cập nhật hồ sơ ────────────────────────────────────────────────────
function ProfileTab() {
  const [rows, setRows]             = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<FilterStatus>('pending');
  const [rejectId, setRejectId]     = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [processing, setProcessing] = useState<number | null>(null);

  const load = async () => {
    try { const r = await api.get('/profile-update-requests'); setRows(r.data); }
    catch { toast.error('Không thể tải danh sách'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => filter === 'all' || r.status === filter);

  const handleApprove = async (id: number) => {
    setProcessing(id);
    try { await api.patch(`/profile-update-requests/${id}/approve`); toast.success('Đã duyệt'); load(); }
    catch (err: any) { toast.error(err?.response?.data?.error || 'Lỗi'); }
    finally { setProcessing(null); }
  };

  const handleReject = async (id: number) => {
    if (!rejectNote.trim()) { toast.error('Vui lòng nhập ghi chú'); return; }
    setProcessing(id);
    try {
      await api.patch(`/profile-update-requests/${id}/reject`, { adminNote: rejectNote });
      toast.success('Đã từ chối'); setRejectId(null); setRejectNote(''); load();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Lỗi'); }
    finally { setProcessing(null); }
  };

  const openReject = (id: number) => { setRejectId(id); setRejectNote(''); };
  const closeReject = () => { setRejectId(null); setRejectNote(''); };

  return (
    <div>
      <FilterBar rows={rows} filter={filter} onChange={setFilter} />

      <div className="table-wrap">
        <table className="nt">
          <thead><tr>
            <th>Người dùng</th>
            <th>Thay đổi yêu cầu</th>
            <th>Lý do</th>
            <th>Trạng thái</th>
            <th>Ngày gửi</th>
            <th></th>
          </tr></thead>
          <tbody>
            {loading && (
              <tr className="empty-row"><td colSpan={6}>Đang tải...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr className="empty-row"><td colSpan={6}>Không có yêu cầu nào</td></tr>
            )}
            {!loading && filtered.map((r) => {
              let data: Record<string, string> = {};
              try { data = JSON.parse(r.requestedData); } catch {}

              return (
                <>
                  <tr key={r.id}>
                    {/* Người dùng */}
                    <td style={{ fontSize: 12 }}>
                      <div className="c-cyan fw7">{r.user?.name}</div>
                      <div className="c-dim" style={{ fontSize: 10 }}>@{r.user?.username}</div>
                      <div className="c-dim" style={{ fontSize: 10 }}>#{r.id}</div>
                    </td>

                    {/* Thay đổi */}
                    <td style={{ fontSize: 11 }}>
                      {Object.entries(data).map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', gap: 6, marginBottom: 3, alignItems: 'baseline' }}>
                          <span style={{ color: 'var(--text-dim)', flexShrink: 0, width: 72 }}>
                            {FIELD_LABEL[k] || k}:
                          </span>
                          <span style={{ color: v ? 'var(--text-bright)' : 'var(--text-dim)', fontStyle: v ? 'normal' : 'italic' }}>
                            {v || 'xóa trắng'}
                          </span>
                        </div>
                      ))}
                    </td>

                    {/* Lý do */}
                    <td style={{ fontSize: 11, color: 'var(--text-dim)', maxWidth: 160, wordBreak: 'break-word' }}>
                      {r.reason || <span>—</span>}
                      {r.adminNote && (
                        <div style={{
                          marginTop: 4, padding: '4px 8px',
                          background: 'rgba(255,204,0,0.06)',
                          border: '1px solid rgba(255,204,0,0.2)',
                          borderRadius: 3, fontSize: 10,
                          color: 'var(--yellow)',
                        }}>
                          Admin: {r.adminNote}
                        </div>
                      )}
                    </td>

                    {/* Trạng thái */}
                    <td><span className={`tag ${STATUS_TAG[r.status] || 'cyan'}`}>{STATUS_LABEL[r.status] || r.status}</span></td>

                    {/* Ngày */}
                    <td style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      <div>{fmtDate(r.createdAt)}</div>
                      {r.status !== 'pending' && r.reviewedAt && (
                        <div style={{ fontSize: 10 }}>{fmtDateTime(r.reviewedAt)}</div>
                      )}
                      {r.status !== 'pending' && r.reviewer && (
                        <div style={{ fontSize: 10, color: 'var(--cyan)' }}>{r.reviewer.name}</div>
                      )}
                    </td>

                    {/* Hành động */}
                    <td>
                      {r.status === 'pending' && rejectId !== r.id && (
                        <div className="td-act">
                          <button className="btn green btn-sm"
                            disabled={processing === r.id}
                            onClick={() => handleApprove(r.id)}>
                            {processing === r.id ? '...' : '✓ Duyệt'}
                          </button>
                          <button className="btn red btn-sm" onClick={() => openReject(r.id)}>
                            ✗ Từ chối
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* Sub-row: reject note input */}
                  {rejectId === r.id && (
                    <tr key={`reject-${r.id}`} style={{ background: 'rgba(255,0,85,0.04)' }}>
                      <td colSpan={6} style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: 'var(--red)', flexShrink: 0 }}>Ghi chú từ chối *</span>
                          <input
                            autoFocus
                            className="inp"
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            placeholder="Lý do từ chối..."
                            onKeyDown={(e) => { if (e.key === 'Escape') closeReject(); if (e.key === 'Enter') handleReject(r.id); }}
                            style={{ flex: 1, minWidth: 200 }}
                          />
                          <button className="btn red btn-sm"
                            disabled={processing === r.id}
                            onClick={() => handleReject(r.id)}>
                            {processing === r.id ? '...' : 'Xác nhận từ chối'}
                          </button>
                          <button className="btn ghost btn-sm" onClick={closeReject}>Hủy</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Requests() {
  const [tab, setTab] = useState<'delete' | 'profile'>('delete');
  const [deletePending, setDeletePending]   = useState(0);
  const [profilePending, setProfilePending] = useState(0);

  useEffect(() => {
    api.get('/delete-requests/count').then((r) => setDeletePending(r.data.count)).catch(() => {});
    api.get('/profile-update-requests/count').then((r) => setProfilePending(r.data.count)).catch(() => {});
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Quản lý yêu cầu</h1>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        <button onClick={() => setTab('delete')}
          className={`btn ${tab === 'delete' ? 'cyan' : 'ghost'}`}
          style={{ borderRadius: '4px 0 0 4px' }}>
          🗑️ Yêu cầu xóa
          {deletePending > 0 && <span className="nav-badge" style={{ marginLeft: 6 }}>{deletePending}</span>}
        </button>
        <button onClick={() => setTab('profile')}
          className={`btn ${tab === 'profile' ? 'cyan' : 'ghost'}`}
          style={{ borderRadius: '0 4px 4px 0' }}>
          📝 Cập nhật hồ sơ
          {profilePending > 0 && <span className="nav-badge" style={{ marginLeft: 6 }}>{profilePending}</span>}
        </button>
      </div>

      {tab === 'delete'  && <DeleteTab />}
      {tab === 'profile' && <ProfileTab />}
    </div>
  );
}
