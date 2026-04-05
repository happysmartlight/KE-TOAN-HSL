import { useEffect, useState } from 'react';

interface Props {
  title: string;
  message?: string;
  warning?: string;
  confirmLabel?: string;
  confirmCls?: string;
  /** Nếu có, người dùng phải gõ đúng chuỗi này mới cho phép xác nhận */
  typeToConfirm?: string;
  /** Nếu true, yêu cầu nhập mật khẩu admin để xác nhận */
  requirePassword?: boolean;
  onConfirm: (password?: string) => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  warning,
  confirmLabel = 'Xác nhận',
  confirmCls = 'red',
  typeToConfirm,
  requirePassword,
  onConfirm,
  onCancel,
}: Props) {
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');

  const typedOk = !typeToConfirm || typed === typeToConfirm;
  const passwordOk = !requirePassword || password.length > 0;
  const canConfirm = typedOk && passwordOk;

  // ESC → hủy, ENTER → xác nhận (nếu đủ điều kiện)
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCancel(); return; }
      if (e.key === 'Enter' && canConfirm && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        onConfirm(requirePassword ? password : undefined);
      }
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [canConfirm, password, requirePassword, onConfirm, onCancel]);

  return (
    <div className="modal-bg" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
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
            marginBottom: 14, padding: '8px 12px',
            background: 'rgba(255,160,0,0.08)',
            borderRadius: 4,
            border: '1px solid rgba(255,160,0,0.25)',
            fontSize: 11, color: 'var(--yellow)', lineHeight: 1.6,
          }}>
            ⚠ {warning}
          </div>
        )}

        {/* Typed confirmation */}
        {typeToConfirm && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
              Gõ <span style={{ color: 'var(--red)', fontWeight: 700, fontFamily: 'monospace' }}>{typeToConfirm}</span> để xác nhận:
            </div>
            <input
              className="inp"
              autoFocus={!requirePassword}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={typeToConfirm}
              style={{ fontFamily: 'monospace', letterSpacing: 2 }}
            />
          </div>
        )}

        {/* Password confirmation */}
        {requirePassword && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
              Nhập mật khẩu Admin để xác nhận:
            </div>
            <input
              className="inp"
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && canConfirm && onConfirm(password)}
              placeholder="••••••••"
            />
          </div>
        )}

        <div className="form-actions">
          <button
            className={`btn ${confirmCls}`}
            onClick={() => onConfirm(requirePassword ? password : undefined)}
            disabled={!canConfirm}
            style={!canConfirm ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
          >
            [ {confirmLabel} ]
          </button>
          <button className="btn ghost" onClick={onCancel}>[ Hủy ]</button>
        </div>
      </div>
    </div>
  );
}
