import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import api from './api.ts'

// ── Global JS runtime error handler ──
// Bắt mọi lỗi JS không được xử lý và gửi về server log
window.onerror = (message, source, lineno, colno, error) => {
  const text = `[JS Error] ${message} @ ${source}:${lineno}:${colno}` +
    (error?.stack ? ` | ${error.stack.split('\n')[0]}` : '');
  api.post('/logs/client-error', { message: text, level: 'error', source: 'frontend-js' })
    .catch(() => { /* silent */ });
};

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const text = `[Unhandled Promise] ${reason?.message || String(reason)}` +
    (reason?.stack ? ` | ${reason.stack.split('\n')[0]}` : '');
  api.post('/logs/client-error', { message: text, level: 'error', source: 'frontend-promise' })
    .catch(() => { /* silent */ });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
