# Foolscap — engineering & design contract

> A downloadable **Windows desktop app** for focused, **offline** studying of Cambridge (CAIE)
> exam papers. Based on the ShinyPapers web app (`C:\scambridge`) but re-focused: it opens a real
> paper from the local library, lets you annotate and time yourself, and tracks focus — all offline.
> An AI answer-checker drops in later at a clean seam.

**Read this before writing any UI.** It is the locked design system and the anti-slop contract.
It is grounded in the approved demo at `demos/design-demo.html` — when in doubt, that demo is the
reference implementation. Precedence: Zohaib's words > this file > your own taste.

---

## Stack & layout
- **Tauri v2 + React + Vite + TypeScript + Tailwind v4.** Small premium exe, native feel.
- **Local-first:** a Rust ingest walks `G:\CambridgeDatabase` into a local **SQLite** index.
  Difficulty computed locally. No server, no network, no Supabase/Next/Vercel.
- **Papers rendered in-app** with `pdfjs-dist` in the webview + a `<canvas>` annotation overlay.
- Repo root = app root. `demos/` and `idea/` are design provenance, kept in-repo.

```
C:\ShinyPapersDesktop\
  src/            React app (frontend)
  src-tauri/      Rust side (ingest, SQLite, file access to G:)
  demos/          approved HTML design demo (reference)
  idea/           reference imagery
  CLAUDE.md  TASKS.md
```

## Commands
- `npm run tauri dev` — dev window (hot-reload frontend; Rust recompiles on change)
- `npm run tauri build` — Windows installer
- `npm run build` — frontend typecheck + bundle only
- `npm run verify:index` — walk G: into a throwaway SQLite index and report its shape
- `npm run verify:thresholds [code] [cap]` — run the threshold parser over real `gt` PDFs
- `npm run verify:difficulty [code|all]` — compare the ported formula against scambridge's original
- `npm run verify:papers [code|all] [cap]` — open real question papers and check page counts
- `cargo test --lib` (from `src-tauri`) — path parsing, the walk, the SQL, the read sandbox, state keys
- `npm run fonts` — re-download the vendored woff2 faces (the only step that needs network)

## Offline is a hard requirement
The app must run with the network unplugged. That means **no runtime CDN, no Google Fonts
`@import`, no remote PDF**. The three type families are vendored as woff2 under
`src/assets/fonts/` and declared in the generated `src/styles/fonts.css` — regenerate with
`npm run fonts`, never re-add a font `@import`.

## Where each piece runs
- **Rust** owns the file system and SQLite: the walk of `G:`, the index, the read queries, and
  the study-state files.
- **The webview** owns PDF work, because that is where `pdfjs-dist` lives. Grade-threshold
  parsing and difficulty scoring run there — which is also what let the existing scambridge
  TypeScript be reused nearly verbatim — and write back through Tauri commands
  (`save_thresholds`, `save_difficulty`).
- PDFs reach the webview through **`read_document`**, which refuses any path that is not in the
  index. Since the index only ever holds files found under the three level directories of the
  library root, that check *is* the sandbox — there is no path glob to get subtly wrong. Don't
  swap it back for the asset protocol.
- pdf.js **standard fonts and CMaps are vendored** under `public/pdfjs/` and wired up in
  `src/lib/pdf.ts`. Without them, rendering silently degrades the moment a paper uses a
  non-embedded standard font.

## Study state (`src/lib/store.ts`)
Bookmarks, done/revision, focus minutes and annotation ink live in **one JSON file per key** in
the app's state dir — not in SQLite (a reindex wipes that, and none of this is derived from `G:`)
and not in localStorage (ink would blow the cap). It is hydrated once in `main.tsx` before the
first render, which is what keeps every accessor synchronous. Rust restricts key names so a key
can never escape the state dir.

## Annotation ink
Points and stroke widths are stored as **fractions of the page box**, never pixels, so ink stays
put through zoom, a resize, or a move to a display with a different DPR. Only two ink colours
exist: the pen blue and the highlighter amber from the demo.

---

# DESIGN SYSTEM (locked)

## Governing principle — steal the discipline, not the poster
The aesthetic is the OS-glass lineage (Aqua → visionOS → Apple **Liquid Glass**), used as a
**material and an accent, never as wallpaper**. The hero is always the bright white exam PDF.

1. **Glass is chrome, never content.** Translucency + backdrop-blur + a hair-thin specular edge
   live only on the *frame*: sidebar, top bar, ⌘K palette, sheets/popovers, the mark-scheme sheet.
   Content surfaces (cards, the paper) are calm and mostly opaque.
2. **One iridescent accent, spent as a LINE not a wash.** The `--iris` gradient appears only on
   *live* elements: focus ring, active tab, timer ring, progress bar, selection, tool-active edge.
   It replaces Tailwind-default indigo everywhere.
