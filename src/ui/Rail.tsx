/**
 * Rail — onboarding's step indicator: four 44x6 segments, a flexible strut, and the step label
 * hard right. `rail row`, screen-onboarding.md §3.1 / §3.2.
 *
 * **It counts the four choices, not the six screens.** 01 Name through 04 Plan read "Step N of 4";
 * 05 Building and 06 Ready are terminal — all four segments lit, and the label switches to a status
 * word. Never render a fifth or sixth segment (TRAP 3).
 *
 *     <Rail current={2} />                      01-04   ->  Step 2 of 4
 *     <Rail current={4} label="Setting up" />   05 Building
 *     <Rail current={4} label="All set" />      06 Ready
 *
 * Lit is `--accent` at full strength and unlit is `--hair`: the spec measures the unlit segments as
 * `hair` at 0.14 Night / 0.11 Day, which is exactly what the token already resolves to per mode, so
 * there is no paint opacity to reproduce.
 *
 * Two numbers to know before touching the CSS. The row is 13 tall and that height comes from the
 * 11px Body/Meta line box, not from the 6px segments. And Figma records the `rail` frame as 182
 * wide, which does not close — four 44s at gap 6 is 194, and 182 would need gap 2. The segment
 * table is the more specific measurement, so 44 at gap 6 ships; the discrepancy cannot show,
 * because the row is FILL width with a flexible strut between the segments and the label, so only
 * the label's left edge ever depended on it.
 */
export interface RailProps {
  /** Segments. Four, in this flow — a prop so the count is stated once and read twice. */
  total?: number;
  /** How many are lit: the step you are on, 1-based. The terminal screens pass `total`. */
  current: number;
  /** Replaces "Step N of 4" — 05's "Setting up", 06's "All set". */
  label?: string;
  className?: string;
}

export default function Rail({ total = 4, current, label, className }: RailProps) {
  const lit = Math.min(Math.max(current, 0), total);

  return (
    <div className={['bell-rail', className].filter(Boolean).join(' ')}>
      {/* aria-hidden, deliberately: the label beside them is real text that says exactly what the
          segments encode, so an ARIA progressbar here would only make a screen reader say it
          twice — and on 05/06 the label is the only thing that carries the state at all. */}
      <div className="bell-rail__segs" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className="bell-rail__seg" data-lit={i < lit ? '' : undefined} />
        ))}
      </div>
      <span className="bell-rail__step t-body-meta">{label ?? `Step ${lit} of ${total}`}</span>
    </div>
  );
}
