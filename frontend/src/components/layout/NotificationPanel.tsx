import { BellOff, BellRing } from 'lucide-react';

import { formatRelativeTime } from '../../lib/format';
import type { AppNotification } from '../../types';

/**
 * Contents of the header bell popover: one row per notification, newest
 * first. Clicking a row marks it read; the header action clears the rest.
 *
 * Styling lives in the `.ui-notification*` block of `index.css` so the panel
 * matches the shared popover/menu surface rather than re-stating tokens here.
 */
export function NotificationPanel({
  items,
  loading,
  onMarkRead,
  onMarkAllRead,
}: {
  items: AppNotification[];
  loading: boolean;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  const unread = items.filter((item) => !item.isRead).length;

  return (
    <div className="ui-notifications">
      <header className="ui-notifications__header">
        <div className="ui-notifications__heading">
          <span className="ui-notifications__title">Notifications</span>
          {unread > 0 ? <span className="ui-notifications__count">{unread} new</span> : null}
        </div>
        {unread > 0 ? (
          <button type="button" className="ui-notifications__action" onClick={onMarkAllRead}>
            Mark all as read
          </button>
        ) : null}
      </header>

      <div className="ui-notifications__list">
        {loading && items.length === 0 ? (
          <p className="ui-notifications__state">Loading notifications…</p>
        ) : null}

        {!loading && items.length === 0 ? (
          <div className="ui-notifications__state ui-notifications__state--empty">
            <BellOff size={22} aria-hidden="true" />
            <span>You&rsquo;re all caught up.</span>
            <span className="ui-notifications__hint">
              Reminders sent by claims processors show up here.
            </span>
          </div>
        ) : null}

        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`ui-notification${item.isRead ? '' : ' is-unread'}`}
            onClick={() => onMarkRead(item.id)}
          >
            <span className="ui-notification__icon" aria-hidden="true">
              <BellRing size={15} />
            </span>

            <span className="ui-notification__body">
              <span className="ui-notification__top">
                <span className="ui-notification__title">{item.title}</span>
                <span className="ui-notification__time">
                  {formatRelativeTime(item.createdAt)}
                </span>
              </span>
              <span className="ui-notification__message">{item.message}</span>
            </span>

            {item.isRead ? null : <span className="ui-notification__dot" aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>
  );
}
