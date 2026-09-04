'use client';

import { useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { signOutEverywhere } from '@/lib/signout';

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
 */
const PUBLIC_POLL_MS  = 60_000;        // 1 minute
const TRUSTED_POLL_MS = 5 * 60_000;    // 5 minutes

export function useSessionHeartbeat() {
  const forceLogout = useCallback(async () => {
    await signOutEverywhere({
      redirectTo: '/login?reason=session_expired',
      broadcastReason: 'session_expired',
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const check = async () => {
      if (cancelled) return;
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        // No session at all → already logged out somewhere; bounce.
        if (!session) {
          await forceLogout();
          return;
        }

        const { data: row } = await supabase
          .from('user_sessions')
          .select('expires_at, is_public_device')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (row?.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
          await forceLogout();
          return;
        }

        // Pick the next interval based on session type. Tail-recursive
        // setTimeout (rather than setInterval) lets each tick read the
        // latest is_public_device value without juggling intervals.
        const nextDelay = row?.is_public_device ? PUBLIC_POLL_MS : TRUSTED_POLL_MS;
        if (!cancelled) {
          timer = setTimeout(check, nextDelay);
        }
      } catch (err) {
        // A transient network/DB error previously killed the poll loop
        // outright (the setTimeout call below was never reached) — the
        // user's stale-dashboard redirect would then depend entirely on
        // the next full navigation hitting the middleware's own expiry
        // check. Reschedule at the trusted (slower) cadence instead of
        // giving up, so one bad request doesn't end the loop.
        if (process.env.NODE_ENV !== 'production') {
          console.error('useSessionHeartbeat: check failed, retrying later', err);
        }
        if (!cancelled) {
          timer = setTimeout(check, TRUSTED_POLL_MS);
        }
      }
    };

    check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [forceLogout]);
}
