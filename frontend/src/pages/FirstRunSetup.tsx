import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { APP_VERSION, APP_NAME } from '../version';

/**
 * Trang khởi tạo lần đầu — hiển thị thay cho Login khi DB chưa có user nào.
 *
 * Flow:
 *   1. AuthContext gọi GET /auth/setup-status lúc app khởi động.
 *   2. Nếu needsSetup = true → App.tsx render trang này.
 *   3. User điền username + tên + mật khẩu → POST /auth/setup
 *   4. Backend tạo admin + trả token → AuthContext setUser → vào dashboard.
 *
 * KHÔNG cần đụng .env, KHÔNG cần SSH vào server, KHÔNG cần biết DB cred.
 */
export default function FirstRunSetup() {
  const { setupAdmin } = useAuth();
  const [username, setUsername] = useState('admin');
  const [name, setName]         = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  // Kiểm tra password policy real-time để hiển thị checklist (UX feedback)
  // Chính sách phải khớp 1-1 với assertPasswordPolicy ở backend (auth.service.ts).
  const pwLenOk     = password.length >= 12;
  const pwGroupCount = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/]
    .filter((re) => re.test(password)).length;
  const pwGroupsOk  = pwGroupCount >= 3;
  const pwMatchOk   = password.length > 0 && password === confirm;
  const userOk      = /^[a-zA-Z0-9._-]{3,}$/.test(username);
  const canSubmit   = pwLenOk && pwGroupsOk && pwMatchOk && userOk;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!canSubmit) {
      setError('Vui lòng kiểm tra lại các điều kiện bên dưới');
      return;
    }
    setLoading(true);
    try {
      await setupAdmin(username.trim(), name.trim(), password);
      // Sau setupAdmin, AuthContext set user → App tự render Dashboard, không cần redirect tay.
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  };

  // Reuse class .login-page / .login-box từ index.css để đỡ phải viết CSS mới —
  // chỉ override vài chỗ qua inline style cho riêng trang này (heading, sub).
  return (
    <div className="login-page">
      <div className="login-box" style={{ maxWidth: 460 }}>
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-text">
            <div className="login-logo-prompt">{'>'}_</div>
            <div className="login-logo-happy">HAPPY</div>
            <div className="login-logo-smart">SMART<span className="login-logo-light"> LIGHT</span></div>
          </div>
        </div>
        <div className="login-sub">Khởi tạo hệ thống lần đầu</div>

        {/* Banner giải thích */}
        <div style={{
          margin: '0 0 18px',
          padding: '10px 12px',
          borderRadius: 6,
          background: 'rgba(0,245,255,0.04)',
          border: '1px solid rgba(0,245,255,0.18)',
          fontSize: 11,
          lineHeight: 1.6,
          color: '#c8d4ec',
        }}>
          <div style={{ color: 'var(--cyan)', fontWeight: 700, marginBottom: 4, letterSpacing: 0.5 }}>
            ◈ KHỞI TẠO TÀI KHOẢN QUẢN TRỊ
          </div>
          Đây là lần đầu hệ thống được chạy. Vui lòng tạo tài khoản quản trị viên — đây sẽ là tài khoản có toàn quyền trên hệ thống.
        </div>

        <form onSubmit={submit}>
          {/* Username */}
          <div className="login-field">
            <label className="lbl">Tên đăng nhập</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#a0a8c0', pointerEvents: 'none' }}>◈</span>
              <input
                className="inp" required value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin" autoFocus autoComplete="username"
                autoCapitalize="none" autoCorrect="off" spellCheck={false}
                style={{ paddingLeft: 30 }}
              />
            </div>
            {username.length > 0 && !userOk && (
              <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 4 }}>
                ✗ Chỉ chấp nhận chữ, số và các ký tự . _ - (≥3 ký tự)
              </div>
            )}
          </div>

          {/* Họ tên hiển thị */}
          <div className="login-field">
            <label className="lbl">Họ tên hiển thị (tuỳ chọn)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#a0a8c0', pointerEvents: 'none' }}>♛</span>
              <input
                className="inp" value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Quản trị viên"
                style={{ paddingLeft: 30 }}
              />
            </div>
          </div>

          {/* Password */}
          <div className="login-field">
            <label className="lbl">Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#a0a8c0', pointerEvents: 'none' }}>⬡</span>
              <input
                className="inp" type={showPw ? 'text' : 'password'}
                required value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••" autoComplete="new-password"
                autoCapitalize="none" autoCorrect="off" spellCheck={false}
                style={{ paddingLeft: 30, paddingRight: 36 }}
              />
              <span
                onClick={() => setShowPw((v) => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: 12, color: '#c0c8e0', userSelect: 'none' }}
                title={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPw ? '🙈' : '👁'}
              </span>
            </div>
          </div>

          {/* Confirm */}
          <div className="login-field">
            <label className="lbl">Nhập lại mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#a0a8c0', pointerEvents: 'none' }}>⬡</span>
              <input
                className="inp" type={showPw ? 'text' : 'password'}
                required value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••••••" autoComplete="new-password"
                style={{ paddingLeft: 30 }}
              />
            </div>
          </div>

          {/* Password policy checklist */}
          <div style={{
            marginBottom: 14,
            padding: '8px 10px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border-dim)',
            borderRadius: 4,
            fontSize: 10,
            lineHeight: 1.7,
          }}>
            <PolicyRow ok={pwLenOk}    text="Ít nhất 12 ký tự" />
            <PolicyRow ok={pwGroupsOk} text={`Có ít nhất 3/4 nhóm: chữ thường / chữ hoa / số / ký tự đặc biệt (hiện: ${pwGroupCount}/4)`} />
            <PolicyRow ok={pwMatchOk}  text="Hai ô mật khẩu trùng khớp" />
          </div>

          {/* Error */}
          {error && (
            <div className="login-error" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⚠</span> {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit" disabled={loading || !canSubmit} className="btn cyan"
            style={{
              width: '100%', justifyContent: 'center', height: 40,
              fontSize: 12, letterSpacing: 1,
              opacity: (loading || !canSubmit) ? 0.55 : 1,
              cursor: (loading || !canSubmit) ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? (
              <span style={{ opacity: 0.7 }}>[ Đang khởi tạo... ]</span>
            ) : (
              '[ Khởi tạo hệ thống ]'
            )}
          </button>
        </form>

        {/* Footer */}
        <div style={{
          marginTop: 20, paddingTop: 14,
          borderTop: '1px solid var(--border-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 10, color: '#b8c0d8',
        }}>
          <span>© 2026 {APP_NAME}</span>
          <span style={{
            background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.15)',
            borderRadius: 10, padding: '1px 7px', color: 'var(--cyan)', fontWeight: 700, letterSpacing: 0.5,
          }}>v{APP_VERSION}</span>
        </div>
      </div>
    </div>
  );
}

function PolicyRow({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div style={{ color: ok ? 'var(--green)' : '#a0a8c0', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
      <span style={{ width: 10, flexShrink: 0 }}>{ok ? '✓' : '○'}</span>
      <span>{text}</span>
    </div>
  );
}
