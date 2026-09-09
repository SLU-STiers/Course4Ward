import { useState, type CSSProperties, type ReactNode } from 'react';
import { CollapsibleSidebar } from './CollapsibleSidebar';

type DashboardShellProps = {
  nav: ReactNode;
  profile: ReactNode;
  children: ReactNode;
};

export function DashboardShell({ nav, profile, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div
      className="dashboard-shell"
      style={{ '--dashboard-sidebar-offset': sidebarOpen ? '232px' : '0px' } as CSSProperties}
    >
      <CollapsibleSidebar
        nav={nav}
        profile={profile}
        isOpen={sidebarOpen}
        onOpenChange={setSidebarOpen}
      />
      <div className="dashboard-content-offset">{children}</div>
    </div>
  );
}