import { useEffect, useRef, useState } from 'react';
import api from '../api';

const LEVEL_COLOR: Record<string, string> = {
  info: 'var(--cyan)', warning: 'var(--yellow)', error: 'var(--red)', critical: '#bf00ff',
};

type HealthInfo = {
  uptime: number; nodeVersion: string; platform: string; arch: string; hostname: string;
  ram: { total: number; free: number; used: number };
  cpu: { model: string; cores: number; loadavg: number[] };
  dbSize: number;
  disk: { total: number; free: number; used: number } | null;
};

type OnlineUser = { userId: number; username: string; name: string; role: string; ip: string; at: number };

function fmtBytes(b: number) {
  if (b >= 1024 ** 3) return (b / 1024 ** 3).toFixed(2) + ' GB';
  if (b >= 1024 ** 2) return (b / 1024 ** 2).toFixed(2) + ' MB';
  if (b >= 1024)      return (b / 1024).toFixed(1) + ' KB';
  return b + ' B';
}

function fmtUptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (d > 0) return `${d}d ${h}h ${m}m ${sec}s`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

function BarStat({ label, used, total, color }: { label: string; used: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
        <span className="c-dim">{label}</span>
        <span style={{ color }}>{fmtBytes(used)}<span className="c-dim"> / {fmtBytes(total)} ({pct}%)</span></span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color, transition: 'width 0.6s',
          borderRadius: 3, boxShadow: pct > 80 ? `0 0 12px ${color}66` : undefined,
        }} />
      </div>
    </div>
  );
}

function statusColor(ratio: number) {
  if (ratio > 0.85) return 'var(--red)';
  if (ratio > 0.65) return 'var(--yellow)';
  return 'var(--green)';
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: ok ? 'var(--green)' : 'var(--red)',
      boxShadow: ok ? '0 0 6px var(--green)' : '0 0 6px var(--red)',
      marginRight: 6, flexShrink: 0,
    }} />
  );
}

type UpdatePhase = 'idle' | 'checking' | 'up_to_date' | 'update_available' | 'updating' | 'success' | 'error';
type CiStatus = 'passing' | 'failing' | 'pending' | 'unknown';
type UpdateState = {
  phase: UpdatePhase;
  currentCommit?: string;
  currentMessage?: string;
  remoteCommit?: string;
  commitsBehind?: number;
  newCommits?: string[];
  ciStatus?: CiStatus;
  ciStatusSha?: string;
  logs: string[];
  error?: string;
  checkedAt?: number;
};

