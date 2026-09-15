/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Layout } from '../../components/layout/Layout';
import { NotificationBell } from '../../components/layout/NotificationBell';
import { SidebarProfile } from '../../components/layout/SidebarProfile';
import { PageHeader } from '../../components/ui';

import { ManagementIcon, PatientIcon } from './icons';
import { ManagementPortalView } from './ManagementPortalView';
import { PatientView } from './PatientView';
import type { TabType } from './types';

export function NurseDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('management');
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Layout
      navbarProps={{
        ariaLabel: 'Nurse navigation',
        activeId: activeTab,
        onNavigate: (id) => setActiveTab(id as TabType),
        items: [
          { id: 'management', label: 'Management', icon: <ManagementIcon /> },
          { id: 'patient', label: 'Patient', icon: <PatientIcon /> },
        ],
        profile: <SidebarProfile initials={`${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`} name={user ? `${user.firstName} ${user.lastName}` : 'Nurse'} subtitle={user?.userId ?? 'Nurse account'} onLogout={handleLogout} />,
      }}
      header={
        <PageHeader
          title="Nurse"
          actions={<NotificationBell />}
        />
      }
    >
      {activeTab === 'management' && <ManagementPortalView />}
      {activeTab === 'patient' && <PatientView />}
    </Layout>
  );
}
