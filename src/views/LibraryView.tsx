/**
 * Past Papers, Bookmarks and Recent — one component, three compositions (Bell App v2).
 *
 *   library    Filters bar · year headers ("2025  36 papers") · Paper Card grid
 *   bookmarks  Filters bar · subject headers ("Physics  6 saved") · the same grid
 *   recent     week summary + cards/list toggle · day-bucket headers · a ruled row list, or the grid
 *
 * The Filters bar collapses: a solid Filters button with the active count, a one-line summary while
 * collapsed ("A Level · May/June · P3") and Clear all. Open, it shows the level chips, the season
 * chips with their glyphs, a P1–P6 toggle for the paper number, the subject chip, and chips for the
 * Done / Revision lists. There is no Downloaded chip any more — every card says Solve or Download.
 *
 * THE DATA PATH IS UNCHANGED. `papers` still arrives already resolved by `App`: for a marked list
 * that is the store's row snapshots (`loadRows()`), never the live query. The only store reads here
 * are Recent's open timestamps and the focus log.
 */
import './LibraryView.css';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Notice from '@ui/Notice';
import PaperCard from '@ui/PaperCard';
import SeasonIcon from '@ui/icons/SeasonIcon';
import SubjectIcon from '@ui/icons/SubjectIcon';
import Mascot from '@/components/Mascot';
import { bandFor, bandSteps, sessionLabel } from '@/lib/difficulty';
import { availablePaperNumbers, filterByPaperNumber } from '@/lib/libraryFilters';
import { loadFocus, loadRecent, paperKey, type MarkFilter, type SetName } from '@/lib/store';
import type { PaperRow, Subject } from '@/lib/types';

export type LibraryMode = 'library' | 'bookmarks' | 'recent';

const LEVELS = ['A Level', 'IGCSE', 'O Level'] as const;

const SEASONS = [
  { key: 's', label: 'May/June' },
  { key: 'w', label: 'Oct/Nov' },
  { key: 'm', label: 'Feb/Mar' },
] as const;

const SEASON_TINT: Record<string, string> = { s: 'var(--t-gold)', w: 'var(--t-blue)', m: 'var(--t-red)' };

const FILTER_LABEL: Record<Exclude<MarkFilter, null>, string> = {
  bookmarks: 'Bookmarked',
  done: 'Done',
  revision: 'Flagged for revision',
  recent: 'Recently opened',
};

const MARK_CHIPS: { name: SetName; glyph: string; label: string }[] = [
  { name: 'done', glyph: '✓', label: 'Done' },
  { name: 'revision', glyph: '↻', label: 'Revision' },
];

const BUCKETS = [
  { label: 'Today', within: 0 },
  { label: 'Yesterday', within: 1 },
  { label: 'Earlier this week', within: 6 },
  { label: 'Older', within: Number.POSITIVE_INFINITY },
] as const;

const DAY_MS = 86_400_000;

/**
 * How many cards or rows go on screen at a time. A student's subjects can hold well over a thousand
 * papers, and mounting every card at once — each dealing itself in — is what stalled the page and
 * held hundreds of megabytes of DOM. The next chunk mounts as the sentinel under the list nears the
 * bottom of the scroller, so the page only ever carries what has been scrolled to.
 */
const CHUNK = 48;

/** Only the first screenful is dealt onto the table; a card mounted by scrolling simply appears. */
const DEALT = 15;

