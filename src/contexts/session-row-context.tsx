'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

interface SessionRow {
  expires_at: string | null;
  is_public_device: boolean | null;
}

interface SessionRowState {
  session: Session | null;
  row: SessionRow | null;
  /** True until the first fetch (below) resolves. */
  loading: boolean;
  /**
   * True when the fetch itself threw (network/DB error) rather than
   * cleanly resolving to "no session". Consumers must not treat this the
   * same as an actual logged-out state — see useSessionHeartbeat, which
   * would otherwise force-logout a user on a transient blip instead of
   * retrying, same as its own polling loop already does.
   */
  error: boolean;
}

interface SessionRowValue extends SessionRowState {
  /** Re-fetches session + user_sessions row and returns the fresh values. */
  refresh: () => Promise<SessionRowState>;
}

const SessionRowContext = createContext<SessionRowValue | null>(null);

/**
 * Fetches `auth.getSession()` + the matching `public.user_sessions` row
 * ONCE on mount and shares it with every consumer.
 *
 * Before this, useAutoLock and useSessionHeartbeat each independently ran
 * this exact same pair of queries in their own mount effect — two
 * separate `getSession()` calls plus two separate `user_sessions` selects
 * firing in parallel the moment the dashboard rendered, on top of the
 * proxy's own check for the same request. This provider removes one of
 * those two client-side fetches; useSessionHeartbeat still polls on its
 * own interval afterwards (it needs fresh data over time), but seeds its
 * first check from this shared fetch instead of re-querying immediately.
 */
export function SessionRowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionRowState>({ session: null, row: null, loading: true, error: false });
  const mountedRef = useRef(true);

  const refresh = useCallback(async (): Promise<SessionRowState> => {
    if (mountedRef.current) setState((prev) => ({ ...prev, loading: true }));

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        const next: SessionRowState = { session: null, row: null, loading: false, error: false };
        if (mountedRef.current) setState(next);
        return next;
      }

      const { data: row } = await supabase
        .from('user_sessions')
        .select('expires_at, is_public_device')
        .eq('user_id', session.user.id)
        .maybeSingle();

      const next: SessionRowState = { session, row: row ?? null, loading: false, error: false };
      if (mountedRef.current) setState(next);
      return next;
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('SessionRowProvider: fetch failed', err);
      }
      const next: SessionRowState = { session: null, row: null, loading: false, error: true };
      if (mountedRef.current) setState(next);
      return next;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
    })();
  }, [refresh]);

  return (
    <SessionRowContext.Provider value={{ ...state, refresh }}>
      {children}
    </SessionRowContext.Provider>
  );
}

export function useSessionRowContext(): SessionRowValue {
  const ctx = useContext(SessionRowContext);
  if (!ctx) {
    throw new Error('useSessionRowContext must be used within a SessionRowProvider');
  }
  return ctx;
}
