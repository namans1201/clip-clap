'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useGroups } from '@/hooks/use-groups';

type GroupsValue = ReturnType<typeof useGroups>;

const GroupsContext = createContext<GroupsValue | null>(null);

/**
 * useGroups() already fetches everything (no filter variants exist), but
 * it was previously called independently in the sidebar AND in every
 * page — meaning two fetches and two realtime channels open on any given
 * dashboard view. Sharing one instance here removes that duplication.
 */
export function GroupsProvider({ children }: { children: ReactNode }) {
  const value = useGroups();
  return <GroupsContext.Provider value={value}>{children}</GroupsContext.Provider>;
}

export function useGroupsContext(): GroupsValue {
  const ctx = useContext(GroupsContext);
  if (!ctx) {
    throw new Error('useGroupsContext must be used within a GroupsProvider');
  }
  return ctx;
}
