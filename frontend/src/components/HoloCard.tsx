import { CSSProperties } from 'react';

export interface HoloData {
  type: 'customer' | 'supplier' | 'product' | 'user';
  id: number;
  name: string;
  createdAt: string;
  phone?: string;
  email?: string;
  address?: string;
  companyName?: string;
  taxCode?: string;
  // Customer
  debt?: number;
  totalPurchased?: number;
  invoiceCount?: number;
  // Supplier
  supplierType?: string;
  totalOrdered?: number;
  orderCount?: number;
  // Product
  sku?: string;
  unit?: string;
  costPrice?: number;
  sellingPrice?: number;
  stock?: number;
  totalSold?: number;
  totalRevenue?: number;
  // User
  username?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  employmentStatus?: string;
}

// ── Rank tier type ────────────────────────────────────────────────────────────
export type RankTier = {
  label: string;
  min: number;
  icon: string;
  color: string;
  glow: string;
};

// ── Default ranks ─────────────────────────────────────────────────────────────
const DEFAULT_RANKS: RankTier[] = [
  { label: 'THÁCH ĐẤU', min: 50_000_000, icon: '⚔️',  color: '#ff2244', glow: '#ff003344' },
  { label: 'KIM CƯƠNG',  min: 20_000_000, icon: '💎',  color: '#00d4ff', glow: '#00aaff44' },
  { label: 'BẠCH KIM',   min: 10_000_000, icon: '🔮',  color: '#bf80ff', glow: '#9944ff44' },
  { label: 'VÀNG',       min:  5_000_000, icon: '⭐',  color: '#ffcc00', glow: '#ffaa0044' },
];

// Per-group mutable rank arrays — updated via setRankConfig()
let _customerRanks: RankTier[] = [...DEFAULT_RANKS];
let _supplierRanks: RankTier[] = [...DEFAULT_RANKS];
let _productRanks:  RankTier[] = [...DEFAULT_RANKS];
let _userRanks:     RankTier[] = [...DEFAULT_RANKS];

export type RankConfigMap = {
  customer?: RankTier[];
  supplier?: RankTier[];
  product?:  RankTier[];
  user?:     RankTier[];
};

/** Called by App.tsx after fetching admin rank config */
export function setRankConfig(cfg: RankConfigMap) {
  if (cfg.customer?.length) _customerRanks = [...cfg.customer];
  if (cfg.supplier?.length) _supplierRanks = [...cfg.supplier];
  if (cfg.product?.length)  _productRanks  = [...cfg.product];
  if (cfg.user?.length)     _userRanks     = [...cfg.user];
}

// ── Rank system ───────────────────────────────────────────────────────────────
export const CUSTOMER_RANKS = DEFAULT_RANKS; // kept for backward compat
export { DEFAULT_RANKS as SUPPLIER_RANKS };

