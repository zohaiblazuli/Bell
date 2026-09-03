# Bell — engineering & design contract

> A downloadable **Windows desktop app** for focused, **offline** studying of Cambridge (CAIE)
> exam papers. Based on the ShinyPapers web app (`C:\scambridge`) but re-focused: it opens a real
> paper from the local library, lets you annotate and time yourself, and tracks focus — all
> offline. An AI answer-checker drops in later at a clean seam.

**Read this before writing any UI.** It is the locked design system and the anti-slop contract.

**Precedence: Zohaib's words > this file > your own taste.**

**Where the design lives.** The system is authored in Figma —
[Foolscap — Design System](https://www.figma.com/design/GnDdYtn8SaQjgmA4SQRCn7)
(`GnDdYtn8SaQjgmA4SQRCn7`; the file keeps its old name, the app does not). It has been measured
into `design/specs/*.md` — ~5,900 lines of exact geometry, tokens, component APIs, screen layouts
and motion timelines. **Build from the specs, not from a screenshot**, and re-read the file only
when a spec is missing or you suspect it has drifted. `demos/design-demo.html` is the
first-generation demo and is now **provenance only** — it is purple, differently typed, and named
Foolscap. Do not treat it as a reference.

---

## Stack & layout
- **Tauri v2 + React 19 + Vite + TypeScript + Tailwind v4.** Small premium exe, native feel.
- **Local-first:** a Rust ingest walks `G:\CambridgeDatabase` into a local **SQLite** index.
  Difficulty computed locally. No server, no network, no Supabase/Next/Vercel.
- **Papers rendered in-app** with `pdfjs-dist` in the webview + a `<canvas>` annotation overlay.
- Repo root = app root. `demos/` and `idea/` are design provenance, kept in-repo.

```
C:\ShinyPapersDesktop\
  src/            React app
    ui/           the component layer — one <Name>.tsx + <Name>.css per primitive
    ui/brand/     Wordmark, Lockup, MrBellMark, MrBell — all SVG geometry
    styles/       generated: tokens.css, theme.css, type.css, fonts.css · hand: app.css, background.css
    components/   app shell pieces (sidebar, topbar, palette, canvas)
    views/        one per screen
  src-tauri/      Rust (ingest, SQLite, file access to G:, study state, the rename migration)
  design/specs/   the measured Figma specs — the implementation contract
  demos/ idea/    provenance
  CLAUDE.md  TASKS.md
```

Import via the aliases: `@/lib/store`, `@ui/Button`. There is no deep relative path to `src/ui`.

## Commands
- `npm run tauri dev` — dev window (hot-reload frontend; Rust recompiles on change)
- `npm run tauri build` — Windows installer
- `npm run build` — frontend typecheck + bundle only
- `npm run tokens` — regenerate `tokens.css`, `theme.css`, `type.css` from `scripts/tokens.mjs`
- `npm run fonts` — re-vendor the woff2 faces (the only step that needs network)
- `npm run icon` — re-render the app icon from `MrBellMark`'s geometry and fan out every size
- `npm run verify:index` / `:thresholds` / `:difficulty` / `:papers` — data-layer checks
- `cargo test --lib` (from `src-tauri`) — 13 tests: path parsing, the walk, the SQL, the read
  sandbox, state keys, and the Foolscap→Bell state migration

## Offline is a hard requirement
The app must run with the network unplugged. **No runtime CDN, no font `@import`, no remote
asset.** The CSP enforces it: `font-src 'self' data:` permits no remote font origin. The three
type families are vendored as woff2 under `src/assets/fonts/`, declared in the generated
`src/styles/fonts.css`; regenerate with `npm run fonts`, never re-add an `@import`. The background
art is vendored as WebP under `src/assets/bg/`.

## Where each piece runs
- **Rust** owns the file system and SQLite: the walk of `G:`, the index, the read queries, the
  study-state files, and the one-time state migration from the app's previous identifier.
- **The webview** owns PDF work, because that is where `pdfjs-dist` lives. Grade-threshold parsing
  and difficulty scoring run there — which is also what let the existing scambridge TypeScript be
  reused nearly verbatim — and write back through Tauri commands (`save_thresholds`,
  `save_difficulty`).
- PDFs reach the webview through **`read_document`**, which refuses any path that is not in the
  index. Since the index only ever holds files found under the three level directories of the
  library root, that check *is* the sandbox — there is no path glob to get subtly wrong. Don't
  swap it back for the asset protocol.
- pdf.js **standard fonts and CMaps are vendored** under `public/pdfjs/` and wired up in
  `src/lib/pdf.ts`. Without them, rendering silently degrades the moment a paper uses a
  non-embedded standard font.

## The dev server will lie to you about a rewritten file

**Vite's watcher on Windows misses a whole-file replace.** Edit a file in place and HMR works. Write
the *entire* file — which is what an agent or an editor doing atomic save-to-temp-then-rename does —
and the watcher can miss it entirely: the app keeps running the old module, `npm run build` shows the
new one, and nothing anywhere reports a problem. This has cost hours twice on this project, once on
`app.css` and once on `TopBar.tsx`, and both times the symptom read as "my change did nothing".

Two things follow:

1. **After rewriting a whole file, `touch` it** — or make one trivial in-place edit — and the watcher
   picks it up.
2. **Verify against the dev server, not the disk.** `curl -s http://localhost:1420/src/path/File.tsx`
   returns the transform the running app is actually executing. If the disk and that disagree, it is
   this bug and not your code. `npm run shot` then confirms what rendered.

The related trap, already fixed and worth not reintroducing: **stylesheets must be real modules.**
`index.css` used to pull the whole chain in with plain `@import`s, and since the Tailwind plugin owns
that file, edits to the imported sheets were never invalidated. `main.tsx` now imports each sheet
individually, and `scripts/ui-css.mjs` emits `src/ui/styles.ts` — a TypeScript module of
`import './X.css'` lines — rather than a `.css` of `@import`s. Keep it that way.

## Study state (`src/lib/store.ts`)
Bookmarks, done/revision, focus minutes and annotation ink live in **one JSON file per key** in
the app's state dir — not in SQLite (a reindex wipes that, and none of this is derived from `G:`)
and not in localStorage (ink would blow the cap). It is hydrated once in `main.tsx` before the
first render, which is what keeps every accessor synchronous. Rust restricts key names so a key
can never escape the state dir.

**The state dir is derived from the bundle identifier**, so renaming the app moves it.
`src-tauri/src/migrate.rs` carries the old directory over on first launch — copying, never moving,
never overwriting, and marking itself so it runs exactly once. If the identifier ever changes
again, extend that module rather than writing a new one.

## Annotation ink
Points and stroke widths are stored as **fractions of the page box**, never pixels, so ink stays
put through zoom, a resize, or a move to a display with a different DPR.

Ink colour is **deliberately off-token**: it is printed on the white paper, so it must not invert
with the tone, and the literal is written into every saved `Mark` on disk. The Figma Reader screen
has since replaced the two fixed colours with a **six-swatch palette plus stroke-width and opacity
controls** — so ink is becoming user-chosen, and `mark.color` stays the source of truth. Existing
ink keeps whatever it was drawn with. See `design/specs/screen-reader.md`.

---

# DESIGN SYSTEM

## Governing principle — steal the discipline, not the poster
The aesthetic is the OS-glass lineage (Aqua → visionOS → Apple **Liquid Glass**), used as a
**material and an accent, never as wallpaper**. The hero is always the bright white exam PDF.

## The five rules

1. **Glass is chrome, never content.** Translucency, backdrop-blur and a hair-thin specular edge
   live only on the *frame*: sidebar, top bar, ⌘K palette, sheets, popovers, the mark-scheme sheet.
   Content surfaces — cards, the paper — are calm and mostly opaque. One refinement: the
   onboarding panel is a blurred 1040×640 sheet, but its fill is `--card`, **not** `--glass`.
   A sheet that big in chrome glass reads muddy and gives text no stable ground.
2. **One accent, spent as a LINE not a wash.** It appears only on *live* elements: focus ring,
   active nav, timer ring, progress, selection, tool-active edge. **The single sanctioned
   exception is the Primary button**, whose fill is the `--grad-btn` gradient. `--accent-soft` is
   the only permitted wash, and only ever behind one element.
3. **Difficulty is a SEPARATE warm heat scale** (`--d1`…`--d5`). Never mix it with the brand blue.
   It **is** mode-paired — a dark burnt ramp in Day, a bright one in Night. The Figma Getting
   Started page still says "never retone them between Day and Night"; the variables and every
   screen say otherwise, and the variables win. Flagged for Zohaib in `TASKS.md`.
4. **Content-first contrast.** The white paper is the brightest, highest-contrast thing on screen.
   Glass and accent never out-shout it. Annotation ink stays legible over the workspace ground.
5. **Lush renders only where nothing competes:** app icon, onboarding, empty states, the
   "focus session complete" moment, installer/marketing. Never behind dense content.

## Tokens — generated, never hand-written

`src/styles/tokens.css` is emitted by `scripts/tokens.mjs`, which holds the table harvested from
Figma. **Do not edit the CSS.** Retuning a token is a one-line edit in the generator plus
`npm run tokens`. The same script emits `theme.css` (the Tailwind `@theme` bridge) and `type.css`.

Day is `:root`; Night overrides on `.app[data-tone='night']` — a **product-level toggle, not
`prefers-color-scheme`**. The Settings screen adds an explicit "Match system" opt-in; the default
stays the product toggle, because the user chooses, not the OS. A token declared once is
deliberately identical in both tones, and `--paper` / `--page-ink` are among them: ink printed on
the paper must never invert.

The names are not ours to invent — **Figma's own Code Syntax declares them** (`ink/1` → `--ink`,
`card/fill` → `--card`, `hair/2` → `--hair-2`, `accent/base` → `--accent`, `radius/card` →
`--r-card`), which is what keeps the two files greppable against each other. Newer tokens
(`--activity-*`, `--bell-*`, `--traffic-*`) have no Code Syntax yet; adding it is open work.

