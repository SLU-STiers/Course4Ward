import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, KeyRound, Clock3, ClipboardList, TrendingUp } from 'lucide-react';
import { adminApi } from '../services/domainApi';
import { useAuthStore } from '../store/authStore';
import { Layout } from '../components/layout/Layout';
import { NotificationBell } from '../components/layout/NotificationBell';
import { SidebarProfile } from '../components/layout/SidebarProfile';
import { DataTableToolbar, PageHeader, StatusBadge } from '../components/ui';
import dashboardIcon from '../Img/dashboard.png';
import userIcon from '../Img/user.png';
import requestsIcon from '../Img/requests.png';

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
  const knownRequestIds = useRef<Set<string> | null>(null);

  const { data: resetRequestsData } = useQuery({
    queryKey: ['reset-requests'],
    queryFn: () => adminApi.getResetRequests().then((response) => response.data),
    refetchInterval: 15000,
  });

  const pendingResetRequests = (resetRequestsData ?? []).filter(
    (request: any) => request.status === 'PENDING',
  );

  useEffect(() => {
    const currentRequestIds = new Set<string>(
      pendingResetRequests.map((request: any) => String(request.id)),
    );

    if (knownRequestIds.current === null) {
      knownRequestIds.current = currentRequestIds;
      return;
    }

    const newRequest = pendingResetRequests.find(
      (request: any) => !knownRequestIds.current?.has(request.id),
    );
    knownRequestIds.current = currentRequestIds;

    if (newRequest && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('New password reset request', {
        body: `${newRequest.user.firstName} ${newRequest.user.lastName} submitted a request.`,
      });
    }
  }, [pendingResetRequests]);

  const handleLogout = () => {
    logout(); // Clears Zustand state and deletes sessionStorage['cims_auth'] automatically
    navigate('/login', { replace: true });
  };

  return (
    <Layout
      navbarProps={{
        ariaLabel: 'Admin navigation',
        activeId: activeNav,
        onNavigate: (id) => setActiveNav(id as 'dashboard' | 'users' | 'requests'),
        items: [
          { id: 'dashboard', label: 'Dashboard', icon: <img src={dashboardIcon} alt="" aria-hidden="true" style={styles.navIconImage} /> },
          { id: 'users', label: 'Users', icon: <img src={userIcon} alt="" aria-hidden="true" style={styles.navIconImage} /> },
          { id: 'requests', label: 'Requests', icon: <img src={requestsIcon} alt="" aria-hidden="true" style={styles.navIconImage} /> },
        ],
        profile: (
          <SidebarProfile
            initials={`${user?.firstName?.[0] ?? 'A'}${user?.lastName?.[0] ?? 'D'}`}
            name={user?.firstName ? `${user.firstName} ${user.lastName}` : 'Admin User'}
            subtitle="Administrator"
            onLogout={handleLogout}
          />
        ),
      }}
      header={
        <PageHeader
          title="Admin"
          actions={
            <NotificationBell
              count={String(pendingResetRequests.length)}
              onClick={() => setActiveNav('requests')}
            />
          }
        />
      }
    >
      {activeNav === 'dashboard' && <DashboardView />}
      {activeNav === 'users' && <AccountsPanel />}
      {activeNav === 'requests' && <RequestsView />}
    </Layout>
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
  const pageSize = 5;
  const { data: logs } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => adminApi.auditLogs({ take: 50 }).then((r) => r.data),
  });
  const { data: summary } = useQuery({
    queryKey: ['admin-analytics-summary'],
    queryFn: () => adminApi.analyticsSummary().then((r) => r.data),
  });
  const { data: ordersAnalytics } = useQuery({
    queryKey: ['admin-orders-analytics'],
    queryFn: () => adminApi.ordersAnalytics('day').then((r) => r.data),
  });

  const activityRows: ActivityRow[] = (logs ?? []).map((log: any, index: number) => {
        const date = new Date(log.timeStamp);
        return {
          id: String(index + 1).padStart(5, '0'),
          name: log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System User',
          profession: log.user?.role || 'Doctor',
          date: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          time: date.toLocaleTimeString(),
        };
      });
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
          value={String(summary?.totalUsers ?? 0)}
          trend={`${summary?.activeUsers ?? 0} active accounts`}
          icon={<Users size={24} strokeWidth={2} />}
        />
        <MetricCard
          title="Pending Resets"
          value={String(summary?.pendingResets ?? 0)}
          trend="Awaiting admin review"
          icon={<KeyRound size={24} strokeWidth={2} />}
        />
        <MetricCard
          title="Summaries Pending"
          value={String(summary?.pendingSummaries ?? 0)}
          trend={`${summary?.approvedSummaries ?? 0} approved`}
          icon={<Clock3 size={24} strokeWidth={2} />}
        />
        <MetricCard
          title="Orders Today"
          value={String(ordersAnalytics?.[0]?.count ?? 0)}
          trend="Latest daily bucket"
          icon={<ClipboardList size={24} strokeWidth={2} />}
        />
      </div>

      {/* ACTIVITY LOGS SECTION */}
      <div style={styles.cardContainer}>
        {/* Table Filters Bar */}
        <div style={{ ...styles.activityHeader, flexDirection: 'column', alignItems: 'stretch' }}>
          <h3 style={styles.tableTitle}>Activity Logs</h3>
          <DataTableToolbar
            className="admin-activity-toolbar"
            searchProps={{
              value: searchTerm,
              onChange: (value) => { setSearchTerm(value); setPage(1); },
              placeholder: 'Search activity logs...',
              ariaLabel: 'Search activity logs',
            }}
            filterProps={{
              title: 'Profession',
              options: [
                { value: 'all', label: 'All professions' },
                { value: 'PHYSICIAN', label: 'Physician' },
                { value: 'NURSE', label: 'Nurse' },
                { value: 'CLAIMS_PROCESSOR', label: 'Claims processor' },
                { value: 'ADMIN', label: 'Admin' },
              ],
              value: professionFilter,
              onChange: (value) => { setProfessionFilter(value); setPage(1); },
            }}
            sortProps={{
              title: 'Sort activity logs by',
              options: [
                { value: 'id', label: 'ID' },
                { value: 'name', label: 'Name' },
                { value: 'date', label: 'Date' },
              ],
              value: sortField,
              onChange: (value) => { setSortField(value as typeof sortField); setPage(1); },
              direction: sortDirection,
              onDirectionChange: (direction) => { setSortDirection(direction); setPage(1); },
            }}
          />
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
            {!visibleActivity.length && <tr><td style={styles.td} colSpan={5}>No activity logs found.</td></tr>}
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

