/**
 * Library, Bookmarks and Recent — one component, three compositions.
 *
 * Specs: `design/specs/screen-library-settings.md` §5 (the Library content region `45:65`) and
 * `design/specs/screen-bookmarks-recent.md` §5 (Bookmarks `181:512`) / §6 (Recent `181:868`).
 * That second spec opens by saying the two new screens are "Library variants" — same window,
 * background, sidebar and top bar, differing only in this 1020-wide region and in which nav row is
 * lit. So `mode` is a prop and there is one file, not three.
 *
 *   library    filter chips · year headers ("2015 · 6 papers") · 3-up Paper Card grid
 *   bookmarks  filter chips · subject headers ("ACCOUNTING · 6 saved") · the same grid
 *   recent     head line + view toggle · day-bucket headers · a row list (§6), or that same grid
 *              when the toggle says cards
 *
 * THE DATA PATH IS UNCHANGED. `papers` still arrives already resolved by `App`: for a marked list
 * that is the store's row snapshots (`loadRows()`), never the live query, because a paper marked
 * two sessions ago is not in whatever 600 rows `listPapers` last returned. Nothing here re-reads
 * it. The only store reads below are Recent's open timestamps and the focus log — measurements
 * `App` does not forward, and the same two calls `DashboardView` already makes.
 *
 * The Paper Card is FLUID. Its master is 280 wide and the grid stretches every instance to 330.667
 * (§5.3), so neither number appears anywhere: the track is `repeat(3, minmax(0, 1fr))` and the card
 * lays out from its own content. Nor is anything clipped — the file had to switch `clipsContent`
 * off on 8 grids, 18 rows and 10 content regions to stop the card shadows being sliced, and the CSS
 * equivalent is to leave the gutter wide enough and set no `overflow` at all.
 */
import './LibraryView.css';
import { useMemo, useState } from 'react';
import Card from '@ui/Card';
import Chip, { type ChipPalette } from '@ui/Chip';
import Notice from '@ui/Notice';
import PaperCard from '@ui/PaperCard';
import SectionLabel from '@ui/SectionLabel';
import SegmentedControl from '@ui/SegmentedControl';
import SeasonIcon from '@ui/icons/SeasonIcon';
import SubjectIcon from '@ui/icons/SubjectIcon';
import Icon, { type IconName } from '@/components/Icon';
import { bandFor, sessionLabel } from '@/lib/difficulty';
import { loadFocus, loadRecent, paperKey, type MarkFilter, type SetName } from '@/lib/store';
import type { PaperRow, Subject } from '@/lib/types';

/** Which composition this render is. Bookmarks and Recent are Library with a different middle. */
export type LibraryMode = 'library' | 'bookmarks' | 'recent';

/** `PaperRow.level` carries these strings verbatim, so they double as the chip labels. */
const LEVELS = ['A Level', 'IGCSE', 'O Level'] as const;

/** Figma's `Palette` axis only surfaces on a selected chip — an unselected one ignores it. */
const LEVEL_PALETTE: Record<(typeof LEVELS)[number], ChipPalette> = {
  'A Level': 'a-level',
  IGCSE: 'igcse',
  'O Level': 'o-level',
};

/** In the file's order. `key` is the session-code letter the rows carry: `s15` → `s`. */
const SEASONS = [
  { key: 's', label: 'May/June', palette: 'may-june' },
  { key: 'w', label: 'Oct/Nov', palette: 'oct-nov' },
  { key: 'm', label: 'Feb/Mar', palette: 'feb-march' },
] as const;

/** Wording for the escape-hatch chip that stands in for a marked list's filter row. */
const FILTER_LABEL: Record<Exclude<MarkFilter, null>, string> = {
  bookmarks: 'Bookmarked',
  done: 'Done',
  revision: 'Flagged for revision',
  recent: 'Recently opened',
};

/**
 * APP ADDITION, and the same call `PaperCard.tsx` makes about its three mark toggles: the file draws
 * eight chips here and not one of them is a mark, but Bookmarks and Recent are the only two mark sets
 * with a screen and a sidebar row. Done has no other route into it anywhere in the app, and
 * Flagged-for-revision has only a ⌘K entry — dropping these would make a live feature unreachable.
 * So they stay, after the seasons and behind a second strut. Actions rather than toggles, so no
 * `filled` and no `aria-pressed`; hidden while the set is empty, because a chip that leads to an
 * empty list is a dead end.
 */
const MARK_CHIPS: { name: SetName; icon: IconName; label: string }[] = [
  { name: 'done', icon: 'checkc', label: 'Done' },
  { name: 'revision', icon: 'sync', label: 'Revision' },
];

/** §6's toggle. Both glyphs are the segmented control's own (`grid`, `list`); the labels are ours,
 *  because the segments are icon-only and that name is all a screen reader gets. */
