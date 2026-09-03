/**
 * Difficulty Meter — `design/specs/components-data.md` §3, node `23:68`. Five pips, the band word,
 * and optionally the 0–100 score thrown hard right.
 *
 * The band model is deliberately NOT restated here: `src/lib/difficulty.ts` owns the cutoffs
 * (34 / 50 / 67 / 84), the labels, the lit-pip count and the `--dN` colour, and a call site gets
 * one from `bandFor(score)`. This component is presentation only, which also matches the source:
 * Figma keeps `Band` and `Score` as independent properties, so the numeral never implies a band
 * and a band never implies a numeral (spec TRAP 4).
 *
 * Three things the spec settles, and all three are easy to get wrong:
 *
 * 1. There are **always exactly five pips**. Gentle draws one lit and four `--hair`; **Unrated
 *    draws five `--hair` pips** plus the word `Unrated` in `--ink-3`. Not an empty row, not zero
 *    pips, not a dash.
 * 2. **Every lit pip in a band shares one colour.** Tough is four `--d4` pips — there is no
 *    `d1 → d4` ramp across the row. `band.color` being a single token string is what keeps this
 *    honest; do not index a palette by pip.
 * 3. The score is **gated, not derived**. Hide it when nothing was parsed (`score == null`, i.e.
 *    Unrated) or when the surface says so — every Paper Card in the Figma library grid ships
 *    `Show Score = false`.
 *
 * On width: the 248 master is not arbitrary, it is the Paper Card's inner width (280 − 2×16), so
 * the card's FILL instance measures identically to the standalone. That is why there is one
 * component and not a second "small" one — `width` defaults to `fill`, and `width={METER_WIDTH}`
 * reproduces the master box.
 */
import type { Band } from '../lib/difficulty';

/** Exactly five, in every band, always — Unrated included. Spec §3 and TRAP 1. */
export const PIP_COUNT = 5;

/**
 * The master width. 82 of it is the pip row (5×14 + 4×3); the rest is the 10px gap, the band word
 * and whatever the score needs. Equal to the Paper Card's inner width by design.
 */
export const METER_WIDTH = 248;

export interface DifficultyMeterProps {
  /** From `bandFor(score)` — carries the label, the `--dN` colour and the lit count. */
  band: Band;
  /** The 0–100 figure. `null` means no parsed thresholds, and hides the numeral outright. */
  score?: number | null;
  /** Figma's `Show Score`, default true as in the file. The library grid's cards pass false. */
  showScore?: boolean;
  /** `'fill'` for the card foot; a number pins it, e.g. `METER_WIDTH` for the standalone master. */
  width?: number | 'fill';
  className?: string;
}

export default function DifficultyMeter({
  band,
  score = null,
  showScore = true,
  width = 'fill',
  className,
}: DifficultyMeterProps) {
  const cls = ['dmeter', width === 'fill' ? 'dmeter--fill' : null, className]
    .filter(Boolean)
    .join(' ');

  return (
    // A span, not a div: the meter is dropped inside `<button>` rows (the dashboard's up-next), and
    // phrasing content keeps that markup valid.
    <span className={cls} style={width === 'fill' ? undefined : { width }}>
      <span className="dmeter__left">
        {/* Decorative — the band word beside it says the same thing in text. */}
        <span className="dmeter__pips" aria-hidden="true">
          {Array.from({ length: PIP_COUNT }, (_, i) => (
            <i
              key={i}
              className="dmeter__pip"
              /* One token for the whole lit run; the rest keep `--hair` from the stylesheet. */
              style={i < band.lit ? { background: band.color } : undefined}
            />
          ))}
        </span>
        {/* `band.color` is `--ink-3` on Unrated, so the label needs no special case. */}
        <span className="dmeter__label t-label-difficulty" style={{ color: band.color }}>
          {band.label}
        </span>
      </span>
      {showScore && score != null && (
        <span className="dmeter__score t-mono-meta">{Math.round(score)}</span>
      )}
    </span>
  );
}
