'use client';

import { useEffect } from 'react';
import { useAutoLock } from '@/hooks/use-auto-lock';
import { useSessionHeartbeat } from '@/hooks/use-session-heartbeat';
import { subscribeToSignoutBroadcasts } from '@/lib/signout';

/**
 * Runs the two hooks that need the shared user_sessions row
 * (SessionRowProvider — see (dashboard)/layout.tsx) fetched once for
 * both of them instead of each firing its own redundant getSession() +
 * row query on mount.
 *
 * Pulled into its own 'use client' file because (dashboard)/layout.tsx
 * is now a Server Component (it fetches clips/groups server-side — see
 * lib/dashboard-data.ts) and can no longer call hooks itself; it renders
 * this component instead.
 */
export function DashboardSessionEffects() {
  useAutoLock(5);
  useSessionHeartbeat();

  // Listen for sign-out broadcasts from peer tabs (BroadcastChannel) — if
  // any other tab in the same browser signs out, this one jumps to /login
  // immediately instead of waiting for the next request to be 307'd.
  useEffect(() => subscribeToSignoutBroadcasts(), []);

  return null;
}
