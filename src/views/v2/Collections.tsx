/**
 * Collections (Design System v2) — §13. Main-area master–detail (never the shell): a left list of
 * collections (colour dot, name, item count) and, on the right, the selected collection's papers in
 * a v2 Table with a header (name, description, count, sort) and a per-row overflow "Remove from
 * collection". A "New collection" action seeds an empty collection so its §19.2 empty state shows.
 *
 * Collections only group papers you already have: removing a paper from a collection, or deleting a
 * collection outright, never deletes the downloaded paper — the copy says so in both places. The
 * colour dots take semantic tokens through an inline --dot custom prop (no raw hex). Difficulty
 * colour is the one sanctioned hex exception, arriving as --pill-* props from difficulty.ts.
 */
import { useMemo, useRef, useState } from 'react';
import Table, { type Column } from '@ui/v2/Table';
import Button from '@ui/v2/Button';
import Menu, { MenuItem, MenuSeparator } from '@ui/v2/Menu';
import Icon from '@/components/Icon';
import { bandFor, sessionLabel, componentLabel } from '@/lib/difficulty';
import type { PaperRow, Level, Qualification, Season, Difficulty } from '@/lib/types';
import './Collections.css';

/* ---- sample data (real CAIE codes) --------------------------------------- */

type Seed = {
  subjectCode: string;
  subjectName: string;
  level: Level;
  qualification: Qualification;
  year: number;
  scode: string;
  season: Season;
  component: string;
  totalMarks: number;
  hardnessScore: number | null;
  difficulty: Difficulty | null;
  thresholds?: [number, number, number, number, number];
  hasMs?: boolean;
  downloaded?: boolean;
  msDownloaded?: boolean;
};

let SEED_ID = 5100;

function mk(s: Seed): PaperRow {
  const th = s.thresholds;
  return {
    id: SEED_ID++,
    subjectId: Number(s.subjectCode),
    subjectCode: s.subjectCode,
    subjectName: s.subjectName,
    qualification: s.qualification,
    level: s.level,
    year: s.year,
    scode: s.scode,
    season: s.season,
    component: s.component,
    paperNumber: Number(s.component.charAt(0)),
    variant: Number(s.component.charAt(1) || 0),
    totalMarks: s.totalMarks,
    aThreshold: th ? th[0] : null,
    bThreshold: th ? th[1] : null,
    cThreshold: th ? th[2] : null,
    dThreshold: th ? th[3] : null,
    eThreshold: th ? th[4] : null,
    aPct: null,
    curveMeanPct: null,
    spanPct: null,
    hardnessScore: s.hardnessScore,
    difficulty: s.difficulty,
    difficultyBasis: s.difficulty ? 'component' : null,
    difficultyNote: null,
    hasMs: s.hasMs ?? true,
    qpPath: s.downloaded ? `offline/${s.subjectCode}_${s.scode}_${s.component}_qp.pdf` : null,
    msPath: s.msDownloaded ? `offline/${s.subjectCode}_${s.scode}_${s.component}_ms.pdf` : null,
  };
}

