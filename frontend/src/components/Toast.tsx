import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

type ToastType = 'success' | 'error' | 'warn' | 'info';

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

// ── Singleton event bus ──────────────────────────────────────────────────────
type Listener = (item: ToastItem) => void;
const listeners: Listener[] = [];
let counter = 0;

function emit(message: string, type: ToastType) {
  const item: ToastItem = { id: ++counter, message, type };
  listeners.forEach((fn) => fn(item));
}

// ── Public API (import and call anywhere) ────────────────────────────────────
export const toast = {
  success: (msg: string) => emit(msg, 'success'),
  error:   (msg: string) => emit(msg, 'error'),
  warn:    (msg: string) => emit(msg, 'warn'),
  info:    (msg: string) => emit(msg, 'info'),
};

// ── Styles ───────────────────────────────────────────────────────────────────
const TYPE_STYLE: Record<ToastType, { border: string; color: string; bg: string; icon: string }> = {
  success: { border: 'rgba(0,255,136,0.35)',  color: '#00ff88', bg: 'rgba(0,255,136,0.07)',  icon: '✓' },
  error:   { border: 'rgba(255,0,85,0.4)',    color: '#ff0055', bg: 'rgba(255,0,85,0.08)',   icon: '✗' },
  warn:    { border: 'rgba(255,204,0,0.4)',   color: '#ffcc00', bg: 'rgba(255,204,0,0.07)',  icon: '⚠' },
  info:    { border: 'rgba(0,245,255,0.35)',  color: '#00f5ff', bg: 'rgba(0,245,255,0.07)',  icon: '◈' },
};

// ── Single toast item ─────────────────────────────────────────────────────────
function ToastCard({ item, onRemove }: { item: ToastItem; onRemove: (id: number) => void }) {
  const [visible, setVisible] = useState(false);
  const s = TYPE_STYLE[item.type];

  useEffect(() => {
    // Entrance
    const t1 = setTimeout(() => setVisible(true), 10);
    // Auto-dismiss
    const t2 = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(item.id), 280);
    }, item.type === 'error' ? 5000 : 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [item.id, item.type, onRemove]);

  return (
    <div
      onClick={() => { setVisible(false); setTimeout(() => onRemove(item.id), 280); }}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 14px',
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderLeft: `3px solid ${s.color}`,
        borderRadius: 4,
        boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 12px ${s.border}`,
        backdropFilter: 'blur(8px)',
        cursor: 'pointer',
        maxWidth: 360, minWidth: 260,
        fontFamily: "'JetBrains Mono','Courier New',monospace",
        fontSize: 12,
        transition: 'opacity 0.28s, transform 0.28s',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(20px)',
        userSelect: 'none',
      }}
    >
      <span style={{ color: s.color, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
      <span style={{ color: '#d0d0e8', lineHeight: 1.5 }}>{item.message}</span>
    </div>
  );
}

// ── Container (mount once in App) ─────────────────────────────────────────────
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const add = useCallback((item: ToastItem) => {
    setToasts((prev) => [...prev.slice(-4), item]); // max 5 at once
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    listeners.push(add);
    return () => { const i = listeners.indexOf(add); if (i >= 0) listeners.splice(i, 1); };
  }, [add]);

  return createPortal(
    <div style={{
      position: 'fixed', bottom: 20, right: 20,
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 9999, pointerEvents: 'none',
    }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ pointerEvents: 'all' }}>
          <ToastCard item={t} onRemove={remove} />
        </div>
      ))}
    </div>,
    document.body
  );
}
