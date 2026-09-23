/**
 * LibraryPreview — a self-contained harness for the v2 Library screen (§9). It assembles the
 * AppShell (NavSidebar + top bar + Inspector) around LibraryView and owns all shell/selection
 * state locally. The rows are real CAIE papers so the dense list and difficulty ratings read
 * truthfully; nothing here talks to Tauri.
 */
import { useState } from 'react';
import AppShell from '@/components/v2/AppShell';
import NavSidebar from '@/components/v2/NavSidebar';
import Inspector from '@/components/v2/Inspector';
import Input from '@ui/v2/Input';
import Button from '@ui/v2/Button';
import Icon from '@/components/Icon';
import Sprite from '@/components/Sprite';
import LibraryView, { PaperInspectorBody, type V2LibraryProps } from './LibraryView';
import type { PaperRow } from '@/lib/types';
import './LibraryPreview.css';

/** Study-state key, matching LibraryView's internal `markKey`. */
const mk = (p: PaperRow) => `${p.subjectCode}/${p.scode}/${p.component}`;

/** ~14 real Cambridge (CAIE) papers across A Level and IGCSE, with realistic thresholds and ratings. */
const SAMPLE_PAPERS: PaperRow[] = [
  { id: 1, subjectId: 101, subjectCode: '9709', subjectName: 'Mathematics', qualification: 'a_level', level: 'A Level',
    year: 2023, scode: 's23', season: 'may_june', component: '12', paperNumber: 1, variant: 2, totalMarks: 75,
    aThreshold: 57, bThreshold: 50, cThreshold: 43, dThreshold: 36, eThreshold: 29, aPct: 18, curveMeanPct: 52, spanPct: 61,
    hardnessScore: 61, difficulty: 'medium', difficultyBasis: 'component',
    difficultyNote: 'A shade harder than a typical May/June Paper 1 — the vectors question stretched the top end.',
    hasMs: true, qpPath: '~/ShinyPapers/9709/s23_12_qp.pdf', msPath: null },
  { id: 2, subjectId: 101, subjectCode: '9709', subjectName: 'Mathematics', qualification: 'a_level', level: 'A Level',
    year: 2022, scode: 'w22', season: 'oct_nov', component: '32', paperNumber: 3, variant: 2, totalMarks: 75,
    aThreshold: 62, bThreshold: 54, cThreshold: 46, dThreshold: 39, eThreshold: 32, aPct: 22, curveMeanPct: 49, spanPct: 66,
    hardnessScore: 72, difficulty: 'hard', difficultyBasis: 'component',
    difficultyNote: 'Noticeably harder than usual for Paper 3; the A threshold fell to 62/75.',
    hasMs: true, qpPath: null, msPath: null },
  { id: 3, subjectId: 102, subjectCode: '9702', subjectName: 'Physics', qualification: 'a_level', level: 'A Level',
    year: 2023, scode: 's23', season: 'may_june', component: '22', paperNumber: 2, variant: 2, totalMarks: 60,
    aThreshold: 43, bThreshold: 37, cThreshold: 31, dThreshold: 26, eThreshold: 21, aPct: 15, curveMeanPct: 47, spanPct: 70,
    hardnessScore: 78, difficulty: 'hard', difficultyBasis: 'component',
    difficultyNote: 'One of the toughest recent Physics Paper 2 sittings — low grade boundaries across the board.',
    hasMs: true, qpPath: '~/ShinyPapers/9702/s23_22_qp.pdf', msPath: '~/ShinyPapers/9702/s23_22_ms.pdf' },
  { id: 4, subjectId: 102, subjectCode: '9702', subjectName: 'Physics', qualification: 'a_level', level: 'A Level',
    year: 2022, scode: 'w22', season: 'oct_nov', component: '42', paperNumber: 4, variant: 2, totalMarks: 100,
    aThreshold: 66, bThreshold: 58, cThreshold: 50, dThreshold: 43, eThreshold: 36, aPct: 24, curveMeanPct: 54, spanPct: 58,
    hardnessScore: 48, difficulty: 'medium', difficultyBasis: 'component',
    difficultyNote: 'Close to an ordinary sitting of Paper 4.',
    hasMs: true, qpPath: null, msPath: null },
  { id: 5, subjectId: 103, subjectCode: '9701', subjectName: 'Chemistry', qualification: 'a_level', level: 'A Level',
    year: 2023, scode: 's23', season: 'may_june', component: '11', paperNumber: 1, variant: 1, totalMarks: 40,
    aThreshold: 33, bThreshold: 30, cThreshold: 27, dThreshold: 24, eThreshold: 21, aPct: 28, curveMeanPct: 63, spanPct: 44,
    hardnessScore: 30, difficulty: 'easy', difficultyBasis: 'component',
    difficultyNote: 'Easier than most — the multiple-choice paper had a high A threshold of 33/40.',
    hasMs: false, qpPath: '~/ShinyPapers/9701/s23_11_qp.pdf', msPath: null },
  { id: 6, subjectId: 103, subjectCode: '9701', subjectName: 'Chemistry', qualification: 'a_level', level: 'A Level',
    year: 2022, scode: 'w22', season: 'oct_nov', component: '52', paperNumber: 5, variant: 2, totalMarks: 30,
    aThreshold: null, bThreshold: null, cThreshold: null, dThreshold: null, eThreshold: null, aPct: null, curveMeanPct: null, spanPct: null,
    hardnessScore: null, difficulty: null, difficultyBasis: null, difficultyNote: null,
    hasMs: true, qpPath: null, msPath: null },
  { id: 7, subjectId: 104, subjectCode: '9231', subjectName: 'Further Mathematics', qualification: 'a_level', level: 'A Level',
    year: 2023, scode: 's23', season: 'may_june', component: '13', paperNumber: 1, variant: 3, totalMarks: 75,
    aThreshold: 60, bThreshold: 52, cThreshold: 44, dThreshold: 37, eThreshold: 30, aPct: 9, curveMeanPct: 44, spanPct: 72,
    hardnessScore: 83, difficulty: 'hard', difficultyBasis: 'component',
    difficultyNote: 'Among the hardest Further Maths Paper 1 sittings on record.',
    hasMs: true, qpPath: null, msPath: null },
  { id: 8, subjectId: 104, subjectCode: '9231', subjectName: 'Further Mathematics', qualification: 'a_level', level: 'A Level',
    year: 2022, scode: 'w22', season: 'oct_nov', component: '23', paperNumber: 2, variant: 3, totalMarks: 75,
    aThreshold: null, bThreshold: null, cThreshold: null, dThreshold: null, eThreshold: null, aPct: null, curveMeanPct: null, spanPct: null,
    hardnessScore: null, difficulty: null, difficultyBasis: null, difficultyNote: null,
    hasMs: true, qpPath: null, msPath: null },
  { id: 9, subjectId: 201, subjectCode: '0580', subjectName: 'Mathematics', qualification: 'igcse', level: 'IGCSE',
    year: 2023, scode: 'm23', season: 'feb_mar', component: '22', paperNumber: 2, variant: 2, totalMarks: 70,
    aThreshold: 51, bThreshold: 42, cThreshold: 33, dThreshold: 25, eThreshold: 18, aPct: 20, curveMeanPct: 55, spanPct: 57,
    hardnessScore: 45, difficulty: 'medium', difficultyBasis: 'component',
    difficultyNote: 'A fairly standard Feb/March Paper 2.',
    hasMs: true, qpPath: '~/ShinyPapers/0580/m23_22_qp.pdf', msPath: '~/ShinyPapers/0580/m23_22_ms.pdf' },
  { id: 10, subjectId: 201, subjectCode: '0580', subjectName: 'Mathematics', qualification: 'igcse', level: 'IGCSE',
    year: 2023, scode: 's23', season: 'may_june', component: '42', paperNumber: 4, variant: 2, totalMarks: 130,
    aThreshold: 93, bThreshold: 78, cThreshold: 63, dThreshold: 48, eThreshold: 33, aPct: 26, curveMeanPct: 53, spanPct: 60,
    hardnessScore: 55, difficulty: 'medium', difficultyBasis: 'component',
    difficultyNote: 'Slightly harder than average for Paper 4, mostly in the later structured questions.',
    hasMs: true, qpPath: '~/ShinyPapers/0580/s23_42_qp.pdf', msPath: null },
  { id: 11, subjectId: 202, subjectCode: '0620', subjectName: 'Chemistry', qualification: 'igcse', level: 'IGCSE',
    year: 2023, scode: 'm23', season: 'feb_mar', component: '32', paperNumber: 3, variant: 2, totalMarks: 80,
    aThreshold: 62, bThreshold: 52, cThreshold: 42, dThreshold: 33, eThreshold: 24, aPct: 31, curveMeanPct: 61, spanPct: 46,
    hardnessScore: 28, difficulty: 'easy', difficultyBasis: 'component',
    difficultyNote: 'An accessible Paper 3; boundaries were high.',
    hasMs: true, qpPath: null, msPath: null },
  { id: 12, subjectId: 202, subjectCode: '0620', subjectName: 'Chemistry', qualification: 'igcse', level: 'IGCSE',
    year: 2022, scode: 'w22', season: 'oct_nov', component: '62', paperNumber: 6, variant: 2, totalMarks: 60,
    aThreshold: 45, bThreshold: 38, cThreshold: 31, dThreshold: 25, eThreshold: 19, aPct: 19, curveMeanPct: 50, spanPct: 63,
    hardnessScore: 66, difficulty: 'medium', difficultyBasis: 'component',
    difficultyNote: 'Toward the harder end of typical for the alternative-to-practical paper.',
    hasMs: false, qpPath: '~/ShinyPapers/0620/w22_62_qp.pdf', msPath: null },
  { id: 13, subjectId: 203, subjectCode: '0610', subjectName: 'Biology', qualification: 'igcse', level: 'IGCSE',
    year: 2023, scode: 's23', season: 'may_june', component: '41', paperNumber: 4, variant: 1, totalMarks: 80,
    aThreshold: 58, bThreshold: 49, cThreshold: 40, dThreshold: 31, eThreshold: 22, aPct: 17, curveMeanPct: 48, spanPct: 68,
    hardnessScore: 70, difficulty: 'hard', difficultyBasis: 'component',
    difficultyNote: 'A demanding Paper 4 — the genetics section pulled the mean down.',
    hasMs: true, qpPath: null, msPath: null },
  { id: 14, subjectId: 204, subjectCode: '0455', subjectName: 'Economics', qualification: 'igcse', level: 'IGCSE',
    year: 2022, scode: 'w22', season: 'oct_nov', component: '22', paperNumber: 2, variant: 2, totalMarks: 90,
    aThreshold: null, bThreshold: null, cThreshold: null, dThreshold: null, eThreshold: null, aPct: null, curveMeanPct: null, spanPct: null,
    hardnessScore: null, difficulty: null, difficultyBasis: null, difficultyNote: null,
    hasMs: false, qpPath: null, msPath: null },
];
export default function LibraryPreview() {
  const [papers, setPapers] = useState<PaperRow[]>(SAMPLE_PAPERS);
  const [selected, setSelected] = useState<PaperRow | null>(null);
  const [navActive, setNavActive] = useState('library');
  const [sidebarWidth, setSidebarWidth] = useState(232);

  // Seed a spread of study states so the Status column shows Done / Saved / Revision alongside Downloaded.
  const [bookmarked, setBookmarked] = useState<Set<string>>(() => new Set([mk(SAMPLE_PAPERS[0]), mk(SAMPLE_PAPERS[12])]));
  const [done, setDone] = useState<Set<string>>(() => new Set([mk(SAMPLE_PAPERS[2]), mk(SAMPLE_PAPERS[9])]));
  const [revision, setRevision] = useState<Set<string>>(() => new Set([mk(SAMPLE_PAPERS[6])]));

  // The selected object may be stale after a download flips qpPath — re-resolve it from `papers`.
  const activePaper = selected ? papers.find((p) => p.id === selected.id) ?? selected : null;

  const onToggleMark: V2LibraryProps['onToggleMark'] = (p, set) => {
    const k = mk(p);
    const apply = (prev: Set<string>) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    };
    if (set === 'bookmarks') setBookmarked(apply);
    else if (set === 'done') setDone(apply);
    else setRevision(apply);
  };

  const onDownload = (p: PaperRow) =>
    setPapers((prev) =>
      prev.map((r) =>
        r.id === p.id
          ? {
              ...r,
              qpPath: r.qpPath ?? `~/ShinyPapers/${r.subjectCode}/${r.scode}_${r.component}_qp.pdf`,
              msPath: r.hasMs ? r.msPath ?? `~/ShinyPapers/${r.subjectCode}/${r.scode}_${r.component}_ms.pdf` : r.msPath,
            }
          : r,
      ),
    );

  const onOpen = (p: PaperRow) => setSelected(p);

  const topBar = (
    <div className="v2libp-topbar">
      <span className="v2libp-brand t-ui">Bell</span>
      <nav className="v2libp-crumb t-ui" aria-label="Breadcrumb">Library</nav>
      <div className="v2libp-spacer" />
      <Input className="v2libp-search" leading={<Icon name="search" />} placeholder="Search" aria-label="Global search" />
    </div>
  );

  const sidebar = <NavSidebar activeId={navActive} onNavigate={setNavActive} />;

  const inspector = activePaper ? (
    <Inspector
      title={`${activePaper.subjectCode}/${activePaper.scode}/${activePaper.component}`}
      onClose={() => setSelected(null)}
      footer={<Button variant="primary" size="default" icon="doc" label="Open paper" onClick={() => onOpen(activePaper)} />}
    >
      <PaperInspectorBody paper={activePaper} />
    </Inspector>
  ) : null;

  return (
    <div className="v2libp-root">
      {/* The icon sprite is mounted by App in the real app; the preview needs it too so <Icon> resolves. */}
      <Sprite />
      <AppShell
        className="v2libp-shell"
        topBar={topBar}
        sidebar={sidebar}
        sidebarWidth={sidebarWidth}
        onSidebarWidthChange={setSidebarWidth}
        inspector={inspector}
        inspectorOpen={Boolean(activePaper)}
        onInspectorClose={() => setSelected(null)}
      >
        <LibraryView
          papers={papers}
          onOpen={onOpen}
          bookmarked={bookmarked}
          done={done}
          revision={revision}
          onToggleMark={onToggleMark}
          onDownload={onDownload}
          selectedKey={activePaper ? String(activePaper.id) : undefined}
          onSelect={(p) => setSelected(p)}
        />
      </AppShell>
    </div>
  );
}
