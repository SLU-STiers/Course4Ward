/** Part of the nurse dashboard — see index.tsx for the screen shell. */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Layout } from '../../components/layout/Layout';
import { NotificationBell } from '../../components/layout/NotificationBell';
import { SidebarProfile } from '../../components/layout/SidebarProfile';
import { PageHeader } from '../../components/ui';

import { INITIAL_CHARTS } from './data';
import { ManagementIcon, PatientIcon } from './icons';
import { ManagementPortalView } from './ManagementPortalView';
import { PatientView } from './PatientView';
import type { PatientChart, TabType } from './types';

export function NurseDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('management');
  const [charts, setCharts] = useState<Record<string, PatientChart>>(INITIAL_CHARTS);
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
        profile: <SidebarProfile initials="AT" name="Adrian Tabalvaro" subtitle="ID 2246787" onLogout={handleLogout} />,
      }}
      header={
        <PageHeader
          title="Nurse"
          actions={<NotificationBell />}
        />
      }
    >
      {activeTab === 'management' && <ManagementPortalView charts={charts} />}
      {activeTab === 'patient' && <PatientView charts={charts} setCharts={setCharts} />}
    </Layout>
  );
}
