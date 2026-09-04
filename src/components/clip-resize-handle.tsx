'use client';

/**
 * ClipResizeHandle — bottom-right corner grip that lets the user resize
 * a clip card by dragging. The handle reports new (width_span, height_span)
 * values as the drag progresses; the parent applies them as CSS Grid
 * spans, so neighbouring cards reflow automatically via grid-auto-flow:dense.
 *
 * Snap-to-grid model (per the plan): each clip occupies 1-3 column units
 * and 1-3 row units. The handle measures the host card's current cell
 * size on drag start, then snaps based on the cumulative pointer delta
 * relative to that cell size.
 *
 * Persistence is the parent's job — we call onResize() continuously during
 * drag (so the visual preview tracks the pointer) AND once on release with
 * `committed: true` so the parent can persist to the DB only once.
 */

import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@/lib/utils';

interface ClipResizeHandleProps {
  /** Current width span (1-3). */
  widthSpan: number;
  /** Current height span (1-3). */
  heightSpan: number;
  /** Maximum width span allowed at this breakpoint (e.g., 2 on `sm`). */
  maxWidth: number;
  /**
   * Called with the next spans during drag (live preview) and once with
   * `committed: true` on release (the parent persists then).
   */
  onResize: (next: { width: number; height: number; committed: boolean }) => void;
  className?: string;
}

const MIN_SPAN = 1;
const MAX_HEIGHT = 3;

export function ClipResizeHandle({
  widthSpan,
  heightSpan,
  maxWidth,
  onResize,
  className,
}: ClipResizeHandleProps) {
  // Captured at pointerdown so we have stable reference points throughout
  // the drag — without these, mid-drag re-renders would reset the math.
  const dragStart = useRef<{
    pointerX: number;
    pointerY: number;
    initialW: number;
    initialH: number;
    cellW: number;
    cellH: number;
    latestW: number;
    latestH: number;
  } | null>(null);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Cell size = current card size / current span. Gives us the per-unit
    // pixel distance the user needs to drag to reach the next snap point.
    // The card element is the resize handle's parent (we walk up to .group,
    // which is the Card wrapper).
    const card = e.currentTarget.closest('[data-testid="clip-card"]') as HTMLElement | null;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const cellW = rect.width / Math.max(1, widthSpan);
    const cellH = rect.height / Math.max(1, heightSpan);

    dragStart.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      initialW: widthSpan,
      initialH: heightSpan,
      cellW,
      cellH,
      latestW: widthSpan,
      latestH: heightSpan,
    };

    // Capture so subsequent pointermove/up land on this element even when
    // the pointer leaves the handle's bounding box.
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start) return;
    e.preventDefault();

    // Drag delta in pixels → fraction of cells → rounded span.
    const dx = e.clientX - start.pointerX;
    const dy = e.clientY - start.pointerY;

    // Round-half-up at the cell boundary feels right (snap as soon as the
    // pointer crosses the midpoint of the next cell).
    const nextW = clamp(
      start.initialW + Math.round(dx / Math.max(1, start.cellW)),
      MIN_SPAN,
      Math.max(MIN_SPAN, maxWidth),
    );
    const nextH = clamp(
      start.initialH + Math.round(dy / Math.max(1, start.cellH)),
      MIN_SPAN,
      MAX_HEIGHT,
    );

    if (nextW !== start.latestW || nextH !== start.latestH) {
      start.latestW = nextW;
      start.latestH = nextH;
      onResize({ width: nextW, height: nextH, committed: false });
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start) return;
    e.preventDefault();
    e.stopPropagation();

    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);

    // Always fire the committed callback — even if dimensions are unchanged,
    // the parent can decide whether to persist.
    onResize({ width: start.latestW, height: start.latestH, committed: true });
    dragStart.current = null;
  };

  return (
    <div
      data-testid="clip-resize-handle"
      className={cn(
        // Bottom-right corner, tucked tight against the true corner pixel
        // (not bottom-1/right-1) and sized down from the original 22px —
        // the action-button row reserves clearance for exactly this
        // footprint (see .actionsClearResize / .lockedFooterClearResize
        // in clip-card.module.css) so the handle's hit area no longer
        // sits on top of the rightmost action button (was intercepting
        // clicks meant for Copy/Unlock). Visible at low opacity always
        // (so users discover the affordance), full opacity on
        // hover/focus-within. Stop click bubbling so the grab doesn't
        // trigger the card's onClick (open editor). Hidden on touch
        // devices — drag-resize is impractical with a finger, and the
        // handle's tiny target would just frustrate users (mistaps would
        // open the editor).
        'absolute bottom-0.5 right-0.5 z-20',
        'h-[16px] w-[16px] cursor-nwse-resize',
        'opacity-50 group-hover:opacity-100 group-focus-within:opacity-100',
        'transition-opacity touch-none select-none',
        'flex items-end justify-end',
        '[@media(hover:none)_and_(pointer:coarse)]:hidden',
        className,
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={(e) => e.stopPropagation()}
      role="slider"
      aria-label="Resize clip"
      aria-valuemin={MIN_SPAN}
      aria-valuemax={maxWidth}
      aria-valuenow={widthSpan}
      title="Drag to resize"
    >
      {/* Three diagonal lines forming a corner-grip triangle — the
          conventional resize affordance from desktop windowing systems.
          Bigger + brighter than the previous 16px slashes so users can
          actually see and grab it. */}
      <svg
        viewBox="0 0 22 22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        className="h-[13px] w-[13px] text-muted-foreground group-hover:text-foreground"
      >
        <line x1="20" y1="6"  x2="6"  y2="20" />
        <line x1="20" y1="11" x2="11" y2="20" />
        <line x1="20" y1="16" x2="16" y2="20" />
      </svg>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
