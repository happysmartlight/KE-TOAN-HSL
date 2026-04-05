import { useEffect, useState } from 'react';
import api from '../api';
import { toast } from '../components/Toast';
import { setRankConfig } from '../components/HoloCard';

type RankTier = {
  label: string;
  min: number;
  icon: string;
  color: string;
  glow: string;
};

type GroupKey = 'customer' | 'supplier' | 'product' | 'user';

type RankConfigs = Record<GroupKey, RankTier[]>;

const GROUPS: { key: GroupKey; icon: string; label: string; metric: string }[] = [
  { key: 'customer', icon: '👥', label: 'Khách hàng',   metric: 'Tổng mua' },
  { key: 'supplier', icon: '🏭', label: 'Nhà cung cấp', metric: 'Tổng đặt' },
  { key: 'product',  icon: '📦', label: 'Sản phẩm',     metric: 'Doanh thu' },
  { key: 'user',     icon: '🧑‍💼', label: 'Nhân viên',    metric: 'Doanh thu' },
];

const DEFAULT_TIERS: RankTier[] = [
  { label: 'THÁCH ĐẤU', min: 50_000_000, icon: '⚔️',  color: '#ff2244', glow: '#ff003344' },
  { label: 'KIM CƯƠNG',  min: 20_000_000, icon: '💎',  color: '#00d4ff', glow: '#00aaff44' },
  { label: 'BẠCH KIM',   min: 10_000_000, icon: '🔮',  color: '#bf80ff', glow: '#9944ff44' },
  { label: 'VÀNG',       min:  5_000_000, icon: '⭐',  color: '#ffcc00', glow: '#ffaa0044' },
];

const mkDefault = (): RankConfigs => ({
  customer: DEFAULT_TIERS.map((t) => ({ ...t })),
  supplier: DEFAULT_TIERS.map((t) => ({ ...t })),
  product:  DEFAULT_TIERS.map((t) => ({ ...t })),
  user:     DEFAULT_TIERS.map((t) => ({ ...t })),
});

const fmt = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

/** Hiển thị số có dấu chấm phân cách hàng nghìn: 50000000 → "50.000.000" */
const fmtNum = (n: number) => n.toLocaleString('vi-VN');

/** Parse chuỗi có thể chứa dấu chấm/phẩy → số nguyên */
const parseNum = (s: string) => {
  const cleaned = s.replace(/[^\d]/g, '');
  return cleaned === '' ? 0 : parseInt(cleaned, 10);
};

function deriveGlow(hex: string): string {
  // strip # and append alpha 44
  return hex.startsWith('#') ? hex + '44' : '#' + hex + '44';
}

