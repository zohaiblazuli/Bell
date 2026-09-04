/**
 * Difficulty presentation.
 *
 * The rating is computed by ShinyPapers from published grade thresholds and arrives on
 * every paper row; this file only decides how it looks. Nothing here derives a rating
 * for a paper — one whose thresholds were never parsed has `difficulty: null` and
 * reads as unrated rather than being guessed at.
 *
 * Labels, cutoffs and palette mirror the website exactly (`lib/difficulty.ts` and
 * `components/ui/DifficultyBadge.tsx` over there), so the same paper cannot read
 * "Hard" in one product and "Typical" in the other.
 */
import type { Difficulty, Season } from './types';

/** Upstream's cutoffs on the 0-100 hardness score. */
export const HARD_SCORE_CUTOFF = 67;
export const MEDIUM_SCORE_CUTOFF = 34;

export interface DifficultyBand {
  label: string;
  /** Solid mid-tone — dots, chart fills. */
  color: string;
  /** Deeper tone, for text sitting on `tint`. */
  deep: string;
  /** Light tint, for a badge background. */
  tint: string;
  rated: boolean;
}

/** Sky → Amber → Rose, the website's data palette. Deliberately not the brand iris. */
const BANDS: Record<Difficulty, DifficultyBand> = {
  easy: { label: 'Easy', color: '#0ea5e9', deep: '#0369a1', tint: '#e0f2fe', rated: true },
  medium: { label: 'Medium', color: '#f59e0b', deep: '#b45309', tint: '#fef3c7', rated: true },
  hard: { label: 'Hard', color: '#f43f5e', deep: '#be123c', tint: '#ffe4e6', rated: true },
};

/** An em-dash, matching the website. Not the word "Unrated", not an empty space. */
export const UNRATED: DifficultyBand = {
  label: '—',
  color: 'var(--ink-3)',
  deep: 'var(--ink-3)',
  tint: 'transparent',
  rated: false,
};

export function bandFor(difficulty: Difficulty | null | undefined): DifficultyBand {
  return difficulty ? BANDS[difficulty] : UNRATED;
}

/**
 * Bucket a 0-100 score into upstream's three bands.
 *
 * For aggregates the catalogue does not label — a subject's mean, say. A single paper
 * carries its own `difficulty` and that must always be preferred: re-deriving one here
 * risks disagreeing with the note the server already wrote for it.
 */
export function difficultyForScore(score: number | null | undefined): Difficulty | null {
  if (score == null || Number.isNaN(score)) return null;
  if (score >= HARD_SCORE_CUTOFF) return 'hard';
  if (score >= MEDIUM_SCORE_CUTOFF) return 'medium';
  return 'easy';
}

const SEASON_LABELS: Record<Season, string> = {
  may_june: 'May/June',
  oct_nov: 'Oct/Nov',
  feb_mar: 'Feb/Mar',
};

/** `may_june` -> `May/June`. One spelling, matching the website's `seasonLabel`. */
export function seasonLabel(season: Season | string): string {
  return SEASON_LABELS[season as Season] ?? 'Unknown';
}

/** `s15` -> `May/June 2015`. Derived from the code so it works without a full row. */
export function sessionLabel(scode: string): string {
  const season = { s: 'may_june', w: 'oct_nov', m: 'feb_mar' }[scode[0]?.toLowerCase() ?? ''];
  const label = season ? seasonLabel(season) : 'Unknown';
  const yy = Number(scode.slice(1));
  const year = Number.isNaN(yy) ? '' : ` ${yy >= 80 ? 1900 + yy : 2000 + yy}`;
  return `${label}${year}`;
}

/** `12` -> `Paper 1 · Variant 2`, for the card subtitle. */
export function componentLabel(component: string | null): string {
  if (!component) return 'All papers';
  if (/^\d{2}$/.test(component)) return `Paper ${component[0]} · Variant ${component[1]}`;
  return `Paper ${component}`;
}
