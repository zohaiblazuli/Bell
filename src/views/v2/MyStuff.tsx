/**
 * MyStuff (Design System v2) — §11/§19.2. One reusable main-area list screen (never the shell) for
 * the three personal-library modes, chosen by the `mode` prop:
 *   • bookmarks — papers saved to return to, with a saved-state column
 *   • downloads — papers available offline, with a file-size column and a Remove action
 *   • history   — recently opened papers, with a relative "last opened" column
 *
 * Each mode gets its own page header, its own dedicated empty state, and mode-appropriate columns
 * on a shared v2 Table. Remove actions mutate local state so the screen behaves. Difficulty colour
 * is the one sanctioned hex exception, arriving as --pill-* custom props from difficulty.ts.
 */
import { useMemo, useRef, useState } from 'react';
import Table, { type Column } from '@ui/v2/Table';
import Badge from '@ui/v2/Badge';
import Button from '@ui/v2/Button';
import Menu, { MenuItem, MenuSeparator } from '@ui/v2/Menu';
import Icon, { type IconName } from '@/components/Icon';
import { bandFor, sessionLabel, componentLabel } from '@/lib/difficulty';
import type { PaperRow, Level, Qualification, Season, Difficulty } from '@/lib/types';
import './MyStuff.css';

export type MyStuffMode = 'bookmarks' | 'downloads' | 'history';

export interface MyStuffProps {
  /** Which personal-library list to render. */
  mode?: MyStuffMode;
  /** Open a paper (double-click / Enter / the row menu). */
  onOpen?: (p: PaperRow) => void;
  /** Optional "browse the library" escape hatch shown on the empty states. */
  onBrowse?: () => void;
}

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

let SEED_ID = 6200;

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

interface Item {
  paper: PaperRow;
  /** downloads only. */
  sizeBytes?: number;
  /** history only. */
  lastOpenedMs?: number;
}

const NOW = Date.now();
const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;

function relativeTime(ms: number): string {
  const diff = NOW - ms;
  if (diff < HOUR) return `${Math.max(1, Math.round(diff / MIN))}m ago`;
  if (diff < DAY) return `${Math.round(diff / HOUR)}h ago`;
  if (diff < 30 * DAY) return `${Math.round(diff / DAY)}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function formatBytes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(n / 1000)} KB`;
}

