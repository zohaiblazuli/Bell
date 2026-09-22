# v2 primitive conventions (src/ui/v2)

Read this + the exemplars (`Checkbox.tsx/.css`, `Button.tsx/.css`, `Input.tsx/.css`) before adding a
primitive. The v2 set lives beside the legacy `src/ui/*` and is consumed as `@ui/v2/<Name>`.

## Rules
- **One `<Name>.tsx` + `<Name>.css` per primitive.** The `.tsx` does NOT import its `.css`;
  `scripts/ui-css.mjs` (`npm run ui:css`) regenerates `src/ui/styles.ts` and registers it. Its walk
  is recursive, so files under `v2/` are picked up automatically.
- **Class prefix `v2-`** on every class (`.v2-btn`, `.v2-menu__item`). Never reuse a legacy class name.
- **Tokens only — no raw hex, ever.** Colours/space/radius/motion come from the v2 tokens in
  `src/styles/tokens.css`: surfaces `--bg-canvas/-sidebar/-panel/-elevated`, `--surface-hover/-selected`;
  borders `--border-muted/-default/-strong`; text `--text-primary/-secondary/-tertiary/-disabled`;
  `--accent`, `--success/-warning/-danger/-info`, `--white`; radii `--radius-sm/-control/-panel/-modal`;
  control heights `--control-h-dense/-default/-comfortable/-prominent` (28/32/36/40); icon sizes
  `--icon-*`; spacing `--space-1..10`; motion `--motion-instant/-fast/-standard/-medium/-slow`; easings
  `--ease-enter/-exit/-standard`; `--focus-ring`. `color-mix(in srgb, var(--x) N%, black|transparent)`
  is allowed for hover/press derivations.
- **Type** via the ramp classes: `.t-display/.t-page-title/.t-section-title/.t-body/.t-ui/.t-caption/.t-micro`.
- **Focus**: interactive elements set `outline: none; box-shadow: var(--focus-ring);` on `:focus-visible`
  (or `:focus-within` for composite controls). Element-qualify selectors that would otherwise tie with
  index.css's global `:focus-visible` (e.g. `button.v2-btn`, not `.v2-btn`).
- **Disabled** = the whole node at `opacity: 0.55` (never a recoloured palette). Add `cursor: default`
  where a control would otherwise show a pointer — the app is native, not a web page.
- **Motion**: put every `transition`/`animation` inside `@media (prefers-reduced-motion: no-preference)`
  so the audit's motion gate is satisfied and reduced-motion is honoured. Durations use `--motion-*`.
  Overlays enter with opacity + a small (≤8px) translate/scale; exit faster than enter (§7.2).
- **Icons**: `import Icon, { type IconName } from '../../components/Icon'`. Available names are the
  closed `IconName` union — do not invent new ones (the sprite is fixed). `check`, `chev`, `x`, `dots`,
  `warn`, `search`, `plus`, `trash`, `left`, `right`, `sync` are the general-purpose ones.
- **A11y**: real semantics (`role`, `aria-*`), keyboard operability, focus trap + restore for modals,
  Escape to close overlays, status by text+icon not colour alone. Target WCAG 2.2 AA.
- **Box model**: `box-sizing: border-box` on bordered controls so a 1px border never grows a pinned height.
