/**
 * Doc Badge — `design/specs/components-data.md` §6, node `14:14`. Two mono glyphs in a hairline
 * box: `QP` question paper, `MS` mark scheme, `ER` examiner report, `GT` grade thresholds. Mono
 * because it is machine data, and the box is a constant 23 x 17 because every code is two glyphs
 * of a monospace face.
 *
 * **Drawn in the file but unused on every current screen.** Paper Card `66:359` dropped `QP` —
 * every paper has one, so it carried no information — and turned `MS` / `ER` into plain words in
 * its meta row, which is why the library grid has no badges. Built faithfully for the paper-detail
 * or reader surface that wants a dense row; per the spec, do not reintroduce it into the grid.
 */
export type DocType = 'QP' | 'MS' | 'ER' | 'GT';

/** The spec's own gloss, so two letters are not the whole accessible name. */
export const DOC_TITLES: Record<DocType, string> = {
  QP: 'Question paper',
  MS: 'Mark scheme',
  ER: 'Examiner report',
  GT: 'Grade thresholds',
};

export interface DocBadgeProps {
  /** Figma's `Type` variant. */
  type: DocType;
  className?: string;
}

export default function DocBadge({ type, className }: DocBadgeProps) {
  // <abbr>, not <span>: these really are abbreviations, so the expansion is native semantics plus
  // a native tooltip rather than invented ARIA.
  return (
    <abbr className={['doc', className].filter(Boolean).join(' ')} title={DOC_TITLES[type]}>
      {type}
    </abbr>
  );
}
