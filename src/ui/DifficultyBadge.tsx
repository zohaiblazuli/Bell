/**
 * Difficulty Badge — the website's rating, rendered the website's way.
 *
 * This replaces the five-pip Difficulty Meter. The pips encoded five bands
 * (Gentle/Steady/Typical/Tough/Brutal) that existed only here, over a score the
 * website already labels with three; two vocabularies for one number meant a paper
 * could read differently in each product. Three labels, one palette, no translation.
 *
 * The band model is not restated here: `src/lib/difficulty.ts` owns the labels and
 * the colours, and a call site gets one from `bandFor(difficulty)`. Presentation only.
 *
 * An unrated paper draws a plain em-dash in `--ink-3` — not the word "Unrated", not an
 * empty box — because that is what the website does and because "we have not scored
 * this yet" is better said quietly.
 */
import type { DifficultyBand } from '../lib/difficulty';

export interface DifficultyBadgeProps {
  /** From `bandFor(difficulty)` — carries the label and the palette. */
  band: DifficultyBand;
  /** The 0-100 figure, shown small beside the label when `showScore`. */
  score?: number | null;
  /** Off in grids, on where there is room to explain. */
  showScore?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export default function DifficultyBadge({
  band,
  score = null,
  showScore = false,
  size = 'md',
  className,
}: DifficultyBadgeProps) {
  const cls = ['dbadge', `dbadge--${size}`, band.rated ? null : 'dbadge--unrated', className]
    .filter(Boolean)
    .join(' ');

  // A span, not a div: badges sit inside `<button>` rows (the dashboard's up-next),
  // and phrasing content keeps that markup valid.
  if (!band.rated) {
    return (
      <span className={cls} style={{ color: band.color }} title="Not yet rated">
        {band.label}
      </span>
    );
  }

  return (
    <span className={cls} style={{ background: band.tint, color: band.deep }}>
      <i className="dbadge__dot" style={{ background: band.color }} aria-hidden="true" />
      <span className="dbadge__label">{band.label}</span>
      {showScore && score != null && (
        <span className="dbadge__score t-mono-meta">{Math.round(score)}</span>
      )}
    </span>
  );
}
