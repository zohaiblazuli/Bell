# Bell — build tracker

Name: **Bell** (was "Foolscap"; the rename lands in Phase 5.9 along with a state migration).
Plan of record: `C:\Users\Evo\.claude\plans\claude-need-you-to-eventual-pebble.md` (Phase 6 — Notebooks)
Earlier plan (Phase 5): `C:\Users\Evo\.claude\plans\claude-big-thing-up-encapsulated-rose.md`
Earlier plan (Phases 1–4): `C:\Users\Evo\.claude\plans\hi-claude-i-wanna-foamy-kettle.md`
Design contract: `./CLAUDE.md` — **being rewritten in Phase 5.9; the Figma file is ahead of it**
Design source: [Foolscap — Design System](https://www.figma.com/design/GnDdYtn8SaQjgmA4SQRCn7) (`GnDdYtn8SaQjgmA4SQRCn7`)

Legend: `[x]` done · `[~]` in progress · `[ ]` todo · `[?]` needs a call from Zohaib

---

## Phase 1 — Base design (LOCKED ✅)
- [x] Clickable HTML demos of Workspace + Library (`demos/design-demo.html`)
- [x] Glass-as-chrome + single iridescent line language
- [x] Difficulty = separate warm heat scale
- [x] Day/Night tone toggle (product-level, not OS)
- [x] Typography fixed: one grotesque (Schibsted) for UI+titles; Plex Mono = data; Caveat = ink
- [x] Soft-aurora A/B toggle (bloom behind library grid only)
- [x] Approved by Zohaib ("I like it")
- [x] `CLAUDE.md` design system + slop blocklist, grounded in the demo

## Phase 2 — Scaffold + local data (DONE ✅)
- [x] Tauri v2 + React + Vite + TS scaffolded into the workspace root
- [x] Tailwind v4 wired; demo tokens ported into `@theme` + `src/styles/tokens.css`
- [x] **Fonts vendored** (`npm run fonts`) — a Google Fonts `@import` would have broken offline
- [x] App shell: glass sidebar + topbar, Day/Night, aurora toggle, traffic lights wired to the
      real window (`decorations: false`)
- [x] ~~Rust ingest walks `G:\CambridgeDatabase` → SQLite~~ — **replaced.** The catalogue now comes
      from the ShinyPapers API and papers are downloaded on request. `G:` is no longer read at all.
- [x] ~~Threshold parser ported~~ / ~~difficulty formula ported~~ — **both deleted.** Difficulty is
      computed once on the server and read from the catalogue, so there is no second implementation
      left to drift. `buildDifficulty`/`thresholdRows`/`scoreSittings`/`difficultyFormula` are gone.
- [x] Catalogue sync + download manager: `GET /api/desktop/v1/catalog` (2,605 papers, ~70 KB
      gzipped, ETag → 304) and `GET /api/desktop/v1/file/{id}/{qp|ms}` (302 to the real PDF).
      Verified end to end by `npm run verify:papers`.
- [x] Library grid reads real papers + difficulty out of SQLite

## Phase 3 — Core screens (DONE ✅)
- [x] Library/browse: level + season + subject filters, difficulty meter, grouped by year
- [x] **Study state moved off localStorage onto disk** — one JSON file per key in the app state
      dir, hydrated before first render so call sites stay synchronous. Ink would have blown the
      localStorage cap. Rust rejects any key that could escape the state dir (tested).
- [x] **Paper workspace** — pdf.js renders the real paper straight from the library:
  - [x] Page render at device pixel density, 7 zoom steps
  - [x] Annotation canvas: pen / highlighter / eraser, ink stored as fractions of the page so it
        survives zoom, resize and a different display's DPR. Ctrl+Z undoes the last stroke.
  - [x] Focus timer with the iris ring; target length cycles through real CAIE durations; minutes
        banked per day and per paper, resuming where a paper left off
  - [x] Mark-scheme sheet — glass, slides over, renders the real `ms` PDF, paper shifts behind it
  - [x] Focus mode: chrome recedes via transform + opacity only
  - [x] Keyboard: ←/→ or PageUp/PageDown to page, Ctrl+Z undo, Esc closes the sheet then focus mode
- [x] PDFs reach the webview through `read_document`, which refuses any path not in the index
      (tested) — no path-glob scope to get wrong
- [x] pdf.js standard fonts + CMaps vendored under `public/pdfjs/` so rendering is offline too
- [x] **Done / revision marking on the card**, alongside bookmarks. All three write through
      `store.ts`; a mark also keeps a copy of the row that carried it, because a paper marked two
      sessions ago won't be in whatever page of rows the current query holds. Marked lists render
      from those snapshots — paths still go through `read_document`, so a stale one fails loudly.
- [x] **Bookmarks + Recent are real** (they were disabled stubs): both are library filters, with
      counts in the sidebar, and Recent keeps its own order instead of being regrouped by year.
- [x] **⌘K / Ctrl-K command palette** — the demo's design, over a new `search_papers` SQL query so
      every token has to match somewhere in the paper's code / subject / level / session / variant
      / year across the whole index, not just a loaded page. Resting state is your recents; ↑↓ / ⏎ /
      esc, captured at the window so the paper behind it never reacts. Commands (Dashboard, marked
      lists, tone, reindex) sit under the papers.
- [x] **Dashboard** — minutes today against a cycling target on the iris ring, day streak (a day
      counts at 10+ min), all-time banked, a 14-day strip with today as the live bar, the three
      mark counts as jumps into the library, up-next (recents and flags, minus what's done, with
      the time already put into each), and the index totals. Every number is measured; a fresh
      install honestly reads zero.
- [x] **AI-checker seam left open** — `src/lib/answerCheck.ts` holds the request/result/registry
      shape where scambridge's keyword matcher sat. No checker, nothing imports it, nothing has to
      be refactored to add one.
- [x] Fixed: every icon rendered as a filled black blob. A `<use>` clone inherits paint from the
      use site, not from the sprite's `<g fill="none" stroke="currentColor">`, so the whole set was
      unstyled — one rule in `index.css` now carries it.

## Phase 4 — Package (DONE ✅)
- [x] Name + identity: `productName` / window title `Foolscap`, identifier `com.foolscap.study`
- [x] **App icon** — generated, not hand-drawn: `npm run icon` renders the mark (the sidebar's
      folded page, one iris line on it, on the brand gradient) to a 1024px PNG and fans it out
      through `tauri icon`. `scripts/make-icon.mjs` is the source of truth, so it can be re-derived
      if the tokens move.
- [x] `tauri build` → Windows installers (NSIS + MSI)
- [x] Offline audit of the shipped bundle: no CDN, no font `@import`, no remote asset. Every
      `http(s)` string left in `dist/` is an XML namespace, a licence comment or a pdf.js XFA
      schema id — nothing is fetched. CSP stays `default-src 'self'`.
- [x] Fresh launch-test of the built release exe — starts, reads the existing index, renders the
      library, dashboard and a real paper in both tones
- [?] **Pull the network and confirm** — the static audit above is as far as this can be taken
      from here; the physical unplugged run is yours to do once.

---

## Phase 5 — Bell design system (DONE ✅)

Port the Figma design system in full: tokens, type, components, brand, every screen, the motion.
The app's visual layer is first-generation (purple iris accent, Schibsted + Plex Mono, "Foolscap");
the Figma file is now blue, named Bell, has a mascot, 115 variables, a rebuilt Dashboard, and
three screens the app has never had. Decisions locked: **all of it** · **SF Pro + Geist Mono** ·
**full rename + state migration** · **Settings behind a 5th nav item**.

### 5.0 Groundwork
- [x] Phase 5 written into this tracker
- [x] `SF-Pro.dmg` fetched and unpacked (dmg -> pkg -> Payload -> Library/Fonts)
- [x] **`Screen — Reader` found at page `194:35`** (Night `194:36`, Day `202:734`) and specced to
      `design/specs/screen-reader.md`. Zohaib was right that it exists; the earlier sweep was
      wrong, not the file
- [x] **`Screen — Bookmarks` `181:367`** (Night `181:368`, Day `202:1588`) and
      **`Screen — Recent` `181:723`** (Night `181:724`, Day `202:4278`) found and specced. Both
      are Library variants sharing the shell, differing only in the content region and which nav
      item is active — so promoting them from filters to screens is cheap
- [x] **All 14 design specs written to `design/specs/` — 5,887 lines**, measured off the file:
      tokens, foundations, controls, data components, icons (+ raw paths), Mr. Bell's 39-rect rig,
      the brand lockups, every screen, the update flow, the startup sequence and all twelve
      mascot animations. Everything downstream reads these instead of re-querying Figma
- [x] `screen-library-settings.md` re-run through `get_design_context` — 83 lines became 481, so the
      Settings frames are measured after all
- [x] Foundations read — `9:2` Colour, `11:2` Elevation & Glass, `12:2` Getting Started, all folded
      into `design/specs/foundations.md` (438 lines)
- [x] Component sets read — Button `22:47` · Chip `21:20` · Segmented `42:111` · Stat `24:5` ·
      Paper Card `66:359` · Nav Item `25:24` · Difficulty Meter `23:68` · Subject Icon `47:81` ·
      Season Icon `102:15` · Icon `17:119`, into `components-controls.md` + `components-data.md`
- [x] **Text-style count settled: 16 live, not 19.** `Title/Wordmark`, `Mono/Paper Code` and
      `Ink/Annotation` are all **deleted** — no node in the file references any of them, and Caveat
      appears as a font family on no node swept. So **Caveat goes**, and with it 104 KB of a 428 KB
      font payload that nothing ever rendered
- [x] Gradient paint styles harvested into `foundations.md`; `Blue/Primary Button 135` and
      `Blue/Line 90` are now `--grad-btn` and `--grad-line` in `tokens.css`
- [x] `@/` and `@ui/` path aliases in `tsconfig.json` + `vite.config.ts`

### 5.1 Fonts (DONE, bar one conditional)
- [x] SF Pro Text 400/500/600/700 + Display 600/700 subset to woff2 — 324 KB for six faces
- [x] Geist Mono 400/500/600 from the Vercel release (SIL OFL, licence vendored) — 36 KB
- [x] Schibsted Grotesk + IBM Plex Mono retired; `fetch-fonts.ps1` rewritten to reproduce all
      three acquisition paths (Apple dmg / GitHub release / Google CSS2)
- [x] `src/styles/fonts.css` regenerated — no `@import`, no remote origin, `tnum` retained,
      and the subset carries the punctuation this UI actually uses (· — ↑ ↓ ⏎ ♥)
- [x] SF Pro Expanded Bold instanced from `SF-Pro.ttf` at `wdth 132 / opsz 28 / wght 760` — used
      once, offline, to convert the wordmark to outlines. Not shipped as a webface
- [x] Drop Caveat and `--font-ink` now the style count is settled (5.0): both woff2 files, the
      `@font-face` pair, the token, the `@theme` bridge line and `.t-ink-annotation`. The payload is
      **344 KB for nine faces**, down from 448 KB — and nothing rendered the 104 KB that went

### 5.2 Tokens (DONE)
- [x] `scripts/tokens.mjs` + `npm run tokens` → generated `tokens.css`, `theme.css`, `type.css`.
      **72 tokens, 36 of them mode-paired.** Retuning one is a one-line edit and a re-run
- [x] Existing names kept — Figma's Code Syntax already declares `--ink`, `--card`, `--hair`,
      `--accent`, `--r-card`… so this was a value swap, not a rename
- [x] Added `--activity-0…4`, `--bell-cap-*`, `--bell-gold-*`, `--ground-veil`, `--traffic-*`,
      `--white`, `--plate`, `--scrim`, `--grad-line`, `--grad-btn`, and `--danger`/`--danger-soft`
      (an app addition — the design system has no danger token and `.err` was borrowing `--d5`,
      which mixes the difficulty axis into something that is not difficulty)
- [x] Fixed the duplicate `.bar` rule — the dashboard strip is now `.sbar`, so SetupView's two
      progress bars get their intended 4px height and accent fill back. Dead `.progline` deleted
- [x] Off-token colour swept: **24 raw literals down to 6.** `Sprite.tsx`'s gradient stops now
      read `var(--bell-cap-*)`, so the sidebar logo and both progress rings finally follow the
      tokens; the four aurora blobs, the traffic lights, `.err`, `.btn.primary`'s glow and both
      scrims are all tokenised. The six survivors are the two annotation-ink constants, two
      functional `#000` mask gradients, a neutral knob shadow and one directional sheet shadow
- [x] Fixed `body { background }` resolving Day in both tones — now `var(--plate)`

### 5.3 Type
- [x] `src/styles/type.css` generated — **20 classes**: the 16 live Figma styles plus the two
      documented off-ramp sizes (greeting 20, hero figure 26) and the mono paper code. Line heights
      are `normal`, because Figma reports AUTO and that means the font's own metrics, not 1
- [x] Every ad-hoc font size replaced with a ramp class as its view was rewritten in 5.7

### 5.4 Background (DONE)
- [x] `clouds` exported per tone and `blue_orb` for Day, straight from the file at 2× and
      converted to WebP: **24 + 35 + 22 KB for the whole background system**. Reproducing 46
      blurred lobes as DOM under the glass chrome would have been the wrong trade
- [x] `AppBackground.tsx` + `src/styles/background.css` — the two ambient blooms stay CSS
      (Figma's exact geometry) so they can be retuned without re-exporting; `veil` and
      `page recess` are CSS scrims, and the recess rides on `.main` so it tracks the sidebar and
      topbar instead of Figma's hard-coded (238, 56, 1082, 804)
- [x] The aurora A/B toggle is retired — state, `data-aurora`, the top-bar switch and its CSS.
      The background now applies to every screen, as the file does
- [x] Cross-fade the two cloud layers on tone change — both fields stay in the DOM and trade opacity,
      because `background-image` is not transitionable and the cut was the most visible thing on screen

### 5.5 Primitives (`src/ui/`) — BUILT, integrating
- [x] **30 components, 29 stylesheets.** Button · IconButton · Chip · Switch · SegmentedControl ·
      Stat · Meter · DifficultyMeter · DocBadge · SessionCode · Kbd · PaperCard · NavItem ·
      SectionLabel · SubjectRow · Card · CardRow · WindowLights · TonePill · SearchField ·
      UpdateNotice · Dialog · Ring · Notice · Rail · Field · ActivityGrid · CoverageMatrix, plus
      brand (Wordmark, Lockup, MrBellMark, MrBell) and icons (Sprite — 45 glyphs after Phase 6,
      SubjectIcon 17,
      SeasonIcon 3, GitHubMark)
- [x] `scripts/ui-css.mjs` + `npm run ui:css` generates `src/ui/ui.css`, imported after `app.css`
      so a primitive's rules win over the block it supersedes while the port is in flight
- [x] `@/` and `@ui/` path aliases in `tsconfig.json` + `vite.config.ts`
- [x] **Sidebar integrated** — 5 NavItems (Settings is the new 5th), SubjectRow with the real
      subject glyphs replacing the hashed `--iris-N` dots, Mr. Bell in the mascot slot, the dev
      footer with the ♥ and the GitHub mark. The old `.nav`, `.subj-row`, `.dot`, `.sidebar-foot`
      and `.av` blocks are gone from `app.css`
- [x] **TopBar integrated** — SearchField, TonePill (sun/moon + the 44×24 Switch), IconButton.
      `.search`, `.kbd`, `.icobtn`, `.tone` and the `spin` keyframe retired from `app.css`
- [x] MarkSchemeSheet's close control and the palette's three key caps now use the components
- [x] Two agents had reached for a `bell-` prefix while twelve did not; normalised
- [x] **Fixed the sidebar column collapsing.** The mascot slot and the dev footer had no height and
      the subject list ran off the bottom of the window. Cause was one token in `.app`:
      `grid-template-rows: 1fr` is `minmax(auto, 1fr)`, and that `auto` floor is the row's
      max-content contribution — so 34 subjects grew the row to ~1600px, `.sidebar { height: 100% }`
      resolved against *that*, and everything past 869px was clipped by the `overflow: hidden`.
      `minmax(0, 1fr)` floors it at the window, and the same fix gave `.main` its own scroll
- [x] Wire PaperCard · Chip · SectionLabel · DifficultyMeter into `LibraryView`
- [x] Wire Stat · Ring · Meter · ActivityGrid · CoverageMatrix into the Dashboard rebuild
- [x] Notice wired into all five `.err` call sites; `.err` retired from `app.css`
- [x] **Fixed a dev-server trap that had been swallowing CSS edits.** `index.css` pulled the whole
      stylesheet chain in with plain `@import`s, and the Tailwind plugin owns that file — so edits
      to `app.css` were never invalidated and the running app kept old rules while `npm run build`
      showed the new ones. Three rounds of "the change did nothing" before a 4px magenta probe on
      `.mascot` came back with zero magenta pixels. `main.tsx` now imports each stylesheet as a
      module in explicit order, and `ui-css.mjs` emits `src/ui/styles.ts` instead of a `.css` of
      `@import`s. `index.css` keeps only Tailwind's entry and `@theme`, which its plugin must own
- [x] `scripts/shot.ps1` + `npm run shot` — window capture for design comparison. Uses
      screen-grab rather than `PrintWindow`, because the glass surfaces are on their own
      compositor layers and `PrintWindow` intermittently returns the frame without them, which
      reads as "the sidebar vanished" when nothing is wrong
- [x] Card/CardRow into Settings
- [x] **`app.css` split, and mostly deleted.** `scripts/dead-css.mjs` asks the source which selectors
      no `.tsx` names — and its first version reported nothing dead, because every superseded block is
      described in prose in some comment, so the haystack matched its own documentation. Stripping
      comments from the `.tsx` side turned an empty report into 54 real hits, then 34 more after the
      first prune. **1,656 lines → 359 (`chrome.css`, the window shell) + 586 (`app.css`, leftovers
      awaiting a read-and-delete pass).** Zero visual change, verified by before/after diff on three
      screens. The 17 classes still reported all sit in rules that share a selector list with a live
      class or are scoped by a pseudo — the cases a script must not decide

### 5.6 Brand + mascot
- [x] `Wordmark` — SF Pro **Expanded** Bold 96 at −2% tracking, converted to outlines from the
      variable font at `wdth 132 / opsz 28 / wght 760`. Verified against the spec: B ink starts at
      x 0.534 (spec 0.531), cap line y 18.359 exact, ink width 185.75 vs 185.91 — 0.09%, well
      inside the 0.5% that would mean the width axis was wrong. Specs on/off
- [x] `MrBellMark` — 15 rects on the 4px grid, exact spec geometry
- [x] `Lockup` — horizontal 296×89 (mark 1.25× at (0,9), word at (100,0)) and stacked 196×200.
      Both use Specs=Off so the spectacles appear once, not twice
- [x] The sidebar's folded-page logo and the "Foolscap / working name" text pair are gone; the
      horizontal lockup sits there at 31px, the size Figma uses
- [x] **`MrBell`** — the 256×256 rig: nine pivot groups (`body`, two claws, `shell`, two eyes,
      `specs`, four leg groups with per-segment children), each carrying its Figma pivot frame's
      centre as its `transform-origin`, which is what makes the twelve animations possible
- [x] App icon re-derived from `MrBellMark` and regenerated at every size. Sampled the Figma
      `app icon` frame (`368:62`) rather than guessing: it is a **flat `--ground` Night tile**, no
      gradient and no cast, with the mark at 66/96 = 68.75% centred. That matters — the mark's
      claws and legs are `--bell-cap-lo`, so on the Primary button's gradient they would sit on
      their own colour and vanish. `scripts/make-icon.mjs` now shares its rect table with
      `MrBellMark.tsx`, so the installer icon is literally the same artwork as the sidebar mark

### 5.7 Screens — ten agents building in parallel, one file-owner each
- [x] `src/lib/store.ts` grew the two records the new screens write through: `settings`
      (tone choice incl. `system`, reduce motion, sat seasons, focus length + autostart, streak
      threshold, auto-update **off**) and `onboarding` (name, board, subjects, plan, done). Both
      read through a defaults merge, so a file written before a field existed still parses — and
      `settings.tone` seeds from the old lone `tone` key rather than resetting a real preference
- [x] **Routing rewritten in `App.tsx`.** The view union grew from four to seven — `library`,
      `bookmarks`, `recent`, `dashboard`, `reader`, `settings`, `onboarding` — and `setup` is gone:
      `SetupView.tsx` is **deleted**, its index and difficulty controls absorbed by Settings' Library
      card. `markFilter` survives underneath because `revision` is reachable from the palette and the
      dashboard without a nav row of its own, and a route change now settles the filter so the two
      cannot disagree. `tsc` clean, `cargo test --lib` 15/15, `vite build` green
- [x] **`onboarding.done` is inferred for an established install.** The flow is new, so nobody who
      has been using the app has the key — a bare `false` would have marched someone with 13,447
      indexed papers through "What should I call you?". Study state is the signal (marks, recents,
      banked minutes), not an index, because a fresh install pointed at `G:` builds one in seconds
- [x] Three Rust commands for Settings' Data card — `state_path`, `state_clear` (JSON keys only; the
      index is a rung up and is a rebuildable cache), `state_export` (Rust picks the location and
      validates the name, the frontend only words it). +2 tests
- [x] `sitting_totals` — question papers per `code/scode`. Without a denominator the coverage matrix
      could only ever read "partial"; `qp` rows only, because a mark scheme is not a thing you sit
- [x] `src/lib/updates.ts` — the update seam. Deliberately **not** the plugin: verifying a bundle
      needs a signing key that is Zohaib's to generate and a release feed to point at, and adding the
      dependency before both exist buys a plugin that fails at init. So it answers `not-configured`
      honestly, the palette hides the check entirely, and there is **no code path here that reaches
      the network at all** — which is how the offline guarantee stays true by construction
- [x] **`src/state/` — four hooks, and the views kept their props.** `usePrefs` (the two persisted
      records plus the resolved tone), `useLibraryIndex` (stats, subjects, the filtered query, both
      rebuilds), `useStudyState` (marks, recents, the snapshot-backed row list), `useUpdates` (the
      update machine and Settings' three data actions). `App.tsx` went **726 → 431 lines** and is a
      router again. The plan called for contexts; the views were **not** converted to consume them,
      because their authors wrote explicit documented `Props` and making those implicit would cost the
      documentation and the ability to test a screen alone — what moved is the logic, not the delivery.
      Verified by screenshot diff: every route pixel-identical apart from Mr. Bell, who is animating
- [x] Library restyle; Paper Card fluid in a 3-column grid; shadows unclipped
- [x] **Dashboard rebuilt** — days-to-exam hero, Stat tiles, the 53×7 activity grid, continue card,
      subject progress weakest-first, due for review, session coverage
- [x] `src/lib/sessions.ts` — CAIE exam windows. ~45 assertions run against it out-of-tree, all
      passing, including DST-crossing day counts cross-checked against a day-by-day walk
- [x] Bookmarks + Recent promoted from filters to routes, sharing the Library shell via a `mode`
      prop, with the snapshot-backed data path untouched underneath
- [x] Reader restyled; mark-scheme sheet; page pill; tool group
- [x] Reader gained the ink palette, stroke-width picker, opacity control and questions list
- [x] `Mark` extended with optional width and opacity; legacy ink keeps its stored literals and
      renders exactly as drawn
- [x] **Settings** — 7 groups over the 7/5 split, real controls, Chip rows not a segmented control
- [x] **Onboarding ×6**, replacing the empty-index → Setup guess
- [x] ⌘K palette restyled, with `screenCommands()` as the seam so the palette and the sidebar agree
      about what the app is made of. Capture-phase keys and the 90 ms debounce stamp guard intact
- [x] **Update notice + dialog**, wired to the seam above, manual by default

### 5.8 Motion
- [x] **The twelve Mr. Bell animations** — `idle` · `specs-push-up` · `periscope` · `lens-draw-on` ·
      `alarm` · `double-take` · `scuttle` · `hop` · `slump` · `sleep` · `glint` · `tone-handoff`.
      **62 keyframe blocks**, keyed off `data-anim`, every percentage `t ÷ duration` off the measured
      spec. `HOLD` steps are doubled stops, easings sit on the keyframe that OPENS their segment
      (Figma writes them on the one that closes it), and every angle is CSS-signed — Figma is
      CCW-positive. Verified by capture strip, not by reading: the periscope's stalks telescope with
      their feet welded to the shell, the specs ride up with the eyes, the right eye lags the left by
      60 ms, and sleep's Z glyphs rise and fade in turn
- [x] Three timelines needed art the master rig never had — hop's two dust puffs, sleep's two Z
      glyphs, glint's clipped streak. In Figma they are children of their own animation frame, so a
      still of Mr. Bell has never contained them; the app has one rig rather than twelve frames, so
      they live in it at `opacity: 0` and only their own mood animates them
- [x] Reduced motion: the OS media query and Settings' switch (`[data-motion='off']`) both collapse
      to the t=0 pose — **except `slump` and `sleep`, which hold their END pose**, because a slumped
      crab that snaps upright under reduced motion tells the user the wrong thing
- [?] **One divergence, and the only one in the file.** `lens-draw-on`'s 28 parts snap on in x order
      exactly as measured, but the file clears all 28 *together* at 1.68 s and this clears them in the
      same order they arrived. A shared absolute stop under a per-part delay is not expressible in
      CSS — a keyframe percentage cannot read `--x-order` — and the alternative is 28 hand-written
      keyframe blocks nobody can check against the spec. Say if the simultaneous clear matters more
      than the maintainability
- [x] **Tone crossfade.** A tone change swaps 36 mode-paired tokens at once and every one of them used
      to cut. `AppBackground` now keeps **both** cloud fields in the DOM and trades their opacities,
      because `background-image` cannot be transitioned and a hard cut on the largest surface on screen
      is exactly what you notice; Day's orb fades rather than being `display: none`d. The chrome then
      transitions in the order `Motion — Tone` `171:8` reveals it — ground and chrome first at
      0.28–0.32s, content behind them at 0.22s — and `color` on `.app` is the single declaration that
      stops the whole type layer snapping, since every label inherits from there
- [x] **Update notice + dialog sequences.** The dialog's scrim and panel now use the file's measured
      0.08 → 0.30 / 0.10 → 0.30 with the scale starting at **0.94**, not the 0.985 an earlier pass
      guessed — at 420×280 a 1.5% scale is invisible and it read as a straight fade. And the flick's
      three tempos: the file warns against sharing one animation across the notice, the dialog and the
      standalone, and measured they are the same shape at **0.689×** and **0.717×**, so `MrBell.css`
      exposes `--bell-flick` and each host sets one number instead of carrying two more keyframe sets
- [x] Startup splash + handoff (the one sanctioned colour transition: the wordmark resolves
      white → `--ink` mid-travel, finishing ahead of the app's fade-in). **App owns the timing floor**
      — the splash reports each phase from its own `animationend`, and a signal that never arrives left
      a transparent overlay at `z-index: 90` swallowing every click on an app that looked fine

### 5.9 Rename + docs
- [x] **Foolscap → Bell** across `productName`, window title, the bundle identifier, the Cargo
      package / lib / default-run, the crate references, `package.json`, `index.html`, the sidebar,
      SetupView's copy and every temp-path string
- [x] **First-run state migration** `com.foolscap.study` → `com.bell.study`, in `migrate.rs` with
      4 tests. Verified on the real data: all **9 state files** carried over — bookmarks, done,
      revision, focus minutes, recents, row snapshots, tone, and the 20 KB of annotation ink —
      plus the 4.2 MB index, which holds the parsed thresholds and every difficulty score. Copies
      rather than moves, never overwrites, and marks itself so it runs exactly once
- [x] `cargo test --lib` — 13 passing (9 existing + 4 for the migration)
- [x] **`CLAUDE.md` rewritten.** The old contract was wrong in most of its specifics — the whole
      token block, the purple accent, the three type roles, the aurora A/B section, the name. The
      new one records the five rules as the file states them (including the Primary button as the
      one sanctioned accent-as-fill), the generated-token discipline, the SF Pro optical split, the
      background stack, Mr. Bell's rig rules, the brand geometry, the activity grid's
      absolute-thresholds rule, and a blocklist that no longer bans the font we use

### 5.10 Verification
- [x] **`npm run audit`** — three static passes in `scripts/audit.mjs`, so none of this has to be
      redone by hand: **offline** (every remote string in `dist/` is an allowlisted namespace, licence
      or pdf.js placeholder — the allowlist names why for each), **contrast** (every ink on every
      ground it actually sits on, in both modes, composited through the alpha the token carries — a
      ratio against flat hex is wrong here, because `--card` is 90% opaque in Night), and **motion**
      (every animating stylesheet is reachable by a reduced-motion gate, and `MrBell.css` holds slump
      and sleep at their END pose rather than their first frame). All blocking passes green
- [x] **The audit caught its own wrong premise, which is the point of writing it down.** It first
      reported `--white` on `--accent` at 2.43 in Night and looked like a serious defect. Nothing ever
      paints white on `--accent`: the Primary button is filled with `--grad-btn`, whose two stops are
      mode-invariant. Corrected to test both real stops — and that surfaced a genuine defect the Figma
      file does not record (see the open calls)
- [x] **A wrong fact caught and corrected, in the brief rather than the code.** I told the sessions
      agent that "Feb/March is an IGCSE and O Level series only — A Level has no March sitting", and
      the audit pass measured the actual library and found **both halves backwards**. The index says:
      **A Level 77 Feb/March sessions across 8 of 10 subjects · IGCSE 108 across 11 of 11 · O Level
      zero, across all 13.** Verified independently against `index.sqlite3` after the fix. Worth
      recording because it is the failure mode a plausible-sounding brief produces, and only a pass
      that goes and measures catches it
- [x] `npx tsc --noEmit` clean · `cargo test --lib` 15/15 · `npm run build` green
- [x] **Token audit** — `npm run dead:css` plus the hex sweep. Raw colour in `src/` is down to the
      documented allowlist: Mr. Bell's deliberately-black spectacles, the two legacy annotation-ink
      constants, four functional `#000` mask gradients, the glint's raw white specular, the two raw
      lens colours the file picked by hand, and two neutral shadows in `app.css`
- [x] **Screenshot sweep, every route in both tones** — Library · Dashboard · Bookmarks · Recent ·
      Settings · Reader · Onboarding, driven through the real window with `npm run drive`. Two findings
      from doing it rather than assuming: the sidebar's **top bar is a Tauri drag region**, so a
      synthetic click there drags the window instead of pressing the tone pill (it moved the window to
      x −1880 before I noticed), and driving the live app **writes to the real state directory** — a
      stray press flipped `seasons` to a single series and turned auto-update on. Both are now warnings
      at the top of `scripts/drive.ps1`, and the state dir is copied aside before a sweep
- [x] Migration test — 4 Rust tests plus the real run: 9 state files and the 4.2 MB index carried
      across from `com.foolscap.study`, copies rather than moves, never overwriting, marked so it runs
      exactly once

### Open calls surfaced by Phase 5
- [x] **Mr. Bell's moods now have triggers — five of them, in `state/useMascot.ts`.** The Figma page is
      a mood library and specifies triggers for the update notice and dialog and nothing else, so these
      are app decisions, made and documented: **`alarm`** on the null → message edge of a real failure
      (an ingest error, a query that threw) · **`tone-handoff`** on every tone crossing, which is what
      §3.12 draws · **`double-take`** when he is poked · **`sleep`** after one idle minute · `idle`
      otherwise. The three one-shots are pulses that win while they run and fall back to the resting
      mood; sleep is a resting mood rather than a pulse, because a pulse that expired would wake him.
      Both edge-triggered moods fire on a TRANSITION, never a value — `error` stays non-null until
      something clears it, and `tone` has a value from the first render.
      Verified end to end by temporarily mapping the poke to `alarm` with a long hold: the capture shows
      both claws snapped up at 78° with the stalks at half a periscope and the specs riding with them,
      which is the pose the spec draws. Reverted after.
      Onboarding still owns its six, so those play once per install — **a Settings → About row that
      cycles all twelve is still unbuilt**, and it is the only way to see those six again without wiping
      your state
- [x] **Contrast: answered, and the answer is that there is nothing to decide.** The Figma file's
      Contrast frame records three deferred Day failures — `ink/3` **2.65** on ground, **3.00** on
      card, `accent/base` **4.44** on card. All three reproduce to two decimal places against the
      **first-generation** palette (`#8a8fa4` ink-3, `#5b63ea` accent) and none of them against the
      tokens the file now ships. The frame was measured before the Day ramp was darkened and the
      accent went blue, and nobody re-ran it. Current values: `ink/3` **4.62** on ground and **5.23**
      on card, `accent` **8.21** on card. The Day difficulty ramp moved the same way — `difficulty/1`
      was 1.80 as `#e8b248` and is **4.97** as the burnt `#8f6300`. **Every text pair in the system
      now passes 4.5 in both modes**, verified by `npm run audit`
- [?] **One real contrast defect, which the file does not record.** `--white` on the Primary button's
      *lighter* gradient stop (`--bell-cap-mid` `#2c7bff`) measures **3.90**, against the 4.5 its 13px
      Body/Strong label needs. Mode-invariant, so it is the same in both tones; the dark stop is fine
      at 8.78. Ported as drawn. Nudging the light stop to about `#1f6ae0` would clear it without
      changing the button's read — your call
- [?] **The activity grid's exam bands: true dates, or the file's pixels?** `sessions.ts` and the
      Figma drawing disagree, and it is arithmetic rather than taste. Computed Monday-start column
      spans for 2026 are **5 / 8 / 8** weeks for Feb-Mar / May-Jun / Oct-Nov; the file drew
      **5 / 7 / 7** and placed them at weeks 5 / 22 / 34 — but Oct 1 to Feb 20 is ~20 real weeks,
      not 17, and a 51-day window cannot fit in 7 week-columns (7 × 7 = 49). So the drawn bands are
      hand-placed decoration. Built from true dates, since `CLAUDE.md` frames the grid as a planning
      instrument; say if the drawing should win instead.
- [?] **Rule 3 vs the variables.** `Getting Started` says never retone difficulty between Day
      and Night, but `difficulty/1–5` *are* mode-paired (burnt in Day, bright in Night) and the
      screens render them that way. Following the variables; say if the rule should win instead.
- [?] **Tone vs the OS.** `Getting Started` says the toggle is product-level, "never
      prefers-color-scheme" — but the Settings screen ships a "Match system" chip. Building it
      as an explicit opt-in with the product toggle as the default.
- [?] **Annotation ink is now a palette, not two constants — this is a feature change.** The
      Reader comp gives the tools card six 22px ink swatches (`--iris-3` selected, `--iris-1`,
      `--iris-2`, and three more), a stroke-width picker (5 / 8 / 12 px) and an opacity slider at
      45%. Its own sample ink uses `--iris-3` @32% and `--d2` @30% for highlighter swipes and
      `--d5` / `--iris-1` for pen marks. **Neither `#2f4bbf` nor `#e8b248` appears anywhere.**
      So `PEN_COLOR` / `HL_COLOR` do not just get retuned, they stop being constants — and every
      annotation already on disk carries the old literals. Proposed: keep `mark.color` as the
      source of truth (it already is), add the palette + width + opacity controls, and leave old
      ink exactly as drawn. Confirm before 5.7 touches the Reader.

---

## Phase 6 — Notebooks (BUILT — verification below, a few open calls)

A student writes their own working, not just annotations on somebody else's paper. Named notebooks
with a chosen cover, opening on two facing pages that turn forever, saved locally as you write, able
to hold clipped screenshots of the papers you were just reading — and a tool surface that answers
Zohaib's *"i do not like the reader page at all... we have very basic and poor tools available in
reader"*. Decisions locked: **64px left dock + 268px 3-tab inspector** · **spiral bound** ·
**new mode-invariant `cover/1..8`** · **both screens + dialog + icons + spec + motion, no Reader
retrofit in this pass**.

### 6.0 Design in Figma — done, measured, audited
- [x] **15 new semantic tokens on 16 new primitives** — `cover/1..8`, `cover/shade`, `cover/label`,
      `cover/label-2`, `cover/wire`, `ground/scrim`, `state/danger`, `state/danger-soft`. Mode-pinned,
      scoped explicitly, Code Syntax set. `state/danger*` finally closes the gap that forced error
      styling to borrow `--d5`, which rule 3 forbids
- [x] **14 new icons** into `Icon` `17:119` — pencil, lasso, shapes, text, image, clip, sticky,
      ruler, pan, redo, right, plus, trash, dots. Sheet 430x210 to **430x302**, 31 to **45** glyphs
- [x] **4 new components** — `Notebook Cover` `606:50` (16 variants), `Panel Tabs` `618:24`,
      `Slider` `613:3`, `Text Field` `619:11`; plus `Icon Button` `20:12` gains `State=Active`.
      Slider and Text Field close two long-standing gaps: the file had no draggable control and
      no input at all
- [x] **`Screen — Notebooks` `620:2`** — Night `620:507`, Day `620:1377`, Empty `629:859`.
      Sidebar goes to five nav rows; eight real notebooks on a 4x2 shelf, no lorem
- [x] **`Screen — Notebook` `631:2`** — Night `631:1045` (Tool tab), Day `631:1144` (Pages tab),
      `inspector — notebook tab` `649:172`, plus the `New Notebook` dialog in both tones
      (`653:1263` / `653:1362`). Both pages carry real 9702 working, including a clipped exam
      question and a **live lasso selection over a stroke group** — the object model, drawn
- [x] **`Motion — Notebook` `662:1217`** — `cover open` 1.1s / 21 tracks, `page turn` 0.45s /
      8 tracks. No page curl: every track is transform or opacity, so both port 1:1 to CSS
- [x] **Audit clean** — zero unbound paints and zero raw text-segment fills on all ten frames;
      Colour mode pinned and verified on every one
- [x] **`design/specs/screen-notebooks.md` — 712 lines**, plus five spec files updated:
      `icons.md`, `icons-paths.md` (14 `<symbol>` blocks), `components-controls.md`,
      `components-data.md`, `foundations.md`
- [x] Four design bugs found and fixed while speccing: the cover bound raw Primitives and its meta
      line **failed 4.5:1 on covers 2/3/4** (white 74% to a new `alpha/white-84`); the dock's `pen`
      button rendered the `search` glyph; the new primitives carried picker scopes; and
      `Ink/Annotation` was recorded as deleted when it had never been deleted
- [ ] Follow-up, small: the 15 new tokens are not swatched on `9:2` Foundations — Colour
- [x] **Design sign-off from Zohaib** — cleared. Everything below is code; the Figma file was not
      touched again

### 6.1 Storage — `src-tauri/src/notebooks.rs` (new module, NOT the state dir) — DONE
- [x] `<app_data_dir>\notebooks\index.json` + `<id>\meta.json` + `<id>\history.json` +
      `pages\NNNN.json` + `assets\<sha256>.png`; id is app-generated `^[a-z0-9]{16}$` so a typed name
      never reaches a path. `.tmp` then rename on every write, as `state_save` already does
- [x] Why not `state.rs`: `state_load` slurps **every** `*.json` in the state dir into memory before
      first render, and one measured ink file is already 66,673 bytes for a single page
- [x] **13 commands** — the eleven planned plus `nb_history_load` / `nb_history_save`, which 6.2's
      "persisted command stack" needs somewhere to live. `history.json` is a fifth file kind, not in
      the original layout; recorded here rather than folded into `meta.json`, because mixing the
      authored config with a churny undo log in one file is how both end up rewritten on every stroke
- [x] `index.json` is a **rebuildable cache**, not a second source of truth. `nb_list` reads it, then
      overlays `pages` and `bytes` from the filesystem and reconciles both ways — a directory with a
      readable `meta.json` and no index row is adopted, a row whose directory has gone is dropped.
      Same posture as `downloads::repair`; losing the cache costs a walk, not a notebook
- [x] Infinite pages = `1 + max(page file stem)`, **rounded up to a whole spread and floored at 2**
      (a notebook always has one leaf, and a page count must be even or the last spread is half a
      leaf). A new spread reaches disk on its first stroke
- [x] Save policy: per-page dirty flag, 400ms debounce, flushed on page turn, blur and unmount, in
      `src/state/useNotebook.ts`. An emptied page is **deleted** rather than written as an empty
      record — the count is `1 + max(stem)`, so an empty file would keep claiming a page
- [x] Assets are magic-byte validated as PNG before they are stored, the way `downloads.rs` validates
      a PDF; `src/lib/clip.ts` re-encodes any pasted JPEG/WebP through a canvas so that holds
- [x] `cargo test --lib` — **26 passing, 2 ignored** (was 20/2). Six new: id validation, the derived
      page count, index self-heal, a full round trip, and **a catalogue resync plus `reset_app`
      leaving `notebooks\` untouched byte for byte**
- [?] `nb_export` copies the notebook (meta, pages, assets) into `<app data>\exports\<name>`. It is
      **not a PDF**, and §6c's button says "Export PDF". A real PDF means a new Rust crate or a
      hand-assembled file over rasterised pages; the honest half ships and the button says what it
      does. Say if the PDF matters and it becomes its own task

### 6.2 Stroke engine — `src/lib/ink.ts` — DONE
- [x] Three canvases per page (`paper` / `static` / `live`), rAF-coalesced through `createInkLoop`,
      `getCoalescedEvents()` so a 240 Hz pen is not decimated to compositor rate
- [x] `e.pressure` normalised (a mouse reports a constant 0.5, and several pens report a literal 0 on
      their first event — `perfect-freehand` treats 0 as valid and lands a zero-width nib), plus
      `e.pointerType` and an `e.isPrimary` / pen-owns-the-surface guard for palm rejection
- [x] `perfect-freehand@1.2.3`, exact, MIT, **no dependencies** — the offline audit stays green
- [x] Object model with an id-keyed bbox cache and real hit-testing: point-to-polyline for strokes,
      even-odd point-in-polygon for the lasso. Lasso can move / scale / recolour / duplicate / delete
- [x] Eraser gets two modes: `stroke` (a real edit, and the bytes go) and `paint` (today's
      `destination-out`, kept for highlighter clean-up). `stroke` is the default, because paint-only
      erasing never reclaims ink — the erased strokes stay AND the eraser strokes pile on top
- [x] Command stack — six commands, notebook-wide, **persisted** to `history.json`, depth 200, a pure
      reducer so StrictMode's double-invoked updater cannot double-push. `transform` keeps the records
      as they *were* plus the affine rather than inverting it, because geometry is quantised on write
      and an inverted scale drifts
- [x] Geometry as fractions of the page box, 4 dp, never pixels. `x`/`w`/`sw` are width-fractions and
      `y`/`h` height-fractions, so every distance runs in an isotropic space — without that correction
      a hit tolerance is 1.4x tighter vertically
- [x] **A test runner, since there was none.** `npm test` → `scripts/test.mjs`: Node's own `node:test`
      with esbuild bundling the TypeScript, so it adds no dependency and the `@/` alias works.
      **115 assertions across `tests/ink.test.ts`**

### 6.3 Screens and routing — DONE
- [x] `View` union gains `notebooks` + `notebook`; **six** sidebar rows, Notebooks inserted second per
      §4a. Mr. Bell is not cut — the column is flexbox with the mascot slot as the flex spacer and he
      is bottom-pinned, so a sixth 38px row shrinks the slot rather than moving him (TRAP 16)
- [x] The open spread is its own `app-bare` shell with **no sidebar**, because §5a puts the window
      lights inside the notebook's own 1320-wide topbar — which is only possible if nothing else owns
      them. Onboarding is the precedent
- [x] `src/views/NotebooksView.tsx` (`nb-`) + `src/views/NotebookView.tsx` (`nbs-`)
- [x] `ToolDock.tsx` · `Inspector.tsx` (`nbi-`) · `NotebookPage.tsx` · `NewNotebookDialog.tsx` ·
      `ClipPicker.tsx` · `src/ui/NotebookCover.tsx` · `src/lib/notebooks.ts` ·
      `src/state/useNotebook.ts` + `useNotebooks.ts`
- [x] `src/ui/Slider.tsx` + `src/ui/PanelTabs.tsx`, then `npm run ui:css`. The Slider is a native
      `<input type="range">` painted through its `::-webkit-slider-*` pseudo-elements, so keyboard,
      pointer capture and the accessibility tree come for free
- [x] `Icon Button` gained the real `State=Active`, and **the Reader's hand-fill is retired** — its
      active tool now inherits `--accent-soft` plus the 1px inset `--accent` ring from the component,
      and its glyph stops being forced to `--accent` (§5: an accent fill and an accent glyph and an
      accent line is three signals for one state)
- [x] 14 glyphs + `sun` and `moon` into `src/components/Sprite.tsx` and the `IconName` union — **45
      names**. `src/ui/icons/Sprite.tsx` was imported by nothing and is **deleted**; the duplicate
      sun/moon paths inlined in `TonePill.tsx` and `SettingsView.tsx` are gone with it
- [x] 15 tokens into `scripts/tokens.mjs`, then `npm run tokens` — **106 tokens, 36 mode-paired**.
      The twelve `--cover-*` are emitted once, in `:root`, because a cover is an object and must not
      invert. `scripts/audit.mjs` grew 17 pairs and every one passes
- [x] **`--scrim`, `--danger` and `--danger-soft` were app guesses and now carry Figma's values.**
      The visible change is `--danger`: a ~35° hue shift, rose-crimson to brick red in Day and pink to
      coral in Night, across every `Notice`, the destructive dialog button and `.set-danger`. Contrast
      on `--card` goes 7.18 → **6.11** in Day and 4.70 → **5.46** in Night, so both still clear 4.5
- [?] **The spread's page numbers carry a +2 display offset**, and that is what makes every figure the
      file draws come out right: Figma shows `pages 12-13`, lists `Spreads 2-3 … 18-19` and prints
      `48 pages`, so a left page is always even and the first leaf is pages 2 and 3 — as a bound
      notebook whose cover is leaf one behaves. Disk indices stay 0-based. Say if the first spread
      should read `1-2` instead; it is one constant

### 6.4 Images and the Reader clip — DONE, and built first
- [x] Ctrl+V a screenshot — needed nothing; the CSP already allows `img-src 'self' data: blob:`
- [x] Drag-and-drop — `dragDropEnabled` flipped false → **true** at `tauri.conf.json:25`
- [x] **Clip a region of a paper** — a marquee over the already-rendered pdf.js canvas, `drawImage`
      the crop, `toBlob`, `nb_asset_put`. No OS capture API, no new plugin, no new permission. Both
      layers are composited, so a clip keeps the highlight that is half the reason for keeping it
- [x] "Clip to notebook" in the Reader topbar (the new `clip` glyph) + a destination picker. The
      picker asks for a notebook and nothing else: a clip goes where your working goes, and
      `placeImage` puts it under whatever is already on that page, spilling to the next one if there
      is no room — which is the infinite-pages promise doing something useful rather than merely being
      true. The armed mode stays armed for several clips, then says where each one landed with a
      "Go there" that opens the notebook at that page
- [x] Clips are capped at 1600px on the long edge — a full page at 2.1x zoom on a 2x display is
      ~3000px and several MB of PNG for something drawn 340px wide

### 6.5 Motion port — DONE, with one divergence
- [x] `page turn` — all 8 tracks, 0.45s, every percentage `t ÷ 0.45`. **The coils never move**: they
      are the pivot. The file pairs `SCALE_X 1 → 0.02` with `TRANSLATION_X -222.95` and its own note
      explains that the translate exists only to undo Figma's centre-origin, so the CSS says it
      directly with `transform-origin` on the binding edge — exact rather than compensated. The
      outgoing leaf stays mounted for the turn, because the timeline crossfades one page into the next
- [x] `cover open` — ported **from 0.45s onward**, all 13 of the tracks that live inside this route,
      including the save dot popping last on a back-out curve
- [?] **The hero cover's flight across the shelf (0 → 0.55s: +170.5 / +149.5, scale 1 → 1.9) is not
      ported.** It is a shared-element transition between two routes and needs the pressed tile's rect
      threaded through the router; the file has the cover cross-dissolving into the spread at 0.55
      anyway, so what the eye follows from 0.45 is intact and the spread's own entrance stands in for
      the dissolve. Say if the flight matters
- [x] Both timelines gated by `prefers-reduced-motion` **and** `[data-motion='off']`, so the Settings
      switch works too — `npm run audit`'s motion pass fails the build otherwise
- [?] **Focus mode does not give the spread all 1320**, as §5a says it should. The dock and the
      inspector recede on transform and opacity and the spread holds its place, because widening the
      stage means animating `grid-template`, which the design system forbids. Precedented: the
      Reader's focus mode made the same call for the same reason and it is documented there
- [?] **The spread's handwriting is not Caveat.** §5d draws the pages in `Ink/Annotation` (Caveat 18),
      and in the app the strokes ARE handwriting — they are the student's own pen. What is not is the
      `text` tool and the sticky note, which render in `--font-ui`, because Caveat was dropped from the
      font payload in 5.1 and re-vendoring it is 104 KB plus a network step. Say if the sticky should
      be handwritten and `npm run fonts` picks it back up

### 6.6 Verification
- [x] `npm run build` green · `npx tsc --noEmit` clean · `cargo check --bins` clean
- [x] `npm run audit` — **all blocking passes green.** Offline: 6 bundled files, every remote string
      allowlisted, so `perfect-freehand` changed nothing. Contrast: the 17 new pairs all pass, and the
      only two below threshold are the pre-existing `--white on --bell-cap-mid` rows the Figma file
      already defers. Motion: 13 animating stylesheets, every one gated
- [x] `npm run dead:css` — 0 new dead classes. The 17 still reported in `app.css` are the pre-existing
      ones that share a selector list or sit behind a pseudo, which a script must not decide
- [x] `cargo test --lib` 26 pass / 2 ignored · `npm test` **136 pass** across `ink.test.ts` and
      `notebooks.test.ts`
- [x] **The whole loop driven end to end in headless Chrome against the real dev server**, with the
      notebook commands stubbed by an in-memory store that derives `pages` and `bytes` the way Rust
      does — so a wire-shape mismatch would have failed there. Verified by doing rather than reading:
      six sidebar rows with Mr. Bell **160x160, ending 48px clear of the sidebar's bottom edge**
      (TRAP 16, answered) · the empty state · the dialog at exactly **520x422** with its preview at
      **160x203** (spec 202.5) · create → land in the spread at **936x644**, no sidebar, 12 dock
      buttons, 3 tabs · draw on both pages → two page files, real 4 dp geometry with normalised
      pressure, history depth 3 · Ctrl+Z deletes the emptied page file and Ctrl+Shift+Z restores it ·
      turn three spreads past the end → `pages 8-9`, `next` still enabled, **no prompt of any kind**,
      and a stroke there writes `pages/0007.json` · Ctrl+V an image → `nb_asset_put` then the object on
      the page · all three inspector tabs · the tone crossfade · back to a shelf whose subline reads
      "1 notebook · 2 pages written · stored on this device", every figure measured
- [x] Two defects the run caught, both now fixed: the topbar's `back` sat 12px right of §5a's x 78
      (flex gap, cancelled once on the lights), and **a paste that could not be decoded was silently
      swallowed** — a no-op indistinguishable from a press that was never noticed. It now says so
- [?] **`npm run tauri dev`, and the physical quit-and-relaunch, are yours.** The storage layer's
      persistence is covered by `notebooks::tests::a_notebook_round_trips_through_the_filesystem`
      (write, then re-read every field including the derived ones) and the frontend's use of those same
      commands by the headless run above — but the two have not been joined by an actual process
      restart, because `scripts/shot.ps1` grabs the screen rather than the window and cannot drive the
      Tauri build reliably. Same posture as Phase 4's "pull the network and confirm"
- [x] **A documented fact corrected while porting.** `WorkspaceView.css`'s header and the Phase 6 plan
      (§2.5 trap 1) both state that a view's stylesheet loads BEFORE `app.css` and `src/ui`. Measured
      off the built bundle, the byte offsets run chrome.css → app.css → ui/styles → **view CSS last**,
      in the dev server and the production build alike. So a view sheet wins a tie, and the couple of
      rules written extra-specific to "beat a later sheet" never needed to be. The `rd-` / `nb-` /
      `nbs-` / `nbi-` prefixes stay regardless — they are what stops the question arising

---

## Verification commands
- `npm run verify:index` — walk G: and report the index shape (Rust, throwaway DB)
- `npm run verify:thresholds [code] [cap]` — parse real `gt` PDFs, show accepted/rejected rows
- `npm run verify:difficulty [code|all]` — ported formula vs. the original, plus the distribution
- `npm run verify:papers [code|all] [cap]` — open real question papers, check page counts
- `cargo test --lib` (in `src-tauri`) — 26 tests, 2 ignored: path parsing, three-levels-only walk,
  the paper, search and difficulty SQL, the read sandbox, state-key safety, the Foolscap→Bell state
  migration, and notebook storage (id validation, the derived page count, index self-heal, a round
  trip, and a resync leaving `notebooks\` untouched)
- `npm test` — the JS unit tests. `node:test` + esbuild, no new dependency. `src/lib/ink.ts` and the
  page arithmetic in `src/lib/notebooks.ts`
- `npm run fonts` — re-vendor the woff2 faces (the only step that needs network)
- `npm run icon` — re-render the app icon and regenerate every size

## Open calls for Zohaib (not blocking — sensible defaults chosen)
- [x] **Name.** Answered: **Bell**. Lands in Phase 5.9 — `productName`, window `title`, the
      bundle identifier `com.bell.study`, the crate, the icon and every UI string, plus a
      first-run copy of the old state dir so bookmarks, marks, focus minutes and ink survive.
- [x] **Aurora.** Answered by the Figma file: the background stack applies to every screen,
      dialled down by the `veil` and `page recess` scrims rather than restricted to the library.
      The `data-aurora` toggle retires in Phase 5.4.
- [?] **Tone.** Both ship via the toggle, default Day. The choice persists per install.
- [?] **Timer autostart.** Opening a paper starts the focus timer, on the theory that you opened
      it to work. Pause is one click. Say if you'd rather it waited.
- [?] **Streak threshold.** A day counts at 10+ focused minutes. Arbitrary but stated in the UI;
      one constant in `DashboardView.tsx` if you want it stricter.
- [?] **Corrupt file.** `0610_s19_gt.pdf` won't open in any reader, so that one IGCSE Biology
      sitting has no difficulty score. A data gap, nothing to fix in code.
- [?] **`bell-mascots/` + `media/`.** Untracked mascot exploration (crabby / hat / spectacles),
      referenced nowhere in `src/`. Say whether it becomes part of the product — onboarding and
      empty states are where the design contract allows a lush render — or stays provenance.
