import Icon from './Icon';
import WindowLights from './WindowLights';
import Lockup from '@ui/brand/Lockup';
import NavItem from '@ui/NavItem';
import SubjectRow from '@ui/SubjectRow';
import SubjectIcon from '@ui/icons/SubjectIcon';
import MrBell, { type BellMood } from '@ui/brand/MrBell';
import GitHubMark from '@ui/icons/GitHubMark';
import type { Subject } from '@/lib/types';

export type View =
  | 'library'
  | 'bookmarks'
  | 'recent'
  | 'dashboard'
  | 'reader'
  | 'settings'
  | 'onboarding';

/**
 * The sidebar. Geometry: `design/specs/screen-library-settings.md` §3 — 238 wide, 12px gutters, so
 * every row is 214; window lights at (12,14), the logo at (12,34), then the two nav groups, the
 * subject list, the mascot slot and the dev footer.
 *
 * Five nav rows under STUDY. Figma draws four and gives its own Settings screen no way in, which is
 * a gap in the file rather than a decision — the `Motion — Tone` frames already run five rows and
 * the mascot is bottom-pinned, so the slot absorbs the difference without moving him.
 *
 * The fifth row is labelled Settings and currently opens the index-and-difficulty screen, which is
 * what Settings' own Library card will absorb. When that screen lands, this points at it instead.
 */
interface Props {
  view: View;
  onView: (v: View) => void;
  subjects: Subject[];
  activeSubject: number | null;
  onSubject: (id: number | null) => void;
  paperCount: number | null;
  bookmarkCount: number;
  recentCount: number;
  /**
   * The update pill, when there is something to say. Rendered between the subject list and the
   * mascot, which is where `Screen — Library` puts it — and it stays a slot rather than a prop pair
   * because the whole update state machine lives in `App` and this bar should not learn it.
   */
  update?: React.ReactNode;
  /**
   * Which of the twelve timelines the mascot is playing. Rests on `idle`; `App` pulses
   * `tone-handoff` through it when the tone crosses, which is the beat that mood exists for.
   */
  mascot?: BellMood;
  /**
   * A press on the mascot. Deliberately a pointer-only easter egg on a decorative element rather than
   * a real control: it changes nothing, so there is no function for a keyboard user to be locked out
   * of, and announcing "Mr. Bell, button" to a screen reader would add noise for no capability. If it
   * ever does something, it becomes a labelled `<button>` and loses the `aria-hidden`.
   */
  onPokeMascot?: () => void;
  /** Build identity for the footer. Placeholders until a real build stamp exists. */
  version?: string;
  build?: string;
}

export default function Sidebar({
  view,
  onView,
  subjects,
  activeSubject,
  onSubject,
  paperCount,
  bookmarkCount,
  recentCount,
  update,
  mascot = 'idle',
  onPokeMascot,
  version = '0.1.0',
  build = 'dev',
}: Props) {
  return (
    <aside className="sidebar">
      <WindowLights />

      {/* Figma places a `Bell / Lockup — Horizontal` here at 0.35 scale. The lockup's box is
          296x89, so 31px tall lands it at 103x31 — the measured size of the instance in the file. */}
      <div className="brand">
        <Lockup orientation="horizontal" size={31} className="logo-word" />
      </div>

      <div className="nav-label t-label-section">Study</div>

      <NavItem
        icon={<Icon name="lib" />}
        label="Library"
        count={paperCount?.toLocaleString()}
        active={view === 'library'}
        onClick={() => onView('library')}
      />
      <NavItem
        icon={<Icon name="dash" />}
        label="Dashboard"
        showCount={false}
        active={view === 'dashboard'}
        onClick={() => onView('dashboard')}
      />
      <NavItem
        icon={<Icon name="bm" />}
        label="Bookmarks"
        count={bookmarkCount || undefined}
        active={view === 'bookmarks'}
        disabled={bookmarkCount === 0}
        title={bookmarkCount === 0 ? 'Bookmark a paper and it lands here' : undefined}
        onClick={() => onView('bookmarks')}
      />
      <NavItem
        icon={<Icon name="clock" />}
        label="Recent"
        count={recentCount || undefined}
        active={view === 'recent'}
        disabled={recentCount === 0}
        title={recentCount === 0 ? 'Papers you open show up here' : undefined}
        onClick={() => onView('recent')}
      />
      <NavItem
        icon={<Icon name="sliders" />}
        label="Settings"
        showCount={false}
        active={view === 'settings'}
        onClick={() => onView('settings')}
      />

      <div className="nav-label t-label-section">Subjects</div>

      <div className="subj">
        {subjects.length === 0 && <div className="subj-empty t-body-meta">No index yet</div>}
        {subjects.map((s) => (
          <SubjectRow
            key={s.id}
            code={s.code}
            name={s.name}
            icon={<SubjectIcon code={s.code} size={16} />}
            active={activeSubject === s.id}
            onClick={() => {
              onSubject(activeSubject === s.id ? null : s.id);
              onView('library');
            }}
          />
        ))}
      </div>

      {update}

      {/* The mascot slot. `layoutGrow: 1` in Figma, so it absorbs whatever the rows leave and keeps
          the dev footer pinned to the bottom. He is bottom-pinned inside it, which is why adding a
          fifth nav row above shrinks the slot without moving him. */}
      <div className="mascot" aria-hidden="true" onPointerDown={onPokeMascot}>
        <MrBell size={160} mood={mascot} />
      </div>

      {/* The dev footer, from `screen-library-settings.md` §3.4. The version line is a placeholder
          in Figma too; the heart is range-filled to --d5, the one mode-paired warm token. */}
      <div className="dev">
        <div className="dev-version t-mono-small">
          v{version} · build {build}
        </div>
        <div className="credit t-body-meta">
          Built with <span className="credit-heart">♥</span> by{' '}
          <GitHubMark size={11} className="credit-mark" />
          <span className="credit-name">zohaiblazuli</span>
        </div>
      </div>
    </aside>
  );
}
