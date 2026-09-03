import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Filter, ArrowUpDown } from 'lucide-react';
import { adminApi } from '../services/domainApi';
import { useAuthStore } from '../store/authStore';
import dashboardIcon from '../Img/dashboard.png';
import userIcon from '../Img/user.png';
import requestsIcon from '../Img/requests.png';

// Import Logo
import logoImg from '../Img/Course4Ward-Logo.png';

type ActivityRow = {
  id: string;
  name: string;
  profession: string;
  date: string;
  time: string;
};

export function AdminPanel() {
  const [activeNav, setActiveNav] = useState<'dashboard' | 'users' | 'requests'>('dashboard');
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout(); // Clears Zustand state and deletes sessionStorage['cims_auth'] automatically
    navigate('/login', { replace: true });
  };

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
    <img src={dashboardIcon} alt="Dashboard" style={styles.navIconImage} /> Dashboard
  </button>

  <button
    style={{
      ...styles.navButton,
      ...(activeNav === 'users' ? styles.navButtonActive : {}),
    }}
    onClick={() => setActiveNav('users')}
  >
    <img src={userIcon} alt="Users" style={styles.navIconImage} /> Users
  </button>

  <button
    style={{
      ...styles.navButton,
      ...(activeNav === 'requests' ? styles.navButtonActive : {}),
    }}
    onClick={() => setActiveNav('requests')}
  >
    <img src={requestsIcon} alt="Requests" style={styles.navIconImage} /> Requests
  </button>
