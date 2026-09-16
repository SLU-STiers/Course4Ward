import { Bell } from 'lucide-react';

type NotificationBellProps = {
  /** Pending / unread count. Hidden when 0. */
  count?: number | string;
  showDot?: boolean;
  onClick?: () => void;
};

export function NotificationBell({ count = 0, showDot: _showDot = false, onClick }: NotificationBellProps) {
  const numericCount = typeof count === 'string' ? Number(count) || 0 : count;
  const label = numericCount > 99 ? '99+' : String(numericCount);
  const ariaLabel =
    numericCount > 0
      ? `${label} unread notification${numericCount === 1 ? '' : 's'}`
      : 'Notifications';

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="ui-notification-bell"
    >
      <Bell size={22} strokeWidth={2} aria-hidden="true" />
      {numericCount > 0 ? (
        <span className="ui-notification-bell__badge" role="status">
          {label}
        </span>
      ) : null}
    </button>
  );
}