3. **Difficulty is a SEPARATE warm heat scale** (`--d1..--d5`). Never mix it with the brand iris.
4. **Content-first contrast.** The white paper is the brightest, highest-contrast thing on screen.
   Glass and accent never out-shout it. Annotation ink stays legible over the workspace ground.
5. **Lush renders only where nothing competes:** app icon, onboarding, empty states, the
   "focus session complete" moment, installer/marketing. Never behind dense content.

## Tokens — source of truth (from the demo; port verbatim into Tailwind v4 `@theme` + CSS vars)
Day is `:root`; Night is `.app[data-tone="night"]` (product-level toggle, NOT `prefers-color-scheme`).
Paper stays white in both tones.

```css
:root{
  --font-ui:'Schibsted Grotesk',system-ui,-apple-system,'Segoe UI',sans-serif;
  --font-disp:'Schibsted Grotesk',system-ui,-apple-system,'Segoe UI',sans-serif; /* same family; titles differ by weight/size */
  --font-mono:'IBM Plex Mono',ui-monospace,'Cascadia Code',monospace;
  --font-ink:'Caveat',ui-rounded,cursive;

  /* DAY ground — a picked cool periwinkle-grey, never flat grey */
  --ground:#e7e9f2; --ground-2:#dcdfeb;
  --ambient-a:rgba(102,124,255,.10); --ambient-b:rgba(214,150,220,.10);
  --paper:#ffffff; --page-ink:#1a1c24; --page-ink-2:#5b6072; --page-line:rgba(26,28,36,.14);
  --ink:#1b1d27; --ink-2:#565b6f; --ink-3:#8a8fa4;
  --glass:rgba(255,255,255,.58); --glass-strong:rgba(255,255,255,.74);
  --glass-brd:rgba(255,255,255,.80); --glass-hi:rgba(255,255,255,.65);
  --hair:rgba(24,26,52,.11); --hair-2:rgba(24,26,52,.07);
  --card:#f6f7fc; --card-brd:rgba(24,26,52,.09);

  /* brand: cool iridescent — spent only as a line */
  --iris-1:#6aa8ff; --iris-2:#6f76f2; --iris-3:#9d7bf0; --iris-4:#f3b7c6;
  --accent:#5b63ea; --accent-soft:rgba(91,99,234,.12);
  --iris:linear-gradient(90deg,var(--iris-1),var(--iris-2),var(--iris-3),var(--iris-4));

  /* difficulty: a warm heat scale — a separate axis from the brand */
  --d1:#d7b45a; --d2:#e0a33e; --d3:#e0863a; --d4:#d76a3c; --d5:#cf5568;

  --shadow-win:0 24px 60px -28px rgba(18,20,50,.42),0 6px 16px -10px rgba(18,20,50,.24);
  --shadow-card:0 1px 2px rgba(18,20,50,.05);
  --shadow-card-h:0 12px 28px -14px rgba(18,20,50,.28);
  --shadow-paper:0 32px 60px -30px rgba(18,20,50,.34),0 8px 20px -14px rgba(18,20,50,.22);
  --shadow-pop:0 30px 70px -24px rgba(14,16,44,.5);
  --r-win:15px; --r-panel:16px; --r-card:13px; --r-btn:10px; --r-chip:9px; --r-pill:999px;
}
.app[data-tone="night"]{
  --ground:#111219; --ground-2:#0b0c12;
  --ambient-a:rgba(112,132,255,.20); --ambient-b:rgba(200,140,225,.16);
  --ink:#e9ebf4; --ink-2:#a6abbe; --ink-3:#767b90;
  --glass:rgba(32,34,48,.52); --glass-strong:rgba(38,40,58,.70);
  --glass-brd:rgba(255,255,255,.12); --glass-hi:rgba(255,255,255,.14);
  --hair:rgba(255,255,255,.10); --hair-2:rgba(255,255,255,.06);
  --card:rgba(30,32,46,.55); --card-brd:rgba(255,255,255,.09);
  --accent:#8b90ff; --accent-soft:rgba(139,144,255,.16);
  /* shadows deepen — see demo */
}
```

## Typography — 3 roles, no more
- **Schibsted Grotesk** (`--font-ui`/`--font-disp`) — ALL UI, labels, and titles. Titles differ by
  **weight/size/tracking**, never by switching typeface. (This replaced a Bricolage/Hanken mix that
  read as inconsistent.) Toolbar titles ~17px/700; wordmark ~16.5px/700; body 14px.
- **IBM Plex Mono** (`--font-mono`) — exam/machine data ONLY: paper codes, `/variant`, marks (B1/M1/A1),
  timer, difficulty score, session codes (s24), scores, `kbd`. Use `tabular-nums`.
- **Caveat** (`--font-ink`) — handwritten annotation ink ONLY (the pen note on the paper). Nowhere else.

## Material & motion
- Glass: `backdrop-filter: blur(26px) saturate(165%)` for chrome; `blur(30–34px) saturate(170–175%)`
  for the mark-scheme sheet and ⌘K palette. Hairline edges via `--hair`; specular top via inset
  `--glass-hi`.
