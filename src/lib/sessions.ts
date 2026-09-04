/**
 * The CAIE exam calendar — when the three series are sat, and how far away the next one is.
 * Feeds `design/specs/screen-dashboard.md` §2a (the `days to exam` hero, `495:8446`) and the
 * `exam sessions` bands under the year activity grid (§3, `495:7986`).
 *
 * Cambridge publishes each series as a WINDOW of dates, never a single day: Feb/March, May/June,
 * Oct/Nov. The table below is those published series windows rounded to whole days — it is not a
 * timetable and must not be read as one. These dates answer "how long until the next sitting" and
 * "which cells of the grid are exam season"; the day a particular subject and variant actually
 * sits is on the real timetable for that syllabus, which the library does not hold.
 *
 * PURE AND CLOCKLESS. Nothing here reads `Date.now()` — every entry point takes `from` — so the
 * Dashboard owns its own clock and the calendar can be checked against a fixed date.
 *
 * LOCAL MIDNIGHT THROUGHOUT. Every boundary is midnight in the user's own zone, because a
 * countdown that ticks over at 01:00 because it was computed in UTC is wrong for the person
 * reading it.
 */

/** Feb/Mar, May/June, Oct/Nov — the leading letter of every session code. */
export type Season = 'm' | 's' | 'w';

export interface ExamWindow {
  season: Season;
  /** Full year: 2026, never 26. */
  year: number;
  /** The `scode` the index stores on a `PaperRow`, so `w.code === row.scode` selects a sitting. */
  code: string;
  /** `Feb/Mar 2026` — the same string `sessionLabel(w.code)` in `difficulty.ts` builds. */
  label: string;
  /** First day of the sitting window, local midnight. */
  start: Date;
  /** Last day of it, inclusive, local midnight. */
  end: Date;
}

/**
 * The three series in the order they are sat, as `[month, day]` pairs. Months are 1-based here so
 * the table reads straight against a published Cambridge timetable; `localMidnight` applies JS's
 * off-by-one.
 *
 * WHO SITS FEB/MARCH — measured against the library, not assumed. As `G:` stands the March series
 * is held for **A Level** (10 of 10 subjects, `m16`–`m26`, 744 question papers) and **IGCSE**
 * (11 of 11, `m16`–`m25`), and for **O Level not at all** (0 of 13 subjects). Cambridge runs it as
 * an India-only series, so who sits it is a fact about a candidate's centre and is never derivable
 * from their level — an A Level student may well sit it. That is why no level appears in this table
 * and `nextWindow` takes the seasons instead; `store.ts`'s `settings.seasons` already stores them,
 * defaulting to all three.
 */
const SERIES: { season: Season; from: [number, number]; to: [number, number] }[] = [
  { season: 'm', from: [2, 20], to: [3, 20] },
  { season: 's', from: [5, 1], to: [6, 20] },
  { season: 'w', from: [10, 1], to: [11, 20] },
];

/** Kept identical to the map inside `sessionLabel` (`difficulty.ts`) — one sitting, one spelling. */
const SEASON_NAME: Record<Season, string> = { m: 'Feb/Mar', s: 'May/June', w: 'Oct/Nov' };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `2026` -> `26`. Two digits is what the filenames under `G:` and the index use, so it is what a
 * row can be matched against — but it only round-trips back to a full year inside the 1980–2079
 * pivot `sessionLabel` assumes, which covers every sitting the library holds. The double modulo
 * keeps a year before AD 1 from producing a code like `m-5`.
 */
const twoDigit = (year: number) => String(((Math.trunc(year) % 100) + 100) % 100).padStart(2, '0');

/**
 * Local midnight on a calendar day, built from components rather than parsed, so it lands at
 * midnight where the user is. Two traps are avoided in one call: the `Date` constructor reads a
 * year of 0–99 as 1900–1999, and a base date of 29 February would slide into March when moved to a
 * non-leap year — so the base is 1 January and `setFullYear` places the month and day.
 */
function localMidnight(year: number, month: number, day: number): Date {
  const d = new Date(2000, 0, 1);
  d.setFullYear(year, month - 1, day);
  return d;
}

/** The caller's `Date` with the time stripped, as a new object — never mutate what you are given. */
const startOfDay = (d: Date) => localMidnight(d.getFullYear(), d.getMonth() + 1, d.getDate());

/**
 * Whole days from `a` to `b`, both local midnights. Rounded rather than truncated: a span crossing
 * a daylight-saving change is an hour short of a whole number of days, and flooring that would
 * quietly drop a day from every countdown taken across a spring-forward.
 */
