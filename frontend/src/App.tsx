import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Clock from './components/Clock';
import { ToastContainer } from './components/Toast';
import api from './api';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Invoices from './pages/Invoices';
import Cashflow from './pages/Cashflow';
import Reports from './pages/Reports';
import Products from './pages/Products';
import Suppliers from './pages/Suppliers';
import Purchases from './pages/Purchases';
import Users from './pages/Users';
import Requests from './pages/Requests';
import CashflowCategories from './pages/CashflowCategories';
import SystemAdmin from './pages/SystemAdmin';
import SystemHealth from './pages/SystemHealth';
import AutoBackup from './pages/AutoBackup';
import MyProfile from './pages/MyProfile';
import RankConfig from './pages/RankConfig';
import Login from './pages/Login';
import FirstRunSetup from './pages/FirstRunSetup';
import NetworkSetup from './pages/NetworkSetup';
import { setRankConfig } from './components/HoloCard';

const NAV = [
  { group: 'Tổng quan', groupIcon: '🏠', items: [
    { to: '/', label: 'Dashboard', icon: '📊' },
  ]},
  { group: 'Danh mục', groupIcon: '📁', items: [
    { to: '/customers', label: 'Khách hàng',   icon: '👥' },
    { to: '/suppliers', label: 'Nhà cung cấp', icon: '🏭' },
    { to: '/products',  label: 'Sản phẩm',     icon: '📦' },
  ]},
  { group: 'Nghiệp vụ', groupIcon: '⚡', items: [
    { to: '/invoices',  label: 'Hóa đơn bán', icon: '🧾' },
    { to: '/purchases', label: 'Nhập hàng',   icon: '🛒' },
    { to: '/cashflow',  label: 'Thu / Chi',   icon: '💰' },
  ]},
  { group: 'Phân tích', groupIcon: '📈', items: [
    { to: '/reports', label: 'Báo cáo', icon: '📋' },
  ]},
];

const PAGE_NAMES: Record<string, string> = {
  '/': 'Dashboard', '/customers': 'Khách hàng', '/suppliers': 'Nhà cung cấp',
  '/products': 'Sản phẩm', '/invoices': 'Hóa đơn bán', '/purchases': 'Nhập hàng',
  '/cashflow': 'Thu / Chi', '/reports': 'Báo cáo', '/users': 'Nhân sự',
  '/requests': 'Quản lý yêu cầu', '/cashflow-categories': 'Danh mục Thu/Chi',
  '/rank-config':   'Cấu hình Rank',
  '/system-admin':  'Quản trị dữ liệu',
  '/network-setup': 'Thiết lập mạng',
  '/system-health': 'Trạng thái server',
  '/auto-backup':   'Cài đặt Backup',
  '/my-profile': 'Hồ sơ của tôi',
  '/my-delete-requests': 'Yêu cầu xóa của tôi',
};

