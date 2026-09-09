import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
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
