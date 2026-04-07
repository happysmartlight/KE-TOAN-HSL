import { toast } from '../components/Toast';
import { useEffect, useMemo, useState } from 'react';
import { useEscKey } from '../hooks/useKeyboard';
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import RequestDeleteModal from '../components/RequestDeleteModal';
import ConfirmModal from '../components/ConfirmModal';
import FilterBar, { defaultFilter } from '../components/FilterBar';
import type { FilterState } from '../components/FilterBar';
import HoloCard, { getProductRank } from '../components/HoloCard';
import type { HoloData } from '../components/HoloCard';
import EmptyState from '../components/EmptyState';
import MoneyInput from '../components/MoneyInput';

const fmt   = (n: number) => n.toLocaleString('vi-VN') + ' ₫';
const fmtK  = (n: number) => n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M' : n >= 1_000 ? (n / 1_000).toFixed(0) + 'K' : String(n);
const empty = { name: '', sku: '', unit: 'cái', costPrice: '', sellingPrice: '', stock: '', taxRate: '10%' };

const TAX_OPTIONS = ['0%', '5%', '8%', '10%', 'KCT'];
const TAX_COLOR: Record<string, string> = { '10%': 'cyan', '8%': 'yellow', '5%': 'yellow', '0%': 'purple', 'KCT': 'red' };

// ── Dashboard types ───────────────────────────────────────────────────────────
type DashboardData = {
  summary: { totalProducts: number; totalStock: number; totalStockValue: number; lowStockCount: number; outOfStockCount: number };
  inventoryChart: { date: string; in: number; out: number }[];
  topProducts: { id: number; name: string; unit: string; stock: number; totalSold: number; totalRevenue: number }[];
  lowStockProducts: { id: number; name: string; unit: string; stock: number }[];
  inactiveProducts: { id: number; name: string; unit: string; stock: number; lastSoldAt: string | null; daysSince: number | null }[];
  days: number;
};

// ── Skeleton block ────────────────────────────────────────────────────────────
function Sk({ w, h = 14 }: { w?: number | string; h?: number }) {
  return <div className="skeleton" style={{ width: w ?? '100%', height: h, borderRadius: 4 }} />;
}

// ── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({
  icon, label, value, sub, color, onClick,
}: {
  icon: string; label: string; value: string | number; sub?: string;
  color?: string; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-card)', border: `1px solid ${color ? color + '33' : 'rgba(0,245,255,0.12)'}`,
        borderRadius: 6, padding: '16px 18px', cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.2s, transform 0.15s',
        boxShadow: color ? `0 0 18px ${color}0a` : undefined,
      }}
      onMouseEnter={(e) => { if (onClick) (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { if (onClick) (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
    >
      <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color ?? 'var(--text-bright)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 5, letterSpacing: 0.5 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: color ?? 'var(--cyan)', marginTop: 3 }}>{sub}</div>}
      {onClick && <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 6, letterSpacing: 1 }}>↗ Click để lọc</div>}
    </div>
  );
}

// ── Product Dashboard tab ─────────────────────────────────────────────────────
function ProductDashboard({ onJumpToList }: { onJumpToList: (status: string) => void }) {
  const [data, setData]   = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays]   = useState(30);

  const load = async (d = days) => {
    setLoading(true);
    try {
      const r = await api.get(`/products/dashboard?days=${d}`);
      setData(r.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [days]);

  // ── chart date label ──────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.inventoryChart.map((row) => ({
      ...row,
      label: row.date.slice(5), // MM-DD
    }));
  }, [data]);

  const maxRev = data ? data.topProducts.reduce((m, p) => Math.max(m, p.totalRevenue), 0) : 0;

  // Tổng nhập / xuất kho trong kỳ (tính từ inventoryChart)
  const periodIn  = data ? data.inventoryChart.reduce((s, r) => s + r.in,  0) : 0;
  const periodOut = data ? data.inventoryChart.reduce((s, r) => s + r.out, 0) : 0;

  // ── period selector ──────────────────────────────────────────────────────
  const periods = [
    { label: '7 ngày', value: 7 },
    { label: '30 ngày', value: 30 },
    { label: '90 ngày', value: 90 },
  ];

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* skeleton summary */}
      <div className="grid-6" style={{ marginBottom: 0 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid rgba(0,245,255,0.08)', borderRadius: 6, padding: '16px 18px' }}>
            <Sk w={32} h={22} /><div style={{ height: 8 }} /><Sk w="70%" h={28} /><div style={{ height: 6 }} /><Sk w="50%" h={12} />
          </div>
        ))}
      </div>
      <div className="grid-2" style={{ marginBottom: 0 }}>
        {[1, 2].map((i) => (
          <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid rgba(0,245,255,0.08)', borderRadius: 6, padding: '16px 18px', height: 240 }}>
            <Sk w="40%" h={14} /><div style={{ height: 12 }} /><Sk h={180} />
          </div>
        ))}
      </div>
    </div>
  );

  if (!data) return <div className="c-dim" style={{ fontSize: 12, padding: '20px 0' }}>Không thể tải dữ liệu.</div>;

  const { summary } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Period selector ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', marginRight: 4 }}>Kỳ phân tích:</span>
        {periods.map((p) => (
          <button key={p.value} className={`btn ${days === p.value ? 'cyan' : 'ghost'} btn-sm`}
            onClick={() => setDays(p.value)}>{p.label}</button>
        ))}
        <button className="btn ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => load(days)}>↻ Làm mới</button>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid-6" style={{ marginBottom: 0 }}>
        <SummaryCard icon="📦" label="Tổng sản phẩm" value={summary.totalProducts} color="var(--cyan)" />
        <SummaryCard icon="🏭" label="Tổng tồn kho" value={summary.totalStock.toLocaleString('vi-VN')} sub="đơn vị" color="var(--green)" />
        <SummaryCard icon="💰" label="Giá trị tồn kho" value={fmtK(summary.totalStockValue)} sub={fmt(summary.totalStockValue)} color="var(--purple)" />
        <SummaryCard
          icon="🔄" label={`Lưu lượng ${days}d`}
          value={`${periodOut.toLocaleString('vi-VN')}`}
          sub={`↓ Xuất • ↑ Nhập ${periodIn.toLocaleString('vi-VN')}`}
          color="var(--cyan)"
        />
        <SummaryCard
          icon="⚠️" label="Sắp hết hàng" value={summary.lowStockCount}
          sub="tồn kho ≤ 5" color="var(--yellow)"
          onClick={summary.lowStockCount > 0 ? () => onJumpToList('low') : undefined}
        />
        <SummaryCard
          icon="🚫" label="Hết hàng" value={summary.outOfStockCount}
          sub="tồn kho = 0" color="var(--red)"
          onClick={summary.outOfStockCount > 0 ? () => onJumpToList('out') : undefined}
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid-2" style={{ marginBottom: 0 }}>

        {/* Inventory in/out chart */}
        <div className="form-panel" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 14, letterSpacing: 1, textTransform: 'uppercase' }}>
            📈 Nhập / Xuất kho — {days} ngày qua
          </div>
          {chartData.every(d => d.in === 0 && d.out === 0) ? (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
              Không có giao dịch kho trong kỳ này
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-dim)', fontSize: 9 }}
                  interval={days <= 7 ? 0 : days <= 30 ? 4 : 13} />
                <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 9 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#0d0d1a', border: '1px solid rgba(0,245,255,0.2)', fontSize: 11 }}
                  labelStyle={{ color: 'var(--cyan)' }}
                />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                <Line type="monotone" dataKey="in"  name="Nhập" stroke="var(--green)"  strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="out" name="Xuất" stroke="var(--red)"    strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top products leaderboard */}
        <div className="form-panel" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 14, letterSpacing: 1, textTransform: 'uppercase' }}>
            🏆 Top doanh thu (mọi thời gian)
          </div>
          {data.topProducts.length === 0 ? (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
              Chưa có dữ liệu bán hàng
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {data.topProducts.slice(0, 7).map((p, i) => {
                const pct  = maxRev > 0 ? Math.round((p.totalRevenue / maxRev) * 100) : 0;
                const rank = getProductRank(p.totalRevenue);
                const MEDAL = ['🥇', '🥈', '🥉'];
                const barColor = i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : (rank?.color ?? 'var(--cyan)');
                return (
                  <div key={p.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      {/* Huy chương / số thứ tự */}
                      <span style={{ width: 20, fontSize: i < 3 ? 14 : 10, textAlign: 'center', flexShrink: 0, color: 'var(--text-dim)', fontWeight: 700 }}>
                        {i < 3 ? MEDAL[i] : `${i + 1}.`}
                      </span>
                      {/* Tên đầy đủ — wrap nếu dài */}
                      <span style={{ flex: 1, fontSize: 12, color: rank?.color ?? 'var(--text-bright)', lineHeight: 1.3, wordBreak: 'break-word' }}>
                        {p.name}
                      </span>
                      {/* Doanh thu + số lượng */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: barColor }}>{fmtK(p.totalRevenue)}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{p.totalSold.toLocaleString('vi-VN')} {p.unit}</div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 20, flexShrink: 0 }} />
                      <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 2, transition: 'width 0.6s', boxShadow: `0 0 6px ${barColor}66` }} />
                      </div>
                      <span style={{ fontSize: 9, color: 'var(--text-dim)', width: 28, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Smart lists row ── */}
      <div className="grid-3" style={{ marginBottom: 0 }}>

        {/* Top bán chạy */}
        <div className="form-panel" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
            🔥 Bán chạy nhất
          </div>
          {data.topProducts.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>Chưa có dữ liệu</div>
          ) : data.topProducts.map((p, i) => {
            const pct = maxRev > 0 ? Math.round((p.totalRevenue / maxRev) * 100) : 0;
            const rank = getProductRank(p.totalRevenue);
            return (
              <div key={p.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', width: 14, textAlign: 'right', flexShrink: 0 }}>
                    {i + 1}.
                  </span>
                  {rank && <span style={{ fontSize: 12, flexShrink: 0 }}>{rank.icon}</span>}
                  <span style={{ fontSize: 12, color: rank?.color ?? 'var(--text-bright)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--cyan)', fontWeight: 700, flexShrink: 0 }}>
                    {fmtK(p.totalRevenue)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 14, flexShrink: 0 }} />
                  <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: rank?.color ?? 'var(--cyan)', borderRadius: 2, transition: 'width 0.6s' }} />
                  </div>
                  <span style={{ fontSize: 9, color: 'var(--text-dim)', flexShrink: 0 }}>
                    {p.totalSold.toLocaleString('vi-VN')} {p.unit}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tồn kho thấp */}
        <div className="form-panel" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: 1, textTransform: 'uppercase' }}>
              ⚠️ Tồn kho thấp
            </span>
            {data.lowStockProducts.length > 0 && (
              <button className="btn yellow btn-sm" style={{ fontSize: 9, padding: '2px 8px', marginLeft: 'auto' }}
                onClick={() => onJumpToList('low')}>
                Xem tất cả →
              </button>
            )}
          </div>
          {data.lowStockProducts.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>✓</span> Tất cả sản phẩm còn hàng đầy đủ
            </div>
          ) : data.lowStockProducts.map((p) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <span style={{
                width: 28, height: 22, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: p.stock <= 0 ? 'rgba(255,0,85,0.12)' : 'rgba(255,204,0,0.1)',
                border: `1px solid ${p.stock <= 0 ? 'rgba(255,0,85,0.4)' : 'rgba(255,204,0,0.4)'}`,
                fontSize: 11, fontWeight: 800, flexShrink: 0,
                color: p.stock <= 0 ? 'var(--red)' : 'var(--yellow)',
              }}>
                {p.stock}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-bright)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>{p.unit}</span>
            </div>
          ))}
        </div>

        {/* Không bán trong X ngày */}
        <div className="form-panel" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: 1, textTransform: 'uppercase' }}>
              😴 Không bán — {days} ngày
            </span>
          </div>
          {data.inactiveProducts.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>✓</span> Tất cả sản phẩm đều có giao dịch trong kỳ
            </div>
          ) : data.inactiveProducts.map((p) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text-bright)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
                  {p.lastSoldAt
                    ? `Bán cuối: ${new Date(p.lastSoldAt).toLocaleDateString('vi-VN')}`
                    : 'Chưa từng bán'}
                </div>
              </div>
              <span style={{
                fontSize: 10, color: 'var(--red)', fontWeight: 700, flexShrink: 0,
                background: 'rgba(255,0,85,0.08)', border: '1px solid rgba(255,0,85,0.2)',
                borderRadius: 3, padding: '2px 6px',
              }}>
                {p.daysSince !== null ? `${p.daysSince}d` : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Products() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'list' | 'dashboard'>('list');

  // ── List state ────────────────────────────────────────────────────────────
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ id: number; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string; stock: number } | null>(null);
  const [filter, setFilter] = useState<FilterState>({ ...defaultFilter, sortBy: 'sold', sortDir: 'desc' });
  const [cardData, setCardData] = useState<HoloData | null>(null);
  const [loading, setLoading] = useState(true);

  useEscKey(cardData ? () => setCardData(null) : open ? () => setOpen(false) : null);

  const load = () => api.get('/products').then((r) => { setRows(r.data); setLoading(false); });
  useEffect(() => { load(); }, []);

  // ── Jump from dashboard → list with filter ────────────────────────────────
  const jumpToList = (status: string) => {
    setFilter((f) => ({ ...f, status, search: '' }));
    setTab('list');
  };

  const filtered = useMemo(() => {
    let r = [...rows];
    if (filter.search) {
      const q = filter.search.toLowerCase();
      r = r.filter((p) =>
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.unit?.toLowerCase().includes(q)
      );
    }
    if (filter.status === 'out')  r = r.filter((p) => p.stock <= 0);
    if (filter.status === 'low')  r = r.filter((p) => p.stock > 0 && p.stock <= 5);
    if (filter.status === 'ok')   r = r.filter((p) => p.stock > 5);
    if (filter.amountMin) r = r.filter((p) => p.sellingPrice >= Number(filter.amountMin));
    if (filter.amountMax) r = r.filter((p) => p.sellingPrice <= Number(filter.amountMax));
    r.sort((a, b) => {
      const dir = filter.sortDir === 'desc' ? -1 : 1;
      if (filter.sortBy === 'name')  return dir * a.name.localeCompare(b.name);
      if (filter.sortBy === 'stock') return dir * (a.stock - b.stock);
      if (filter.sortBy === 'price') return dir * (a.sellingPrice - b.sellingPrice);
      if (filter.sortBy === 'sold')  return dir * ((a.totalRevenue ?? 0) - (b.totalRevenue ?? 0));
      return dir * (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) * -1;
    });
    return r;
  }, [rows, filter]);

  const openNew  = () => { setEditId(null); setForm(empty); setOpen(true); };
  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({ name: p.name, sku: p.sku || '', unit: p.unit, costPrice: String(p.costPrice), sellingPrice: String(p.sellingPrice), stock: String(p.stock), taxRate: p.taxRate || '10%' });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...form, costPrice: Number(form.costPrice), sellingPrice: Number(form.sellingPrice), stock: Number(form.stock) };
    if (editId) await api.put(`/products/${editId}`, data);
    else        await api.post('/products', data);
    setOpen(false); setForm(empty); setEditId(null); load();
  };

  const handleDelete = (id: number, name: string, stock: number) => {
    if (isAdmin) setConfirmDelete({ id, name, stock });
    else         setDeleteModal({ id, name });
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/products/${confirmDelete.id}`);
      setConfirmDelete(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Không thể xóa');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Sản phẩm</h1>
        {tab === 'list' && (
          <button className="btn cyan" onClick={openNew}>+ Thêm mới</button>
        )}
      </div>

      {/* ── Tab selector ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        <button
          className={`btn ${tab === 'list' ? 'cyan' : 'ghost'}`}
          style={{ flex: '1 1 auto', borderRadius: 4 }}
          onClick={() => setTab('list')}
        >
          📋 Danh sách
        </button>
        <button
          className={`btn ${tab === 'dashboard' ? 'cyan' : 'ghost'}`}
          style={{ flex: '1 1 auto', borderRadius: 4 }}
          onClick={() => setTab('dashboard')}
        >
          📊 Phân tích & Báo cáo
        </button>
      </div>

      {/* ══════════════ TAB: LIST ══════════════ */}
      {tab === 'list' && (
        <>
          {open && (
            <div className="form-panel mb-16">
              <form onSubmit={submit}>
                <div className="fg3" style={{ marginBottom: 10 }}>
                  <div><label className="lbl">Tên sản phẩm *</label><input className="inp" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div><label className="lbl">SKU</label><input className="inp" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
                  <div><label className="lbl">Đơn vị</label><input className="inp" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
                  <div><label className="lbl">Giá vốn</label><MoneyInput value={form.costPrice} onChange={(v) => setForm({ ...form, costPrice: String(v) })} /></div>
                  <div><label className="lbl">Giá bán</label><MoneyInput value={form.sellingPrice} onChange={(v) => setForm({ ...form, sellingPrice: String(v) })} /></div>
                  <div><label className="lbl">Tồn kho</label><input className="inp" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div>
                  <div>
                    <label className="lbl">Thuế suất VAT</label>
                    <select className="inp" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })}>
                      {TAX_OPTIONS.map(t => <option key={t} value={t}>{t === 'KCT' ? 'KCT (không chịu thuế)' : t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn cyan">{editId ? '[ Cập nhật ]' : '[ Lưu ]'}</button>
                  <button type="button" className="btn ghost" onClick={() => setOpen(false)}>[ Hủy ]</button>
                </div>
              </form>
            </div>
          )}

          <FilterBar
            value={filter} onChange={setFilter}
            totalCount={rows.length} resultCount={filtered.length}
            searchPlaceholder="Tìm tên SP, SKU, đơn vị..."
            statusOptions={[
              { value: 'out', label: 'Hết hàng' },
              { value: 'low', label: 'Sắp hết (≤5)' },
              { value: 'ok',  label: 'Còn hàng' },
            ]}
            sortOptions={[
              { value: 'sold_desc',  label: '↓ Bán chạy nhất' },
              { value: 'date_desc',  label: '↓ Mới nhất' },
              { value: 'date_asc',   label: '↑ Cũ nhất' },
              { value: 'name_asc',   label: 'A→Z Tên SP' },
              { value: 'name_desc',  label: 'Z→A Tên SP' },
              { value: 'stock_asc',  label: '↑ Tồn ít nhất' },
              { value: 'stock_desc', label: '↓ Tồn nhiều nhất' },
              { value: 'price_desc', label: '↓ Giá bán cao nhất' },
              { value: 'price_asc',  label: '↑ Giá bán thấp nhất' },
            ]}
          />

          {/* Indicator khi filter được áp dụng từ dashboard */}
          {filter.status && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
              padding: '6px 12px', background: 'rgba(0,245,255,0.05)',
              border: '1px solid rgba(0,245,255,0.15)', borderRadius: 4, fontSize: 11,
            }}>
              <span style={{ color: 'var(--cyan)' }}>
                🔍 Đang lọc: {filter.status === 'low' ? 'Sắp hết hàng (≤5)' : filter.status === 'out' ? 'Hết hàng' : filter.status === 'ok' ? 'Còn hàng' : filter.status}
              </span>
              <button className="btn ghost btn-sm" style={{ fontSize: 9, padding: '2px 8px', marginLeft: 'auto' }}
                onClick={() => setFilter((f) => ({ ...f, status: '' }))}>
                ✕ Bỏ lọc
              </button>
            </div>
          )}

          <div className="table-wrap">
            <table className="nt">
              <thead>
                <tr>
                  <th>Tên SP</th><th>SKU</th><th>ĐVT</th>
                  <th>Giá vốn</th><th>Giá bán</th><th>VAT</th>
                  <th>Đã bán</th><th>Tồn kho</th><th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="skeleton-row">
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j}><div className="skeleton" style={{ height: 14, borderRadius: 3, width: j === 0 ? 120 : 60 }} /></td>
                    ))}
                  </tr>
                )) : <>
                  {filtered.length === 0 && (
                    <tr className="empty-row"><td colSpan={9}>
                      <EmptyState
                        icon="📦"
                        title={rows.length === 0 ? 'Chưa có sản phẩm' : 'Không tìm thấy kết quả'}
                        description={rows.length === 0 ? 'Thêm sản phẩm đầu tiên để bắt đầu quản lý kho.' : 'Thử thay đổi từ khóa hoặc bộ lọc.'}
                      />
                    </td></tr>
                  )}
                  {filtered.map((p) => {
                    const rank = getProductRank(p.totalRevenue ?? 0);
                    return (
                      <tr key={p.id} style={rank ? { background: `${rank.color}08` } : undefined}>
                        <td style={rank ? { borderLeft: `2px solid ${rank.color}55` } : undefined}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {rank && <span title={rank.label} style={{ fontSize: 14, flexShrink: 0 }}>{rank.icon}</span>}
                            <div>
                              <div className="fw7" style={rank ? { color: rank.color } : { color: 'var(--bright)' }}>{p.name}</div>
                              {rank && (
                                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, marginTop: 2, color: rank.color, textTransform: 'uppercase' }}>
                                  {rank.label}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="c-dim">{p.sku || '—'}</td>
                        <td>{p.unit}</td>
                        <td className="c-dim">{fmt(p.costPrice)}</td>
                        <td style={{ color: rank?.color ?? 'var(--cyan)' }} className="fw7">{fmt(p.sellingPrice)}</td>
                        <td><span className={`tag ${TAX_COLOR[p.taxRate] || 'cyan'}`}>{p.taxRate || '10%'}</span></td>
                        <td>
                          {(p.totalRevenue ?? 0) > 0 ? (
                            <>
                              <div className="fw7" style={{ color: rank?.color ?? 'var(--cyan)', fontSize: 12 }}>{fmt(p.totalRevenue)}</div>
                              <div className="c-dim" style={{ fontSize: 10 }}>{(p.totalSold ?? 0).toLocaleString('vi-VN')} {p.unit}</div>
                            </>
                          ) : <span className="c-dim">—</span>}
                        </td>
                        <td><span className={`tag ${p.stock <= 0 ? 'red' : p.stock <= 5 ? 'yellow' : 'green'}`}>{p.stock}</span></td>
                        <td><div className="td-act">
                          <button className="btn green btn-sm" onClick={() => setCardData({ type: 'product', id: p.id, name: p.name, createdAt: p.createdAt, sku: p.sku, unit: p.unit, costPrice: p.costPrice, sellingPrice: p.sellingPrice, stock: p.stock, totalSold: p.totalSold, totalRevenue: p.totalRevenue })}>Xem</button>
                          <button className="btn yellow btn-sm" onClick={() => openEdit(p)}>Sửa</button>
                          <button className={`btn ${isAdmin ? 'red' : 'ghost'} btn-sm`} onClick={() => handleDelete(p.id, p.name, p.stock)}>
                            {isAdmin ? 'Xóa' : '🗑 Yêu cầu'}
                          </button>
                        </div></td>
                      </tr>
                    );
                  })}
                </>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ══════════════ TAB: DASHBOARD ══════════════ */}
      {tab === 'dashboard' && (
        <ProductDashboard onJumpToList={jumpToList} />
      )}

      {/* ── Modals ── */}
      {deleteModal && (
        <RequestDeleteModal
          modelName="Product"
          recordId={deleteModal.id}
          recordLabel={deleteModal.name}
          onClose={() => setDeleteModal(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title={`Xóa sản phẩm "${confirmDelete.name}"`}
          message="Sản phẩm sẽ bị ẩn khỏi danh sách. Dữ liệu lịch sử hóa đơn và kho vẫn được giữ lại."
          warning={confirmDelete.stock > 0 ? `Sản phẩm còn ${confirmDelete.stock} đơn vị tồn kho — hãy kiểm tra trước khi xóa.` : undefined}
          confirmLabel="Xác nhận xóa"
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {cardData && (
        <div className="holo-modal-bg" onClick={() => setCardData(null)}>
          <div className="holo-modal-inner" onClick={(e) => e.stopPropagation()}>
            <HoloCard data={cardData} />
            <button className="holo-modal-close" onClick={() => setCardData(null)}>[ Đóng ]</button>
          </div>
        </div>
      )}
    </div>
  );
}
