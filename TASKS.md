# Foolscap — build tracker

Working name: **Foolscap** (placeholder; rename is cheap — see "Open calls" below).
Plan of record: `C:\Users\Evo\.claude\plans\hi-claude-i-wanna-foamy-kettle.md`
Design contract: `./CLAUDE.md`

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
- [x] Rust ingest walks `G:\CambridgeDatabase` → SQLite. **G: is read-only — never written to.**
      Verified: **13,447 docs · 34 subjects · 886 sessions · 0 skipped · 0.3s**
- [x] Threshold parser ported; the pdf-parse → pdf.js line reconstruction risk is **closed**
      (585/585 rows accepted, full A–E curves)
- [x] Difficulty formula ported and verified against the original module over the whole library:
      **6,134 sittings · 472/472 identical · p25 25 / median 50 / p75 75**
- [x] Library grid reads real papers + difficulty out of SQLite

## Phase 3 — Core screens  [~]
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
- [ ] Dashboard: focus minutes / streaks / up-next / done / revision (the timer is now banking
      real minutes, so this can be built on measured data)
- [ ] ⌘K command palette (port from scambridge)
- [ ] Done / revision marking on the card, alongside bookmarks
- [ ] Leave the clean AI-checker seam where the old keyword checker sat

## Phase 4 — Package  [ ]
- [ ] Set final productName / identifier / window title / app icon
- [ ] `tauri build` → Windows installer (MSI/NSIS)
- [ ] Fresh launch-test; pull the network and confirm full offline operation

---

## Verification commands
- `npm run verify:index` — walk G: and report the index shape (Rust, throwaway DB)
- `npm run verify:thresholds [code] [cap]` — parse real `gt` PDFs, show accepted/rejected rows
- `npm run verify:difficulty [code|all]` — ported formula vs. the original, plus the distribution
- `npm run verify:papers [code|all] [cap]` — open real question papers, check page counts
- `cargo test --lib` (in `src-tauri`) — 8 tests: path parsing, three-levels-only walk, the paper
  and difficulty SQL, the read sandbox, state-key safety
- `npm run fonts` — re-vendor the woff2 faces (the only step that needs network)

## Open calls for Zohaib (not blocking — sensible defaults chosen)
- [?] **Name.** Proceeding as "Foolscap". Display name is the sidebar wordmark + `tauri.conf.json`
      (`productName`, window `title`); the bundle identifier/crate rename is a ~4-file change
      before Phase 4.
- [?] **Aurora.** Baseline stays frame-and-line; the soft bloom is reserved for the library grid
      and setup. Ships defaulting ON so you can keep judging it — toggle is in the top bar.
- [?] **Tone.** Both ship via the toggle, default Day. The choice persists per install.
- [?] **Timer autostart.** Opening a paper starts the focus timer, on the theory that you opened
      it to work. Pause is one click. Say if you'd rather it waited.
- [?] **Corrupt file.** `0610_s19_gt.pdf` won't open in any reader, so that one IGCSE Biology
      sitting has no difficulty score. A data gap, nothing to fix in code.
- [?] **Not a git repo.** `C:\ShinyPapersDesktop` isn't under version control yet.
