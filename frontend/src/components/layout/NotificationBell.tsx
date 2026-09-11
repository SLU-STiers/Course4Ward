import { Bell } from 'lucide-react';

type NotificationBellProps = {
  count?: string;
  showDot?: boolean;
  onClick?: () => void;
};

export function NotificationBell({ count = '2', showDot: _showDot = false, onClick }: NotificationBellProps) {
  const ariaLabel = `${count} unread notifications`;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="ui-notification-bell"
    >
      <Bell size={22} strokeWidth={2} aria-hidden="true" />
      <span className="ui-notification-bell__badge" role="status">
        {count}
      </span>
    </button>
  );
}
