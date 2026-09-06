'use client';

import { useState } from 'react';
import { Clip, Group } from '@/types/database';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Copy, Pin, Trash2, Pencil, Check, X, Download } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ClipContentRenderer } from './clip-content-renderer';
import { downloadClipAsFile } from '@/lib/file-download';

interface ClipSnapshot {
  title: string;
  content: string;
  groupId: string | null;
  isPinned: boolean;
}

interface ClipEditorProps {
  clip: Clip | null;
  groups: Group[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: (id: string, updates: Partial<Pick<Clip, 'content' | 'title' | 'group_id' | 'is_pinned'>>) => Promise<void> | void;
  onTogglePin?: (id: string, isPinned: boolean) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}

function createSnapshot(clip: Clip): ClipSnapshot {
  return {
    title: clip.title ?? '',
    content: clip.content,
    groupId: clip.group_id,
    isPinned: clip.is_pinned,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function ClipEditor({
  clip,
  groups,
  open,
  onOpenChange,
  onUpdate,
  onTogglePin,
  onDelete,
}: ClipEditorProps) {
  const initialSnapshot = clip
    ? createSnapshot(clip)
    : {
        title: '',
        content: '',
        groupId: null,
        isPinned: false,
      };
  const [isEditing, setIsEditing] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [savedClip, setSavedClip] = useState<ClipSnapshot>(initialSnapshot);
  const [draftClip, setDraftClip] = useState<ClipSnapshot>(initialSnapshot);

  if (!clip) return null;

  const selectedGroup = groups.find((g) => g.id === savedClip.groupId);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(savedClip.content);
      toast.success('Copied to clipboard!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleSave = async () => {
    if (!onUpdate || isWorking) return;

    const nextClip = {
      ...draftClip,
      title: draftClip.title.trim(),
    };

    setIsWorking(true);

    try {
      await onUpdate(clip.id, {
        title: nextClip.title || null,
        content: nextClip.content,
        group_id: nextClip.groupId,
      });
      setSavedClip(nextClip);
      setDraftClip(nextClip);
      setIsEditing(false);
      toast.success('Clip updated');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update clip'));
    } finally {
      setIsWorking(false);
    }
  };

  const handleCancel = () => {
    setDraftClip(savedClip);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!onDelete || isWorking) return;

    setIsWorking(true);

    try {
      await onDelete(clip.id);
      onOpenChange(false);
      toast.success('Clip moved to trash');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete clip'));
    } finally {
      setIsWorking(false);
    }
  };

  const handleTogglePin = async () => {
    if (!onTogglePin || isWorking) return;

    const nextPinned = !savedClip.isPinned;

    setIsWorking(true);

    try {
      await onTogglePin(clip.id, savedClip.isPinned);
      setSavedClip((current) => ({
        ...current,
        isPinned: nextPinned,
      }));
      setDraftClip((current) => ({
        ...current,
        isPinned: nextPinned,
      }));
      toast.success(nextPinned ? 'Clip pinned' : 'Clip unpinned');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update clip'));
    } finally {
      setIsWorking(false);
    }
  };

  const handleStartEditing = () => {
    setDraftClip(savedClip);
    setIsEditing(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Responsive ramp: shadcn base already gives mobile `100%-2rem`,
          but it also ships `sm:max-w-sm` which `tailwind-merge` can't
          reliably override. The `!` modifier forces our caps to win.
          Tall on every size so long clips aren't tiny. */}
      <DialogContent className="sm:!max-w-2xl md:!max-w-3xl lg:!max-w-4xl !max-h-[92vh] sm:!max-h-[88vh] flex flex-col">
        <DialogHeader className="pr-10">
          <DialogTitle className="flex items-center justify-between gap-4">
            <span className="truncate">Clip Details</span>
            <div className="flex items-center gap-1 shrink-0">
              {!isEditing ? (
                <>
                  <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" onClick={handleCopy} title="Copy" disabled={isWorking}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 sm:h-8 sm:w-8"
                    onClick={() => {
                      try {
                        const filename = downloadClipAsFile({
                          id: clip.id,
                          title: savedClip.title || null,
                          content: savedClip.content,
                        });
                        toast.success(`Saved ${filename}`);
                      } catch (error) {
                        toast.error(getErrorMessage(error, 'Failed to download'));
                      }
                    }}
                    title="Download as file"
                    disabled={isWorking}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 sm:h-8 sm:w-8"
                    onClick={handleTogglePin}
                    title={savedClip.isPinned ? 'Unpin' : 'Pin'}
                    disabled={isWorking}
                  >
                    <Pin className={cn('h-4 w-4', savedClip.isPinned && 'fill-current')} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" onClick={handleStartEditing} title="Edit" disabled={isWorking}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8 text-destructive" onClick={handleDelete} title="Delete" disabled={isWorking}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" onClick={handleSave} title="Save" disabled={isWorking}>
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" onClick={handleCancel} title="Cancel" disabled={isWorking}>
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {isEditing ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="title">Title (optional)</Label>
                <Input
                  id="title"
                  value={draftClip.title}
                  onChange={(e) =>
                    setDraftClip((current) => ({
                      ...current,
                      title: e.target.value,
                    }))
                  }
                  placeholder="Enter a title..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  value={draftClip.content}
                  onChange={(e) =>
                    setDraftClip((current) => ({
                      ...current,
                      content: e.target.value,
                    }))
                  }
                  className="min-h-[200px] font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label>Group</Label>
                <select
                  value={draftClip.groupId || ''}
                  onChange={(e) =>
                    setDraftClip((current) => ({
                      ...current,
                      groupId: e.target.value || null,
                    }))
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">No group</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              {savedClip.title && (
                <div>
                  <Label className="text-muted-foreground text-xs">Title</Label>
                  <p className="font-medium">{savedClip.title}</p>
                </div>
              )}

              {selectedGroup && (
                <div>
                  <Label className="text-muted-foreground text-xs">Group</Label>
                  <p className="font-medium">{selectedGroup.name}</p>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground text-xs">Content</Label>
                {/* Extension-aware rendering. Falls through to a styled
                    <pre> identical to the previous look for titleless clips
                    or unrecognised extensions.

                    No maxHeight here (unlike the card preview / Quick View) —
                    this panel already sits inside the dialog body's own
                    `overflow-auto` (below), which scrolls Title + Group +
                    Content together as one surface. Giving this its own
                    capped, independently-scrolling region on top of that
                    produced two visible scrollbars for a single long clip:
                    one for the whole panel, one for just the content box. */}
                <div className="mt-1">
                  <ClipContentRenderer
                    title={savedClip.title || clip.title}
                    content={savedClip.content}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
