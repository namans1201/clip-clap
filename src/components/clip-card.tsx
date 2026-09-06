'use client';

import { memo, useEffect, useState } from 'react';
import { Clip, Group } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import {
  Pin,
  Copy,
  RotateCcw,
  X,
  Eye,
  Download,
  Lock,
  Unlock,
  FileCode2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ClipContentRenderer } from './clip-content-renderer';
import { ClipResizeHandle } from './clip-resize-handle';
import { downloadClipAsFile } from '@/lib/file-download';
import { useInView } from '@/hooks/use-in-view';
import styles from './clip-card.module.css';

interface ClipCardProps {
  clip: Clip;
  groups: Group[];
  onTogglePin?: (id: string, isPinned: boolean) => Promise<void> | void;
  onToggleLock?: (id: string, isLocked: boolean) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
  onRestore?: (id: string) => Promise<void> | void;
  onPermanentDelete?: (id: string) => Promise<void> | void;
  onResize?: (id: string, width_span: number, height_span: number) => Promise<void> | void;
  onClick?: (clip: Clip) => void;
  isTrashView?: boolean;
  searchQuery?: string;
  compact?: boolean;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

// Highlight search text in content (used in compact mode + title)
function highlightText(text: string, query: string) {
  if (!query.trim()) return text;

  const parts = text.split(
    new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
  );
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark
        key={i}
        className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

/**
 * Resolve the max width-span allowed at the current viewport (matches the
 * Tailwind `sm:grid-cols-2 lg:grid-cols-3` configuration in ClipGrid).
 */
function useGridMaxWidth(): number {
  const [max, setMax] = useState(3);

  useEffect(() => {
    const sm = window.matchMedia('(min-width: 640px)');
    const lg = window.matchMedia('(min-width: 1024px)');
    const apply = () => setMax(lg.matches ? 3 : sm.matches ? 2 : 1);
    apply();
    sm.addEventListener('change', apply);
    lg.addEventListener('change', apply);
    return () => {
      sm.removeEventListener('change', apply);
      lg.removeEventListener('change', apply);
    };
  }, []);

  return max;
}

function ClipCardComponent({
  clip,
  groups,
  onTogglePin,
  onToggleLock,
  onDelete,
  onRestore,
  onPermanentDelete,
  onResize,
  onClick,
  isTrashView = false,
  searchQuery = '',
  compact = false,
}: ClipCardProps) {
  const group = groups.find((g) => g.id === clip.group_id);
  const [isWorking, setIsWorking] = useState(false);
  const [showQuickView, setShowQuickView] = useState(false);

  // Resize preview state — separate from persisted value so an abandoned
  // drag (pointercancel) doesn't wedge the UI.
  const persistedW = clip.width_span ?? 1;
  const persistedH = clip.height_span ?? 1;
  const [previewW, setPreviewW] = useState<number | null>(null);
  const [previewH, setPreviewH] = useState<number | null>(null);

  const maxWidth = useGridMaxWidth();
  const effectiveW = Math.min(previewW ?? persistedW, maxWidth);
  const effectiveH = previewH ?? persistedH;

  // Defers the expensive part of rendering (markdown/code parsing, syntax
  // highlighting) until the card is near the viewport. A full windowed
  // grid (mounting/unmounting cards themselves) isn't safe here because
  // ClipGrid relies on the browser's dense auto-placement algorithm
  // (`grid-auto-flow: dense`) to pack variable width/height spans —
  // removing off-screen cards from the DOM would change how the
  // remaining ones pack. Deferring just the content keeps every card's
  // grid cell present (so packing stays correct) while skipping the
  // costly work for cards the user hasn't scrolled to yet.
  const { ref: contentRef, inView: contentInView } = useInView();

  const runAction = async (
    action: (() => Promise<void> | void) | undefined,
    fallbackMessage: string,
    successMessage?: string,
  ) => {
    if (!action || isWorking) return;
    setIsWorking(true);
    try {
      await action();
      if (successMessage) toast.success(successMessage);
    } catch (error) {
      toast.error(getErrorMessage(error, fallbackMessage));
    } finally {
      setIsWorking(false);
    }
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(clip.content);
      toast.success('Copied to clipboard!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleTogglePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await runAction(
      () => onTogglePin?.(clip.id, clip.is_pinned),
      'Failed to update clip',
      clip.is_pinned ? 'Clip unpinned' : 'Clip pinned',
    );
  };

  const handleToggleLock = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await runAction(
      () => onToggleLock?.(clip.id, clip.is_locked ?? false),
      'Failed to update lock',
      clip.is_locked ? 'Clip unlocked' : 'Clip locked',
    );
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await runAction(
      () => onDelete?.(clip.id),
      'Failed to delete clip',
      'Clip moved to trash',
    );
  };

  const handleRestore = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await runAction(() => onRestore?.(clip.id), 'Failed to restore clip', 'Clip restored');
  };

