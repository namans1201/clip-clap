import { createClient } from '@/lib/supabase/server';
import { Clip, Group } from '@/types/database';

/**
 * Server-side prefetch for the dashboard shell. Called once from
 * (dashboard)/layout.tsx (a Server Component) so clips + active groups
 * arrive embedded in the initial HTML/RSC payload instead of the client
 * mounting with an empty list and only fetching after hydration — which
 * is what produced the loading spinner on every dashboard visit.
 *
 * Only fetches what ClipsProvider/GroupsProvider need to skip their
 * loading state (see initialClips/initialGroups on those hooks below):
 * every clip (ClipsProvider's `all: true` mode — pages derive their own
 * active/pinned/trashed/group views client-side from this one list, same
 * as before) and active groups. Deleted groups stay client-fetched by
 * useGroups() as they already were — nothing gates its own loading flag
 * on that fetch, and it's only ever read from the Trash page.
 *
 * This module reads cookies() (via '@/lib/supabase/server') and must
 * only ever be imported from a Server Component — never from a 'use
 * client' file.
 */
export interface DashboardInitialData {
  clips: Clip[];
  clipsError: string | null;
  groups: Group[];
  groupsError: string | null;
}

export async function fetchDashboardInitialData(): Promise<DashboardInitialData> {
  const supabase = await createClient();

  const [clipsResult, groupsResult] = await Promise.all([
    supabase
      .from('clips')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('groups')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: true }),
  ]);

  return {
    clips: (clipsResult.data as Clip[] | null) ?? [],
    clipsError: clipsResult.error ? clipsResult.error.message : null,
    groups: (groupsResult.data as Group[] | null) ?? [],
    groupsError: groupsResult.error ? groupsResult.error.message : null,
  };
}
