import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// The access token is short-lived; an active user must not be logged out
// when it expires (only `useIdleLogout` ends a session for inactivity). On a
// 401 we exchange the refresh token once and replay the request. Concurrent
// 401s share one in-flight refresh so the token pair is not rotated twice.
let refreshInFlight: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    const { refreshToken, user, setAuth } = useAuthStore.getState();
    refreshInFlight = (async () => {
      if (!refreshToken || !user) return null;
      try {
        // Plain axios, not `api`, so this call never re-enters the interceptor.
        const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
          `${api.defaults.baseURL}/auth/refresh`,
          { refreshToken },
          { withCredentials: true },
        );
        setAuth(data.accessToken, data.refreshToken, user);
        return data.accessToken;
      } catch {
        return null;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      original?.headers?.Authorization &&
      !original._retried
    ) {
      original._retried = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }

    // Only force a session-expired logout/redirect when the failing request
    // was actually authenticated (carried a Bearer token). A plain login
    // attempt with wrong credentials also returns 401, but it never had a
    // token attached — that's just "bad credentials", not an expired
    // session, so it should leave the login form's error message on screen
    // instead of hard-reloading the page out from under it.
    const wasAuthenticatedRequest = Boolean(error.config?.headers?.Authorization);
    if (error.response?.status === 401 && wasAuthenticatedRequest) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
