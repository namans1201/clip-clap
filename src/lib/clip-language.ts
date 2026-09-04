/**
 * clip-language — derive rendering hints (kind, Prism language id, MIME)
 * from a clip's `title`. The title acts as the filename when it ends in
 * a recognised extension; otherwise the clip is treated as plain text.
 *
 * Kept dependency-free so it can be imported from both client and server
 * components. Languages registered here must match what code-block.tsx
 * registers with react-syntax-highlighter — if you add a new language
 * keep the two in sync.
 */

export type ClipKind = 'code' | 'markdown' | 'mermaid' | 'text';

/**
 * Return the lowercased extension (without leading dot) of `title`, or
 * null if there's no extension or the title is empty. Treats a title
 * like ".env" as no-extension (a leading-dot file with no further dots
 * is by convention a config file, but we don't have a renderer for it,
 * so falling through to text is fine).
 */
export function getExtension(title: string | null | undefined): string | null {
  if (!title) return null;
  const trimmed = title.trim();
  if (!trimmed) return null;
  const lastDot = trimmed.lastIndexOf('.');
  // No dot, or dot is the first character (e.g. ".env"), or trailing dot.
  if (lastDot <= 0 || lastDot === trimmed.length - 1) return null;
  return trimmed.slice(lastDot + 1).toLowerCase();
}

/**
 * Map of file extensions to Prism language identifiers (as registered in
 * code-block.tsx). The keys here ARE the set of "this is code" extensions
 * — anything not in the map falls through to text/markdown/mermaid checks.
 */
const EXT_TO_PRISM: Record<string, string> = {
  py: 'python',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  json: 'json',
  css: 'css',
  scss: 'scss',
  html: 'markup',
  xml: 'markup',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  sql: 'sql',
  go: 'go',
  rs: 'rust',
  yml: 'yaml',
  yaml: 'yaml',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  rb: 'ruby',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  // .properties / .ini / .conf / .env — all the same "KEY=value per line"
  // shape, all handled by Prism's "properties" grammar.
  properties: 'properties',
  ini: 'properties',
  conf: 'properties',
  cfg: 'properties',
};

/**
 * Dotfiles (title has no name before the leading dot, e.g. ".env",
 * ".env.local") don't have an "extension" by getExtension()'s normal
 * last-dot rule — by convention the whole name after the dot IS the type.
 * ".env" and its common variants (".env.local", ".env.production", ...)
 * are common enough in pasted clips to special-case directly.
 */
const DOTFILE_TO_PRISM: Record<string, string> = {
  env: 'properties',
};

function dotfileLanguage(title: string | null | undefined): string | null {
  if (!title) return null;
  const trimmed = title.trim().toLowerCase();
  const match = /^\.([a-z]+)(?:\.\w+)?$/.exec(trimmed);
  if (!match) return null;
  return DOTFILE_TO_PRISM[match[1]] ?? null;
}

const MARKDOWN_EXTS = new Set(['md', 'markdown', 'mdown', 'mkd']);
const MERMAID_EXTS = new Set(['mmd', 'mermaid']);

/**
 * Strong, unambiguous markers that say "this body is markdown" even when
 * the title gives no hint (e.g. a clip pasted from a chat). Kept narrow
 * so plain prose doesn't get reformatted by mistake:
 *  - GFM table separator row (`| --- | --- |`), only meaningful in tables
 *  - fenced code block (```)
 *  - ATX heading (`# …`) — false-positive risk is bounded by the
 *    title-based path already catching `.py` etc. as code
 */
const GFM_TABLE_SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/m;
const FENCED_CODE_BLOCK = /^\s*```/m;
const ATX_HEADING = /^#{1,6}\s+\S/m;

export function looksLikeMarkdown(content: string | null | undefined): boolean {
  if (!content) return false;
  return (
    GFM_TABLE_SEPARATOR.test(content) ||
    FENCED_CODE_BLOCK.test(content) ||
    ATX_HEADING.test(content)
  );
}

/**
 * Mermaid source is unmistakable — every diagram type starts with one of a
 * small fixed set of keywords on its own line. Checked before the markdown
 * sniff so a title-less ```-free mermaid paste (no code fence, just raw
 * `graph TD` ... syntax) still renders as a diagram instead of falling
 * through to plain text or a markdown-heading false-read.
 */
