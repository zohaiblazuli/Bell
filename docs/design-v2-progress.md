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
- [ ] **Phase 4 — Library reference impl.** Build a v2 Library screen wired to the real catalogue
  (useLibraryIndex + PaperRow): the v2 Table (add virtualization + column resize here), filter
  popovers (build Select/Combobox on Popover), contextual selection toolbar, and the paper Inspector.
  Can be built as a new screen first, then swapped for LibraryView.
- [ ] **Phase 5 — Command palette + context menus + keyboard system** (§11/§12).
- [ ] **Phase 6 — Feature flows.** Practice/Review, Collections, Analytics, Notebooks refresh; fold in
  Community Resources + local Workspace.
- [ ] **Phase 7 — Hardening.** Offline/sync/errors/a11y (WCAG 2.2 AA)/perf (§19-21).
- [ ] **Phase 8 — QA + enforcement.** Extend audit to forbid off-token hex; delete legacy tokens/SF Pro/
  glass/background stack; motion + theme QA.

## Known pre-existing issues (NOT introduced by v2 work; resolve in owning phase / Phase 7)
- `npm run audit` motion pass flags 5 files lacking a per-file reduced-motion gate: PdfThumbnail.css,
  SideResizeHandle.css (P3), FilterDropdown.css (P2), CommunityReaderView.css, LocalWorkspaceView.css
  (P6). Runtime is safe — chrome.css carries a global `*` reduced-motion sweep incl.
  `animation-duration: 0.01ms` — so this is lint debt, not a real a11y hole.
- Contrast (report-only, matches the handoff's own hexes; revisit in Phase 8 QA): light `--text-tertiary`
  on canvas 3.34, light `--warning` boundary 2.81, light `--danger` text 4.11 (all just below). Dark
  mode passes throughout.

## Resume pointer
Phases 1–2 complete and integrated (foundation + full primitive library, both building & committed).
Phase 3 shell COMPONENTS built & committed but NOT yet cut into the live app — App.tsx still renders
the legacy glass shell, so the app builds and runs unchanged. **Next: the Phase 3 live cutover**
(mount `@/components/v2/AppShell` in App.tsx), then Phase 4 (v2 Library). Nothing is half-edited; each
phase is its own commit on `design-system-v2`. Legacy tokens/glass/SF Pro are still present and are
removed in Phase 8. `npm run build` is green; `npm run audit` has only the pre-existing motion-lint +
report-only light-contrast items noted above.
