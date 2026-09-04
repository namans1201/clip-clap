'use client';

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { Group } from '@/types/database';
import { toast } from 'sonner';
import styles from './new-clip-dialog.module.css';

interface NewClipDialogProps {
  groups: Group[];
  onCreateClip: (content: string, title?: string, groupId?: string) => Promise<void>;
  /**
   * Pre-selected group — set by callers that already have a group in
   * context (e.g. the group detail page), so "New clip" from inside a
   * group lands in that group without the user re-picking it from the
   * dropdown below.
   */
  defaultGroupId?: string;
}

/**
 * "Create new clip" modal — uses the visual design supplied by the user.
 *
 * Adapted from the reference:
 *   - Trigger button stays the neumorphic "+" we already had (in styles.plusBtn).
 *   - Groups come from the real `groups` prop, not the reference's hardcoded list.
 *   - Drops the @import url(fonts.googleapis.com/DM+Sans) — CSP doesn't whitelist
 *     fonts.googleapis.com, and the project already ships a sans+mono font stack
 *     (Geist via next/font). We use `font-family: inherit` so the modal picks
 *     them up automatically.
 *   - The header's ⤢ button is wired to the existing fullscreen toggle so we
 *     don't lose the feature the previous dialog had.
 *   - Adds the accessibility bits the reference omits: Escape-to-close, body
 *     scroll lock while open, focus restore on close, busy guard against
 *     double-submit.
 */
