'use client';

import { useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { signOutEverywhere } from '@/lib/signout';

/**
 * Auto-lock: after `timeoutMinutes` of no user input on a public-device
 * session, sign the user out across every open tab.
 *
 * Source of truth for "is this a public-device session" is now
 * public.user_sessions (set by record_session_start() at login), not
 * sessionStorage — see the security-hardening migration.
 */
export function useAutoLock(timeoutMinutes: number = 5) {
  const handleLogout = useCallback(async () => {
    await signOutEverywhere({ broadcastReason: 'session_expired' });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let listenersAttached = false;
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

    const resetTimer = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(handleLogout, timeoutMinutes * 60 * 1000);
    };

    (async () => {
      // Read the authoritative is_public_device flag from user_sessions.
      // A transient network/DB error here previously left auto-lock simply
      // never armed for the rest of this mount (unhandled rejection, no
      // retry) — not a hard security hole since the server-side expiry in
      // middleware/record_session_start is the real boundary regardless,
      // but still a silent feature failure worth catching.
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled || !session) return;

        const { data: row } = await supabase
          .from('user_sessions')
          .select('is_public_device')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (cancelled) return;

        // Only enable auto-lock for public devices.
        if (!row?.is_public_device) return;

        events.forEach((e) => document.addEventListener(e, resetTimer, { passive: true }));
        listenersAttached = true;
        resetTimer();
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('useAutoLock: failed to determine device type', err);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      if (listenersAttached) {
        events.forEach((e) => document.removeEventListener(e, resetTimer));
      }
    };
  }, [timeoutMinutes, handleLogout]);
}
