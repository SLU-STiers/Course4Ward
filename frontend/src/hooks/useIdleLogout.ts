import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { signOut } from '../services/signOut';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'wheel', 'touchstart', 'scroll', 'click'] as const;

export function useIdleLogout() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    const clearTimer = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const onIdle = () => {
      clearTimer();
      signOut('IDLE_TIMEOUT');
      navigate('/login', { replace: true });
    };

    const resetTimer = () => {
      clearTimer();
      timeoutRef.current = window.setTimeout(onIdle, IDLE_TIMEOUT_MS);
    };

    resetTimer();

    // `scroll` does not bubble, so capture:true is required for window listeners.
    const options: AddEventListenerOptions = { capture: true, passive: true };
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, options);
    }

    return () => {
      clearTimer();
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer, options);
      }
    };
  }, [accessToken, navigate]);
}