export function NewClipDialog({ groups, onCreateClip, defaultGroupId }: NewClipDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [groupId, setGroupId] = useState(defaultGroupId ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Open lifecycle: focus the textarea, lock body scroll, remember the
  // previously focused element so we can restore it on close. The cleanup
  // runs on close OR unmount.
  useEffect(() => {
    if (!open) {
      // Reset form state on close — group resets back to the page's
      // default (if any) rather than always to "No group".
      setTitle('');
      setContent('');
      setGroupId(defaultGroupId ?? '');
      setIsExpanded(false);
      return;
    }
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = setTimeout(() => contentRef.current?.focus(), 60);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open, defaultGroupId]);

  // Escape closes the modal — only when not mid-submit so we don't drop
  // an in-flight create.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isLoading]);

  const handleCreate = async () => {
    if (!content.trim() || isLoading) return;
    setIsLoading(true);
    try {
      await onCreateClip(
        content,
        title.trim() || undefined,
        groupId || undefined,
      );
      toast.success('Clip created!');
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create clip');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContentKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleCreate();
    }
  };

  const handleBackdropClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isLoading) setOpen(false);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setContent(text);
      toast.success('Pasted from clipboard');
    } catch {
      contentRef.current?.focus();
      toast.error('Could not read clipboard');
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.plusBtn}
        onClick={() => setOpen(true)}
        title="Add New"
        aria-label="Add New Clip"
      >
        <svg
          className={styles.plusIcon}
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
        >
          <path d="M8 12H16" strokeWidth="1.8" />
          <path d="M12 16V8" strokeWidth="1.8" />
        </svg>
      </button>

      {open && (
        <>
          <style>{MODAL_CSS}</style>
          <div
            className="ccm-backdrop"
            onClick={handleBackdropClick}
            data-testid="new-clip-modal"
          >
            <div
              className={`ccm-modal${isExpanded ? ' ccm-modal--expanded' : ''}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="ccm-title"
            >
              {/* Header */}
              <div className="ccm-header">
                <span className="ccm-title" id="ccm-title">Create new clip</span>
                <div className="ccm-header-actions">
                  <button
                    type="button"
                    className="ccm-icon-btn"
                    onClick={() => setIsExpanded((v) => !v)}
                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    title={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    {isExpanded ? '⤡' : '⤢'}
                  </button>
                  <button
                    type="button"
                    className="ccm-icon-btn"
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                    title="Close"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="ccm-body">
                {/* Title */}
                <div className="ccm-field">
                  <div className="ccm-label">
                    Title <span className="ccm-label-opt">(optional)</span>
                  </div>
                  <input
                    className="ccm-input"
                    type="text"
                    placeholder="Give your clip a name…"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    autoComplete="off"
                  />
                </div>

                {/* Content */}
                <div className="ccm-field">
                  <div className="ccm-label">
                    Content
                    <div className="ccm-label-right">
                      <span className="ccm-hint">⏎ save · ⇧⏎ newline</span>
                      <button
                        type="button"
                        className="ccm-paste-btn"
                        onClick={handlePaste}
                      >
                        📋 Paste
                      </button>
                    </div>
                  </div>
                  <textarea
                    ref={contentRef}
                    className="ccm-input ccm-textarea"
                    placeholder="Paste or type your content here…"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={handleContentKeyDown}
                  />
                  <div className="ccm-char-count">
                    {content.length} {content.length === 1 ? 'char' : 'chars'}
                  </div>
                </div>

                {/* Group */}
                <div className="ccm-field ccm-field--last">
                  <div className="ccm-label">
                    Group <span className="ccm-label-opt">(optional)</span>
                  </div>
                  <div className="ccm-select-wrap">
                    <select
                      className="ccm-input ccm-select"
                      value={groupId}
                      onChange={(e) => setGroupId(e.target.value)}
                    >
                      <option value="">No group</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    <span className="ccm-select-arrow">▾</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="ccm-footer">
                <button
                  type="button"
                  className="ccm-btn ccm-btn-ghost"
                  onClick={() => setOpen(false)}
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="ccm-btn ccm-btn-primary"
                  disabled={!content.trim() || isLoading}
                  onClick={() => void handleCreate()}
                  data-testid="new-clip-create"
                >
                  {isLoading ? 'Creating…' : 'Create clip'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* CSS lives at module scope so React can dedup the <style> tag and we don't
   re-allocate the string on every render. Reference design preserved
   almost verbatim — only the `@import` of DM Sans was removed (CSP would
   block it and project already ships a font stack via next/font) and a
   `html.dark` block was added so the modal stays legible in dark mode. */
const MODAL_CSS = `
  .ccm-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(10, 10, 12, 0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 9999;
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
  }
  .ccm-modal {
    background: #ffffff;
    color: #0d0d0d;
    border-radius: 20px;
    width: 100%;
    max-width: 440px;
    border: 0.5px solid rgba(0, 0, 0, 0.12);
    overflow: hidden;
    animation: ccm-rise 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    font-family: inherit;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
    display: flex;
    flex-direction: column;
    max-height: 90vh;
  }
  .ccm-modal--expanded {
    max-width: min(95vw, 900px);
  }
  .ccm-modal--expanded .ccm-textarea {
    height: 50vh;
    max-height: 60vh;
  }
  @keyframes ccm-rise {
    from { opacity: 0; transform: translateY(14px) scale(0.97); }
    to   { opacity: 1; transform: none; }
  }
  .ccm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 20px 0;
    flex-shrink: 0;
  }
  .ccm-title {
    font-family: var(--font-sans);
    font-size: 17px;
    font-weight: 500;
    letter-spacing: -0.3px;
    color: inherit;
  }
  .ccm-header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .ccm-icon-btn {
    width: 30px;
    height: 30px;
    border: none;
    background: none;
    cursor: pointer;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #888;
    transition: background 0.12s, color 0.12s;
    font-size: 18px;
    line-height: 1;
    font-family: var(--font-sans);
  }
  .ccm-icon-btn:hover { background: #f3f3f3; color: #0d0d0d; }
  .ccm-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1 1 auto;
    min-height: 0;
  }
  .ccm-field { margin-bottom: 16px; }
  .ccm-field--last { margin-bottom: 0; }
  .ccm-label {
    font-size: 12px;
    font-weight: 500;
    color: #888;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin-bottom: 7px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .ccm-label-opt {
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
    color: #bbb;
  }
  .ccm-label-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .ccm-hint {
    font-size: 11px;
    color: #bbb;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .ccm-paste-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11.5px;
    font-family: var(--font-sans);
    font-weight: 500;
    color: #185FA5;
    border: none;
    background: none;
    cursor: pointer;
    padding: 0;
  }
  .ccm-paste-btn:hover { color: #0c4478; }
  .ccm-input {
    width: 100%;
    padding: 9px 13px;
    font-size: 14px;
    font-family: var(--font-sans);
    border: 1px solid #e0e0e0;
    border-radius: 10px;
    background: #fafafa;
    color: inherit;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    box-sizing: border-box;
  }
  .ccm-input::placeholder { color: #bbb; }
  .ccm-input:focus {
    border-color: #378ADD;
    box-shadow: 0 0 0 3px rgba(55, 138, 221, 0.12);
    background: #fff;
  }
  .ccm-textarea {
    resize: none;
    height: 108px;
    line-height: 1.6;
    font-size: 13.5px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .ccm-char-count {
    font-size: 11px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: #bbb;
    text-align: right;
    margin-top: 5px;
  }
  .ccm-select-wrap { position: relative; }
  .ccm-select-arrow {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: #bbb;
    font-size: 13px;
  }
  .ccm-select {
    appearance: none;
    cursor: pointer;
    padding-right: 32px;
  }
  .ccm-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 4px 20px 20px;
    flex-shrink: 0;
  }
  .ccm-btn {
    height: 34px;
    padding: 0 16px;
    border-radius: 9px;
    font-size: 13.5px;
    font-weight: 500;
    font-family: var(--font-sans);
    cursor: pointer;
    border: none;
    transition: all 0.12s;
    letter-spacing: -0.1px;
  }
  .ccm-btn-ghost {
    background: transparent;
    color: #888;
    border: 1px solid #e0e0e0;
  }
  .ccm-btn-ghost:hover { background: #f3f3f3; color: #0d0d0d; }
  .ccm-btn-primary { background: #185FA5; color: #fff; }
  .ccm-btn-primary:hover { background: #0c4478; }
  .ccm-btn-primary:active { transform: scale(0.97); }
  .ccm-btn-primary:disabled,
  .ccm-btn-ghost:disabled {
    background: #f0f0f0;
    color: #bbb;
    cursor: not-allowed;
    transform: none;
    border-color: transparent;
  }

  /* ── Dark mode ─────────────────────────────────────────────────────
     The reference design is light-only. Recolour using the same navy
     palette the rest of the dashboard uses in dark mode so the modal
     doesn't punch a bright hole through the page. */
  html.dark .ccm-modal {
    background: #1c1a2e;
    color: #e2eaf3;
    border-color: rgba(255, 255, 255, 0.08);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
  }
  html.dark .ccm-icon-btn { color: #9ba0b3; }
  html.dark .ccm-icon-btn:hover { background: rgba(255,255,255,0.06); color: #f0eef6; }
  html.dark .ccm-label,
  html.dark .ccm-label-opt,
  html.dark .ccm-hint,
  html.dark .ccm-char-count,
  html.dark .ccm-select-arrow { color: #8a8fa3; }
  html.dark .ccm-input {
    background: #25243a;
    border-color: rgba(255, 255, 255, 0.08);
    color: #f0eef6;
  }
  html.dark .ccm-input::placeholder { color: #6c708a; }
  html.dark .ccm-input:focus {
    background: #2b2942;
    border-color: #3CA0E6;
    box-shadow: 0 0 0 3px rgba(60, 160, 230, 0.22);
  }
  html.dark .ccm-paste-btn { color: #6fb4ee; }
  html.dark .ccm-paste-btn:hover { color: #a4d2f7; }
  html.dark .ccm-btn-ghost {
    color: #c5c9d8;
    border-color: rgba(255,255,255,0.08);
  }
  html.dark .ccm-btn-ghost:hover {
    background: rgba(255,255,255,0.04);
    color: #f0eef6;
  }
  html.dark .ccm-btn-primary { background: #3CA0E6; color: #0a1018; }
  html.dark .ccm-btn-primary:hover { background: #5cb8f3; }
  html.dark .ccm-btn-primary:disabled,
  html.dark .ccm-btn-ghost:disabled {
    background: rgba(255,255,255,0.04);
    color: #6c708a;
    border-color: transparent;
  }
`;
