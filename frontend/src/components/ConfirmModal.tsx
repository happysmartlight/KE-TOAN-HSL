interface Props {
  title: string;
  message?: string;
  warning?: string;
  confirmLabel?: string;
  confirmCls?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  warning,
  confirmLabel = 'Xác nhận',
  confirmCls = 'red',
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="modal-bg" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        {/* Icon + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,0,85,0.12)',
            border: '1px solid rgba(255,0,85,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
          }}>⚠</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-bright)' }}>{title}</div>
        </div>

        {/* Message */}
        {message && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: warning ? 10 : 18, lineHeight: 1.6 }}>
            {message}
          </div>
        )}

        {/* Warning box */}
        {warning && (
          <div style={{
            marginBottom: 18, padding: '8px 12px',
            background: 'rgba(255,160,0,0.08)',
            borderRadius: 4,
            border: '1px solid rgba(255,160,0,0.25)',
            fontSize: 11, color: 'var(--yellow)', lineHeight: 1.6,
          }}>
            ⚠ {warning}
          </div>
        )}

        <div className="form-actions">
          <button className={`btn ${confirmCls}`} onClick={onConfirm}>[ {confirmLabel} ]</button>
          <button className="btn ghost" onClick={onCancel}>[ Hủy ]</button>
        </div>
      </div>
    </div>
  );
}