Groups: `--ground --ground-2 --ground-veil` · `--ambient-a/-b` · `--paper --page-ink --page-ink-2
--page-line` · `--white --plate --scrim` · `--ink --ink-2 --ink-3` · `--glass --glass-strong
--glass-brd --glass-hi` · `--hair --hair-2` · `--card --card-brd` · `--accent --accent-soft` ·
`--iris-1..4` · `--bell-cap-hi/-mid/-lo/-deep --bell-gold-* --bell-blush` · `--grad-line
--grad-btn` · `--d1..--d5` · `--activity-0..4` · `--traffic-*` · `--danger --danger-soft` ·
`--shadow-*` · `--r-win --r-panel --r-card --r-btn --r-chip --r-pill`.

Three things worth knowing:
- **`--danger` is an app addition, not in Figma.** The design system has no success/danger/warning
  token, and error styling used to hand-convert `--d5` — borrowing the difficulty axis for
  something that is not difficulty, which rule 3 forbids. Use `--danger`, never `--d5`, for state.
- **`--hair` is used as both a fill and a stroke** — 1px rule elements and borders alike. One
  token; CSS does not care which property consumes it. Don't split it.
- **The `iris/*` names now lie.** All four stops are blue. Figma still calls them that, so we do
  too; renaming is open debt in both places. `--grad-line` is the four-stop brand line.

