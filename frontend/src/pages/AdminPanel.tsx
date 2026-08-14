import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../services/domainApi';
import { useAuthStore } from '../store/authStore';

// Import Logo
import logoImg from '../Img/Course4Ward-Logo.png';

export function AdminPanel() {
  const [activeNav, setActiveNav] = useState<'dashboard' | 'users' | 'requests'>('dashboard');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout(); // Clears Zustand state and deletes sessionStorage['cims_auth'] automatically
    navigate('/login', { replace: true });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div style={styles.appContainer}>
      {/* LEFT SIDEBAR */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarLogoContainer}>
          <img src={logoImg} alt="Course4Ward" style={styles.sidebarLogo} />
        </div>

        <nav style={styles.sidebarNav}>
          <button
            style={{
              ...styles.navButton,
              ...(activeNav === 'dashboard' ? styles.navButtonActive : {}),
            }}
            onClick={() => setActiveNav('dashboard')}
          >
            <span style={styles.navIcon}>📊</span> Dashboard
          </button>

          <button
            style={{
              ...styles.navButton,
              ...(activeNav === 'users' ? styles.navButtonActive : {}),
            }}
            onClick={() => setActiveNav('users')}
          >
            <span style={styles.navIcon}>👤</span> Users
          </button>

          <button
            style={{
              ...styles.navButton,
              ...(activeNav === 'requests' ? styles.navButtonActive : {}),
            }}
            onClick={() => setActiveNav('requests')}
          >
            <span style={styles.navIcon}>💬</span> Requests
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div style={styles.mainWrapper}>
        {/* TOP HEADER */}
        <header style={styles.header}>
          <h2 style={styles.headerTitle}>Good Day! Admin</h2>

          <div style={styles.headerRight}>
            {/* Notification Bell */}
            <div style={styles.notificationBadge}>
              <span style={{ fontSize: '18px' }}>🔔</span>
              <span style={styles.badgeCount}>2</span>
            </div>

            {/* Profile Dropdown */}
            <div style={styles.profileContainer} ref={dropdownRef}>
              <button
                style={styles.profileButton}
                onClick={() => setShowProfileMenu((prev) => !prev)}
              >
                <div style={styles.avatarCircle}>
                  <span>👤</span>
                </div>
                <span style={styles.userName}>
                  {user?.firstName ? `${user.firstName} ${user.lastName}` : 'Swan Johnson'}
                </span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>▼</span>
              </button>

              {showProfileMenu && (
                <div style={styles.dropdownMenu}>
                  <button style={styles.dropdownItem} onClick={handleLogout}>
                    <span style={{ marginRight: '8px' }}>🚪</span> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* BODY CONTENT */}
        <main style={styles.content}>
          {activeNav === 'dashboard' && <DashboardView />}
          {activeNav === 'users' && <AccountsPanel />}
          {activeNav === 'requests' && <RequestsView />}
        </main>
      </div>
    </div>
  );
}

/* ==========================================================================
   DASHBOARD VIEW (Matching image metrics & activity log table)
   ========================================================================== */
