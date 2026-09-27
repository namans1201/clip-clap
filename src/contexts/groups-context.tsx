'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useGroups } from '@/hooks/use-groups';
import { Group } from '@/types/database';

type GroupsValue = ReturnType<typeof useGroups>;

const GroupsContext = createContext<GroupsValue | null>(null);

/**
 * useGroups() already fetches everything (no filter variants exist), but
 * it was previously called independently in the sidebar AND in every
 * page — meaning two fetches and two realtime channels open on any given
 * dashboard view. Sharing one instance here removes that duplication.
 *
 * initialGroups/initialError come from (dashboard)/layout.tsx, which
 * fetches them server-side (lib/dashboard-data.ts) before this ever
 * mounts — see useGroups for what that skips client-side.
 */
export function GroupsProvider({
  children,
  initialGroups,
  initialError,
}: {
  children: ReactNode;
  initialGroups?: Group[];
  initialError?: string | null;
}) {
  const value = useGroups({ initialGroups, initialError });
  return <GroupsContext.Provider value={value}>{children}</GroupsContext.Provider>;
}

export function useGroupsContext(): GroupsValue {
  const ctx = useContext(GroupsContext);
  if (!ctx) {
    throw new Error('useGroupsContext must be used within a GroupsProvider');
  }
  return ctx;
}
