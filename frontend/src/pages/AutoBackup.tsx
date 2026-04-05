import { useEffect, useRef, useState } from 'react';
import type { AxiosProgressEvent } from 'axios';
import api from '../api';
import { toast } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

const SCHEDULE_PRESETS = [
  { label: 'Hàng giờ',              value: '0 * * * *'   },
  { label: 'Mỗi 6 tiếng',           value: '0 */6 * * *' },
  { label: 'Hàng ngày lúc 02:00',   value: '0 2 * * *'   },
  { label: 'Hàng ngày lúc 22:00',   value: '0 22 * * *'  },
  { label: 'Hàng tuần (T2 02:00)',  value: '0 2 * * 1'   },
  { label: 'Tuỳ chỉnh (cron)',       value: '__custom__'  },
];

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 ** 2).toFixed(2)} MB`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('vi-VN');
}

type BackupFile = { filename: string; size: number; createdAt: string; encrypted: boolean };
type Config = {
  enabled: boolean; schedule: string; keepCount: number;
  encrypt: boolean; password: string;
};

export default function AutoBackup() {
  const [, setConfig] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [runBusy, setRunBusy] = useState(false);

  // Form state
  const [enabled, setEnabled]       = useState(false);
  const [presetKey, setPresetKey]   = useState('0 2 * * *');
  const [customCron, setCustomCron] = useState('');
  const [keepCount, setKeepCount]   = useState(7);
  const [encrypt, setEncrypt]       = useState(false);
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);

  // Download with password
  const [dlPassword, setDlPassword]   = useState('');
  const [dlEncrypt, setDlEncrypt]     = useState(false);
  const [showDlPass, setShowDlPass]   = useState(false);
  const [dlBusy, setDlBusy]           = useState(false);

  // Restore
  const restoreRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring]         = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restorePassword, setRestorePassword] = useState('');
  const [showRestorePass, setShowRestorePass] = useState(false);

  const doRestore = async (file: File) => {
    if (!file.name.endsWith('.db') && !file.name.endsWith('.db.enc')) {
      toast.error('Chỉ chấp nhận file .db hoặc .db.enc');
      return;
    }
    const formData = new FormData();
    formData.append('db', file);
    if (restorePassword) formData.append('restorePassword', restorePassword);
    setRestoring(true); setRestoreProgress(0);
    try {
      await api.post('/admin/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e: AxiosProgressEvent) => {
          if (e.total) setRestoreProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      toast.success('Khôi phục thành công! Vui lòng tải lại trang để áp dụng dữ liệu mới.');
      loadFiles();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Lỗi khi restore');
    } finally {
      setRestoring(false); setRestoreProgress(0);
      if (restoreRef.current) restoreRef.current.value = '';
    }
  };

  // History
  const [files, setFiles]               = useState<BackupFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [confirmDel, setConfirmDel]     = useState<BackupFile | null>(null);

  const loadConfig = async () => {
    const r = await api.get('/backup/config');
    const cfg: Config = r.data;
    setConfig(cfg);
    setEnabled(cfg.enabled);
    setKeepCount(cfg.keepCount);
    setEncrypt(cfg.encrypt);
    setPassword(cfg.password || '');
    // Detect preset vs custom
    const preset = SCHEDULE_PRESETS.find((p) => p.value === cfg.schedule && p.value !== '__custom__');
    if (preset) { setPresetKey(cfg.schedule); }
    else { setPresetKey('__custom__'); setCustomCron(cfg.schedule); }
  };

  const loadFiles = async () => {
    setFilesLoading(true);
    try {
      const r = await api.get('/backup/list');
      setFiles(r.data);
    } finally {
      setFilesLoading(false);
    }
  };

  useEffect(() => {
    loadConfig().catch(() => {});
    loadFiles();
  }, []);

  const activeCron = presetKey === '__custom__' ? customCron : presetKey;

  const saveConfig = async () => {
    if (!activeCron) { toast.error('Chưa nhập lịch cron'); return; }
    setSaving(true);
    try {
      await api.post('/backup/config', {
        enabled, schedule: activeCron, keepCount,
        encrypt, password: password !== '••••••' ? password : undefined,
      });
      toast.success('Đã lưu cấu hình auto backup');
      loadConfig();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Lỗi lưu cấu hình');
    } finally { setSaving(false); }
  };

  const runNow = async () => {
    setRunBusy(true);
    try {
      const r = await api.post('/backup/run');
      toast.success(`Backup thủ công thành công: ${r.data.filename}`);
      loadFiles();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Backup thất bại');
    } finally { setRunBusy(false); }
  };

  const doDownload = async () => {
    setDlBusy(true);
    try {
      const params: any = {};
      if (dlEncrypt && dlPassword) params.password = dlPassword;
      const r = await api.get('/admin/backup', { responseType: 'blob', params });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = dlEncrypt && dlPassword ? `backup-ke-toan-${date}.db.enc` : `backup-ke-toan-${date}.db`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Lỗi tải backup');
    } finally { setDlBusy(false); }
  };

  const doDeleteFile = async (f: BackupFile) => {
    try {
      await api.delete(`/backup/files/${encodeURIComponent(f.filename)}`);
      toast.success('Đã xoá file backup');
      setConfirmDel(null);
      loadFiles();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Lỗi xoá file');
    }
  };

  const downloadSavedFile = async (f: BackupFile) => {
    try {
      const r = await api.get(`/backup/files/${encodeURIComponent(f.filename)}`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url; a.download = f.filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error('Lỗi tải file');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Cài đặt Backup</h1>
        <button className="btn green btn-sm" onClick={runNow} disabled={runBusy}>
          {runBusy ? '⏳ Đang backup...' : '▶ Backup ngay'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
        {/* ── Panel: Tải backup thủ công ── */}
        <div className="form-panel" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
            ⬇ Tải backup ngay
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
            Tải về file database SQLite. Có thể mã hoá AES-256-GCM trước khi tải.
          </div>

          <label className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={dlEncrypt} onChange={(e) => setDlEncrypt(e.target.checked)} />
            <span>Mã hoá file trước khi tải (.db.enc)</span>
          </label>

          {dlEncrypt && (
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <input
                className="inp"
                type={showDlPass ? 'text' : 'password'}
                placeholder="Mật khẩu mã hoá..."
                value={dlPassword}
                onChange={(e) => setDlPassword(e.target.value)}
                style={{ marginBottom: 0, paddingRight: 36 }}
              />
              <button type="button" onClick={() => setShowDlPass((v) => !v)}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 14 }}>
                {showDlPass ? '🙈' : '👁'}
              </button>
            </div>
          )}

          <button className="btn cyan btn-sm" onClick={doDownload} disabled={dlBusy || (dlEncrypt && !dlPassword)}>
            {dlBusy ? '⏳...' : `⬇ Tải backup${dlEncrypt ? ' (mã hoá)' : ''}`}
          </button>
          {dlEncrypt && !dlPassword && (
            <div style={{ fontSize: 10, color: 'var(--yellow)', marginTop: 6 }}>⚠ Nhập mật khẩu để mã hoá</div>
          )}
        </div>

        {/* ── Panel: Khôi phục dữ liệu ── */}
        <div className="form-panel" style={{ padding: '16px 18px', border: '1px solid rgba(255,170,0,0.25)', background: 'rgba(255,170,0,0.03)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
            ⬆ Khôi phục dữ liệu
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>
            Upload file <code style={{ fontSize: 11 }}>.db</code> hoặc <code style={{ fontSize: 11 }}>.db.enc</code> để khôi phục — database hiện tại sẽ bị ghi đè.
          </div>
          <div style={{ fontSize: 10, color: 'var(--yellow)', marginBottom: 10 }}>
            ⚠ Server cần khởi động lại sau khi restore để áp dụng đầy đủ.
          </div>

          <div style={{ position: 'relative', marginBottom: 8 }}>
            <input
              className="inp"
              type={showRestorePass ? 'text' : 'password'}
              placeholder="Mật khẩu (nếu file mã hoá .enc)"
              value={restorePassword}
              onChange={(e) => setRestorePassword(e.target.value)}
              style={{ marginBottom: 0, paddingRight: 36 }}
            />
            <button type="button" onClick={() => setShowRestorePass((v) => !v)}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 14 }}>
              {showRestorePass ? '🙈' : '👁'}
            </button>
          </div>

          <input ref={restoreRef} type="file" accept=".db,.enc" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) doRestore(f); }} />
          <button className="btn yellow btn-sm" disabled={restoring} onClick={() => restoreRef.current?.click()}>
            {restoring ? `⏳ Đang upload... ${restoreProgress}%` : '⬆ Chọn file để restore'}
          </button>
          {restoring && (
            <div style={{ marginTop: 8, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${restoreProgress}%`, background: 'var(--yellow)', transition: 'width 0.2s' }} />
            </div>
          )}
        </div>

        {/* ── Panel: Auto backup config ── */}
        <div className="form-panel" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
            🕐 Auto Backup tự động
          </div>

          {/* Toggle enabled */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, cursor: 'pointer' }}>
            <div
              onClick={() => setEnabled((v) => !v)}
              style={{
                width: 40, height: 22, borderRadius: 11, cursor: 'pointer', transition: 'background 0.2s',
                background: enabled ? 'var(--cyan)' : 'rgba(255,255,255,0.12)',
                position: 'relative', flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: enabled ? 21 : 3,
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s',
              }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: enabled ? 'var(--cyan)' : 'var(--text-dim)' }}>
              {enabled ? 'Đang bật' : 'Đang tắt'}
            </span>
          </label>

          {/* Lịch */}
          <label className="lbl">Lịch backup</label>
          <select className="inp" value={presetKey} onChange={(e) => setPresetKey(e.target.value)} style={{ marginBottom: 6 }}>
            {SCHEDULE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {presetKey === '__custom__' && (
            <input className="inp" placeholder="vd: 0 2 * * *" value={customCron}
              onChange={(e) => setCustomCron(e.target.value)} style={{ marginBottom: 6, fontFamily: 'monospace', fontSize: 12 }} />
          )}
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 10 }}>
            Cron: <code style={{ color: 'var(--cyan)' }}>{activeCron || '—'}</code>
          </div>

          {/* Giữ bao nhiêu bản */}
          <label className="lbl">Giữ tối đa</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <input className="inp" type="number" min={1} max={30} value={keepCount}
              onChange={(e) => setKeepCount(Number(e.target.value))}
              style={{ width: 70, marginBottom: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>file backup gần nhất</span>
          </div>

          {/* Mã hoá */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 12 }}>
            <input type="checkbox" checked={encrypt} onChange={(e) => setEncrypt(e.target.checked)} />
            Mã hoá file backup (AES-256-GCM)
          </label>
          {encrypt && (
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <input
                className="inp"
                type={showPass ? 'text' : 'password'}
                placeholder="Mật khẩu mã hoá..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ marginBottom: 0, paddingRight: 36 }}
              />
              <button type="button" onClick={() => setShowPass((v) => !v)}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 14 }}>
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          )}

          <button className="btn cyan btn-sm" onClick={saveConfig} disabled={saving}>
            {saving ? '⏳ Đang lưu...' : '[ Lưu cấu hình ]'}
          </button>
        </div>
      </div>

      {/* ── Lịch sử backup tự động ── */}
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' }}>
        📁 Lịch sử file backup ({files.length})
      </div>
      <div className="table-wrap" style={{ maxHeight: 380 }}>
        <table className="nt">
          <thead><tr>
            <th>Tên file</th><th>Kích thước</th><th>Thời gian</th><th>Loại</th><th></th>
          </tr></thead>
          <tbody>
            {filesLoading && [1,2,3].map((i) => (
              <tr key={i}><td colSpan={5}><div className="skeleton w-full" style={{ height: 14 }} /></td></tr>
            ))}
            {!filesLoading && files.length === 0 && (
              <tr className="empty-row"><td colSpan={5}>Chưa có file backup nào được lưu</td></tr>
            )}
            {!filesLoading && files.map((f) => (
              <tr key={f.filename}>
                <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{f.filename}</td>
                <td className="c-dim" style={{ fontSize: 11 }}>{fmtBytes(f.size)}</td>
                <td className="c-dim" style={{ fontSize: 11 }}>{fmtDate(f.createdAt)}</td>
                <td>
                  {f.encrypted
                    ? <span className="tag yellow" style={{ fontSize: 9 }}>🔐 Mã hoá</span>
                    : <span className="tag cyan"   style={{ fontSize: 9 }}>📄 Không mã hoá</span>}
                </td>
                <td><div className="td-act">
                  <button className="btn ghost btn-sm" onClick={() => downloadSavedFile(f)} title="Tải về">⬇</button>
                  <button className="btn ghost btn-sm" style={{ color: 'var(--red)', opacity: 0.7 }}
                    onClick={() => setConfirmDel(f)} title="Xoá">🗑</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.6 }}>
        📂 File lưu tại: <code style={{ color: 'var(--cyan)', fontSize: 10 }}>backend/backups/</code>
        {' · '}
        File <code style={{ fontSize: 10 }}>.db.enc</code> cần mật khẩu để restore
      </div>

      {confirmDel && (
        <ConfirmModal
          title="Xoá file backup"
          message={`Xoá "${confirmDel.filename}" khỏi server?`}
          confirmLabel="Xoá file"
          onConfirm={() => doDeleteFile(confirmDel)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}
