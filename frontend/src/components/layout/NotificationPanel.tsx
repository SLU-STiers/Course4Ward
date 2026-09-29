import { BellOff, BellRing, History } from 'lucide-react';

import { formatRelativeTime } from '../../lib/format';
import type { AppNotification, NotificationScope } from '../../types';

/**
 * Contents of the header bell popover: one row per notification, newest
 * first, split into the inbox and a full history.
 *
 * - Clicking a row marks it read.
 * - "Clear" empties the inbox (the rows move to the history, nothing is lost).
 * - The history tab is the permanent log, cleared items included.
 *
 * Styling lives in the `.ui-notification*` block of `index.css` so the panel
 * matches the shared popover/menu surface rather than re-stating tokens here.
 */
export function NotificationPanel({
  scope,
  onScopeChange,
  items,
  loading,
  onMarkRead,
  onMarkAllRead,
  onClear,
}: {
  scope: NotificationScope;
  onScopeChange: (scope: NotificationScope) => void;
  items: AppNotification[];
  loading: boolean;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClear: () => void;
}) {
  const isHistory = scope === 'history';
  const unread = items.filter((item) => !item.isRead).length;

  return (
    <div className="ui-notifications">
      <header className="ui-notifications__header">
        <div className="ui-notifications__heading">
          <span className="ui-notifications__title">
            {isHistory ? 'Notification history' : 'Notifications'}
          </span>
          {!isHistory && unread > 0 ? (
            <span className="ui-notifications__count">{unread} new</span>
          ) : null}
        </div>

        {!isHistory && items.length > 0 ? (
          <button type="button" className="ui-notifications__action" onClick={onClear}>
            Clear
          </button>
        ) : null}
      </header>

      <div className="ui-notifications__tabs" role="tablist" aria-label="Notification views">
        <button
          type="button"
          role="tab"
          aria-selected={!isHistory}
          className={`ui-notifications__tab${isHistory ? '' : ' is-active'}`}
          onClick={() => onScopeChange('inbox')}
        >
          Notifications
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isHistory}
          className={`ui-notifications__tab${isHistory ? ' is-active' : ''}`}
          onClick={() => onScopeChange('history')}
        >
          History
        </button>
      </div>

      {!isHistory && unread > 0 ? (
        <button type="button" className="ui-notifications__bulk" onClick={onMarkAllRead}>
          Mark all as read
        </button>
      ) : null}

      <div className="ui-notifications__list">
        {loading && items.length === 0 ? (
          <p className="ui-notifications__state">Loading notifications…</p>
        ) : null}

        {!loading && items.length === 0 ? (
          <div className="ui-notifications__state ui-notifications__state--empty">
            {isHistory ? (
              <>
                <History size={22} aria-hidden="true" />
                <span>No history yet.</span>
                <span className="ui-notifications__hint">
                  Cleared notifications are kept here.
                </span>
              </>
            ) : (
              <>
                <BellOff size={22} aria-hidden="true" />
                <span>You&rsquo;re all caught up.</span>
                <span className="ui-notifications__hint">
                  Reminders sent by claims processors show up here.
                </span>
              </>
            )}
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
                <span className="ui-notification__meta">
                  {item.clearedAt ? (
                    <span className="ui-notification__cleared">Cleared</span>
                  ) : null}
                  <span className="ui-notification__time">
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </span>
              </span>
              <QuotedMessage text={item.message} />
            </span>

            {item.isRead ? null : <span className="ui-notification__dot" aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The claims processor's own words are quoted inside the message, and they are
 * the part that has to stand out — so anything between double quotes is
 * rendered bold.
 */
function QuotedMessage({ text }: { text: string }) {
  const segments = text.split('"');

  return (
    <span className="ui-notification__message">
      {segments.map((segment, index) =>
        index % 2 === 1 ? (
          <strong key={index} className="ui-notification__quote">
            {segment}
          </strong>
        ) : (
          <span key={index}>{segment}</span>
        ),
      )}
    </span>
  );
}

