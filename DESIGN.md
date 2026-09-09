# Bell design system

<!-- impeccable:design-schema 1 -->

## World

Bell is a calm Windows study desk: translucent system chrome frames opaque working surfaces, while
actual documents stay bright, tactile, and visually dominant. The blue environment and selectable
Azure/Mr. Bell mascots make the shell recognisably Bell; study content remains quiet enough for long
sessions.

## Foundations

- Use the existing tokens in `src/styles/tokens.css`; do not introduce feature-local palettes,
  shadows, radii, or font stacks when a semantic token exists.
- SF Pro is the reading and interface voice. Display weights establish hierarchy; Geist Mono is
  reserved for compact syllabus, file, page, and numerical metadata.
- Glass belongs to navigation, top bars, overlays, and floating controls. Catalogue rows, metadata
  panes, admin forms, and other working content use opaque surfaces.
- White paper is the highest-contrast object in a reading workflow. It may cast a paper shadow, but
  interface panels must not compete with it through glow or ornamental effects.
- Blue is the live accent for selection, focus, progress, and trusted completion. Danger colour is
  reserved for destructive, rejected, or unsafe states.

## Geometry and rhythm

- Reuse Bell's established token radii: pill for compact filters, button radius for controls, panel
  radius for bounded work areas, and a nearly square radius for paper.
- Main views preserve a clear chrome/content boundary and avoid card grids when a rail, table, or
  document desk expresses the task more directly.
- Dense metadata may be compact, but primary titles, descriptions, and actions need enough air to be
  scanned without reading the full pane.

## Community Resources direction

The chosen direction is a preview-led **paper desk** (Operate seed `135520f6`, assigned structure 5).
The resource itself earns trust, so the first-page preview owns the largest share of the catalogue
viewport. A compact resource rail narrows the collection on the left; provenance, file facts, trust
state, upvote, and the local-download action sit beside the selected paper. This is a study catalogue,
not a feed, marketplace, or promotional card wall.

The opening-frame contract is:

- Search and compact qualification/subject/type/sort controls span the top.
- The resource rail is subordinate to a large selected-paper preview.
- Authorship, uploader identity, file facts, and approval language stay visible with the preview.
- Administration replaces the desk only after privileged authentication and uses a compact
  operational table, explicit scan/IP/audit inspection, and one upload form.
- The reader reuses Bell's existing paper canvas and annotation tools so community documents do not
  feel like a separate product.

## Quality bar

Aim for the clarity and density of a well-made native document library: strong frame hierarchy,
paper-led depth, restrained ornament, crisp metadata lettering, complete keyboard/focus states, and
no clipped controls at Bell's 1040×680 minimum window. Delight comes from the Bell world and the
document-stage composition, not extra decoration.

## Responsive and accessibility rules

- At narrower desktop widths, compress the rail and metadata pane before reducing legibility; wrap
  actions and keep every control reachable without horizontal page scrolling.
- Focus is visible on every interactive element. Status uses text in addition to colour. Dialogs
  expose modal semantics, take initial focus, and close with Escape when no operation is active.
- Respect reduced motion and retain Day/Night contrast through semantic tokens.
