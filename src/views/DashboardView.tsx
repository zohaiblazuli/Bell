/**
 * Dashboard — the rebuilt screen. Spec: `design/specs/screen-dashboard.md`, §0 through §8.
 *
 * Four rows on a 20px gap — greeting 44, hero + stats 92, year activity 187, cols 364 — and every
 * width in it is a flex ratio rather than a pinned px (TRAP 22), which is what lands the measured
 * 391.2 / 195.6 and the 585 / 411 column split exactly at 1020 and keeps them proportional
 * anywhere else. The geometry notes are in DashboardView.css; this file owns the numbers.
 *
 * EVERY FIGURE IS MEASURED OR ABSENT. The store keeps focused minutes per ISO date, seconds per
 * paper, the three mark sets and a capped log of what was opened when; the index knows how many
 * papers each subject holds. Anything the spec draws that none of those can answer — the papers
 * plan behind `48 / 96`, an average score, a position inside a paper, a sitting's own paper count —
 * arrives as an optional prop and renders an empty state when it does not. Nothing here estimates,
 * and a fresh install honestly reads zero.
 *
 * Three stored preferences are read rather than asked for, because `store.ts` already declares all
 * three and a second key for the same fact would be the drift: `settings.seasons` (which series the
 * student sits, so the countdown never names a March they cannot enter), `settings.streakMinutes`
 * (the Settings screen's own "focused minutes in a day for it to count" — this screen is the only
 * place that figure is spent) and `onboarding.name` (the flow's `01 Name` answer, which is what
 * makes the greeting read `Good evening, Zohaib`). A prop still overrides each of the first and last.
 *
 * THE ONE SUBSTITUTION worth knowing. The activity ladder is absolute — a colour has to mean the
 * same amount of work in September as in May — but nothing in the app records papers *per day*:
 * `done` is an undated set and the recent log holds 40 entries. So the default series is focused
 * minutes per day, which the store does keep per date and does not cap, on its own absolute ladder.
 * Pass `papersPerDay` and the grid switches to the metric the spec names, with no other change.
 */
import './DashboardView.css';
import { useMemo } from 'react';
import ActivityGrid, { type ActivityDay, type ActivityLevel } from '@ui/ActivityGrid';
import Button from '@ui/Button';
import Card from '@ui/Card';
import CoverageMatrix, { type Coverage, type CoverageRow } from '@ui/CoverageMatrix';
import Meter from '@ui/Meter';
import SectionLabel from '@ui/SectionLabel';
import Stat from '@ui/Stat';
import SubjectIcon from '@ui/icons/SubjectIcon';
import { bandFor, componentLabel, difficultyForScore, sessionLabel } from '@/lib/difficulty';
import { daysUntil, nextWindow, windowsBetween, type Season } from '@/lib/sessions';
import {
  loadFocus,
  loadOnboarding,
  loadRecent,
  loadRows,
  loadSettings,
  type SetName,
} from '@/lib/store';
import type { PaperRow, Subject } from '@/lib/types';

export interface Props {
  /** The clock. Taken rather than read, so the countdown and "this week" are the caller's. */
  now: Date;
  /**
   * Greeted by name. Defaults to `onboarding.name`, the answer the flow's `01 Name` step stores, so
   * the measured `Good evening, Zohaib` needs no prop at all; the greeting drops the comma and the
   * name while that answer is still blank.
   */
  name?: string;
  /**
   * The series the student sits — an A Level student never counts down to a March they cannot enter.
   * Defaults to `settings.seasons`, which is where Settings already keeps them.
   */
  seasons?: Season[];
  /** The index's subjects: the denominator behind every percentage on this screen. */
  subjects: Subject[];
  marks: Record<SetName, Set<string>>;
  onOpen: (paper: PaperRow) => void;
  /** Given, a subject row becomes a button that sends the library to that subject. */
  onSubject?: (subjectId: number) => void;
  /** Papers finished per ISO date. Absent → the grid colours by focused minutes instead. */
  papersPerDay?: Record<string, number>;
  /** The papers plan behind the hero's `48 / 96` bar. No plan, no bar. */
  plan?: { done: number; total: number };
  /** Papers-per-week target — the rail's `4 / week` and the greeting's closing clause. */
  weeklyTarget?: number;
  /** Marked answers do not exist yet (the checker is a seam), so the tile reads `—` without this. */
  averageScore?: { pct: number; deltaPts?: number };
  /** Library-wide mean difficulty per syllabus code. Falls back to the paper snapshots on disk. */
  subjectScores?: Record<string, number | null>;
  /** Papers the index holds per `code/scode`, e.g. `9701/s25`. Without it a coverage cell cannot
   *  honestly read `done` — only `partial`. */
  sittingTotals?: Record<string, number>;
  /** The whole coverage matrix, for a caller that can build a better one than the marks alone. */
  coverage?: CoverageRow[];
  /** How far through the resumed paper, 0–1. Absent → the resume card draws no bar. */
  resumeProgress?: number;
  /** Where you stopped inside it — `question 4 of 7`. Absent → the meta line omits the clause. */
  resumePlace?: string;
}

