/**
 * Home (Design System v2) — a calm, dense landing that renders the main-area content only
 * (no shell). A greeting, a short "Up next" review queue, a 30-day activity strip and three
 * quick stats. Self-contained sample data on real CAIE codes; session/component labels come
 * from lib/difficulty so a paper reads exactly as it does in the Library. One accent, opaque
 * cards, tokens only.
 */
import Button from '@ui/v2/Button';
import Icon, { type IconName } from '@/components/Icon';
import { sessionLabel, componentLabel } from '@/lib/difficulty';
import './Home.css';

interface QueueItem {
  id: string;
  subjectCode: string;
  subjectName: string;
  scode: string;
  component: string;
  status: 'continue' | 'start';
  icon: IconName;
  note: string;
}

const QUEUE: QueueItem[] = [
  { id: 'q1', subjectCode: '9709', subjectName: 'Mathematics', scode: 's24', component: '32', status: 'continue', icon: 'notebook', note: 'Resumed 2 days ago · 8 of 11 questions' },
  { id: 'q2', subjectCode: '9702', subjectName: 'Physics', scode: 'w23', component: '42', status: 'start', icon: 'book', note: 'Due for review today' },
  { id: 'q3', subjectCode: '9709', subjectName: 'Mathematics', scode: 'm24', component: '52', status: 'start', icon: 'notebook', note: 'Mechanics · flagged as weak' },
  { id: 'q4', subjectCode: '9702', subjectName: 'Physics', scode: 's23', component: '22', status: 'continue', icon: 'book', note: 'Resumed 5 days ago · 4 of 9 questions' },
];

/** Papers practised per day over the last 30 days (oldest -> newest), bucketed 0-4. */
const ACTIVITY = [0, 1, 2, 1, 0, 3, 4, 2, 1, 0, 0, 2, 3, 1, 4, 2, 1, 0, 1, 3, 2, 4, 3, 1, 0, 2, 3, 4, 2, 1];

const STATS: { value: string; label: string; icon: IconName }[] = [
  { value: '12', label: 'Day streak', icon: 'clock' },
  { value: '23', label: 'Papers this month', icon: 'doc' },
  { value: '71%', label: 'Mean score', icon: 'dash' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TODAY = new Date(2026, 8, 23);

/** Short label for the activity cell `i` steps from the oldest day in the window. */
function dayLabel(i: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - (ACTIVITY.length - 1 - i));
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
export default function Home() {
  const totalPapers = ACTIVITY.reduce((a, b) => a + b, 0);
  const activeDays = ACTIVITY.filter((n) => n > 0).length;
  const dueCount = QUEUE.length;

  return (
    <div className="v2-home">
      <header className="v2-home__header">
        <h1 className="v2-home__title t-page-title">Good evening</h1>
        <p className="v2-home__caption t-caption">Wednesday, 23 September · 12-day streak</p>
      </header>

      <section className="v2-home__card" aria-labelledby="v2home-next-title">
        <header className="v2-home__card-head">
          <h2 id="v2home-next-title" className="v2-home__card-title t-section-title">Up next</h2>
          <span className="v2-home__card-sub t-caption">{dueCount} papers due for review</span>
        </header>
        <ul className="v2-home__queue">
          {QUEUE.map((q) => (
            <li key={q.id} className="v2-home__row">
              <span className="v2-home__row-icon" aria-hidden="true"><Icon name={q.icon} /></span>
              <span className="v2-home__row-main">
                <span className="v2-home__row-title t-ui">
                  {q.subjectName}
                  <span className="v2-home__row-code">{q.subjectCode}/{q.component}</span>
                </span>
                <span className="v2-home__row-meta t-caption">{componentLabel(q.component)} · {sessionLabel(q.scode)}</span>
                <span className="v2-home__row-note t-micro">{q.note}</span>
              </span>
              <Button
                variant={q.status === 'continue' ? 'primary' : 'secondary'}
                size="dense"
                icon="play"
                label={q.status === 'continue' ? 'Continue' : 'Start'}
                aria-label={`${q.status === 'continue' ? 'Continue' : 'Start'} ${q.subjectName} ${q.subjectCode}/${q.component}`}
              />
            </li>
          ))}
        </ul>
      </section>
      <div className="v2-home__lower">
        <section className="v2-home__card" aria-labelledby="v2home-act-title">
          <header className="v2-home__card-head">
            <h2 id="v2home-act-title" className="v2-home__card-title t-section-title">Activity</h2>
            <span className="v2-home__card-sub t-caption">Last 30 days · {totalPapers} papers</span>
          </header>
          <div
            className="v2-home__activity"
            role="img"
            aria-label={`Practice activity, last 30 days: ${totalPapers} papers across ${activeDays} active days.`}
          >
            {ACTIVITY.map((lvl, i) => (
              <span
                key={i}
                className="v2-home__cell"
                data-level={lvl}
                title={`${dayLabel(i)}: ${lvl} paper${lvl === 1 ? '' : 's'}`}
              />
            ))}
          </div>
          <div className="v2-home__legend t-micro" aria-hidden="true">
            <span className="v2-home__legend-label">Less</span>
            {[0, 1, 2, 3, 4].map((l) => (
              <span key={l} className="v2-home__cell v2-home__cell--legend" data-level={l} />
            ))}
            <span className="v2-home__legend-label">More</span>
          </div>
        </section>

        <div className="v2-home__stats">
          {STATS.map((s) => (
            <div key={s.label} className="v2-home__stat">
              <span className="v2-home__stat-icon" aria-hidden="true"><Icon name={s.icon} /></span>
              <span className="v2-home__stat-body">
                <span className="v2-home__stat-value t-page-title">{s.value}</span>
                <span className="v2-home__stat-label t-caption">{s.label}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
