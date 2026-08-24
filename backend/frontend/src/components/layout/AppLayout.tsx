import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export function AppLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

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
