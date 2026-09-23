/**
 * Analytics (Design System v2) — §15. Built to answer study decisions ("what do I revise
 * next?", "is my accuracy improving?"), not to show vanity charts. Renders the main-area
 * content only (no shell); self-contained with realistic CAIE sample data.
 *
 * Chart discipline (§ chart rules): every chart carries a title, axis/legend labels and a
 * text summary; figures use tabular mono numerals; surfaces are flat (no gradients/shadows).
 * Colour is neutral grays + ONE accent for the primary series. --warning/--danger appear
 * ONLY to flag a value past a threshold and are ALWAYS paired with the number in text, so
 * nothing is read by colour alone. No chart library — the trend is hand-rolled inline SVG.
 */
import Badge from '@ui/v2/Badge';
import './Analytics.css';

type Flag = 'warning' | 'danger' | null;

interface TopicStat {
  subjectCode: string;
  subjectName: string;
  topic: string;
  /** Mean accuracy over attempted questions, 0-100. */
  accuracy: number;
  /** Mean time spent per mark, in minutes. */
  minPerMark: number;
}

/** Real CAIE subjects/topics: 9709 Mathematics + 9702 Physics. */
const TOPICS: TopicStat[] = [
  { subjectCode: '9709', subjectName: 'Mathematics', topic: 'Pure 1', accuracy: 78, minPerMark: 1.1 },
  { subjectCode: '9709', subjectName: 'Mathematics', topic: 'Pure 3', accuracy: 71, minPerMark: 1.5 },
  { subjectCode: '9709', subjectName: 'Mathematics', topic: 'Mechanics', accuracy: 54, minPerMark: 1.9 },
  { subjectCode: '9709', subjectName: 'Mathematics', topic: 'Statistics', accuracy: 67, minPerMark: 1.3 },
  { subjectCode: '9702', subjectName: 'Physics', topic: 'Mechanics', accuracy: 63, minPerMark: 1.6 },
  { subjectCode: '9702', subjectName: 'Physics', topic: 'Waves', accuracy: 61, minPerMark: 1.7 },
  { subjectCode: '9702', subjectName: 'Physics', topic: 'Electricity', accuracy: 48, minPerMark: 2.1 },
];

/** Weekly mean accuracy across the 90-day window (13 points, oldest -> newest). */
const TREND = [58, 61, 57, 63, 66, 62, 68, 71, 67, 72, 74, 73, 76];

/** Time-per-mark above this reads as "slow" and is flagged. */
const PACE_TARGET = 1.8;

const accuracyFlag = (pct: number): Flag => (pct < 55 ? 'danger' : pct < 65 ? 'warning' : null);

const STATS = [
  { value: '47', label: 'Papers attempted' },
  { value: '34', label: 'Completed' },
  { value: '71%', label: 'Mean score' },
  { value: '38h', label: 'Time studied' },
];

/** One horizontal bar row. The track is decorative (aria-hidden); the value is always in text. */
function BarRow({ label, sub, pct, value, flag }: { label: string; sub?: string; pct: number; value: string; flag?: Flag }) {
  return (
    <li className="v2-analytics__bar-row">
      <span className="v2-analytics__bar-label">
        <span className="v2-analytics__bar-topic t-ui">{label}</span>
        {sub ? <span className="v2-analytics__bar-code">{sub}</span> : null}
      </span>
      <span className="v2-analytics__bar-track" aria-hidden="true">
        <span
          className={['v2-analytics__bar-fill', flag ? `is-${flag}` : null].filter(Boolean).join(' ')}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="v2-analytics__bar-value" data-flag={flag ?? undefined}>{value}</span>
    </li>
  );
}

/** Score trend — hand-rolled inline SVG line + area over time, labelled axes, text summary. */
function ScoreTrend() {
  const W = 640, H = 240;
  const padL = 40, padR = 16, padT = 16, padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const yMin = 40, yMax = 90;
  const yTicks = [40, 50, 60, 70, 80, 90];
  const n = TREND.length;
  const x = (i: number) => padL + (i / (n - 1)) * plotW;
  const y = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin)) * plotH;
  const baseY = padT + plotH;

  const line = TREND.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area =
    `M${x(0).toFixed(1)},${baseY.toFixed(1)} ` +
    TREND.map((v, i) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ') +
    ` L${x(n - 1).toFixed(1)},${baseY.toFixed(1)} Z`;

  // Month ticks placed at each month boundary's fraction of the 90-day window.
  const monthTicks = [
    { label: 'Jul', f: 0.07 },
    { label: 'Aug', f: 0.41 },
    { label: 'Sep', f: 0.76 },
  ];

  const first = TREND[0], last = TREND[n - 1];
  const delta = last - first;
  const summary = `Weekly mean accuracy rose from ${first}% in late June to ${last}% in September — a ${delta}-point gain over ${n} weeks and 47 papers.`;

  return (
    <section className="v2-analytics__panel v2-analytics__panel--wide" aria-labelledby="v2an-trend-title">
      <header className="v2-analytics__panel-head">
        <div className="v2-analytics__panel-heading">
          <h2 id="v2an-trend-title" className="v2-analytics__panel-title t-section-title">Score trend</h2>
          <p className="v2-analytics__panel-sub t-caption">Weekly mean accuracy · Jun–Sep 2026 · n = 47 papers</p>
        </div>
        <Badge tone="success" variant="soft">+{delta} pts</Badge>
      </header>

      <svg
        className="v2-analytics__chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby="v2an-trend-title v2an-trend-desc"
      >
        <desc id="v2an-trend-desc">{summary}</desc>
        {yTicks.map((t) => (
          <g key={t}>
            <line className="v2-analytics__gridline" x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} vectorEffect="non-scaling-stroke" />
            <text className="v2-analytics__axis" x={padL - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">{t}%</text>
          </g>
        ))}
        <path className="v2-analytics__area" d={area} />
        <polyline className="v2-analytics__line" points={line} vectorEffect="non-scaling-stroke" />
        {TREND.map((v, i) => (
          <circle key={i} className="v2-analytics__dot" cx={x(i)} cy={y(v)} r={2.6} />
        ))}
        {monthTicks.map((m) => (
          <text key={m.label} className="v2-analytics__axis" x={padL + m.f * plotW} y={H - 10} textAnchor="middle">{m.label}</text>
        ))}
      </svg>

      <p className="v2-analytics__summary t-caption">{summary}</p>
    </section>
  );
}

