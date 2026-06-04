/**
 * Mount this once near the root of the app (inside body in `app/layout.tsx`)
 * so the session store is populated from /api/auth/me on every page load.
 * Pages then read from `useSession()` without each having to fetch.
 */

'use client';

import { useSessionHydrate } from '@/lib/auth/use-session';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  useSessionHydrate();
  return <>{children}</>;
}
