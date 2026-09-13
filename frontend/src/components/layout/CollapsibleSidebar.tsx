import { useState, type ReactNode } from 'react';
import leftArrowImg from '../../Img/left-arrow.png';
import logoImg from '../../Img/Course4Ward-Logo.png';

type CollapsibleSidebarProps = {
  nav: ReactNode;
  profile: ReactNode;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
};

export function CollapsibleSidebar({ nav, profile, isOpen: controlledIsOpen, onOpenChange }: CollapsibleSidebarProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(true);
  const isOpen = controlledIsOpen ?? internalIsOpen;

  const toggleOpen = () => {
    const nextIsOpen = !isOpen;
    setInternalIsOpen(nextIsOpen);
    onOpenChange?.(nextIsOpen);
  };

  return (
    <aside
      className="dashboard-sidebar"
      style={{
        position: 'fixed',
        inset: 0,
        right: 'auto',
        zIndex: 20,
        width: 232,
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 260ms ease',
        backgroundColor: 'var(--dashboard-surface)',
        borderRight: '1px solid var(--dashboard-border)',
        boxShadow: isOpen ? '8px 0 24px rgba(15, 23, 42, 0.08)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        padding: '8px 0 16px',
        overflow: 'visible',
        fontFamily: 'var(--dashboard-font-stack)',
        color: 'var(--dashboard-ink)',
      }}
    >
      <div
        style={{
          padding: '16px 20px 24px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <img
          src={logoImg}
          alt="Course4Ward"
          style={{ width: 202, height: 'auto', maxHeight: 52, objectFit: 'contain', display: 'block' }}
        />
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 14px', flex: 1 }}>
        {nav}
      </nav>

      {profile}

      <button
        type="button"
        aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        onClick={toggleOpen}
        style={{
          position: 'absolute',
          top: '50%',
          right: isOpen ? -20 : -44,
          transform: `translateY(-50%) rotate(${isOpen ? 0 : 180}deg)`,
          width: 42,
          height: 64,
          padding: 0,
          border: '1px solid var(--dashboard-border)',
          borderRadius: 12,
          backgroundColor: 'var(--dashboard-surface)',
          boxShadow: '4px 0 12px rgba(15, 23, 42, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'transform 240ms ease, background-color 160ms ease',
          transformOrigin: 'center',
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.transform = `translateY(-50%) rotate(${isOpen ? 0 : 180}deg) scale(1.06)`;
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.transform = `translateY(-50%) rotate(${isOpen ? 0 : 180}deg) scale(1)`;
        }}
      >
        <img src={leftArrowImg} alt="" aria-hidden="true" style={{ width: 24, height: 24 }} />
      </button>
    </aside>
  );
}
