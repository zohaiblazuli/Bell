/**
 * Ring — the progress ring: one circle drawn with `stroke-dasharray` + `stroke-dashoffset`.
 *
 * **There is no ring anywhere in the Figma file.** Every progress readout the design specifies is
 * a linear meter: the dashboard hero's plan bar (`497:506`, 306.2 x 4, r999, `--hair` track with
 * an `--accent` `fill` at `497:507`), the reader's exam timer (`197:28`) and its tools opacity
 * slider (`198:45`). The ring is an app idiom that predates the port, and it survives on the
 * design system's own say-so — Getting Started rule 2 names it: "the iris gradient appears only on
 * live elements — focus ring, active tab, **timer ring**, progress bar, selection" (`12:39`).
 *
 * So the geometry here is app convention and only the paints are measured. `--hair` is the token
 * every meter track in the file uses (screen-dashboard.md §9), and the arc strokes `Blue/Line 90`
 * through the `#iris` gradient that `icons/Sprite` defines once for the whole app. Figma calls the
 * lit part of a meter `fill` and its groove `track` (`497:506` / `497:507`), which is where the two
 * paint props get their names — `stroke` is then free to mean the weight, as it does in Figma's own
 * inspector.
 *
 * Supersedes both hand-written copies in `app.css`: `.ring` (30 box, r 12.5, weight 3 — the focus
 * timer) and `.hero-ring` (80 box, r 34, weight 5 — the dashboard hero).
 *
 * **The radius is derived, so both call sites change size a little.** `size` is the ring's whole
 * box with the stroke centred on its inner edge, so `r = (size - stroke) / 2` — 13.5 at 30/3 and
 * 37.5 at 80/5, against the 12.5 and 34 those copies used. Their two insets past the stroke (1px
 * and 3.5px) are not one rule, so no formula reproduces both; flush is the rule that makes `size`
 * mean what it says. To land the old geometry exactly, pass the old ring's true outer box instead:
 * `size={28}` for the timer, `size={73}` for the hero.
 */
export interface RingProps {
  /**
   * Progress, 0-1. Clamped, because the focus timer runs past its target — `elapsed / target`
   * goes over 1 and the ring must sit full rather than unwind.
   */
  value: number;
  /** The whole box in px. Defaults to the focus timer's 30, the ring the app has always had. */
  size?: number;
  /** Stroke weight in px — Figma's own name for the number. Defaults to the timer's 3. */
  stroke?: number;
  /** Groove paint. Every measured meter track in the file is `--hair`. */
  track?: string;
  /** Arc paint. The brand line, via the gradient `icons/Sprite` mounts once. */
  fill?: string;
  className?: string;
}

export default function Ring({
  value,
  size = 30,
  stroke = 3,
  track = 'var(--hair)',
  fill = 'url(#iris)',
  className,
}: RingProps) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = Math.min(1, Math.max(0, value));
  const centre = size / 2;

  // aria-hidden, deliberately: at both call sites the ring duplicates a figure that is already
  // text beside it — `12:04 / 25:00`, `2h 10m focused today` — so it is decoration, and the
  // `aria-hidden` wrapper divs the old markup needed can go with it.
  return (
    <svg
      className={['bell-ring', className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      <circle
        className="bell-ring__trk"
        cx={centre}
        cy={centre}
        r={r}
        stroke={track}
        strokeWidth={stroke}
      />
      <circle
        className="bell-ring__arc"
        cx={centre}
        cy={centre}
        r={r}
        stroke={fill}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress)}
      />
    </svg>
  );
}
