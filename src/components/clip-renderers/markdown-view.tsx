'use client';

/**
 * MarkdownView — render markdown source with GitHub-flavoured extras
 * (tables, strikethrough, task lists). Fenced code blocks get routed
 * through our CodeBlock for syntax highlighting; the special
 * ```mermaid block renders as a live diagram via MermaidDiagram.
 *
 * Typography uses Tailwind's typography utility class names sparingly —
 * we don't ship @tailwindcss/typography, so each element gets a small
 * targeted class set instead. Keeps the bundle lean and avoids fighting
 * the existing card styling.
 */

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './code-block';
import { MermaidDiagram } from './mermaid-diagram';

interface MarkdownViewProps {
  content: string;
  className?: string;
  /** See CodeBlock's `small` — same "compact card preview" sizing. */
  small?: boolean;
}

// A function rather than a static object so the `code` handler can close
// over `small` and pass it down to the nested CodeBlock.
const createComponents = (small?: boolean): Components => ({
  // Fenced code blocks — react-markdown gives us `className="language-xyz"`.
  // Inline code (`like this`) comes through without a language; render
  // a simple monospace span for those.
  code({ className, children, ...rest }) {
    const match = /language-(\w+)/.exec(className ?? '');
    const lang = match?.[1];
    const text = String(children).replace(/\n$/, '');
    const isInline = !lang;

    if (isInline) {
      return (
        <code
          className="rounded bg-muted px-1 py-0.5 text-[0.85em] font-mono"
          {...rest}
        >
          {children}
        </code>
      );
    }

    // Special-case ```mermaid → live diagram, not source highlighting.
    if (lang === 'mermaid') {
      return <MermaidDiagram code={text} className="my-3" />;
    }

    return (
      <div className="my-3 rounded-md border border-border bg-card overflow-hidden">
        <CodeBlock code={text} language={lang} className="overflow-x-auto" small={small} />
      </div>
    );
  },
  h1: ({ children }) => (
    <h1 className="mt-2 mb-2 text-2xl font-semibold font-sans">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-3 mb-2 text-xl font-semibold font-sans">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1 text-lg font-semibold font-sans">{children}</h3>
  ),
  p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-2 ml-5 list-disc space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 ml-5 list-decimal space-y-1">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ children, href }) => (
    <a
      href={href}
      className="text-primary underline hover:no-underline"
      target="_blank"
      rel="noreferrer noopener"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-4 border-border pl-3 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-muted px-2 py-1 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-2 py-1">{children}</td>
  ),
  hr: () => <hr className="my-4 border-border" />,
  img: ({ src, alt }) => {
    // Markdown images are out of scope for safety/sizing; show a hint
    // instead. react-markdown 10 types `src` as `string | Blob | undefined`,
    // so coerce to string before rendering.
    const label =
      typeof alt === 'string' && alt
        ? alt
        : typeof src === 'string'
        ? src
        : 'image';
    return <span className="text-xs text-muted-foreground">[image: {label}]</span>;
  },
});

export function MarkdownView({ content, className, small }: MarkdownViewProps) {
  return (
    <div className={className}>
      <div className={small ? 'px-3 py-2 text-xs' : 'px-3 py-2 text-sm'}>
        {/* `skipHtml` explicitly drops any raw HTML in the markdown source.
            react-markdown's default already escapes raw HTML (we don't
            ship rehype-raw), so this is documentation-as-defence rather
            than a runtime change — it makes the intent explicit and
            future-proofs the file against accidental rehype-raw additions. */}
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={createComponents(small)}
          skipHtml
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
