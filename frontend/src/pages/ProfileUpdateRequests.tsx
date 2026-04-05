import { useEffect, useState } from 'react';
import api from '../api';
import { toast } from '../components/Toast';

interface UpdateRequest {
  id: number;
  userId: number;
  user: { id: number; name: string; username: string };
  requestedData: string;
  reason: string | null;
  status: string;
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Đang chờ',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};
const STATUS_COLOR: Record<string, string> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
};

const FIELD_LABEL: Record<string, string> = {
  name: 'Họ tên',
  email: 'Email',
  phone: 'Điện thoại',
};

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

export default function ProfileUpdateRequests() {
  const [rows, setRows] = useState<UpdateRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [processing, setProcessing] = useState<number | null>(null);

  const load = async () => {
    try {
      const r = await api.get('/profile-update-requests');
      setRows(r.data);
    } catch {
      toast.error('Không thể tải danh sách');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => filterStatus === 'all' || r.status === filterStatus);

  const handleApprove = async (id: number) => {
    setProcessing(id);
    try {
      await api.patch(`/profile-update-requests/${id}/approve`);
      toast.success('Đã duyệt và cập nhật hồ sơ');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Lỗi khi duyệt');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: number) => {
    if (!rejectNote.trim()) {
      toast.warn('Vui lòng nhập ghi chú từ chối');
      return;
    }
    setProcessing(id);
    try {
      await api.patch(`/profile-update-requests/${id}/reject`, { adminNote: rejectNote });
      toast.success('Đã từ chối yêu cầu');
      setRejectId(null);
      setRejectNote('');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Lỗi khi từ chối');
    } finally {
      setProcessing(null);
    }
  };

  const fmtDateTime = (d: string | null) => d ? new Date(d).toLocaleString('vi-VN') : '—';

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Yêu cầu cập nhật hồ sơ</h1>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['pending', 'all', 'approved', 'rejected'] as FilterStatus[]).map((s) => {
          const labels: Record<FilterStatus, string> = {
            pending: 'Đang chờ',
            all: 'Tất cả',
            approved: 'Đã duyệt',
            rejected: 'Từ chối',
          };
          const count = s === 'all' ? rows.length : rows.filter((r) => r.status === s).length;
          return (
            <button
              key={s}
              className={`btn ${filterStatus === s ? (s === 'pending' ? 'yellow' : s === 'approved' ? 'green' : s === 'rejected' ? 'red' : 'cyan') : 'ghost'} btn-sm`}
              onClick={() => setFilterStatus(s)}
            >
              {labels[s]} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="c-dim" style={{ fontFamily: 'monospace', fontSize: 13 }}>Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-dim)', padding: '20px 0' }}>
          Không có yêu cầu nào.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map((r) => {
            let data: Record<string, string> = {};
            try { data = JSON.parse(r.requestedData); } catch {}

            return (
              <div key={r.id} className="form-panel" style={{ padding: '14px 18px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <span className="c-cyan" style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>
                      {r.user.name}
                    </span>
                    <span className="c-dim" style={{ fontSize: 11, marginLeft: 8 }}>@{r.user.username}</span>
                    <span className="c-dim" style={{ fontSize: 10, marginLeft: 12 }}>#{r.id} — {fmtDateTime(r.createdAt)}</span>
                  </div>
                  <span className={`tag ${STATUS_COLOR[r.status] || 'cyan'}`}>
                    {STATUS_LABEL[r.status] || r.status}
                  </span>
                </div>

                {/* Requested changes */}
                <div style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
                  {Object.entries(data).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', gap: 12, alignItems: 'baseline', fontSize: 12 }}>
                      <span style={{ color: 'var(--text-dim)', width: 100, flexShrink: 0 }}>
                        {FIELD_LABEL[k] || k}:
                      </span>
                      <span style={{ color: 'var(--text-bright)', fontFamily: 'monospace' }}>
                        {v || <span style={{ color: 'var(--text-dim)' }}>xóa trắng</span>}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Reason */}
                {r.reason && (
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10, paddingLeft: 8, borderLeft: '2px solid rgba(0,245,255,0.2)' }}>
                    Lý do: {r.reason}
                  </div>
                )}

                {/* Admin note (for rejected) */}
                {r.adminNote && (
                  <div style={{ fontSize: 11, color: 'var(--yellow)', marginBottom: 10, padding: '6px 10px', background: 'rgba(255,204,0,0.06)', borderRadius: 4, border: '1px solid rgba(255,204,0,0.2)' }}>
                    Ghi chú Admin: {r.adminNote}
                  </div>
                )}

                {r.reviewedAt && (
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 10 }}>
                    Xử lý lúc: {fmtDateTime(r.reviewedAt)}
                  </div>
                )}

                {/* Actions (only for pending) */}
                {r.status === 'pending' && (
                  <div>
                    {rejectId === r.id ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <label className="lbl">Ghi chú từ chối *</label>
                          <input
                            className="inp"
                            autoFocus
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            placeholder="Lý do từ chối..."
                            onKeyDown={(e) => e.key === 'Escape' && (setRejectId(null), setRejectNote(''))}
                          />
                        </div>
                        <button
                          className="btn red btn-sm"
                          disabled={processing === r.id}
                          onClick={() => handleReject(r.id)}
                        >
                          {processing === r.id ? 'Đang xử lý...' : 'Xác nhận từ chối'}
                        </button>
                        <button
                          className="btn ghost btn-sm"
                          onClick={() => { setRejectId(null); setRejectNote(''); }}
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <div className="td-act">
                        <button
                          className="btn green btn-sm"
                          disabled={processing === r.id}
                          onClick={() => handleApprove(r.id)}
                        >
                          {processing === r.id ? '...' : 'Duyệt'}
                        </button>
                        <button
                          className="btn red btn-sm"
                          onClick={() => { setRejectId(r.id); setRejectNote(''); }}
                        >
                          Từ chối
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
