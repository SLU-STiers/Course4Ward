/** Part of the physician dashboard — see index.tsx for the screen shell. */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Layout } from '../../components/layout/Layout';
import { NotificationBell } from '../../components/layout/NotificationBell';
import { Button, PageHeader } from '../../components/ui';
import requestsIcon from '../../Img/requests.png';
import { shell } from './styles';

import { ManageIcon, OverviewIcon } from './icons';
import { ManageView } from './ManageView';
import { OverviewView } from './OverviewView';
import { RequestsView } from './RequestsView';
import type { TabType } from './types';

export function PhysicianDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const displayName = user ? `${user.firstName} ${user.lastName}` : "Physician";

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
          { id: "overview", label: "Overview", icon: <OverviewIcon /> },
          { id: "manage", label: "Manage", icon: <ManageIcon /> },
          {
            id: "requests",
            label: "Requests",
            icon: (
              <img
                src={requestsIcon}
                alt=""
                aria-hidden="true"
                style={{ width: 26, height: 26, objectFit: "contain" }}
              />
            ),
          },
        ],
        profile: (
          <div style={shell.sidebarProfile}>
            <div style={shell.profileAvatar}>JD</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={shell.profileName}>Dr. {displayName}</div>
              <div style={shell.profileEmail}>
                {user?.userId ?? "Physician account"}
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              title="Log out"
              onClick={handleLogout}
            >
              Log out
            </Button>
          </div>
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
