import { useEffect, useRef, useState } from 'react';

interface MoneyInputProps {
  value: number | string;
  onChange: (value: number) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  required?: boolean;
}

/** Input tiền VN — hiển thị "1.500.000", lưu số nguyên 1500000 */
export default function MoneyInput({
  value,
  onChange,
  className = 'inp',
  placeholder = '0',
  ...rest
}: MoneyInputProps) {
  const fmt = (n: number | string) => {
    const num = Number(String(n).replace(/\./g, ''));
    if (!num && num !== 0) return '';
    return num.toLocaleString('vi-VN');
  };

  const [display, setDisplay] = useState(fmt(value));
  const skipSync = useRef(false);

  // Sync khi value thay đổi từ bên ngoài (reset form)
  useEffect(() => {
    if (skipSync.current) { skipSync.current = false; return; }
    setDisplay(fmt(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
    const num = raw ? parseInt(raw, 10) : 0;
    skipSync.current = true;
    setDisplay(raw ? num.toLocaleString('vi-VN') : '');
    onChange(num);
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      className={className}
      placeholder={placeholder}
      value={display}
      onChange={handleChange}
    />
  );
}