const MERMAID_KEYWORDS =
  /^\s*(graph\s+(TD|TB|BT|RL|LR)\b|flowchart\s+(TD|TB|BT|RL|LR)\b|sequenceDiagram\b|classDiagram\b|stateDiagram(-v2)?\b|erDiagram\b|gantt\b|pie\b(\s+title)?|journey\b|gitGraph\b|mindmap\b|timeline\b|quadrantChart\b|requirementDiagram\b|C4Context\b)/m;

export function looksLikeMermaid(content: string | null | undefined): boolean {
  if (!content) return false;
  return MERMAID_KEYWORDS.test(content);
}

/**
 * ── Content-only language detection ─────────────────────────────────────
 * Last resort for a clip with no title/extension and no markdown markers:
 * guess a Prism language purely from the pasted text. Deliberately
 * conservative — every probe requires multiple distinctive signals (or one
 * genuinely unambiguous one, e.g. a `#!/bin/bash` shebang or a `<?php`
 * tag), and detection stays silent (returns null) rather than confidently
 * highlighting the wrong language. A wrong guess looks worse than a plain
 * `<pre>`, so ties and near-ties are treated as "not sure" and dropped.
 *
 * Not attempted for very short content (too little signal either way) or
 * for language pairs that are inherently ambiguous without a filename
 * (JSX vs plain JS, SCSS vs CSS) — those extensions still work fine when
 * the user actually names the clip; this only covers the common,
 * distinctly-shaped languages worth guessing at all.
 */
const MIN_CONTENT_LENGTH_FOR_DETECTION = 20;
const DETECTION_MIN_SCORE = 3;
const DETECTION_MIN_MARGIN = 2;
const DETECTION_STRONG_SCORE = 5;

interface LanguageProbe {
  lang: string;
  patterns: readonly { re: RegExp; weight: number }[];
}