const DAY_MS = 86_400_000;

/**
 * The measured range is `1 Sep 2025` to `2 Sep 2026` — 366 days back from the day the file was
 * read, which is what yields 53 columns and the 368 cells the rail's `208 / 368` counts. So the
 * window rolls with the clock; `THIS YEAR` means the last one, and the head prints its opening date.
 */
const RANGE_DAYS = 366;

/** Literals, not `Intl`: the screen prints `9 May 2027` and `1 Sep 2025`, and a locale that
 *  abbreviates September as `sept.` would widen both past their measured boxes. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Local parts, deliberately not `toISOString()`, which goes through UTC and can name another day. */
const isoOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const prettyDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

/** Local MIDDAY, offset by whole days — the idiom ActivityGrid and the old Dashboard both use.
 *  Midnight lets a daylight-saving shift or a negative UTC offset move a day across the boundary. */
const midday = (d: Date, offsetDays = 0) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetDays, 12);

/** Local midnight on the Sunday that opens `d`'s week. Sunday because the grid's `d0` is Sunday
 *  (§4), and the screen must not hold two different ideas of which days "this week" contains. */
const weekOpen = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());

const parseIso = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

/** `4h 12m`, `48m`. Minutes in — the focus log stores minutes, never seconds. */
function hm(minutes: number): string {
  const m = Math.round(minutes);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${pad2(m % 60)}m`;
}

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;

/** `2 hours ago` — how the resume card's meta dates the last open (§7a). */
function ago(atMs: number, nowMs: number): string {
  const minutes = Math.max(0, Math.round((nowMs - atMs) / 60_000));
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${plural(minutes, 'minute')} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${plural(hours, 'hour')} ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${plural(days, 'day')} ago`;
  return `${plural(Math.round(days / 7), 'week')} ago`;
}

/**
 * `+6 vs last`, `−48m vs last`. The sign glyph carries the whole story: the system ships no
 * success/danger token and §2b's deltas are deliberately uncoloured, so a fall must be legible as a
 * fall from the string alone — with U+2212 MINUS SIGN, not a hyphen (TRAP 20).
 */
const signed = (delta: number, format: (n: number) => string) =>
  delta === 0 ? 'same as last' : `${delta < 0 ? '−' : '+'}${format(Math.abs(delta))} vs last`;

/**
 * Absolute steps — papers finished in a day — never per-user quantiles. A self-relative scale
 * re-normalises as the year fills and hides exactly the progress the graph exists to show.
 */
const PAPER_STEPS = [1, 2, 4, 6];

/** The same ladder for the fallback series, in focused minutes. Equally absolute. */
const MINUTE_STEPS = [1, 30, 60, 120];

const levelFor = (amount: number, steps: number[]): ActivityLevel =>
  steps.reduce((level, step) => (amount >= step ? level + 1 : level), 0) as ActivityLevel;

/** Current and longest run of consecutive active days, over everything the log has dated. */
function streaksOf(active: Set<string>, clock: Date): { current: number; longest: number } {
  // Today counts once it is earned, but an unearned today must not break yesterday's run — so the
  // walk starts on yesterday when nothing has landed yet.
  let current = 0;
  for (let i = active.has(isoOf(clock)) ? 0 : 1; i < 4000; i += 1) {
    if (!active.has(isoOf(midday(clock, -i)))) break;
    current += 1;
  }

  let longest = 0;
  let run = 0;
  let previous = 0;
  for (const date of [...active].sort()) {
    const at = parseIso(date).getTime();
    run = previous && Math.round((at - previous) / DAY_MS) === 1 ? run + 1 : 1;
    previous = at;
    longest = Math.max(longest, run);
  }
  return { current, longest };
}

