import { useRef, useState, useEffect } from 'react';

interface Props {
  value: string;               // yyyy-mm-dd hoặc ''
  onChange: (val: string) => void; // trả về yyyy-mm-dd
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties; // áp dụng cho wrapper div
  disabled?: boolean;
}

/** yyyy-mm-dd → dd/mm/yyyy để hiển thị */
function toDisplay(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

/** dd/mm/yyyy → yyyy-mm-dd. Trả về '' nếu không hợp lệ */
function toIso(display: string): string {
  const parts = display.split('/');
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  if (!d || !m || !y || y.length !== 4) return '';
  const dd = d.padStart(2, '0');
  const mm = m.padStart(2, '0');
  const date = new Date(`${y}-${mm}-${dd}`);
  if (isNaN(date.getTime())) return '';
  return `${y}-${mm}-${dd}`;
}

export default function DatePicker({
  value, onChange,
  placeholder = 'dd/mm/yyyy',
  className = 'inp',
  style,
  disabled,
}: Props) {
  const [text, setText] = useState(() => toDisplay(value));
  const calRef = useRef<HTMLInputElement>(null);

  // Đồng bộ khi value prop thay đổi từ bên ngoài
  useEffect(() => {
    setText(toDisplay(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const prev = text;

    // Nếu đang xóa → cho phép tự do
    if (raw.length < prev.length) {
      setText(raw);
      if (!raw) onChange('');
      return;
    }

    // Chỉ giữ số, tự chèn dấu /
    const digits = raw.replace(/[^0-9]/g, '');
    let fmt = '';
    if (digits.length <= 2)      fmt = digits;
    else if (digits.length <= 4) fmt = digits.slice(0, 2) + '/' + digits.slice(2);
    else                         fmt = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);

    setText(fmt);
    const iso = toIso(fmt);
    if (iso) onChange(iso);
    else if (!fmt) onChange('');
  };

  const handleBlur = () => {
    const iso = toIso(text);
    if (iso) {
      setText(toDisplay(iso)); // chuẩn hóa lại
      onChange(iso);
    } else if (!text) {
      onChange('');
    }
  };

  const handleCalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value; // yyyy-mm-dd
    onChange(iso);
    setText(toDisplay(iso));
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, ...style }}>
      <input
        className={className}
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        maxLength={10}
        disabled={disabled}
        style={{ flex: 1, marginBottom: 0 }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => calRef.current?.showPicker?.()}
        title="Chọn từ lịch"
        style={{
          flexShrink: 0,
          background: 'rgba(0,245,255,0.07)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: '5px 9px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: 'var(--cyan)',
          fontSize: 15,
          lineHeight: 1,
          opacity: disabled ? 0.4 : 1,
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,245,255,0.15)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,245,255,0.07)'; }}
      >
        📅
      </button>
      {/* Hidden native date input — chỉ dùng để mở calendar popup */}
      <input
        ref={calRef}
        type="date"
        value={value}
        onChange={handleCalChange}
        tabIndex={-1}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
      />
    </div>
  );
}
