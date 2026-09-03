/**
 * ActivityGrid — the year activity graph. `design/specs/screen-dashboard.md` §3c–§4
 * (`graph 495:2011`, 714 x 130 inside the `year activity` card `495:2009`).
 *
 * This is the graph column only: months, the 368-cell grid, the exam-session bands, the legend.
 * The card surface, its `THIS YEAR` head and the 246-wide streak rail belong to whoever composes
 * the screen.
 *
 * ONE <svg> holding 368 <rect>s, not 368 divs. The Figma grid is `layoutMode NONE` — absolute
 * x/y on a 13px pitch — so a viewBox reproduces it exactly, and one element buys one paint, one
 * hit region, and the 0.5px hairline as `stroke-width: .5` instead of 368 inset box-shadows.
 * 368 divs would be 368 layout boxes for a picture that never reflows.
 *
 * The measured identities all hold here: `28 + 13·52 + 10 = 714` wide (the 28px day-label gutter
 * lives INSIDE that width, so cells occupy only 686 of it), `13·6 + 10 = 88` tall, and 52 full
 * weeks + the trailing week's 4 cells = 368 — the number the rail's `208 / 368` reads off. The
 * trailing week is truncated, never padded out to a rectangle.
 *
 * The LEADING week is not truncated: column 0 opens on the Sunday on or before `from`, so up to
 * six slots can predate the range — Sun 31 Aug 2025 for the file's 1 Sep 2025 start. They are
 * ordinary empty cells and remain selectable; they simply hold no data.
 *
 * 53 columns is what a year-and-a-day happens to yield, not a constant. The count comes out of
 * `from`/`to`, so a range opening on another weekday can produce 54 and the viewBox widens with
 * it; only the measured range (1 Sep 2025 to 2 Sep 2026) lands exactly on 714 x 88.
 */
import { useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';

/**
 * A step on the five-colour ramp, quantised by the caller from ABSOLUTE thresholds — papers per
 * day — and never from per-user quantiles. A self-relative scale re-normalises as the year fills:
 * the same three papers would paint dark in September and pale in May, so the graph would hide
 * exactly the progress it exists to show. A colour has to mean the same amount of work whenever
 * you look at it.
 */
export type ActivityLevel = 0 | 1 | 2 | 3 | 4;

export interface ActivityDay {
  /**
   * Local calendar date, `YYYY-MM-DD`. Matched as a string against the days this grid draws, so
   * build it from local parts — `toISOString()` past UTC+12 names the day before.
   */
  date: string;
  level: ActivityLevel;
}

/** An exam session. Drawn as a band under every column it touches. */
export interface ExamBand {
  from: string;
  to: string;
}

export interface ActivityGridProps {
  /** Sparse: any date without an entry is level 0. Dates outside the range are ignored. */
  days: ActivityDay[];
  bands: ExamBand[];
  /** First day of the range. Column 0 still opens on the Sunday on or before it. */
  from: string;
  /** Last day of the range — the final cell, and what truncates the trailing week. */
  to: string;
  /** Omit for a pure graphic: no tab stop, no key handling, no cursor, no live region. */
  onSelectDay?: (date: string) => void;
  className?: string;
}

/** Measured cell metrics (§4): 10 + 3 = a 13px pitch, radius 2, hairline 0.5px INSIDE. */
export const GRID = {
  cell: 10,
  gap: 3,
  pitch: 13,
  gutter: 28,
  rows: 7,
  radius: 2,
  hair: 0.5,
} as const;

/**
 * An SVG stroke straddles the path it follows, so each rect is drawn 0.25 inside the measured
 * 10x10 box: the 0.5 hairline then lands entirely within it, the gaps stay a true 3px instead of
 * shrinking to 2.5, and the painted outer edge is exactly 10. The radius follows the inset.
 */
const INSET = GRID.hair / 2;
const BOX = GRID.cell - GRID.hair;
const BOX_R = GRID.radius - INSET;

/**
 * `graph` is VERTICAL itemSpacing 4 over months 13, grid 88, bands 4, legend 13 = 130 (§3c). The
 * svg carries the first three — 13 + 4 + 88 + 4 + 4 = 113 — and the legend is a flex row under it.
 */
const ROW_GAP = 4;
const MONTHS_H = 13;
const GRID_H = GRID.pitch * (GRID.rows - 1) + GRID.cell;
const BANDS_H = 4;
const Y_GRID = MONTHS_H + ROW_GAP;
const Y_BANDS = Y_GRID + GRID_H + ROW_GAP;
const VIEW_H = Y_BANDS + BANDS_H;

/** Bands are 3 tall at the top of their 4-tall row — 1px of slack below — radius 1.5. */
const BAND_H = 3;
const BAND_R = 1.5;

/** Body/Meta label boxes are 13 tall; SVG text is placed on the box's centre line. */
const LABEL_H = 13;

/** The legend swatch strip is gap 4, not the grid's 3: `5·10 + 4·4 = 66`, the measured width. */
const SWATCH_GAP = 4;

/**
 * The keyboard cursor ring sits in the 3px gutter — 1.5 out, 1.5 wide — so it clears the cell it
 * marks and its neighbours by 0.75 and never covers the colour it is pointing at.
 */
const RING = 1.5;

const DAY_MS = 86_400_000;

/**
 * Month strings are literals, not `Intl`: the spec measured `Sep`, and a locale that abbreviates
 * September as `sept.` would widen every label over its column.
 */
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Mon/Wed/Fri only (§4); Sun/Tue/Thu/Sat are unlabelled. `y = 13d − 2` puts the 13-tall label box
 * half a pixel above true row centre — measured, not a rounding artefact.
 */
const DAY_LABELS: readonly [number, string][] = [
  [1, 'Mon'],
  [3, 'Wed'],
  [5, 'Fri'],
];

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * `YYYY-MM-DD` at local MIDDAY — the idiom the rest of the app already uses (DashboardView's
 * `dayBack`). Midnight lets a DST shift or a negative UTC offset move a day across the boundary.
 */
function parseDay(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

/** Local parts, deliberately not `toISOString()`, which goes through UTC and can name the wrong day. */
const isoOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** `1 Sep 2025` — the date format this screen already speaks (§2a `9 May 2027`, §3a's range). */
function prettyDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

interface Model {
  /** The Sunday that opens column 0 — `d0 = Sunday` (§4). */
  start: Date;
  /** Cells: that Sunday through `to`, inclusive. 368 for the measured range. */
  count: number;
  cols: number;
  width: number;
  levels: Uint8Array;
  dates: string[];
  months: { x: number; label: string }[];
  /** Cells with any activity at all — the numerator of the rail's `208 / 368`. */
  active: number;
}

function buildModel(days: ActivityDay[], from: string, to: string): Model {
  const start = parseDay(from);
  start.setDate(start.getDate() - start.getDay());
  const count = Math.max(1, Math.round((parseDay(to).getTime() - start.getTime()) / DAY_MS) + 1);
  const cols = Math.ceil(count / GRID.rows);

  const byDate = new Map(days.map((d) => [d.date, d.level] as const));
  const levels = new Uint8Array(count);
  const dates = new Array<string>(count);
  const walk = new Date(start);
  let active = 0;
  for (let i = 0; i < count; i += 1) {
    const date = isoOf(walk);
    const level = byDate.get(date) ?? 0;
    dates[i] = date;
    levels[i] = level;
    if (level > 0) active += 1;
    walk.setDate(walk.getDate() + 1);
  }

  // A month is labelled on the first column whose SATURDAY falls in it — the GitHub rule — which
  // is also why the trailing 1-week stub goes unlabelled: it has no d6 inside the range, so the
  // loop simply stops. In the measured file that is 12 labels for 53 columns, at x 28, 80, 132,
  // 197, 249, 314, 366, 418, 470, 535, 587, 639.
  const months: { x: number; label: string }[] = [];
  let seen = -1;
  for (let w = 0; w < cols; w += 1) {
    const saturday = w * GRID.rows + 6;
    if (saturday >= count) break;
    const month = Number(dates[saturday].slice(5, 7)) - 1;
    if (month === seen) continue;
    seen = month;
    months.push({ x: GRID.gutter + GRID.pitch * w, label: MONTHS_SHORT[month] });
  }

  return {
    start,
    count,
    cols,
    width: GRID.gutter + GRID.pitch * (cols - 1) + GRID.cell,
    levels,
    dates,
    months,
    active,
  };
}

export default function ActivityGrid({
  days,
  bands,
  from,
  to,
  onSelectDay,
  className,
}: ActivityGridProps) {
  const [cursor, setCursor] = useState<number | null>(null);
  const model = useMemo(() => buildModel(days, from, to), [days, from, to]);

  /**
   * Week-major, matching the file's own node order (`w0d0` to `w52d3`). Memoised so moving the
   * keyboard cursor costs one rect's worth of work instead of rebuilding 368 elements.
   */
  const cells = useMemo(
    () =>
      Array.from({ length: model.count }, (_, i) => (
        <rect
          key={i}
          className={`ag-cell ag-l${model.levels[i]}`}
          x={GRID.gutter + GRID.pitch * Math.floor(i / GRID.rows) + INSET}
          y={GRID.pitch * (i % GRID.rows) + INSET}
          width={BOX}
          height={BOX}
          rx={BOX_R}
        />
      )),
    [model],
  );

  /**
   * Bands snap to whole columns: `x = 28 + 13·wStart`, `w = 13·(nCols − 1) + 10` — flush with the
   * first and last cell of the span, gutters included, no trailing gap (§4). Measured: Oct/Nov
   * x 93 w 88, Feb/Mar x 314 w 62, May/Jun x 470 w 88. A session that opens mid-week therefore
   * paints from that week's first cell, which is what the file does.
   */
  const spans = useMemo(() => {
    const opened = model.start.getTime();
    const out: { key: string; x: number; w: number }[] = [];
    for (const band of bands) {
      const firstDay = Math.round((parseDay(band.from).getTime() - opened) / DAY_MS);
      const lastDay = Math.round((parseDay(band.to).getTime() - opened) / DAY_MS);
      if (lastDay < 0 || firstDay >= model.count) continue;
      const a = Math.max(0, Math.floor(firstDay / GRID.rows));
      const z = Math.min(model.cols - 1, Math.floor(lastDay / GRID.rows));
      if (z < a) continue;
      out.push({
        key: `${band.from}/${band.to}`,
        x: GRID.gutter + GRID.pitch * a,
        w: GRID.pitch * (z - a) + GRID.cell,
      });
    }
    return out;
  }, [bands, model]);

  const interactive = Boolean(onSelectDay);

  /**
   * One delegated hit-test instead of 368 click handlers. The viewBox scales uniformly (default
   * `preserveAspectRatio`), so one factor converts both axes.
   */
  function indexAt(e: MouseEvent<SVGSVGElement>): number | null {
    const box = e.currentTarget.getBoundingClientRect();
    if (!box.width) return null;
    const scale = model.width / box.width;
    const x = (e.clientX - box.left) * scale - GRID.gutter;
    const y = (e.clientY - box.top) * scale - Y_GRID;
    const col = Math.floor(x / GRID.pitch);
    const row = Math.floor(y / GRID.pitch);
    if (x < 0 || y < 0 || col < 0 || col >= model.cols || row < 0 || row >= GRID.rows) return null;
    const i = col * GRID.rows + row;
    return i < model.count ? i : null;
  }

  /**
   * A roving cursor over one tab stop — deliberately not a tabindex per cell. GitHub's grid gives
   * all 368 cells `tabindex="0"`, which is 368 tab stops between the card above and the one below.
   * Arrows walk days and weeks, Home/End jump to the ends, Enter/Space commits.
   */
  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    if (!onSelectDay) return;
    const from0 = cursor ?? 0;
    const step: Record<string, number> = {
      ArrowUp: -1,
      ArrowDown: 1,
      ArrowLeft: -GRID.rows,
      ArrowRight: GRID.rows,
    };
    if (e.key in step) {
      e.preventDefault();
      setCursor(Math.min(model.count - 1, Math.max(0, from0 + step[e.key])));
      return;
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setCursor(e.key === 'Home' ? 0 : model.count - 1);
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && cursor != null) {
      e.preventDefault();
      onSelectDay(model.dates[cursor]);
    }
  }

  const marked = cursor != null ? cursor : null;

  return (
    <div className={className ? `ag ${className}` : 'ag'}>
      <svg
        className="ag-svg"
        viewBox={`0 0 ${model.width} ${VIEW_H}`}
        width={model.width}
        height={VIEW_H}
        role={interactive ? 'grid' : 'img'}
        aria-label={`Activity from ${prettyDate(from)} to ${prettyDate(to)} — ${model.active} of ${model.count} days active`}
        tabIndex={interactive ? 0 : undefined}
        onKeyDown={interactive ? onKeyDown : undefined}
        onBlur={interactive ? () => setCursor(null) : undefined}
        onClick={
          interactive
            ? (e) => {
                const i = indexAt(e);
                if (i != null) {
                  setCursor(i);
                  onSelectDay?.(model.dates[i]);
                }
              }
            : undefined
        }
      >
        {/* Month labels, left-aligned to the first column of their run. */}
        {model.months.map((m) => (
          <text
            key={`${m.label}-${m.x}`}
            className="ag-month"
            x={m.x}
            y={MONTHS_H / 2}
            dominantBaseline="central"
          >
            {m.label}
          </text>
        ))}

        {/* Mon/Wed/Fri, in the 28px gutter. */}
        {DAY_LABELS.map(([row, label]) => (
          <text
            key={label}
            className="ag-day"
            x={0}
            y={Y_GRID + GRID.pitch * row - 2 + LABEL_H / 2}
            dominantBaseline="central"
          >
            {label}
          </text>
        ))}

        {/* The cells carry grid-relative y, so the whole block translates down as one. */}
        <g transform={`translate(0 ${Y_GRID})`}>
          {cells}
          {marked != null && (
            <rect
              className="ag-cursor"
              x={GRID.gutter + GRID.pitch * Math.floor(marked / GRID.rows) - RING}
              y={GRID.pitch * (marked % GRID.rows) - RING}
              width={GRID.cell + RING * 2}
              height={GRID.cell + RING * 2}
              rx={GRID.radius + RING}
            />
          )}
        </g>

        {/* Exam-session bands — what turns a vanity graph into a planning instrument. */}
        {spans.map((s) => (
          <rect
            key={s.key}
            className="ag-band"
            x={s.x}
            y={Y_BANDS}
            width={s.w}
            height={BAND_H}
            rx={BAND_R}
          />
        ))}
      </svg>

      <div className="ag-legend" style={{ gap: SWATCH_GAP }}>
        <span className="ag-legend-cap t-body-meta">Less</span>
        {([0, 1, 2, 3, 4] as ActivityLevel[]).map((l) => (
          <span key={l} className={`ag-swatch ag-l${l}`} />
        ))}
        <span className="ag-legend-cap t-body-meta">More</span>
      </div>

      {interactive && (
        <span className="ag-live" aria-live="polite">
          {marked != null ? prettyDate(model.dates[marked]) : ''}
        </span>
      )}
    </div>
  );
}
