'use client';

import { useMemo, useTransition, useState } from 'react';
import { useClipsContext } from '@/contexts/clips-context';
import { useGroupsContext } from '@/contexts/groups-context';
import { useCompact } from '@/contexts/compact-context';
import { useDebounce } from '@/hooks/use-debounce';
import { ClipGrid } from '@/components/clip-grid';
import { ClipEditor } from '@/components/clip-editor';
import { NewClipDialog } from '@/components/new-clip-dialog';
import { SearchBar } from '@/components/search-bar';
import { DashboardThemeToggle } from '@/components/theme-toggle-dashboard';
import { ErrorDisplay } from '@/components/error-display';
import { DashboardLoader } from '@/components/dashboard-loader';
import { Clip } from '@/types/database';

export default function HomePage() {
  // Shared across every dashboard page (see ClipsProvider/GroupsProvider
  // in (dashboard)/layout.tsx) — one fetch, one realtime subscription
  // each, not one per page. `clips` here is the user's ENTIRE list
  // (active + trashed); this page derives its own "active" view below.
  const { clips: allClips, loading, error: clipsError, refetch: refetchClips, createClip, updateClip, togglePin, toggleLock, resizeClip, softDelete } = useClipsContext();
  const { groups, error: groupsError } = useGroupsContext();
  const { compact } = useCompact();
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 200);
  // Transition is used only for the search-filter state update (which can
  // be heavier when there are many clips). Opening a clip is an instant
  // dialog open, not a transition, so we drop it on click. The previous
  // implementation also rendered a visible pending pulse-bar above the
  // grid, which caused a layout shift + visible line every time the user
  // clicked a clip — removed.
  const [, startTransition] = useTransition();

  const clips = useMemo(() => allClips.filter((c) => !c.is_deleted), [allClips]);

  const filteredClips = useMemo(() => {
    if (!debouncedQuery.trim()) return clips;
    const query = debouncedQuery.toLowerCase();
    return clips.filter(
      (clip) =>
        clip.content.toLowerCase().includes(query) ||
        clip.title?.toLowerCase().includes(query)
    );
  }, [clips, debouncedQuery]);

  const handleClipClick = (clip: Clip) => {
    setSelectedClip(clip);
  };

  const handleSearchChange = (value: string) => {
    startTransition(() => setSearchQuery(value));
  };

  if (loading) return <DashboardLoader />;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 smooth-scroll">
      {(clipsError || groupsError) && (
        <ErrorDisplay error={clipsError || groupsError} onRetry={refetchClips} />
      )}

      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <SearchBar value={searchQuery} onChange={handleSearchChange} />
        </div>
        <NewClipDialog groups={groups} onCreateClip={createClip} />
        <DashboardThemeToggle />
      </div>

      <ClipGrid
        clips={filteredClips}
        groups={groups}
        onTogglePin={togglePin}
        onToggleLock={toggleLock}
        onResize={resizeClip}
        onDelete={softDelete}
        onClipClick={handleClipClick}
        emptyMessage={debouncedQuery ? 'No clips match your search' : 'No clips yet. Create your first clip!'}
        searchQuery={debouncedQuery}
        compact={compact}
      />

      <ClipEditor
        key={selectedClip?.id ?? 'empty'}
        clip={selectedClip}
        groups={groups}
        open={!!selectedClip}
        onOpenChange={(open) => !open && setSelectedClip(null)}
        onUpdate={updateClip}
        onTogglePin={togglePin}
        onDelete={async (id) => {
          await softDelete(id);
          setSelectedClip(null);
        }}
      />
    </div>
  );
}