const wholeDays = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY_MS);

/**
 * The three windows of one calendar year, in sitting order.
 *
 * Fresh `Date`s on every call, deliberately not memoised: `Date` is mutable, so one cached window
 * shared between the hero and the grid would let either of them move the other's exam.
 */
export function windowsFor(year: number): ExamWindow[] {
  return SERIES.map(({ season, from, to }) => ({
    season,
    year,
    code: `${season}${twoDigit(year)}`,
    label: `${SEASON_NAME[season]} ${year}`,
    start: localMidnight(year, from[0], from[1]),
    end: localMidnight(year, to[0], to[1]),
  }));
}

/**
 * Every window that OVERLAPS the closed range `from`..`to`, in order. Overlap rather than
 * containment, because the activity grid's 53 weeks start and end mid-series and a half-visible
 * session still has to be shaded; clipping the band to the grid is the caller's job.
 *
 * Only the calendar years the range touches are examined — no series crosses New Year, so a window
 * outside those years cannot reach into the range.
 *
 * A range handed over backwards is read as the range it describes rather than returning nothing: an
 * empty list here is indistinguishable from "this span holds no exams", which is the harder bug to
 * find.
 */
export function windowsBetween(from: Date, to: Date): ExamWindow[] {
  let a = startOfDay(from);
  let b = startOfDay(to);
  if (a.getTime() > b.getTime()) [a, b] = [b, a];

  const found: ExamWindow[] = [];
  for (let year = a.getFullYear(); year <= b.getFullYear(); year++) {
    for (const w of windowsFor(year)) {
      if (w.end.getTime() >= a.getTime() && w.start.getTime() <= b.getTime()) found.push(w);
    }
  }
  return found;
}

/**
 * The next window whose last day has not passed. A series being sat right now is still "next",
 * which is what the hero wants — it should read the open sitting, not skip a month ahead to the one
 * after it.
 *
 * `seasons` restricts the search to the series a student actually sits — `store.ts`'s
 * `settings.seasons`, which defaults to all three. A candidate outside the March centres is given
 * `['s', 'w']` and never counts down to a sitting they cannot enter. Do not derive that list from
 * the student's level: the library holds eleven A Level March series (see `SERIES`). An empty list
 * allows nothing and yields null.
 *
 * Two years is always enough to search, because no window crosses New Year: whatever the remainder
 * of this year and the filter rule out, next year's Oct/Nov is still ahead of `from`. So null means
 * the filter allowed nothing, or `from` is not a real date, or the year has run past what `Date`
 * can represent (roughly ±275760) and the boundaries have stopped being days at all.
 */
export function nextWindow(from: Date, seasons?: Season[]): ExamWindow | null {
  const allowed = seasons ? new Set(seasons) : null;
  const day = startOfDay(from);
  const first = day.getFullYear();
  for (let year = first; year <= first + 1; year++) {
    for (const w of windowsFor(year)) {
      if (allowed && !allowed.has(w.season)) continue;
      if (w.end.getTime() >= day.getTime()) return w;
    }
  }
  return null;
}

/**
 * Whole days from `from` — normalised to local midnight, so the figure changes at midnight and not
 * at whatever hour the app happened to open — to `w.start`.
 *
 * ZERO WHILE THE WINDOW IS OPEN. Every day from the first of the sitting to the last reads 0;
 * "4 days until an exam that started on Monday" is a lie. Once the window has passed the result
 * goes negative, and the magnitude counts back to the window's FIRST day rather than its last, so
 * the day after May/June closes reads -51 rather than -1. Branch on the sign; the magnitude of a
 * negative only ever means "how long ago did that series open".
 */
export function daysUntil(from: Date, w: ExamWindow): number {
  const day = startOfDay(from);
  const t = day.getTime();
  if (t >= w.start.getTime() && t <= w.end.getTime()) return 0;
  return wholeDays(day, w.start);
}

/**
 * The window a given day falls inside, or null — "is a sitting under way", and which series a date
 * belongs to. Not the grid's band path: `ActivityGrid` takes whole `from`/`to` bands built from
 * `windowsBetween`, so nothing has to ask this 368 times. Only the day's own year is checked: no
 * series crosses New Year.
 */
export function windowOn(day: Date): ExamWindow | null {
  const d = startOfDay(day);
  const t = d.getTime();
  const hit = windowsFor(d.getFullYear()).find(
    (w) => t >= w.start.getTime() && t <= w.end.getTime(),
  );
  return hit ?? null;
}
