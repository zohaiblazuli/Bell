import OwlMark from '@ui/shapekit/OwlMark';
import BellWordmark from '@ui/shapekit/BellWordmark';
import NavGlyph, { type NavGlyphName } from '@ui/shapekit/NavGlyph';
import SubjectIcon from '@ui/icons/SubjectIcon';
import { useEffect, useRef, useState } from 'react';
import type { HushPose } from '@ui/shapekit/Hush';
import Mascot from './Mascot';
import type { SplashPhase } from './Splash';
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
  /** The launch phase. During the handoff Hush rises and types his first line (Splash.css); pass
   *  `done` when motion is off and the line is simply there. */
  startup?: SplashPhase;
  update?: React.ReactNode;
  mascot?: HushPose;
  onPokeMascot?: () => void;
  version?: string;
  build?: string;
}

/** When the typing starts, counted from the handoff (Startup v2: 7.25s, the handoff opening at 4.9s),
 *  and how long the whole line takes — a fixed length, so a long line types faster rather than later. */
const TYPE_AT_MS = 2350;
const TYPE_MS = 700;

/**
 * How many characters of Hush's first line are on show. Null is all of them: after the launch, with
 * motion off, and from then on for every later line, which just appears.
 */
function useTyped(line: string, startup: SplashPhase): number | null {
  const [shown, setShown] = useState<number | null>(startup === 'done' ? null : 0);
  useEffect(() => {
    if (startup === 'done' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(null);
      return;
    }
    if (startup !== 'handoff') return;
    let tick: number | undefined;
    const start = window.setTimeout(() => {
      const t0 = performance.now();
      tick = window.setInterval(() => {
        const n = Math.ceil(((performance.now() - t0) / TYPE_MS) * line.length);
        setShown(n >= line.length ? null : n);
        if (n >= line.length) window.clearInterval(tick);
      }, 30);
    }, TYPE_AT_MS);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(tick);
    };
    // The line is read once, when the typing starts; a line that changes mid-type is caught by `done`.
  }, [startup]);
  return shown;
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
  startup = 'done',
  update,
  mascot = 'idle',
  onPokeMascot,
  version = '0.1.0',
  build = 'dev',
}: Props) {
  const study: Row[] = [
    { view: 'dashboard', glyph: 'home', label: 'Home', active: view === 'dashboard' },
    { view: 'library', glyph: 'papers', label: 'Past Papers', count: paperCount?.toLocaleString(), active: view === 'library' || view === 'reader' },
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

  const typed = useTyped(line, startup);
  // Only a line that replaces the first one pops; the first arrives through the launch's own typing.
  const firstLine = useRef(line);
  const changed = useRef(false);
  if (line !== firstLine.current) changed.current = true;
  const popped = changed.current;
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
          {/* The balloon bobs on its own wrapper, so the bubble inside is free to pop. The first line is
              typed in during the launch (`useTyped`); every later line pops in behind three typing
              dots — keyed on the line so the pop replays. */}
          <div className="sk-hush__say">
            <div
              className={popped ? 'sk-hush__bubble sk-hush__bubble--pop' : 'sk-hush__bubble'}
              key={popped ? line : undefined}
            >
              {typed == null ? (
                popped ? (
                  <>
                    <span className="sk-hush__think" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                    <span className="sk-hush__line">{line}</span>
                  </>
                ) : (
                  line
                )
              ) : (
                <>
                  {line.slice(0, typed)}
                  {/* The rest is laid out but unseen, so the bubble is its final size from the first
                      frame and the typing never re-wraps a line. */}
                  <span className="sk-hush__rest">{line.slice(typed)}</span>
                  {typed === 0 && (
                    <span className="sk-hush__dots" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
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