const POOL = {
  m9709_32: mk({ subjectCode: '9709', subjectName: 'Mathematics', level: 'A Level', qualification: 'a_level', year: 2025, scode: 's25', season: 'may_june', component: '32', totalMarks: 75, hardnessScore: 72, difficulty: 'hard', downloaded: true, msDownloaded: true }),
  m9709_42: mk({ subjectCode: '9709', subjectName: 'Mathematics', level: 'A Level', qualification: 'a_level', year: 2024, scode: 'w24', season: 'oct_nov', component: '42', totalMarks: 50, hardnessScore: 69, difficulty: 'hard', downloaded: true, msDownloaded: true }),
  m9231_11: mk({ subjectCode: '9231', subjectName: 'Further Mathematics', level: 'A Level', qualification: 'a_level', year: 2025, scode: 's25', season: 'may_june', component: '11', totalMarks: 75, hardnessScore: 81, difficulty: 'hard', downloaded: false }),
  p9702_42: mk({ subjectCode: '9702', subjectName: 'Physics', level: 'A Level', qualification: 'a_level', year: 2025, scode: 's25', season: 'may_june', component: '42', totalMarks: 100, hardnessScore: 64, difficulty: 'hard', downloaded: true, msDownloaded: true }),
  p9702_22: mk({ subjectCode: '9702', subjectName: 'Physics', level: 'A Level', qualification: 'a_level', year: 2024, scode: 'w24', season: 'oct_nov', component: '22', totalMarks: 60, hardnessScore: 45, difficulty: 'medium', downloaded: true, msDownloaded: true }),
  p9702_52: mk({ subjectCode: '9702', subjectName: 'Physics', level: 'A Level', qualification: 'a_level', year: 2025, scode: 's25', season: 'may_june', component: '52', totalMarks: 30, hardnessScore: 38, difficulty: 'medium', downloaded: true }),
  c9701_42: mk({ subjectCode: '9701', subjectName: 'Chemistry', level: 'A Level', qualification: 'a_level', year: 2024, scode: 's24', season: 'may_june', component: '42', totalMarks: 100, hardnessScore: 74, difficulty: 'hard', downloaded: true, msDownloaded: true }),
  b9700_22: mk({ subjectCode: '9700', subjectName: 'Biology', level: 'A Level', qualification: 'a_level', year: 2024, scode: 'w24', season: 'oct_nov', component: '22', totalMarks: 60, hardnessScore: 47, difficulty: 'medium', downloaded: false }),
  e9708_22: mk({ subjectCode: '9708', subjectName: 'Economics', level: 'A Level', qualification: 'a_level', year: 2025, scode: 's25', season: 'may_june', component: '22', totalMarks: 40, hardnessScore: 28, difficulty: 'easy', downloaded: false }),
  cs9618_12: mk({ subjectCode: '9618', subjectName: 'Computer Science', level: 'A Level', qualification: 'a_level', year: 2025, scode: 's25', season: 'may_june', component: '12', totalMarks: 75, hardnessScore: 44, difficulty: 'medium', downloaded: true, msDownloaded: true }),
};

interface Collection {
  id: string;
  name: string;
  description: string;
  /** Semantic token reference for the colour dot — e.g. 'var(--danger)'. Never a raw hex. */
  tone: string;
  paperIds: number[];
}

const ALL = Object.values(POOL);
const byId = new Map(ALL.map((p) => [p.id, p]));

const INITIAL: Collection[] = [
  {
    id: 'hard-maths',
    name: 'Hard Maths 2024–2026',
    description: 'A Level Maths & Further Maths papers rated Hard.',
    tone: 'var(--danger)',
    paperIds: [POOL.m9231_11.id, POOL.m9709_32.id, POOL.m9709_42.id],
  },
  {
    id: 'downloaded-physics',
    name: 'Downloaded Physics',
    description: 'Every Physics paper saved to this device.',
    tone: 'var(--info)',
    paperIds: [POOL.p9702_42.id, POOL.p9702_22.id, POOL.p9702_52.id],
  },
  {
    id: 'needs-review',
    name: 'Needs Review',
    description: 'Flagged from attempts where you dropped marks.',
    tone: 'var(--warning)',
    paperIds: [POOL.c9701_42.id, POOL.m9709_32.id, POOL.b9700_22.id],
  },
  {
    id: 'mock-set',
    name: 'Mock set — June',
    description: 'One paper per subject for the June mock sitting.',
    tone: 'var(--accent)',
    paperIds: [POOL.m9709_32.id, POOL.p9702_42.id, POOL.c9701_42.id, POOL.e9708_22.id, POOL.cs9618_12.id],
  },
];

type SortKey = 'subject' | 'code' | 'session' | 'difficulty';
const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'subject', label: 'Subject' },
  { key: 'code', label: 'Code' },
  { key: 'session', label: 'Session' },
  { key: 'difficulty', label: 'Difficulty' },
];
const SEASON_RANK: Record<string, number> = { feb_mar: 0, may_june: 1, oct_nov: 2 };
const sessionSortValue = (p: PaperRow) => p.year * 10 + (SEASON_RANK[p.season] ?? 0);

