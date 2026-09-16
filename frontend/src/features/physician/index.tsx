/** Part of the physician dashboard — see index.tsx for the screen shell. */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
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
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
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
            onLogout={handleLogout}
          />
        ),
      }}
      header={
        <PageHeader
          title="Physician"
          actions={<NotificationBell />}
        />
      }
    >
      {activeTab === "overview" && <OverviewView />}
      {activeTab === "manage" && <ManageView />}
      {activeTab === "requests" && <RequestsView />}
    </Layout>
  );
}
