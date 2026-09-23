/**
 * Practice (Design System v2) — §14. Main-area content for the Practice flow (never the shell).
 * A top SegmentedControl toggles Attempt | Review.
 *
 * Attempt (default): a focused pre-start card for the selected paper — identity, duration, total
 * marks, mark-scheme + offline-ready Badges, and a dominant primary "Start paper" with subordinate
 * Untimed / Review actions — beside a compact picker for a different paper. Review: a static
 * side-by-side of the student answer, the mark scheme and a score/mistakes breakdown with topic
 * mapping and a Retry action; the timer is visible but not dominant and the offline state reads
 * calm, not alarming.
 *
 * No PDF reader is built here — Attempt mode reuses the existing reader (see the note). Difficulty
 * colour is the one sanctioned hex exception, arriving as --pill-* custom props from difficulty.ts.
 */
import { useState } from 'react';
import Button from '@ui/v2/Button';
import Badge from '@ui/v2/Badge';
import SegmentedControl from '@ui/v2/SegmentedControl';
import Icon from '@/components/Icon';
import { bandFor, sessionLabel, componentLabel } from '@/lib/difficulty';
import type { PaperRow, Level, Qualification, Season, Difficulty } from '@/lib/types';
import './Practice.css';

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
  difficultyNote?: string | null;
  thresholds?: [number, number, number, number, number];
  hasMs?: boolean;
  downloaded?: boolean;
  msDownloaded?: boolean;
};

let SEED_ID = 4200;

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
    difficultyNote: s.difficultyNote ?? null,
    hasMs: s.hasMs ?? true,
    qpPath: s.downloaded ? `offline/${s.subjectCode}_${s.scode}_${s.component}_qp.pdf` : null,
    msPath: s.msDownloaded ? `offline/${s.subjectCode}_${s.scode}_${s.component}_ms.pdf` : null,
  };
}

