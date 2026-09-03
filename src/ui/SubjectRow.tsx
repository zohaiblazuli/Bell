/**
 * Subject Row — the sidebar's ten subject rows. Spec: `screen-library-settings.md` §3.2 and
 * `screen-bookmarks-recent.md` §3. 214 x 30, gap 10, padding 7/10, radius `--r-btn`.
 *
 * The glyph is stroked in the row's own text ink, not in a per-subject brand tint. Figma paints
 * these 16px icons with a hashed `--iris-1..4` (Accounting lands on `--iris-3`), which spends the
 * whole brand ramp as four category fills — CLAUDE.md rule 2 keeps the accent for *live*
 * elements, as a line and never a wash. The file already agrees with itself elsewhere: the same
 * glyph in the Recent list is stroked `--ink-2`, and the spec calls that out as "not the iris
 * tint used in the sidebar". So: ink by default, accent on the selected row only. This also
 * retires the app's hashed colour dot, which had no counterpart in the design at all.
 *
 * Not the empty state. "No index yet" is a muted line of copy, not a subject — it needs its own
 * markup rather than a SubjectRow with blank data.
 */
import type { ReactNode } from 'react';

export interface SubjectRowProps {
  /** CAIE syllabus code — "9706". Mono/Small, hugging the right edge. */
  code: string;
  name: string;
  /**
   * The 16px subject glyph. Optional because the 17-glyph `Subject Icon` set (`47:81`) has no
   * code counterpart yet; the slot holds its 16px either way, so the names stay aligned and
   * nothing shifts when the real glyphs land.
   */
  icon?: ReactNode;
  /** This subject is the live filter. Clicking it again clears it, so it reports `aria-pressed`. */
  active?: boolean;
  onClick?: () => void;
}

export default function SubjectRow({
  code,
  name,
  icon,
  active = false,
  onClick,
}: SubjectRowProps) {
  // The name slot is a fixed 131 in the master, so "Further Mathematics" clips (TRAP 15). We
  // ellipsise instead, which means the full name has to stay recoverable somewhere.
  return (
    <button
      type="button"
      className="subject-row"
      aria-pressed={active}
      title={name}
      onClick={onClick}
    >
      <span className="subject-row__icon">{icon}</span>
      <span className="subject-row__name t-body-default">{name}</span>
      <span className="subject-row__code t-mono-small">{code}</span>
    </button>
  );
}
