/** Part of the physician dashboard — see index.tsx for the screen shell. */

import { useCallback, useState } from 'react';
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
import { presetTableState } from '../../hooks/useTableState';
import { MANAGE_TABLE_STATE } from './listState';
import { ManageView } from './ManageView';
import { OverviewView } from './OverviewView';
import { RequestsView } from './RequestsView';
import type { DashboardPatient, ManageStatusFilter, TabType } from './types';

export function PhysicianDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  /** Status filter the Manage list opens on; a row click sets the patient's own. */
  const [manageStatus, setManageStatus] = useState<ManageStatusFilter>("admitted");
  /**
   * Patient the Manage tab should open straight into. `key` remounts the view so
   * the same patient can be opened again from a notification.
   */
  const [focusPatient, setFocusPatient] = useState<{ id: string; key: number } | null>(null);
  /** Claim a notification should open on the Requests tab. */
  const [focusRequestId, setFocusRequestId] = useState<string | null>(null);
  const clearFocusRequest = useCallback(() => setFocusRequestId(null), []);
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

  /** A dashboard row opens its patient directly in Manage, filters intact. */
  const openPatient = (patient: DashboardPatient) => {
    // The Manage list follows the patient's status, but the sort order and the
    // other filters the physician left it on are kept.
    presetTableState(MANAGE_TABLE_STATE, { filters: { status: patient.status } });
    setManageStatus(patient.status);
    setFocusPatient({ id: patient.id, key: Date.now() });
    setActiveTab("manage");
  };

  return (
    <Layout
      navbarProps={{
        ariaLabel: "Physician navigation",
        activeId: activeTab,
        onNavigate: (id) => {
          // Plain tab switching keeps Manage's search, filters, sort and page
          // exactly as they were left; only the patient a notification or an
          // Overview row opened is cleared.
          if (id === "manage") {
            setManageStatus("admitted");
            setFocusPatient(null);
          }
          setActiveTab(id as TabType);
        },
        items: [
          { id: "overview", label: "Overview", icon: <DashboardIcon /> },
          { id: "manage", label: "Manage", icon: <ManageIcon /> },
          { id: "requests", label: "Request Review", icon: <RequestsIcon /> },
        ],
        profile: (
          <SidebarProfile
            initials={`${user?.firstName?.[0] ?? 'D'}${user?.lastName?.[0] ?? 'R'}`}
            name={user ? `Dr. ${user.firstName} ${user.lastName}` : 'Physician'}
            subtitle={user?.userId ?? 'Physician account'}
            accountId={user?.userId}
            roleLabel="Physician"
            assignmentLabel="Specialty"
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
              onOpenRequest={(requestId) => {
                setActiveTab('requests');
                setFocusRequestId(requestId);
              }}
            />
          }
        />
      }
    >
      {activeTab === "overview" && <OverviewView onOpenPatient={openPatient} />}
      {activeTab === "manage" && (
        <ManageView
          key={`${manageStatus}:${focusPatient?.id ?? "none"}:${focusPatient?.key ?? 0}`}
          initialStatus={manageStatus}
          initialPatientId={focusPatient?.id ?? undefined}
        />
      )}
      {activeTab === "requests" && (
        <RequestsView focusRequestId={focusRequestId} onFocusHandled={clearFocusRequest} />
      )}
    </Layout>
  );
}
