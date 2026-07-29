# ClipClap

A personal clipboard manager web app. Save, organise, search and retrieve text
snippets from any browser, with clips grouped into collections, pinnable, and
recoverable from a trash view.

Clips render according to detected content type, so pasted markdown, code and
Mermaid diagrams display as formatted output rather than raw text.

## Tech stack

- **Framework**: Next.js 16.2.1, App Router, Turbopack
- **UI**: React 19, TypeScript, Tailwind CSS v4
- **Component library**: shadcn/ui on base-ui, plus custom neumorphic components
- **Database and auth**: Supabase, PostgreSQL with RLS, Realtime, email auth
- **Themes**: next-themes, light and dark with a view-transition ripple
- **Content rendering**: react-markdown with remark-gfm, react-syntax-highlighter,
  mermaid, sanitised through dompurify
- **Notifications**: Sonner toasts
- **Testing**: Playwright end-to-end
- **Deployment**: Vercel

## Local setup

```bash
# 1. Clone and install
git clone https://github.com/namans1201/clip-clap.git
cd clip-clap
npm install

# 2. Copy environment variables
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

# 3. Set up Supabase
# See SUPABASE_SETUP.md for the full schema SQL

# 4. Run the dev server
npm run dev
# then open http://localhost:3000
```

## Environment variables

| Name | Required | Description | Example |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL | `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key | `eyJhbGci...` |

## Scripts

```bash
npm run dev       # development, Turbopack
npm run build     # production build
npm run start     # serve production build
npm run lint      # ESLint
npm run test:e2e  # Playwright end-to-end tests
```

## Folder structure

```
src/
  app/
    (auth)/login/            login page
    (dashboard)/             protected pages: /, /pinned, /trash, /group/[id]
    api/                     route handlers
    layout.tsx               root layout, theme provider, fonts
    globals.css              global styles and Tailwind v4 theme tokens
  components/                clip cards, sidebar, dialogs, buttons
    clip-renderers/          per-content-type renderers
    ui/                      shadcn and base-ui primitives
  hooks/                     data fetching and business logic
  contexts/                  React contexts, including CompactContext
  lib/supabase/              client, server and middleware setup
  types/database.ts          TypeScript types for DB entities
```

Extensive design and process notes live alongside the code in `ARCHITECTURE.md`,
`SPEC.md`, `SUPABASE_SETUP.md`, `PERFORMANCE.md`, `RESPONSIVE.md`, `TESTING.md`,
`SECURITY_IMPROVEMENTS.md` and `DOCS_INDEX.md`.

## Branches

| Branch | Head | Last commit | Relative to `master` | What it contains |
| --- | --- | --- | --- | --- |
| `master` (default) | `fa3a12ba` | 2026-05-28 00:39 | baseline | Latest. 32 commits. Most complete state: content detection, trash and clip modals, mobile button optimisation and login styling. |
| `experimental` | `1351dbfb` | 2026-05-21 18:10 | 0 ahead, 14 behind | Superseded snapshot, fully contained in `master`. Differs by 69 files, 758 insertions, 19661 deletions relative to `master`, meaning `master` has since added a large amount on top of it. Holds no unique work. |
| `backup/master-pre-merge` | `bdc2c0f9` | 2026-05-22 12:06 | 0 ahead, 5 behind | Deliberate safety snapshot of `master` taken before a merge, at commit "Final Build - Done". Differs by 17 files, 216 insertions, 320 deletions. Holds no unique work and is kept only as a restore point. |

**Latest branch: `master`**, 2026-05-28. Both other branches are strictly behind
it with zero commits ahead, so nothing is stranded on them. `experimental` can be
deleted safely; keep `backup/master-pre-merge` only as long as you want the
pre-merge restore point.

## Embedded copies of other repositories

This repository tracks two other projects as plain folders, 42 files in total at
`master`. They are duplicates of standalone repositories:

| Folder here | Duplicate of | Divergence |
| --- | --- | --- |
| `toggle/` | [`light-dark-toggle`](https://github.com/namans1201/light-dark-toggle) | 19 of 20 files byte-identical. Only `README.md` differs. |
| `profile-card/` | [`profile-card`](https://github.com/namans1201/profile-card) | 14 of 16 files byte-identical. `README.md` differs, and `src/Card.js` differs by one line of display text. |

Commit `6c1055e` ("Restore profile-card as normal folder") suggests these were
once submodules that were flattened into the working tree. Because they are
copies rather than references, edits made here do not reach the source
repositories and will drift over time. Consider restoring them as git submodules,
or removing them here and depending on the published packages, so there is a
single source of truth.

## Known issues and limitations

- Dashboard background gradient: the CSS module approach conflicts with the
  Tailwind v4 PostCSS pipeline, so an alternative implementation is pending.
- The Supabase project is shared between development and production; there is no
  staging environment.
- Browser only. There is no mobile app.
