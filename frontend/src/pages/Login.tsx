import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { APP_VERSION, APP_NAME } from '../version';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [time, setTime]         = useState(new Date());

  // Realtime clock
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try { await login(username, password, remember); }
    catch (err: any) { setError(err.response?.data?.error || 'Đăng nhập thất bại'); }
    finally { setLoading(false); }
  };

  const timeStr = time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = time.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="login-page">
      <div className="login-box">
        {/* Logo + tên hệ thống */}
        <div className="login-logo">
          <img src="/logo.svg" alt={APP_NAME} />
        </div>
        <div className="login-sub">Hệ thống kế toán nội bộ</div>

        {/* Đồng hồ */}
        <div style={{
          textAlign: 'center', marginBottom: 24,
          padding: '10px 0', borderRadius: 6,
          background: 'rgba(0,245,255,0.04)',
          border: '1px solid rgba(0,245,255,0.1)',
        }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--cyan)', fontVariantNumeric: 'tabular-nums', letterSpacing: 2 }}>
            {timeStr}
          </div>
          <div style={{ fontSize: 10, color: '#b0b8d0', marginTop: 2, textTransform: 'capitalize' }}>
            {dateStr}
          </div>
        </div>

        <form onSubmit={submit}>
          {/* Username */}
          <div className="login-field">
            <label className="lbl">Tên đăng nhập</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#8898b8', pointerEvents: 'none' }}>◈</span>
              <input
                className="inp" required value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin" autoFocus autoComplete="username"
                style={{ paddingLeft: 30 }}
              />
            </div>
          </div>

          {/* Password */}
          <div className="login-field">
            <label className="lbl">Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#8898b8', pointerEvents: 'none' }}>⬡</span>
              <input
                className="inp" type={showPw ? 'text' : 'password'}
                required value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password"
                style={{ paddingLeft: 30, paddingRight: 36 }}
              />
              <span
                onClick={() => setShowPw((v) => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: 12, color: '#9090b8', userSelect: 'none' }}
                title={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPw ? '🙈' : '👁'}
              </span>
            </div>
          </div>

          {/* Remember me */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, marginTop: -4 }}>
            <div
              onClick={() => setRemember((v) => !v)}
              style={{
                width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                border: `1.5px solid ${remember ? 'var(--cyan)' : 'var(--border)'}`,
                background: remember ? 'rgba(0,245,255,0.15)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {remember && <span style={{ fontSize: 9, color: 'var(--cyan)', fontWeight: 900, lineHeight: 1 }}>✓</span>}
            </div>
            <span
              onClick={() => setRemember((v) => !v)}
              style={{ fontSize: 11, color: '#c8cce0', cursor: 'pointer', userSelect: 'none' }}
            >
              Ghi nhớ đăng nhập
            </span>
            <span style={{ fontSize: 10, color: '#8898b8', marginLeft: 'auto' }}>
              {remember ? 'Lưu vĩnh viễn' : 'Xóa khi đóng trình duyệt'}
            </span>
          </div>

          {/* Error */}
          {error && (
            <div className="login-error" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⚠</span> {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit" disabled={loading} className="btn cyan"
            style={{ width: '100%', justifyContent: 'center', height: 38, fontSize: 12, letterSpacing: 1 }}
          >
            {loading ? (
              <span style={{ opacity: 0.7 }}>[ Đang xác thực... ]</span>
            ) : (
              '[ Đăng nhập ]'
            )}
          </button>
        </form>

        {/* Footer */}
        <div style={{
          marginTop: 20, paddingTop: 14,
          borderTop: '1px solid var(--border-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 10, color: '#8898b8',
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
