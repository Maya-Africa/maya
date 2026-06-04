/**
 * Session hydration — on app load, call /api/auth/me once and populate
 * the Zustand session store. Wraps the network call so pages don't have
 * to manage loading/auth-status themselves; they just read from the store.
 */

'use client';

import { useEffect } from 'react';

import { ApiError } from '@/lib/api-error';
import { me } from '@/lib/api/auth';
import { useSessionStore } from '@/store/session-store';

export function useSessionHydrate(): void {
  const setUser = useSessionStore(s => s.setUser);
  const setLoading = useSessionStore(s => s.setLoading);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    me()
      .then(res => {
        if (!cancelled) setUser(res.user);
      })
      .catch(err => {
        if (cancelled) return;
        if (err instanceof ApiError && err.statusCode === 401) {
          // Not signed in — expected case for visitors and logged-out users.
          setUser(null);
          return;
        }
        // Network failure, 5xx, etc. — log and treat as unauthenticated.
        console.error('session hydrate failed', err);
        setUser(null);
      });

    return () => {
      cancelled = true;
    };
  }, [setUser, setLoading]);
}

/**
 * Convenience selector for pages that just want the current state.
 * For mutations (sign in, sign out), call the auth API helpers directly
 * and update the store from there.
 */
export function useSession() {
  const user = useSessionStore(s => s.user);
  const isLoading = useSessionStore(s => s.isLoading);
  const isAuthenticated = useSessionStore(s => s.isAuthenticated);
  return { user, isLoading, isAuthenticated };
}
