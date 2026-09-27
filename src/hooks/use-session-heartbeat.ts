'use client';

import { useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { signOutEverywhere } from '@/lib/signout';
import { useSessionRowContext } from '@/contexts/session-row-context';

/**
 * Periodically checks the authoritative expires_at from public.user_sessions
 * (the row written by record_session_start() at login). When it's in the
 * past we sign out + redirect, so the user doesn't sit on a stale dashboard
 * waiting for their next request to be 307'd.
 *
 * Polls for ALL session types now (not just public devices). The cadence
 * is faster for public sessions because their 15-min cap means a missed
 * tick can leave the user on a "dead" UI longer relative to total session
 * length; trusted sessions are 30 days so a slow poll is fine.
 *
 * The very first check reuses SessionRowProvider's already-in-flight/
 * resolved fetch (see (dashboard)/layout.tsx and session-row-context.tsx)
 * instead of firing its own redundant getSession() + user_sessions query
 * the instant the dashboard mounts. Every check after that calls this
 * hook's own createClient() directly, same as before — polling needs
 * fresh data each tick regardless.
 */
const PUBLIC_POLL_MS  = 60_000;        // 1 minute
const TRUSTED_POLL_MS = 5 * 60_000;    // 5 minutes

export function useSessionHeartbeat() {
  const { loading: initialLoading, error: initialError, session: initialSession, row: initialRow } = useSessionRowContext();

  const forceLogout = useCallback(async () => {
    await signOutEverywhere({
      redirectTo: '/login?reason=session_expired',
      broadcastReason: 'session_expired',
    });
  }, []);

  useEffect(() => {
    // Wait for the shared initial fetch to resolve before doing anything —
    // once it has, this effect (which depends on initialLoading) re-runs
    // and the loop below starts, seeded from that shared result.
    if (initialLoading) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const checkWith = async (session: typeof initialSession, row: typeof initialRow) => {
      if (cancelled) return;

      // No session at all → already logged out somewhere; bounce.
      if (!session) {
        await forceLogout();
        return;
      }

      if (row?.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
        await forceLogout();
        return;
      }

      // Pick the next interval based on session type. Tail-recursive
      // setTimeout (rather than setInterval) lets each tick read the
      // latest is_public_device value without juggling intervals.
      const nextDelay = row?.is_public_device ? PUBLIC_POLL_MS : TRUSTED_POLL_MS;
      if (!cancelled) {
        timer = setTimeout(poll, nextDelay);
      }
    };

    // Every tick after the first fetches fresh data itself — same
    // querying logic use-session-row previously ran inline here.
    const poll = async () => {
      if (cancelled) return;
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          await forceLogout();
          return;
        }

        const { data: row } = await supabase
          .from('user_sessions')
          .select('expires_at, is_public_device')
          .eq('user_id', session.user.id)
          .maybeSingle();

        await checkWith(session, row ?? null);
      } catch (err) {
        // A transient network/DB error previously killed the poll loop
        // outright — reschedule at the trusted (slower) cadence instead
        // of giving up, so one bad request doesn't end the loop.
        if (process.env.NODE_ENV !== 'production') {
          console.error('useSessionHeartbeat: check failed, retrying later', err);
        }
        if (!cancelled) {
          timer = setTimeout(poll, TRUSTED_POLL_MS);
        }
      }
    };

    // First check is seeded from the shared fetch — no query of our own.
    // If that shared fetch itself errored (network/DB blip), its
    // session/row come back null too, but that null does NOT mean "the
    // user is logged out" — treat it the same as poll()'s own catch
    // branch (retry later) instead of forceLogout()'ing someone off a
    // transient failure.
    if (initialError) {
      timer = setTimeout(poll, TRUSTED_POLL_MS);
    } else {
      checkWith(initialSession, initialRow);
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialSession/initialRow/initialError are the seed for the FIRST check only; re-running this effect every time they change would restart the poll loop on every heartbeat elsewhere in the app.
  }, [initialLoading, forceLogout]);
}
