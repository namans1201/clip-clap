'use client';

import { useState, useMemo, useTransition } from 'react';
import { useClipsContext } from '@/contexts/clips-context';
import { useGroupsContext } from '@/contexts/groups-context';
import { ClipGrid } from '@/components/clip-grid';
import { ClipGridSkeleton } from '@/components/clip-card-skeleton';
import { ClipEditor } from '@/components/clip-editor';
import { NewClipDialog } from '@/components/new-clip-dialog';
import { SearchBar } from '@/components/search-bar';
import { DashboardThemeToggle } from '@/components/theme-toggle-dashboard';
import { Clip } from '@/types/database';
import { Inbox } from 'lucide-react';

export default function UngroupedPage() {
  // Shared across every dashboard page — see ClipsProvider/GroupsProvider
  // in (dashboard)/layout.tsx. `allClips` is the user's entire list;
  // derive the ungrouped/active subset client-side below.
  const { clips: allClips, loading, createClip, updateClip, togglePin, toggleLock, resizeClip, softDelete } = useClipsContext();
  const { groups } = useGroupsContext();
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Transition used only for the search-filter; opening a clip is an
  // instant dialog open and doesn't need to defer. Visible pending-bar
  // removed to stop the layout shift on clip click.
  const [, startTransition] = useTransition();

  // "Ungrouped" = active clips with no group_id at all — excludes
  // anything that belongs to any existing group.
  const clips = useMemo(
    () => allClips.filter((c) => !c.is_deleted && !c.group_id),
    [allClips],
  );

  const filteredClips = useMemo(() => {
    if (!searchQuery.trim()) return clips;
    const query = searchQuery.toLowerCase();
    return clips.filter(
      (clip) =>
        clip.content.toLowerCase().includes(query) ||
        clip.title?.toLowerCase().includes(query)
    );
  }, [clips, searchQuery]);

  const handleSearchChange = (value: string) => {
    startTransition(() => {
      setSearchQuery(value);
    });
  };

  const handleClipClick = (clip: Clip) => {
    setSelectedClip(clip);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Inbox className="h-6 w-6 animate-pulse" />
            <div className="h-8 bg-muted rounded w-48 animate-pulse" />
          </div>
          <div className="h-10 bg-muted rounded w-64 animate-pulse" />
          <ClipGridSkeleton count={6} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 smooth-scroll">
      <div className="flex items-center gap-3">
        <Inbox className="h-5 w-5 sm:h-6 sm:w-6" />
        <h1 className="text-xl sm:text-2xl font-semibold font-sans">Ungrouped Clips</h1>
        <div className="ml-auto">
          <DashboardThemeToggle />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <SearchBar value={searchQuery} onChange={handleSearchChange} />
        </div>
        {/* No defaultGroupId — matches this view's own "no group" context,
            same as the Home page's default. */}
        <NewClipDialog groups={groups} onCreateClip={createClip} />
      </div>

      <ClipGrid
        clips={filteredClips}
        groups={groups}
        onTogglePin={togglePin}
        onToggleLock={toggleLock}
        onResize={resizeClip}
        onDelete={softDelete}
        onClipClick={handleClipClick}
        emptyMessage={searchQuery ? 'No ungrouped clips match your search' : 'No ungrouped clips — everything is filed into a group'}
        searchQuery={searchQuery}
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
