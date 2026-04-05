import { useEffect, useRef } from 'react';

/**
 * Lắng nghe phím ESC — khi handler != null thì kích hoạt.
 * Dùng ref để tránh stale closure; listener đăng ký 1 lần.
 * Ưu tiên: truyền handler của modal "trong cùng" trước.
 */
export function useEscKey(handler: (() => void) | null) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && ref.current) ref.current();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, []);
}

/**
 * Lắng nghe ENTER (không phải trong textarea) — dùng cho form confirm nhanh.
 */
export function useEnterKey(handler: (() => void) | null) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (
        e.key === 'Enter' &&
        ref.current &&
        (e.target as HTMLElement).tagName !== 'TEXTAREA' &&
        !(e.target as HTMLElement).closest?.('form')
      ) {
        ref.current();
      }
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, []);
}