const LANGUAGE_PROBES: readonly LanguageProbe[] = [
  {
    lang: 'python',
    patterns: [
      { re: /^#!.*\bpython3?\b/m, weight: 5 },
      { re: /^\s*if\s+__name__\s*==\s*['"]__main__['"]\s*:/m, weight: 5 },
      { re: /^\s*def\s+\w+\s*\([^)]*\)\s*:\s*$/m, weight: 3 },
      { re: /^\s*elif\s+.+:\s*$/m, weight: 2 },
      { re: /^\s*(from\s+[\w.]+\s+)?import\s+[\w., ]+$/m, weight: 2 },
      { re: /^\s*print\(.*\)\s*$/m, weight: 1 },
    ],
  },
  {
    lang: 'bash',
    patterns: [
      { re: /^#!\s*\/(usr\/)?bin\/(env\s+)?(bash|sh|zsh)\b/m, weight: 5 },
      { re: /^\s*(if|elif)\s*\[\s.+\s\]\s*;\s*then\s*$/m, weight: 3 },
      { re: /^\s*fi\s*$/m, weight: 2 },
      { re: /^\s*(export|source)\s+\w+/m, weight: 2 },
      { re: /^\s*echo\s+\S/m, weight: 1 },
      { re: /\$\{?[A-Za-z_][\w]*\}?/, weight: 1 },
    ],
  },
  {
    lang: 'javascript',
    patterns: [
      { re: /^\s*(const|let|var)\s+\w+\s*=/m, weight: 1 },
      { re: /=>\s*\{?/, weight: 1 },
      { re: /\bconsole\.log\(/, weight: 2 },
      { re: /\bmodule\.exports\b/, weight: 3 },
      { re: /^\s*function\s+\w+\s*\(/m, weight: 2 },
      { re: /\brequire\(['"][\w./-]+['"]\)/, weight: 2 },
    ],
  },
  {
    lang: 'typescript',
    patterns: [
      { re: /^\s*interface\s+\w+\s*\{/m, weight: 4 },
      { re: /^\s*(export\s+)?type\s+\w+\s*=/m, weight: 3 },
      { re: /:\s*(string|number|boolean|void|any|unknown)\b(\[\])?\s*[,;)=]/, weight: 3 },
      { re: /\bas\s+(const|unknown|string|number)\b/, weight: 2 },
    ],
  },
  {
    lang: 'css',
    patterns: [
      { re: /^\s*@media\s*[\w\s():-]+\{/m, weight: 3 },
      { re: /[.#]?[\w-]+\s*\{[^{}]*:[^{};]+;[^{}]*\}/, weight: 3 },
      { re: /!important\b/, weight: 2 },
      { re: /^\s*:root\s*\{/m, weight: 3 },
    ],
  },
  {
    lang: 'sql',
    patterns: [
      { re: /\bSELECT\b[\s\S]+?\bFROM\b/i, weight: 4 },
      { re: /\bINSERT\s+INTO\b/i, weight: 4 },
      { re: /\bCREATE\s+TABLE\b/i, weight: 4 },
      { re: /\bUPDATE\b[\s\S]+?\bSET\b/i, weight: 3 },
      { re: /\bWHERE\b/i, weight: 1 },
    ],
  },
  {
    lang: 'go',
    patterns: [
      { re: /^\s*package\s+main\s*$/m, weight: 4 },
      { re: /^\s*func\s+main\s*\(\s*\)\s*\{/m, weight: 4 },
      { re: /^\s*import\s*\(/m, weight: 2 },
      { re: /\bfmt\.\w+\(/, weight: 2 },
      { re: /:=/, weight: 1 },
    ],
  },
  {
    lang: 'rust',
    patterns: [
      { re: /\bprintln!\(/, weight: 5 },
      { re: /^\s*fn\s+main\s*\(\s*\)\s*\{/m, weight: 4 },
      { re: /^\s*let\s+mut\s+\w+/m, weight: 3 },
      { re: /^\s*use\s+std::/m, weight: 3 },
      { re: /^\s*impl\s+\w+/m, weight: 2 },
    ],
  },
  {
    lang: 'java',
    patterns: [
      { re: /\bpublic\s+static\s+void\s+main\s*\(\s*String/, weight: 5 },
      { re: /\bSystem\.out\.println\(/, weight: 4 },
      { re: /^\s*public\s+class\s+\w+/m, weight: 2 },
      { re: /^\s*(private|protected)\s+\w+\s+\w+;/m, weight: 1 },
    ],
  },
  {
    lang: 'cpp',
    patterns: [
      { re: /#include\s*<iostream>/, weight: 4 },
      { re: /\bstd::/, weight: 3 },
      { re: /\bcout\s*<</, weight: 4 },
      { re: /\bint\s+main\s*\(/, weight: 1 },
    ],
  },
  {
    lang: 'c',
    patterns: [
      { re: /#include\s*<stdio\.h>/, weight: 4 },
      { re: /\bprintf\(/, weight: 2 },
      { re: /\bint\s+main\s*\(/, weight: 2 },
      { re: /^\s*#include\s*<\w+\.h>/m, weight: 1 },
    ],
  },
  {
    lang: 'csharp',
    patterns: [
      { re: /^\s*using\s+System\s*;/m, weight: 4 },
      { re: /\bConsole\.WriteLine\(/, weight: 4 },
      { re: /^\s*namespace\s+\w+/m, weight: 2 },
      { re: /^\s*public\s+class\s+\w+/m, weight: 1 },
    ],
  },
  {
    lang: 'ruby',
    patterns: [
      { re: /^\s*puts\s+\S/m, weight: 2 },
      { re: /^\s*def\s+\w+[^:]*$/m, weight: 2 },
      { re: /^\s*require\s+['"][\w./-]+['"]/m, weight: 2 },
      { re: /^\s*end\s*$/m, weight: 1 },
      { re: /^\s*class\s+\w+\s*$/m, weight: 1 },
    ],
  },
  {
    lang: 'php',
    patterns: [
      { re: /<\?php/, weight: 6 },
      { re: /\$\w+\s*=/, weight: 1 },
      { re: /^\s*echo\s+\S/m, weight: 1 },
    ],
  },
  {
    lang: 'swift',
    patterns: [
      { re: /^\s*import\s+(Foundation|UIKit|SwiftUI)\b/m, weight: 4 },
      { re: /^\s*func\s+\w+\([^)]*\)\s*->/m, weight: 3 },
      { re: /^\s*var\s+\w+\s*:\s*\w+/m, weight: 1 },
      { re: /^\s*let\s+\w+\s*=/m, weight: 1 },
    ],
  },
  {
    lang: 'kotlin',
    patterns: [
      { re: /^\s*fun\s+main\s*\(\s*\)\s*\{/m, weight: 4 },
      { re: /^\s*val\s+\w+\s*=/m, weight: 2 },
      { re: /\bprintln\(/, weight: 2 },
    ],
  },
  {
    lang: 'yaml',
    patterns: [
      { re: /^---\s*$/m, weight: 3 },
      { re: /^\s*[\w-]+:\s*(\||>)\s*$/m, weight: 2 },
      { re: /(^\s*[\w-]+:\s?.*$\n){3,}/m, weight: 3 },
      { re: /^\s*-\s+\w+/m, weight: 1 },
    ],
  },
  {
    lang: 'markup',
    patterns: [
      { re: /^\s*<!DOCTYPE\s+html>/i, weight: 6 },
      { re: /<\?xml\s/i, weight: 5 },
      { re: /^\s*<html[\s>]/im, weight: 3 },
      { re: /<\/\w+>/, weight: 1 },
    ],
  },
  {
    // .env / .properties / .ini-style config: bare KEY=value lines, no
    // declaration keyword and no `$` sigil (that's what tells this apart
    // from a shell script's variable assignments or PHP's `$var = ...`).
    lang: 'properties',
    patterns: [
      { re: /(^[A-Za-z_][A-Za-z0-9_]*=.*$\n){3,}/m, weight: 4 },
      { re: /^[A-Za-z_][A-Za-z0-9_]*=\S+$/m, weight: 1 },
    ],
  },
];

function detectLanguageFromContent(content: string | null | undefined): string | null {
  if (!content) return null;
  const trimmed = content.trim();
  if (trimmed.length < MIN_CONTENT_LENGTH_FOR_DETECTION) return null;

  // JSON is checked separately and deterministically (a real parse, not a
  // heuristic) — only attempted when the shape already looks like an
  // object/array, so a bare number or quoted string doesn't get parsed
  // and misclassified as "a JSON clip".
  if (/^[[{]/.test(trimmed) && /[\]}]$/.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not valid JSON — fall through to the heuristic probes below.
    }
  }

  let best: { lang: string; score: number } | null = null;
  let runnerUpScore = 0;

  for (const probe of LANGUAGE_PROBES) {
    let score = 0;
    for (const { re, weight } of probe.patterns) {
      if (re.test(content)) score += weight;
    }
    if (score > (best?.score ?? 0)) {
      runnerUpScore = best?.score ?? 0;
      best = { lang: probe.lang, score };
    } else if (score > runnerUpScore) {
      runnerUpScore = score;
    }
  }

  if (!best) return null;
  // A single unambiguous marker (shebang, <?php, println!, DOCTYPE, ...)
  // is trusted on its own regardless of noise elsewhere. Anything less
  // needs both a solid score and a clear lead over the runner-up —
  // otherwise we're genuinely unsure, and unsure means plain text.
  if (best.score >= DETECTION_STRONG_SCORE) return best.lang;
  if (best.score >= DETECTION_MIN_SCORE && best.score - runnerUpScore >= DETECTION_MIN_MARGIN) {
    return best.lang;
  }
  return null;
}

/**
 * Decide which renderer should handle a clip. Returns:
 *  - 'mermaid'  → flow/sequence/etc. diagram (rendered as SVG)
 *  - 'markdown' → headings/lists/etc. (fenced code blocks get highlighted)
 *  - 'code'     → syntax-highlighted via Prism
 *  - 'text'     → raw `<pre>` (the existing behaviour, also the fallback)
 *
 * Priority when the title alone doesn't classify the clip: an unmistakable
 * mermaid keyword (`graph TD`, `sequenceDiagram`, ...) beats everything
 * else since those are effectively never valid prose/code by coincidence;
 * then the markdown marker sniff (catches title-less pasted tables); then
 * the conservative content-only language guess (see
 * detectLanguageFromContent) for a title-less code/config paste.
 */
export function inferKind(
  title: string | null | undefined,
  content?: string | null,
): ClipKind {
  const ext = getExtension(title);
  if (ext) {
    if (MERMAID_EXTS.has(ext)) return 'mermaid';
    if (MARKDOWN_EXTS.has(ext)) return 'markdown';
    if (ext in EXT_TO_PRISM) return 'code';
  }
  if (dotfileLanguage(title)) return 'code';
  if (looksLikeMermaid(content)) return 'mermaid';
  if (looksLikeMarkdown(content)) return 'markdown';
  if (detectLanguageFromContent(content)) return 'code';
  return 'text';
}

/**
 * Return the Prism language id for a clip, or null if nothing could be
 * determined. Extension (or a recognised dotfile like ".env") wins when
 * present; otherwise, if `content` is supplied, falls back to the same
 * content-only guess inferKind() uses (so a clip classified as 'code' via
 * content-sniffing actually gets highlighted, instead of landing on
 * Prism's unstyled 'text' mode). Caller is expected to fall back to plain
 * `<pre>` rendering for null.
 */
export function inferLanguage(
  title: string | null | undefined,
  content?: string | null,
): string | null {
  const ext = getExtension(title);
  if (ext && ext in EXT_TO_PRISM) return EXT_TO_PRISM[ext];
  const dotfile = dotfileLanguage(title);
  if (dotfile) return dotfile;
  return detectLanguageFromContent(content);
}

/**
 * MIME-type lookup for the download helper. Falls back to text/plain
 * for any unknown extension (browsers and OSes still associate by
 * filename extension in that case, so the download still works).
 */
const MIME_BY_EXT: Record<string, string> = {
  py: 'text/x-python',
  js: 'text/javascript',
  mjs: 'text/javascript',
  cjs: 'text/javascript',
  jsx: 'text/jsx',
  ts: 'text/typescript',
  tsx: 'text/tsx',
  json: 'application/json',
  css: 'text/css',
  scss: 'text/x-scss',
  html: 'text/html',
  xml: 'application/xml',
  md: 'text/markdown',
  markdown: 'text/markdown',
  mmd: 'text/plain',
  mermaid: 'text/plain',
  sh: 'application/x-sh',
  bash: 'application/x-sh',
  zsh: 'application/x-sh',
  sql: 'application/sql',
  go: 'text/x-go',
  rs: 'text/rust',
  yml: 'application/x-yaml',
  yaml: 'application/x-yaml',
  java: 'text/x-java',
  c: 'text/x-c',
  h: 'text/x-c',
  cpp: 'text/x-c++',
  hpp: 'text/x-c++',
  cs: 'text/x-csharp',
  rb: 'application/x-ruby',
  php: 'application/x-httpd-php',
  swift: 'text/x-swift',
  kt: 'text/x-kotlin',
  properties: 'text/x-java-properties',
  ini: 'text/plain',
  conf: 'text/plain',
  cfg: 'text/plain',
  txt: 'text/plain',
};

export function mimeFor(extOrTitle: string | null | undefined): string {
  if (!extOrTitle) return 'text/plain';
  // Accept either a bare ext ("py") or a filename ("main.py"). Normalising
  // means callers don't have to remember which they have.
  const ext =
    extOrTitle.includes('.') ? getExtension(extOrTitle) : extOrTitle.toLowerCase();
  if (!ext) return 'text/plain';
  return MIME_BY_EXT[ext] ?? 'text/plain';
}
