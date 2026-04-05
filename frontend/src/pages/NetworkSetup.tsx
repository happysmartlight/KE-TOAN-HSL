import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../api';
import { copyToClipboard } from '../utils/clipboard';

type NetworkInfo = {
  hostname: string;
  backendPort: number;
  lanIPs: string[];
  tailscaleIPs: string[];
  isProd: boolean;
};

type TailscalePhase = 'idle' | 'installing' | 'starting' | 'auth_pending' | 'connected' | 'error';

type TsState = {
  phase: TailscalePhase;
  authUrl?: string;
  error?: string;
  tailscaleIPs: string[];
};

// ── Shared sub-components ────────────────────────────────────────────────────

function StatusRow({ label, ok, detail }: { label: string; ok: boolean | null; detail?: string }) {
  const color = ok === null ? 'var(--text-dim)' : ok ? 'var(--green)' : 'var(--red)';
  const icon  = ok === null ? '◌' : ok ? '✓' : '✗';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{ color, fontWeight: 700, width: 16, textAlign: 'center', fontSize: 13 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-bright)' }}>{label}</span>
      {detail && <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace' }}>{detail}</span>}
    </div>
  );
}

function CopyBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    copyToClipboard(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'rgba(0,245,255,0.04)', border: '1px solid rgba(0,245,255,0.2)',
      borderRadius: 4, padding: '10px 12px',
    }}>
      <span style={{ flex: 1, fontFamily: 'monospace', fontSize: 13, color: 'var(--cyan)', wordBreak: 'break-all' }}>
        {url}
      </span>
      <button className="btn cyan btn-sm" onClick={copy} style={{ flexShrink: 0, minWidth: 76 }}>
        {copied ? '✓ Đã copy' : '📋 Copy'}
      </button>
    </div>
  );
}

function QRPanel({ url, label }: { url: string; label?: string }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{
        display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
        gap: 8, padding: 12, background: '#fff', borderRadius: 6,
      }}>
        <QRCodeSVG value={url} size={160} />
        <span style={{ fontSize: 10, color: '#555' }}>{label ?? 'Quét để mở trên điện thoại'}</span>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14,
      border: '2px solid rgba(0,245,255,0.2)',
      borderTop: '2px solid var(--cyan)',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
      verticalAlign: 'middle', marginRight: 8,
    }} />
  );
}

// ── Tailscale Wizard ─────────────────────────────────────────────────────────

