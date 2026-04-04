import { useState } from 'react';

export interface FilterState {
  search: string;
  dateFrom: string;
  dateTo: string;
  status: string;
  type: string;
  amountMin: string;
  amountMax: string;
  sortBy: string;
  sortDir: 'asc' | 'desc';
}

export const defaultFilter: FilterState = {
  search: '', dateFrom: '', dateTo: '',
  status: '', type: '',
  amountMin: '', amountMax: '',
  sortBy: 'date', sortDir: 'desc',
};

interface StatusOption { value: string; label: string; cls?: string }
interface TypeOption   { value: string; label: string }
interface SortOption   { value: string; label: string } // e.g. "date_desc"

interface Props {
  value: FilterState;
  onChange: (v: FilterState) => void;
  totalCount: number;
  resultCount: number;
  searchPlaceholder?: string;
  statusOptions?: StatusOption[];
  typeOptions?: TypeOption[];
  sortOptions: SortOption[];
}

const inp: React.CSSProperties = {
  background: 'var(--input-bg,#1a1a2e)',
  border: '1px solid var(--border,#2a2a4a)',
  borderRadius: 4, color: 'var(--text-bright,#e0e0ff)',
  fontSize: 11, padding: '0 8px', height: 28,
};

export default function FilterBar({
  value, onChange, totalCount, resultCount,
  searchPlaceholder = 'Tìm kiếm...',
  statusOptions, typeOptions, sortOptions,
}: Props) {
  const [showFilter, setShowFilter] = useState(false);

  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch });

  // Combine sortBy+sortDir into single select value
  const sortVal = `${value.sortBy}_${value.sortDir}`;
  const handleSort = (v: string) => {
    const idx = v.lastIndexOf('_');
    set({ sortBy: v.slice(0, idx), sortDir: v.slice(idx + 1) as 'asc' | 'desc' });
  };

  const isFiltered =
    value.search || value.dateFrom || value.dateTo ||
    value.status || value.type || value.amountMin || value.amountMax;

  const clearAll = () => onChange({ ...defaultFilter, sortBy: value.sortBy, sortDir: value.sortDir });

  const activeCount = [value.search, value.dateFrom || value.dateTo, value.status, value.type, value.amountMin || value.amountMax]
    .filter(Boolean).length;

  return (
    <div style={{ marginBottom: 12 }}>
      {/* ── Main toolbar row ── */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* Search */}
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-dim)', pointerEvents: 'none' }}>🔍</span>
          <input
            style={{ ...inp, width: '100%', paddingLeft: 28, height: 32, boxSizing: 'border-box' }}
            placeholder={searchPlaceholder}
            value={value.search}
            onChange={(e) => set({ search: e.target.value })}
          />
          {value.search && (
            <span
              onClick={() => set({ search: '' })}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: 14, color: 'var(--text-dim)' }}>×</span>
          )}
        </div>

        {/* Filter toggle */}
        <button
          type="button"
          onClick={() => setShowFilter((v) => !v)}
          style={{
            ...inp, height: 32, padding: '0 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            borderColor: showFilter || activeCount > 0 ? 'var(--cyan)' : undefined,
            color: showFilter || activeCount > 0 ? 'var(--cyan)' : 'var(--text-dim)',
            whiteSpace: 'nowrap',
          }}
        >
          <span>⚙</span>
          <span>Lọc</span>
          {activeCount > 0 && (
            <span style={{ background: 'var(--cyan)', color: '#000', borderRadius: 10, fontSize: 9, padding: '1px 5px', fontWeight: 700 }}>{activeCount}</span>
          )}
        </button>

        {/* Sort */}
        <select
          value={sortVal}
          onChange={(e) => handleSort(e.target.value)}
          style={{ ...inp, height: 32, cursor: 'pointer', paddingRight: 6 }}
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* ── Filter panel ── */}
      {showFilter && (
        <div style={{
          marginTop: 6, padding: '10px 12px',
          background: 'rgba(0,180,255,0.03)',
          border: '1px solid rgba(0,180,255,0.15)',
          borderRadius: 4,
          display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end',
        }}>
          {/* Date range */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>Từ ngày</span>
            <input type="date" style={{ ...inp, height: 28 }} value={value.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} />
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>→</span>
            <input type="date" style={{ ...inp, height: 28 }} value={value.dateTo} onChange={(e) => set({ dateTo: e.target.value })} />
          </div>

          {/* Status filter */}
          {statusOptions && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>Trạng thái</span>
              <select style={{ ...inp, height: 28 }} value={value.status} onChange={(e) => set({ status: e.target.value })}>
                <option value="">Tất cả</option>
                {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}

          {/* Type filter */}
          {typeOptions && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>Loại</span>
              <select style={{ ...inp, height: 28 }} value={value.type} onChange={(e) => set({ type: e.target.value })}>
                <option value="">Tất cả</option>
                {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}

          {/* Amount range */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>Tiền</span>
            <input type="number" placeholder="Tối thiểu" style={{ ...inp, height: 28, width: 100 }} value={value.amountMin} onChange={(e) => set({ amountMin: e.target.value })} />
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>~</span>
            <input type="number" placeholder="Tối đa" style={{ ...inp, height: 28, width: 100 }} value={value.amountMax} onChange={(e) => set({ amountMax: e.target.value })} />
          </div>

          {/* Clear filters */}
          {isFiltered && (
            <button type="button" onClick={clearAll}
              style={{ ...inp, height: 28, padding: '0 10px', cursor: 'pointer', color: 'var(--red)', borderColor: 'rgba(255,0,85,0.3)', whiteSpace: 'nowrap' }}>
              × Xóa bộ lọc
            </button>
          )}
        </div>
      )}

      {/* ── Result count ── */}
      {(isFiltered || resultCount !== totalCount) && (
        <div style={{ marginTop: 5, fontSize: 10, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>
            Hiển thị <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>{resultCount}</span> / {totalCount} kết quả
          </span>
          {isFiltered && (
            <span onClick={clearAll} style={{ cursor: 'pointer', color: 'var(--red)', textDecoration: 'underline' }}>× Xóa bộ lọc</span>
          )}
        </div>
      )}
    </div>
  );
}