**Raw colour is a bug.** The only literals permitted anywhere in `src/` are the two annotation-ink
constants, Mr. Bell's black spectacles, and two functional `#000` mask gradients. Everything else
is a token or a `color-mix()` of one.

## Typography — three roles, and a ramp you name rather than re-derive

- **SF Pro** (`--font-ui` / `--font-disp`) — all UI, labels and titles. Split by Apple's 20pt
  optical crossover: **SF Pro Text** carries everything from 10 to 17px, **SF Pro Display** the two
  styles at 20 and above. Titles differ by weight, size and tracking, never by switching typeface.
- **Geist Mono** (`--font-mono`) — exam and machine data ONLY: paper codes, `/variant`, marks
  (B1/M1/A1), the timer, difficulty scores, session codes, `kbd`. It is a monospace, so digits are
  already tabular; `tabular-nums` is set anyway and is a no-op there.
- **Caveat** (`--font-ink`) — handwritten annotation ink. Nowhere else. Currently unreferenced;
  whether it stays depends on the `Ink/Annotation` style surviving in Figma.

**Use the ramp classes** from the generated `type.css` — `.t-title-toolbar`, `.t-body-default`,
`.t-label-section`, `.t-mono-stat` and the rest — as a `className`. Do not re-derive size, weight
and tracking in a component's own CSS; that is how seventeen ad-hoc font sizes accumulated last
time. Two documented off-ramp sizes exist and have their own classes: `.t-greeting` (20) and
`.t-mono-hero` (26).

Line heights are `normal`, not `1`. Figma reports every style's line height as `100`, which means
AUTO — the font's own metrics — and hard-coding `1` crushes every multi-line block.

SF Pro is Apple's typeface and its licence covers Apple platforms; it is vendored here on Zohaib's
explicit instruction. Noted once, not re-litigated.

## Material & motion
- Glass: `backdrop-filter: blur(26px) saturate(165%)` for chrome; `blur(30–34px)
  saturate(170–175%)` for the mark-scheme sheet and ⌘K palette. Hairline edges via `--hair`;
  specular top via inset `--glass-hi`.
