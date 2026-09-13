import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

/** How long the user may stay completely inactive before being logged out. */
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

/** Any of these firing counts as "the user is doing something" and resets the timer. */
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

/**
 * Logs the user out after IDLE_TIMEOUT_MS of no mouse/keyboard/scroll/touch
 * activity. The countdown only ever runs while the user is idle — any
 * activity event cancels the pending timeout and restarts it from zero, so
 * it never fires while the user is actually using the app.
 */
export function useIdleLogout() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const logout = useAuthStore((state) => state.logout);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    const clearPendingTimeout = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const handleIdleTimeout = () => {
      clearPendingTimeout();
      logout();
      navigate('/login', { replace: true });
    };

    const resetTimer = () => {
      clearPendingTimeout();
      timeoutRef.current = window.setTimeout(handleIdleTimeout, IDLE_TIMEOUT_MS);
    };

    // Start the countdown as soon as we're authenticated, then let any
    // activity push it back.
    resetTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));

    return () => {
      clearPendingTimeout();
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [accessToken, logout, navigate]);
}
