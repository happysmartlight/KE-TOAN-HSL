import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import api from '../api';

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /** True khi DB chưa có user nào — App render <FirstRunSetup /> thay vì <Login /> */
  needsSetup: boolean;
  login:      (username: string, password: string, remember: boolean) => Promise<void>;
  setupAdmin: (username: string, name: string, password: string) => Promise<void>;
  logout:     () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const getToken = () =>
  localStorage.getItem('token') || sessionStorage.getItem('token');

const setToken = (token: string, remember: boolean) => {
  if (remember) {
    localStorage.setItem('token', token);
    sessionStorage.removeItem('token');
  } else {
    sessionStorage.setItem('token', token);
    localStorage.removeItem('token');
  }
};

const clearToken = () => {
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]             = useState<User | null>(null);
  const [loading, setLoading]       = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const tryRestoreSession = async () => {
      const token = getToken();
      if (!token) return;
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      try {
        const me = await api.get('/auth/me');
        if (!cancelled) setUser(me.data);
      } catch {
        clearToken();
        delete api.defaults.headers.common['Authorization'];
      }
    };

    (async () => {
      try {
        // Bước 1: hỏi backend xem hệ thống đã được khởi tạo chưa.
        // Nếu chưa → render FirstRunSetup, KHÔNG cần restore session.
        const status = await api.get('/auth/setup-status');
        if (cancelled) return;
        if (status.data?.needsSetup) {
          setNeedsSetup(true);
          return;
        }
        // Bước 2: hệ thống đã init → cố restore session từ token cũ
        await tryRestoreSession();
      } catch {
        // Endpoint setup-status có thể không phản hồi (server tạm dừng,
        // CORS lỗi...) — fallback sang flow login bình thường.
        await tryRestoreSession();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const login = async (username: string, password: string, remember: boolean) => {
    const res = await api.post('/auth/login', { username, password });
    const { token, user } = res.data;
    setToken(token, remember);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(user);
  };

  const setupAdmin = async (username: string, name: string, password: string) => {
    // POST /auth/setup vừa tạo admin vừa trả token (auto-login)
    const res = await api.post('/auth/setup', { username, name, password });
    const { token, user } = res.data;
    // Setup luôn dùng remember=true: người dùng vừa cài hệ thống, không lý do gì bắt họ login lại
    setToken(token, true);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(user);
    setNeedsSetup(false);
  };

  const logout = () => {
    clearToken();
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, needsSetup, login, setupAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
