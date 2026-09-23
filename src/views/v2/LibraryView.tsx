/**
 * LibraryView (Design System v2) — §9 reference implementation. The Library screen as a dense,
 * props-driven list: a page header, a filter toolbar, and a full-height v2 Table. It owns its
 * transient view state (search text, active filters, sort, checkbox selection) internally, exactly
 * as the legacy view does; only the Inspector's open target is lifted out (via `selectedKey` /
 * `onSelect`) because the right panel lives in the surrounding AppShell.
 *
 * Difficulty colour is the one sanctioned exception to "no raw hex": the Sky/Amber/Rose hexes live
 * in `lib/difficulty.ts` and reach the pill through inline `--pill-*` custom properties, never as
 * literals pasted here. `difficultyNote` is shown verbatim and never re-derived.
 */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import Table, { type Column } from '@ui/v2/Table';
import Input from '@ui/v2/Input';
import Badge, { type BadgeTone } from '@ui/v2/Badge';
import Button from '@ui/v2/Button';
import SegmentedControl from '@ui/v2/SegmentedControl';
import Menu, { MenuItem } from '@ui/v2/Menu';
import Tooltip from '@ui/v2/Tooltip';
import Icon, { type IconName } from '@/components/Icon';
import { bandFor, sessionLabel, componentLabel } from '@/lib/difficulty';
import type { PaperRow } from '@/lib/types';
import './LibraryView.css';

export interface V2LibraryProps {
  papers: PaperRow[];
  onOpen: (p: PaperRow) => void;
  /** Study-state sets, keyed `${subjectCode}/${scode}/${component}`. */
  bookmarked?: Set<string>;
  done?: Set<string>;
  revision?: Set<string>;
  onToggleMark?: (p: PaperRow, set: 'bookmarks' | 'done' | 'revision') => void;
  onDownload?: (p: PaperRow) => void;
  /** Row whose Inspector is open (matches `rowKey` = `String(id)`); owned by the harness. */
  selectedKey?: string;
  /** A row was clicked — the harness opens its Inspector; null clears it. */
  onSelect?: (p: PaperRow | null) => void;
}

const LEVELS = ['A Level', 'IGCSE', 'O Level'] as const;
const EMPTY: Set<string> = new Set();

type LevelFilter = 'all' | (typeof LEVELS)[number];
type DiffFilter = 'all' | 'easy' | 'medium' | 'hard' | 'unrated';
type StatusFilter = 'all' | 'downloaded' | 'done' | 'bookmarked' | 'revision';
type SortKey = 'subject' | 'code' | 'session' | 'difficulty';

/** Study-state key shared with the mark sets. */
const markKey = (p: PaperRow) => `${p.subjectCode}/${p.scode}/${p.component}`;

/** Chronological rank within a year: Feb/Mar < May/June < Oct/Nov. */
const SEASON_RANK: Record<string, number> = { feb_mar: 0, may_june: 1, oct_nov: 2 };
const sessionSortValue = (p: PaperRow) => p.year * 10 + (SEASON_RANK[p.season] ?? 0);

/** Difficulty pill — colour arrives as `--pill-*` custom props from difficulty.ts (the one hex exception). */
function DifficultyPill({ difficulty }: { difficulty: PaperRow['difficulty'] }) {
  const band = bandFor(difficulty);
  if (!band.rated) return <span className="v2lib-pill v2lib-pill--unrated">—</span>;
  return (
    <span className="v2lib-pill" style={{ ['--pill-color' as string]: band.deep, ['--pill-bg' as string]: band.tint }}>
      {band.label}
    </span>
  );
}

/** Difficulty cell: the pill, wrapped in a Tooltip carrying the verbatim note when one exists. */
function DifficultyCell({ paper }: { paper: PaperRow }) {
  if (!paper.difficultyNote) return <DifficultyPill difficulty={paper.difficulty} />;
  return (
    <Tooltip content={paper.difficultyNote}>
      <span className="v2lib-pill-trigger" tabIndex={0} role="note" aria-label={paper.difficultyNote}>
        <DifficultyPill difficulty={paper.difficulty} />
      </span>
    </Tooltip>
  );
}