const RECENT_VIEWS = [
  { icon: 'grid', label: 'Show recent papers as cards' },
  { icon: 'list', label: 'Show recent papers as a list' },
] as const;

/**
 * Recent's day buckets. §6 draws three because its sample data stops five days back; `Older` is
 * ours, and it has to exist — `loadRecent()` keeps 40 entries with no time window, so a real
 * install will have papers older than a week in it and they cannot go unheaded.
 */
const BUCKETS = [
  { label: 'Today', within: 0 },
  { label: 'Yesterday', within: 1 },
  { label: 'Earlier this week', within: 6 },
  { label: 'Older', within: Number.POSITIVE_INFINITY },
] as const;

const DAY_MS = 86_400_000;

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
 * `ActivityGrid` and `DashboardView` build the key exactly this way, and one log cannot mean two
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
    // boundary — the idiom `ActivityGrid` and `DashboardView` both use on this same log.
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
    detail: 'Clear a level, a session, the subject or the Downloaded chip to widen the search.',
  };
}

/** One headed run of cards or rows. `meta` is the header's mono count, which differs per mode. */
interface Group {
  id: string;
  label: string;
  meta: string;
  rows: PaperRow[];
}

export interface Props {
  /**
   * Which of the three compositions to draw. Optional, and the fallback is what the shipped `App`
   * already does: it reaches Bookmarks and Recent by setting `markFilter` while staying on the
   * library route, so deriving the mode from it keeps this correct before and after that is rewired.
   */
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
  subjectId: number | null;
  onSubject: (id: number | null) => void;
  /** Narrow to papers already on this machine. */
  downloadedOnly: boolean;
  onDownloadedOnly: (v: boolean) => void;
  marks: Record<SetName, Set<string>>;
  /** `key` is `paperKey(...)`; `paper` is passed so the store can snapshot the row it marked. */
  onMark: (name: SetName, key: string, paper: PaperRow) => void;
  markFilter: MarkFilter;
  onMarkFilter: (m: MarkFilter) => void;
  onOpen: (p: PaperRow) => void;
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
  subjectId,
  onSubject,
  downloadedOnly,
  onDownloadedOnly,
  marks,
  onMark,
  markFilter,
  onMarkFilter,
  onOpen,
  error,
}: Props) {
  /** Figma has Recent selected on `list`; the toggle is view state, so it resets with the screen. */
  const [asCards, setAsCards] = useState(false);

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
  }, [papers, mode, level, season, filterable]);

  /** Is anything on this screen currently narrowing the list? The empty state hangs on the answer. */
  const narrowed =
    filterable &&
    (level !== null ||
      season !== null ||
      downloadedOnly ||
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

  const cardFor = (paper: PaperRow) => {
    const key = paperKey(paper.subjectCode, paper.scode, paper.component);
    return (
      <PaperCard
        key={`${key}/${paper.level}`}
        subject={paper.subjectName}
        subjectCode={paper.subjectCode}
        variant={paper.component}
        session={sessionLabel(paper.scode)}
        documents={documentsOf(paper)}
        band={bandFor(paper.difficulty)}
        icon={<SubjectIcon code={paper.subjectCode} size={18} />}
        marks={{
          bookmarked: marks.bookmarks.has(key),
          done: marks.done.has(key),
          revision: marks.revision.has(key),
        }}
        // The card speaks Figma's word, `Bookmarked`; the store keeps its own set name.
        onMark={(m) => onMark(m === 'bookmarked' ? 'bookmarks' : m, key, paper)}
        onOpen={() => onOpen(paper)}
      />
    );
  };

  /**
   * A Recent row (§6): eight fixed slots, no card and no bookmark — "difficulty is the word
   * alone", which the badge now says literally. The whole row is the button; the chevron is
   * decoration on it.
   */
  const rowFor = (paper: PaperRow) => {
    const key = paperKey(paper.subjectCode, paper.scode, paper.component);
    const band = bandFor(paper.difficulty);
    const at = openedAt.get(key);
    return (
      <button
        type="button"
        key={`${key}/${paper.level}`}
        className="lv-row"
        title={`Open ${paper.subjectName} ${paper.subjectCode}/${paper.component}`}
        onClick={() => onOpen(paper)}
      >
        <span className="lv-row-glyph">
          <SubjectIcon code={paper.subjectCode} size={20} />
        </span>
        <span className="lv-row-subject t-body-nav">{paper.subjectName}</span>
        {/* One string, as the file writes it: `9706 /12`. */}
        <span className="lv-row-code t-mono-meta">
          {paper.subjectCode}
          {` /${paper.component}`}
        </span>
        <span className="lv-row-session t-mono-small">{sessionLabel(paper.scode)}</span>
        <span className="lv-row-strut" aria-hidden="true" />
        <span className="lv-row-band t-label-difficulty" style={{ color: band.color }}>
          {band.label}
        </span>
        {/* Blank rather than guessed, for the undated snapshot the last bucket also allows for. */}
        <span className="lv-row-elapsed t-mono-small">{at == null ? '' : elapsedLabel(at)}</span>
        <Icon name="chev" className="lv-row-chev" />
      </button>
    );
  };

  return (
    <div className="view">
      <div className="lv">
        {error && <Notice className="lv-error">{error}</Notice>}

        {/* `lib` is authored `gap: 0` and pays for all of its vertical rhythm in per-child padding
            (TRAP 5). Recent is the exception — its own content frame carries `gap: 16`. */}
        <div className="lv-body" data-mode={mode}>
          {week && papers.length > 0 && (
            <div className="lv-head">
              <span className="lv-head-stat t-body-small">
                {plural(week.opened, 'paper')} opened in the last 7 days
                {' · '}
                {focusLabel(week.minutes)} focused
              </span>
              <span className="lv-head-strut" aria-hidden="true" />
              <SegmentedControl
                items={RECENT_VIEWS}
                value={asCards ? 0 : 1}
                onChange={(v) => setAsCards(v === 0)}
                label="Recent layout"
              />
            </div>
          )}

          {showChips && (
            <div className="lv-filters">
              <Chip label="All levels" filled={level === null} onClick={() => onLevel(null)} />
              {LEVELS.map((l) => (
                <Chip
                  key={l}
                  label={l}
                  palette={LEVEL_PALETTE[l]}
                  filled={level === l}
                  onClick={() => onLevel(level === l ? null : l)}
                />
              ))}

              {/* §5.1 hides an 8x1 strut here: with the row's own 8px gap either side of it, the
                  level-to-season break measures 24px rather than 8. */}
              <span className="lv-chip-strut" aria-hidden="true" />

              {SEASONS.map((s) => (
                <Chip
                  key={s.key}
                  label={s.label}
                  palette={s.palette}
                  filled={season === s.key}
                  icon={<SeasonIcon season={s.key} />}
                  onClick={() => onSeason(season === s.key ? null : s.key)}
                />
              ))}

              {/* Bookmarks heads its groups by subject, so a subject chip there would only repeat
                  what the headers say — and `App` never narrows a snapshot list by it. */}
              {mode === 'library' && activeSubject && (
                <Chip
                  label={activeSubject.name}
                  code={activeSubject.code}
                  filled
                  onClose={() => onSubject(null)}
                />
              )}

              {/* The catalogue lists every paper Cambridge has published for these subjects,
                  most of which are not on this machine. This chip is how you get back to the
                  much smaller set you actually have — the nearest thing to what the whole
                  library used to be before it came from the network. */}
              {mode === 'library' && (
                <Chip
                  label="Downloaded"
                  icon={<Icon name="folder" />}
                  filled={downloadedOnly}
                  onClick={() => onDownloadedOnly(!downloadedOnly)}
                />
              )}

              {mode === 'library' &&
                MARK_CHIPS.some((m) => marks[m.name].size > 0) && (
                  <span className="lv-chip-strut" aria-hidden="true" />
                )}
              {mode === 'library' &&
                MARK_CHIPS.filter((m) => marks[m.name].size > 0).map((m) => (
                  <Chip
                    key={m.name}
                    label={m.label}
                    code={String(marks[m.name].size)}
                    icon={<Icon name={m.icon} />}
                    onClick={() => onMarkFilter(m.name)}
                  />
                ))}
            </div>
          )}

          {bareMark && (
            <div className="lv-filters">
              <Chip
                label="All papers"
                icon={<Icon name="left" />}
                onClick={() => onMarkFilter(null)}
              />
              <Chip
                label={FILTER_LABEL[bareMark]}
                code={String(total)}
                filled
                onClose={() => onMarkFilter(null)}
              />
            </div>
          )}

          {loading && (
            <p className="lv-status t-body-meta" role="status">
              Reading the index…
            </p>
          )}

          {!loading && total === 0 && (
            <div className="lv-empty">
              <p className="lv-empty-head t-body-strong">{empty.head}</p>
              <p className="lv-empty-detail t-body-meta">{empty.detail}</p>
            </div>
          )}

          {groups.map((group) => (
            <section className="lv-group" key={group.id} aria-label={group.label}>
              <SectionLabel label={group.label} meta={group.meta} />
              {mode === 'recent' && !asCards ? (
                /* §6's `list <BUCKET>` IS the grouped-list card of §6.2 — `--card` on a 1px
                   `--card-brd` at radius 13, zero padding, zero gap, clipped so the end rows
                   corner-clip. That recipe is `<Card rows>`; restating it here would fork it. */
                <Card rows>{group.rows.map(rowFor)}</Card>
              ) : (
                <div className="lv-grid">{group.rows.map(cardFor)}</div>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
