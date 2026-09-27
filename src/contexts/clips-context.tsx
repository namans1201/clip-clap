'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useClips } from '@/hooks/use-clips';
import { Clip } from '@/types/database';

type ClipsValue = ReturnType<typeof useClips>;

const ClipsContext = createContext<ClipsValue | null>(null);

/**
 * Fetches every clip for the user ONCE (one query, one realtime
 * subscription) and shares it across every dashboard page via context.
 *
 * Before this, Home/Pinned/Trash/Group each called useClips() with their
 * own filter options — meaning every navigation between them re-fetched
 * from Supabase and opened a brand new realtime channel from scratch,
 * throwing away whatever the previous page had just loaded. Consumers
 * now read the same shared list and filter it client-side with useMemo
 * (see e.g. the Home page's `clips.filter(c => !c.is_deleted)`), so
 * switching pages is instant and there's exactly one clips-realtime
 * channel open at a time, not one per page.
 *
 * initialClips/initialError come from (dashboard)/layout.tsx, which
 * fetches them server-side (lib/dashboard-data.ts) before this ever
 * mounts — see useClips for what that skips client-side.
 */
export function ClipsProvider({
  children,
  initialClips,
  initialError,
}: {
  children: ReactNode;
  initialClips?: Clip[];
  initialError?: string | null;
}) {
  const value = useClips({ all: true, initialClips, initialError });
  return <ClipsContext.Provider value={value}>{children}</ClipsContext.Provider>;
}

export function useClipsContext(): ClipsValue {
  const ctx = useContext(ClipsContext);
  if (!ctx) {
    throw new Error('useClipsContext must be used within a ClipsProvider');
  }
  return ctx;
}
