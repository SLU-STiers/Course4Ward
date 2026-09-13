/** Part of the admin dashboard — see index.tsx for the screen shell. */

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../services/domainApi';
import { useAuthStore } from '../../store/authStore';
import { Layout } from '../../components/layout/Layout';
import { NotificationBell } from '../../components/layout/NotificationBell';
import { SidebarProfile } from '../../components/layout/SidebarProfile';
import { PageHeader } from '../../components/ui';
import dashboardIcon from '../../Img/dashboard.png';
import userIcon from '../../Img/user.png';
import requestsIcon from '../../Img/requests.png';
import { styles } from './styles';

import { AccountsPanel } from './AccountsPanel';
import { DashboardView } from './DashboardView';
import { RequestsView } from './RequestsView';

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
