'use client';

import { useState, useMemo, useTransition } from 'react';
import { useParams } from 'next/navigation';
import { useClips } from '@/hooks/use-clips';
import { useGroups } from '@/hooks/use-groups';
import { ClipGrid } from '@/components/clip-grid';
import { ClipGridSkeleton } from '@/components/clip-card-skeleton';
import { ClipEditor } from '@/components/clip-editor';
import { NewClipDialog } from '@/components/new-clip-dialog';
import { SearchBar } from '@/components/search-bar';
import { DashboardThemeToggle } from '@/components/theme-toggle-dashboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clip } from '@/types/database';
import { FolderOpen, Pencil, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function GroupPage() {
  const params = useParams();
  const groupId = params.id as string;
  
  const { clips, loading: clipsLoading, createClip, updateClip, togglePin, toggleLock, resizeClip, softDelete } = useClips({ groupId });
  const { groups, loading: groupsLoading, updateGroup, deleteGroup } = useGroups();
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // Transition used only for the search-filter; opening a clip is an
  // instant dialog open. Visible pending-bar removed to stop the layout
  // shift on clip click.
  const [, startTransition] = useTransition();

  const group = groups.find((g) => g.id === groupId);
  const isLoading = clipsLoading || groupsLoading;

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

  const handleStartEdit = () => {
    if (group) {
      setEditName(group.name);
      setIsEditing(true);
    }
  };

  const handleSaveEdit = async () => {
    if (editName.trim() && group) {
      try {
        await updateGroup(group.id, editName.trim());
        setIsEditing(false);
        toast.success('Group updated');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update group');
      }
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName('');
  };

  const handleDeleteGroup = async () => {
    if (group) {
      try {
        await deleteGroup(group.id);
        setShowDeleteDialog(false);
        toast.success('Group deleted');
        window.location.href = '/';
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to delete group');
      }
    }
  };

  if (!group && !isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <p className="text-muted-foreground">Group not found</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-6 w-6 animate-pulse" />
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
      <div className="flex items-center justify-between gap-2">
        {isEditing ? (
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <FolderOpen className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-9 flex-1 min-w-0"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') handleCancelEdit();
              }}
            />
            <div className="flex items-center gap-0 flex-shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSaveEdit}>
                <Check className="h-4 w-4 text-green-600" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCancelEdit}>
                <X className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* icon + title: tight grouping so the folder reads as a label for the name */}
            <div className="flex items-center gap-1.5 min-w-0">
              <FolderOpen className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
              <h1 className="text-xl sm:text-2xl font-semibold font-sans truncate">{group?.name}</h1>
            </div>
            {/* edit + delete: tight grouping so the two row-actions read as a pair */}
            <div className="flex items-center gap-0 flex-shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleStartEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        <DashboardThemeToggle />
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <SearchBar value={searchQuery} onChange={handleSearchChange} />
        </div>
        <NewClipDialog groups={groups} onCreateClip={createClip} defaultGroupId={groupId} />
      </div>

      <ClipGrid
        clips={filteredClips}
        groups={groups}
        onTogglePin={togglePin}
        onToggleLock={toggleLock}
        onResize={resizeClip}
        onDelete={softDelete}
        onClipClick={handleClipClick}
        emptyMessage={searchQuery ? 'No clips match your search' : 'No clips in this group yet'}
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

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Group?</DialogTitle>
            <DialogDescription>
              This will delete the group &quot;{group?.name}&quot;. Clips in this group will be moved to ungrouped.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteGroup}>
              Delete Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
