import { BellOff, BellRing, ChevronRight, History } from 'lucide-react';

import { formatRelativeTime } from '../../lib/format';
import type { AppNotification, NotificationScope } from '../../types';

/**
 * Contents of the header bell popover: one row per notification, newest
 * first, split into the inbox and a full history.
 *
 * - Notifications lists unread items. History lists items marked as read.
 * - Clicking a row marks it read. An order notification also opens that patient.
 *
 * Styling lives in the `.ui-notification*` block of `index.css` so the panel
 * matches the shared popover/menu surface rather than re-stating tokens here.
 */
export function NotificationPanel({
  scope,
  onScopeChange,
  items,
  loading,
  onSelect,
  onMarkAllRead,
  onClearAll,
  canClear,
}: {
  scope: NotificationScope;
  onScopeChange: (scope: NotificationScope) => void;
  items: AppNotification[];
  loading: boolean;
  onSelect: (item: AppNotification) => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
  canClear: boolean;
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

        <div className="ui-notifications__actions">
          {!isHistory && unread > 0 ? (
            <button type="button" className="ui-notifications__action" onClick={onMarkAllRead}>
              Mark all as read
            </button>
          ) : null}
          {canClear ? (
            <button type="button" className="ui-notifications__action ui-notifications__action--muted" onClick={onClearAll}>
              Clear all
            </button>
          ) : null}
        </div>
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

      <div className="ui-notifications__list">
        {loading && items.length === 0 ? (
          <p className="ui-notifications__state">Loading notifications…</p>
        ) : null}

        {!loading && items.length === 0 ? (
          <div className="ui-notifications__state ui-notifications__state--empty">
            {isHistory ? (
              <>
                <History size={22} aria-hidden="true" />
                <span>No read notifications yet.</span>
                <span className="ui-notifications__hint">
                  Read notifications stay here for the day, then they are removed.
                </span>
              </>
            ) : (
              <>
                <BellOff size={22} aria-hidden="true" />
                <span>No new notifications.</span>
                <span className="ui-notifications__hint">
                  New orders and ward updates show up here.
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
            onClick={() => onSelect(item)}
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
              <NotificationMessage text={item.message} />
            </span>

            {item.patientId ? (
              <ChevronRight className="ui-notification__go" size={16} aria-hidden="true" />
            ) : item.isRead ? null : (
              <span className="ui-notification__dot" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Older rows named the patient in plain text. New rows wrap the name in ** **. */
function markPatientName(text: string) {
  if (text.includes('**')) return text;
  const marked = text
    .replace(/^(An order for )(.+?)( for nursing review\.)$/, '$1**$2**$3')
    .replace(/^(Dr\. .+ entered an order for )(.+?)(\.)$/, '$1**$2**$3')
    .replace(/^(.+?)( was registered as )/, '**$1**$2');
  return marked;
}

/**
 * Patient names are wrapped in ** ** and a claims note in "quotes". Both
 * render bold, without the markers themselves.
 */
function NotificationMessage({ text }: { text: string }) {
  const parts = markPatientName(text).split(/(\*\*[^*]+\*\*|"[^"]*")/g);

  return (
    <span className="ui-notification__message">
      {parts.map((part, index) => {
        const marked = part.startsWith('**') && part.endsWith('**') && part.length > 4;
        const quoted = part.startsWith('"') && part.endsWith('"') && part.length > 2;
        if (!marked && !quoted) return <span key={index}>{part}</span>;
        return (
          <strong key={index} className="ui-notification__quote">
            {part.slice(marked ? 2 : 1, marked ? -2 : -1)}
          </strong>
        );
      })}
    </span>
  );
}