  const handlePermanentDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPermanentDelete?.(clip.id);
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Quick view bypasses lock — locked clips still show inside the
    // dialog. That matches the existing affordance: the lock is a
    // dashboard-cover gesture, not a privacy gate.
    setShowQuickView(true);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const filename = downloadClipAsFile(clip);
      toast.success(`Saved ${filename}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to download clip'));
    }
  };

  /** Pointer-driven resize: live preview while dragging, persist on release. */
  const handleResizeFromHandle = (next: {
    width: number;
    height: number;
    committed: boolean;
  }) => {
    if (next.committed) {
      setPreviewW(null);
      setPreviewH(null);
      if (
        onResize &&
        (next.width !== persistedW || next.height !== persistedH)
      ) {
        Promise.resolve(onResize(clip.id, next.width, next.height)).catch(
          (err) => toast.error(getErrorMessage(err, 'Failed to resize clip')),
        );
      }
    } else {
      setPreviewW(next.width);
      setPreviewH(next.height);
    }
  };

  // Card-level click: opens the editor unless the user is clicking on an
  // action button (those .stopPropagation()).
  const handleCardClick = () => {
    if (!clip.is_locked) onClick?.(clip);
    // Locked: ignore — Unlock or Quick View are the only ways in.
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !clip.is_locked) {
      e.preventDefault();
      onClick?.(clip);
    }
  };

  const maxPreviewLength = 1200;
  const previewContent =
    clip.content.slice(0, maxPreviewLength) +
    (clip.content.length > maxPreviewLength ? '\n…' : '');
  const filename = clip.title?.trim() || 'untitled';
  const relativeTime = formatDistanceToNow(new Date(clip.created_at), {
    addSuffix: true,
  });

  const cardLabel = `Clip: ${clip.title || previewContent.substring(0, 50)}${
    clip.content.length > 50 ? '...' : ''
  }`;

  // CSS Grid span inline style — only in non-compact (grid) mode.
  const spanStyle =
    !compact && (effectiveW > 1 || effectiveH > 1)
      ? {
          gridColumn: `span ${effectiveW} / span ${effectiveW}`,
          gridRow: `span ${effectiveH} / span ${effectiveH}`,
        }
      : undefined;

  // ── Compact (list) view — keeps the existing minimal row look ──
  if (compact) {
    return (
      <>
        <div
          data-testid="clip-card"
          className={cn(
            'group relative flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/40',
            onClick && 'cursor-pointer',
            clip.is_pinned && 'border-primary/30 bg-primary/5 dark:bg-primary/10',
          )}
          onClick={handleCardClick}
          onKeyDown={handleKeyDown}
          tabIndex={onClick ? 0 : undefined}
          role={onClick ? 'button' : undefined}
          aria-label={cardLabel}
        >
          <div className="flex-1 min-w-0">
            {clip.title && (
              <p className="font-semibold text-sm truncate">
                {searchQuery
                  ? highlightText(clip.title, searchQuery)
                  : clip.title}
              </p>
            )}
            <p className="text-xs text-muted-foreground truncate font-mono">
              {clip.is_locked
                ? '🔒 Locked'
                : searchQuery
                ? highlightText(previewContent.slice(0, 120), searchQuery)
                : previewContent.slice(0, 120)}
              {clip.content.length > 120 ? '…' : ''}
            </p>
          </div>
          {clip.is_pinned && (
            <Pin className="h-4 w-4 text-primary fill-primary shrink-0" />
          )}
        </div>
        {showQuickView && (
          <Dialog open={showQuickView} onOpenChange={setShowQuickView}>
            <DialogContent className="!w-fit !min-w-[20rem] sm:!min-w-[28rem] !max-w-[calc(100vw-2rem)] sm:!max-w-2xl md:!max-w-3xl lg:!max-w-4xl !max-h-[92vh] sm:!max-h-[88vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>{clip.title || 'Clip Preview'}</DialogTitle>
              </DialogHeader>
              {/* No maxHeight — this already sits inside the dialog's own
                  overflow-auto below, so a single surface scrolls the
                  whole preview instead of nesting two scrollbars (one for
                  this box, one for the dialog) for a long clip. */}
              <div className="flex-1 overflow-auto">
                <ClipContentRenderer
                  title={clip.title}
                  content={clip.content}
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  }

  // ── Locked cover (grid view only — compact still shows 🔒 indicator) ──
  if (clip.is_locked && !isTrashView) {
    return (
      <article
        data-testid="clip-card"
        data-locked="true"
        className={styles.lockedCard}
        style={spanStyle}
        aria-label={`Locked clip: ${filename}`}
      >
        <section className={styles.lockedHero}>
          <header className={styles.lockedHeroHeader}>
            <span>{filename}</span>
            <Lock className={styles.lockedHeroIcon} />
          </header>
          <p className={styles.lockedTitle}>Locked</p>
        </section>
        <footer className={cn(styles.lockedFooter, onResize && styles.lockedFooterClearResize)}>
          <div className={styles.lockedFooterSummary}>
            <div className={styles.lockedFooterIcon} aria-hidden>
              <FileCode2 className="h-4 w-4 text-primary" />
            </div>
            <div className={styles.lockedFooterText}>
              <span>{filename}</span>
              <span>{relativeTime}</span>
            </div>
          </div>
          <button
            type="button"
            className={styles.lockedBtn}
            onClick={handleToggleLock}
            disabled={isWorking}
            title="Unlock clip"
            data-testid="clip-unlock"
          >
            <Unlock className="h-3.5 w-3.5" />
            Unlock
          </button>
        </footer>

        {/* Resize handle still active on a locked card so the user can
            tile their locked clips alongside the rest of the grid. */}
        {onResize && (
          <ClipResizeHandle
            widthSpan={effectiveW}
            heightSpan={effectiveH}
            maxWidth={maxWidth}
            onResize={handleResizeFromHandle}
          />
        )}
      </article>
    );
  }

  // ── Grid (code-editor) view ──
  return (
    <>
      <article
        data-testid="clip-card"
        className={cn(styles.card, 'group', clip.is_pinned && styles.cardPinned)}
        style={spanStyle}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        tabIndex={onClick ? 0 : undefined}
        role={onClick ? 'button' : undefined}
        aria-label={cardLabel}
      >
        {/* Header — traffic-light dots (now interactive: red=delete,
            yellow=pin, green=download) + filename + top-right pin meta.
            Icons live inside each dot and only fade in on card hover,
            so at rest the header looks identical to a static
            code-editor window. */}
        <div className={styles.header}>
          <div className={styles.dots}>
            <button
              type="button"
              className={cn(styles.dot, styles.dotRed)}
              onClick={handleDelete}
              disabled={isWorking}
              aria-label="Delete clip"
              title="Delete"
              data-testid="clip-dot-delete"
            >
              <X className={styles.dotIcon} />
            </button>
            <button
              type="button"
              className={cn(styles.dot, styles.dotYellow)}
              onClick={handleTogglePin}
              disabled={isWorking}
              aria-label={clip.is_pinned ? 'Unpin clip' : 'Pin clip'}
              title={clip.is_pinned ? 'Unpin' : 'Pin'}
              data-testid="clip-dot-pin"
            >
              <Pin
                className={styles.dotIcon}
                fill={clip.is_pinned ? 'currentColor' : 'none'}
              />
            </button>
            <button
              type="button"
              className={cn(styles.dot, styles.dotGreen)}
              onClick={handleDownload}
              disabled={isWorking}
              aria-label="Download clip as file"
              title="Download"
              data-testid="clip-dot-download"
            >
              <Download className={styles.dotIcon} />
            </button>
          </div>
          <div className={styles.title}>
            {searchQuery && clip.title
              ? highlightText(clip.title, searchQuery)
              : filename}
          </div>
          <div className={styles.topRight}>
            {/* Pin only — the relative-time badge moved to the bottom-left
                of the card so it sits below the code area, out of the
                way of the content header. */}
            <div className={styles.pinSlot}>
              {clip.is_pinned && (
                <Pin className="h-3.5 w-3.5 text-primary fill-primary" />
              )}
            </div>
          </div>
        </div>

        {/* Code area — ClipContentRenderer fills the dark inset panel.
            Content itself is gated behind contentInView (see useInView
            above) so cards far below the fold don't pay for markdown/code
            parsing until scrolled near. */}
        <div className={styles.codeArea} ref={contentRef}>
          <div className={styles.codeAreaInner}>
            {contentInView ? (
              <ClipContentRenderer
                title={clip.title}
                content={previewContent}
                maxHeight="100%"
                small
              />
            ) : (
              <div className="h-full w-full min-h-16 animate-pulse rounded bg-muted/40" />
            )}
          </div>
        </div>

        {/* Footer / actions — time + (optional) group on the left,
            action buttons on the right. Time anchors the bottom-left
            corner of the card so it's always at a predictable spot. */}
        <div
          className={cn(
            styles.actions,
            !isTrashView && onResize && styles.actionsClearResize,
          )}
        >
          <div className={styles.actionMeta}>
            <span
              className={styles.timeBadge}
              title={new Date(clip.created_at).toLocaleString()}
            >
              {relativeTime}
            </span>
            {group && (
              <Badge variant="secondary" className="text-[10px] rounded-full">
                {group.name}
              </Badge>
            )}
          </div>

          <div className={styles.actionGroup}>
            {isTrashView ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 sm:h-7 sm:w-7 rounded-full"
                  onClick={handleRestore}
                  title="Restore"
                  disabled={isWorking}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 sm:h-7 sm:w-7 rounded-full text-destructive"
                  onClick={handlePermanentDelete}
                  title="Delete permanently"
                  disabled={isWorking}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              // Delete / Pin / Download moved to the red/yellow/green
              // traffic-light dots in the header. Bottom row keeps the
              // remaining secondary actions (view, lock, copy).
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 sm:h-7 sm:w-7 rounded-full"
                  onClick={handleQuickView}
                  title="Quick view"
                  data-testid="clip-eye"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 sm:h-7 sm:w-7 rounded-full"
                  onClick={handleToggleLock}
                  title={clip.is_locked ? 'Unlock' : 'Lock'}
                  disabled={isWorking}
                  data-testid="clip-lock"
                >
                  <Lock className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 sm:h-7 sm:w-7 rounded-full"
                  onClick={handleCopy}
                  title="Copy"
                  disabled={isWorking}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Resize handle (non-compact, non-trash, wired callback only) */}
        {!isTrashView && onResize && (
          <ClipResizeHandle
            widthSpan={effectiveW}
            heightSpan={effectiveH}
            maxWidth={maxWidth}
            onResize={handleResizeFromHandle}
          />
        )}
      </article>

      {/* Quick View Dialog */}
      <Dialog open={showQuickView} onOpenChange={setShowQuickView}>
        <DialogContent className="!w-fit !min-w-[20rem] sm:!min-w-[28rem] !max-w-[calc(100vw-2rem)] sm:!max-w-2xl md:!max-w-3xl lg:!max-w-4xl !max-h-[92vh] sm:!max-h-[88vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{clip.title || 'Clip Preview'}</DialogTitle>
          </DialogHeader>
          {/* No maxHeight — same reasoning as the compact-view Quick View
              dialog above: this already sits inside its own overflow-auto,
              so one surface scrolls instead of nesting two scrollbars. */}
          <div className="flex-1 overflow-auto">
            <ClipContentRenderer
              title={clip.title}
              content={clip.content}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setShowQuickView(false)}
            >
              Close
            </Button>
            <Button className="rounded-full" onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const ClipCard = memo(ClipCardComponent);
