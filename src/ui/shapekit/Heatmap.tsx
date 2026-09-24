import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { windowsBetween } from '@/lib/sessions';

/**
 * The Home activity heatmap (Bell App v2 · "SINCE DAY ONE"): one 10px square per day, weeks as
 * columns, from the Monday of the week you started up to today. It sits in a 218px window — about
 * the last four months — that opens scrolled to today and scrolls back to day one.
 *
 * Four blues only, lightest to darkest; a day with no study is the lightest, as the user asked, so
 * the grid never shows grey gaps. Today has an ink outline; the rest of this week and anything
 * before day one are empty outlines. Exam seasons run underneath as coloured bars (Feb/Mar red,
 * May/Jun yellow, Oct/Nov blue), and hovering a square names its full date.
 */
const DAY = 86_400_000;
const STEP = 13; // 10px square + 3px gap
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SEASON_COLOUR = { m: 'var(--red)', s: 'var(--sk-yellow)', w: 'var(--blue)' } as const;
const SEASON_SHORT = { m: 'Feb/Mar', s: 'May/Jun', w: 'Oct/Nov' } as const;

const p2 = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const noon = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
const mondayOf = (d: Date) => noon(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)));
export const fullDate = (d: Date) => `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;

/** Minutes focused in a day → one of the four blues. */
const levelOf = (minutes: number) => (minutes >= 60 ? 4 : minutes >= 30 ? 3 : minutes >= 1 ? 2 : 1);

export interface HeatmapProps {
  /** Minutes focused per local ISO day — the focus log. */
  days: Record<string, number>;
  /** Day one: the first day Bell has any record of. */
  since: Date;
  now: Date;
}

export default function Heatmap({ days, since, now }: HeatmapProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ label: string; x: number; y: number } | null>(null);

  const model = useMemo(() => {
    const today = noon(now);
    // At least sixteen weeks, so a new install still fills the window.
    const floor = new Date(today.getTime() - 16 * 7 * DAY);
    const start = mondayOf(since < floor ? since : floor);
    const weeks = Math.round((mondayOf(today).getTime() - start.getTime()) / DAY / 7) + 1;
    const joined = noon(since);
    let studied = 0;
    let past = 0;
    const cells = Array.from({ length: weeks * 7 }, (_, i) => {
      const day = new Date(start.getTime() + i * DAY);
      const future = day > today;
      const before = day < joined;
      const isToday = iso(day) === iso(today);
      const minutes = days[iso(day)] ?? 0;
      if (!future && !before) {
        past += 1;
        if (minutes >= 1) studied += 1;
      }
      return { day, week: Math.floor(i / 7), row: i % 7, future, before, isToday, level: levelOf(minutes) };
    });
    const months: { label: string; left: number }[] = [];
    for (const c of cells) {
      if (c.day.getDate() === 1 && c.week < weeks - 1) months.push({ label: MON[c.day.getMonth()], left: c.week * STEP });
    }
    const end = new Date(start.getTime() + (weeks * 7 - 1) * DAY);
    const bands = windowsBetween(start, end).map((w) => {
      const a = Math.max(0, Math.floor((w.start.getTime() - start.getTime()) / DAY / 7));
      const b = Math.min(weeks - 1, Math.floor((w.end.getTime() - start.getTime()) / DAY / 7));
      return {
        key: w.code,
        label: `${SEASON_SHORT[w.season]} ${String(w.year).slice(2)}`,
        colour: SEASON_COLOUR[w.season],
        left: a * STEP,
        width: (b - a + 1) * STEP - 3,
      };
    });
    return { cells, weeks, months, bands, studied, past };
  }, [days, since, now]);

  // Open on today: the newest weeks are the ones that matter, day one is a scroll away.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [model.weeks]);

  return (
    <div className="sk-heat" onMouseLeave={() => setTip(null)}>
      {tip && (
        <div className="sk-heat__tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
          {tip.label}
          <i />
        </div>
      )}
      <div className="sk-heat__scroll" ref={scroller} onScroll={() => setTip(null)}>
        <div className="sk-heat__inner">
          <div className="sk-heat__months">
            {model.months.map((m) => (
              <span key={`${m.label}-${m.left}`} style={{ left: m.left }}>
                {m.label}
              </span>
            ))}
          </div>
          <div className="sk-heat__grid" role="img" aria-label={`${model.studied} of ${model.past} days studied since day one`}>
            {model.cells.map((c, i) => {
              const empty = c.future || c.before;
              return (
                <span
                  key={i}
                  data-level={empty ? undefined : c.level}
                  data-empty={empty ? 'true' : undefined}
                  data-today={c.isToday ? 'true' : undefined}
                  style={{ animationDelay: `${200 + (Math.max(0, c.week - model.weeks + 17) + c.row) * 14}ms` }}
                  onMouseEnter={
                    empty
                      ? undefined
                      : () => {
                          const sl = scroller.current?.scrollLeft ?? 0;
                          setTip({
                            label: `${DOW[c.day.getDay()]} ${fullDate(c.day)}${c.isToday ? ' · today' : ''}`,
                            x: c.week * STEP - sl + 5,
                            y: 18 + c.row * STEP - 6,
                          });
                        }
                  }
                />
              );
            })}
          </div>
          <div className="sk-heat__bands">
            {model.bands.map((b) => (
              <div key={b.key} style={{ left: b.left, width: b.width }}>
                <i style={{ background: b.colour }} />
                <span>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The counts the Home rail prints beside the grid, from the same model. */
export function heatStats(days: Record<string, number>, since: Date, now: Date) {
  const today = noon(now);
  let studied = 0;
  let past = 0;
  for (let d = noon(since); d <= today; d = new Date(d.getTime() + DAY)) {
    past += 1;
    if ((days[iso(d)] ?? 0) >= 1) studied += 1;
  }
  return { studied, past };
}
