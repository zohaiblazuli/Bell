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
- [ ] **Phase 2 — Primitives.** Build Checkbox, Popover, Table, Toast, Menu/context-menu; harden Field
  (disabled/error), Select/Combobox, Tooltip (positioned), Skeleton. src/ui/*.
- [ ] **Phase 3 — Shell.** AppShell extraction, resizable+collapsible sidebar, shell-level inspector,
  responsive breakpoints (§5), config-driven nav, opaque surfaces + 1px separators.
- [ ] **Phase 4 — Library reference impl.** DataTable (sticky header, selection, resize, virtualization),
  filter popovers, contextual selection toolbar, paper inspector.
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
Phase 1 committed. **Next: Phase 2 — primitives.** Start with the missing ones (Checkbox, Popover,
Menu, Toast, Table) as v2 components in src/ui using v2 tokens; then harden Field/Select/Tooltip/Skeleton.