const DATA: Record<MyStuffMode, Item[]> = {
  bookmarks: [
    { paper: mk({ subjectCode: '9709', subjectName: 'Mathematics', level: 'A Level', qualification: 'a_level', year: 2024, scode: 's24', season: 'may_june', component: '13', totalMarks: 75, hardnessScore: 44, difficulty: 'medium', downloaded: true, msDownloaded: true }) },
    { paper: mk({ subjectCode: '9702', subjectName: 'Physics', level: 'A Level', qualification: 'a_level', year: 2024, scode: 'w24', season: 'oct_nov', component: '42', totalMarks: 100, hardnessScore: 70, difficulty: 'hard', downloaded: false }) },
    { paper: mk({ subjectCode: '0610', subjectName: 'Biology', level: 'IGCSE', qualification: 'igcse', year: 2024, scode: 's24', season: 'may_june', component: '22', totalMarks: 80, hardnessScore: 30, difficulty: 'easy', downloaded: true }) },
    { paper: mk({ subjectCode: '9701', subjectName: 'Chemistry', level: 'A Level', qualification: 'a_level', year: 2024, scode: 'w24', season: 'oct_nov', component: '11', totalMarks: 40, hardnessScore: 41, difficulty: 'medium', downloaded: true, msDownloaded: true }) },
    { paper: mk({ subjectCode: '9231', subjectName: 'Further Mathematics', level: 'A Level', qualification: 'a_level', year: 2025, scode: 's25', season: 'may_june', component: '13', totalMarks: 75, hardnessScore: 79, difficulty: 'hard', downloaded: false }) },
  ],
  downloads: [
    { sizeBytes: 2_400_000, paper: mk({ subjectCode: '9709', subjectName: 'Mathematics', level: 'A Level', qualification: 'a_level', year: 2025, scode: 's25', season: 'may_june', component: '32', totalMarks: 75, hardnessScore: 72, difficulty: 'hard', downloaded: true, msDownloaded: true }) },
    { sizeBytes: 1_800_000, paper: mk({ subjectCode: '9702', subjectName: 'Physics', level: 'A Level', qualification: 'a_level', year: 2024, scode: 'w24', season: 'oct_nov', component: '22', totalMarks: 60, hardnessScore: 45, difficulty: 'medium', downloaded: true, msDownloaded: true }) },
    { sizeBytes: 3_100_000, paper: mk({ subjectCode: '0580', subjectName: 'Mathematics', level: 'IGCSE', qualification: 'igcse', year: 2025, scode: 'm25', season: 'feb_mar', component: '42', totalMarks: 130, hardnessScore: 52, difficulty: 'medium', downloaded: true, msDownloaded: true }) },
    { sizeBytes: 2_050_000, paper: mk({ subjectCode: '9618', subjectName: 'Computer Science', level: 'A Level', qualification: 'a_level', year: 2025, scode: 's25', season: 'may_june', component: '12', totalMarks: 75, hardnessScore: 44, difficulty: 'medium', downloaded: true }) },
    { sizeBytes: 4_600_000, paper: mk({ subjectCode: '9700', subjectName: 'Biology', level: 'A Level', qualification: 'a_level', year: 2024, scode: 'w24', season: 'oct_nov', component: '42', totalMarks: 100, hardnessScore: 68, difficulty: 'hard', downloaded: true, msDownloaded: true }) },
  ],
  history: [
    { lastOpenedMs: NOW - 25 * MIN, paper: mk({ subjectCode: '9709', subjectName: 'Mathematics', level: 'A Level', qualification: 'a_level', year: 2025, scode: 's25', season: 'may_june', component: '32', totalMarks: 75, hardnessScore: 72, difficulty: 'hard', downloaded: true, msDownloaded: true }) },
    { lastOpenedMs: NOW - 3 * HOUR, paper: mk({ subjectCode: '9702', subjectName: 'Physics', level: 'A Level', qualification: 'a_level', year: 2024, scode: 'w24', season: 'oct_nov', component: '42', totalMarks: 100, hardnessScore: 70, difficulty: 'hard', downloaded: false }) },
    { lastOpenedMs: NOW - 26 * HOUR, paper: mk({ subjectCode: '0580', subjectName: 'Mathematics', level: 'IGCSE', qualification: 'igcse', year: 2024, scode: 'm24', season: 'feb_mar', component: '22', totalMarks: 70, hardnessScore: 34, difficulty: 'medium', downloaded: true }) },
    { lastOpenedMs: NOW - 3 * DAY, paper: mk({ subjectCode: '9701', subjectName: 'Chemistry', level: 'A Level', qualification: 'a_level', year: 2024, scode: 's24', season: 'may_june', component: '42', totalMarks: 100, hardnessScore: 74, difficulty: 'hard', downloaded: true, msDownloaded: true }) },
    { lastOpenedMs: NOW - 9 * DAY, paper: mk({ subjectCode: '9231', subjectName: 'Further Mathematics', level: 'A Level', qualification: 'a_level', year: 2025, scode: 's25', season: 'may_june', component: '11', totalMarks: 75, hardnessScore: 81, difficulty: 'hard', downloaded: false }) },
    { lastOpenedMs: NOW - 41 * DAY, paper: mk({ subjectCode: '9618', subjectName: 'Computer Science', level: 'A Level', qualification: 'a_level', year: 2025, scode: 's25', season: 'may_june', component: '11', totalMarks: 75, hardnessScore: 39, difficulty: 'easy', downloaded: true }) },
  ],
};

/** Difficulty pill — colour arrives as --pill-* custom props from difficulty.ts (the one hex exception). */
function DifficultyPill({ difficulty }: { difficulty: Difficulty | null }) {
  const band = bandFor(difficulty);
  if (!band.rated) return <span className="v2mine-pill v2mine-pill--unrated">—</span>;
  return (
    <span className="v2mine-pill" style={{ ['--pill-color' as string]: band.deep, ['--pill-bg' as string]: band.tint }}>
      {band.label}
    </span>
  );
}

function SubjectCell({ paper }: { paper: PaperRow }) {
  return (
    <span className="v2mine-subject">
      <span className="v2mine-subject__name">{paper.subjectName}</span>
      <span className="v2mine-subject__code">{paper.subjectCode}</span>
    </span>
  );
}

function RowActions({ paper, onOpen, onRemove, removeLabel, removeIcon }: {
  paper: PaperRow;
  onOpen?: (p: PaperRow) => void;
  onRemove: (id: number) => void;
  removeLabel: string;
  removeIcon: IconName;
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
        <MenuItem icon={removeIcon} label={removeLabel} onSelect={() => onRemove(paper.id)} />
      </Menu>
    </>
  );
}

interface EmptyCopy { icon: IconName; title: string; hint: string; }
const EMPTY: Record<MyStuffMode, EmptyCopy> = {
  bookmarks: { icon: 'bm', title: 'No bookmarks yet', hint: 'Save a paper to return to it quickly. Bookmarks stay with your library.' },
  downloads: { icon: 'folder', title: 'No downloads on this device', hint: 'Download a paper to open it offline. Downloads live only on this machine.' },
  history: { icon: 'clock', title: 'Nothing opened yet', hint: 'Papers you open appear here, most recent first.' },
};