</nav>
        <div style={styles.sidebarProfile}>
          <div style={styles.profileAvatar}>
            {user?.firstName?.[0] ?? 'A'}{user?.lastName?.[0] ?? 'D'}
          </div>
          <div style={styles.profileDetails}>
            <div style={styles.profileName}>
              {user?.firstName ? `${user.firstName} ${user.lastName}` : 'Admin User'}
            </div>
            <div style={styles.profileEmail}>Administrator</div>
          </div>
          <button type="button" style={styles.logoutBtn} onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div style={styles.mainWrapper}>
        {/* TOP HEADER */}
        <header style={styles.header}>
          <h1 style={styles.headerTitle}>Admin</h1>

          <div style={styles.headerRight}>
            {/* Notification Bell */}
            <div style={styles.notificationBadge}>
              <span style={{ fontSize: '18px' }}>🔔</span>
              <span style={styles.badgeCount}>2</span>
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
  const [searchTerm, setSearchTerm] = useState('');
  const [professionFilter, setProfessionFilter] = useState('all');
  const [sortField, setSortField] = useState<'id' | 'name' | 'date'>('id');
  const [sortDirection, setSortDirection] = useState<'ascending' | 'descending'>('ascending');
  const [page, setPage] = useState(1);
  const [openMenu, setOpenMenu] = useState<'filter' | 'sort' | null>(null);
  const pageSize = 5;
  const { data: logs } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => adminApi.auditLogs({ take: 50 }).then((r) => r.data),
  });

  const fallbackLogs: ActivityRow[] = [
    { id: '00001', name: 'Christine Brooks', profession: 'Doctor', date: '14 Feb 2026', time: '14:37:52' },
    { id: '00002', name: 'Rosie Pearson', profession: 'Nurse', date: '14 Feb 2026', time: '14:37:52' },
    { id: '00003', name: 'Darrell Caldwell', profession: 'Doctor', date: '14 Feb 2026', time: '14:37:52' },
    { id: '00004', name: 'Gilbert Johnston', profession: 'Doctor', date: '14 Feb 2026', time: '14:37:52' },
    { id: '00005', name: 'Alan Cain', profession: 'Nurse', date: '14 Feb 2026', time: '14:37:52' },
    { id: '00006', name: 'Alfred Murray', profession: 'Nurse', date: '14 Feb 2026', time: '15:17:02' },
  ];
  const activityRows: ActivityRow[] = logs?.length
    ? logs.map((log: any, index: number) => {
        const date = new Date(log.createdAt);
        return {
          id: String(index + 1).padStart(5, '0'),
          name: log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System User',
          profession: log.user?.role || 'Doctor',
          date: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          time: date.toLocaleTimeString(),
        };
      })
    : fallbackLogs;
  const filteredActivity = activityRows
    .filter((row) =>
      `${row.id} ${row.name} ${row.profession}`.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (professionFilter === 'all' || row.profession.toLowerCase() === professionFilter.toLowerCase())
    )
    .sort((a, b) => {
      const comparison = a[sortField].localeCompare(b[sortField]);
      return sortDirection === 'ascending' ? comparison : -comparison;
    });
  const pageCount = Math.max(1, Math.ceil(filteredActivity.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * pageSize;
  const visibleActivity = filteredActivity.slice(pageStart, pageStart + pageSize);

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
        <div style={styles.activityHeader}>
          <h3 style={styles.tableTitle}>Activity Logs</h3>
          <div style={styles.activityToolbar}>
            <div style={styles.activitySearch}>
              <input
                type="search"
                placeholder="Search activity logs..."
                value={searchTerm}
                onChange={(event) => { setSearchTerm(event.target.value); setPage(1); }}
                style={styles.activitySearchInput}
              />
              <span style={styles.activitySearchIcon}>⌕</span>
            </div>
            <div style={styles.hoverMenu} onMouseEnter={() => setOpenMenu('filter')} onMouseLeave={() => setOpenMenu(null)}>
              <button type="button" style={styles.toolbarButton}><Filter size={14} /> Filter</button>
              {openMenu === 'filter' && (
                <div style={styles.activityMenu}>
                  <span style={styles.menuTitle}>Profession</span>
                  {['all', 'doctor', 'nurse'].map((profession) => (
                    <button type="button" key={profession} style={styles.menuOption} onClick={() => { setProfessionFilter(profession); setPage(1); }}>
                      {profession[0].toUpperCase() + profession.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={styles.hoverMenu} onMouseEnter={() => setOpenMenu('sort')} onMouseLeave={() => setOpenMenu(null)}>
              <button type="button" style={styles.toolbarButton}><ArrowUpDown size={14} /> Sort by</button>
              {openMenu === 'sort' && (
                <div style={styles.activityMenu}>
                  {([['id', 'ID'], ['name', 'Name'], ['date', 'Date']] as const).map(([field, label]) => (
                    <button type="button" key={field} style={styles.menuOption} onClick={() => { setSortField(field); setPage(1); }}>
                      {label} {sortField === field ? (sortDirection === 'ascending' ? '↑' : '↓') : ''}
                    </button>
                  ))}
                  <button type="button" style={styles.menuOption} onClick={() => setSortDirection((direction) => direction === 'ascending' ? 'descending' : 'ascending')}>
                    {sortDirection === 'ascending' ? 'Descending' : 'Ascending'}
                  </button>
                </div>
              )}
            </div>
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
            {visibleActivity.map((row) => (
              <MockLogRow key={row.id} {...row} />
            ))}
          </tbody>
        </table>
        <div style={styles.activityPagination}>
          <span style={styles.paginationInfo}>Showing {filteredActivity.length ? pageStart + 1 : 0} to {Math.min(pageStart + pageSize, filteredActivity.length)} of {filteredActivity.length} logs</span>
          <div style={styles.paginationControls}>
            <button type="button" style={styles.pageNumberButton} disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>‹</button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
              <button type="button" key={pageNumber} style={{ ...styles.pageNumberButton, ...(safePage === pageNumber ? styles.pageNumberActive : {}) }} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
            ))}
            <button type="button" style={styles.pageNumberButton} disabled={safePage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>›</button>
          </div>
        </div>
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

/* ==========================================================================
   REQUESTS VIEW (Password Reset Requests with Functional Pagination)
   ========================================================================== */
function RequestsView() {
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Fetch password reset requests from backend
  const { data: requestsData } = useQuery({
    queryKey: ['reset-requests'],
    queryFn: () => adminApi.getResetRequests().then((r) => r.data),
  });

  // Handle approving/resetting password request
  const handleResetPassword = useMutation({
    mutationFn: (requestId: string) => adminApi.approveResetRequest(requestId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reset-requests'] }),
  });

  // Fallback mock data matching your mockup UI image
  const mockRequests = [
    { id: 'RST-0001', name: 'Christine Brooks', role: 'Doctor', email: 'christine.brooks@courseinward.com', date: '14 Feb 2026', time: '10:32 AM', status: 'Pending' },
    { id: 'RST-0002', name: 'Rosie Pearson', role: 'Nurse', email: 'rosie.pearson@courseinward.com', date: '14 Feb 2026', time: '09:15 AM', status: 'Pending' },
    { id: 'RST-0003', name: 'Darrell Caldwell', role: 'Doctor', email: 'darrell.caldwell@courseinward.com', date: '14 Feb 2026', time: '08:47 AM', status: 'Pending' },
    { id: 'RST-0004', name: 'Gilbert Johnston', role: 'Doctor', email: 'gilbert.johnston@courseinward.com', date: '14 Feb 2026', time: '07:58 AM', status: 'Pending' },
    { id: 'RST-0005', name: 'Alan Cain', role: 'Nurse', email: 'alan.cain@courseinward.com', date: '14 Feb 2026', time: '07:30 AM', status: 'Pending' },
    { id: 'RST-0006', name: 'Alan Cain', role: 'Nurse', email: 'alan.cain@courseinward.com', date: '14 Feb 2026', time: '07:30 AM', status: 'Pending' },
    { id: 'RST-0007', name: 'Alan Cain', role: 'Nurse', email: 'alan.cain@courseinward.com', date: '14 Feb 2026', time: '07:30 AM', status: 'Pending' },
    { id: 'RST-0008', name: 'Gilbert Johnston', role: 'Doctor', email: 'gilbert.johnston@courseinward.com', date: '14 Feb 2026', time: '07:58 AM', status: 'Pending' },
    { id: 'RST-0009', name: 'Alan Cain', role: 'Nurse', email: 'alan.cain@courseinward.com', date: '14 Feb 2026', time: '07:30 AM', status: 'Pending' },
    { id: 'RST-0010', name: 'Alan Cain', role: 'Nurse', email: 'alan.cain@courseinward.com', date: '14 Feb 2026', time: '07:30 AM', status: 'Pending' },
    { id: 'RST-0011', name: 'Alan Cain', role: 'Nurse', email: 'alan.cain@courseinward.com', date: '14 Feb 2026', time: '07:30 AM', status: 'Pending' },  
  ];

  const list = requestsData || mockRequests;

  // Search filter
  const filteredList = list.filter((req: any) =>
    req.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination calculations
  const totalItems = filteredList.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = filteredList.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={styles.cardContainer}>
        {/* Header Bar with Search */}
        <div style={styles.requestsHeader}>
          <div>
            <h3 style={styles.requestsTitle}>Password Reset Requests</h3>
            <p style={styles.requestsSubTitle}>Review and manage user password reset requests.</p>
          </div>

          <div style={styles.searchContainer}>
            <input
              type="text"
              placeholder="Search requests..."
              style={styles.searchInput}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset to page 1 on new search
              }}
            />
            <span style={styles.searchIcon}>🔍</span>
          </div>
        </div>

        {/* Requests Table */}
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Request ID</th>
              <th style={styles.th}>User</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Requested On</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {currentData.map((item: any) => (
              <tr key={item.id} style={styles.tr}>
                <td style={{ ...styles.td, fontWeight: 700, color: '#0284c7' }}>
                  {item.id}
                </td>
                <td style={styles.td}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.name}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{item.role}</div>
                </td>
                <td style={{ ...styles.td, color: '#475569' }}>{item.email}</td>
                <td style={styles.td}>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.date}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{item.time}</div>
                </td>
                <td style={styles.td}>
                  <span style={styles.pendingBadge}>{item.status}</span>
                </td>
                <td style={styles.td}>
                  <button
                    style={styles.actionButton}
                    onClick={() => handleResetPassword.mutate(item.id)}
                  >
                    Reset Password
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination Controls */}
        <div style={styles.paginationContainer}>
          <span style={styles.paginationInfo}>
            Showing {totalItems === 0 ? 0 : startIndex + 1} to {endIndex} of {totalItems} requests
          </span>

          <div style={styles.paginationControls}>
            <button
              style={styles.pageArrowButton}
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              ‹
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                style={{
                  ...styles.pageNumberButton,
                  ...(currentPage === page ? styles.pageNumberActive : {}),
                }}
                onClick={() => handlePageChange(page)}
              >
                {page}
              </button>
            ))}

            <button
              style={styles.pageArrowButton}
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              ›
            </button>
          </div>
        </div>
      </div>
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
    backgroundColor: '#f3f4f6',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },

  /* Sidebar */
  sidebar: {
    width: '232px',
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarLogoContainer: {
    padding: '16px 20px 24px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarLogo: {
    width: '180px',
    height: '44px',
    objectFit: 'contain',
  },
  sidebarNav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '0 14px',
    flex: 1,
  },
  navButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
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
    width: '18px',
    height: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
  },
  sidebarProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    margin: '0 14px',
    padding: '10px 8px',
    borderTop: '1px solid #f1f5f9',
  },
  profileAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#cbd5e1',
    color: '#0a5c83',
    fontSize: '11px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  profileDetails: { minWidth: 0, flex: 1 },
  profileName: { fontSize: '12px', fontWeight: 700, color: '#0f172a' },
  profileEmail: { fontSize: '10px', color: '#94a3b8' },
  logoutBtn: {
    flexShrink: 0,
    border: '1px solid #fecaca',
    backgroundColor: '#ffffff',
    color: '#ef4444',
    borderRadius: '8px',
    padding: '6px 8px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
  },

  /* Header & Main Layout */
  mainWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '28px 32px 8px',
  },
  headerTitle: {
    fontSize: '28px',
    fontWeight: 800,
    color: '#0f172a',
    margin: 0,
    letterSpacing: '-0.02em',
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
  activityHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '12px',
    marginBottom: '20px',
  },
  activityToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  activitySearch: {
    position: 'relative',
    width: '280px',
  },
  activitySearchInput: {
    width: '100%',
    padding: '8px 32px 8px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    fontSize: '13px',
    outline: 'none',
  },
  activitySearchIcon: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#94a3b8',
    fontSize: '18px',
    pointerEvents: 'none',
  },
  hoverMenu: {
    position: 'relative',
  },
  toolbarButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    border: '1px solid #b8cbd2',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    color: '#004358',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  activityMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    width: '180px',
    padding: '8px',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.12)',
    zIndex: 10,
  },
  menuTitle: {
    display: 'block',
    padding: '4px',
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  menuOption: {
    display: 'block',
    width: '100%',
    padding: '7px 6px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#ffffff',
    color: '#334155',
    textAlign: 'left',
    fontSize: '12px',
    cursor: 'pointer',
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

  /* Requests Section Styles */
  requestsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  requestsTitle: {
    fontSize: '20px',
    fontWeight: 800,
    color: '#0f172a',
    margin: 0,
  },
  requestsSubTitle: {
    fontSize: '13px',
    color: '#64748b',
    margin: '4px 0 0 0',
  },
  searchContainer: {
    position: 'relative',
    width: '280px',
  },
  searchInput: {
    width: '100%',
    padding: '10px 36px 10px 14px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
    fontSize: '13px',
    outline: 'none',
  },
  searchIcon: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '14px',
    color: '#94a3b8',
    pointerEvents: 'none',
  },
  pendingBadge: {
    backgroundColor: '#fef3c7',
    color: '#b45309',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 600,
    display: 'inline-block',
  },
  actionButton: {
    backgroundColor: '#0a5c83',
    color: '#ffffff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  /* Pagination */
  paginationContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '24px',
    paddingTop: '16px',
    borderTop: '1px solid #f1f5f9',
  },
  activityPagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #f1f5f9',
  },
  paginationInfo: {
    fontSize: '12px',
    color: '#64748b',
    fontWeight: 500,
  },
  paginationControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  pageNumberButton: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    color: '#475569',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumberActive: {
    backgroundColor: '#0a5c83',
    color: '#ffffff',
    borderColor: '#0a5c83',
  },
  pageArrowButton: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    color: '#64748b',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  navIconImage: {
  width: '20px',
  height: '20px',
  marginRight: '8px',
  objectFit: 'contain',
}
};