function ConfirmationDialog({
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div style={styles.confirmationModal} onClick={(event) => event.stopPropagation()}>
        <div style={styles.confirmationHeader}>
          <h3 style={styles.confirmationTitle}>{title}</h3>
        </div>
        <p style={styles.confirmationMessage}>{message}</p>
        <div style={styles.confirmationActions}>
          <button style={styles.secondaryButton} onClick={onCancel}>Cancel</button>
          <button style={styles.primaryButton} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, trend, icon }: { title: string; value: string; trend: string; icon: ReactNode }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricHeader}>
        <div style={styles.metricIcon}>{icon}</div>
        <div style={styles.metricCopy}>
          <div style={styles.metricTitle}>{title}</div>
          <div style={styles.metricValue}>{value}</div>
        </div>
      </div>
      <div style={styles.metricTrend}>
        <TrendingUp size={14} aria-hidden="true" /> {trend}
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
    firstName: '',
    lastName: '',
    role: 'NURSE',
    temporaryPassword: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', role: 'NURSE', isActive: true });
  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const createUser = useMutation({
    mutationFn: () => adminApi.createUser(form),
    onSuccess: () => {
      setForm({ firstName: '', lastName: '', role: 'NURSE', temporaryPassword: '' });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const updateUser = useMutation({
    mutationFn: () => adminApi.updateUser(editingId as string, editForm),
    onSuccess: () => {
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const beginEdit = (user: any) => {
    setEditingId(user.id);
    setEditForm({ firstName: user.firstName, lastName: user.lastName, role: user.role, isActive: user.isActive });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '24px' }}>
      <div style={styles.cardContainer}>
        <h4 style={{ marginTop: 0, color: '#0f172a' }}>Add Account</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
          <button
            style={styles.primaryButton}
            onClick={() => {
              const fullName = `${form.firstName || 'New'} ${form.lastName || 'User'}`.trim();
              setConfirmation({
                title: 'Create account',
                message: `Are you sure you want to create an account for ${fullName}?`,
                confirmLabel: 'Create Account',
                onConfirm: () => {
                  setConfirmation(null);
                  createUser.mutate();
                },
              });
            }}
          >
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
                  <button onClick={() => beginEdit(u)} style={styles.actionButton}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {editingId && (
          <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            <h4 style={{ margin: '0 0 12px', color: '#0f172a' }}>Edit Account</h4>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input style={styles.formInput} value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
              <input style={styles.formInput} value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
              <select style={styles.formInput} value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                <option value="PHYSICIAN">Physician</option>
                <option value="NURSE">Nurse</option>
                <option value="CLAIMS_PROCESSOR">Claims Processor</option>
                <option value="ADMIN">Admin</option>
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} /> Active
              </label>
              <button
                style={styles.primaryButton}
                onClick={() => {
                  const fullName = `${editForm.firstName || 'User'} ${editForm.lastName || ''}`.trim();
                  setConfirmation({
                    title: 'Save account changes',
                    message: `Are you sure you want to save changes for ${fullName}?`,
                    confirmLabel: 'Save Changes',
                    onConfirm: () => {
                      setConfirmation(null);
                      updateUser.mutate();
                    },
                  });
                }}
              >
                Save
              </button>
              <button style={styles.secondaryButton} onClick={() => setEditingId(null)}>Cancel</button>
            </div>
          </div>
        )}
        {confirmation && (
          <ConfirmationDialog
            title={confirmation.title}
            message={confirmation.message}
            confirmLabel={confirmation.confirmLabel}
            onCancel={() => setConfirmation(null)}
            onConfirm={confirmation.onConfirm}
          />
        )}
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING' | 'APPROVED' | 'REJECTED'>('all');
  const [sortField, setSortField] = useState<'name' | 'date'>('date');
  const [sortDirection, setSortDirection] = useState<'ascending' | 'descending'>('descending');
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);
  const itemsPerPage = 5;

  // Fetch password reset requests from backend
  const { data: requestsData } = useQuery({
    queryKey: ['reset-requests'],
    queryFn: () => adminApi.getResetRequests().then((r) => r.data),
  });

  // Handle approving/resetting password request
  const handleResetPassword = useMutation({
    mutationFn: (requestId: string) => adminApi.approveResetRequest(requestId),
    onSuccess: (response: any) => {
      setTemporaryPassword(response.data.temporaryPassword);
      qc.invalidateQueries({ queryKey: ['reset-requests'] });
    },
  });

  const list = (requestsData ?? []).map((request: any) => ({
    ...request,
    name: `${request.user.firstName} ${request.user.lastName}`,
    role: request.user.role,
    userId: request.user.userId,
    date: new Date(request.requestedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: new Date(request.requestedAt).toLocaleTimeString(),
    status: request.status,
  }));

  // Search filter
  const filteredList = list
    .filter((req: any) =>
      req.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.ipAddress ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.id.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter((req: any) => statusFilter === 'all' || req.status === statusFilter)
    .sort((a: any, b: any) => {
      const comparison = String(a[sortField]).localeCompare(String(b[sortField]), undefined, { numeric: true });
      return sortDirection === 'ascending' ? comparison : -comparison;
    });

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
        {temporaryPassword && (
          <div style={styles.resetResult}>
            Temporary password for the user: <strong>{temporaryPassword}</strong>. Share it securely; it is only shown here once.
            <button type="button" style={styles.dismissButton} onClick={() => setTemporaryPassword(null)}>Dismiss</button>
          </div>
        )}
        {/* Header Bar with Search */}
        <PageHeader
          title="Password Reset Requests"
          description="Review and manage user password reset requests."
        />

        <DataTableToolbar
          searchProps={{
            value: searchTerm,
            onChange: (value) => { setSearchTerm(value); setCurrentPage(1); },
            placeholder: 'Search requests...',
            ariaLabel: 'Search password reset requests',
          }}
          filterProps={{
            title: 'Request status',
            options: [
              { value: 'all', label: 'All statuses' },
              { value: 'PENDING', label: 'PENDING' },
              { value: 'APPROVED', label: 'APPROVED' },
              { value: 'REJECTED', label: 'REJECTED' },
            ],
            value: statusFilter,
            onChange: (value) => { setStatusFilter(value as typeof statusFilter); setCurrentPage(1); },
          }}
          sortProps={{
            title: 'Sort requests by',
            options: [
              { value: 'date', label: 'Requested date' },
              { value: 'name', label: 'User name' },
            ],
            value: sortField,
            onChange: (value) => { setSortField(value as typeof sortField); setCurrentPage(1); },
            direction: sortDirection,
            onDirectionChange: (direction) => { setSortDirection(direction); setCurrentPage(1); },
          }}
        />

        {/* Requests Table */}
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Request ID</th>
              <th style={styles.th}>User</th>
              <th style={styles.th}>User ID</th>
              <th style={styles.th}>Requester IP</th>
              <th style={styles.th}>Requested On</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {currentData.map((item: any) => (
              <tr key={item.id} style={styles.tr}>
                <td style={{ ...styles.td, fontWeight: 700, color: 'var(--c4w-color-primary)' }}>
                  {item.id}
                </td>
                <td style={styles.td}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.name}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{item.role}</div>
                </td>
                <td style={{ ...styles.td, color: '#475569' }}>{item.userId}</td>
                <td style={{ ...styles.td, color: '#475569', fontFamily: 'monospace' }}>
                  {item.ipAddress ?? 'Unavailable'}
                </td>
                <td style={styles.td}>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.date}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{item.time}</div>
                </td>
                <td style={styles.td}>
                  <StatusBadge
                    showDot
                    status={item.status === 'PENDING' ? 'pending' : item.status === 'APPROVED' ? 'approved' : 'neutral'}
                    label={item.status}
                  />
                </td>
                <td style={styles.td}>
                  {item.status === 'PENDING' && (
                    <button
                      style={styles.actionButton}
                      onClick={() => {
                        setConfirmation({
                          title: 'Approve reset request',
                          message: `Are you sure you want to approve the password reset request for ${item.name}?`,
                          confirmLabel: 'Approve Reset',
                          onConfirm: () => {
                            setConfirmation(null);
                            handleResetPassword.mutate(item.id);
                          },
                        });
                      }}
                    >
                      Approve reset
                    </button>
                  )}
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
      {confirmation && (
        <ConfirmationDialog
          title={confirmation.title}
          message={confirmation.message}
          confirmLabel={confirmation.confirmLabel}
          onCancel={() => setConfirmation(null)}
          onConfirm={confirmation.onConfirm}
        />
      )}
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
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  /* Sidebar */
  sidebar: {
    width: '232px',
    flexShrink: 0,
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 0 16px',
    overflow: 'hidden',
  },
  sidebarLogoContainer: {
    padding: '16px 20px 24px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarLogo: {
    width: '180px',
    height: 'auto',
    maxHeight: '44px',
    objectFit: 'contain',
    display: 'block',
  },
  sidebarNav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '0 14px',
    flex: 1,
  },
  navButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '14px 14px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#64748b',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
  },
  navButtonActive: {
    backgroundColor: '#f1f5f9',
    color: '#0f172a',
  },
  navIcon: {
    width: '22px',
    height: '22px',
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
    color: 'var(--c4w-color-primary)',
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
    width: '100%',
    maxWidth: '1440px',
    margin: '0 auto',
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
    backgroundColor: 'var(--c4w-color-primary)',
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
  paddingLeft: '80px',
  paddingRight: '80px',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 1000,
  },
  confirmationModal: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 18px 48px rgba(15, 23, 42, 0.2)',
    padding: '24px',
  },
  confirmationHeader: {
    marginBottom: '8px',
  },
  confirmationTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '20px',
    fontWeight: 700,
  },
  confirmationMessage: {
    margin: 0,
    color: '#475569',
    fontSize: '14px',
    lineHeight: 1.5,
  },
  confirmationActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '24px',
  },

  /* Metric Cards */
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
  },
  metricCard: {
    backgroundColor: 'var(--c4w-color-primary)',
    borderRadius: '12px',
    padding: '20px',
    color: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  metricHeader: {
    display: 'flex',
    gap: '14px',
    alignItems: 'flex-start',
  },
  metricIcon: {
    width: '52px',
    height: '52px',
    flexShrink: 0,
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    color: 'var(--c4w-color-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCopy: {
    minWidth: 0,
  },
  metricTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#ffffff',
  },
  metricValue: {
    marginTop: '2px',
    fontSize: '32px',
    fontWeight: 800,
    lineHeight: 1.1,
  },
  metricTrend: {
    marginTop: '12px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#ffffff',
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
    marginBottom: '16px',
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
    color: 'var(--c4w-color-primary-active)',
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
    color: 'var(--c4w-color-primary)',
    backgroundColor: 'var(--c4w-color-primary-soft)',
    fontWeight: 700,
    fontSize: '12px',
    borderBottom: '1px solid var(--c4w-color-border)',
    whiteSpace: 'nowrap',
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
    backgroundColor: 'var(--c4w-color-primary)',
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
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '12px',
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
    backgroundColor: 'var(--c4w-color-primary)',
    color: '#ffffff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '10px 14px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    backgroundColor: '#ffffff',
    color: '#475569',
    fontWeight: 700,
    cursor: 'pointer',
  },
  resetResult: {
    marginBottom: '16px',
    padding: '12px 14px',
    borderRadius: '8px',
    backgroundColor: '#ecfdf5',
    color: '#166534',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  dismissButton: {
    marginLeft: '10px',
    border: 0,
    background: 'transparent',
    color: '#166534',
    fontWeight: 700,
    cursor: 'pointer',
  },

  /* Pagination */
  paginationContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '16px',
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
    fontSize: '13px',
    color: '#64748b',
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
    backgroundColor: 'var(--c4w-color-primary)',
    color: '#ffffff',
    borderColor: 'var(--c4w-color-primary)',
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
  width: '26px',
  height: '26px',
  marginRight: '10px',
  objectFit: 'contain',
}
};