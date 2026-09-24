import OwlMark from '@ui/shapekit/OwlMark';
import BellWordmark from '@ui/shapekit/BellWordmark';
import NavGlyph, { type NavGlyphName } from '@ui/shapekit/NavGlyph';
import SubjectIcon from '@ui/icons/SubjectIcon';
import type { HushPose } from '@ui/shapekit/Hush';
import Mascot from './Mascot';
import type { Subject } from '@/lib/types';
import './Sidebar.css';

export type View =
  | 'library'
  | 'community'
  | 'workspace'
  | 'community-reader'
  | 'bookmarks'
  | 'recent'
  | 'dashboard'
  | 'reader'
  | 'notebooks'
  | 'notebook'
  | 'settings'
  | 'onboarding';

interface Props {
  view: View;
  onView: (v: View) => void;
  subjects: Subject[];
  activeSubject: number | null;
  onSubject: (id: number | null) => void;
  paperCount: number | null;
  bookmarkCount: number;
  recentCount: number;
  notebookCount: number | null;
  /** Minutes focused today, from the focus log. */
  todayMinutes: number;
  /** The daily goal from Settings. */
  goalMinutes: number;
  /** A route-aware line for Hush's speech bubble. */
  line: string;
  update?: React.ReactNode;
  mascot?: HushPose;
  onPokeMascot?: () => void;
  version?: string;
  build?: string;
}

interface Row {
  view: View;
  glyph: NavGlyphName;
  label: string;
  count?: string | number;
  active: boolean;
  disabled?: boolean;
  title?: string;
}

/**
 * The Shape Kit sidebar (Bell App v2): owl-head symbol + Full stop wordmark, the STUDY rows with
 * one-ink glyphs, your subjects, the ONLINE row for Community, a TODAY goal block, and Hush with his
 * line of the day. The selected row is a solid ink block that draws in from the left and its glyph
 * hops once. Home is the Dashboard route and Past Papers the Library route — the names changed, the
 * routes did not, so tabs and saved state carry over.
 */
export default function Sidebar({
  view,
  onView,
  subjects,
  activeSubject,
  onSubject,
  paperCount,
  bookmarkCount,
  recentCount,
  notebookCount,
  todayMinutes,
  goalMinutes,
  line,
  update,
  mascot = 'idle',
  onPokeMascot,
  version = '0.1.0',
  build = 'dev',
}: Props) {
  const study: Row[] = [
    { view: 'dashboard', glyph: 'home', label: 'Home', active: view === 'dashboard' },
    { view: 'library', glyph: 'papers', label: 'Past Papers', count: paperCount?.toLocaleString(), active: view === 'library' },
    { view: 'notebooks', glyph: 'notebooks', label: 'Notebooks', count: notebookCount ?? undefined, active: view === 'notebooks' || view === 'notebook' },
    { view: 'workspace', glyph: 'workspace', label: 'Workspace', active: view === 'workspace' },
    {
      view: 'bookmarks',
      glyph: 'bookmarks',
      label: 'Bookmarks',
      count: bookmarkCount || undefined,
      active: view === 'bookmarks',
      disabled: bookmarkCount === 0,
      title: bookmarkCount === 0 ? 'Bookmark a paper and it lands here' : undefined,
    },
    {
      view: 'recent',
      glyph: 'recent',
      label: 'Recent',
      count: recentCount || undefined,
      active: view === 'recent',
      disabled: recentCount === 0,
      title: recentCount === 0 ? 'Papers you open show up here' : undefined,
    },
    { view: 'settings', glyph: 'settings', label: 'Settings', active: view === 'settings' },
  ];

  const minutes = Math.round(todayMinutes);
  const goal = Math.max(1, goalMinutes);
  const filled = Math.min(9, Math.floor((minutes / goal) * 9));
  const communityActive = view === 'community' || view === 'community-reader';

  return (
    <aside className="sk-side">
      <div className="sk-side__brand" data-tauri-drag-region>
        <div className="sk-side__lockup" role="img" aria-label="Bell">
          <OwlMark size={34} />
          <BellWordmark size={30} />
        </div>
      </div>

      <div className="sk-side__label">STUDY</div>
      <nav className="sk-side__group" aria-label="Study">
        {study.map((r) => (
          <button
            key={r.view}
            type="button"
            className="sk-nav"
            aria-current={r.active ? 'page' : undefined}
            disabled={r.disabled}
            title={r.title}
            onClick={() => onView(r.view)}
          >
            <span className="sk-nav__icon">
              <NavGlyph name={r.glyph} />
            </span>
            <span className="sk-nav__label">{r.label}</span>
            <span className="sk-nav__count">{r.count}</span>
          </button>
        ))}
      </nav>

      <div className="sk-side__label sk-side__label--gap">SUBJECTS</div>
      <div className="sk-side__group sk-side__subjects">
        {subjects.length === 0 && <div className="sk-side__empty">No subjects yet</div>}
        {subjects.map((s) => {
          const on = activeSubject === s.id && view === 'library';
          return (
            <button
              key={s.id}
              type="button"
              className="sk-subj"
              aria-pressed={on}
              onClick={() => {
                onSubject(activeSubject === s.id ? null : s.id);
                onView('library');
              }}
            >
              <SubjectIcon code={s.code} size={21} />
              <span className="sk-subj__name">{s.name}</span>
              <span className="sk-subj__code">{s.code}</span>
            </button>
          );
        })}
      </div>

      <div className="sk-side__label sk-side__label--gap">ONLINE</div>
      <div className="sk-side__group">
        <button
          type="button"
          className="sk-nav sk-nav--online"
          aria-current={communityActive ? 'page' : undefined}
          onClick={() => onView('community')}
        >
          <span className="sk-nav__icon">
            <NavGlyph name="community" />
          </span>
          <span className="sk-nav__label">Community</span>
          <span className="sk-nav__dot" title="Online" />
        </button>
      </div>

      <div className="sk-side__label sk-side__label--gap">TODAY</div>
      <div className="sk-today">
        <div className="sk-today__figure">
          <b>{minutes}m</b>
          <span>of {goal}m goal</span>
        </div>
        <div className="sk-today__segs" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} data-on={i < filled ? 'true' : undefined} />
          ))}
        </div>
        <span className="sk-today__note">
          {minutes >= goal
            ? 'Goal met. Anything else is a bonus.'
            : minutes === 0
            ? 'One timed paper would start the day.'
            : `${goal - minutes}m more would close the day.`}
        </span>
      </div>

      {update}

      <div className="sk-side__foot">
        {/* A press, not a button: poking him is a flourish, not a control, and a focus stop here would
            put a decorative owl in every keyboard user's tab order. */}
        <div className="sk-hush" onPointerDown={onPokeMascot}>
          <Mascot size={86} mood={mascot} />
          <div className="sk-hush__bubble">{line}</div>
        </div>
        <div className="sk-side__version">
          v{version} · build {build}
          <br />
          built by zohaiblazuli
        </div>
      </div>
    </aside>
  );
}
