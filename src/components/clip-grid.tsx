'use client';

import { memo } from 'react';
import { Clip, Group } from '@/types/database';
import { ClipCard } from './clip-card';

interface ClipGridProps {
  clips: Clip[];
  groups: Group[];
  onTogglePin?: (id: string, isPinned: boolean) => Promise<void> | void;
  onToggleLock?: (id: string, isLocked: boolean) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
  onRestore?: (id: string) => Promise<void> | void;
  onPermanentDelete?: (id: string) => Promise<void> | void;
  onResize?: (id: string, width_span: number, height_span: number) => Promise<void> | void;
  onClipClick?: (clip: Clip) => void;
  isTrashView?: boolean;
  emptyMessage?: string;
  searchQuery?: string;
  compact?: boolean;
}

function ClipGridComponent({
  clips,
  groups,
  onTogglePin,
  onToggleLock,
  onDelete,
  onRestore,
  onPermanentDelete,
  onResize,
  onClipClick,
  isTrashView = false,
  emptyMessage = 'No clips yet',
  searchQuery = '',
  compact = false,
}: ClipGridProps) {
  if (clips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
        <span className="text-4xl">📋</span>
        <span className="text-sm">{emptyMessage}</span>
      </div>
    );
  }

  // Uniform sizing: `grid-auto-rows` fixes every row to the same height,
  // and `items-stretch` (Grid's default) makes each card fill its cell.
  // Until the user drags a corner, every clip looks identical — exactly
  // the "same sized, aligned" baseline the user wants.
  //
  // `grid-auto-flow: dense` packs smaller items into holes a neighbour
  // creates when it claims an extra column/row.
  return (
    <div
      className={compact
        ? 'flex flex-col gap-4'
        : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 [grid-auto-rows:280px] [grid-auto-flow:dense]'
      }
    >
      {clips.map((clip) => (
        <ClipCard
          key={clip.id}
          clip={clip}
          groups={groups}
          onTogglePin={onTogglePin}
          onToggleLock={onToggleLock}
          onDelete={onDelete}
          onRestore={onRestore}
          onPermanentDelete={onPermanentDelete}
          onResize={onResize}
          onClick={onClipClick}
          isTrashView={isTrashView}
          searchQuery={searchQuery}
          compact={compact}
        />
      ))}
    </div>
  );
}

export const ClipGrid = memo(ClipGridComponent);
