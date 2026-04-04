import { useEffect, useState, useMemo } from 'react';
import api from '../api';

const LEVEL_META: Record<string, { label: string; cls: string; color: string }> = {
  info:     { label: 'Info',     cls: 'cyan',    color: '#00f5ff' },
  warning:  { label: 'Warning',  cls: 'yellow',  color: '#ffcc00' },
  error:    { label: 'Error',    cls: 'red',     color: '#ff3366' },
  critical: { label: 'Critical', cls: 'purple',  color: '#bf00ff' },
};

const fmtTime = (d: string) => {
  const dt = new Date(d);
  return dt.toLocaleString('vi-VN', { hour12: false });
};

export default function Logs() {
  const [rows, setRows]     = useState<any[]>([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);

  const [search,   setSearch]   = useState('');
  const [level,    setLevel]    = useState('');
  const [from,     setFrom]     = useState('');
  const [to,       setTo]       = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 300 };
      if (search) params.search = search;
      if (level)  params.level  = level;
      if (from)   params.from   = from;
      if (to)     params.to     = to;
      const r = await api.get('/logs', { params });
      setRows(r.data.rows);
      setTotal(r.data.total);
    } catch {
      // ignore
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, level, from, to]);

  const activeFilters = [level, from, to].filter(Boolean).length;

  const handleClear = async () => {
    if (!confirm('Xóa tất cả log cũ hơn 30 ngày?')) return;
    await api.delete('/logs/clear?days=30');
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Log hệ thống</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#8898b8', alignSelf: 'center' }}>
            {total} bản ghi
          </span>
          <button className="btn ghost btn-sm" onClick={handleClear}>🗑 Xóa cũ &gt;30 ngày</button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="filter-bar mb-12" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="inp" style={{ flex: 1, minWidth: 200, height: 34 }}
          placeholder="🔍 Tìm kiếm log..."
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className={`btn btn-sm ${showFilters ? 'cyan' : 'ghost'}`}
          onClick={() => setShowFilters((v) => !v)}
          style={{ position: 'relative' }}
        >
          ⚙ Lọc {activeFilters > 0 && <span className="nav-badge" style={{ position: 'static', marginLeft: 4 }}>{activeFilters}</span>}
        </button>
      </div>

      {showFilters && (
        <div className="form-panel mb-12" style={{ padding: '12px 16px' }}>
          <div className="fg2" style={{ gap: 10 }}>
            <div>
              <label className="lbl">Mức độ</label>
              <select className="inp" value={level} onChange={(e) => setLevel(e.target.value)}>
                <option value="">Tất cả</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="lbl">Từ ngày</label>
              <input className="inp" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="lbl">Đến ngày</label>
              <input className="inp" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn ghost btn-sm" onClick={() => { setLevel(''); setFrom(''); setTo(''); }}>↺ Reset</button>
            </div>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className="nt">
          <thead>
            <tr>
              <th style={{ width: 150 }}>Thời gian</th>
              <th style={{ width: 80 }}>Mức</th>
              <th style={{ width: 100 }}>Hành động</th>
              <th style={{ width: 100 }}>Module</th>
              <th style={{ width: 100 }}>Người dùng</th>
              <th>Nội dung</th>
              <th style={{ width: 110 }}>IP</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr className="empty-row"><td colSpan={7}>⟳ Đang tải...</td></tr>}
            {!loading && rows.length === 0 && <tr className="empty-row"><td colSpan={7}>Không có log nào</td></tr>}
            {!loading && rows.map((r) => {
              const lm = LEVEL_META[r.level] || LEVEL_META.info;
              return (
                <tr key={r.id} style={{ borderLeft: `2px solid ${lm.color}33` }}>
                  <td style={{ fontSize: 11, color: '#8898b8', whiteSpace: 'nowrap' }}>{fmtTime(r.createdAt)}</td>
                  <td><span className={`tag ${lm.cls}`}>{lm.label}</span></td>
                  <td><span style={{ fontSize: 11, color: '#9098b8' }}>{r.action}</span></td>
                  <td><span style={{ fontSize: 11, color: '#7080a0' }}>{r.module || '—'}</span></td>
                  <td style={{ fontSize: 12 }}>{r.username || <span className="c-dim">—</span>}</td>
                  <td style={{ fontSize: 12, color: lm.color === '#00f5ff' ? 'var(--text)' : lm.color }}>{r.message}</td>
                  <td style={{ fontSize: 11, color: '#6070a0' }}>{r.ip || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