function DashboardView() {
  const { data: logs } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => adminApi.auditLogs({ take: 50 }).then((r) => r.data),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* METRIC CARDS ROW */}
      <div style={styles.metricsGrid}>
        <MetricCard
          title="Total Users"
          value="67"
          trend="8.5% Up from yesterday"
          isUp={true}
          icon="👤"
        />
        <MetricCard
          title="CF4 Pending"
          value="25"
          trend="1.2% Up from yesterday"
          isUp={true}
          icon="🕒"
        />
        <MetricCard
          title="CF4 Approved"
          value="24"
          trend="4.3% Down from yesterday"
          isUp={false}
          icon="👤"
        />
        <MetricCard
          title="CF4 Rejected"
          value="13"
          trend="3.1% Up from yesterday"
          isUp={true}
          icon="👤"
        />
      </div>

      {/* ACTIVITY LOGS SECTION */}
      <div style={styles.cardContainer}>
        {/* Table Filters Bar */}
        <div style={styles.tableHeaderBar}>
          <h3 style={styles.tableTitle}>Activity Logs</h3>

          <div style={styles.filtersContainer}>
            <div style={styles.filterGroup}>
              <span style={{ fontSize: '14px', color: '#64748b' }}>🔍</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                Filter By
              </span>
            </div>

            <select style={styles.filterSelect} defaultValue="14 Feb 2026">
              <option>14 Feb 2026</option>
            </select>

            <select style={styles.filterSelect} defaultValue="">
              <option value="" disabled selected hidden>
                Order Type
              </option>
              <option value="all">All</option>
            </select>

            <select style={styles.filterSelect} defaultValue="">
              <option value="" disabled selected hidden>
                Order Status
              </option>
              <option value="all">All</option>
            </select>

            <button style={styles.resetButton}>🔄 Reset Filter</button>
          </div>
        </div>

        {/* Activity Table */}
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>NAME</th>
              <th style={styles.th}>PROFESSION</th>
              <th style={styles.th}>DATE</th>
              <th style={styles.th}>TIME</th>
            </tr>
          </thead>
          <tbody>
            {logs && logs.length > 0 ? (
              logs.map((l: any, idx: number) => {
                const dateObj = new Date(l.createdAt);
                return (
                  <tr key={l.id || idx} style={styles.tr}>
                    <td style={styles.td}>{String(idx + 1).padStart(5, '0')}</td>
                    <td style={styles.td}>
                      {l.user ? `${l.user.firstName} ${l.user.lastName}` : 'System User'}
                    </td>
                    <td style={styles.td}>{l.user?.role || 'Doctor'}</td>
                    <td style={styles.td}>{dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td style={styles.td}>{dateObj.toLocaleTimeString()}</td>
                  </tr>
                );
              })
            ) : (
              // Mock items as shown in mockup
              <>
                <MockLogRow id="00001" name="Christine Brooks" profession="Doctor" date="14 Feb 2026" time="14:37:52" />
                <MockLogRow id="00002" name="Rosie Pearson" profession="Nurse" date="14 Feb 2026" time="14:37:52" />
                <MockLogRow id="00003" name="Darrell Caldwell" profession="Doctor" date="14 Feb 2026" time="14:37:52" />
                <MockLogRow id="00004" name="Gilbert Johnston" profession="Doctor" date="14 Feb 2026" time="14:37:52" />
                <MockLogRow id="00005" name="Alan Cain" profession="Nurse" date="14 Feb 2026" time="14:37:52" />
                <MockLogRow id="00006" name="Alfred Murray" profession="Nurse" date="14 Feb 2026" time="15:17:02" />
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MockLogRow({ id, name, profession, date, time }: any) {
  return (
    <tr style={styles.tr}>
      <td style={styles.td}>{id}</td>
      <td style={styles.td}>{name}</td>
      <td style={styles.td}>{profession}</td>
      <td style={styles.td}>{date}</td>
      <td style={styles.td}>{time}</td>
    </tr>
  );
}

function MetricCard({ title, value, trend, isUp, icon }: any) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricHeader}>
        <div>
          <div style={styles.metricTitle}>
            <span style={{ marginRight: '6px' }}>{icon}</span>
            CF4
          </div>
          <div style={styles.metricSubTitle}>{title}</div>
        </div>
        <div style={styles.metricValue}>{value}</div>
      </div>
      <div style={{ ...styles.metricTrend, color: isUp ? '#10b981' : '#f43f5e' }}>
        <span>{isUp ? '📈' : '📉'}</span> {trend}
      </div>
    </div>
  );
}

/* ==========================================================================
   USERS MANAGEMENT PANEL
   ========================================================================== */
