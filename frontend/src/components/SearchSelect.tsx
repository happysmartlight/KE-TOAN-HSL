import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  meta?: string;
  disabled?: boolean;
}

interface Props {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  style?: React.CSSProperties;
}

export default function SearchSelect({ options, value, onChange, placeholder = '-- Chọn --', required, style }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  // Tính vị trí dropdown từ bounding rect của container
  const calcPos = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropH = 260;
    // Nếu không đủ chỗ bên dưới nhưng đủ bên trên → mở lên trên
    const openUpward = spaceBelow < dropH && spaceAbove > spaceBelow;
    setDropdownPos({
      top: openUpward ? rect.top + window.scrollY - dropH - 2 : rect.bottom + window.scrollY + 2,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  };

  // Đóng khi click ngoài
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const dropdown = document.getElementById('search-select-portal');
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdown && !dropdown.contains(target)
      ) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Cập nhật vị trí khi scroll/resize
  useEffect(() => {
    if (!open) return;
    const update = () => calcPos();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  const filtered = query.trim()
    ? options.filter((o) => {
        const q = query.toLowerCase();
        return (
          o.label.toLowerCase().includes(q) ||
          (o.sublabel?.toLowerCase().includes(q) ?? false) ||
          (o.meta?.toLowerCase().includes(q) ?? false)
        );
      })
    : options;

  const handleSelect = (opt: SelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  };

  const handleOpen = () => {
    calcPos();
    setOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setOpen(false);
    setQuery('');
  };

  const dropdown = open && createPortal(
    <div
      id="search-select-portal"
      style={{
        position: 'absolute',
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        zIndex: 9999,
        background: 'var(--sidebar-bg, #12122a)',
        border: '1px solid var(--border, #2a2a4a)',
        borderRadius: 4,
        maxHeight: 260,
        overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}
    >
      {filtered.length === 0 ? (
        <div style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-dim)' }}>
          Không tìm thấy kết quả
        </div>
      ) : (
        filtered.map((opt) => (
          <div
            key={opt.value}
            onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
            style={{
              padding: '8px 12px',
              cursor: opt.disabled ? 'default' : 'pointer',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              opacity: opt.disabled ? 0.4 : 1,
              background: opt.value === value ? 'rgba(0,180,255,0.08)' : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (!opt.disabled) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background =
                opt.value === value ? 'rgba(0,180,255,0.08)' : 'transparent';
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--text-bright, #e0e0ff)', fontWeight: opt.value === value ? 700 : 400 }}>
              {opt.label}
              {opt.value === value && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--cyan)' }}>✓</span>}
            </div>
            {opt.sublabel && (
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>{opt.sublabel}</div>
            )}
            {opt.meta && (
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>{opt.meta}</div>
            )}
          </div>
        ))
      )}
    </div>,
    document.body
  );

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      {/* Trigger / display */}
      {!open ? (
        <div
          onClick={handleOpen}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 10px', height: 34, cursor: 'pointer',
            background: 'var(--input-bg, #1a1a2e)',
            border: '1px solid var(--border, #2a2a4a)',
            borderRadius: 4, fontSize: 12,
            color: selected ? 'var(--text-bright, #e0e0ff)' : 'var(--text-dim, #6060a0)',
            userSelect: 'none',
          }}
        >
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected ? (
              <>
                {selected.label}
                {selected.sublabel && (
                  <span style={{ color: 'var(--text-dim)', marginLeft: 6, fontSize: 11 }}>
                    — {selected.sublabel}
                  </span>
                )}
              </>
            ) : placeholder}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 6, flexShrink: 0 }}>
            {value && (
              <span onClick={handleClear} style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1, cursor: 'pointer' }}>×</span>
            )}
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>▾</span>
          </span>
        </div>
      ) : (
        <input
          ref={inputRef}
          className="inp"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nhập để tìm kiếm..."
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setOpen(false); setQuery(''); }
            if (e.key === 'Enter' && filtered.length === 1) handleSelect(filtered[0]);
          }}
          onBlur={(e) => {
            // Không đóng nếu click vào dropdown portal
            const related = e.relatedTarget as Node;
            const portal = document.getElementById('search-select-portal');
            if (portal && portal.contains(related)) return;
          }}
          style={{ width: '100%' }}
          autoComplete="off"
        />
      )}

      {/* Hidden native input for form validation */}
      {required && (
        <input
          tabIndex={-1}
          required
          value={value}
          onChange={() => {}}
          style={{ opacity: 0, height: 0, position: 'absolute', pointerEvents: 'none' }}
        />
      )}

      {dropdown}
    </div>
  );
}
