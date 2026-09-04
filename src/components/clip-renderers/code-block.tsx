'use client';

/**
 * CodeBlock — Prism-based syntax-highlighted code rendering.
 *
 * Uses react-syntax-highlighter's PrismLight build (smaller bundle than
 * the default; we register only the languages our clip-language helper
 * maps to). Theme is keyed off next-themes so highlight colours flip
 * between oneLight and oneDark with the app's dark-mode toggle.
 *
 * Languages registered here must stay in sync with EXT_TO_PRISM in
 * src/lib/clip-language.ts — if you add a new extension there, register
 * the matching Prism language module here too.
 */

import { useTheme } from 'next-themes';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  oneLight,
  oneDark,
} from 'react-syntax-highlighter/dist/esm/styles/prism';

// Language modules — keep this list in lock-step with EXT_TO_PRISM
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import scss from 'react-syntax-highlighter/dist/esm/languages/prism/scss';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp';
import ruby from 'react-syntax-highlighter/dist/esm/languages/prism/ruby';
import php from 'react-syntax-highlighter/dist/esm/languages/prism/php';
import swift from 'react-syntax-highlighter/dist/esm/languages/prism/swift';
import kotlin from 'react-syntax-highlighter/dist/esm/languages/prism/kotlin';
import properties from 'react-syntax-highlighter/dist/esm/languages/prism/properties';

SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('scss', scss);
SyntaxHighlighter.registerLanguage('markup', markup);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('go', go);
SyntaxHighlighter.registerLanguage('rust', rust);
SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('c', c);
SyntaxHighlighter.registerLanguage('cpp', cpp);
SyntaxHighlighter.registerLanguage('csharp', csharp);
SyntaxHighlighter.registerLanguage('ruby', ruby);
SyntaxHighlighter.registerLanguage('php', php);
SyntaxHighlighter.registerLanguage('swift', swift);
SyntaxHighlighter.registerLanguage('kotlin', kotlin);
SyntaxHighlighter.registerLanguage('properties', properties);

interface CodeBlockProps {
  /** Plain source code to render. */
  code: string;
  /**
   * Prism language id (e.g., "python"). When unset or unknown, Prism
   * falls back to its `text` rendering — still readable, just unstyled.
   */
  language?: string | null;
  /**
   * Optional className to merge with the highlighter's pre wrapper.
   * Used by callers to control max-height / overflow.
   */
  className?: string;
  /**
   * Smaller type size for the ClipGrid card preview, where the code area
   * is a compact fixed-height box rather than a full reading view (Quick
   * View dialog / ClipEditor keep the default, larger size).
   */
  small?: boolean;
}

/**
 * Strip the `background` / `backgroundColor` property from every entry in
 * a Prism style object. Some tokens in `oneLight` / `oneDark` carry their
 * own background (e.g. atrule / attr-value / regex) which renders as
 * visible per-token highlight rectangles. We only want the foreground
 * colour for syntax — the card already provides the background. Cached
 * so we don't rebuild on every render.
 */
type PrismStyle = Record<string, React.CSSProperties>;
const stripBackgrounds = (() => {
  const cache = new WeakMap<PrismStyle, PrismStyle>();
  return (theme: PrismStyle): PrismStyle => {
    const cached = cache.get(theme);
    if (cached) return cached;
    const out: PrismStyle = {};
    for (const [selector, css] of Object.entries(theme)) {
      if (css && typeof css === 'object') {
        // Copy every key except background / backgroundColor — those are
        // the per-token highlight rectangles we don't want.
        const rest: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(css)) {
          if (k === 'background' || k === 'backgroundColor') continue;
          rest[k] = v;
        }
        out[selector] = rest as React.CSSProperties;
      } else {
        out[selector] = css;
      }
    }
    cache.set(theme, out);
    return out;
  };
})();

export function CodeBlock({ code, language, className, small }: CodeBlockProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const style = stripBackgrounds((isDark ? oneDark : oneLight) as PrismStyle);

  return (
    <SyntaxHighlighter
      language={language ?? 'text'}
      style={style}
      // We control max-height + overflow from the parent, so don't let
      // the highlighter set its own padding/margin defaults that would
      // double up against the card.
      customStyle={{
        margin: 0,
        padding: '0.75rem',
        background: 'transparent',
        fontSize: small ? '0.6875rem' : '0.8125rem',
        lineHeight: small ? 1.35 : 1.45,
        borderRadius: 0,
        // minHeight (not height — this must never clip content taller
        // than the card) stretches short snippets to fill the card's
        // fixed-height grid cell. Without it, the highlighter's own <pre>
        // was only as tall as its few lines of text, so a long single
        // line's horizontal scrollbar sat right under the text with a
        // dead gap of background below it instead of at the card's
        // actual bottom edge.
        minHeight: '100%',
      }}
      // Inline code element gets transparent backgrounds too — covers
      // any per-token spans the theme might have given a background.
      codeTagProps={{ style: { background: 'transparent' } }}
      // PreTag/CodeTag get the className so the parent's max-h-* /
      // overflow-auto / rounded utilities apply cleanly.
      PreTag={(props) => <pre {...props} className={className} />}
      wrapLongLines={false}
    >
      {code}
    </SyntaxHighlighter>
  );
}