interface PracticePaper {
  paper: PaperRow;
  durationMin: number;
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** A→U from the paper's own grade thresholds; null-safe. */
function gradeFor(score: number, p: PaperRow): string {
  const bands: Array<[string, number | null]> = [
    ['A', p.aThreshold], ['B', p.bThreshold], ['C', p.cThreshold],
    ['D', p.dThreshold], ['E', p.eThreshold],
  ];
  for (const [g, t] of bands) if (t != null && score >= t) return g;
  return 'U';
}

/** Difficulty pill — colour arrives as --pill-* custom props from difficulty.ts (the one hex exception). */
function DifficultyPill({ difficulty }: { difficulty: Difficulty | null }) {
  const band = bandFor(difficulty);
  if (!band.rated) return <span className="v2prac-pill v2prac-pill--unrated">—</span>;
  return (
    <span className="v2prac-pill" style={{ ['--pill-color' as string]: band.deep, ['--pill-bg' as string]: band.tint }}>
      {band.label}
    </span>
  );
}

const PAPERS: PracticePaper[] = [
  {
    durationMin: 110,
    paper: mk({
      subjectCode: '9709', subjectName: 'Mathematics', level: 'A Level', qualification: 'a_level',
      year: 2023, scode: 's23', season: 'may_june', component: '32', totalMarks: 75,
      hardnessScore: 72, difficulty: 'hard',
      difficultyNote: 'Thresholds sat well below the component average — a demanding Pure 3.',
      thresholds: [61, 54, 47, 38, 29], downloaded: true, msDownloaded: true,
    }),
  },
  {
    durationMin: 110,
    paper: mk({
      subjectCode: '9709', subjectName: 'Mathematics', level: 'A Level', qualification: 'a_level',
      year: 2024, scode: 's24', season: 'may_june', component: '12', totalMarks: 75,
      hardnessScore: 41, difficulty: 'medium', thresholds: [66, 58, 50, 43, 36],
      downloaded: true, msDownloaded: true,
    }),
  },
  {
    durationMin: 120,
    paper: mk({
      subjectCode: '9702', subjectName: 'Physics', level: 'A Level', qualification: 'a_level',
      year: 2023, scode: 'w23', season: 'oct_nov', component: '42', totalMarks: 100,
      hardnessScore: 63, difficulty: 'hard', thresholds: [72, 64, 56, 48, 40], downloaded: false,
    }),
  },
  {
    durationMin: 90,
    paper: mk({
      subjectCode: '0580', subjectName: 'Mathematics', level: 'IGCSE', qualification: 'igcse',
      year: 2024, scode: 'm24', season: 'feb_mar', component: '22', totalMarks: 70,
      hardnessScore: 34, difficulty: 'medium', thresholds: [56, 45, 34, 27, 20], downloaded: true,
    }),
  },
  {
    durationMin: 75,
    paper: mk({
      subjectCode: '9701', subjectName: 'Chemistry', level: 'A Level', qualification: 'a_level',
      year: 2022, scode: 'w22', season: 'oct_nov', component: '22', totalMarks: 60,
      hardnessScore: null, difficulty: null, downloaded: false,
    }),
  },
];

/* The completed attempt shown in Review — fixed so the answer/scheme/mistakes stay coherent. */
const REVIEW_PAPER = PAPERS[0].paper;
const REVIEW_SCORE = 58;

function PreStart({
  items, selectedId, onSelect, onStart, onReview,
}: {
  items: PracticePaper[];
  selectedId: number;
  onSelect: (id: number) => void;
  onStart: (timed: boolean) => void;
  onReview: () => void;
}) {
  const current = items.find((i) => i.paper.id === selectedId) ?? items[0];
  const p = current.paper;
  const downloaded = p.qpPath != null;

  return (
    <div className="v2prac__attempt">
      <section className="v2prac-card" aria-labelledby="v2prac-card-title">
        <div className="v2prac-card__head">
          <span className="v2prac-card__code t-ui">{`${p.subjectCode}/${p.component}`}</span>
          <DifficultyPill difficulty={p.difficulty} />
        </div>
        <h2 id="v2prac-card-title" className="v2prac-card__subject t-section-title">{p.subjectName}</h2>
        <p className="v2prac-card__meta t-caption">{`${sessionLabel(p.scode)} · ${componentLabel(p.component)}`}</p>

        <div className="v2prac-card__stats">
          <div className="v2prac-stat">
            <span className="v2prac-stat__label t-micro">Duration</span>
            <span className="v2prac-stat__value t-section-title">{formatDuration(current.durationMin)}</span>
          </div>
          <div className="v2prac-stat">
            <span className="v2prac-stat__label t-micro">Total marks</span>
            <span className="v2prac-stat__value t-section-title">{p.totalMarks ?? '—'}</span>
          </div>
        </div>

        <div className="v2prac-card__badges">
          <Badge tone={p.hasMs ? 'info' : 'neutral'} variant="soft" icon={p.hasMs ? 'check' : undefined}>
            {p.hasMs ? 'Mark scheme available' : 'No mark scheme'}
          </Badge>
          <Badge tone={downloaded ? 'success' : 'neutral'} variant="soft" icon={downloaded ? 'check' : 'doc'}>
            {downloaded ? 'Offline ready' : 'Download to work offline'}
          </Badge>
        </div>

        <div className="v2prac-card__actions">
          <Button variant="primary" size="prominent" icon="play" label="Start paper"
            className="v2prac-card__start" onClick={() => onStart(true)} />
          <div className="v2prac-card__sub">
            <Button variant="secondary" size="default" icon="clock" label="Untimed" onClick={() => onStart(false)} />
            <Button variant="ghost" size="default" icon="check" label="Review answers" onClick={onReview} />
          </div>
        </div>
      </section>

      <aside className="v2prac-picker" aria-label="Choose another paper">
        <div className="v2prac-picker__head t-micro">Choose another paper</div>
        <ul className="v2prac-picker__list">
          {items.map((it) => {
            const q = it.paper;
            const active = q.id === selectedId;
            return (
              <li key={q.id}>
                <button
                  type="button"
                  className={['v2prac-row', active && 'is-active'].filter(Boolean).join(' ')}
                  aria-pressed={active}
                  onClick={() => onSelect(q.id)}
                >
                  <span className="v2prac-row__main">
                    <span className="v2prac-row__code t-ui">{`${q.subjectCode}/${q.component}`}</span>
                    <span className="v2prac-row__meta t-caption">{`${q.subjectName} · ${sessionLabel(q.scode)}`}</span>
                  </span>
                  <span className="v2prac-row__aside">
                    <DifficultyPill difficulty={q.difficulty} />
                    <span className="v2prac-row__dur t-caption">{formatDuration(it.durationMin)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}

function Review({ paper, score, onRetry }: { paper: PaperRow; score: number; onRetry: () => void }) {
  const downloaded = paper.qpPath != null;
  const total = paper.totalMarks ?? 0;
  const grade = gradeFor(score, paper);
  const mistakes = [
    { q: 'Q4(b)', topic: 'Vectors', note: 'Sign error resolving the horizontal component.', lost: 2 },
    { q: 'Q7', topic: 'Differentiation', note: 'Chain rule missed on the inner function.', lost: 3 },
    { q: 'Q9(c)', topic: 'Integration by parts', note: 'Correct method, arithmetic slip in the limits.', lost: 1 },
  ];
  return (
    <div className="v2prac__review">
      <div className="v2prac-review__bar">
        <div className="v2prac-review__id">
          <span className="v2prac-review__code t-ui">{`${paper.subjectCode}/${paper.component}`}</span>
          <span className="v2prac-review__meta t-caption">
            {`${paper.subjectName} · ${sessionLabel(paper.scode)} · ${componentLabel(paper.component)}`}
          </span>
        </div>
        <div className="v2prac-review__status">
          <span className="v2prac-timer t-caption" role="timer" aria-label="Time taken 1 hour 42 minutes">
            <Icon name="clock" className="v2prac-timer__icon" />
            1:42:05
          </span>
          <Badge tone={downloaded ? 'success' : 'info'} variant="soft" icon={downloaded ? 'check' : 'doc'}>
            {downloaded ? 'Offline ready' : 'Streaming'}
          </Badge>
        </div>
      </div>

      <div className="v2prac-review__grid">
        <section className="v2prac-panel" aria-labelledby="v2prac-yours">
          <header className="v2prac-panel__head">
            <Icon name="pen" className="v2prac-panel__icon" />
            <h3 id="v2prac-yours" className="v2prac-panel__title t-ui">Your answer</h3>
          </header>
          <div className="v2prac-panel__body v2prac-exam t-body">
            <p className="v2prac-exam__q">Q7&nbsp;&nbsp;Differentiate y = (3x² − 1)⁵.</p>
            <p>dy/dx = 5(3x² − 1)⁴</p>
            <p className="v2prac-exam__slip">↳ stopped here — forgot × 6x</p>
            <p className="v2prac-exam__q">Q9(c)&nbsp;&nbsp;∫ x ln x dx</p>
            <p>= ½x² ln x − ∫ ½x dx = ½x² ln x − ¼x² + c</p>
          </div>
        </section>

        <section className="v2prac-panel" aria-labelledby="v2prac-scheme">
          <header className="v2prac-panel__head">
            <Icon name="doc" className="v2prac-panel__icon" />
            <h3 id="v2prac-scheme" className="v2prac-panel__title t-ui">Mark scheme</h3>
          </header>
          <div className="v2prac-panel__body v2prac-exam t-body">
            <p className="v2prac-exam__q">Q7</p>
            <p>d/dx = 5(3x² − 1)⁴ · 6x <span className="v2prac-exam__mark">B1</span> chain rule</p>
            <p>= 30x(3x² − 1)⁴ <span className="v2prac-exam__mark">A1</span></p>
            <p className="v2prac-exam__q">Q9(c)</p>
            <p>parts, u = ln x <span className="v2prac-exam__mark">M1</span></p>
            <p>½x² ln x − ¼x² + c <span className="v2prac-exam__mark">A1</span></p>
          </div>
        </section>

        <section className="v2prac-panel v2prac-panel--score" aria-labelledby="v2prac-score">
          <header className="v2prac-panel__head">
            <Icon name="check" className="v2prac-panel__icon" />
            <h3 id="v2prac-score" className="v2prac-panel__title t-ui">Score &amp; mistakes</h3>
          </header>
          <div className="v2prac-panel__body">
            <div className="v2prac-score">
              <span className="v2prac-score__value t-display">{score}<span className="v2prac-score__total">/{total}</span></span>
              <Badge tone="accent" variant="soft">Grade {grade}</Badge>
            </div>
            <ul className="v2prac-mistakes">
              {mistakes.map((m) => (
                <li key={m.q} className="v2prac-mistake">
                  <span className="v2prac-mistake__q t-ui">{m.q}</span>
                  <span className="v2prac-mistake__body">
                    <span className="v2prac-mistake__topic t-caption">{m.topic}</span>
                    <span className="v2prac-mistake__note t-body">{m.note}</span>
                  </span>
                  <span className="v2prac-mistake__lost t-caption">−{m.lost}</span>
                </li>
              ))}
            </ul>
            <Button variant="primary" size="default" icon="play" label="Retry paper"
              className="v2prac-score__retry" onClick={onRetry} />
          </div>
        </section>
      </div>

      <p className="v2prac__note t-caption">
        <Icon name="doc" className="v2prac__note-icon" />
        Attempt mode opens this paper in the existing PDF reader; this panel only shows the completed attempt.
      </p>
    </div>
  );
}

export interface PracticeProps {
  /** Fired when a paper is started; the harness opens the existing reader (timed or not). */
  onStart?: (paper: PaperRow, opts: { timed: boolean }) => void;
}

export default function Practice({ onStart }: PracticeProps = {}) {
  const [mode, setMode] = useState<'attempt' | 'review'>('attempt');
  const [selectedId, setSelectedId] = useState<number>(PAPERS[0].paper.id);
  const current = PAPERS.find((i) => i.paper.id === selectedId) ?? PAPERS[0];

  return (
    <div className="v2prac">
      <header className="v2prac__header">
        <div className="v2prac__heading">
          <h1 className="v2prac__title t-page-title">Practice</h1>
          <p className="v2prac__caption t-caption">Sit a paper under timed conditions, then review it against the mark scheme.</p>
        </div>
        <SegmentedControl
          label="Practice mode"
          value={mode}
          onChange={(v) => setMode(v as 'attempt' | 'review')}
          items={[
            { value: 'attempt', label: 'Attempt', icon: 'play' },
            { value: 'review', label: 'Review', icon: 'check' },
          ]}
        />
      </header>

      {mode === 'attempt' ? (
        <PreStart
          items={PAPERS}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onStart={(timed) => onStart?.(current.paper, { timed })}
          onReview={() => setMode('review')}
        />
      ) : (
        <Review paper={REVIEW_PAPER} score={REVIEW_SCORE} onRetry={() => setMode('attempt')} />
      )}
    </div>
  );
}