/** Status cell — one primary state + at most one secondary (§17), always text + icon/dot. */
function StatusCell({
  paper, bookmarked, done, revision,
}: {
  paper: PaperRow;
  bookmarked: boolean;
  done: boolean;
  revision: boolean;
}) {
  const downloaded = paper.qpPath != null;
  let primary: { tone: BadgeTone; icon?: IconName; dot?: boolean; label: string } | null = null;
  if (done) primary = { tone: 'success', icon: 'check', label: 'Done' };
  else if (revision) primary = { tone: 'warning', dot: true, label: 'Revision' };
  else if (bookmarked) primary = { tone: 'accent', icon: 'bm', label: 'Saved' };
  else if (downloaded) primary = { tone: 'info', icon: 'doc', label: 'Downloaded' };

  if (!primary) return <span className="v2lib-status__none" aria-label="Catalogue only">—</span>;
  const secondary = primary.label !== 'Downloaded' && downloaded;
  return (
    <span className="v2lib-status">
      <Badge tone={primary.tone} variant="soft" icon={primary.icon} dot={primary.dot}>
        {primary.label}
      </Badge>
      {secondary ? (
        <Badge tone="neutral" variant="outline" icon="doc" className="v2lib-status__sec">
          Downloaded
        </Badge>
      ) : null}
    </span>
  );
}
/** Overflow actions — an icon Button opening a Menu. Its cell stops row-click propagation. */
function RowActions({
  paper, bookmarked, onOpen, onDownload, onToggleMark,
}: {
  paper: PaperRow;
  bookmarked: boolean;
  onOpen: (p: PaperRow) => void;
  onDownload?: (p: PaperRow) => void;
  onToggleMark?: V2LibraryProps['onToggleMark'];
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const downloaded = paper.qpPath != null;
  return (
    <>
      <Button
        ref={btnRef}
        variant="ghost"
        size="dense"
        iconOnly
        icon="dots"
        aria-label={`Actions for ${paper.subjectCode} ${paper.component}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      />
      <Menu open={open} onClose={() => setOpen(false)} anchorRef={btnRef} placement="bottom-end" label="Paper actions">
        <MenuItem icon="doc" label="Open" onSelect={() => onOpen(paper)} />
        <MenuItem
          icon="folder"
          label={downloaded ? 'Downloaded' : 'Download'}
          disabled={downloaded || !onDownload}
          onSelect={() => onDownload?.(paper)}
        />
        <MenuItem
          icon="bm"
          label={bookmarked ? 'Remove bookmark' : 'Bookmark'}
          disabled={!onToggleMark}
          onSelect={() => onToggleMark?.(paper, 'bookmarks')}
        />
        <MenuItem icon="check" label="Mark done" disabled={!onToggleMark} onSelect={() => onToggleMark?.(paper, 'done')} />
      </Menu>
    </>
  );
}

interface FilterOption { value: string; label: string; }

/** A compact dropdown filter: a dense secondary Button + a single-select Menu (check on the active option). */
function FilterMenu({
  name, value, options, onChange,
}: {
  name: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const active = options.find((o) => o.value === value);
  const showValue = value !== 'all' && active;
  return (
    <>
      <Button
        ref={btnRef}
        variant="secondary"
        size="dense"
        className="v2lib-filter"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="v2lib-filter__text">{showValue ? `${name}: ${active?.label}` : name}</span>
        <Icon name="chev" className="v2lib-filter__chev" />
      </Button>
      <Menu open={open} onClose={() => setOpen(false)} anchorRef={btnRef} placement="bottom-start" label={name}>
        {options.map((o) => (
          <MenuItem key={o.value} icon={o.value === value ? 'check' : undefined} label={o.label} onSelect={() => onChange(o.value)} />
        ))}
      </Menu>
    </>
  );
}
/** One labelled key/value line in the inspector. */
function InspectorRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="v2lib-insp__row">
      <span className="v2lib-insp__key t-caption">{label}</span>
      <span className="v2lib-insp__val t-body">{value}</span>
    </div>
  );
}

/**
 * Inspector sections for a paper (§10): Header, State, Details, Files. Rendered inside the
 * `Inspector` frame by the owner, whose footer supplies the primary Open action.
 */
export function PaperInspectorBody({ paper }: { paper: PaperRow }) {
  const band = bandFor(paper.difficulty);
  const raw: Array<[string, number | null]> = [
    ['A', paper.aThreshold], ['B', paper.bThreshold], ['C', paper.cThreshold],
    ['D', paper.dThreshold], ['E', paper.eThreshold],
  ];
  const thresholds = raw.filter((t): t is [string, number] => t[1] != null);
  return (
    <div className="v2lib-insp">
      <section className="v2lib-insp__section">
        <div className="v2lib-insp__code t-ui">{`${paper.subjectCode}/${paper.scode}/${paper.component}`}</div>
        <div className="v2lib-insp__subject t-section-title">{paper.subjectName}</div>
        <div className="v2lib-insp__meta t-caption">{`${sessionLabel(paper.scode)} · ${componentLabel(paper.component)}`}</div>
      </section>

      <section className="v2lib-insp__section">
        <div className="v2lib-insp__label t-micro">State</div>
        <div className="v2lib-insp__state">
          <DifficultyPill difficulty={paper.difficulty} />
          <span className="v2lib-insp__basis t-caption">{band.rated ? paper.level : 'Unrated'}</span>
        </div>
        {paper.difficultyNote ? <p className="v2lib-insp__note t-body">{paper.difficultyNote}</p> : null}
      </section>

      <section className="v2lib-insp__section">
        <div className="v2lib-insp__label t-micro">Details</div>
        <InspectorRow label="Total marks" value={paper.totalMarks ?? '—'} />
        <InspectorRow label="Hardness" value={paper.hardnessScore != null ? `${paper.hardnessScore} / 100` : '—'} />
        <InspectorRow
          label="Grade thresholds"
          value={thresholds.length ? thresholds.map(([g, v]) => `${g} ${v}`).join('   ') : '—'}
        />
      </section>

      <section className="v2lib-insp__section">
        <div className="v2lib-insp__label t-micro">Files</div>
        <div className="v2lib-insp__file">
          <Icon name="doc" className="v2lib-insp__file-icon" />
          <span className="t-body">Question paper</span>
          <Badge tone={paper.qpPath ? 'success' : 'neutral'} variant="soft" icon={paper.qpPath ? 'check' : undefined}>
            {paper.qpPath ? 'Downloaded' : 'Not downloaded'}
          </Badge>
        </div>
        <div className="v2lib-insp__file">
          <Icon name="doc" className="v2lib-insp__file-icon" />
          <span className="t-body">Mark scheme</span>
          <Badge
            tone={paper.msPath ? 'success' : paper.hasMs ? 'info' : 'neutral'}
            variant="soft"
            icon={paper.msPath ? 'check' : undefined}
          >
            {paper.msPath ? 'Downloaded' : paper.hasMs ? 'Available' : 'None'}
          </Badge>
        </div>
      </section>
    </div>
  );
}
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'session', label: 'Session' },
  { key: 'subject', label: 'Subject' },
  { key: 'code', label: 'Code' },
  { key: 'difficulty', label: 'Difficulty' },
];

export default function LibraryView({
  papers, onOpen, bookmarked, done, revision, onToggleMark, onDownload, selectedKey, onSelect,
}: V2LibraryProps) {
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<LevelFilter>('all');
  const [session, setSession] = useState<string>('all');
  const [difficulty, setDifficulty] = useState<DiffFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'session', dir: 'desc' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLButtonElement>(null);

  const bm = bookmarked ?? EMPTY;
  const dn = done ?? EMPTY;
  const rv = revision ?? EMPTY;

  const subjectCount = useMemo(() => new Set(papers.map((p) => p.subjectCode)).size, [papers]);

  const sessionOptions = useMemo<FilterOption[]>(() => {
    const seen = new Map<string, number>();
    for (const p of papers) if (!seen.has(p.scode)) seen.set(p.scode, sessionSortValue(p));
    return [
      { value: 'all', label: 'All sessions' },
      ...[...seen.entries()].sort((a, b) => b[1] - a[1]).map(([scode]) => ({ value: scode, label: sessionLabel(scode) })),
    ];
  }, [papers]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = papers.filter((p) => {
      if (q) {
        const hay = `${p.subjectName} ${p.subjectCode} ${p.scode} ${p.paperNumber} ${p.component}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (level !== 'all' && p.level !== level) return false;
      if (session !== 'all' && p.scode !== session) return false;
      if (difficulty !== 'all') {
        if (difficulty === 'unrated') { if (p.difficulty != null) return false; }
        else if (p.difficulty !== difficulty) return false;
      }
      if (status !== 'all') {
        if (status === 'downloaded') { if (p.qpPath == null) return false; }
        else {
          const set = status === 'done' ? dn : status === 'bookmarked' ? bm : rv;
          if (!set.has(markKey(p))) return false;
        }
      }
      return true;
    });
    const dir = sort.dir === 'asc' ? 1 : -1;
    out.sort((a, b) => {
      if (sort.key === 'difficulty') {
        const av = a.hardnessScore, bv = b.hardnessScore;
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return (av - bv) * dir;
      }
      let c = 0;
      if (sort.key === 'subject') c = a.subjectName.localeCompare(b.subjectName) || a.subjectCode.localeCompare(b.subjectCode);
      else if (sort.key === 'code') c = `${a.subjectCode}/${a.component}`.localeCompare(`${b.subjectCode}/${b.component}`);
      else c = sessionSortValue(a) - sessionSortValue(b);
      return c * dir;
    });
    return out;
  }, [papers, query, level, session, difficulty, status, sort, bm, dn, rv]);

  const onSortChange = (key: string) =>
    setSort((s) => (s.key === key ? { key: s.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: key as SortKey, dir: 'asc' }));

  const anyFilter = query !== '' || level !== 'all' || session !== 'all' || difficulty !== 'all' || status !== 'all';
  const clearFilters = () => { setQuery(''); setLevel('all'); setSession('all'); setDifficulty('all'); setStatus('all'); };

  const downloadSelected = () => {
    if (!onDownload) return;
    for (const p of papers) if (selected.has(String(p.id)) && p.qpPath == null) onDownload(p);
  };

  const sortLabel = SORT_OPTIONS.find((o) => o.key === sort.key)?.label ?? 'Session';
  const selCount = selected.size;
  const columns: Column<PaperRow>[] = [
    {
      key: 'subject', header: 'Subject', sortable: true,
      render: (p) => (
        <span className="v2lib-subject">
          <span className="v2lib-subject__name">{p.subjectName}</span>
          <span className="v2lib-subject__code">{p.subjectCode}</span>
        </span>
      ),
    },
    { key: 'code', header: 'Code', sortable: true, mono: true, width: 116, render: (p) => `${p.subjectCode}/${p.component}` },
    { key: 'session', header: 'Session', sortable: true, width: 140, render: (p) => sessionLabel(p.scode) },
    { key: 'paper', header: 'Paper', width: 168, render: (p) => componentLabel(p.component) },
    { key: 'difficulty', header: 'Difficulty', sortable: true, width: 132, render: (p) => <DifficultyCell paper={p} /> },
    {
      key: 'status', header: 'Status', width: 172,
      render: (p) => (
        <StatusCell paper={p} bookmarked={bm.has(markKey(p))} done={dn.has(markKey(p))} revision={rv.has(markKey(p))} />
      ),
    },
    {
      key: 'actions', header: '', width: 48, align: 'right',
      render: (p) => (
        <span className="v2lib-actions" onClick={(e) => e.stopPropagation()}>
          <RowActions paper={p} bookmarked={bm.has(markKey(p))} onOpen={onOpen} onDownload={onDownload} onToggleMark={onToggleMark} />
        </span>
      ),
    },
  ];

  const empty = (
    <div className="v2lib-empty">
      <Icon name="search" className="v2lib-empty__icon" />
      <div className="v2lib-empty__title t-ui">No papers match</div>
      <div className="v2lib-empty__hint t-caption">Try a different search or clear the filters.</div>
      {anyFilter ? <Button variant="ghost" size="dense" label="Clear filters" onClick={clearFilters} /> : null}
    </div>
  );

  return (
    <div className="v2lib">
      <header className="v2lib__header">
        <h1 className="v2lib__title t-page-title">Library</h1>
        <p className="v2lib__caption t-caption">{`${papers.length} papers · ${subjectCount} subjects`}</p>
      </header>

      <div className="v2lib__toolbar">
        <Input
          className="v2lib__search"
          leading={<Icon name="search" />}
          placeholder="Search papers, subjects, sessions"
          aria-label="Search papers"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="v2lib__filters">
          <SegmentedControl
            label="Level"
            size="dense"
            value={level}
            onChange={(v) => setLevel(v as LevelFilter)}
            items={[{ value: 'all', label: 'All' }, ...LEVELS.map((l) => ({ value: l, label: l }))]}
          />
          <FilterMenu name="Session" value={session} options={sessionOptions} onChange={setSession} />
          <FilterMenu
            name="Difficulty" value={difficulty} onChange={(v) => setDifficulty(v as DiffFilter)}
            options={[
              { value: 'all', label: 'All difficulties' },
              { value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' },
              { value: 'hard', label: 'Hard' }, { value: 'unrated', label: 'Unrated' },
            ]}
          />
          <FilterMenu
            name="Status" value={status} onChange={(v) => setStatus(v as StatusFilter)}
            options={[
              { value: 'all', label: 'All' }, { value: 'downloaded', label: 'Downloaded' },
              { value: 'done', label: 'Done' }, { value: 'bookmarked', label: 'Bookmarked' },
              { value: 'revision', label: 'Revision' },
            ]}
          />
        </div>

        <div className="v2lib__spacer" />

        <div className="v2lib__right">
          {selCount > 0 ? (
            <div className="v2lib-selbar" role="status">
              <span className="v2lib-selbar__count t-ui">{selCount} selected</span>
              <span className="v2lib-selbar__sep" aria-hidden="true" />
              <Button variant="secondary" size="dense" icon="folder" label="Download" disabled={!onDownload} onClick={downloadSelected} />
              <Button variant="ghost" size="dense" icon="x" label="Clear" onClick={() => setSelected(new Set())} />
            </div>
          ) : (
            <>
              <span className="v2lib__count t-caption">
                {rows.length === papers.length ? `${rows.length} papers` : `${rows.length} of ${papers.length}`}
              </span>
              <Button
                ref={sortRef} variant="ghost" size="dense" className="v2lib__sort"
                aria-haspopup="menu" aria-expanded={sortOpen} onClick={() => setSortOpen((v) => !v)}
              >
                <Icon name="list" className="v2lib__sort-icon" />
                <span>{`Sort: ${sortLabel}`}</span>
                <Icon name="chev" className={`v2lib__sort-dir is-${sort.dir}`} />
              </Button>
              <Menu open={sortOpen} onClose={() => setSortOpen(false)} anchorRef={sortRef} placement="bottom-end" label="Sort by">
                {SORT_OPTIONS.map((o) => (
                  <MenuItem key={o.key} icon={sort.key === o.key ? 'check' : undefined} label={o.label} onSelect={() => onSortChange(o.key)} />
                ))}
              </Menu>
            </>
          )}
        </div>
      </div>

      <div className="v2lib__table-wrap">
        <Table<PaperRow>
          columns={columns}
          rows={rows}
          rowKey={(p) => String(p.id)}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          sort={sort}
          onSortChange={onSortChange}
          onRowClick={(p) => onSelect?.(p)}
          onRowActivate={onOpen}
          activeKey={selectedKey}
          emptyState={empty}
        />
      </div>
    </div>
  );
}
