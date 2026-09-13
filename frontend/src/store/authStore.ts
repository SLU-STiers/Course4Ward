import { create } from 'zustand';
import type { AuthUser } from '../types';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setAuth: (accessToken: string, refreshToken: string, user: AuthUser, remember?: boolean) => void;
  logout: () => void;
}

// browser storage
// By default we use sessionStorage so tokens don't persist past the browser
// tab closing on shared hospital workstations. When the user explicitly
// checks "Remember me" on the login page, we instead persist to
// localStorage, which is shared across tabs/windows in the same browser —
// that's what lets a brand-new tab come up already logged in.
const STORAGE_KEY = 'cims_auth';
const REMEMBER_KEY = 'cims_remember_me';

function isRemembered(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) === '1';
  } catch {
    return false;
  }
}

function loadInitial() {
  try {
    if (isRemembered()) {
      const remembered = localStorage.getItem(STORAGE_KEY);
      if (remembered) return JSON.parse(remembered);
    }
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { accessToken: null, refreshToken: null, user: null };
    return JSON.parse(raw);
  } catch {
    return { accessToken: null, refreshToken: null, user: null };
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...loadInitial(),
  setAuth: (accessToken, refreshToken, user, remember) => {
    // If `remember` isn't explicitly passed (e.g. token refreshes that
    // happen after the initial login), keep whichever storage mode is
    // already active instead of silently downgrading a remembered session.
    const shouldRemember = remember ?? isRemembered();
    const payload = JSON.stringify({ accessToken, refreshToken, user });

    if (shouldRemember) {
      localStorage.setItem(STORAGE_KEY, payload);
      localStorage.setItem(REMEMBER_KEY, '1');
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      sessionStorage.setItem(STORAGE_KEY, payload);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(REMEMBER_KEY);
    }

    set({ accessToken, refreshToken, user });
  },
  logout: () => {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    set({ accessToken: null, refreshToken: null, user: null });
  },
}));
