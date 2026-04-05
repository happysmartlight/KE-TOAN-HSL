import { useEffect, useState } from 'react';
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

export default function SystemHealth() {
  const [tab, setTab] = useState<'status' | 'logs'>('status');
  const [info, setInfo] = useState<HealthInfo | null>(null);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Logs state
  const [logs, setLogs] = useState<any[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logLevel, setLogLevel] = useState('');

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
      const r = await api.get('/admin/health');
      setInfo(r.data);
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
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        <button className={`btn ${tab === 'status' ? 'cyan' : 'ghost'}`} style={{ borderRadius: '4px 0 0 4px' }} onClick={() => setTab('status')}>
          📡 Trạng thái server
        </button>
        <button className={`btn ${tab === 'logs' ? 'cyan' : 'ghost'}`} style={{ borderRadius: '0 4px 4px 0' }} onClick={() => setTab('logs')}>
          📋 Log hệ thống
          {logsTotal > 0 && <span className="c-dim" style={{ fontSize: 10, marginLeft: 6 }}>({logsTotal})</span>}
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

      {/* Auto-refresh note */}
      <div style={{ marginTop: 20, fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', letterSpacing: 1 }}>
        ◆ Tự động làm mới mỗi 10 giây
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
    </div>
  );
}