export function getCustomerRank(v: number): RankTier | null {
  return _customerRanks.find((r) => v >= r.min) ?? null;
}
export function getSupplierRank(v: number): RankTier | null {
  return _supplierRanks.find((r) => v >= r.min) ?? null;
}
export function getProductRank(v: number): RankTier | null {
  return _productRanks.find((r) => v >= r.min) ?? null;
}
export function getUserRank(v: number): RankTier | null {
  return _userRanks.find((r) => v >= r.min) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────

const fmt  = (n: number) => n.toLocaleString('vi-VN') + ' ₫';
const fmtD = (d?: string) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';

function getTheme(data: HoloData) {
  if (data.type === 'customer') {
    const rank    = getCustomerRank(data.totalPurchased ?? 0);
    const hasDebt = (data.debt ?? 0) > 0;
    return {
      color1:     rank?.color ?? '#00f5ff',
      icon:       '👤',
      typeLabel:  'KHÁCH HÀNG',
      badge:      hasDebt ? 'Còn nợ' : 'Sạch nợ',
      badgeColor: hasDebt ? '#ff5577' : '#00ff88',
      rank,
    };
  }
  if (data.type === 'supplier') {
    const rank = getSupplierRank(data.totalOrdered ?? 0);
    const typeMap: Record<string, [string, string]> = {
      domestic:      ['#00ff88', 'Nội địa'],
      intermediary:  ['#ffcc00', 'Trung gian'],
      international: ['#bf00ff', 'Quốc tế'],
    };
    const [typeColor, typeLabel2] = typeMap[data.supplierType || 'domestic'];
    return {
      color1: rank?.color ?? typeColor,
      icon: '🏭', typeLabel: 'NHÀ CUNG CẤP',
      badge: typeLabel2, badgeColor: typeColor, rank,
    };
  }
  if (data.type === 'user') {
    const rank     = getUserRank(data.totalRevenue ?? 0);
    const resigned = data.employmentStatus === 'resigned';
    return {
      color1:     rank?.color ?? (resigned ? '#505070' : '#00f5ff'),
      icon:       data.role === 'admin' ? '🛡️' : '🧑‍💼',
      typeLabel:  'NHÂN SỰ',
      badge:      resigned ? 'Đã nghỉ' : 'Đang làm',
      badgeColor: resigned ? '#ff5577' : '#00ff88',
      rank,
    };
  }
  // product
  const s = data.stock ?? 0;
  const stockColor = s <= 0 ? '#ff5577' : s <= 5 ? '#ffcc00' : '#00ff88';
  const pRank = getProductRank(data.totalRevenue ?? 0);
  return {
    color1: pRank?.color ?? '#a78bfa', icon: '📦', typeLabel: 'SẢN PHẨM',
    badge: s <= 0 ? 'Hết hàng' : s <= 5 ? 'Sắp hết' : 'Còn hàng',
    badgeColor: stockColor, rank: pRank,
  };
}

export default function HoloCard({ data }: { data: HoloData }) {
  const theme = getTheme(data);

  return (
    <div className="hcard" style={{ '--hc': theme.color1 } as CSSProperties}>
      {/* scanline overlay */}
      <div className="hcard-scan" />

      {/* Header */}
      <div className="hcard-hdr">
        <span className="hcard-icon">{theme.icon}</span>
        <span className="hcard-type">// {theme.typeLabel}</span>
        <span className="hcard-id">#{String(data.id).padStart(4, '0')}</span>
        <span className="hcard-badge" style={{ color: theme.badgeColor }}>[ {theme.badge} ]</span>
      </div>

      {/* Name + company */}
      <div className="hcard-name">{data.name}</div>
      {data.companyName && data.companyName !== data.name && (
        <div className="hcard-sub">— {data.companyName}</div>
      )}

      {/* Rank banner */}
      {theme.rank && (
        <div
          className="hcard-rank"
          style={{
            borderColor: theme.rank.color,
            color:       theme.rank.color,
            boxShadow:   `0 0 18px ${theme.rank.glow}, inset 0 0 12px ${theme.rank.glow}`,
          }}
        >
          <span className="hcard-rank-icon">{theme.rank.icon}</span>
          <div style={{ flex: 1 }}>
            <div className="hcard-rank-label">{theme.rank.label}</div>
            <div className="hcard-rank-sub">
              {data.type === 'supplier' ? 'Top nhà cung cấp' :
               data.type === 'product'  ? 'Top sản phẩm' :
               data.type === 'user'     ? 'Top nhân viên' :
               'Top khách hàng'}
            </div>
          </div>
          <span className="hcard-rank-trophy">🏆</span>
        </div>
      )}

      <div className="hcard-div" />

      {/* Info rows */}
      <div className="hcard-rows">
        {data.type === 'customer' && <>
          <HRow label="SĐT"      value={data.phone    || '—'} />
          <HRow label="Email"    value={data.email    || '—'} />
          <HRow label="Địa chỉ" value={data.address  || '—'} />
          <HRow label="MST"      value={data.taxCode  || '—'} />
          <HRow label="Tổng mua" value={fmt(data.totalPurchased ?? 0)} color={theme.color1} />
          <HRow label="Đơn hàng" value={`${data.invoiceCount ?? 0} hóa đơn`} />
          <HRow label="Công nợ"  value={fmt(data.debt ?? 0)}
            color={(data.debt ?? 0) > 0 ? '#ff5577' : '#505070'} />
        </>}

        {data.type === 'supplier' && <>
          <HRow label="SĐT"      value={data.phone   || '—'} />
          <HRow label="Email"    value={data.email   || '—'} />
          <HRow label="Địa chỉ" value={data.address || '—'} />
          <HRow label="MST"      value={data.taxCode || '—'} />
          <HRow label="Tổng đặt" value={fmt(data.totalOrdered ?? 0)} color={theme.color1} />
          <HRow label="Đơn mua"  value={`${data.orderCount ?? 0} đơn`} />
          <HRow label="Đang nợ"  value={fmt(data.debt ?? 0)}
            color={(data.debt ?? 0) > 0 ? '#ff5577' : '#505070'} />
        </>}

        {data.type === 'product' && <>
          {data.sku  && <HRow label="SKU"     value={data.sku} />}
          {data.unit && <HRow label="Đơn vị" value={data.unit} />}
          <HRow label="Giá bán"   value={fmt(data.sellingPrice ?? 0)} color={theme.color1} />
          <HRow label="Giá vốn"   value={fmt(data.costPrice ?? 0)} />
          <HRow label="Tồn kho"   value={`${data.stock ?? 0} ${data.unit || ''}`} color={theme.badgeColor} />
          <HRow label="Đã bán"    value={`${(data.totalSold ?? 0).toLocaleString('vi-VN')} ${data.unit || ''}`} color={theme.color1} />
          <HRow label="Doanh thu" value={fmt(data.totalRevenue ?? 0)} color={theme.color1} />
        </>}

        {data.type === 'user' && <>
          <HRow label="Username"  value={data.username || '—'} />
          <HRow label="Vai trò"   value={data.role === 'admin' ? 'Admin' : 'Nhân viên'} color={data.role === 'admin' ? '#bf80ff' : '#00f5ff'} />
          <HRow label="SĐT"       value={data.phone || '—'} />
          <HRow label="Email"     value={data.email || '—'} />
          <HRow label="Vào làm"   value={fmtD(data.startDate)} />
          {data.endDate && <HRow label="Nghỉ việc" value={fmtD(data.endDate)} color="#ff5577" />}
          <HRow label="Doanh thu" value={fmt(data.totalRevenue ?? 0)} color={theme.color1} />
          <HRow label="Hóa đơn"  value={`${data.invoiceCount ?? 0} HĐ`} />
        </>}

        <HRow label="Ngày thêm" value={fmtD(data.createdAt)} />
      </div>

      <div className="hcard-footer">
        <span>HSL-INTERNAL</span>
        <span className="hcard-cursor">▌</span>
      </div>
    </div>
  );
}

function HRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="hcard-row">
      <span className="hcard-row-lbl">{label}</span>
      <span className="hcard-row-val" style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}
