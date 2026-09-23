# Bell Design System v2 — build progress ledger

Durable status for the v2 redesign. Spec: `F:\Downloads\Bell_Design_System_v2_Engineering_Handoff.md`.
Branch: `design-system-v2` (off `main` @66150bf). Land as staged sub-PRs per phase. Keep the app
building & runnable at every commit — each increment builds, runs, is committed.

## Strategy
Parallel token migration: v2 tokens/type/theme introduced ADDITIVELY alongside legacy; screens ported
phase-by-phase; legacy vocabulary deleted at the end (Phase 8). Shared semantic names (accent, danger,
fonts) adopt v2 values now, so legacy screens shift slightly toward v2 during transition (intended).
Internal tone enum stays `day|night|system`; DOM gets `data-theme=light|dark` alongside `data-tone` —
no persisted-settings migration needed.

## Decisions
- Sans = **Geist** (400/500/600/700 vendored; Geist Mono unchanged; SF Pro retained for un-ported
  screens, removed in Phase 8).
- Difficulty keeps the website Sky/Amber/Rose (product rule), routed through tokens not inline hex.
- Bell mascot stays for onboarding/empty/milestones; leaves the persistent sidebar (v2 §16).
- Keep-and-fold Community Resources + local Workspace into the new IA.

## Phase status
- [x] **Phase 1 — Foundations (tokens + theme + type + fonts + audit).** DONE. v2 colour/surface/text/
  border/status + spacing/radius/control/icon/motion tokens; `.app[data-theme='dark']` block; Geist
  vendored + `--font-ui/-disp` repointed; accent/danger → v2; 7 v2 `.t-*` roles (legacy retained);
  `data-theme` on all shells; audit reads dark block + v2 contrast pass. `npm run build` green.
- [x] **Phase 2 — Primitives.** DONE (`f139984`). src/ui/v2/: Button, Checkbox, Input, Table,
  Popover, Menu, Tooltip, Toast (Provider+useToast), Badge, Skeleton, Spinner, SegmentedControl +
  CONVENTIONS.md. Whole set typechecks; motion gated (no new audit failures). Select/Combobox and
  table virtualization deferred to Phase 4 (Library-coupled).
- [~] **Phase 3 — Shell.** Components DONE (`7cac532`): src/components/v2/ AppShell (grid: topbar +
  resizable sidebar + docked/drawer inspector, ResizeObserver responsive per §5), NavSidebar +
  navConfig (config-driven §3 IA, collapsible rail, accent-tint selection), Inspector (reusable
  right-panel frame). Whole project typechecks + builds. **REMAINING: the live cutover** — mount
  AppShell in App.tsx, move the tab/view dispatch + WindowLights + palette into it, retire the legacy
  glass shell (chrome.css) for migrated routes. Large + risky (App.tsx is a big tab state machine);
  do it as its own PR and keep the app runnable throughout.
- [x] **Phase 4 — Library reference impl.** Screen + preview DONE (`cc803d0`, `1a5e935`) and
  **visually verified** via headless screenshot. src/views/v2/LibraryView (props-driven §9: v2
  Table<PaperRow>, search/sort/filter, multi-select + contextual toolbar §9.5, difficulty pills via
  difficulty.ts, Status badges §17, overflow Menu, empty state) + PaperInspectorBody (§10) + a
  LibraryPreview harness with real CAIE rows, mounted at `?v2lib` (code-split). Renders cleanly:
  flat/dense, Geist, website Sky/Amber/Rose difficulty, docked inspector with grade thresholds +
  files + Open action.
  POLISH TODO (non-blocking): at narrow main width (inspector open) the first column header shows
  "SCode" and the subject name drops — tidy the responsive column behaviour during cutover. Table
  virtualization + a real Select/Combobox for filters still to add when wired to the live catalogue.
- [ ] **Phase 4b / cutover — wire the v2 Library + shell into the live app** (behind a flag first),
  feeding real catalogue rows from useLibraryIndex; then retire LibraryView (legacy).
- [x] **Phase 5 — Command palette + keyboard.** DONE (`722f464`, wired in `b91defb`). v2 CommandPalette
  (⌘K, grouped go-to + actions, arrow/enter/esc, focus trap, portalled). Context menus exist as the
  `Menu` primitive; per-screen right-click menus are a later nicety.
- [x] **Phase 6 — Feature flows.** DONE (`b91defb`) + **assembled into a live `?v2` app**, screenshot-
  verified light & dark. Analytics (§15 charts), Home, Practice (§14), Collections (§13), MyStuff
  (bookmarks/downloads/history), Library — all on the v2 shell via `V2App` (nav routing + palette +
  toasts + paper inspector). Sample data. Notebooks/Settings/Help are placeholders (keep legacy).
- [~] **Phase 7 — Hardening.** PARTIAL. Screens carry loading/empty/selection states; reduced-motion
  is honoured (all v2 CSS gated; a global sweep covers legacy). Remaining: real offline/sync/error
  wiring (needs real data), fuller a11y/perf pass, and the 5 legacy motion-lint files (runtime-safe
  via the global sweep — lint-only, deferred).
- [~] **Phase 8 — QA + enforcement.** PARTIAL. Audit now fails on raw hex in the v2 layer (`9ee93f8`,
  passing) + the v2 contrast pass. **NOT done — and gated:** flipping the default to v2 and deleting
  the legacy tokens/glass/SF Pro/background stack. That cutover is only safe once v2 reaches real-data
  parity (real catalogue + study state, the PDF reader, Notebooks, Settings, onboarding, star gate,
  pets) — the `?v2` app is a verified reference on SAMPLE data, not yet a feature-complete replacement.

## Known pre-existing issues (NOT introduced by v2 work; resolve in owning phase / Phase 7)
- `npm run audit` motion pass flags 5 files lacking a per-file reduced-motion gate: PdfThumbnail.css,
  SideResizeHandle.css (P3), FilterDropdown.css (P2), CommunityReaderView.css, LocalWorkspaceView.css
  (P6). Runtime is safe — chrome.css carries a global `*` reduced-motion sweep incl.
  `animation-duration: 0.01ms` — so this is lint debt, not a real a11y hole.
- Contrast (report-only, matches the handoff's own hexes; revisit in Phase 8 QA): light `--text-tertiary`
  on canvas 3.34, light `--warning` boundary 2.81, light `--danger` text 4.11 (all just below). Dark
  mode passes throughout.

## Resume pointer
**Phases 1–6 + the command palette are built, committed, pushed, and the whole v2 app is assembled
and screenshot-verified live behind `?v2`** (`npm run dev` → `http://localhost:1420/?v2`; also
`?screen=<id>` and `?theme=dark`). Draft PR #8. `npm run build` green. The v2 layer is token-only
(audit-enforced).

**The remaining real work is the CUTOVER, and it is gated — not skipped.** The `?v2` app runs on
SAMPLE data and covers the reference screens; it is NOT yet wired to the real catalogue/study state,
the PDF reader, Notebooks, Settings, onboarding, star gate, or pets. To finish Phases 7–8 honestly:
(1) wire V2App's screens to the live hooks (useLibraryIndex, store.ts, the reader) behind the flag;
(2) build v2 Notebooks/Settings/onboarding to parity; (3) then flip the default and delete the legacy
tokens/glass/SF Pro/background stack (Phase 8) — never before parity, or shipped features regress.
Nothing is half-edited; the live app still runs on the legacy shell.
