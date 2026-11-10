import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';

import { Popover } from '../ui';
import { notificationsApi } from '../../services/domainApi';
import { useAuthStore } from '../../store/authStore';
import { ORDER_POLL_MS } from '../../hooks/usePolling';
import type { AppNotification, NotificationScope } from '../../types';
import { NotificationPanel } from './NotificationPanel';

export interface NotificationBellProps {
  className?: string;
  /**
   * Local badge count. Pass this with `onClick` for a dashboard that owns its
   * own alert list (the admin bell counts pending password-reset requests)
   * instead of the shared notification panel.
   */
  count?: number | string;
  onClick?: () => void;
  /** Opens the patient chart behind an order notification. */
  onOpenPatient?: (patientId: string) => void;
  /** Opens the claim or review request this notification points at. */
  onOpenRequest?: (requestId: string) => void;
}

/**
 * Header bell for every dashboard.
 *
 * Without props it is the shared notification bell for the signed-in user.
 * A dashboard that passes its own `count`/`onClick` keeps exactly the old
 * local behaviour: a plain badge that triggers that dashboard's own action.
 */
export function NotificationBell({ className, count, onClick, onOpenPatient, onOpenRequest }: NotificationBellProps) {
  if (onClick || count !== undefined) {
    return <LocalBell className={className} count={count} onClick={onClick} />;
  }

  return (
    <NotificationBellPopover
      className={className}
      onOpenPatient={onOpenPatient}
      onOpenRequest={onOpenRequest}
    />
  );
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
function NotificationBellPopover({
  className,
  onOpenPatient,
  onOpenRequest,
}: {
  className?: string;
  onOpenPatient?: (patientId: string) => void;
  onOpenRequest?: (requestId: string) => void;
}) {
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

    const timer = window.setInterval(refreshCount, ORDER_POLL_MS);
    // Returning to the tab should be immediate, not a poll interval late.
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

  // New items from the other role appear in an already-open panel.
  useEffect(() => {
    if (!open || scope !== 'inbox') return;
    const timer = window.setInterval(() => {
      notificationsApi
        .list({ scope: 'inbox' })
        .then(({ data }) => {
          setInbox(data);
          setUnread(data.filter((item) => !item.isRead).length);
        })
        .catch(() => undefined);
    }, ORDER_POLL_MS);
    return () => window.clearInterval(timer);
  }, [open, scope]);

  const handleScopeChange = (next: NotificationScope) => {
    setScope(next);
    if (next === 'history') loadHistory();
  };

  // Both actions update the badge optimistically and fall back to the server
  // list if the request fails, so the panel can never disagree with the API.
  const markRead = (id: string) => {
    const item = inbox.find((entry) => entry.id === id && !entry.isRead);
    if (!item) return;

    setInbox((prev) => prev.filter((entry) => entry.id !== id));
    setHistory((prev) => [{ ...item, isRead: true }, ...prev.filter((entry) => entry.id !== id)]);
    setUnread((prev) => Math.max(0, prev - 1));
    notificationsApi.markRead(id).catch(loadItems);
  };

  const markAllRead = () => {
    if (!inbox.some((item) => !item.isRead)) return;

    const read = inbox.map((item) => ({ ...item, isRead: true }));
    setHistory((prev) => [...read, ...prev.filter((item) => !read.some((entry) => entry.id === item.id))]);
    setInbox([]);
    setUnread(0);
    notificationsApi.markAllRead().catch(loadItems);
  };

  const clearAll = () => {
    if (inbox.length === 0 && history.length === 0) return;
    setInbox([]);
    setHistory([]);
    setUnread(0);
    notificationsApi.clear().catch(() => {
      loadItems();
      loadHistory();
    });
  };

  const select = (item: AppNotification) => {
    if (!item.isRead) markRead(item.id);
    if (item.requestId && onOpenRequest) {
      setOpen(false);
      onOpenRequest(item.requestId);
      return;
    }
    if (item.patientId && onOpenPatient) {
      setOpen(false);
      onOpenPatient(item.patientId);
    }
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
        onSelect={select}
        onMarkAllRead={markAllRead}
        onClearAll={clearAll}
        canClear={inbox.length > 0 || history.length > 0}
      />
    </Popover>
  );
}