function AccountsPanel() {
  const qc = useQueryClient();
  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.listUsers().then((r) => r.data),
  });

  const [form, setForm] = useState({
    userId: '',
    firstName: '',
    lastName: '',
    role: 'NURSE',
    temporaryPassword: '',
  });

  const createUser = useMutation({
    mutationFn: () => adminApi.createUser(form),
    onSuccess: () => {
      setForm({ userId: '', firstName: '', lastName: '', role: 'NURSE', temporaryPassword: '' });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => adminApi.deactivateUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '24px' }}>
      <div style={styles.cardContainer}>
        <h4 style={{ marginTop: 0, color: '#0f172a' }}>Add Account</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            style={styles.formInput}
            placeholder="User ID (e.g. DRJ-0231)"
            value={form.userId}
            onChange={(e) => setForm({ ...form, userId: e.target.value })}
          />
          <input
            style={styles.formInput}
            placeholder="First name"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
          <input
            style={styles.formInput}
            placeholder="Last name"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
          <select
            style={styles.formInput}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="PHYSICIAN">Physician</option>
            <option value="NURSE">Nurse</option>
            <option value="CLAIMS_PROCESSOR">Claims Processor</option>
            <option value="ADMIN">Admin</option>
          </select>
          <input
            style={styles.formInput}
            placeholder="Temporary password"
            type="password"
            value={form.temporaryPassword}
            onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })}
          />
          <button style={styles.primaryButton} onClick={() => createUser.mutate()}>
            Create Account
          </button>
        </div>
      </div>

      <div style={styles.cardContainer}>
        <h4 style={{ marginTop: 0, color: '#0f172a' }}>Staff Accounts</h4>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>User ID</th>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Role</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u: any) => (
              <tr key={u.id} style={styles.tr}>
                <td style={styles.td}>{u.userId}</td>
                <td style={styles.td}>
                  {u.firstName} {u.lastName}
                </td>
                <td style={styles.td}>{u.role}</td>
                <td style={styles.td}>{u.isActive ? 'Active' : 'Deactivated'}</td>
                <td style={styles.td}>
                  {u.isActive && (
                    <button
                      onClick={() => deactivate.mutate(u.id)}
                      style={styles.deactivateButton}
                    >
                      Deactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RequestsView() {
  return (
    <div style={styles.cardContainer}>
      <h3>Requests</h3>
      <p style={{ color: '#64748b', fontSize: '14px' }}>No pending requests at this time.</p>
    </div>
  );
}

/* ==========================================================================
   STYLES (Tailored to match UI mock design)
   ========================================================================== */
const styles: Record<string, React.CSSProperties> = {
  appContainer: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },

  /* Sidebar */
  sidebar: {
    width: '220px',
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarLogoContainer: {
    padding: '24px 20px',
  },
  sidebarLogo: {
    height: '36px',
    objectFit: 'contain',
  },
  sidebarNav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '0 12px',
  },
  navButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#64748b',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
  },
  navButtonActive: {
    backgroundColor: '#f1f5f9',
    color: '#0f172a',
  },
  navIcon: {
    fontSize: '16px',
  },

  /* Header & Main Layout */
  mainWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    height: '70px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 32px',
  },
  headerTitle: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  notificationBadge: {
    position: 'relative',
    cursor: 'pointer',
  },
  badgeCount: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    fontSize: '10px',
    fontWeight: 700,
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileContainer: {
    position: 'relative',
  },
  profileButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  avatarCircle: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#cbd5e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#334155',
  },
  dropdownMenu: {
    position: 'absolute',
    right: 0,
    top: '48px',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    width: '140px',
    zIndex: 100,
    overflow: 'hidden',
  },
  dropdownItem: {
    width: '100%',
    padding: '10px 14px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#ef4444',
    fontSize: '13px',
    fontWeight: 600,
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },

  content: {
    padding: '32px',
    flex: 1,
  },

  /* Metric Cards */
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
  },
  metricCard: {
    backgroundColor: '#0a5c83',
    borderRadius: '12px',
    padding: '20px',
    color: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  metricHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  metricTitle: {
    fontSize: '11px',
    fontWeight: 700,
    opacity: 0.8,
  },
  metricSubTitle: {
    fontSize: '16px',
    fontWeight: 700,
  },
  metricValue: {
    fontSize: '32px',
    fontWeight: 800,
  },
  metricTrend: {
    marginTop: '12px',
    fontSize: '11px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },

  /* Card Containers & Tables */
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    padding: '24px',
  },
  tableHeaderBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  tableTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
  },
  filtersContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    border: '1px solid #e2e8f0',
    padding: '6px 12px',
    borderRadius: '8px',
  },
  filterSelect: {
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '12px',
    color: '#475569',
    backgroundColor: '#ffffff',
  },
  resetButton: {
    background: 'none',
    border: 'none',
    color: '#ef4444',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    color: '#64748b',
    fontWeight: 700,
    fontSize: '11px',
    borderBottom: '1px solid #f1f5f9',
  },
  tr: {
    borderBottom: '1px solid #f8fafc',
  },
  td: {
    padding: '14px 16px',
    color: '#334155',
  },

  /* Forms */
  formInput: {
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
  },
  primaryButton: {
    padding: '10px 16px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#0a5c83',
    color: '#ffffff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  deactivateButton: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #fca5a5',
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    fontSize: '11px',
    cursor: 'pointer',
  },
};