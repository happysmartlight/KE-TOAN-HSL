import { toast } from '../components/Toast';
import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const MODEL_LABEL: Record<string, string> = {
  Customer: '👥 Khách hàng',
  Supplier: '🏭 Nhà cung cấp',
  Product:  '📦 Sản phẩm',
};

export default function DeleteRequests() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const load = () => api.get('/delete-requests').then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const review = async (id: number, action: 'approved' | 'rejected') => {
    const label = action === 'approved' ? 'duyệt (xóa bản ghi)' : 'từ chối';
    if (!confirm(`Xác nhận ${label} yêu cầu này?`)) return;
    try {
      await api.patch(`/delete-requests/${id}`, { action });
      load();
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Lỗi'); }
  };

  const filtered = rows.filter((r) => filter === 'all' || r.status === filter);
  const pending  = rows.filter((r) => r.status === 'pending').length;

  if (user?.role !== 'admin') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ color: 'var(--red)', fontSize: 13 }}>⛔ Chỉ Admin mới xem được trang này</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          Yêu cầu xóa dữ liệu
          {pending > 0 && <span className="nav-badge" style={{ marginLeft: 10, display: 'inline-flex' }}>{pending}</span>}
        </h1>
      </div>

      {/* Filter tabs */}
      <div className="form-panel mb-16" style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['pending','all','approved','rejected'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`btn ${filter === f ? 'cyan' : 'ghost'} btn-sm`}>
              {f === 'pending' ? `⏳ Chờ duyệt (${pending})` : f === 'all' ? 'Tất cả' : f === 'approved' ? '✅ Đã duyệt' : '❌ Từ chối'}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table className="nt">
          <thead>
            <tr>
              <th>Loại dữ liệu</th>
              <th>Bản ghi</th>
              <th>Người yêu cầu</th>
              <th>Lý do</th>
              <th>Trạng thái</th>
              <th>Ngày gửi</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr className="empty-row"><td colSpan={7}>Không có yêu cầu nào</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{MODEL_LABEL[r.modelName] || r.modelName}</td>
                <td className="c-bright fw7">{r.recordLabel}</td>
                <td className="c-cyan">{r.requester?.name} <span className="c-dim" style={{ fontSize:10 }}>({r.requester?.username})</span></td>
                <td style={{ maxWidth: 200, wordBreak: 'break-word' }}>{r.reason}</td>
                <td>
                  <span className={`tag ${r.status === 'pending' ? 'yellow' : r.status === 'approved' ? 'green' : 'red'}`}>
                    {r.status === 'pending' ? 'Chờ duyệt' : r.status === 'approved' ? 'Đã duyệt' : 'Từ chối'}
                  </span>
                </td>
                <td className="c-dim">{new Date(r.createdAt).toLocaleDateString('vi-VN')}</td>
                <td>
                  {r.status === 'pending' && (
                    <div className="td-act">
                      <button className="btn green btn-sm" onClick={() => review(r.id, 'approved')}>✓ Duyệt</button>
                      <button className="btn red btn-sm"   onClick={() => review(r.id, 'rejected')}>✗ Từ chối</button>
                    </div>
                  )}
                  {r.status !== 'pending' && (
                    <span className="c-dim" style={{ fontSize:10 }}>
                      {r.reviewer?.name} · {r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString('vi-VN') : ''}
                    </span>
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
