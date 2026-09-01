/**
 * Difficulty presentation. The heat scale (--d1..--d5) is a separate axis from the brand
 * iris and must never be mixed with it.
 *
 * The score itself comes from the ported scambridge formula (grade thresholds -> a 0-100
 * "how hard was this sitting" number). Until a paper's thresholds are parsed, `score` is
 * null and the meter reads as unrated rather than guessing.
 */

export interface Band {
  label: string;
  color: string;
  lit: number;
}

/**
 * Five presentation bands nested inside the formula's own three (easy < 34, medium, hard >= 67
 * — see difficultyFormula.ts), so the finer label never contradicts the coarse one.
 */
const BANDS: { under: number; band: Band }[] = [
  { under: 34, band: { label: 'Gentle', color: 'var(--d1)', lit: 1 } },
  { under: 50, band: { label: 'Steady', color: 'var(--d2)', lit: 2 } },
  { under: 67, band: { label: 'Typical', color: 'var(--d3)', lit: 3 } },
  { under: 84, band: { label: 'Tough', color: 'var(--d4)', lit: 4 } },
  { under: Infinity, band: { label: 'Brutal', color: 'var(--d5)', lit: 5 } },
];

export const UNRATED: Band = { label: 'Unrated', color: 'var(--ink-3)', lit: 0 };

export function bandFor(score: number | null | undefined): Band {
  if (score == null || Number.isNaN(score)) return UNRATED;
  return (BANDS.find((b) => score < b.under) ?? BANDS[BANDS.length - 1]).band;
}

/** `s15` -> `May/June 2015` */
export function sessionLabel(scode: string): string {
  const season =
    { s: 'May/June', w: 'Oct/Nov', m: 'Feb/March' }[scode[0]?.toLowerCase() ?? ''] ?? 'Unknown';
  const yy = Number(scode.slice(1));
  const year = Number.isNaN(yy) ? '' : ` ${yy >= 80 ? 1900 + yy : 2000 + yy}`;
  return `${season}${year}`;
}

/** `12` -> `Paper 1 / Variant 2`, for the card subtitle. */
export function variantLabel(variant: string | null): string {
  if (!variant) return 'All papers';
  if (/^\d{2}$/.test(variant)) return `Paper ${variant[0]} · Variant ${variant[1]}`;
  if (/^\d$/.test(variant)) return `Paper ${variant}`;
  return `Paper ${variant}`;
}
