import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';

import { Popover } from '../ui';
import { notificationsApi } from '../../services/domainApi';
import { useAuthStore } from '../../store/authStore';
import type { AppNotification } from '../../types';
import { NotificationPanel } from './NotificationPanel';

/** How often the badge re-checks for notifications while the app is open. */
const POLL_INTERVAL_MS = 30_000;

/**
 * Header bell for every dashboard. Owns its own data: it polls the unread
 * count for the signed-in user and renders the notification panel on click, so
 * a reminder sent from the claims processor appears without a reload.
 */
export function NotificationBell({ className }: { className?: string }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

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
      .list()
      .then(({ data }) => {
        setItems(data);
        setUnread(data.filter((item) => !item.isRead).length);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) loadItems();
  };

  // Both actions update the badge optimistically and fall back to the server
  // list on failure, so the panel can never disagree with the API.
  const markRead = (id: string) => {
    const target = items.find((item) => item.id === id);
    if (!target || target.isRead) return;

    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    setUnread((prev) => Math.max(0, prev - 1));
    notificationsApi.markRead(id).catch(loadItems);
  };

  const markAllRead = () => {
    if (!items.some((item) => !item.isRead)) return;

    setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnread(0);
    notificationsApi.markAllRead().catch(loadItems);
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
        items={items}
        loading={loading}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
      />
    </Popover>
  );
}

