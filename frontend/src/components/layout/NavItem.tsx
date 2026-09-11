import type { ReactNode } from 'react';

export interface NavItemProps {
  label: string;
  icon?: ReactNode;
  /** Highlights the item; mirrors `aria-current="page"`. */
  active?: boolean;
  onClick?: () => void;
  /** Optional trailing badge (e.g. a pending count). */
  badge?: ReactNode;
  className?: string;
}

/**
 * Navigation item used by every role's sidebar.
 * Active/inactive states and hover transitions live in `.ui-nav-item` so
 * they are pixel-identical across Nurse, Claims, Admin and Physician.
 */
export function NavItem({ label, icon, active = false, onClick, badge, className }: NavItemProps) {
  return (
    <button
      type="button"
      className={['ui-nav-item', active ? 'is-active' : '', className ?? ''].filter(Boolean).join(' ')}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      {icon ? <span className="ui-nav-item__icon" aria-hidden="true">{icon}</span> : null}
      <span className="ui-nav-item__label">{label}</span>
      {badge ? <span className="ui-nav-item__badge">{badge}</span> : null}
    </button>
  );
}
