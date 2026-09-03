/**
 * The Bell wordmark. Geometry is `design/specs/brand-wordmark-lockups.md`, measured off the file.
 *
 * The letterforms are SF Pro **Expanded** Bold 96 at -2% tracking, converted to outlines rather
 * than set as live text: SF Pro Expanded is not among the faces the app vendors, and live text
 * would fall back off Apple platforms — which shifts the stems and lands the spectacles in the
 * wrong place. Regenerate with `scripts/wordmark.py` (instances SF-Pro.ttf at wdth 132 /
 * opsz 28 / wght 760). Verified against the spec: B ink starts at x 0.534 (spec 0.531), the cap
 * line is y 18.359 exactly, and the ink is 185.75 wide against a spec 185.91 — 0.09%, inside the
 * 0.5% the spec allows before the width axis is suspect.
 *
 * Expanded was chosen on measurement and the numbers hold: the two `l` stems sit 24.89px apart
 * where plain Semibold gives ~20. That spacing is the whole idea, because it is what lets the
 * stems read as eye stalks — the word wears his spectacles.
 *
 * The spectacles are NOT centred on the stems. Lens origins are x 145 and 170 (centres 155/180)
 * while the measured stem centres are 152.856 and 177.748, so the assembly sits ~2.15px right of
 * the type. That is deliberate; do not "fix" it. For the same reason the bridge is 5px wide —
 * it spans lens-to-lens, not stem-to-stem (which is 7.5px).
 *
 * Only the word inverts with tone (`--ink`). The blue and the dark pupils are mode-invariant:
 * `--page-ink` does not move between modes, so the pupils stay dark on Night by design.
 */

const WORD_PATH =
  'M9.581 86V73.621H43.042Q48.35 73.621 51.217 71.521Q54.084 69.422 54.084 65.391V65.315Q54.084 62.596 52.733 60.772Q51.381 58.947 48.775 58.036Q46.169 57.125 42.38 57.125H9.581V46.207H40.333Q45.609 46.207 48.473 44.154Q51.336 42.102 51.336 38.359V38.265Q51.336 34.605 48.827 32.672Q46.318 30.739 41.86 30.739H9.581V18.359H46.847Q53.782 18.359 58.763 20.382Q63.744 22.404 66.423 26.152Q69.102 29.9 69.102 35.089V35.183Q69.102 39.107 67.395 42.231Q65.687 45.354 62.569 47.421Q59.45 49.489 55.255 50.214V50.484Q60.521 51.041 64.352 53.222Q68.182 55.403 70.265 58.909Q72.348 62.415 72.348 66.919V67.012Q72.348 72.975 69.345 77.227Q66.341 81.478 60.734 83.739Q55.127 86 47.286 86ZM0.534 86V18.359H18.323V86Z ' +
  'M107.922 87.218Q97.856 87.218 90.559 84.121Q83.263 81.024 79.33 75.155Q75.397 69.287 75.397 60.986V60.939Q75.397 52.726 79.397 46.77Q83.397 40.814 90.565 37.589Q97.732 34.364 107.26 34.406Q116.98 34.43 124.044 37.76Q131.108 41.089 134.931 47.11Q138.754 53.131 138.754 61.243V64.5L84.345 64.482V55.533H127.574L122.492 62.082V58.963Q122.492 54.803 120.732 51.819Q118.972 48.835 115.649 47.234Q112.326 45.633 107.647 45.633Q102.764 45.633 99.299 47.199Q95.833 48.766 93.991 51.841Q92.149 54.915 92.149 59.425V62.025Q92.149 67.058 94.245 70.152Q96.341 73.247 100.018 74.655Q103.694 76.063 108.48 76.063Q111.603 76.063 114.262 75.367Q116.922 74.671 118.875 73.398Q120.827 72.125 121.807 70.393L121.958 70.11H138.045L137.917 70.609Q136.844 74.438 134.251 77.505Q131.657 80.572 127.75 82.749Q123.842 84.926 118.833 86.072Q113.824 87.218 107.922 87.218Z ' +
  'M144.069 86V18.359H161.442V86Z ' +
  'M168.914 86V18.359H186.288V86Z';

/** The 196x88 component box. */
export const WORDMARK_BOX = { w: 196, h: 88 } as const;

/** Below roughly this box height the pixel lenses turn to mud — use `specs={false}`. */
export const SPECS_MIN_HEIGHT = 58;

/** The spectacle assembly, verbatim from the spec's rect table, in paint order. */
const SPECS = [
  { x: 165, y: 6, w: 5, h: 8, fill: 'var(--bell-cap-lo)' }, // bridge, lens-to-lens
  { x: 139, y: 8, w: 6, h: 4, fill: 'var(--bell-cap-lo)' }, // temple L
  { x: 190, y: 8, w: 6, h: 4, fill: 'var(--bell-cap-lo)' }, // temple R — flush to the box edge
  { x: 145, y: 0, w: 20, h: 20, fill: 'var(--bell-cap-hi)' }, // lens L
  { x: 170, y: 0, w: 20, h: 20, fill: 'var(--bell-cap-hi)' }, // lens R
  { x: 152, y: 7, w: 6, h: 6, fill: 'var(--page-ink)' }, // pupil L
  { x: 177, y: 7, w: 6, h: 6, fill: 'var(--page-ink)' }, // pupil R
];

export interface WordmarkProps {
  /** Box height in px; width follows at 196/88 = 2.227x. */
  size?: number;
  /** Draw the spectacles. Both lockups use `false`, so the spectacles appear once, not twice. */
  specs?: boolean;
  className?: string;
}

export default function Wordmark({ size = 88, specs = true, className }: WordmarkProps) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${WORDMARK_BOX.w} ${WORDMARK_BOX.h}`}
      height={size}
      width={(size * WORDMARK_BOX.w) / WORDMARK_BOX.h}
      role="img"
      aria-label="Bell"
      style={{ display: 'block' }}
    >
      <path d={WORD_PATH} fill="var(--ink)" />
      {specs &&
        SPECS.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />
        ))}
    </svg>
  );
}

/** Just the paths, for composing inside a lockup's own viewBox at an offset. */
export function WordmarkShapes({ specs = true }: { specs?: boolean }) {
  return (
    <>
      <path d={WORD_PATH} fill="var(--ink)" />
      {specs &&
        SPECS.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />
        ))}
    </>
  );
}
