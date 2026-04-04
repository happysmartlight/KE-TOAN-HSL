import { CSSProperties } from 'react';

export interface HoloData {
  type: 'customer' | 'supplier' | 'product';
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
  // Product
  sku?: string;
  unit?: string;
  costPrice?: number;
  sellingPrice?: number;
  stock?: number;
}

const fmt  = (n: number) => n.toLocaleString('vi-VN') + ' ₫';
const fmtD = (d: string) => new Date(d).toLocaleDateString('vi-VN');

function getTheme(data: HoloData) {
  if (data.type === 'customer') {
    const hasDebt = (data.debt ?? 0) > 0;
    return {
      color1: '#00f5ff',
      icon: '👤', typeLabel: 'KHÁCH HÀNG',
      badge: hasDebt ? 'Còn nợ' : 'Sạch nợ',
      badgeColor: hasDebt ? '#ff5577' : '#00ff88',
    };
  }
  if (data.type === 'supplier') {
    const map: Record<string, [string, string]> = {
      domestic:      ['#00ff88', 'Nội địa'],
      intermediary:  ['#ffcc00', 'Trung gian'],
      international: ['#bf00ff', 'Quốc tế'],
    };
    const [c1, label] = map[data.supplierType || 'domestic'];
    return {
      color1: c1,
      icon: '🏭', typeLabel: 'NHÀ CUNG CẤP',
      badge: label,
      badgeColor: c1,
    };
  }
  // product
  const s = data.stock ?? 0;
  const stockColor = s <= 0 ? '#ff5577' : s <= 5 ? '#ffcc00' : '#00ff88';
  return {
    color1: '#a78bfa',
    icon: '📦', typeLabel: 'SẢN PHẨM',
    badge: s <= 0 ? 'Hết hàng' : s <= 5 ? 'Sắp hết' : 'Còn hàng',
    badgeColor: stockColor,
  };
}

export default function HoloCard({ data }: { data: HoloData }) {
  const theme = getTheme(data);

  return (
    <div className="hcard" style={{ '--hc': theme.color1 } as CSSProperties}>
      {/* scanline overlay */}
      <div className="hcard-scan" />

      <div className="hcard-hdr">
        <span className="hcard-icon">{theme.icon}</span>
        <span className="hcard-type">// {theme.typeLabel}</span>
        <span className="hcard-id">#{String(data.id).padStart(4, '0')}</span>
        <span className="hcard-badge" style={{ color: theme.badgeColor }}>[ {theme.badge} ]</span>
      </div>

      <div className="hcard-name">{data.name}</div>
      {data.companyName && data.companyName !== data.name && (
        <div className="hcard-sub">— {data.companyName}</div>
      )}

      <div className="hcard-div" />

      <div className="hcard-rows">
        {data.phone   && <HRow label="SĐT"       value={data.phone} />}
        {data.email   && <HRow label="Email"      value={data.email} />}
        {data.address && <HRow label="Địa chỉ"   value={data.address} />}
        {data.taxCode && <HRow label="MST"        value={data.taxCode} />}

        {data.type === 'customer' && <>
          <HRow label="Tổng mua"  value={fmt(data.totalPurchased ?? 0)} color={theme.color1} />
          <HRow label="Đơn hàng"  value={String(data.invoiceCount ?? 0)} />
          <HRow label="Công nợ"   value={fmt(data.debt ?? 0)} color={(data.debt ?? 0) > 0 ? '#ff5577' : '#505070'} />
        </>}

        {data.type === 'supplier' && (
          <HRow label="Đang nợ" value={fmt(data.debt ?? 0)} color={(data.debt ?? 0) > 0 ? '#ff5577' : '#505070'} />
        )}

        {data.type === 'product' && <>
          {data.sku  && <HRow label="SKU"      value={data.sku} />}
          {data.unit && <HRow label="Đơn vị"  value={data.unit} />}
          <HRow label="Giá bán"  value={fmt(data.sellingPrice ?? 0)} color={theme.color1} />
          <HRow label="Giá vốn"  value={fmt(data.costPrice ?? 0)} />
          <HRow label="Tồn kho"  value={String(data.stock ?? 0)} color={theme.badgeColor} />
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
