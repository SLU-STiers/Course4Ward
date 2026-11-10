/** Part of the nurse dashboard — see index.tsx for the screen shell. */

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

import { ManageIcon, PatientIcon } from '../../components/icons/NavIcons';
import { ManagementPortalView } from './ManagementPortalView';
import { PatientView } from './PatientView';
import type { TabType } from './types';

export function NurseDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('management');
  const [focusPatient, setFocusPatient] = useState<{ id: string; key: number } | null>(null);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const { data: account, isLoading: accountLoading, isError: accountError } = useQuery({
    queryKey: ['auth-profile', user?.id],
    queryFn: () => authApi.profile().then((response) => response.data),
    enabled: Boolean(user),
  });

  const clearFocus = useCallback(() => setFocusPatient(null), []);

  const handleLogout = () => {
    signOut('MANUAL');
    navigate('/login');
  };

  return (
    <Layout
      navbarProps={{
        ariaLabel: 'Nurse navigation',
        activeId: activeTab,
        onNavigate: (id) => {
          const tab = id as TabType;
          setActiveTab(tab);
          // A notification opens one chart. Leaving Management forgets it, so
          // coming back from Patient does not pop that chart open again.
          if (tab !== 'management') setFocusPatient(null);
        },
        items: [
          { id: 'management', label: 'Management', icon: <ManageIcon /> },
          { id: 'patient', label: 'Patient', icon: <PatientIcon /> },
        ],
        profile: (
          <SidebarProfile
            initials={`${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`}
            name={user ? `${user.firstName} ${user.lastName}` : 'Nurse'}
            subtitle={user?.userId ?? 'Nurse account'}
            accountId={user?.userId}
            roleLabel="Nurse"
            wards={accountLoading ? null : (account?.wards ?? []).map((ward) => ward.name)}
            wardUnavailable={accountError}
            onLogout={handleLogout}
          />
        ),
      }}
      header={
        <PageHeader
          title="Nurse"
          actions={
            <NotificationBell
              onOpenPatient={(patientId) => {
                setActiveTab('management');
                setFocusPatient({ id: patientId, key: Date.now() });
              }}
            />
          }
        />
      }
    >
      {activeTab === 'management' && (
        <ManagementPortalView
          focusPatient={focusPatient}
          onFocusHandled={clearFocus}
        />
      )}
      {activeTab === 'patient' && <PatientView />}
    </Layout>
  );
}
