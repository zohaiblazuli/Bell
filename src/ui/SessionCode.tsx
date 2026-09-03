/**
 * Session Code — `design/specs/components-data.md` §7, node `15:8`. A CAIE session code: `s` is
 * May/June, `w` Oct/Nov, `m` Feb/March, plus a two-digit year — `s24`.
 *
 * Two styles, and the only difference is the box. Boxed is the same hairline chip as Doc Badge
 * (30 x 16); Bare is the text alone (20 x 14) — no padding, no stroke, no fill, no radius — so Bare
 * is the base rule here and Boxed is the modifier. Both are always Mono/Small in `--ink-3`: the
 * code never takes an accent or a difficulty colour.
 *
 * **Drawn in the file but not used as a component today.** The library card prints the raw code
 * through app.css's `.card-meta .sc` and the sidebar subject rows through `.subj-row .code`, i.e.
 * the two placements the spec names (Boxed on a card meta row, Bare in the subject list) exist in
 * the app as two unrelated hand-written rules. This is the one component for both.
 */
export type SessionCodeVariant = 'boxed' | 'bare';

export interface SessionCodeProps {
  /** e.g. `s24`, rendered verbatim. `sessionLabel()` in `src/lib/difficulty.ts` expands it. */
  code: string;
  /** Figma calls this axis `Style`; renamed so it cannot be misread as React's `style`. */
  variant?: SessionCodeVariant;
  className?: string;
}

export default function SessionCode({ code, variant = 'boxed', className }: SessionCodeProps) {
  const cls = ['scode', variant === 'boxed' ? 'scode--boxed' : null, 't-mono-small', className]
    .filter(Boolean)
    .join(' ');

  return <span className={cls}>{code}</span>;
}
