import axios from 'axios';
import { api } from './api';
import { useAuthStore } from '../store/authStore';

/** Why a session ended; the admin Activity Logs show the two differently. */
export type LogoutReason = 'MANUAL' | 'IDLE_TIMEOUT';

/**
 * Records the sign-out in the activity log, then clears the local session.
 *
 * The token is read before `logout()` wipes it and sent explicitly, and the
 * call uses plain axios so a failed request can never trigger the `api`
 * interceptor's session-expired redirect. Logging is best-effort: the user is
 * signed out locally whether or not the server hears about it.
 */
export function signOut(reason: LogoutReason) {
  const { accessToken, logout } = useAuthStore.getState();
  if (accessToken) {
    void axios
      .post(
        `${api.defaults.baseURL}/auth/logout`,
        { reason },
        { headers: { Authorization: `Bearer ${accessToken}` }, withCredentials: true },
      )
      .catch(() => undefined);
  }
  logout();
}
