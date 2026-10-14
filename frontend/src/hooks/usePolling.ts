import { useEffect, useRef } from 'react';

/** How often screens refresh orders that another role may have changed. */
export const ORDER_POLL_MS = 5000;

/**
 * Calls `callback` every `intervalMs` while `enabled` and the tab is visible,
 * and right away when the user returns to the tab. Keeps screens that show
 * data other roles change (orders, statuses) current without a reload.
 */
export function usePolling(callback: () => void, intervalMs: number, enabled = true) {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.visibilityState === 'visible') latest.current();
    };
    const timer = window.setInterval(tick, intervalMs);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs, enabled]);
}
