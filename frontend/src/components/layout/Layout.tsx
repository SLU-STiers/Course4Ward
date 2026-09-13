import { useState, type ReactNode } from 'react';
import { CollapsibleSidebar } from './CollapsibleSidebar';
import { NavItem } from './NavItem';
import { layout } from '../../theme/tokens';

export interface NavbarItemConfig {
  /** Stable identifier compared against `activeId`. */
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
}

export interface NavbarProps {
  items: NavbarItemConfig[];
  /** Id of the currently active item. */
  activeId: string;
  onNavigate: (id: string) => void;
  /** Sidebar footer/account block. */
  profile?: ReactNode;
  ariaLabel?: string;
}

export interface LayoutProps {
  /** Navigation + account configuration for the sidebar. */
  navbarProps: NavbarProps;
  /** Optional sticky header (use `<PageHeader />`) rendered above content. */
  header?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Unified application shell.
 *
 * Renders the standardized collapsible side navigation (built from
 * {@link NavbarItemConfig}) plus the offset content column. Every role view
 * mounts its content through this component so spacing, sidebar behavior and
 * the header container are identical across the app.
 */
export function Layout({ navbarProps, header, children, className }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { items, activeId, onNavigate, profile, ariaLabel = 'Primary' } = navbarProps;

  return (
    <div className={['ui-layout', className ?? ''].filter(Boolean).join(' ')}>
      <CollapsibleSidebar
        isOpen={sidebarOpen}
        onOpenChange={setSidebarOpen}
        nav={
          <div className="ui-layout__nav" role="navigation" aria-label={ariaLabel}>
            {items.map((item) => (
              <NavItem
                key={item.id}
                label={item.label}
                icon={item.icon}
                badge={item.badge}
                active={item.id === activeId}
                onClick={() => onNavigate(item.id)}
              />
            ))}
          </div>
        }
        profile={profile}
      />

      <div
        className="ui-layout__content"
        style={{ marginLeft: sidebarOpen ? layout.sidebarWidth : layout.sidebarCollapsedWidth }}
      >
        {header ? <div className="ui-layout__header">{header}</div> : null}
        <main className="ui-layout__main">{children}</main>
      </div>
    </div>
  );
}