/** Difficulty pill — colour arrives as --pill-* custom props from difficulty.ts (the one hex exception). */
function DifficultyPill({ difficulty }: { difficulty: Difficulty | null }) {
  const band = bandFor(difficulty);
  if (!band.rated) return <span className="v2coll-pill v2coll-pill--unrated">—</span>;
  return (
    <span className="v2coll-pill" style={{ ['--pill-color' as string]: band.deep, ['--pill-bg' as string]: band.tint }}>
      {band.label}
    </span>
  );
}

function RowActions({ paper, onOpen, onRemove }: {
  paper: PaperRow;
  onOpen?: (p: PaperRow) => void;
  onRemove: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button
        ref={btnRef} variant="ghost" size="dense" iconOnly icon="dots"
        aria-label={`Actions for ${paper.subjectCode} ${paper.component}`}
        aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}
      />
      <Menu open={open} onClose={() => setOpen(false)} anchorRef={btnRef} placement="bottom-end" label="Paper actions">
        <MenuItem icon="doc" label="Open" onSelect={() => onOpen?.(paper)} />
        <MenuSeparator />
        <MenuItem icon="x" label="Remove from collection" onSelect={() => onRemove(paper.id)} />
      </Menu>
    </>
  );
}

export interface CollectionsProps {
  /** Open a paper (double-click / Enter / the row menu). */
  onOpen?: (p: PaperRow) => void;
}