const REMOVE: Record<MyStuffMode, { label: string; icon: IconName }> = {
  bookmarks: { label: 'Remove bookmark', icon: 'bm' },
  downloads: { label: 'Remove download', icon: 'trash' },
  history: { label: 'Remove from history', icon: 'x' },
};

export default function MyStuff({ mode = 'bookmarks', onOpen, onBrowse }: MyStuffProps = {}) {
  const [removed, setRemoved] = useState<Set<number>>(new Set());

  const base = DATA[mode];
  const metaById = useMemo(() => new Map(base.map((i) => [i.paper.id, i])), [base]);

  const items = useMemo(() => {
    let list = base.filter((i) => !removed.has(i.paper.id));
    if (mode === 'history') list = [...list].sort((a, b) => (b.lastOpenedMs ?? 0) - (a.lastOpenedMs ?? 0));
    return list;
  }, [base, removed, mode]);

  const rows = useMemo(() => items.map((i) => i.paper), [items]);

  const removePaper = (id: number) => setRemoved((prev) => new Set(prev).add(id));

  const totalBytes = mode === 'downloads' ? items.reduce((sum, i) => sum + (i.sizeBytes ?? 0), 0) : 0;

  const heading: Record<MyStuffMode, { title: string; caption: string }> = {
    bookmarks: { title: 'Bookmarks', caption: `${rows.length} ${rows.length === 1 ? 'paper' : 'papers'} saved to return to.` },
    downloads: { title: 'Downloads', caption: `${rows.length} ${rows.length === 1 ? 'paper' : 'papers'} · ${formatBytes(totalBytes)} on this device.` },
    history: { title: 'History', caption: 'Recently opened papers, most recent first.' },
  };

  const columns: Column<PaperRow>[] = [
    { key: 'subject', header: 'Subject', render: (p) => <SubjectCell paper={p} /> },
    { key: 'code', header: 'Code', mono: true, width: 116, render: (p) => `${p.subjectCode}/${p.component}` },
    { key: 'session', header: 'Session', width: 140, render: (p) => sessionLabel(p.scode) },
    { key: 'paper', header: 'Paper', width: 168, render: (p) => componentLabel(p.component) },
    { key: 'difficulty', header: 'Difficulty', width: 120, render: (p) => <DifficultyPill difficulty={p.difficulty} /> },
  ];

  if (mode === 'bookmarks') {
    columns.push({
      key: 'saved', header: 'Saved', width: 116,
      render: () => <Badge tone="accent" variant="soft" icon="bm">Saved</Badge>,
    });
  } else if (mode === 'downloads') {
    columns.push({
      key: 'size', header: 'Size', width: 104, align: 'right', mono: true,
      render: (p) => formatBytes(metaById.get(p.id)?.sizeBytes ?? 0),
    });
  } else {
    columns.push({
      key: 'opened', header: 'Last opened', width: 140, align: 'right', mono: true,
      render: (p) => relativeTime(metaById.get(p.id)?.lastOpenedMs ?? NOW),
    });
  }

  const remove = REMOVE[mode];
  columns.push({
    key: 'actions', header: '', width: 48, align: 'right',
    render: (p) => (
      <span className="v2mine-rowactions" onClick={(e) => e.stopPropagation()}>
        <RowActions paper={p} onOpen={onOpen} onRemove={removePaper} removeLabel={remove.label} removeIcon={remove.icon} />
      </span>
    ),
  });

  const empty = EMPTY[mode];
  const emptyState = (
    <div className="v2mine-empty">
      <Icon name={empty.icon} className="v2mine-empty__icon" />
      <div className="v2mine-empty__title t-ui">{empty.title}</div>
      <div className="v2mine-empty__hint t-caption">{empty.hint}</div>
      {onBrowse ? <Button variant="secondary" size="dense" icon="grid" label="Browse the library" onClick={onBrowse} /> : null}
    </div>
  );

  const head = heading[mode];
  return (
    <div className="v2mine">
      <header className="v2mine__header">
        <h1 className="v2mine__title t-page-title">{head.title}</h1>
        <p className="v2mine__caption t-caption">{head.caption}</p>
      </header>
      <div className="v2mine__table-wrap">
        <Table<PaperRow>
          columns={columns}
          rows={rows}
          rowKey={(p) => String(p.id)}
          onRowActivate={onOpen}
          emptyState={emptyState}
        />
      </div>
    </div>
  );
}