/**
 * One subject, rolled up. `pct` and `score` are both nullable because both can genuinely be
 * unknown: a subject the index no longer holds has no denominator, and a subject whose papers have
 * no parsed grade thresholds has no difficulty. Neither is guessed — the row reads `—` / `Unrated`.
 */
interface Roll {
  code: string;
  /** The index's subject id, for the row's click. Null when only a stored snapshot names it. */
  id: number | null;
  name: string;
  /** Papers marked done in this subject. */
  done: number;
  /** Papers the index holds for it. */
  total: number | null;
  pct: number | null;
  /** 0–100 mean difficulty, for `bandFor`. */
  score: number | null;
}

/** The subject code out of a paper key — `9709/s15/12` → `9709`. */
const codeOf = (key: string) => key.split('/')[0] ?? '';

/** And its sitting: `9709/s15/12` → `9709/s15`, the shape `sittingTotals` is keyed by. */
const sittingOf = (key: string) => key.split('/').slice(0, 2).join('/');

export default function DashboardView({
  now,
  name,
  seasons,
  subjects,
  marks,
  onOpen,
  onSubject,
  papersPerDay,
  plan,
  weeklyTarget,
  averageScore,
  subjectScores,
  sittingTotals,
  coverage,
  resumeProgress,
  resumePlace,
}: Props) {
  const nowMs = now.getTime();

  // One stable clock for the whole render. `now` is a fresh object on most parent renders, so every
  // memo below would otherwise rebuild on object identity alone.
  const clock = useMemo(() => new Date(nowMs), [nowMs]);

  const focus = useMemo(() => loadFocus(), []);
  const rows = useMemo(() => loadRows(), []);
  const recent = useMemo(() => loadRecent(), []);
  const settings = useMemo(() => loadSettings(), []);
  const onboarding = useMemo(() => loadOnboarding(), []);

  /** ISO date → level, over every dated day the store holds — not just the ones on the grid. */
  const series = useMemo(() => {
    const source = papersPerDay ?? focus.days;
    const steps = papersPerDay ? PAPER_STEPS : MINUTE_STEPS;
    const out = new Map<string, ActivityLevel>();
    for (const [date, amount] of Object.entries(source)) {
      const level = levelFor(amount, steps);
      if (level > 0) out.set(date, level);
    }
    return out;
  }, [papersPerDay, focus.days]);

  const range = useMemo(() => {
    const from = midday(clock, -RANGE_DAYS);
    const to = midday(clock);
    // Column 0 opens on the Sunday on or before `from`, so up to six slots predate the range. They
    // are ordinary cells and the rail's `208 / 368` counts them, so the denominator includes them
    // too — reproduced here because ActivityGrid keeps the count inside its own model.
    const opened = midday(weekOpen(from));
    return { from, to, cells: Math.round((to.getTime() - opened.getTime()) / DAY_MS) + 1 };
  }, [clock]);

  const days = useMemo(() => {
    const first = isoOf(range.from);
    const last = isoOf(range.to);
    const out: ActivityDay[] = [];
    // ISO dates sort lexicographically, so a string comparison is a date comparison here.
    for (const [date, level] of series) {
      if (date >= first && date <= last) out.push({ date, level });
    }
    return out;
  }, [series, range]);

  /** The exam bands under the grid — what turns a vanity graph into a planning instrument. */
  const bands = useMemo(
    () =>
      windowsBetween(range.from, range.to).map((w) => ({
        from: isoOf(w.start),
        to: isoOf(w.end),
      })),
    [range],
  );

  const activeInRange = days.length;

  /**
   * Days that COUNT, which is deliberately not the set the grid colours. Settings owns the
   * threshold — "Streak threshold · focused minutes in a day for it to count", 1 to 240, default
   * 10 — and this screen is the only place that number is ever spent, so the streak reads it
   * instead of reusing the grid's level-1 boundary of a single minute. It always comes off focused
   * minutes, even when `papersPerDay` is colouring the cells, because minutes are what the setting
   * measures. A day under the threshold therefore breaks the run while still painting a cell: that
   * is what a threshold is for, and both figures say in the UI what they count.
   */
  const counted = useMemo(() => {
    const floor = Math.max(1, settings.streakMinutes);
    const out = new Set<string>();
    for (const [date, minutes] of Object.entries(focus.days)) {
      if (minutes >= floor) out.add(date);
    }
    return out;
  }, [focus.days, settings.streakMinutes]);

  const streaks = useMemo(() => streaksOf(counted, clock), [counted, clock]);

  const sitting = useMemo(
    () => nextWindow(clock, seasons ?? settings.seasons),
    [clock, seasons, settings.seasons],
  );
  /** Zero for every day of an open window: "4 days until an exam that started Monday" is a lie. */
  const daysToExam = sitting ? daysUntil(clock, sitting) : null;

  /**
   * This week against last, on the grid's Sunday-opening week. Both priors are nullable and both
   * tests are about whether a prior period EXISTS rather than whether it was busy: a delta against a
   * week the log cannot see is not a delta, it is a fabrication.
   */
  const week = useMemo(() => {
    const open = weekOpen(clock);
    const prior = new Date(open.getFullYear(), open.getMonth(), open.getDate() - 7);
    const close = new Date(open.getFullYear(), open.getMonth(), open.getDate() + 7);

    const dates = (from: Date) => Array.from({ length: 7 }, (_, i) => isoOf(midday(from, i)));
    const minutes = (from: Date) => dates(from).reduce((t, d) => t + (focus.days[d] ?? 0), 0);
    const recorded = (from: Date) => dates(from).some((d) => (focus.days[d] ?? 0) > 0);

    // Papers OPENED — the only dated paper event the store keeps; `done` carries no timestamps.
    const opened = (fromMs: number, toMs: number) =>
      recent.filter((r) => r.at >= fromMs && r.at < toMs).length;
    // The log is capped at 40 entries, so last week's figure is only trustworthy when the log
    // demonstrably reaches back past it. Otherwise the truncation would read as a quiet week.
    const oldest = recent.reduce((min, r) => Math.min(min, r.at), Infinity);

    return {
      minutes: minutes(open),
      minutesPrior: recorded(prior) ? minutes(prior) : null,
      papers: opened(open.getTime(), close.getTime()),
      papersPrior: oldest < prior.getTime() ? opened(prior.getTime(), open.getTime()) : null,
    };
  }, [clock, focus.days, recent]);

  /** The paper with time already in it, from the recents minus what is done. */
  const resume = useMemo(() => {
    const live = recent.filter((r) => !marks.done.has(r.key) && Boolean(rows[r.key]));
    const pick = live.find((entry) => (focus.papers[entry.key] ?? 0) > 0) ?? live[0];
    if (!pick) return null;
    return {
      at: pick.at,
      paper: rows[pick.key],
      seconds: focus.papers[pick.key] ?? 0,
    };
  }, [recent, marks.done, rows, focus.papers]);

  /**
   * Every subject the student has actually touched — a mark of any kind, or an open — rolled up and
   * sorted WEAKEST FIRST, which is both lists' ordering and the sec-label's own `weakest first`.
   * Untouched subjects are left out: five subjects sitting at 0% would be noise, not information.
   */
  const rolls = useMemo<Roll[]>(() => {
    // Cambridge codes are level-unique, but the index is keyed per subject row, so two rows sharing
    // a code are summed rather than one of them silently winning.
    const indexed = new Map<string, { id: number; name: string; papers: number }>();
    for (const subject of subjects) {
      const seen = indexed.get(subject.code);
      if (seen) seen.papers += subject.papers;
      else indexed.set(subject.code, { id: subject.id, name: subject.name, papers: subject.papers });
    }

    const doneBy = new Map<string, number>();
    for (const key of marks.done) doneBy.set(codeOf(key), (doneBy.get(codeOf(key)) ?? 0) + 1);

    const touched = new Set<string>();
    for (const set of [marks.done, marks.revision, marks.bookmarks]) {
      for (const key of set) touched.add(codeOf(key));
    }
    for (const entry of recent) touched.add(codeOf(entry.key));
    touched.delete('');

    // Mean hardness score over the row snapshots on disk, plus the name they carry for a subject
    // the catalogue has since stopped holding. Partial by nature — the snapshots are only the papers
    // something still points at — so `subjectScores` overrides it outright where a caller has the
    // whole catalogue behind it.
    const scored = new Map<string, { sum: number; n: number }>();
    const named = new Map<string, string>();
    for (const row of Object.values(rows)) {
      named.set(row.subjectCode, row.subjectName);
      if (row.hardnessScore == null) continue;
      const seen = scored.get(row.subjectCode) ?? { sum: 0, n: 0 };
      scored.set(row.subjectCode, { sum: seen.sum + row.hardnessScore, n: seen.n + 1 });
    }

    const out = [...touched].map<Roll>((code) => {
      const index = indexed.get(code);
      const done = doneBy.get(code) ?? 0;
      const total = index?.papers ?? null;
      const mean = scored.get(code);
      const override = subjectScores?.[code];
      return {
        code,
        id: index?.id ?? null,
        name: index?.name ?? named.get(code) ?? code,
        done,
        total,
        pct: total ? Math.round((done / total) * 100) : null,
        score: override !== undefined ? override : mean ? mean.sum / mean.n : null,
      };
    });

    // An unmeasurable percentage sorts last, the same rule §8a applies to its `new` row.
    out.sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101) || a.name.localeCompare(b.name));
    return out;
  }, [subjects, marks, recent, rows, subjectScores]);

  /** §7b draws five rows; the card hugs, so fewer is a shorter card rather than a padded one. */
  const progressRows = useMemo(() => rolls.slice(0, 5), [rolls]);

  /**
   * §8a — the same rollup, narrowed to the subjects with something flagged, and re-sorted so the
   * rows that read `new` fall to the bottom. `new` means nothing done yet, which sorts FIRST on raw
   * percentage and last in the file.
   */
  const reviewRows = useMemo(() => {
    const flagged = new Set([...marks.revision].map(codeOf));
    const rank = (r: Roll) => (r.done > 0 && r.pct != null ? r.pct : 101);
    return rolls
      .filter((r) => flagged.has(r.code))
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
      .slice(0, 4);
  }, [rolls, marks.revision]);

  /**
   * The eight sitting codes §8b heads its columns with — the most recent windows that have actually
   * closed. Three years back is more than enough to find eight, and every season is allowed here
   * whatever the student sits, because the library holds all three.
   */
  const sessions = useMemo(() => {
    const back = new Date(clock.getFullYear() - 3, clock.getMonth(), clock.getDate());
    return windowsBetween(back, clock)
      .filter((w) => w.end.getTime() <= clock.getTime())
      .slice(-8)
      .map((w) => w.code);
  }, [clock]);

  const matrix = useMemo<CoverageRow[]>(() => {
    if (coverage) return coverage;

    const done = new Map<string, number>();
    for (const key of marks.done) done.set(sittingOf(key), (done.get(sittingOf(key)) ?? 0) + 1);

    // Alphabetical, which is §8b's own ordering and deliberately not the weakest-first the two lists
    // use — over the same five subjects the progress list shows, so the modules cannot disagree
    // about which subjects are in play.
    return progressRows
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((roll) => ({
        code: roll.code,
        name: roll.name,
        icon: <SubjectIcon code={roll.code} size={14} className="db-cov-icon" />,
        cells: sessions.map((scode): Coverage => {
          const marked = done.get(`${roll.code}/${scode}`) ?? 0;
          if (marked === 0) return 'none';
          // `done` claims a whole sitting is behind you, so it needs that sitting's paper count.
          // Without one the honest ceiling is `partial` — and since CoverageMatrix's `n/8` counts
          // only `done`, such a row reads `0/8`, exactly as the file's own Biology row does.
          const total = sittingTotals?.[`${roll.code}/${scode}`];
          return total != null && marked >= total ? 'done' : 'partial';
        }),
      }));
  }, [coverage, progressRows, sessions, marks.done, sittingTotals]);

  const hour = clock.getHours();
  const partOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  // `onboarding.name` is the flow's own `01 Name` answer and the only name the app holds; a second
  // `profile.name` key for the same fact would just be two places to keep in step. Blank until the
  // flow has been through, and then the greeting reads exactly as §1 measures it.
  const who = (name ?? onboarding.name).trim();
  const greeting = `Good ${partOfDay}${who ? `, ${who}` : ''}`;

  const subline = useMemo(() => {
    if (!resume) return 'Nothing open yet — pick a paper from the library and it lands here.';
    const paper = resume.paper;
    const variant = paper.component ? ` ${componentLabel(paper.component)}` : '';
    const session = sessionLabel(paper.scode);
    const next = `Next up — ${paper.subjectName} ${paper.subjectCode}, ${session}${variant}.`;
    if (weeklyTarget == null) return next;
    // Curly apostrophe in `week’s`, as measured (TRAP 20).
    const left = plural(Math.max(0, weeklyTarget - week.papers), 'paper');
    return `${next} ${left} left in this week’s plan.`;
  }, [resume, weeklyTarget, week.papers]);

  /** `May/June 2015  ·  opened 2 hours ago  ·  18m on the clock` — double spaces round each dot. */
  const resumeMeta = resume
    ? [
        sessionLabel(resume.paper.scode),
        `opened ${ago(resume.at, nowMs)}`,
        resume.seconds >= 60 ? `${hm(resume.seconds / 60)} on the clock` : null,
        resumePlace ?? null,
      ]
        .filter(Boolean)
        .join('  ·  ')
    : '';

  // Each prior is read into a local first: the delta only exists if the prior period does, and
  // hoisting it makes that the plain shape of the expression rather than a narrowing to trust.
  const papersPrior = week.papersPrior;
  const minutesPrior = week.minutesPrior;
  const deltaPts = averageScore?.deltaPts;

  const papersDelta =
    papersPrior == null ? undefined : signed(week.papers - papersPrior, (n) => `${n}`);
  const minutesDelta =
    minutesPrior == null
      ? undefined
      : signed(Math.round(week.minutes) - Math.round(minutesPrior), hm);
  // A zero delta reads as a zero delta, which is the same rule `signed` applies to the other two
  // tiles: a sign glyph pointing nowhere says less than the words do.
  const scoreDelta =
    deltaPts == null
      ? undefined
      : deltaPts === 0
        ? 'same as last'
        : `${deltaPts < 0 ? '−' : '+'}${Math.abs(deltaPts)} pts`;

  const railTiles = [
    { value: plural(streaks.current, 'day'), caption: 'current streak' },
    { value: plural(streaks.longest, 'day'), caption: 'longest streak' },
    { value: `${activeInRange} / ${range.cells}`, caption: 'days active' },
    { value: weeklyTarget != null ? `${weeklyTarget} / week` : '—', caption: 'your target' },
  ];

  const sat = matrix.reduce((t, r) => t + r.cells.filter((c) => c === 'done').length, 0);
  const cells = matrix.reduce((t, r) => t + r.cells.length, 0);

  return (
    <div className="view">
      <div className="db">
        {/* §1 — SF Pro Semibold 20 is one of the two documented off-ramp sizes, so it names
            `.t-greeting` rather than re-deriving a size here. */}
        <div className="db-greet">
          <h1 className="db-greet-title t-greeting">{greeting}</h1>
          <p className="db-greet-sub t-body-small">{subline}</p>
        </div>

        {/* §2 — one 92-tall row, grow 2 : 1 : 1 : 1 over a 14 gap. */}
        <section className="db-top" aria-label="This week">
          {/* §2a. The figure is Geist Mono SemiBold 26 — the other off-ramp size, `.t-mono-hero`. */}
          <div className="db-hero">
            <span className="db-hero-cap t-label-stat">days to your next sitting</span>
            <span className="db-hero-value">
              <span className="db-hero-num t-mono-hero">{daysToExam ?? '—'}</span>
              <span className="db-hero-date t-body-meta">
                {sitting ? prettyDate(sitting.start) : 'no sitting ahead'}
              </span>
            </span>
            {/* The 50/50 grow pair the file draws behind `48 / 96`. There is no plan in the store,
                so without one the row is simply absent — a bar at zero would read as no progress
                rather than as no plan. */}
            {plan && (
              <span className="db-hero-plan">
                <Meter value={plan.total > 0 ? plan.done / plan.total : 0} />
                <span className="db-hero-plan-count t-mono-small">
                  {plan.done} / {plan.total}
                </span>
              </span>
            )}
          </div>

          {/* §2b. A delta only appears where a real prior period exists to compare against, so a
              first week shows a figure and no trend rather than `+0`. */}
          <Stat
            className="db-stat"
            value={week.papers}
            caption="papers opened this week"
            delta={papersDelta}
          />
          <Stat
            className="db-stat"
            value={hm(week.minutes)}
            caption="focused this week"
            delta={minutesDelta}
          />
          <Stat
            className="db-stat"
            value={averageScore ? `${Math.round(averageScore.pct)}%` : '—'}
            caption="average score"
            delta={scoreDelta}
          />
        </section>

        {/* §3 + §4 — ActivityGrid owns the 714 x 130 graph; the card, its head and the 246 rail are
            this screen's. The ladder is absolute, so nothing here normalises against the user. */}
        <section
          className="db-mod"
          aria-label={`Activity over the last year, coloured by ${
            papersPerDay ? 'papers finished' : 'minutes focused'
          } each day`}
        >
          <Card className="db-year">
            <div className="db-year-head">
              <span className="db-year-label t-label-section">this year</span>
              <span className="db-year-strut" />
              <span className="db-year-range t-body-meta">{prettyDate(range.from)} — today</span>
            </div>

            <div className="db-year-main">
              <div className="db-graph">
                <ActivityGrid
                  days={days}
                  bands={bands}
                  from={isoOf(range.from)}
                  to={isoOf(range.to)}
                />
                <span className="db-graph-note t-body-meta">Bands mark exam sessions</span>
              </div>

              <div className="db-rail">
                {[railTiles.slice(0, 2), railTiles.slice(2)].map((row) => (
                  <div className="db-rail-row" key={row[0].caption}>
                    {row.map((tile) => (
                      <div className="db-rail-tile" key={tile.caption}>
                        <span className="db-rail-value t-mono-stat">{tile.value}</span>
                        <span className="db-rail-cap t-label-stat">{tile.caption}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </section>

        {/* §5 — 585 : 411 over a 24 gutter, both columns top-aligned. */}
        <div className="db-cols">
          <div className="db-col">
            {/* §7a */}
            <section className="db-mod" aria-label="Continue">
              <SectionLabel label="continue" />
              {resume ? (
                <Card className="db-resume">
                  <SubjectIcon
                    code={resume.paper.subjectCode}
                    size={28}
                    className="db-resume-icon"
                  />
                  <span className="db-resume-body">
                    <span className="db-resume-id">
                      <span className="db-resume-name t-title-card">
                        {resume.paper.subjectName}
                      </span>
                      <span className="db-resume-code t-mono-meta">
                        {resume.paper.subjectCode}
                        {resume.paper.variant ? ` /${resume.paper.variant}` : ''}
                      </span>
                    </span>
                    <span className="db-resume-meta t-body-meta">{resumeMeta}</span>
                    {/* The one meter on this screen whose figure is NOT printed beside it — the
                        others sit next to `48 / 96` and `61%` and are `aria-hidden` for that
                        reason — so this one carries a name and reads as a real progressbar. */}
                    {resumeProgress != null && (
                      <Meter value={resumeProgress} label="Progress through this paper" />
                    )}
                  </span>
                  <Button
                    variant="primary"
                    icon="play"
                    label="Resume"
                    onClick={() => onOpen(resume.paper)}
                  />
                </Card>
              ) : (
                <Card>
                  <span className="db-empty t-body-meta">
                    Nothing on the go. Open a paper from the library and it lands here with the
                    minutes you have already put into it, and stays until you mark it done.
                  </span>
                </Card>
              )}
            </section>

            {/* §7b — weakest first. The difficulty word is the PAPER difficulty band, independent of
                progress, and it is a word alone: §7b measures a 58px slot with no pips, so this is
                `bandFor` plus `.t-label-difficulty` rather than the DifficultyBadge pill, which
                is a different node (components-data.md §3) and would not fit the 34-tall row. */}
            <section className="db-mod" aria-label="Subject progress">
              <SectionLabel label="subject progress" meta="weakest first" />
              {progressRows.length > 0 ? (
                <Card padding="list" className="db-progress">
                  {progressRows.map((roll) => {
                    const band = bandFor(difficultyForScore(roll.score));
                    const id = roll.id;
                    const body = (
                      <>
                        <SubjectIcon code={roll.code} size={18} className="db-prow-icon" />
                        <span className="db-prow-name t-body-chip">{roll.name}</span>
                        <span
                          className="db-prow-band t-label-difficulty"
                          style={{ color: band.color }}
                        >
                          {band.label}
                        </span>
                        <Meter value={(roll.pct ?? 0) / 100} />
                        <span className="db-prow-pct t-mono-small">
                          {roll.pct == null ? '—' : `${roll.pct}%`}
                        </span>
                      </>
                    );
                    return onSubject && id != null ? (
                      <button
                        key={roll.code}
                        type="button"
                        className="db-prow"
                        onClick={() => onSubject(id)}
                        title={`Show ${roll.name} in the library`}
                      >
                        {body}
                      </button>
                    ) : (
                      <div key={roll.code} className="db-prow">
                        {body}
                      </div>
                    );
                  })}
                </Card>
              ) : (
                <Card>
                  <span className="db-empty t-body-meta">
                    No subject has been worked yet. Marking a paper done is what fills these bars.
                  </span>
                </Card>
              )}
            </section>
          </div>

          <div className="db-col db-col--right">
            {/* §8a — the revision marks, rolled up to the subject the file's own rows name, with the
                unscored `new` rows last. */}
            <section className="db-mod" aria-label="Due for review">
              <SectionLabel label="due for review" />
              {reviewRows.length > 0 ? (
                <Card padding="list" className="db-review">
                  {reviewRows.map((roll) => {
                    const band = bandFor(difficultyForScore(roll.score));
                    const id = roll.id;
                    const body = (
                      <>
                        <SubjectIcon code={roll.code} size={16} className="db-rrow-icon" />
                        <span className="db-rrow-name t-body-chip">{roll.name}</span>
                        <span className="db-rrow-code t-mono-small">{roll.code}</span>
                        <span className="db-rrow-strut" />
                        <span className="db-rrow-pct t-mono-small">
                          {/* Three states, not two. `new` is the file's own word for "nothing done
                              here yet" (§8a's Biology row), so a subject that HAS done papers but
                              no denominator — one the index has stopped holding — reads `—` for
                              unknown, the way §7b's pct does. Either way `rank` sorts it last. */}
                          {roll.done === 0 ? 'new' : roll.pct == null ? '—' : `${roll.pct}%`}
                        </span>
                        <span
                          className="db-rrow-band t-label-difficulty"
                          style={{ color: band.color }}
                        >
                          {band.label}
                        </span>
                      </>
                    );
                    return onSubject && id != null ? (
                      <button
                        key={roll.code}
                        type="button"
                        className="db-rrow"
                        onClick={() => onSubject(id)}
                        title={`Show ${roll.name} in the library`}
                      >
                        {body}
                      </button>
                    ) : (
                      <div key={roll.code} className="db-rrow">
                        {body}
                      </div>
                    );
                  })}
                </Card>
              ) : (
                <Card>
                  <span className="db-empty t-body-meta">
                    Nothing flagged for revision. Flag a paper in the library and its subject queues
                    up here.
                  </span>
                </Card>
              )}
            </section>

            {/* §8b — CoverageMatrix owns the shared column track and the three cell states; the five
                rows are alphabetical, which is this module's ordering alone. `n/8` counts fully sat
                sittings only, so the sec-label's total is the sum of those counts. */}
            <section className="db-mod" aria-label="Session coverage">
              <SectionLabel
                label="session coverage"
                meta={cells > 0 ? `${sat} of ${cells} sat` : undefined}
              />
              {matrix.length > 0 ? (
                <Card padding="coverage">
                  <CoverageMatrix sessions={sessions} rows={matrix} />
                </Card>
              ) : (
                <Card>
                  <span className="db-empty t-body-meta">
                    No sitting to show yet. A subject appears here once one of its papers is marked
                    done.
                  </span>
                </Card>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