export default function SystemHealth() {
  const [tab, setTab] = useState<'status' | 'logs' | 'update'>('status');
  const [info, setInfo] = useState<HealthInfo | null>(null);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Logs state
  const [logs, setLogs] = useState<any[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logLevel, setLogLevel] = useState('');

  // Update state
  const [upd, setUpd] = useState<UpdateState>({ phase: 'idle', logs: [] });
  const [updBusy, setUpdBusy] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logBoxRef = useRef<HTMLDivElement | null>(null);

  // Restart state
  type RestartState = 'idle' | 'confirming' | 'restarting' | 'done' | 'error';
  const [restartState, setRestartState] = useState<RestartState>('idle');
  const restartPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Startup state
  const [startupStatus, setStartupStatus] = useState<{ configured: boolean } | null>(null);
  const [startupLoading, setStartupLoading] = useState(false);
  const [startupResult, setStartupResult] = useState<{ ok: boolean; message: string; command?: string } | null>(null);

  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [version, setVersion] = useState<string>('1.0.0');

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  const handleRestart = async () => {
    setRestartState('restarting');
    try { await api.post('/admin/restart'); } catch { /* server may restart before response */ }
    let attempts = 0;
    restartPollRef.current = setInterval(async () => {
      try {
        await api.get('/admin/health');
        clearInterval(restartPollRef.current!); restartPollRef.current = null;
        setRestartState('done');
        load();
      } catch {
        if (++attempts > 30) {
          clearInterval(restartPollRef.current!); restartPollRef.current = null;
          setRestartState('error');
        }
      }
    }, 2000);
  };

  const loadStartupStatus = async () => {
    try { const r = await api.get('/admin/startup-status'); setStartupStatus(r.data); } catch { /* ignore */ }
  };

  const handleSetupStartup = async () => {
    setStartupLoading(true); setStartupResult(null);
    try {
      const r = await api.post('/admin/setup-startup');
      setStartupResult(r.data);
      if (r.data.ok) setStartupStatus({ configured: true });
    } catch (err: any) {
      setStartupResult({ ok: false, message: err.response?.data?.error || 'Lỗi kết nối' });
    } finally { setStartupLoading(false); }
  };

  const fetchUpdState = async (): Promise<boolean> => {
    try {
      const r = await api.get('/admin/update/state');
      setUpd(r.data);
      setRestarting(false);
      if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
      const done = ['idle', 'up_to_date', 'update_available', 'success', 'error'].includes(r.data.phase);
      return done;
    } catch {
      // Server restarting after deploy
      setRestarting(true);
      return false;
    }
  };

  const startPoll = () => {
    stopPoll();
    pollRef.current = setInterval(async () => {
      const done = await fetchUpdState();
      if (done) stopPoll();
    }, 2000);
  };

  const handleCheck = async () => {
    setUpdBusy(true);
    try {
      await api.post('/admin/update/check');
      const r = await api.get('/admin/update/state');
      setUpd(r.data);
    } catch (err: any) {
      setUpd(prev => ({ ...prev, phase: 'error', error: err.response?.data?.error || 'Lỗi kết nối' }));
    } finally { setUpdBusy(false); }
  };

  const handleUpdate = async () => {
    setUpdBusy(true);
    try {
      await api.post('/admin/update/start');
      setUpd(prev => ({ ...prev, phase: 'updating', logs: [] }));
      startPoll();
    } catch (err: any) {
      setUpd(prev => ({ ...prev, phase: 'error', error: err.response?.data?.error || 'Lỗi kết nối' }));
    } finally { setUpdBusy(false); }
  };

  useEffect(() => {
    if (tab === 'update') fetchUpdState();
    if (tab === 'status') loadStartupStatus();
    return () => { if (tab !== 'update') stopPoll(); };
  }, [tab]);

  useEffect(() => () => {
    stopPoll();
    if (restartPollRef.current) clearInterval(restartPollRef.current);
  }, []);

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const params: any = { limit: 100 };
      if (logLevel) params.level = logLevel;
      const r = await api.get('/logs', { params });
      setLogs(r.data.rows);
      setLogsTotal(r.data.total);
    } catch { /* ignore */ }
    finally { setLogsLoading(false); }
  };

  const load = async () => {
    try {
      const [healthRes, onlineRes, verRes] = await Promise.all([
        api.get('/admin/health'),
        api.get('/admin/online-users'),
        api.get('/admin/version'),
      ]);
      setInfo(healthRes.data);
      setOnlineUsers(onlineRes.data);
      if (verRes.data?.version) setVersion(verRes.data.version);
      setLastRefresh(new Date());
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Không thể kết nối server');
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000); // refresh mỗi 10 giây
    return () => clearInterval(id);
  }, []);

  useEffect(() => { if (tab === 'logs') loadLogs(); }, [tab, logLevel]);

  const ramRatio  = info ? info.ram.used / info.ram.total : 0;
  const diskRatio = info && info.disk ? info.disk.used / info.disk.total : 0;
  const isHealthy = info !== null && ramRatio < 0.9 && (diskRatio === 0 || diskRatio < 0.9);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Trạng thái hệ thống</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {tab === 'status' && lastRefresh && (
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              Cập nhật: {lastRefresh.toLocaleTimeString('vi-VN')}
            </span>
          )}
          {tab === 'status' && <button className="btn ghost btn-sm" onClick={load}>↻ Làm mới</button>}
          {tab === 'logs'   && <button className="btn ghost btn-sm" onClick={loadLogs}>↻ Tải lại</button>}
          {tab === 'update' && <button className="btn ghost btn-sm" onClick={fetchUpdState}>↻ Làm mới</button>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className={`btn ${tab === 'status' ? 'cyan' : 'ghost'}`} style={{ flex: '1 1 auto', borderRadius: 4 }} onClick={() => setTab('status')}>
          📡 Trạng thái server
        </button>
        <button className={`btn ${tab === 'logs' ? 'cyan' : 'ghost'}`} style={{ flex: '1 1 auto', borderRadius: 4 }} onClick={() => setTab('logs')}>
          📋 Log hệ thống
          {logsTotal > 0 && <span className="c-dim" style={{ fontSize: 10, marginLeft: 6 }}>({logsTotal})</span>}
        </button>
        <button className={`btn ${tab === 'update' ? 'cyan' : 'ghost'}`} style={{ flex: '1 1 auto', borderRadius: 4 }} onClick={() => setTab('update')}>
          🔄 Cập nhật
          {upd.phase === 'update_available' && upd.commitsBehind && upd.commitsBehind > 0 && (
            <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--yellow)' }}>+{upd.commitsBehind}</span>
          )}
        </button>
      </div>

      {tab === 'status' && (
        <>
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(255,0,85,0.08)', border: '1px solid rgba(255,0,85,0.3)', borderRadius: 4, color: 'var(--red)', fontSize: 12, marginBottom: 16 }}>
          ✗ {error}
        </div>
      )}

      {/* Status banner */}
      <div className="form-panel mb-16" style={{ padding: '14px 18px', borderColor: isHealthy ? 'rgba(0,200,140,0.25)' : 'rgba(255,170,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusDot ok={isHealthy} />
          <div style={{ fontSize: 14, fontWeight: 700, color: isHealthy ? 'var(--green)' : 'var(--yellow)' }}>
            {info === null ? 'Đang kết nối...' : isHealthy ? 'HOẠT ĐỘNG BÌNH THƯỜNG' : 'CẦN CHÚ Ý'}
          </div>
          {info && (
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cyan)' }}>{fmtUptime(info.uptime)}</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: 1, textTransform: 'uppercase' }}>Uptime</div>
            </div>
          )}
        </div>
        {info && (
          <div style={{ display: 'flex', gap: '6px 24px', flexWrap: 'wrap', marginTop: 10, fontSize: 11 }}>
            <span><span className="c-dim">Host: </span><span className="c-bright">{info.hostname}</span></span>
            <span><span className="c-dim">OS: </span><span className="c-bright">{info.platform}/{info.arch}</span></span>
            <span><span className="c-dim">Node: </span><span className="c-bright">{info.nodeVersion}</span></span>
            <span><span className="c-dim">Version: </span><span className="c-bright">v{version}</span></span>
            <span><span className="c-dim">CPU: </span><span className="c-bright">{info.cpu.cores} cores</span></span>
          </div>
        )}
      </div>

      {info && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>

          {/* RAM */}
          <div className="form-panel" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 14, letterSpacing: 1, textTransform: 'uppercase' }}>
              🧠 Bộ nhớ RAM
            </div>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: statusColor(ramRatio) }}>
                {Math.round(ramRatio * 100)}%
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>đang sử dụng</div>
            </div>
            <BarStat label="RAM đã dùng" used={info.ram.used} total={info.ram.total} color={statusColor(ramRatio)} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
              <span className="c-dim">Còn trống</span>
              <span className="c-green fw7">{fmtBytes(info.ram.free)}</span>
            </div>
          </div>

          {/* CPU */}
          <div className="form-panel" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 14, letterSpacing: 1, textTransform: 'uppercase' }}>
              ⚡ CPU
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-bright)', marginBottom: 12, lineHeight: 1.6 }}>
              {info.cpu.model}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 12 }}>
              <span className="c-dim">Số nhân</span>
              <span className="c-cyan fw7">{info.cpu.cores} cores</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Load Average</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['1m', '5m', '15m'].map((label, i) => (
                <div key={label} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', background: 'rgba(0,245,255,0.04)', borderRadius: 4, border: '1px solid var(--border-dim)' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--cyan)' }}>{info.cpu.loadavg[i].toFixed(2)}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Disk */}
          <div className="form-panel" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 14, letterSpacing: 1, textTransform: 'uppercase' }}>
              💾 Lưu trữ
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 10 }}>
              <span className="c-dim">Database (.db)</span>
              <span className="c-cyan fw7">{fmtBytes(info.dbSize)}</span>
            </div>
            {info.disk ? (
              <>
                <BarStat label="Ổ đĩa" used={info.disk.used} total={info.disk.total} color={statusColor(diskRatio)} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
                  <span className="c-dim">Còn trống</span>
                  <span className="c-green fw7">{fmtBytes(info.disk.free)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
                  <span className="c-dim">Tổng dung lượng</span>
                  <span className="c-bright">{fmtBytes(info.disk.total)}</span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>
                Thông tin ổ đĩa không khả dụng trên nền tảng này.
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── Online users ── */}
      <div className="form-panel" style={{ padding: '16px 18px', marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: 1, textTransform: 'uppercase' }}>
            👥 Nhân sự đang online
          </div>
          <span style={{
            marginLeft: 8, padding: '2px 10px', borderRadius: 20,
            background: onlineUsers.length > 0 ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${onlineUsers.length > 0 ? 'rgba(0,255,136,0.35)' : 'rgba(255,255,255,0.08)'}`,
            fontSize: 12, fontWeight: 700,
            color: onlineUsers.length > 0 ? 'var(--green)' : 'var(--text-dim)',
          }}>
            {onlineUsers.length}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 4 }}>
            (hoạt động trong 5 phút gần nhất)
          </span>
        </div>

        {onlineUsers.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>
            Không có ai đang hoạt động.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {onlineUsers.map((u) => {
              const secsAgo = Math.floor((Date.now() - u.at) / 1000);
              const ago = secsAgo < 60 ? `${secsAgo}s trước` : `${Math.floor(secsAgo / 60)}m trước`;
              return (
                <div key={u.userId} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 10px', borderRadius: 4,
                  background: 'rgba(0,245,255,0.03)', border: '1px solid rgba(0,245,255,0.08)',
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--green)', boxShadow: '0 0 6px var(--green)',
                    display: 'inline-block',
                  }} />
                  <span style={{ fontWeight: 700, color: u.role === 'admin' ? 'var(--cyan)' : 'var(--text-bright)', fontSize: 13, minWidth: 120 }}>
                    {u.name}
                  </span>
                  <span className="tag" style={{
                    fontSize: 9, padding: '1px 6px',
                    background: u.role === 'admin' ? 'rgba(0,245,255,0.1)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${u.role === 'admin' ? 'rgba(0,245,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    color: u.role === 'admin' ? 'var(--cyan)' : 'var(--text-dim)',
                    borderRadius: 3, textTransform: 'uppercase', letterSpacing: 1,
                  }}>
                    {u.role === 'admin' ? 'admin' : 'nhân viên'}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'monospace', marginLeft: 'auto' }}>
                    {u.ip}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                    {ago}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Auto-refresh note */}
      <div style={{ marginTop: 20, fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', letterSpacing: 1 }}>
        ◆ Tự động làm mới mỗi 10 giây
      </div>

      {/* ── Server Controls ── */}
      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>

        {/* Restart panel */}
        <div className="form-panel" style={{ padding: '16px 18px', borderColor: 'rgba(255,0,85,0.25)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
            🔄 Khởi động lại server
          </div>
          {restartState === 'idle' && (
            <button className="btn red btn-sm" onClick={() => setRestartState('confirming')}>Khởi động lại ngay</button>
          )}
          {restartState === 'confirming' && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--yellow)', marginBottom: 10 }}>⚠ Server sẽ ngắt kết nối vài giây. Xác nhận?</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn red btn-sm" onClick={handleRestart}>Xác nhận</button>
                <button className="btn ghost btn-sm" onClick={() => setRestartState('idle')}>Hủy</button>
              </div>
            </div>
          )}
          {restartState === 'restarting' && (
            <div style={{ fontSize: 12, color: 'var(--yellow)' }}>⟳ Đang khởi động lại...</div>
          )}
          {restartState === 'done' && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--green)', marginBottom: 8 }}>✔ Server đã khởi động lại thành công.</div>
              <button className="btn ghost btn-sm" onClick={() => setRestartState('idle')}>OK</button>
            </div>
          )}
          {restartState === 'error' && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>✗ Không thể kết nối lại sau 60 giây.</div>
              <button className="btn ghost btn-sm" onClick={() => setRestartState('idle')}>OK</button>
            </div>
          )}
        </div>

        {/* Auto-start panel */}
        <div className="form-panel" style={{ padding: '16px 18px', borderColor: startupStatus?.configured ? 'rgba(0,255,136,0.25)' : 'rgba(255,204,0,0.25)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
            ⚡ Tự động khởi động sau cúp điện
          </div>
          {!startupStatus ? (
            <div className="c-dim" style={{ fontSize: 11 }}>Đang kiểm tra...</div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <StatusDot ok={startupStatus.configured} />
                <span style={{ fontSize: 12, color: startupStatus.configured ? 'var(--green)' : 'var(--yellow)' }}>
                  {startupStatus.configured ? 'Đã cấu hình — tự động bật khi có điện' : 'Chưa cấu hình'}
                </span>
              </div>
              <button
                className={`btn ${startupStatus.configured ? 'ghost' : 'yellow'} btn-sm`}
                onClick={handleSetupStartup}
                disabled={startupLoading}
              >
                {startupLoading ? '...' : startupStatus.configured ? '↻ Lưu lại danh sách tiến trình' : '⚡ Thiết lập tự động khởi động'}
              </button>
              {startupResult && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: startupResult.ok ? 'var(--green)' : 'var(--yellow)' }}>
                    {startupResult.message}
                  </div>
                  {startupResult.command && (
                    <pre style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 10, background: 'rgba(0,0,0,0.4)', padding: '8px 10px', borderRadius: 4, border: '1px solid rgba(0,245,255,0.15)', overflowX: 'auto', color: 'var(--cyan)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {startupResult.command}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
        </>
      )}

      {tab === 'logs' && (
        <div>
          {/* Level filter */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {(['', 'info', 'warning', 'error', 'critical'] as const).map((lv) => (
              <button key={lv} className={`btn ${logLevel === lv ? 'cyan' : 'ghost'} btn-sm`} onClick={() => setLogLevel(lv)}>
                {lv === '' ? 'Tất cả' : lv === 'info' ? 'Info' : lv === 'warning' ? '⚠ Warning' : lv === 'error' ? '✗ Error' : '🔴 Critical'}
              </button>
            ))}
          </div>

          {logsLoading ? (
            <div className="c-dim" style={{ fontSize: 12 }}>Đang tải...</div>
          ) : logs.length === 0 ? (
            <div className="c-dim" style={{ fontSize: 12, padding: '20px 0' }}>Không có log nào.</div>
          ) : (
            <div className="table-wrap" style={{ maxHeight: 520 }}>
              <table className="nt">
                <thead><tr><th>Level</th><th>Thời gian</th><th>Nguồn</th><th>Nội dung</th></tr></thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td><span style={{ fontSize: 10, fontWeight: 700, color: LEVEL_COLOR[log.level] || 'var(--cyan)', textTransform: 'uppercase', letterSpacing: 1 }}>{log.level}</span></td>
                      <td className="c-dim" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{new Date(log.createdAt).toLocaleString('vi-VN')}</td>
                      <td style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{log.source || '—'}</td>
                      <td style={{ fontSize: 11, maxWidth: 500, wordBreak: 'break-word' }}>{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 8 }}>Hiển thị 100 bản ghi gần nhất · Tổng: {logsTotal}</div>
        </div>
      )}

      {tab === 'update' && (
        <div>
          {/* Status banner */}
          {(() => {
            const phaseLabel: Record<UpdatePhase, string> = {
              idle: 'Chưa kiểm tra',
              checking: 'Đang kiểm tra...',
              up_to_date: '✔ Đã là phiên bản mới nhất',
              update_available: '⬆ Có phiên bản mới',
              updating: '⏳ Đang cập nhật...',
              success: '✔ Cập nhật hoàn tất',
              error: '✗ Lỗi',
            };
            const phaseColor: Record<UpdatePhase, string> = {
              idle: 'var(--text-dim)',
              checking: 'var(--cyan)',
              up_to_date: 'var(--green)',
              update_available: 'var(--yellow)',
              updating: 'var(--cyan)',
              success: 'var(--green)',
              error: 'var(--red)',
            };
            return (
              <div className="form-panel mb-16" style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: phaseColor[upd.phase] }}>
                    {phaseLabel[upd.phase]}
                  </div>
                  {restarting && (
                    <span style={{ fontSize: 11, color: 'var(--yellow)' }}>⟳ Đang khởi động lại server...</span>
                  )}
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      className="btn cyan btn-sm"
                      onClick={handleCheck}
                      disabled={updBusy || upd.phase === 'checking' || upd.phase === 'updating'}
                    >
                      {upd.phase === 'checking' ? '...' : '🔍 Kiểm tra cập nhật'}
                    </button>
                    {upd.phase === 'update_available' && (
                      <button
                        className="btn yellow btn-sm"
                        onClick={handleUpdate}
                        disabled={updBusy || upd.ciStatus === 'failing' || upd.ciStatus === 'pending'}
                        title={
                          upd.ciStatus === 'failing'
                            ? `CI/CD cho commit ${upd.ciStatusSha ?? ''} đang FAIL — không thể cập nhật`
                            : upd.ciStatus === 'pending'
                            ? `CI/CD cho commit ${upd.ciStatusSha ?? ''} đang chạy — chờ hoàn tất`
                            : undefined
                        }
                      >
                        ⬆ Cập nhật ngay
                      </button>
                    )}
                  </div>
                </div>

                {(upd.currentCommit || upd.remoteCommit || upd.ciStatus) && (
                  <div style={{ display: 'flex', gap: '6px 24px', flexWrap: 'wrap', marginTop: 10, fontSize: 11 }}>
                    {upd.currentCommit && (
                      <span>
                        <span className="c-dim">Hiện tại: </span>
                        <span style={{ fontFamily: 'monospace', color: 'var(--cyan)' }}>{upd.currentCommit}</span>
                      </span>
                    )}
                    {upd.remoteCommit && (
                      <span><span className="c-dim">Mới nhất: </span><span style={{ fontFamily: 'monospace', color: 'var(--green)' }}>{upd.remoteCommit}</span></span>
                    )}
                    {upd.commitsBehind !== undefined && upd.commitsBehind > 0 && (
                      <span><span className="c-dim">Chậm hơn: </span><span style={{ color: 'var(--yellow)', fontWeight: 700 }}>{upd.commitsBehind} commit</span></span>
                    )}
                    {upd.ciStatus && (
                      <span>
                        <span className="c-dim">CI/CD: </span>
                        {upd.ciStatus === 'passing' && (
                          <span className="tag green" style={{ fontSize: 10 }}>PASSING ✓</span>
                        )}
                        {upd.ciStatus === 'failing' && (
                          <span className="tag red" style={{ fontSize: 10 }}>FAILING ✗</span>
                        )}
                        {upd.ciStatus === 'pending' && (
                          <span className="tag cyan" style={{ fontSize: 10 }}>RUNNING ⟳</span>
                        )}
                        {upd.ciStatus === 'unknown' && (
                          <span className="tag yellow" style={{ fontSize: 10 }}>UNKNOWN ?</span>
                        )}
                        {upd.ciStatusSha && (
                          <span className="c-dim" style={{ marginLeft: 4, fontFamily: 'monospace' }}>
                            @ {upd.ciStatusSha}
                          </span>
                        )}
                      </span>
                    )}
                    {upd.checkedAt && (
                      <span className="c-dim" style={{ marginLeft: 'auto' }}>
                        Kiểm tra lúc: {new Date(upd.checkedAt).toLocaleTimeString('vi-VN')}
                      </span>
                    )}
                  </div>
                )}

                {/* Full message of current commit */}
                {upd.currentMessage && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                      📌 Commit hiện tại:
                    </div>
                    <pre
                      style={{
                        margin: 0, fontFamily: "ui-monospace, 'JetBrains Mono', 'Cascadia Code', 'Fira Code', SFMono-Regular, Menlo, Consolas, monospace", fontSize: 11.5, lineHeight: 1.65,
                        color: 'var(--text-bright)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(0,245,255,0.08)',
                        borderRadius: 4, padding: '8px 12px',
                      }}
                    >
                      {upd.currentMessage}
                    </pre>
                  </div>
                )}

                {/* New commits list — hiển thị đầy đủ nội dung mỗi commit */}
                {upd.newCommits && upd.newCommits.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                      📝 {upd.newCommits.length} thay đổi mới:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {upd.newCommits.map((c, i) => (
                        <pre
                          key={i}
                          style={{
                            margin: 0, fontFamily: "ui-monospace, 'JetBrains Mono', 'Cascadia Code', 'Fira Code', SFMono-Regular, Menlo, Consolas, monospace", fontSize: 11.5, lineHeight: 1.65,
                            color: 'var(--text-bright)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            background: 'rgba(0,0,0,0.25)',
                            borderLeft: '2px solid var(--cyan)',
                            borderRadius: 4, padding: '8px 12px',
                          }}
                        >
                          {c}
                        </pre>
                      ))}
                    </div>
                  </div>
                )}

                {upd.phase === 'error' && upd.error && (
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--red)' }}>✗ {upd.error}</div>
                )}
              </div>
            );
          })()}

          {/* Live log */}
          {(upd.logs ?? []).length > 0 && (
            <div className="form-panel" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' }}>
                📄 Log cập nhật
              </div>
              <div
                ref={logBoxRef}
                className="update-log-box"
                style={{
                  maxHeight: 360, overflowY: 'auto',
                  background: 'rgba(0,0,0,0.3)', borderRadius: 4, padding: '10px 12px',
                  border: '1px solid rgba(0,245,255,0.08)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere',
                }}
              >
                {(upd.logs ?? []).map((line, i) => {
                  const isErr = /error|fail|✗|exit [^0]/i.test(line);
                  const isOk  = /✔|success|hoàn tất|xong/i.test(line);
                  const color = isErr ? 'var(--red)' : isOk ? 'var(--green)' : 'var(--text-bright)';
                  return (
                    <div key={i} style={{ color }}>{line}</div>
                  );
                })}
                {(upd.phase === 'updating' || restarting) && (
                  <div style={{ color: 'var(--cyan)', animation: 'blink 1s step-end infinite' }}>▋</div>
                )}
              </div>
            </div>
          )}

          {upd.phase === 'idle' && (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8, fontStyle: 'italic' }}>
              Nhấn "Kiểm tra cập nhật" để so sánh với branch master trên GitHub.
            </div>
          )}
          {upd.phase === 'success' && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--green)' }}>
              ✔ Hệ thống đã được cập nhật và khởi động lại thành công.
            </div>
          )}

          <div style={{ marginTop: 16, fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>
            * Tính năng cập nhật chỉ hoạt động trên Linux / Raspberry Pi. Windows chỉ có thể kiểm tra phiên bản.
          </div>
        </div>
      )}
    </div>
  );
}
