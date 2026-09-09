import { Bell } from 'lucide-react';

type NotificationBellProps = {
  count?: string;
  showDot?: boolean;
  onClick?: () => void;
};

export function NotificationBell({ count = '2', showDot = false, onClick }: NotificationBellProps) {
  const ariaLabel = showDot ? 'Notifications' : `${count} unread notifications`;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        position: 'relative',
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: 'var(--dashboard-surface)',
        border: '1px solid var(--dashboard-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 14px rgba(15, 23, 42, 0.06)',
        cursor: onClick ? 'pointer' : 'default',
        color: 'var(--dashboard-primary-dark)',
        padding: 0,
        fontFamily: 'var(--dashboard-font-stack)',
        transition: 'background-color 180ms ease, border-color 180ms ease',
      }}
    >
      <Bell size={22} strokeWidth={2} aria-hidden="true" />
      {showDot ? (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 7,
            right: 7,
            width: 9,
            height: 9,
            borderRadius: '50%',
            backgroundColor: 'var(--dashboard-primary)',
            border: '2px solid var(--dashboard-surface)',
          }}
        />
      ) : (
        <span
          role="status"
          style={{
            position: 'absolute',
            top: -5,
            right: -5,
            minWidth: 19,
            height: 19,
            padding: '0 5px',
            borderRadius: 10,
            backgroundColor: 'var(--dashboard-primary)',
            color: '#ffffff',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