- **Animate only `transform` and `opacity`.** Never width/height/padding/margin/grid-template — they
  cause jank and undercut the premium feel. (Focus mode recedes chrome via translate+opacity only.)
- Easings in use: `cubic-bezier(.4,0,.1,1)` (sheets/recede), `cubic-bezier(.2,.7,.2,1)` (cards/rise).
- Honour `prefers-reduced-motion: reduce`.

## Aurora (still being A/B'd)
- **Baseline = strict frame-and-line.** A **soft** iridescent bloom is allowed ONLY behind the
  **library grid** (in the margins around opaque cards) and in empty states — **never** the workspace.
- Implemented as `data-aurora="soft|off"` on `.app`; gated `[data-view="library"][data-aurora="soft"]`.
  Keep this a toggle. Final default is Zohaib's call.

## Window idiom
macOS-style rounded app window, traffic-light dots in the sidebar, translucent sidebar + toolbar.
In the real app the OS window *is* the app (`decorations: false`), so there is no floating
"stage" like the demo has: the shell fills the viewport and the traffic lights are wired to
close / minimise / maximise. The top bar carries `data-tauri-drag-region`.

---

# SLOP BLOCKLIST — do NOT ship these
- Default zinc/slate greys or **Inter / Space Grotesk / Geist** as the type. (We use Schibsted + Plex Mono.)
- Full-bleed holographic / aurora **wallpaper behind content**; glass cards floating on a rainbow blur.
- Violet→blue default gradient heroes; the accent used as a fill/wash instead of a line.
- Emoji as section headings or bullets.
- `rounded-2xl` on everything; everything centered; drop shadows on flat cards for no reason.
- Numbered `01 / 02 / 03` markers unless the content is a real ordered sequence.
- Lorem ipsum — always real paper codes, subjects, sessions, mark-scheme rows.
- Mixing the difficulty heat scale with the brand iris.

---

# DATA — G:\CambridgeDatabase (read-only)
**Never move, rename, or modify anything under `G:`.** Read in place; write only to the local SQLite
index and the app's own state dir.

Path pattern (parse everything from the path + filename):
```
<Level> \ <Subject> (<code>) \ <Year> \ <SeasonName> (<scode>) \ <DocType> \ <code>_<scode>_<type>[_<variant>].pdf
A Level  \ Accounting (9706)   \ 2015   \ May-June (s15)          \ Grade Thresholds \ 9706_s15_gt.pdf
```
- **Valid Levels:** `A Level`, `IGCSE`, `O Level`. Ignore other root dirs (`caie`, `cambridge-study-buddy`).
- Season code `scode`: `s`=May/June, `w`=Oct/Nov, `m`=Feb/March + 2-digit year.
- Filename `type`: `qp` question paper, `ms` mark scheme, `gt` grade thresholds, `er` examiner report, etc.;
  optional `variant` (paper/variant, e.g. `12`, `42`).
- Grade-threshold PDFs are all present → difficulty runs locally over the whole library.

## Reuse map (from `C:\scambridge` — ignore the `.worktrees\` mirror)
- `lib/difficulty-formula.ts` → **ported** to `src/lib/difficultyFormula.ts`, substance unchanged
  so scores stay comparable. `src/lib/scoreSittings.ts` holds the batch pass (reference classes
  assembled the same way the web app's `recompute-difficulty.ts` does — a paper is included in
  its own component's reference). `npm run verify:difficulty` diffs the two modules.
- `pipeline/threshold-rows.ts` → **ported** to `src/lib/thresholdRows.ts`. One deliberate change:
  the hand-maintained `ALL_COMPONENTS` allowlist is gone (it would reject valid rows now that the
  whole library is indexed); the structural checks carry it.
- `pipeline/parse-thresholds.ts` — its fetch layer is replaced by `src/lib/pdfText.ts`, which
  rebuilds text lines from pdf.js glyph positions. **This was the flagged integration risk and it
  is closed** — verified against the real `gt` PDFs. Keep the line reconstruction in that one file.
- `lib/local-store.ts` → pattern lives in `src/lib/store.ts` (localStorage today, one interface to
  move onto a file in the app state dir).
- `components/search/CommandPalette.tsx`, `components/practice/PracticeSession.tsx` (annotation),
  `components/papers/FilterBar.tsx` — UI still to adapt (restyle to THIS design system, don't
  import the old indigo).

## The five difficulty bands
The formula emits a 0–100 score and its own three bands (easy < 34, medium, hard ≥ 67). The UI's
five heat bands in `src/lib/difficulty.ts` **nest inside** those cutoffs (34 / 50 / 67 / 84), so the
finer label can never contradict the coarse one. A paper with no parsed thresholds reads
"Unrated" with an empty meter — never a guessed score.

## AI-checker seam (future)
Leave a clean interface exactly where scambridge's keyword checker sat. Out of scope for now; do not
build a checker, just don't wall off the seam.
