/**
 * Mr. Bell Mark — the small-size mark. Geometry from `design/specs/brand-wordmark-lockups.md`.
 *
 * 64x64, 15 rects, radius 0, on a strict **4px grid** — deliberately coarser than the 256px
 * rig's 8px grid, because at 26px in the sidebar an 8px cell would be under two device pixels.
 * Ink bbox is x 4..60, y 8..56, so there is 4px of horizontal and 8px of vertical slack in the
 * box; that slack is what the lockups align against, not the box edges.
 *
 * Design lesson recorded with it: v1 drew the spectacles as `--page-ink` rings and failed twice.
 * A 4px ring is 1.6px at 26px, and ink on the Night ground has almost no contrast. What works is
 * solid `--bell-cap-hi` lens blocks joined by a fat `--bell-cap-lo` bridge with 8px ink pupils.
 *
 * Scale it, never restyle it. Every fill is mode-invariant, so the mark looks the same in both
 * tones — the only part of the identity that inverts is the word.
 */

/** In paint order: back-most first. */
const RECTS = [
  { x: 4, y: 36, w: 8, h: 8, fill: 'var(--bell-cap-lo)' }, // claw L
  { x: 4, y: 44, w: 4, h: 4, fill: 'var(--bell-cap-lo)' }, // claw L tip
  { x: 52, y: 36, w: 8, h: 8, fill: 'var(--bell-cap-lo)' }, // claw R
  { x: 56, y: 44, w: 4, h: 4, fill: 'var(--bell-cap-lo)' }, // claw R tip
  { x: 14, y: 52, w: 12, h: 4, fill: 'var(--bell-cap-lo)' }, // leg 1
  { x: 26, y: 52, w: 12, h: 4, fill: 'var(--bell-cap-lo)' }, // leg 2
  { x: 38, y: 52, w: 12, h: 4, fill: 'var(--bell-cap-lo)' }, // leg 3
  { x: 16, y: 28, w: 4, h: 4, fill: 'var(--bell-cap-mid)' }, // stalk L
  { x: 44, y: 28, w: 4, h: 4, fill: 'var(--bell-cap-mid)' }, // stalk R
  { x: 12, y: 32, w: 40, h: 20, fill: 'var(--bell-cap-mid)' }, // shell
  { x: 28, y: 14, w: 8, h: 8, fill: 'var(--bell-cap-lo)' }, // bridge
  { x: 8, y: 8, w: 20, h: 20, fill: 'var(--bell-cap-hi)' }, // lens L
  { x: 36, y: 8, w: 20, h: 20, fill: 'var(--bell-cap-hi)' }, // lens R
  { x: 14, y: 14, w: 8, h: 8, fill: 'var(--page-ink)' }, // pupil L
  { x: 42, y: 14, w: 8, h: 8, fill: 'var(--page-ink)' }, // pupil R
];

export const MARK_BOX = 64;
/** Ink bbox inside the box — what the lockups align to. */
export const MARK_INK = { x0: 4, y0: 8, x1: 60, y1: 56 } as const;

export interface MrBellMarkProps {
  /** Box size in px. The mark is square. */
  size?: number;
  className?: string;
  /** Hidden from a11y when a sibling wordmark already names the brand. */
  decorative?: boolean;
}

export default function MrBellMark({ size = 64, className, decorative }: MrBellMarkProps) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${MARK_BOX} ${MARK_BOX}`}
      width={size}
      height={size}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'Mr. Bell'}
      aria-hidden={decorative || undefined}
      style={{ display: 'block' }}
    >
      <MarkShapes />
    </svg>
  );
}

/** Just the rects, for composing inside a lockup's viewBox. */
export function MarkShapes() {
  return (
    <>
      {RECTS.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />
      ))}
    </>
  );
}