/** Local midnight, so a bucket boundary is a calendar day rather than a rolling 24 hours. */
const startOfDay = (at: number) => {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Whole calendar days back. `Math.round` absorbs the 23- and 25-hour days either side of a DST shift. */
const daysAgo = (at: number) => Math.round((startOfDay(Date.now()) - startOfDay(at)) / DAY_MS);

/** The row's trailing slot — the file's own vocabulary: `2h ago`, `1d ago`, `4d ago`. */
function elapsedLabel(at: number): string {
  const minutes = Math.floor((Date.now() - at) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** `9h 48m`, as the head line in §6 reads it. Same shape as `DashboardView`'s `hm` over the same log. */
const focusLabel = (minutes: number) => {
  const m = Math.round(minutes);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${pad2(m % 60)}m`;
};

/**
 * The card's `documents` string. Only the EXTRAS are listed: the question paper is what the card
 * opens, which is why no card in either spec ever says "question paper" and why §5.4 records the
 * QP/MS/ER badges as cut.
 *
 * Now that the catalogue lists papers that are not on this machine, this line also has to
 * distinguish three states that used to be one. `hasMs` comes from the catalogue and means a mark
 * scheme *exists*; `msPath` means it has been fetched.
 */
function documentsOf(paper: PaperRow): string | undefined {
  if (!paper.qpPath) return 'not downloaded';
  if (paper.msPath) return 'mark scheme';
  return paper.hasMs ? 'mark scheme available' : undefined;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * A date as the focus log keys it, from LOCAL parts. **Never `toISOString()`** — that goes through
 * UTC and names the day before past UTC+12, which would slide all seven days read below by one and
 * leave this head line disagreeing with the Dashboard's figure over the very same week.
 * `Heatmap` and `DashboardView` build the key exactly this way, and one log cannot mean two
 * things.
 */
const focusDayKey = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * §6's head line, reworded. The file reads "24 sessions in the last 7 days · 9h 48m total" and
 * neither figure is one this app holds: `loadRecent()` keeps one entry per paper rather than per
 * sitting, and the focus log counts minutes the timer actually ran. Calling those "sessions" and
 * "total" would be a guess wearing a measurement's clothes.
 */
function weekSummary(): { opened: number; minutes: number } {
  const opened = loadRecent().filter((r) => daysAgo(r.at) <= 6).length;
  const days = loadFocus().days;
  const now = new Date();
  let minutes = 0;
  for (let i = 0; i < 7; i += 1) {
    // Local MIDDAY, offset by whole days, so a DST shift cannot slide a date across its own
    // boundary — the idiom `Heatmap` and `DashboardView` both use on this same log.
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 12);
    minutes += days[focusDayKey(d)] ?? 0;
  }
  return { opened, minutes };
}

/**
 * Why a list is empty, in the list's own terms. An empty index, a filter that matches nothing and a
 * mark set nobody has put anything in yet are three different facts, and one sentence covering all
 * three would be true of none of them.
 */
function emptyCopy(state: {
  mode: LibraryMode;
  bareMark: 'done' | 'revision' | null;
  indexEmpty: boolean;
  /** How many rows arrived before this screen's own filters ran. */
  arrived: number;
}): { head: string; detail: string } {
  if (state.indexEmpty)
    return {
      head: 'No catalogue yet',
      detail:
        'The catalogue has not arrived yet. Sync it from the top bar — it needs the network once, then works offline.',
    };
  // Nothing arrived at all, so the set behind the screen is empty — the filters are not to blame.
  if (state.arrived === 0) {
    if (state.mode === 'bookmarks')
      return {
        head: 'No bookmarks yet',
        detail: 'The bookmark at the top of a paper card saves it here.',
      };
    if (state.mode === 'recent')
      return {
        head: 'Nothing opened yet',
        detail: 'Papers you open show up here, newest first.',
      };
    if (state.bareMark)
      return {
        head: `Nothing ${FILTER_LABEL[state.bareMark].toLowerCase()} yet`,
        detail: 'Set the mark on a paper card and it lands in this list.',
      };
  }
  return {
    head: 'No papers match these filters',
    detail: 'Clear a level, session, paper or subject to widen the search.',
  };
}

/** One headed run of cards or rows. `meta` is the header's mono count, which differs per mode. */
interface Group {
  id: string;
  label: string;
  meta: string;
  rows: PaperRow[];
}

/**
 * One card in the grid, memoised on primitives. `PaperCard` is memoised too, but it takes closures
 * and an icon element, which are new on every render — so without this layer a single download
 * tick re-rendered every card on the page. The three callbacks here are stable (see `LibraryView`).
 */
interface LibraryCardProps {
  paper: PaperRow;
  index: number;
  deal: boolean;
  bookmarked: boolean;
  done: boolean;
  revision: boolean;
  downloading: boolean;
  onMark: (name: SetName, key: string, paper: PaperRow) => void;
  onOpen: (paper: PaperRow) => void;
  onDownload: (paper: PaperRow) => void;
}

const LibraryCard = memo(function LibraryCard({
  paper,
  index,
  deal,
  bookmarked,
  done,
  revision,
  downloading,
  onMark,
  onOpen,
  onDownload,
}: LibraryCardProps) {
  const key = paperKey(paper.subjectCode, paper.scode, paper.component);
  return (
    <PaperCard
      subject={paper.subjectName}
      subjectCode={paper.subjectCode}
      variant={paper.component}
      scode={paper.scode}
      session={sessionLabel(paper.scode)}
      documents={documentsOf(paper)}
      band={bandFor(paper.difficulty)}
      steps={bandSteps(paper.difficulty)}
      icon={<SubjectIcon code={paper.subjectCode} size={26} />}
      index={index}
      deal={deal}
      marks={{ bookmarked, done, revision }}
      onMark={(m) => onMark(m === 'bookmarked' ? 'bookmarks' : m, key, paper)}
      onOpen={() => onOpen(paper)}
      downloaded={Boolean(paper.qpPath)}
      downloading={downloading}
      onDownload={() => onDownload(paper)}
    />
  );
});

export interface Props {
  /** Which composition to draw; derived from `markFilter` when absent. */
  mode?: LibraryMode;
  /** Already resolved by `App` — the live query, or the store's row snapshots for a marked list. */
  papers: PaperRow[];
  /** The sidebar's subject list; used only to name the active subject's chip. */
  subjects: Subject[];
  loading: boolean;
  level: string | null;
  onLevel: (l: string | null) => void;
  /** Session-code letter, not a label: `s` | `w` | `m`. */
  season: string | null;
  onSeason: (s: string | null) => void;
  /** Cambridge paper number: P4 includes components 41, 42, 43, and so on. */
  paperNumber: number | null;
  onPaperNumber: (paper: number | null) => void;
  subjectId: number | null;
  onSubject: (id: number | null) => void;
  marks: Record<SetName, Set<string>>;
  /** `key` is `paperKey(...)`; `paper` is passed so the store can snapshot the row it marked. */
  onMark: (name: SetName, key: string, paper: PaperRow) => void;
  markFilter: MarkFilter;
  onMarkFilter: (m: MarkFilter) => void;
  onOpen: (p: PaperRow) => void;
  /** Fetch a paper that is not on disk yet. */
  onDownload: (p: PaperRow) => void;
  /** Paper ids with a download in flight. */
  downloading: Set<number>;
  error: string | null;
}

export default function LibraryView({
  mode: modeProp,
  papers,
  subjects,
  loading,
  level,
  onLevel,
  season,
  onSeason,
  paperNumber,
  onPaperNumber,
  subjectId,
  onSubject,
  marks,
  onMark,
  markFilter,
  onMarkFilter,
  onOpen,
  onDownload,
  downloading,
  error,
}: Props) {
  const [asCards, setAsCards] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const mode: LibraryMode =
    modeProp ??
    (markFilter === 'bookmarks' ? 'bookmarks' : markFilter === 'recent' ? 'recent' : 'library');

  /**
   * Done and Flagged-for-revision are mark sets with no screen of their own. They borrow this shell
   * and replace the chip row with a way back, which is what the shipped Library already did.
   */
  const bareMark: 'done' | 'revision' | null =
    markFilter === 'done' || markFilter === 'revision' ? markFilter : null;

  /** Recent's toolbar is a head line, not chips (§6), and a marked-set escape hatch has none either. */
  const filterable = mode !== 'recent' && bareMark === null;

  const activeSubject = subjects.find((s) => s.id === subjectId) ?? null;

  /**
   * Paper choices follow the rows already scoped by the sidebar, qualification, session and local
   * download state. They are calculated before the paper-number pass, so selecting P4 never makes
   * P1/P2/P3 disappear and the user can change their mind without first clearing the filter.
   */
  const paperNumbers = useMemo(() => {
    if (mode !== 'library') return [];
    let rows = papers;
    if (level) rows = rows.filter((paper) => paper.level === level);
    if (season) rows = rows.filter((paper) => paper.scode.startsWith(season));
    return availablePaperNumbers(rows, paperNumber);
  }, [papers, mode, level, season, paperNumber]);

  /**
   * Level and season are applied here, not upstream: `App` narrows `listPapers` by level and
   * subject, and narrows a snapshot list by nothing at all. Running the level pass in every mode —
   * rather than only where it is load-bearing — costs one redundant walk over rows that already
   * satisfy it and removes the case where the query and this screen disagree. Both chips are on
   * screen wherever this runs, so neither is ever an inert control.
   */
  const { groups, total, openedAt } = useMemo(() => {
    let rows = papers;
    if (filterable) {
      if (level) rows = rows.filter((p) => p.level === level);
      if (season) rows = rows.filter((p) => p.scode.startsWith(season));
      if (mode === 'library') rows = filterByPaperNumber(rows, paperNumber);
    }

    // Recent's open times. `App` resolves `loadRecent()` into rows and drops the `at` it looked them
    // up by, so they are read back here — the same synchronous, already-hydrated cache
    // `DashboardView` reads, keyed off `papers`, which is rebuilt from this same list.
    const at = new Map<string, number>();
    if (mode === 'recent') for (const r of loadRecent()) at.set(r.key, r.at);

    const out: Group[] = [];

    if (mode === 'recent') {
      const buckets: PaperRow[][] = BUCKETS.map(() => []);
      for (const p of rows) {
        const opened = at.get(paperKey(p.subjectCode, p.scode, p.component));
        // A snapshot can outlive the entry that dated it; undated rows fall to the last bucket
        // rather than disappearing out of a list the user can see the count of.
        const days = opened == null ? Number.POSITIVE_INFINITY : daysAgo(opened);
        buckets[BUCKETS.findIndex((b) => days <= b.within)].push(p);
      }
      BUCKETS.forEach((bucket, i) => {
        if (buckets[i].length)
          out.push({
            id: bucket.label,
            label: bucket.label,
            meta: plural(buckets[i].length, 'paper'),
            rows: buckets[i],
          });
      });
    } else if (mode === 'bookmarks') {
      // Headed by SUBJECT, not by year — §5 heads its two groups `ACCOUNTING` and `PHYSICS`.
      // Keyed on the code because Cambridge reissues a subject's name under a code per level.
      const bySubject = new Map<string, PaperRow[]>();
      for (const p of rows) {
        const list = bySubject.get(p.subjectCode);
        if (list) list.push(p);
        else bySubject.set(p.subjectCode, [p]);
      }
      out.push(
        ...[...bySubject.values()]
          .sort((a, b) => b.length - a.length || a[0].subjectName.localeCompare(b[0].subjectName))
          .map((list) => ({
            id: list[0].subjectCode,
            label: list[0].subjectName,
            meta: `${list.length} saved`,
            rows: list,
          })),
      );
    } else {
      const byYear = new Map<number, PaperRow[]>();
      for (const p of rows) {
        const list = byYear.get(p.year);
        if (list) list.push(p);
        else byYear.set(p.year, [p]);
      }
      out.push(
        ...[...byYear.entries()]
          .sort((a, b) => b[0] - a[0])
          .map(([year, list]) => ({
            id: String(year),
            label: String(year),
            meta: plural(list.length, 'paper'),
            rows: list,
          })),
      );
    }

    return { groups: out, total: rows.length, openedAt: at };
  }, [papers, mode, level, season, paperNumber, filterable]);

  /** Is anything on this screen currently narrowing the list? The empty state hangs on the answer. */
  const narrowed =
    filterable &&
    (level !== null ||
      season !== null ||
      (mode === 'library' && paperNumber !== null) ||
      (mode === 'library' && subjectId !== null));

  /**
   * Nothing arrived and nothing was asked to narrow it, so the index is empty rather than the filters
   * being too tight. `App` queries `listPapers` with no level and no subject in that case and takes
   * up to 600 rows, so an empty answer is an empty index — not a page that was missed.
   */
  const indexEmpty = mode === 'library' && bareMark === null && !narrowed && papers.length === 0;
  const empty = emptyCopy({ mode, bareMark, indexEmpty, arrived: papers.length });
  const week = mode === 'recent' ? weekSummary() : null;

  /**
   * The chip row appears when there is a list to narrow — or when a chip is what emptied it, because
   * hiding the row then would trap the user behind a filter with no control left to clear it. Over an
   * unfiltered empty index or an empty bookmark set every chip is inert, so it waits.
   */
  const showChips = filterable && (papers.length > 0 || narrowed);

  /**
   * How many rows are mounted. It starts over whenever the question changes — a filter, a subject, a
   * list — but NOT when `papers` is merely re-queried: a download re-runs the query, and collapsing
   * the page under someone scrolled halfway down it would be worse than the lag this fixes.
   * Reset during render rather than in an effect, so the first frame of a new filter is already small.
   */
  const scope = `${mode}|${markFilter}|${level}|${season}|${paperNumber}|${subjectId}|${asCards}`;
  const [budget, setBudget] = useState({ scope, n: CHUNK });
  let visible = budget.n;
  if (budget.scope !== scope) {
    visible = CHUNK;
    setBudget({ scope, n: CHUNK });
  }

  /** `groups`, cut down to the budget. Headers keep the full count in `meta`, so the numbers stay true. */
  const mounted = useMemo(() => {
    const out: (Group & { offset: number })[] = [];
    let offset = 0;
    for (const group of groups) {
      if (offset >= visible) break;
      const rows = group.rows.length <= visible - offset ? group.rows : group.rows.slice(0, visible - offset);
      out.push({ ...group, rows, offset });
      offset += rows.length;
    }
    return out;
  }, [groups, visible]);
  const more = visible < total;

  const scroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!more || !el) return;
    // Rebuilt after every chunk: a fresh observer reports at once, so a tall window keeps filling
    // until the sentinel is genuinely out of reach.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setBudget((b) => ({ ...b, n: b.n + CHUNK }));
      },
      { root: scroller.current, rootMargin: '0px 0px 1200px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [more, visible]);

  /**
   * `App`'s handlers are rebuilt on most of its renders, so the cards get stable wrappers that read
   * the latest ones through a ref. That is what lets `LibraryCard`'s memo hold.
   */
  const latest = useRef({ onMark, onOpen, onDownload });
  latest.current = { onMark, onOpen, onDownload };
  const markCard = useCallback(
    (name: SetName, key: string, paper: PaperRow) => latest.current.onMark(name, key, paper),
    [],
  );
  const openCard = useCallback((paper: PaperRow) => latest.current.onOpen(paper), []);
  const downloadCard = useCallback((paper: PaperRow) => latest.current.onDownload(paper), []);

  const cardFor = (paper: PaperRow, index: number) => {
    const key = paperKey(paper.subjectCode, paper.scode, paper.component);
    return (
      <LibraryCard
        key={`${key}/${paper.level}`}
        paper={paper}
        index={index}
        deal={index < DEALT}
        bookmarked={marks.bookmarks.has(key)}
        done={marks.done.has(key)}
        revision={marks.revision.has(key)}
        downloading={downloading.has(paper.id)}
        onMark={markCard}
        onOpen={openCard}
        onDownload={downloadCard}
      />
    );
  };

  const rowFor = (paper: PaperRow) => {
    const key = paperKey(paper.subjectCode, paper.scode, paper.component);
    const band = bandFor(paper.difficulty);
    const steps = bandSteps(paper.difficulty);
    const at = openedAt.get(key);
    return (
      <button
        type="button"
        key={`${key}/${paper.level}`}
        className="lv-row"
        title={`Open ${paper.subjectName} ${paper.subjectCode}/${paper.component}`}
        onClick={() => onOpen(paper)}
      >
        <SubjectIcon code={paper.subjectCode} size={18} />
        <span className="lv-row-subject">{paper.subjectName}</span>
        <span className="lv-row-code">
          {paper.subjectCode} /{paper.component}
        </span>
        <span className="lv-row-session">{sessionLabel(paper.scode)}</span>
        <span />
        <span className="lv-row-band">
          <span className="lv-steps" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <i key={n} style={{ background: n <= steps ? band.color : undefined }} />
            ))}
          </span>
          {band.label}
        </span>
        <span className="lv-row-elapsed">{at == null ? '' : elapsedLabel(at)}</span>
        <span aria-hidden="true">→</span>
      </button>
    );
  };

  const activeCount =
    [level, season, mode === 'library' ? paperNumber : null, mode === 'library' ? activeSubject : null].filter((v) => v != null).length;
  const summary = [
    level,
    season ? SEASONS.find((s) => s.key === season)?.label : null,
    mode === 'library' && paperNumber != null ? `P${paperNumber}` : null,
    mode === 'library' ? activeSubject?.name : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const clearAll = () => {
    onLevel(null);
    onSeason(null);
    onPaperNumber(null);
    onSubject(null);
  };

  return (
    <div className="view" ref={scroller}>
      <div className="lv">
        {error && <Notice className="lv-error">{error}</Notice>}

        {week && papers.length > 0 && (
          <div className="lv-head">
            <span>
              {plural(week.opened, 'paper')} opened in the last 7 days · {focusLabel(week.minutes)} focused
            </span>
            <span className="lv-strut" />
            <div className="lv-toggle" role="group" aria-label="Recent layout">
              <button type="button" aria-pressed={asCards} title="Show as cards" onClick={() => setAsCards(true)}>
                <i className="lv-toggle-cards" />
              </button>
              <button type="button" aria-pressed={!asCards} title="Show as a list" onClick={() => setAsCards(false)}>
                <i className="lv-toggle-list" />
              </button>
            </div>
          </div>
        )}

        {showChips && (
          <div className="lv-filters">
            <div className="lv-filterbar">
              <button type="button" className="lv-filters-btn" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((o) => !o)}>
                Filters
                {activeCount > 0 && <span className="lv-filters-count">{activeCount}</span>}
                <i className="lv-chev" data-open={filtersOpen ? 'true' : undefined} />
              </button>
              {!filtersOpen && <span className="lv-summary">{summary || 'All papers'}</span>}
              {activeCount > 0 && (
                <button type="button" className="lv-clear" onClick={clearAll}>
                  Clear all
                </button>
              )}
            </div>

            {filtersOpen && (
              <div className="lv-chips">
                <button type="button" className="lv-chip" aria-pressed={level == null} onClick={() => onLevel(null)}>
                  All levels
                </button>
                {LEVELS.map((l) => (
                  <button key={l} type="button" className="lv-chip" aria-pressed={level === l} onClick={() => onLevel(level === l ? null : l)}>
                    {l}
                  </button>
                ))}
                <span className="lv-gap" />
                {SEASONS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className="lv-chip lv-chip--season"
                    aria-pressed={season === s.key}
                    style={season === s.key ? { background: SEASON_TINT[s.key], color: 'var(--ink)' } : undefined}
                    onClick={() => onSeason(season === s.key ? null : s.key)}
                  >
                    <SeasonIcon season={s.key} size={18} />
                    {s.label}
                  </button>
                ))}
                {mode === 'library' && paperNumbers.length > 0 && (
                  <>
                    <span className="lv-gap" />
                    <div className="lv-papers" role="group" aria-label="Paper number">
                      <span>Paper</span>
                      {paperNumbers.map((n) => (
                        <button
                          key={n}
                          type="button"
                          aria-pressed={paperNumber === n}
                          title={`Paper ${n} (P${n})`}
                          onClick={() => onPaperNumber(paperNumber === n ? null : n)}
                        >
                          P{n}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {mode === 'library' && activeSubject && (
                  <button type="button" className="lv-subject" onClick={() => onSubject(null)} title="Clear the subject">
                    {activeSubject.name}
                    <span className="lv-subject-code">{activeSubject.code}</span>
                    <span aria-hidden="true">✕</span>
                  </button>
                )}
                {mode === 'library' && MARK_CHIPS.some((m) => marks[m.name].size > 0) && <span className="lv-gap" />}
                {mode === 'library' &&
                  MARK_CHIPS.filter((m) => marks[m.name].size > 0).map((m) => (
                    <button key={m.name} type="button" className="lv-chip" onClick={() => onMarkFilter(m.name)}>
                      {m.glyph} {m.label}
                      <span className="lv-chip-count">{marks[m.name].size}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {bareMark && (
          <div className="lv-filters">
            <div className="lv-filterbar">
              <button type="button" className="lv-chip" onClick={() => onMarkFilter(null)}>
                ← All papers
              </button>
              <button type="button" className="lv-subject" onClick={() => onMarkFilter(null)}>
                {FILTER_LABEL[bareMark]}
                <span className="lv-subject-code">{total}</span>
                <span aria-hidden="true">✕</span>
              </button>
            </div>
          </div>
        )}

        {loading && (
          <p className="lv-status" role="status">
            Reading the index…
          </p>
        )}

        {!loading && total === 0 && (
          <div className="lv-empty">
            <Mascot size={108} mood="empty" />
            <span className="lv-empty-head">{empty.head}</span>
            <span className="lv-empty-detail">{empty.detail}</span>
          </div>
        )}

        {mounted.map((group) => (
          <section className="lv-group" key={group.id} aria-label={group.label}>
            <div className="lv-group-head">
              <span className="lv-group-label">{group.label}</span>
              <span className="lv-group-meta">{group.meta}</span>
              <i />
            </div>
            {mode === 'recent' && !asCards ? (
              <div className="lv-list">{group.rows.map(rowFor)}</div>
            ) : (
              <div className="lv-grid">{group.rows.map((paper, i) => cardFor(paper, group.offset + i))}</div>
            )}
          </section>
        ))}

        {more && <div className="lv-more" ref={sentinel} aria-hidden="true" />}
      </div>
    </div>
  );
}
