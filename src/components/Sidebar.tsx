import Icon from './Icon';
import WindowLights from './WindowLights';
import type { Subject } from '../lib/types';

export type View = 'setup' | 'library' | 'workspace' | 'dashboard';

const DOTS = ['var(--iris-1)', 'var(--iris-2)', 'var(--iris-3)', 'var(--iris-4)'];
const dotFor = (code: string) =>
  DOTS[[...code].reduce((a, c) => a + c.charCodeAt(0), 0) % DOTS.length];

interface Props {
  view: View;
  onView: (v: View) => void;
  subjects: Subject[];
  activeSubject: number | null;
  onSubject: (id: number | null) => void;
  paperCount: number | null;
}

export default function Sidebar({
  view,
  onView,
  subjects,
  activeSubject,
  onSubject,
  paperCount,
}: Props) {
  return (
    <aside className="sidebar">
      <WindowLights />

      <div className="brand">
        <svg className="logo" viewBox="0 0 24 24">
          <path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
          <path d="M14 3v4h4" />
        </svg>
        <div className="wordmark">
          <b>Foolscap</b>
          <small>working name</small>
        </div>
      </div>

      <div className="nav-label">Study</div>
      <button
        type="button"
        className={`nav${view === 'library' ? ' active' : ''}`}
        onClick={() => onView('library')}
      >
        <Icon name="lib" /> Library
        {paperCount != null && <span className="count mono">{paperCount.toLocaleString()}</span>}
      </button>
      <button
        type="button"
        className={`nav${view === 'dashboard' ? ' active' : ''}`}
        onClick={() => onView('dashboard')}
      >
        <Icon name="dash" /> Dashboard
      </button>
      <button type="button" className="nav" disabled>
        <Icon name="bm" /> Bookmarks
      </button>
      <button type="button" className="nav" disabled>
        <Icon name="clock" /> Recent
      </button>
      <button
        type="button"
        className={`nav${view === 'setup' ? ' active' : ''}`}
        onClick={() => onView('setup')}
      >
        <Icon name="sync" /> Index &amp; difficulty
      </button>

      <div className="nav-label">Subjects</div>
      <div className="subj">
        {subjects.length === 0 && (
          <div className="subj-row" style={{ color: 'var(--ink-3)' }}>
            No index yet
          </div>
        )}
        {subjects.map((s) => (
          <button
            type="button"
            key={s.id}
            className={`subj-row${activeSubject === s.id ? ' active' : ''}`}
            onClick={() => {
              onSubject(activeSubject === s.id ? null : s.id);
              onView('library');
            }}
            title={`${s.name} — ${s.papers.toLocaleString()} papers`}
          >
            <span className="dot" style={{ background: dotFor(s.code) }} />
            <span className="nm">{s.name}</span>
            <span className="code mono">{s.code}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-foot">
        <span className="av">ZS</span>
        <span>Offline · local library</span>
      </div>
    </aside>
  );
}
