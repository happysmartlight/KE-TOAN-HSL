import { useState } from 'react';
import api from '../api';

interface Props {
  modelName: string;
  recordId: number;
  recordLabel: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function RequestDeleteModal({ modelName, recordId, recordLabel, onClose, onSuccess }: Props) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setLoading(true);
    try {
      await api.post('/delete-requests', { modelName, recordId, recordLabel, reason });
      onSuccess?.();
      onClose();
      alert('Đã gửi yêu cầu xóa. Admin sẽ xem xét và phê duyệt.');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Lỗi khi gửi yêu cầu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
          🗑️ Yêu cầu xóa dữ liệu
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>
          Bạn không có quyền xóa trực tiếp. Nhập lý do để gửi yêu cầu cho Admin phê duyệt.
        </div>
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--red-dim)', borderRadius: 4, border: '1px solid rgba(255,0,85,0.2)', fontSize: 11 }}>
          <span className="c-dim">Bản ghi: </span>
          <span className="c-bright fw7">{recordLabel}</span>
        </div>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 12 }}>
            <label className="lbl">Lý do xóa *</label>
            <textarea className="inp" rows={3} required value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập lý do cần xóa bản ghi này..."
              style={{ resize: 'vertical', width: '100%' }} />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn red" disabled={loading}>
              {loading ? 'Đang gửi...' : '[ Gửi yêu cầu ]'}
            </button>
            <button type="button" className="btn ghost" onClick={onClose}>[ Hủy ]</button>
          </div>
        </form>
      </div>
    </div>
  );
}