function TailscaleWizard({ info, getUrl }: {
  info: NetworkInfo;
  getUrl: (ip: string) => string;
}) {
  const [ts, setTs]         = useState<TsState | null>(null);
  const [tab, setTab]       = useState<'auto' | 'manual'>('auto');
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  const pollState = async () => {
    try {
      const r = await api.get<TsState>('/admin/tailscale/state');
      setTs(r.data);
      if (r.data.phase === 'connected' || r.data.tailscaleIPs.length > 0 || r.data.phase === 'error') {
        stopPoll();
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    pollState();
    return stopPoll;
  }, []);

  // Auto-start polling while in progress
  useEffect(() => {
    const active = ts?.phase === 'installing' || ts?.phase === 'starting' || ts?.phase === 'auth_pending';
    if (active && !pollRef.current) {
      pollRef.current = setInterval(pollState, 3000);
    }
    if (!active) stopPoll();
  }, [ts?.phase]);

  const handleStart = async () => {
    setStarting(true);
    try {
      await api.post('/admin/tailscale/start');
      setTs((p) => p ? { ...p, phase: 'installing' } : { phase: 'installing', tailscaleIPs: [] });
      pollRef.current = setInterval(pollState, 3000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Không thể bắt đầu cài đặt');
    } finally {
      setStarting(false);
    }
  };

  const handleReset = async () => {
    stopPoll();
    await api.post('/admin/tailscale/reset');
    setTs({ phase: 'idle', tailscaleIPs: [] });
  };

  const phase = ts?.phase ?? 'idle';
  const connectedIP = ts?.tailscaleIPs?.[0] ?? info.tailscaleIPs[0];
  const isConnected = phase === 'connected' || connectedIP;
  const isWindows   = !info.isProd && navigator.platform.includes('Win');

  // ── Connected state ──────────────────────────────────────────────────────
  if (isConnected) {
    const url = getUrl(connectedIP);
    return (
      <>
        <div style={{ fontSize: 12, color: 'var(--green)', marginBottom: 12, fontWeight: 700 }}>
          ✓ Đã kết nối Tailscale
          <span style={{ fontFamily: 'monospace', color: 'var(--text-dim)', fontWeight: 400, marginLeft: 8 }}>
            {connectedIP}
          </span>
        </div>
        <CopyBox url={url} />
        <QRPanel url={url} />
      </>
    );
  }

  // ── Tab selector ─────────────────────────────────────────────────────────
  return (
    <>
      <div style={{ fontSize: 12, color: 'var(--yellow)', marginBottom: 14, fontWeight: 700 }}>
        ✗ Chưa kết nối Tailscale
      </div>

      {/* Tab buttons */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        <button
          className={`btn ${tab === 'auto' ? 'cyan' : 'ghost'} btn-sm`}
          style={{ borderRadius: '4px 0 0 4px', flex: 1 }}
          onClick={() => setTab('auto')}
        >
          ⚡ Tự động
        </button>
        <button
          className={`btn ${tab === 'manual' ? 'cyan' : 'ghost'} btn-sm`}
          style={{ borderRadius: '0 4px 4px 0', flex: 1 }}
          onClick={() => setTab('manual')}
        >
          💻 Thủ công
        </button>
      </div>

      {/* ── Auto tab ── */}
      {tab === 'auto' && (
        <>
          {/* idle */}
          {phase === 'idle' && (
            <div>
              {isWindows ? (
                <div style={{
                  padding: '12px', background: 'rgba(255,204,0,0.06)',
                  border: '1px solid rgba(255,204,0,0.2)', borderRadius: 4,
                  fontSize: 12, color: 'var(--yellow)', lineHeight: 1.6,
                }}>
                  ⚠ Chức năng tự động chỉ hoạt động khi chạy trên <strong>Raspberry Pi / Linux</strong>.
                  Bạn đang ở chế độ dev trên Windows — dùng tab <strong>Thủ công</strong>.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7, marginBottom: 16 }}>
                    Nhấn nút bên dưới. Hệ thống sẽ tự động cài Tailscale và tạo một <strong style={{ color: 'var(--text-bright)' }}>mã QR xác thực</strong>.
                    Bạn chỉ cần quét mã đó bằng điện thoại là xong.
                  </div>
                  <button
                    className="btn cyan"
                    style={{ width: '100%', fontWeight: 700 }}
                    onClick={handleStart}
                    disabled={starting}
                  >
                    {starting ? <><Spinner />Đang khởi động...</> : '⚡ Cài đặt Tailscale tự động'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* installing */}
          {phase === 'installing' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Spinner />
              <span style={{ fontSize: 13, color: 'var(--cyan)' }}>Đang tải và cài đặt Tailscale...</span>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
                Có thể mất 1–2 phút tùy tốc độ mạng.
              </div>
            </div>
          )}

          {/* starting */}
          {phase === 'starting' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Spinner />
              <span style={{ fontSize: 13, color: 'var(--cyan)' }}>Đang khởi động Tailscale...</span>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
                Đang tạo mã xác thực, vui lòng chờ.
              </div>
            </div>
          )}

          {/* auth_pending — CHÍNH: hiển thị QR để xác thực */}
          {phase === 'auth_pending' && ts?.authUrl && (
            <div>
              <div style={{
                padding: '10px 12px', marginBottom: 14,
                background: 'rgba(0,245,255,0.05)', border: '1px solid rgba(0,245,255,0.2)',
                borderRadius: 4, fontSize: 12, color: 'var(--cyan)', lineHeight: 1.6,
              }}>
                <Spinner />
                <strong>Bước cuối:</strong> Mở Tailscale trên điện thoại hoặc máy tính, sau đó quét mã QR bên dưới để xác thực.
              </div>

              <QRPanel url={ts.authUrl} label="Quét để đăng nhập Tailscale" />

              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>Hoặc mở link này trên trình duyệt:</div>
                <CopyBox url={ts.authUrl} />
              </div>

              <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                Sau khi xác thực, trang này sẽ <strong style={{ color: 'var(--text-bright)' }}>tự động cập nhật</strong>.
                Bạn không cần làm thêm gì.
              </div>
            </div>
          )}

          {/* auth_pending nhưng chưa có URL */}
          {phase === 'auth_pending' && !ts?.authUrl && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Spinner />
              <span style={{ fontSize: 12, color: 'var(--cyan)' }}>Đang tạo mã xác thực...</span>
            </div>
          )}

          {/* error */}
          {phase === 'error' && (
            <div>
              <div style={{
                padding: '10px 12px', marginBottom: 12,
                background: 'rgba(255,0,85,0.07)', border: '1px solid rgba(255,0,85,0.25)',
                borderRadius: 4, fontSize: 12, color: 'var(--red)', lineHeight: 1.5,
              }}>
                ✗ Có lỗi xảy ra: {ts?.error ?? 'Không rõ nguyên nhân'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn cyan btn-sm" onClick={handleStart} style={{ flex: 1 }}>
                  ↻ Thử lại
                </button>
                <button className="btn ghost btn-sm" onClick={handleReset}>
                  Đặt lại
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Manual tab ── */}
      {tab === 'manual' && (
        <div style={{ fontSize: 12, lineHeight: 1.9, color: 'var(--text-dim)' }}>
          <div style={{ fontWeight: 700, color: 'var(--text-bright)', marginBottom: 8 }}>
            Mở terminal trên Raspberry Pi và chạy lần lượt:
          </div>

          {[
            {
              step: '1. Cài Tailscale',
              cmd: 'curl -fsSL https://tailscale.com/install.sh | sh',
            },
            {
              step: '2. Kết nối (sẽ in ra link — mở link đó để đăng nhập)',
              cmd: 'sudo tailscale up',
            },
          ].map(({ step, cmd }) => (
            <div key={step} style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4 }}>{step}</div>
              <div style={{
                fontFamily: 'monospace', fontSize: 11,
                background: 'rgba(0,245,255,0.04)', border: '1px solid rgba(0,245,255,0.12)',
                borderRadius: 3, padding: '6px 10px', color: 'var(--cyan)',
              }}>
                {cmd}
              </div>
            </div>
          ))}

          <div style={{ marginBottom: 4 }}>3. Cài Tailscale trên điện thoại / máy tính của bạn, đăng nhập cùng tài khoản</div>
          <div>4. Nhấn <span style={{ color: 'var(--text-bright)' }}>↻ Làm mới</span> ở góc trên trang này</div>
        </div>
      )}
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function NetworkSetup() {
  const [info, setInfo]         = useState<NetworkInfo | null>(null);
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [netRes] = await Promise.all([
        api.get<NetworkInfo>('/admin/network'),
        api.get('/admin/health').then(() => setServerOk(true)).catch(() => setServerOk(false)),
      ]);
      setInfo(netRes.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Không thể tải thông tin mạng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const getUrl = (ip: string) => {
    if (!info) return '';
    const port = info.isProd ? info.backendPort : 5173;
    return `http://${ip}:${port}`;
  };

  const primaryLan = info?.lanIPs[0]       ? getUrl(info.lanIPs[0])       : null;
  const localPort  = info ? (info.isProd ? info.backendPort : 5173) : null;

  return (
    <div>
      {/* Spin keyframe (inline so no index.css change needed) */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div className="page-header">
        <h1 className="page-title">🌐 Thiết lập mạng</h1>
        <button className="btn ghost btn-sm" onClick={load}>↻ Làm mới</button>
      </div>

      {loading && <div className="c-dim" style={{ fontSize: 12 }}>Đang kiểm tra hệ thống...</div>}

      {error && (
        <div style={{
          padding: '10px 14px', background: 'rgba(255,0,85,0.08)',
          border: '1px solid rgba(255,0,85,0.3)', borderRadius: 4,
          color: 'var(--red)', fontSize: 12, marginBottom: 16,
        }}>✗ {error}</div>
      )}

      {!loading && info && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>

          {/* ── 1. Kiểm tra hệ thống ── */}
          <div className="form-panel" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--text-dim)', marginBottom: 14 }}>
              📡 Kiểm tra hệ thống
            </div>

            <StatusRow label="Server đang chạy" ok={serverOk} detail={serverOk ? 'OK' : 'Lỗi'} />
            <StatusRow label="Hostname" ok={true} detail={info.hostname} />

            {info.lanIPs.length > 0
              ? info.lanIPs.map((ip) => <StatusRow key={ip} label="IP nội bộ (LAN)" ok={true} detail={ip} />)
              : <StatusRow label="IP nội bộ (LAN)" ok={false} detail="Không phát hiện" />
            }

            {info.tailscaleIPs.length > 0
              ? info.tailscaleIPs.map((ip) => <StatusRow key={ip} label="Tailscale VPN" ok={true} detail={ip} />)
              : <StatusRow label="Tailscale VPN" ok={false} detail="Chưa kết nối" />
            }

            <StatusRow label="Chế độ" ok={true} detail={info.isProd ? 'Production' : 'Development'} />

            {localPort && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Bảng truy cập
                </div>
                <table className="nt" style={{ fontSize: 11, width: '100%' }}>
                  <tbody>
                    <tr>
                      <td className="c-dim" style={{ paddingRight: 8 }}>Máy này</td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--cyan)' }}>localhost:{localPort}</td>
                    </tr>
                    {info.lanIPs[0] && (
                      <tr>
                        <td className="c-dim" style={{ paddingRight: 8 }}>Trong mạng</td>
                        <td style={{ fontFamily: 'monospace', color: 'var(--cyan)' }}>{info.lanIPs[0]}:{localPort}</td>
                      </tr>
                    )}
                    {info.tailscaleIPs[0] && (
                      <tr>
                        <td className="c-dim" style={{ paddingRight: 8 }}>Từ xa (VPN)</td>
                        <td style={{ fontFamily: 'monospace', color: 'var(--purple)' }}>{info.tailscaleIPs[0]}:{localPort}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── 2. LAN Access ── */}
          <div className="form-panel" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--text-dim)', marginBottom: 14 }}>
              📱 Truy cập nội bộ (LAN)
            </div>

            {primaryLan ? (
              <>
                <CopyBox url={primaryLan} />
                <QRPanel url={primaryLan} />
                {info.lanIPs.length > 1 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>IP thay thế:</div>
                    {info.lanIPs.slice(1).map((ip) => (
                      <div key={ip} style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace', marginBottom: 3 }}>
                        {getUrl(ip)}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: '16px 0' }}>
                <div style={{ color: 'var(--yellow)', fontSize: 12, marginBottom: 8 }}>⚠ Không tìm thấy IP nội bộ</div>
                <div className="c-dim" style={{ fontSize: 11, lineHeight: 1.6 }}>
                  Kiểm tra kết nối WiFi/Ethernet của Raspberry Pi.
                </div>
              </div>
            )}
          </div>

          {/* ── 3. Tailscale Remote Access ── */}
          <div className="form-panel" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--text-dim)', marginBottom: 14 }}>
              🌍 Truy cập từ xa (Tailscale)
            </div>
            <TailscaleWizard info={info} getUrl={getUrl} />
          </div>

          {/* ── 4. Security ── */}
          <div className="form-panel" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--text-dim)', marginBottom: 14 }}>
              🔐 Bảo mật
            </div>

            <StatusRow label="Giao thức" ok={false} detail="HTTP (chưa có HTTPS)" />
            <StatusRow label="Phạm vi truy cập" ok={true} detail="Nội bộ / VPN only" />

            <div style={{
              marginTop: 14, padding: '10px 12px',
              background: 'rgba(255,204,0,0.05)', border: '1px solid rgba(255,204,0,0.2)',
              borderRadius: 4, fontSize: 11, color: 'var(--yellow)', lineHeight: 1.7,
            }}>
              ⚠ Hệ thống đang dùng <strong>HTTP</strong>. Chỉ sử dụng trong mạng nội bộ hoặc qua Tailscale VPN. Không chia sẻ link ra mạng công cộng.
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                Khuyến nghị
              </div>
              {[
                '✓ Dùng mật khẩu mạnh cho tài khoản admin',
                '✓ Chỉ cấp tài khoản cho nhân viên cần thiết',
                '✓ Truy cập từ xa qua Tailscale VPN',
                '✓ Sao lưu dữ liệu định kỳ',
              ].map((tip) => (
                <div key={tip} style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 5 }}>{tip}</div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
