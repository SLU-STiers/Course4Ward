import { useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { PATH_ROLE } from '../../routes/roleRoutes';

const KNOWN_SHELL_PATHS = ['/physician', '/nurse', '/claims', '/admin'];

export function AppLayout() {
  const { user, logout, setAuth, accessToken, refreshToken } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Browsers/OS address bars sometimes auto-capitalize the first letter typed
  // (e.g. "/Physician" instead of "/physician"). Normalize casing so route
  // matching and the shell detection below stay reliable either way.
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  const lowerPath = normalizedPath.toLowerCase();
  const hasOwnShell = KNOWN_SHELL_PATHS.some(
    (path) => lowerPath === path || lowerPath.startsWith(`${path}/`)
  );

  useEffect(() => {
    if (!import.meta.env.DEV || !user || !accessToken || !refreshToken) return;
    const role = PATH_ROLE[lowerPath];
    if (!role || user.role === role) return;
    setAuth(accessToken, refreshToken, { ...user, role, lastName: role });
  }, [accessToken, lowerPath, refreshToken, setAuth, user]);

  if (hasOwnShell) {
    // Snap the address bar back to the canonical lowercase path so it never
    // sticks on a capitalized variant like "/Physician".
    if (normalizedPath !== lowerPath) {
      return <Navigate to={`${lowerPath}${location.search}${location.hash}`} replace />;
    }
    return <Outlet />;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 24px',
          background: '#0f172a',
          color: 'white',
        }}
      >
        <div>
          <strong>SLU Sacred Heart CIMS</strong>
          <span style={{ marginLeft: 12, fontSize: 13, opacity: 0.75 }}>{user?.role}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13 }}>
            {user?.firstName} {user?.lastName}
          </span>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            style={{
              background: '#1e293b',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Log out
          </button>
        </div>
      </header>
      <main style={{ padding: 24 }}>
        <Outlet />
      </main>
    </div>
  );
}
