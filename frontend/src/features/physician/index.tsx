/** Part of the physician dashboard — see index.tsx for the screen shell. */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import type { DashboardPatient, ManageStatusFilter, TabType } from './types';

export function PhysicianDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  /** Status filter the Manage list opens on; a row click sets the patient's own. */
  const [manageStatus, setManageStatus] = useState<ManageStatusFilter>("admitted");
  /** Patient the Manage tab should open straight into (Overview row click). */
  const [focusPatientId, setFocusPatientId] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const handleLogout = () => {
    signOut('MANUAL');
    navigate("/login");
  };

  /** A dashboard row opens its patient directly in Manage, filters intact. */
  const openPatient = (patient: DashboardPatient) => {
    setFocusPatientId(patient.id);
    setManageStatus(patient.status);
    setActiveTab("manage");
  };

  return (
    <Layout
      navbarProps={{
        ariaLabel: "Physician navigation",
        activeId: activeTab,
        onNavigate: (id) => {
          // Reaching Manage from the nav always starts on the admitted patients.
          if (id === "manage") {
            setManageStatus("admitted");
            setFocusPatientId(null);
          }
          setActiveTab(id as TabType);
        },
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
      {activeTab === "overview" && <OverviewView onOpenPatient={openPatient} />}
      {activeTab === "manage" && (
        <ManageView
          key={`${manageStatus}:${focusPatientId ?? "none"}`}
          initialStatus={manageStatus}
          initialPatientId={focusPatientId ?? undefined}
        />
      )}
      {activeTab === "requests" && <RequestsView />}
    </Layout>
  );
}
