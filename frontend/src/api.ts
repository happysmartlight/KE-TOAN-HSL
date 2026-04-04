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

export default api;
