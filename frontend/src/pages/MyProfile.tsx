import { useEffect, useState } from 'react';
import api from '../api';
import { toast } from '../components/Toast';

interface ProfileData {
  id: number;
  username: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  startDate: string | null;
  employmentStatus: string;
  createdAt: string;
}

interface DeleteRequest {
  id: number;
  modelName: string;
  recordId: number;
  recordLabel: string;
  reason: string;
  status: string;
  reviewedAt: string | null;
  reviewer: { id: number; name: string } | null;
  createdAt: string;
}

interface UpdateRequest {
  id: number;
  requestedData: string;
  reason: string | null;
  status: string;
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface Props {
  initialTab?: 'profile' | 'delete-requests';
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

export default function MyProfile({ initialTab = 'profile' }: Props) {
  const [tab, setTab] = useState<'profile' | 'update-request' | 'my-requests' | 'delete-requests'>(initialTab === 'delete-requests' ? 'delete-requests' : 'profile');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [deleteRequests, setDeleteRequests] = useState<DeleteRequest[]>([]);
  const [updateRequests, setUpdateRequests] = useState<UpdateRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Password change form
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwLoading, setPwLoading] = useState(false);

  // Profile update request form
  const [purForm, setPurForm] = useState({ name: '', email: '', phone: '', reason: '' });
  const [purLoading, setPurLoading] = useState(false);

  const loadProfile = async () => {
    try {
      const r = await api.get('/users/me');
      setProfile(r.data);
      setPurForm({ name: r.data.name || '', email: r.data.email || '', phone: r.data.phone || '', reason: '' });
    } catch {
      toast.error('Không thể tải hồ sơ');
    } finally {
      setLoading(false);
    }
  };

  const loadDeleteRequests = async () => {
    try {
      const r = await api.get('/delete-requests/mine');
      setDeleteRequests(r.data);
    } catch {
      toast.error('Không thể tải yêu cầu xóa');
    }
  };

  const loadUpdateRequests = async () => {
    try {
      const r = await api.get('/profile-update-requests/mine');
      setUpdateRequests(r.data);
    } catch {
      toast.error('Không thể tải yêu cầu cập nhật');
    }
  };

  useEffect(() => {
    loadProfile();
    loadDeleteRequests();
    loadUpdateRequests();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    if (pwForm.newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    setPwLoading(true);
    try {
      await api.put('/users/me/password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      toast.success('Đổi mật khẩu thành công');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Đổi mật khẩu thất bại');
    } finally {
      setPwLoading(false);
    }
  };

  const handleSubmitUpdateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const requestedData: any = {};
    if (purForm.name.trim() && purForm.name !== profile?.name) requestedData.name = purForm.name.trim();
    if (purForm.email !== (profile?.email || '')) requestedData.email = purForm.email.trim();
    if (purForm.phone !== (profile?.phone || '')) requestedData.phone = purForm.phone.trim();
    if (Object.keys(requestedData).length === 0) {
      toast.warn('Không có thay đổi nào để gửi');
      return;
    }
    setPurLoading(true);
    try {
      await api.post('/profile-update-requests', { requestedData, reason: purForm.reason });
      toast.success('Đã gửi yêu cầu cập nhật hồ sơ');
      setPurForm((p) => ({ ...p, reason: '' }));
      loadUpdateRequests();
      setTab('my-requests');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Gửi yêu cầu thất bại');
    } finally {
      setPurLoading(false);
    }
  };

  if (loading) return <div className="c-dim" style={{ padding: 24, fontFamily: 'monospace', fontSize: 13 }}>Đang tải...</div>;
  if (!profile) return null;

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';
  const fmtDateTime = (d: string | null) => d ? new Date(d).toLocaleString('vi-VN') : '—';

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Hồ sơ của tôi</h1>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {(['profile', 'update-request', 'my-requests', 'delete-requests'] as const).map((t) => {
          const labels: Record<string, string> = {
            'profile': 'Thông tin',
            'update-request': 'Yêu cầu cập nhật',
            'my-requests': `Lịch sử yêu cầu${updateRequests.length > 0 ? ` (${updateRequests.length})` : ''}`,
            'delete-requests': `Yêu cầu xóa${deleteRequests.length > 0 ? ` (${deleteRequests.length})` : ''}`,
          };
          return (
            <button
              key={t}
              className={`btn ${tab === t ? 'cyan' : 'ghost'} btn-sm`}
              onClick={() => setTab(t)}
            >
              {labels[t]}
            </button>
          );
        })}
      </div>

      {/* Tab: Profile info */}
      {tab === 'profile' && (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {/* Profile card */}
          <div className="form-panel" style={{ flex: '1 1 300px', minWidth: 280 }}>
            <div style={{ fontSize: 11, color: 'var(--cyan)', marginBottom: 14, letterSpacing: 2, textTransform: 'uppercase' }}>
              &gt;_ Thông tin tài khoản
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {[
                ['Username', profile.username],
                ['Họ tên', profile.name],
                ['Vai trò', profile.role === 'admin' ? 'Admin' : 'Nhân viên'],
                ['Email', profile.email || '—'],
                ['Điện thoại', profile.phone || '—'],
                ['Ngày vào làm', fmtDate(profile.startDate)],
                ['Trạng thái', profile.employmentStatus === 'active' ? 'Đang làm' : 'Đã nghỉ'],
                ['Ngày tạo tài khoản', fmtDateTime(profile.createdAt)],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', width: 160, flexShrink: 0 }}>{label}:</span>
                  <span style={{ fontSize: 12, color: 'var(--text-bright)', fontFamily: 'monospace' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Password change */}
          <div className="form-panel" style={{ flex: '1 1 300px', minWidth: 280 }}>
            <div style={{ fontSize: 11, color: 'var(--cyan)', marginBottom: 14, letterSpacing: 2, textTransform: 'uppercase' }}>
              &gt;_ Đổi mật khẩu
            </div>
            <form onSubmit={handleChangePassword} style={{ display: 'grid', gap: 10 }}>
              <div>
                <label className="lbl">Mật khẩu hiện tại *</label>
                <input
                  className="inp" type="password" required
                  value={pwForm.currentPassword}
                  onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="lbl">Mật khẩu mới *</label>
                <input
                  className="inp" type="password" required minLength={6}
                  value={pwForm.newPassword}
                  onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                  placeholder="Ít nhất 6 ký tự"
                />
              </div>
              <div>
                <label className="lbl">Xác nhận mật khẩu mới *</label>
                <input
                  className="inp" type="password" required
                  value={pwForm.confirmPassword}
                  onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <div className="form-actions" style={{ marginTop: 4 }}>
                <button type="submit" className="btn cyan" disabled={pwLoading}>
                  {pwLoading ? '[ Đang xử lý... ]' : '[ Đổi mật khẩu ]'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab: Submit update request */}
      {tab === 'update-request' && (
        <div className="form-panel" style={{ maxWidth: 520 }}>
          <div style={{ fontSize: 11, color: 'var(--cyan)', marginBottom: 14, letterSpacing: 2, textTransform: 'uppercase' }}>
            &gt;_ Yêu cầu cập nhật thông tin
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 14, lineHeight: 1.6 }}>
            Điền các thông tin bạn muốn thay đổi. Admin sẽ xem xét và duyệt yêu cầu.
          </div>
          <form onSubmit={handleSubmitUpdateRequest} style={{ display: 'grid', gap: 12 }}>
            <div>
              <label className="lbl">Họ tên</label>
              <input
                className="inp"
                value={purForm.name}
                onChange={(e) => setPurForm({ ...purForm, name: e.target.value })}
                placeholder={profile.name}
              />
            </div>
            <div>
              <label className="lbl">Email</label>
              <input
                className="inp" type="email"
                value={purForm.email}
                onChange={(e) => setPurForm({ ...purForm, email: e.target.value })}
                placeholder={profile.email || 'email@example.com'}
              />
            </div>
            <div>
              <label className="lbl">Điện thoại</label>
              <input
                className="inp"
                value={purForm.phone}
                onChange={(e) => setPurForm({ ...purForm, phone: e.target.value })}
                placeholder={profile.phone || '0901234567'}
              />
            </div>
            <div>
              <label className="lbl">Lý do / Ghi chú</label>
              <textarea
                className="inp"
                rows={3}
                value={purForm.reason}
                onChange={(e) => setPurForm({ ...purForm, reason: e.target.value })}
                placeholder="Mô tả lý do cập nhật..."
                style={{ resize: 'vertical' }}
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn cyan" disabled={purLoading}>
                {purLoading ? '[ Đang gửi... ]' : '[ Gửi yêu cầu ]'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab: My update requests */}
      {tab === 'my-requests' && (
        <div>
          <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-dim)' }}>
            {updateRequests.length === 0 ? 'Chưa có yêu cầu cập nhật nào.' : `${updateRequests.length} yêu cầu`}
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {updateRequests.map((r) => {
              let data: any = {};
              try { data = JSON.parse(r.requestedData); } catch {}
              return (
                <div key={r.id} className="form-panel" style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      #{r.id} — {fmtDateTime(r.createdAt)}
                    </span>
                    <span className={`tag ${STATUS_COLOR[r.status] || 'cyan'}`}>
                      {STATUS_LABEL[r.status] || r.status}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
                    {Object.entries(data).map(([k, v]) => (
                      <div key={k} style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                        <span style={{ color: 'var(--cyan)' }}>{k}</span>: {String(v)}
                      </div>
                    ))}
                  </div>
                  {r.reason && (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
                      Lý do: {r.reason}
                    </div>
                  )}
                  {r.adminNote && (
                    <div style={{ fontSize: 11, color: 'var(--yellow)', marginTop: 6 }}>
                      Ghi chú Admin: {r.adminNote}
                    </div>
                  )}
                  {r.reviewedAt && (
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
                      Xử lý: {fmtDateTime(r.reviewedAt)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: My delete requests */}
      {tab === 'delete-requests' && (
        <div>
          <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-dim)' }}>
            {deleteRequests.length === 0 ? 'Chưa có yêu cầu xóa nào.' : `${deleteRequests.length} yêu cầu`}
          </div>
          <div className="table-wrap">
            <table className="nt">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Đối tượng</th>
                  <th>Tên bản ghi</th>
                  <th>Lý do</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th>Người xử lý</th>
                </tr>
              </thead>
              <tbody>
                {deleteRequests.length === 0 && (
                  <tr className="empty-row"><td colSpan={7}>Chưa có yêu cầu nào</td></tr>
                )}
                {deleteRequests.map((r) => (
                  <tr key={r.id}>
                    <td className="c-dim">#{r.id}</td>
                    <td className="c-cyan">{r.modelName}</td>
                    <td className="c-bright">{r.recordLabel}</td>
                    <td className="c-dim" style={{ maxWidth: 200 }}>{r.reason}</td>
                    <td>
                      <span className={`tag ${STATUS_COLOR[r.status] || 'cyan'}`}>
                        {STATUS_LABEL[r.status] || r.status}
                      </span>
                    </td>
                    <td className="c-dim">{fmtDateTime(r.createdAt)}</td>
                    <td className="c-dim">{r.reviewer?.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