// ── Tier editor for one group ─────────────────────────────────────────────────
function TierEditor({
  tiers, onChange,
}: {
  tiers: RankTier[];
  onChange: (t: RankTier[]) => void;
}) {
  const update = (idx: number, field: keyof RankTier, value: string | number) => {
    const next = [...tiers];
    const t = { ...next[idx], [field]: value };
    if (field === 'color') t.glow = deriveGlow(value as string);
    next[idx] = t;
    onChange(next);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...tiers];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next);
  };

  const remove = (idx: number) => onChange(tiers.filter((_, i) => i !== idx));

  const add = () =>
    onChange([
      ...tiers,
      { label: 'MỚI', min: 1_000_000, icon: '🎯', color: '#00ff88', glow: '#00ff8844' },
    ]);

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        {tiers.map((t, idx) => (
          <div key={idx} style={{
            padding: '14px 16px',
            background: 'var(--bg-card)',
            border: `1px solid ${t.color}40`,
            borderLeft: `3px solid ${t.color}`,
            borderRadius: 4,
            boxShadow: `0 0 12px ${t.glow}`,
          }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              <div>
                <div style={{ color: t.color, fontWeight: 800, fontSize: 13, letterSpacing: 1 }}>{t.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Ngưỡng: ≥ {fmt(t.min)}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                <button className="btn ghost btn-sm" onClick={() => move(idx, -1)} disabled={idx === 0} title="Lên">↑</button>
                <button className="btn ghost btn-sm" onClick={() => move(idx, 1)} disabled={idx === tiers.length - 1} title="Xuống">↓</button>
                <button className="btn ghost btn-sm" style={{ color: 'var(--red)', opacity: 0.7 }}
                  onClick={() => remove(idx)} title="Xóa">✕</button>
              </div>
            </div>

            <div className="fg2" style={{ gap: 10 }}>
              <div>
                <label className="lbl">Tên rank</label>
                <input className="inp" value={t.label} onChange={(e) => update(idx, 'label', e.target.value)} />
              </div>
              <div>
                <label className="lbl">Icon (emoji)</label>
                <input className="inp" value={t.icon} onChange={(e) => update(idx, 'icon', e.target.value)} style={{ fontSize: 18 }} />
              </div>
              <div>
                <label className="lbl">Ngưỡng tối thiểu (₫)</label>
                <input
                  className="inp"
                  inputMode="numeric"
                  value={fmtNum(t.min)}
                  onChange={(e) => update(idx, 'min', parseNum(e.target.value))}
                  onFocus={(e) => e.target.select()}
                  style={{ textAlign: 'right', letterSpacing: 0.5 }}
                />
              </div>
              <div>
                <label className="lbl">Màu sắc</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="inp" value={t.color}
                    onChange={(e) => update(idx, 'color', e.target.value)}
                    style={{ flex: 1, borderColor: t.color }} />
                  <input type="color" value={t.color.length === 7 ? t.color : '#ffffff'}
                    onChange={(e) => update(idx, 'color', e.target.value)}
                    style={{ width: 36, height: 32, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 3 }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="btn ghost" onClick={add} style={{ width: '100%', marginBottom: 16 }}>
        + Thêm tier mới
      </button>

      {/* Preview */}
      <div style={{ padding: '12px 14px', background: 'var(--bg-card2)', border: '1px solid var(--border-dim)', borderRadius: 4 }}>
        <div style={{ fontWeight: 700, marginBottom: 10, color: 'var(--cyan)', fontSize: 11, letterSpacing: 1 }}>
          PREVIEW — THỨ TỰ ƯU TIÊN
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {tiers.map((t, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
              <span style={{ color: 'var(--text-dim)', width: 18, textAlign: 'right', fontSize: 10 }}>#{idx + 1}</span>
              <span style={{ fontSize: 15 }}>{t.icon}</span>
              <span style={{ color: t.color, fontWeight: 800, width: 110 }}>{t.label}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>≥ {fmt(t.min)}</span>
              <div style={{ width: 12, height: 12, background: t.color, borderRadius: 2, marginLeft: 4 }} />
            </div>
          ))}
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, borderTop: '1px solid var(--border-dim)', paddingTop: 6 }}>
            Không đủ ngưỡng nào → không có rank
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RankConfig() {
  const [configs, setConfigs] = useState<RankConfigs>(mkDefault());
  const [activeGroup, setActiveGroup] = useState<GroupKey>('customer');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/rank-config')
      .then((r) => {
        const d = r.data;
        setConfigs({
          customer: d.customer?.length ? d.customer : DEFAULT_TIERS.map((t) => ({ ...t })),
          supplier: d.supplier?.length ? d.supplier : DEFAULT_TIERS.map((t) => ({ ...t })),
          product:  d.product?.length  ? d.product  : DEFAULT_TIERS.map((t) => ({ ...t })),
          user:     d.user?.length     ? d.user     : DEFAULT_TIERS.map((t) => ({ ...t })),
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/admin/rank-config', configs);
      // Cập nhật module singleton ngay lập tức — không cần reload/restart
      setRankConfig(configs);
      toast.success('Đã lưu và áp dụng cấu hình rank thành công');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Lỗi khi lưu');
    } finally {
      setSaving(false);
    }
  };

  const resetGroup = () =>
    setConfigs((prev) => ({ ...prev, [activeGroup]: DEFAULT_TIERS.map((t) => ({ ...t })) }));

  const resetAll = () => setConfigs(mkDefault());

  const updateGroup = (tiers: RankTier[]) =>
    setConfigs((prev) => ({ ...prev, [activeGroup]: tiers }));

  const activeInfo = GROUPS.find((g) => g.key === activeGroup)!;

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>Đang tải...</div>
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Cấu hình Rank</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost btn-sm" onClick={resetAll} title="Đặt lại tất cả group về mặc định">↺ Reset tất cả</button>
          <button className="btn cyan" onClick={save} disabled={saving}>
            {saving ? '[ Đang lưu... ]' : '[ Lưu cấu hình ]'}
          </button>
        </div>
      </div>

      {/* Group selector */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>
        {GROUPS.map((g, idx) => {
          const active = g.key === activeGroup;
          const tierCount = configs[g.key].length;
          return (
            <button
              key={g.key}
              onClick={() => setActiveGroup(g.key)}
              style={{
                flex: 1, padding: '10px 8px',
                background: active ? 'rgba(0,245,255,0.1)' : 'var(--bg-card)',
                color: active ? 'var(--cyan)' : 'var(--text-dim)',
                border: 'none',
                borderRight: idx < GROUPS.length - 1 ? '1px solid var(--border)' : 'none',
                borderBottom: active ? '2px solid var(--cyan)' : '2px solid transparent',
                cursor: 'pointer',
                fontFamily: 'var(--font)',
                fontSize: 12,
                fontWeight: active ? 700 : 400,
                transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              }}
            >
              <span style={{ fontSize: 18 }}>{g.icon}</span>
              <span>{g.label}</span>
              <span style={{ fontSize: 10, opacity: 0.6 }}>{tierCount} tier</span>
            </button>
          );
        })}
      </div>

      {/* Active group header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 14, padding: '10px 14px',
        background: 'rgba(0,245,255,0.04)', border: '1px solid rgba(0,245,255,0.12)',
        borderRadius: 4,
      }}>
        <div>
          <span style={{ fontSize: 18, marginRight: 8 }}>{activeInfo.icon}</span>
          <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>{activeInfo.label}</span>
          <span style={{ color: 'var(--text-dim)', fontSize: 11, marginLeft: 10 }}>
            Tiêu chí xếp hạng: <span className="c-bright">{activeInfo.metric}</span>
          </span>
        </div>
        <button className="btn ghost btn-sm" onClick={resetGroup}>↺ Reset group này</button>
      </div>

      {/* Tier editor */}
      <TierEditor
        tiers={configs[activeGroup]}
        onChange={updateGroup}
      />

      {/* Save bottom */}
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn ghost" onClick={resetAll}>↺ Reset tất cả</button>
        <button className="btn cyan" onClick={save} disabled={saving}>
          {saving ? '[ Đang lưu... ]' : '[ Lưu cấu hình ]'}
        </button>
      </div>
    </div>
  );
}