function AppLayout() {
  const { user, loading, needsSetup, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Load rank config after login (admin only — staff use defaults)
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    api.get('/admin/rank-config').then((r) => {
      const d = r.data;
      if (d) setRankConfig({ customer: d.customer, supplier: d.supplier, product: d.product, user: d.user });
    }).catch(() => {});
  }, [user?.id]);

  // Load version after login
  useEffect(() => {
    if (!user) return;
    api.get('/admin/version').then((r) => {
      if (r.data?.version) setVersion(r.data.version);
    }).catch(() => {});
  }, [user?.id]);

  const [pendingCount, setPendingCount] = useState(0);
  const [purCount, setPurCount] = useState(0);
  const requestsPending = pendingCount + purCount;
  const [myDeleteCount, setMyDeleteCount] = useState(0);
  const [version, setVersion] = useState<string>('1.0.0');

  // Close sidebar when route changes (mobile)
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // Poll pending delete requests count for admin badge
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    const fetch = () => api.get('/delete-requests/count').then((r) => setPendingCount(r.data.count)).catch(() => {});
    fetch();
    const id = setInterval(fetch, 30_000);
    return () => clearInterval(id);
  }, [user]);

  // Poll pending profile update requests count for admin badge
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    const fetch = () => api.get('/profile-update-requests/count').then((r) => setPurCount(r.data.count)).catch(() => {});
    fetch();
    const id = setInterval(fetch, 30_000);
    return () => clearInterval(id);
  }, [user]);

  // Poll my delete requests count for staff badge
  useEffect(() => {
    if (!user || user.role === 'admin') return;
    const fetch = () => api.get('/delete-requests/mine/count').then((r) => setMyDeleteCount(r.data.count)).catch(() => {});
    fetch();
    const id = setInterval(fetch, 30_000);
    return () => clearInterval(id);
  }, [user]);

  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#07070f', color: '#00f5ff', fontFamily: 'monospace', fontSize: 13 }}>
        <span>Đang khởi động<span className="blink"> _</span></span>
      </div>
    );
  }

  // Lần chạy đầu (DB rỗng) → trang khởi tạo admin thay vì login.
  // Sau khi setup thành công, AuthContext set user → branch dưới render Dashboard.
  if (needsSetup) return <FirstRunSetup />;
  if (!user) return <Login />;

  const pageName = PAGE_NAMES[location.pathname] || location.pathname;

  return (
    <div className="app-shell">
      {/* ── Mobile overlay ── */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ── Sidebar ── */}
      <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-text">
            <span className="logo-prompt">{'>'}_</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 1 }}>
              <span className="logo-line1">HAPPY</span>
              <span style={{ fontSize: 9, color: 'rgba(0,245,255,0.5)', fontWeight: 400 }}>v{version}</span>
            </div>
            <span className="logo-line2">SMART<span className="logo-accent"> LIGHT</span></span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((group) => (
            <div key={group.group} className="nav-group">
              <div className="nav-group-label">
                <span className="nav-group-icon">{group.groupIcon}</span>
                {group.group}
              </div>
              <div className="nav-group-children">
                {group.items.map(({ to, label, icon }) => (
                  <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                    <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{icon}</span>
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}

          {/* Cá nhân — all users */}
          <div className="nav-group">
            <div className="nav-group-label">
              <span className="nav-group-icon">👤</span>
              Cá nhân
            </div>
            <div className="nav-group-children">
              <NavLink to="/my-profile" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>🪪</span>
                Hồ sơ của tôi
              </NavLink>
              {user.role !== 'admin' && (
                <NavLink to="/my-delete-requests" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>🗑️</span>
                  Yêu cầu xóa của tôi
                  {myDeleteCount > 0 && <span className="nav-badge">{myDeleteCount}</span>}
                </NavLink>
              )}
            </div>
          </div>

          {user.role === 'admin' && (
            <div className="nav-group">
              <div className="nav-group-label">
                <span className="nav-group-icon">⚙️</span>
                Hệ thống
              </div>
              <div className="nav-group-children">
                <NavLink to="/users" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>👤</span>
                  Nhân sự
                </NavLink>
                <NavLink to="/requests" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>📋</span>
                  Quản lý yêu cầu
                  {requestsPending > 0 && <span className="nav-badge">{requestsPending}</span>}
                </NavLink>
                <NavLink to="/cashflow-categories" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>📂</span>
                  Danh mục Thu/Chi
                </NavLink>
                <NavLink to="/network-setup" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>🌐</span>
                  Thiết lập mạng
                </NavLink>
                <NavLink to="/system-health" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>📡</span>
                  Trạng thái server
                </NavLink>
                <NavLink to="/auto-backup" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>💾</span>
                  Cài đặt Backup
                </NavLink>
                <NavLink to="/rank-config" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>🏆</span>
                  Cấu hình Rank
                </NavLink>
                <NavLink to="/system-admin" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>⚙</span>
                  Quản trị dữ liệu
                </NavLink>
              </div>
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-name">{user.name}</div>
          <div className={`user-role-badge ${user.role === 'admin' ? 'role-admin' : 'role-staff'}`}>
            {user.role === 'admin' ? 'Admin' : 'Staff'}
          </div>
          <button className="btn-logout" onClick={logout}>[ Đăng xuất ]</button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main-content">
        <div className="topbar">
          {/* Hamburger — mobile only */}
          <button className="hamburger" onClick={() => setSidebarOpen((v) => !v)} aria-label="Menu">
            <span /><span /><span />
          </button>
          <span className="topbar-item">HSL</span>
          <span className="topbar-sep">/</span>
          <span className="topbar-item active">{pageName}</span>
          <Clock />
        </div>
        <div className="page-area">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/products" element={<Products />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/purchases" element={<Purchases />} />
            <Route path="/cashflow" element={<Cashflow />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/users" element={<Users />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/cashflow-categories" element={<CashflowCategories />} />
            <Route path="/rank-config" element={<RankConfig />} />
            <Route path="/system-admin" element={<SystemAdmin />} />
            <Route path="/network-setup" element={<NetworkSetup />} />
            <Route path="/system-health" element={<SystemHealth />} />
            <Route path="/my-profile" element={<MyProfile />} />
            <Route path="/auto-backup" element={<AutoBackup />} />
            <Route path="/my-delete-requests" element={<MyProfile initialTab="delete-requests" />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
        <ToastContainer />
      </AuthProvider>
    </BrowserRouter>
  );
}
