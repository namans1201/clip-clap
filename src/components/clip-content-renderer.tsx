'use client';

/**
 * ClipContentRenderer — single entry point that dispatches a clip's
 * content to the right renderer based on its filename (title).
 *
 *   inferKind(title) → 'mermaid'  → MermaidDiagram
 *                    → 'markdown' → MarkdownView
 *                    → 'code'     → CodeBlock
 *                    → 'text'     → raw <pre> (existing behaviour)
 *
 * Used by ClipCard's non-compact preview AND ClipEditor's view mode. The
 * `maxHeight` prop controls the wrapping scroll container — the card
 * passes "9rem" (was `max-h-36`), the editor passes "400px"
 * (was `max-h-[400px]`).
 */

import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { inferKind, inferLanguage } from '@/lib/clip-language';
import { MermaidDiagram } from './clip-renderers/mermaid-diagram';

// CodeBlock and MarkdownView are lazy-loaded: CodeBlock alone pulls in
// react-syntax-highlighter plus 21 registered Prism language grammars,
// and MarkdownView pulls in react-markdown + remark-gfm (and CodeBlock,
// for fenced code inside markdown). ClipContentRenderer runs once per
// card in the grid, so importing these eagerly put that whole dependency
// chain in the dashboard's initial bundle for every clip, even a
// plain-text-only collection. Mermaid already avoided this (it lazy-loads
// its own library internally); these two now follow the same pattern.
const CodeBlock = dynamic(() =>
  import('./clip-renderers/code-block').then((m) => m.CodeBlock),
);
const MarkdownView = dynamic(() =>
  import('./clip-renderers/markdown-view').then((m) => m.MarkdownView),
);

interface ClipContentRendererProps {
  title: string | null | undefined;
  content: string;
  /**
   * CSS max-height for the scrollable wrapper. Anything tailwind-y
   * (`9rem`, `400px`, `60vh`). Defaults to no constraint.
   */
  maxHeight?: string;
  className?: string;
  /**
   * Smaller type size for the compact ClipGrid card preview. Quick View /
   * ClipEditor (full reading views) omit this and keep the larger default.
   */
  small?: boolean;
}

export function ClipContentRenderer({
  title,
  content,
  maxHeight,
  className,
  small,
}: ClipContentRendererProps) {
  const kind = inferKind(title, content);

  // `h-full` matters here: without it this wrapper is a plain block that's
  // only as tall as its own content, so a short clip left a band of the
  // parent's own background showing below the text — a visibly different
  // shade from this wrapper's tint (most obvious in ClipCard's fixed-height
  // grid cells). Stretching to fill the parent keeps the tint consistent
  // across the whole card regardless of content length. Harmless where the
  // parent has no definite height (e.g. the Quick View dialog) — a
  // percentage height simply has no effect there.
  const wrapperClass = cn(
    'bg-muted/50 rounded p-0 overflow-auto h-full min-h-full',
    className,
  );
  const wrapperStyle = maxHeight ? { maxHeight } : undefined;

  if (kind === 'mermaid') {
    return (
      <div className={wrapperClass} style={wrapperStyle}>
        <MermaidDiagram code={content} className="p-3" />
      </div>
    );
  }

  if (kind === 'markdown') {
    return (
      <div className={wrapperClass} style={wrapperStyle}>
        <MarkdownView content={content} small={small} />
      </div>
    );
  }

  if (kind === 'code') {
    return (
      <div className={wrapperClass} style={wrapperStyle}>
        <CodeBlock code={content} language={inferLanguage(title, content)} small={small} />
      </div>
    );
  }

  // Plain text — keep the exact look from the previous implementation
  // (monospace, pre-wrap) so titleless clips look unchanged.
  return (
    <pre
      className={cn(
        small
          ? 'whitespace-pre-wrap break-words text-xs font-mono p-3 bg-muted/50 rounded overflow-auto h-full min-h-full'
          : 'whitespace-pre-wrap break-words text-sm font-mono p-3 bg-muted/50 rounded overflow-auto h-full min-h-full',
        className,
      )}
      style={wrapperStyle}
    >
      {content}
    </pre>
  );
}
