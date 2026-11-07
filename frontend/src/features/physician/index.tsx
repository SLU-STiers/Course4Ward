/** Part of the physician dashboard — see index.tsx for the screen shell. */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../services/domainApi';
import { useAuthStore } from '../../store/authStore';
import { signOut } from '../../services/signOut';
import { Layout } from '../../components/layout/Layout';
import { NotificationBell } from '../../components/layout/NotificationBell';
import { SidebarProfile } from '../../components/layout/SidebarProfile';
import { PageHeader } from '../../components/ui';

import { DashboardIcon, ManageIcon, RequestsIcon } from '../../components/icons/NavIcons';
import { ManageView } from './ManageView';
import { OverviewView } from './OverviewView';
import { RequestsView } from './RequestsView';
import type { TabType } from './types';

export function PhysicianDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [focusPatient, setFocusPatient] = useState<{ id: string; key: number } | null>(null);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const { data: account, isLoading: accountLoading, isError: accountError } = useQuery({
    queryKey: ['auth-profile', user?.id],
    queryFn: () => authApi.profile().then((response) => response.data),
    enabled: Boolean(user),
  });

  const handleLogout = () => {
    signOut('MANUAL');
    navigate("/login");
  };

  return (
    <Layout
      navbarProps={{
        ariaLabel: "Physician navigation",
        activeId: activeTab,
        onNavigate: (id) => setActiveTab(id as TabType),
        items: [
          { id: "overview", label: "Overview", icon: <DashboardIcon /> },
          { id: "manage", label: "Manage", icon: <ManageIcon /> },
          { id: "requests", label: "Requests", icon: <RequestsIcon /> },
        ],
        profile: (
          <SidebarProfile
            initials={`${user?.firstName?.[0] ?? 'D'}${user?.lastName?.[0] ?? 'R'}`}
            name={user ? `Dr. ${user.firstName} ${user.lastName}` : 'Physician'}
            subtitle={user?.userId ?? 'Physician account'}
            accountId={user?.userId}
            roleLabel="Physician"
            wards={accountLoading ? null : (account?.wards ?? []).map((ward) => ward.name)}
            wardUnavailable={accountError}
            onLogout={handleLogout}
          />
        ),
      }}
      header={
        <PageHeader
          title="Physician"
          actions={
            <NotificationBell
              onOpenPatient={(patientId) => {
                setActiveTab('manage');
                setFocusPatient({ id: patientId, key: Date.now() });
              }}
            />
          }
        />
      }
    >
      {activeTab === "overview" && <OverviewView />}
      {activeTab === "manage" && <ManageView focusPatient={focusPatient} />}
      {activeTab === "requests" && <RequestsView />}
    </Layout>
  );
}
