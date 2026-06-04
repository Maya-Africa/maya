import { create } from 'zustand';
import type { User } from '@/types/shared';

/**
 * Session store — current authenticated user.
 *
 * Owned by the Experience Engineer. Mirrors the server-side session cookie
 * for fast client-side access. Re-hydrated on app load via /api/auth/me.
 */

interface SessionState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  setUser: (user) =>
    set({
      user,
      isAuthenticated: user !== null,
      isLoading: false,
    }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () =>
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    }),
}));
