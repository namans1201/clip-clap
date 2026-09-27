'use client';

import { useEffect, useCallback } from 'react';
import { signOutEverywhere } from '@/lib/signout';
import { useSessionRowContext } from '@/contexts/session-row-context';

/**
 * Auto-lock: after `timeoutMinutes` of no user input on a public-device
 * session, sign the user out across every open tab.
 *
 * Source of truth for "is this a public-device session" is now
 * public.user_sessions (set by record_session_start() at login), not
 * sessionStorage — see the security-hardening migration.
 *
 * `is_public_device` comes from SessionRowProvider (see (dashboard)/
 * layout.tsx) rather than this hook fetching it itself — see that
 * provider's doc comment for why.
 */
export function useAutoLock(timeoutMinutes: number = 5) {
  const { row, loading } = useSessionRowContext();
  const handleLogout = useCallback(async () => {
    await signOutEverywhere({ broadcastReason: 'session_expired' });
  }, []);

  useEffect(() => {
    if (loading) return;
    // Only enable auto-lock for public devices.
    if (!row?.is_public_device) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

    const resetTimer = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(handleLogout, timeoutMinutes * 60 * 1000);
    };

    events.forEach((e) => document.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timeout) clearTimeout(timeout);
      events.forEach((e) => document.removeEventListener(e, resetTimer));
    };
  }, [loading, row?.is_public_device, timeoutMinutes, handleLogout]);
}
