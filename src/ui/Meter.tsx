/**
 * Meter — the flat progress bar. Measured three times in `design/specs/screen-dashboard.md` and
 * identical every time: a `--hair` track, 4 tall, radius 999, clipping an `--accent` fill.
 *
 *   hero · days to exam   §2a  `497:506`  306.2 x 4   fill grow 1  / rest grow 1   (`48 / 96`)
 *   resume card           §7a  `185:97`   386   x 4   fill grow 57 / rest grow 43
 *   subject progress row  §7b  (`499:*`)  265   x 4   fill grow pct / rest grow 100 − pct
 *
 * So the value is a **grow ratio**, not a width — and that is worth preserving rather than
 * converting. The resume card's fill measures 220.02 of 386 and the hero's 153.1 of 306.2;
 * fractions a rounded `width: 57%` drifts off and flex lands on exactly. `rest` is a real node in
 * the file (`497:508`, `185:99`) with `fills []`, which is why an empty span follows the fill.
 *
 * This is NOT the Difficulty Meter (`components-data.md` §3) — that is five 14 x 5 pips and shares
 * nothing with this but the word, including the class name (`.meter` in app.css is the pip row).
 */

export interface MeterProps {
  /** Progress as a fraction: `0.61`, not `61`. Clamped to 0..1. */
  value: number;
  /** Track thickness in px. Defaults to the measured 4 from Meter.css. */
  height?: number;
  /**
   * Fill paint. Defaults to `var(--accent)` from Meter.css, which is what all three measured
   * instances use. It lands in `background`, so a gradient works too: `var(--grad-line)` restores
   * the iris bar `.bar i` drew before the file was measured flat. Pass a token, never a hex.
   */
  fill?: string;
  /**
   * Accessible name, which promotes the bar to a real `progressbar`. Omit it where the meter is
   * decorative — in the dashboard the number is always already printed beside it (`48 / 96`,
   * `61%`), and announcing the same fact twice is noise, so the default is `aria-hidden`.
   */
  label?: string;
  className?: string;
}

export default function Meter({ value, height, fill, label, className }: MeterProps) {
  const v = Math.min(1, Math.max(0, value));
  const a11y: React.HTMLAttributes<HTMLSpanElement> = label
    ? {
        role: 'progressbar',
        'aria-label': label,
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': Math.round(v * 100),
      }
    : { 'aria-hidden': true };

  return (
    <span
      className={className ? `meter-bar ${className}` : 'meter-bar'}
      style={{ height }}
      {...a11y}
    >
      <span className="meter-fill" style={{ flexGrow: v, background: fill }} />
      <span className="meter-rest" style={{ flexGrow: 1 - v }} />
    </span>
  );
}