/** Weak topics — ranked worst-first; below-threshold topics flagged, always with the % text. */
function WeakTopics() {
  const ranked = [...TOPICS].sort((a, b) => a.accuracy - b.accuracy).slice(0, 5);
  return (
    <section className="v2-analytics__panel" aria-labelledby="v2an-weak-title">
      <header className="v2-analytics__panel-head">
        <div className="v2-analytics__panel-heading">
          <h2 id="v2an-weak-title" className="v2-analytics__panel-title t-section-title">Weak topics</h2>
          <p className="v2-analytics__panel-sub t-caption">Lowest accuracy first · revise these next</p>
        </div>
      </header>
      <ul className="v2-analytics__bars">
        {ranked.map((t) => (
          <BarRow
            key={`${t.subjectCode}-${t.topic}`}
            label={t.topic}
            sub={`${t.subjectCode} ${t.subjectName}`}
            pct={t.accuracy}
            value={`${t.accuracy}%`}
            flag={accuracyFlag(t.accuracy)}
          />
        ))}
      </ul>
    </section>
  );
}

/** Completion & volume — big tabular-mono numbers with captions. */
function VolumeTiles() {
  return (
    <section className="v2-analytics__panel" aria-labelledby="v2an-vol-title">
      <header className="v2-analytics__panel-head">
        <div className="v2-analytics__panel-heading">
          <h2 id="v2an-vol-title" className="v2-analytics__panel-title t-section-title">Completion & volume</h2>
          <p className="v2-analytics__panel-sub t-caption">Across the last 90 days</p>
        </div>
      </header>
      <div className="v2-analytics__tiles">
        {STATS.map((s) => (
          <div key={s.label} className="v2-analytics__tile">
            <span className="v2-analytics__tile-value t-page-title">{s.value}</span>
            <span className="v2-analytics__tile-label t-caption">{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Accuracy by topic — the full set as compact bars, weakest flagged (with % text). */
function AccuracyByTopic() {
  const rows = [...TOPICS].sort((a, b) => b.accuracy - a.accuracy);
  return (
    <section className="v2-analytics__panel" aria-labelledby="v2an-acc-title">
      <header className="v2-analytics__panel-head">
        <div className="v2-analytics__panel-heading">
          <h2 id="v2an-acc-title" className="v2-analytics__panel-title t-section-title">Accuracy by topic</h2>
          <p className="v2-analytics__panel-sub t-caption">Share of marks earned · 7 topics</p>
        </div>
      </header>
      <ul className="v2-analytics__bars">
        {rows.map((t) => (
          <BarRow
            key={`${t.subjectCode}-${t.topic}`}
            label={t.topic}
            sub={`${t.subjectCode} ${t.subjectName}`}
            pct={t.accuracy}
            value={`${t.accuracy}%`}
            flag={accuracyFlag(t.accuracy)}
          />
        ))}
      </ul>
    </section>
  );
}
/** Pace — time per mark; bars scaled to the slowest topic, over-target rows flagged. */
function Pace() {
  const maxPace = Math.max(...TOPICS.map((t) => t.minPerMark));
  const rows = [...TOPICS].sort((a, b) => b.minPerMark - a.minPerMark);
  return (
    <section className="v2-analytics__panel" aria-labelledby="v2an-pace-title">
      <header className="v2-analytics__panel-head">
        <div className="v2-analytics__panel-heading">
          <h2 id="v2an-pace-title" className="v2-analytics__panel-title t-section-title">Pace (time per mark)</h2>
          <p className="v2-analytics__panel-sub t-caption">Target ≤ {PACE_TARGET.toFixed(1)} min/mark</p>
        </div>
      </header>
      <ul className="v2-analytics__bars">
        {rows.map((t) => (
          <BarRow
            key={`${t.subjectCode}-${t.topic}`}
            label={t.topic}
            sub={`${t.subjectCode} ${t.subjectName}`}
            pct={(t.minPerMark / maxPace) * 100}
            value={`${t.minPerMark.toFixed(1)} min`}
            flag={t.minPerMark > PACE_TARGET ? 'warning' : null}
          />
        ))}
      </ul>
    </section>
  );
}

export default function Analytics() {
  return (
    <div className="v2-analytics">
      <header className="v2-analytics__header">
        <h1 className="v2-analytics__title t-page-title">Analytics</h1>
        <p className="v2-analytics__caption t-caption">Last 90 days · 47 papers attempted · 9709 Mathematics, 9702 Physics</p>
      </header>
      <div className="v2-analytics__grid">
        <ScoreTrend />
        <WeakTopics />
        <VolumeTiles />
        <AccuracyByTopic />
        <Pace />
      </div>
    </div>
  );
}
