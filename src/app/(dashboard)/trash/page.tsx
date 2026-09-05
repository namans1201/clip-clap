'use client';

import { useState, useMemo, useTransition } from 'react';
import { useClipsContext } from '@/contexts/clips-context';
import { useGroupsContext } from '@/contexts/groups-context';
import { ClipGrid } from '@/components/clip-grid';
import { ClipGridSkeleton } from '@/components/clip-card-skeleton';
import { SearchBar } from '@/components/search-bar';
import { DashboardThemeToggle } from '@/components/theme-toggle-dashboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Folder, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function TrashPage() {
  // Shared across every dashboard page — see ClipsProvider/GroupsProvider
  // in (dashboard)/layout.tsx. `allClips` is the user's entire list;
  // derive the trashed subset client-side below.
  const { clips: allClips, loading, restore, permanentDelete } = useClipsContext();
  const { groups, deletedGroups, restoreGroup, permanentDeleteGroup } = useGroupsContext();
  const clips = useMemo(() => allClips.filter((c) => c.is_deleted), [allClips]);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEmptying, setIsEmptying] = useState(false);
  // Transition is used only for the search-filter state update — visible
  // pending-bar removed to keep the layout stable on every interaction.
  const [, startTransition] = useTransition();

  const filteredClips = useMemo(() => {
    if (!searchQuery.trim()) return clips;
    const query = searchQuery.toLowerCase();
    return clips.filter(
      (clip) =>
        clip.content.toLowerCase().includes(query) ||
        clip.title?.toLowerCase().includes(query)
    );
  }, [clips, searchQuery]);

  const filteredDeletedGroups = useMemo(() => {
    if (!searchQuery.trim()) return deletedGroups;
    const query = searchQuery.toLowerCase();
    return deletedGroups.filter((group) => group.name.toLowerCase().includes(query));
  }, [deletedGroups, searchQuery]);

  const handleSearchChange = (value: string) => {
    startTransition(() => {
      setSearchQuery(value);
    });
  };

  const handlePermanentDelete = async () => {
    if (!confirmDeleteId || isDeleting) return;

    setIsDeleting(true);

    try {
      await permanentDelete(confirmDeleteId);
      setConfirmDeleteId(null);
      toast.success('Clip permanently deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete clip');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestoreGroup = async (id: string) => {
    try {
      await restoreGroup(id);
      toast.success('Group restored');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to restore group');
    }
  };

  const handlePermanentDeleteGroup = async () => {
    if (!confirmDeleteGroupId || isDeleting) return;

    setIsDeleting(true);

    try {
      await permanentDeleteGroup(confirmDeleteGroupId);
      setConfirmDeleteGroupId(null);
      toast.success('Group permanently deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete group');
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Empty the entire trash — every trashed clip + every trashed group.
   * Runs deletes in parallel (Promise.allSettled) so one failure doesn't
   * abort the rest, and reports a summary in the toast. Disables itself
   * while in flight to prevent double-clicks.
   */
  const handleEmptyTrash = async () => {
    if (isEmptying) return;
    setIsEmptying(true);

    const clipResults = await Promise.allSettled(
      clips.map((c) => permanentDelete(c.id)),
    );
    const groupResults = await Promise.allSettled(
      deletedGroups.map((g) => permanentDeleteGroup(g.id)),
    );

    const failed =
      clipResults.filter((r) => r.status === 'rejected').length +
      groupResults.filter((r) => r.status === 'rejected').length;
    const succeeded =
      clipResults.length + groupResults.length - failed;

    setConfirmEmpty(false);
    setIsEmptying(false);

    if (failed === 0) {
      toast.success(
        `Trash emptied — ${succeeded} item${succeeded === 1 ? '' : 's'} permanently deleted`,
      );
    } else if (succeeded === 0) {
      toast.error(`Failed to empty trash (${failed} item${failed === 1 ? '' : 's'} could not be deleted)`);
    } else {
      toast.warning(
        `Emptied ${succeeded} item${succeeded === 1 ? '' : 's'}; ${failed} could not be deleted`,
      );
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Trash2 className="h-6 w-6 animate-pulse" />
            <div className="h-8 bg-muted rounded w-32 animate-pulse" />
          </div>
          <div className="h-6 bg-muted rounded w-96 animate-pulse" />
          <div className="h-10 bg-muted rounded w-64 animate-pulse" />
          <ClipGridSkeleton count={6} />
        </div>
      </div>
    );
  }

  const hasDeletedClips = clips.length > 0;
  const hasDeletedGroups = deletedGroups.length > 0;
  const hasAnyDeleted = hasDeletedClips || hasDeletedGroups;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 smooth-scroll">
      <div className="flex items-center gap-3">
        <Trash2 className="h-5 w-5 sm:h-6 sm:w-6" />
        <h1 className="text-xl sm:text-2xl font-semibold font-sans">Trash</h1>
        <div className="ml-auto">
          <DashboardThemeToggle />
        </div>
      </div>

      <p className="text-sm sm:text-base text-muted-foreground">
        Deleted items can be restored or permanently deleted.
      </p>

      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <SearchBar value={searchQuery} onChange={handleSearchChange} />
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setConfirmEmpty(true)}
          disabled={!hasAnyDeleted || isEmptying}
          data-testid="empty-trash"
          title={hasAnyDeleted ? 'Permanently delete every clip + group in trash' : 'Trash is already empty'}
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          {isEmptying ? 'Emptying…' : 'Empty Trash'}
        </Button>
      </div>


      {!hasAnyDeleted ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Trash is empty
        </div>
      ) : (
        <Tabs defaultValue="clips" className="w-full">
          <TabsList>
            <TabsTrigger value="clips" className="gap-2">
              Clips {hasDeletedClips && <span className="text-xs bg-muted px-1.5 rounded">{filteredClips.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-2">
              Groups {hasDeletedGroups && <span className="text-xs bg-muted px-1.5 rounded">{filteredDeletedGroups.length}</span>}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="clips" className="mt-4">
            <ClipGrid
              clips={filteredClips}
              groups={groups}
              onRestore={restore}
              onPermanentDelete={setConfirmDeleteId}
              isTrashView
              emptyMessage={searchQuery ? 'No trashed clips match your search' : 'No deleted clips'}
              searchQuery={searchQuery}
            />
          </TabsContent>
          
          <TabsContent value="groups" className="mt-4">
            {filteredDeletedGroups.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                {searchQuery ? 'No trashed groups match your search' : 'No deleted groups'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {filteredDeletedGroups.map((group) => (
                  <Card key={group.id} className="group">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <Folder className="h-5 w-5 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{group.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleRestoreGroup(group.id)}
                          title="Restore"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setConfirmDeleteGroupId(group.id)}
                          title="Delete permanently"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Confirm delete clip dialog */}
      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Permanently?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This clip will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handlePermanentDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete group dialog */}
      <Dialog open={!!confirmDeleteGroupId} onOpenChange={() => setConfirmDeleteGroupId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Group Permanently?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This group will be permanently deleted.
              Clips in this group will become ungrouped (not deleted).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteGroupId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handlePermanentDeleteGroup} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm empty-trash dialog — describes the exact count being removed
          so the user can sanity-check before pulling the trigger. */}
      <Dialog
        open={confirmEmpty}
        onOpenChange={(open) => !isEmptying && setConfirmEmpty(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Empty Trash?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. {clips.length} clip{clips.length === 1 ? '' : 's'}
              {' '}and {deletedGroups.length} group{deletedGroups.length === 1 ? '' : 's'}
              {' '}will be permanently deleted. Clips inside the deleted groups will
              become ungrouped, not deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmEmpty(false)}
              disabled={isEmptying}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleEmptyTrash}
              disabled={isEmptying}
              data-testid="empty-trash-confirm"
            >
              {isEmptying ? 'Emptying…' : 'Empty Trash'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