- **Animate only `transform` and `opacity`.** Never width/height/padding/margin/grid-template.
  Two documented exceptions, both paint-only and both from the file: the progress rings animate
  `stroke-dashoffset`, and the startup handoff's wordmark tweens its `fill` white→ink mid-travel,
  because crossfading two stacked wordmarks put a white one over a light app for ~80ms.
- Progress bars scale: `transform: scaleX()` with `transform-origin: left`, never `width`.
- Easings in use: `cubic-bezier(.4,0,.1,1)` (sheets, recede), `cubic-bezier(.2,.7,.2,1)` (cards,
  rise), `cubic-bezier(.2,.8,.2,1)` (the palette pop).
- Honour `prefers-reduced-motion: reduce` **and** the Settings "Reduce motion" switch — both
  collapse mascot animation to the static idle pose and make the tone change a cut. Progress bars
  keep moving: a progress bar is information, not decoration.
- `cursor` stays `default` throughout, including on buttons. The app is native, not a web page.

## The background stack
Every screen sits on the same stack, and it applies to **every** screen — there is no longer an
aurora toggle. Bottom to top: two ambient blooms (CSS radial gradients at Figma's exact geometry),
the exported cloud field, Day's darkening orb, Night's veil, then `page recess` on `.main`.

`clouds` and the orb are **WebP exported from the file** rather than rebuilt from 46 blurred DOM
nodes; they cost 24/35/22 KB and upscale invisibly, and reproducing them as elements under the
glass chrome's `backdrop-filter` would be the wrong trade. The blooms stay CSS so they can be
retuned without re-exporting.

**Night is a bright stack knocked down by translucent layers, not a dark base.** The measured
composite of the Night sidebar is ≈`#4E5876`. If a change makes it read near-black, an opacity has
been flattened somewhere.

## Mr. Bell
The mascot: a pixel-art crab in spectacles, and the app's only mascot. He lives at the foot of
every sidebar at 160px, hosts onboarding at 160px, appears at 96px in the update dialog, and his
64px `MrBellMark` is the app icon and the sidebar logo's mark.

- The rig is **39 rects in 9 limb groups** with six empty pivot frames centred on the joints, so
  rotation swings from the shoulder or hip. `body` holds the claws, shell, eyes and specs; the four
  leg pivots are **siblings of `body`**, which is what lets the legs stay planted while the body
  moves. A jump arc belongs on the whole crab, never on `body`.
- **Never put a stroke on him.** He is separate rectangles, so a stroke outlines each block instead
  of the silhouette and turns the shell into a grid of squares. Use a shadow or a glow.
- **The spectacles are black by instruction** — raw `#000000` rects plus two lens vectors at raw
  `#0079b5`/42%. They are the documented exception to the no-raw-colour rule. Do not re-whiten or
  tokenise them; two earlier attempts were reverted.
- Claws render behind the shell, so a claw slid inward hides its shoulder rather than detaching.
  Keep claw motion rotational.
- Stepped `HOLD` timing suits pixel art but reads as a hop for slow states; breathing wants
  ease-in-out at ~4px, not a stepped 8px bob.

## Brand
`Wordmark` is SF Pro **Expanded** Bold 96 at −2% tracking, shipped as **outlines** — live text
falls back off Apple platforms, which shifts the stems and lands the spectacles wrong. Expanded was
chosen on measurement: the two `l` stems sit 24.9px apart where Semibold gives ~20, and that
spacing is what lets them read as eye stalks. The word wears the spectacles.

The spectacle assembly sits **~2.15px right of the type centre**, deliberately; the lens origins
are 145 and 170 and the bridge is 5px because it spans lens-to-lens, not stem-to-stem. Do not
"align" it. Below ~58px of box height use `specs={false}` — which is also why both lockups do:
the spectacles appear once, on the mark, not twice.

## The activity grid
53 weeks × 7 days = 368 cells, 10px cell, 3px gap, 13px pitch, radius 2, grid exactly 714×88, a
28px day gutter, Mon/Wed/Fri labels only, and a month label placed by the rule that a week belongs
to the month containing its **Saturday**. Every cell — including empty — carries a `--hair-2`
0.5px hairline; that hairline is what makes it read as a lattice of slots rather than a scatter of
dots. Exam-session bands sit under it at `--accent` 55%, which is what turns a vanity graph into a
planning instrument.

**Thresholds are absolute — papers per day — never per-user quantiles.** A self-relative scale
re-normalises and hides progress; a colour must mean the same thing in September as in May.
Step 0 is neutral and opaque on purpose: a desaturated brand tint reads as "a little activity",
a grey reads as "an empty slot".

## Window idiom
macOS-style rounded window, traffic-light dots at the top of the sidebar, translucent sidebar and
toolbar. The OS window *is* the app (`decorations: false`), so there is no floating stage: the
shell fills the viewport and the lights are wired to close / minimise / maximise. The top bar
carries `data-tauri-drag-region`. Five nav rows under STUDY — Library, Dashboard, Bookmarks,
Recent, Settings.

---

# SLOP BLOCKLIST — do NOT ship these

- Default zinc/slate greys, or **Inter / Space Grotesk / Geist Sans** as the type. (We use SF Pro.
  **Geist *Mono* is the sanctioned exception** — it is the machine-data face, and every `Mono/*`
  style in the file specifies it.)
- A full-bleed holographic wallpaper *competing with* content; glass cards floating on a rainbow
  blur. The tuned background stack is not this: it is always behind the content plane, dialled down
  by `veil` and `page recess`, and never bright enough for the white PDF to stop being the
  brightest thing on screen.
- **Violet.** The file is audited purple-free; the accent is blue and the old indigo/violet pair is
  retired. One straggler survives on purpose — the Resume button's `#6f76f2` glow, which effects
  could not carry a bound variable's alpha for; ship it as the brand blue at 90%.
- The accent used as a fill or a wash instead of a line — **except** the Primary button.
- Emoji as section headings or bullets.
- `rounded-2xl` on everything; everything centered; drop shadows on flat cards for no reason.
  Content cards here carry **no** shadow: their elevation comes from the recess behind them.
- Numbered `01 / 02 / 03` markers unless the content is a real ordered sequence.
- Lorem ipsum — always real paper codes, subjects, sessions, mark-scheme rows.
- Mixing the difficulty heat scale with the brand blue, or borrowing `--d5` for an error state.
- Re-deriving type metrics in a component instead of naming a `.t-*` class.
- A raw hex anywhere outside the four documented exceptions.

---

# DATA — G:\CambridgeDatabase (read-only)
**Never move, rename, or modify anything under `G:`.** Read in place; write only to the local
SQLite index and the app's own state dir.

Path pattern (parse everything from the path + filename):
```
<Level> \ <Subject> (<code>) \ <Year> \ <SeasonName> (<scode>) \ <DocType> \ <code>_<scode>_<type>[_<variant>].pdf
A Level  \ Accounting (9706)   \ 2015   \ May-June (s15)          \ Grade Thresholds \ 9706_s15_gt.pdf
```
- **Valid Levels:** `A Level`, `IGCSE`, `O Level`. Ignore other root dirs (`caie`,
  `cambridge-study-buddy`).
- Season code `scode`: `s`=May/June, `w`=Oct/Nov, `m`=Feb/March + 2-digit year.
- Filename `type`: `qp` question paper, `ms` mark scheme, `gt` grade thresholds, `er` examiner
  report; optional `variant` (paper/variant, e.g. `12`, `42`).
- Grade-threshold PDFs are all present → difficulty runs locally over the whole library.

## Reuse map (from `C:\scambridge` — ignore the `.worktrees\` mirror)
- `lib/difficulty-formula.ts` → **ported** to `src/lib/difficultyFormula.ts`, substance unchanged
  so scores stay comparable. `src/lib/scoreSittings.ts` holds the batch pass.
  `npm run verify:difficulty` diffs the two modules.
- `pipeline/threshold-rows.ts` → **ported** to `src/lib/thresholdRows.ts`. One deliberate change:
  the hand-maintained `ALL_COMPONENTS` allowlist is gone (it would reject valid rows now that the
  whole library is indexed); the structural checks carry it.
- `pipeline/parse-thresholds.ts` — its fetch layer is replaced by `src/lib/pdfText.ts`, which
  rebuilds text lines from pdf.js glyph positions. **This was the flagged integration risk and it
  is closed** — verified against the real `gt` PDFs. Keep the line reconstruction in that one file.

## The five difficulty bands
The formula emits a 0–100 score and its own three bands (easy < 34, medium, hard ≥ 67). The UI's
five heat bands in `src/lib/difficulty.ts` **nest inside** those cutoffs (34 / 50 / 67 / 84), so the
finer label can never contradict the coarse one. A paper with no parsed thresholds reads
"Unrated" with an empty meter — never a guessed score. The meter is **five pips**, 14×5 at a 3px
gap; the fill count is the band index. Import the band model, never restate it.

## AI-checker seam (future)
`src/lib/answerCheck.ts` holds the request/result/registry shape where scambridge's keyword checker
sat. Nothing imports it; nothing has to be refactored to add one. Do not build a checker, and do
not wall off the seam.

