import axios from 'axios';

// In production: frontend is served by the backend, so use relative /api
// In development: use env var (set VITE_API_URL=http://192.168.x.x:3001/api for LAN access)
const baseURL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL || 'http://localhost:3001/api');

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

// ── Response error interceptor: gửi lỗi API về server log ──
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const url: string = error.config?.url || '';

    // Tránh vòng lặp vô tận — không log lỗi từ chính endpoint log
    if (!url.includes('client-error') && !url.includes('/auth/login')) {
      const status: number = error.response?.status ?? 0;
      const errMsg: string = error.response?.data?.error || error.message || 'Unknown error';
      const method: string = (error.config?.method || 'GET').toUpperCase();

      // Chỉ log lỗi có status code (không log network offline)
      if (status > 0) {
        const level = status >= 500 ? 'error' : 'warning';
        api.post('/logs/client-error', {
          message: `[${method} ${url}] ${status} — ${errMsg}`,
          level,
          source: 'frontend-api',
        }).catch(() => { /* silent */ });
      }
    }

    return Promise.reject(error);
  }
);

export default api;
