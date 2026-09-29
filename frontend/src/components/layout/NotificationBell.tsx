import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';

import { Popover } from '../ui';
import { notificationsApi } from '../../services/domainApi';
import { useAuthStore } from '../../store/authStore';
import type { AppNotification, NotificationScope } from '../../types';
import { NotificationPanel } from './NotificationPanel';

/** How often the badge re-checks for notifications while the app is open. */
const POLL_INTERVAL_MS = 30_000;

export interface NotificationBellProps {
  className?: string;
  /**
   * Local badge count. Pass this with `onClick` for a dashboard that owns its
   * own alert list (the admin bell counts pending password-reset requests)
   * instead of the shared notification panel.
   */
  count?: number | string;
  onClick?: () => void;
}

/**
 * Header bell for every dashboard.
 *
 * Without props it is the shared notification bell for the signed-in user.
 * A dashboard that passes its own `count`/`onClick` keeps exactly the old
 * local behaviour: a plain badge that triggers that dashboard's own action.
 */
export function NotificationBell({ className, count, onClick }: NotificationBellProps) {
  if (onClick || count !== undefined) {
    return <LocalBell className={className} count={count} onClick={onClick} />;
  }

  return <NotificationBellPopover className={className} />;
}

/** Badge-only bell driven by the caller (admin pending requests). */
function LocalBell({ className, count = 0, onClick }: NotificationBellProps) {
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
      className={['ui-notification-bell', className ?? ''].filter(Boolean).join(' ')}
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

/**
 * The real thing: polls the unread count for the signed-in user and renders
 * the notification panel on click, so a reminder sent from the claims
 * processor appears without a reload.
 */
function NotificationBellPopover({ className }: { className?: string }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<NotificationScope>('inbox');
  const [unread, setUnread] = useState(0);
  const [inbox, setInbox] = useState<AppNotification[]>([]);
  const [history, setHistory] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const refreshCount = useCallback(() => {
    if (!accessToken) return;
    // A failed poll must never disturb the header — the next tick retries.
    notificationsApi
      .unreadCount()
      .then(({ data }) => setUnread(data.count))
      .catch(() => undefined);
  }, [accessToken]);

  useEffect(() => {
    refreshCount();

    const timer = window.setInterval(refreshCount, POLL_INTERVAL_MS);
    // Returning to the tab should be immediate, not up to 30s stale.
    const onFocus = () => refreshCount();
    window.addEventListener('focus', onFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshCount]);

  const loadItems = useCallback(() => {
    setLoading(true);
    notificationsApi
      .list({ scope: 'inbox' })
      .then(({ data }) => {
        setInbox(data);
        setUnread(data.filter((item) => !item.isRead).length);
      })
      .catch(() => setInbox([]))
      .finally(() => setLoading(false));
  }, []);

  /** The history is a full log, so it is only fetched when the tab is opened. */
  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    notificationsApi
      .list({ scope: 'history' })
      .then(({ data }) => setHistory(data))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) loadItems();
  };

  const handleScopeChange = (next: NotificationScope) => {
    setScope(next);
    if (next === 'history') loadHistory();
  };

  // Both actions update the badge optimistically and fall back to the server
  // list if the request fails, so the panel can never disagree with the API.
  const markRead = (id: string) => {
    const wasUnreadInInbox = inbox.some((item) => item.id === id && !item.isRead);
    const wasUnreadInHistory = history.some((item) => item.id === id && !item.isRead);
    if (!wasUnreadInInbox && !wasUnreadInHistory) return;

    setInbox((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    setHistory((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    if (wasUnreadInInbox) setUnread((prev) => Math.max(0, prev - 1));

    notificationsApi.markRead(id).catch(loadItems);
  };

  const markAllRead = () => {
    if (!inbox.some((item) => !item.isRead)) return;

    setInbox((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setHistory((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnread(0);
    notificationsApi.markAllRead().catch(loadItems);
  };

  /**
   * Clears the bell. Nothing is deleted: the rows move into the history, so
   * the cached history is dropped and refetched on the next visit.
   */
  const clearInbox = () => {
    if (inbox.length === 0) return;

    setInbox([]);
    setHistory([]);
    setUnread(0);
    notificationsApi.clear().catch(loadItems);
  };

  const label = unread > 99 ? '99+' : String(unread);
  const ariaLabel =
    unread > 0 ? `${label} unread notification${unread === 1 ? '' : 's'}` : 'Notifications';

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
      align="end"
      ariaLabel="Notifications"
      anchorClassName={className}
      contentClassName="ui-popover--notifications"
      trigger={
        <button type="button" aria-label={ariaLabel} className="ui-notification-bell">
          <Bell size={22} strokeWidth={2} aria-hidden="true" />
          {unread > 0 ? (
            <span className="ui-notification-bell__badge" role="status">
              {label}
            </span>
          ) : null}
        </button>
      }
    >
      <NotificationPanel
        scope={scope}
        onScopeChange={handleScopeChange}
        items={scope === 'history' ? history : inbox}
        loading={scope === 'history' ? historyLoading : loading}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
        onClear={clearInbox}
      />
    </Popover>
  );
}

