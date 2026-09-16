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
import { DashboardIcon, RequestsIcon, UsersIcon } from '../../components/icons/NavIcons';

import { AccountsPanel } from './AccountsPanel';
import { DashboardView } from './DashboardView';
import { RequestsView } from './RequestsView';
import type { ResetRequestRow } from './types';

export function AdminPanel() {
  const [activeNav, setActiveNav] = useState<'dashboard' | 'users' | 'requests'>('dashboard');
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const knownRequestIds = useRef<Set<string> | null>(null);

  const { data: resetRequestsData } = useQuery({
    queryKey: ['reset-requests'],
<<<<<<< HEAD
    queryFn: () => adminApi.getResetRequests().then((response) => response.data),
    refetchInterval: 5000,
=======
    queryFn: () =>
      adminApi
        .getResetRequests()
        .then((response) => response.data as ResetRequestRow[]),
    refetchInterval: 15000,
>>>>>>> 8b4456b77cf9b7aca057b11a18f830a0976f5e34
  });

  const pendingResetRequests = (resetRequestsData ?? []).filter(
    (request) => request.status === 'PENDING',
  );

  useEffect(() => {
    const currentRequestIds = new Set<string>(
      pendingResetRequests.map((request) => String(request.id)),
    );

    if (knownRequestIds.current === null) {
      knownRequestIds.current = currentRequestIds;
      return;
    }

    const newRequest = pendingResetRequests.find(
      (request) => !knownRequestIds.current?.has(request.id),
    );
    knownRequestIds.current = currentRequestIds;

    if (newRequest && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('New password reset request', {
        body: `${newRequest.user.firstName} ${newRequest.user.lastName} submitted a request.`,
      });
    }
  }, [pendingResetRequests]);

  const pendingCount = pendingResetRequests.length;
  const requestsBadge =
    pendingCount > 0 ? (pendingCount > 99 ? '99+' : String(pendingCount)) : undefined;

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
<<<<<<< HEAD
          { id: 'dashboard', label: 'Dashboard', icon: <img src={dashboardIcon} alt="" aria-hidden="true" style={styles.navIconImage} /> },
          { id: 'users', label: 'Users', icon: <img src={userIcon} alt="" aria-hidden="true" style={styles.navIconImage} /> },
          {
            id: 'requests',
            label: 'Requests',
            icon: <img src={requestsIcon} alt="" aria-hidden="true" style={styles.navIconImage} />,
            badge: requestsBadge,
          },
=======
          { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
          { id: 'users', label: 'Users', icon: <UsersIcon /> },
          { id: 'requests', label: 'Requests', icon: <RequestsIcon /> },
>>>>>>> 8b4456b77cf9b7aca057b11a18f830a0976f5e34
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
              count={pendingCount}
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