export default function Collections({ onOpen }: CollectionsProps = {}) {
  const [collections, setCollections] = useState<Collection[]>(INITIAL);
  const [selectedId, setSelectedId] = useState<string>(INITIAL[0].id);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'subject', dir: 'asc' });
  const [sortOpen, setSortOpen] = useState(false);
  const [collMenuOpen, setCollMenuOpen] = useState(false);
  const sortRef = useRef<HTMLButtonElement>(null);
  const collMenuRef = useRef<HTMLButtonElement>(null);
  const newSeq = useRef(1);

  const selected = collections.find((c) => c.id === selectedId) ?? collections[0] ?? null;

  const rows = useMemo(() => {
    if (!selected) return [];
    const list = selected.paperIds.map((id) => byId.get(id)).filter((p): p is PaperRow => p != null);
    const dir = sort.dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
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
    return list;
  }, [selected, sort]);

  const onSortChange = (key: string) =>
    setSort((s) => (s.key === key ? { key: s.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: key as SortKey, dir: 'asc' }));

  const removePaper = (paperId: number) =>
    setCollections((cs) => cs.map((c) => (c.id === selectedId ? { ...c, paperIds: c.paperIds.filter((id) => id !== paperId) } : c)));

  const newCollection = () => {
    const id = `new-${newSeq.current++}`;
    const coll: Collection = { id, name: 'Untitled collection', description: 'No papers yet.', tone: 'var(--text-tertiary)', paperIds: [] };
    setCollections((cs) => [...cs, coll]);
    setSelectedId(id);
  };

  const deleteCollection = (id: string) => {
    const remaining = collections.filter((c) => c.id !== id);
    setCollections(remaining);
    if (selectedId === id) setSelectedId(remaining[0]?.id ?? '');
  };

  const sortLabel = SORT_OPTIONS.find((o) => o.key === sort.key)?.label ?? 'Subject';

  const columns: Column<PaperRow>[] = [
    {
      key: 'subject', header: 'Subject',
      render: (p) => (
        <span className="v2coll-subject">
          <span className="v2coll-subject__name">{p.subjectName}</span>
          <span className="v2coll-subject__code">{p.subjectCode}</span>
        </span>
      ),
    },
    { key: 'code', header: 'Code', mono: true, width: 116, render: (p) => `${p.subjectCode}/${p.component}` },
    { key: 'session', header: 'Session', width: 140, render: (p) => sessionLabel(p.scode) },
    { key: 'paper', header: 'Paper', width: 168, render: (p) => componentLabel(p.component) },
    { key: 'difficulty', header: 'Difficulty', width: 120, render: (p) => <DifficultyPill difficulty={p.difficulty} /> },
    {
      key: 'actions', header: '', width: 48, align: 'right',
      render: (p) => (
        <span className="v2coll-rowactions" onClick={(e) => e.stopPropagation()}>
          <RowActions paper={p} onOpen={onOpen} onRemove={removePaper} />
        </span>
      ),
    },
  ];

  const emptyState = (
    <div className="v2coll-empty">
      <Icon name="folder" className="v2coll-empty__icon" />
      <div className="v2coll-empty__title t-ui">No papers in this collection</div>
      <div className="v2coll-empty__hint t-caption">
        Add papers from the Library or a paper's actions menu. Removing them here never deletes the download.
      </div>
    </div>
  );

  return (
    <div className="v2coll">
      <aside className="v2coll__master">
        <header className="v2coll__master-head">
          <h1 className="v2coll__title t-page-title">Collections</h1>
          <Button variant="secondary" size="dense" icon="plus" label="New collection" onClick={newCollection} />
        </header>
        <ul className="v2coll__list">
          {collections.map((c) => {
            const active = c.id === selectedId;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={['v2coll-item', active && 'is-active'].filter(Boolean).join(' ')}
                  aria-pressed={active}
                  onClick={() => setSelectedId(c.id)}
                >
                  <span className="v2coll-item__dot" style={{ ['--dot' as string]: c.tone }} aria-hidden="true" />
                  <span className="v2coll-item__name t-ui">{c.name}</span>
                  <span className="v2coll-item__count t-caption">{c.paperIds.length}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="v2coll__note t-caption">
          Collections only group papers you already have. Removing a paper or deleting a collection never deletes the paper itself.
        </p>
      </aside>

      {selected ? (
        <section className="v2coll__detail">
          <header className="v2coll__detail-head">
            <div className="v2coll__detail-id">
              <h2 className="v2coll__detail-name t-section-title">{selected.name}</h2>
              <p className="v2coll__detail-desc t-caption">{selected.description}</p>
            </div>
            <div className="v2coll__detail-tools">
              <span className="v2coll__detail-count t-caption">{`${rows.length} ${rows.length === 1 ? 'paper' : 'papers'}`}</span>
              <Button
                ref={sortRef} variant="ghost" size="dense" className="v2coll__sort"
                aria-haspopup="menu" aria-expanded={sortOpen} onClick={() => setSortOpen((v) => !v)}
              >
                <Icon name="list" className="v2coll__sort-icon" />
                <span>{`Sort: ${sortLabel}`}</span>
                <Icon name="chev" className={`v2coll__sort-dir is-${sort.dir}`} />
              </Button>
              <Menu open={sortOpen} onClose={() => setSortOpen(false)} anchorRef={sortRef} placement="bottom-end" label="Sort by">
                {SORT_OPTIONS.map((o) => (
                  <MenuItem key={o.key} icon={sort.key === o.key ? 'check' : undefined} label={o.label} onSelect={() => onSortChange(o.key)} />
                ))}
              </Menu>
              <Button
                ref={collMenuRef} variant="ghost" size="dense" iconOnly icon="dots"
                aria-label="Collection actions" aria-haspopup="menu" aria-expanded={collMenuOpen}
                onClick={() => setCollMenuOpen((v) => !v)}
              />
              <Menu open={collMenuOpen} onClose={() => setCollMenuOpen(false)} anchorRef={collMenuRef} placement="bottom-end" label="Collection actions">
                <MenuItem icon="pen" label="Rename collection" onSelect={() => undefined} />
                <MenuItem icon="trash" label="Delete collection (keeps papers)" danger onSelect={() => deleteCollection(selected.id)} />
              </Menu>
            </div>
          </header>
          <div className="v2coll__table-wrap">
            <Table<PaperRow>
              columns={columns}
              rows={rows}
              rowKey={(p) => String(p.id)}
              sort={sort}
              onSortChange={onSortChange}
              onRowActivate={onOpen}
              emptyState={emptyState}
            />
          </div>
        </section>
      ) : (
        <section className="v2coll__detail v2coll__detail--empty">
          <div className="v2coll-empty">
            <Icon name="folder" className="v2coll-empty__icon" />
            <div className="v2coll-empty__title t-ui">No collections yet</div>
            <div className="v2coll-empty__hint t-caption">Create one to group papers you want to keep together.</div>
            <Button variant="secondary" size="dense" icon="plus" label="New collection" onClick={newCollection} />
          </div>
        </section>
      )}
    </div>
  );
}
