import Icon from './Icon';
import WindowLights from './WindowLights';
import Wordmark from '@ui/brand/Wordmark';
import NavItem from '@ui/NavItem';
import SubjectRow from '@ui/SubjectRow';
import SubjectIcon from '@ui/icons/SubjectIcon';
import type { BellMood } from '@ui/brand/MrBell';
import Mascot from './Mascot';
import GitHubMark from '@ui/icons/GitHubMark';
import type { Subject } from '@/lib/types';
import azureAppIcon from '@/assets/azure-app-icon.png';

export type View =
  | 'library'
  | 'bookmarks'
  | 'recent'
  | 'dashboard'
  | 'reader'
  | 'notebooks'
  | 'notebook'
  | 'settings'
  | 'onboarding';

/**
 * The sidebar. Geometry: `design/specs/screen-library-settings.md` §3 — 238 wide, 12px gutters, so
 * every row is 214; window lights at (12,14), the logo at (12,34), then the two nav groups, the
 * subject list, the mascot slot and the dev footer.
 *
 * SIX nav rows under STUDY. Figma's Notebooks screen (`620:507`) draws five — it inserts Notebooks as
 * the second row and has no Settings row at all, which is a gap in the file rather than a decision.
 * The app carries Settings, so it lands on six. `screen-notebooks.md` TRAP 16 asks explicitly whether
 * that cuts Mr. Bell: it does not. The column is flexbox with the `mascot` slot as the flex spacer and
 * he is bottom-pinned inside it, so a sixth 38px row shrinks the slot rather than moving him, and the
 * rig's top ~45px is empty above his spectacles. Verified by screenshot at the 680px minimum window
 * height, which is the case that would break first.
 */
interface Props {
  view: View;
  onView: (v: View) => void;
  /**
   * The subjects the student sits, not the whole catalogue — `App` narrows this to their
   * chosen syllabus codes. The catalogue holds every subject Cambridge publishes, so an
   * unfiltered rail would be a wall of thirty rows nobody asked for.
   */
  subjects: Subject[];
  activeSubject: number | null;
  onSubject: (id: number | null) => void;
  paperCount: number | null;
  bookmarkCount: number;
  recentCount: number;
  /** How many notebooks exist. `null` while the shelf is still being read, so the row shows no count
   *  rather than a momentary zero. */
  notebookCount: number | null;
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
  notebookCount,
  update,
  mascot = 'idle',
  onPokeMascot,
  version = '0.1.0',
  build = 'dev',
}: Props) {
  return (
    <aside className="sidebar">
      <WindowLights />

      {/* Azure is Bell's shipped identity now: the supplied app mark paired with the existing word
          geometry keeps the desktop icon and the in-product brand unmistakably the same. */}
      <div className="brand">
        <div className="logo-word" role="img" aria-label="Bell">
          <img className="brand-azure-mark" src={azureAppIcon} alt="" />
          <Wordmark size={27} specs={false} className="brand-wordmark" />
        </div>
      </div>

      <div className="nav-label t-label-section">Study</div>

      <NavItem
        icon={<Icon name="lib" />}
        label="Library"
        count={paperCount?.toLocaleString()}
        active={view === 'library'}
        onClick={() => onView('library')}
      />
      {/* §4a inserts Notebooks as the SECOND row, above Dashboard — the shelf is a place you keep
          things, so it belongs beside the library rather than among the read-outs. `book` already
          existed in the sprite; the row is `State=Active` on both notebook routes, because the open
          spread has no sidebar of its own and returning from it must land somewhere lit. */}
      <NavItem
        icon={<Icon name="book" />}
        label="Notebooks"
        count={notebookCount ?? undefined}
        showCount={notebookCount != null}
        active={view === 'notebooks' || view === 'notebook'}
        onClick={() => onView('notebooks')}
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
        {subjects.length === 0 && (
          <div className="subj-empty t-body-meta">No subjects yet</div>
        )}
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
        <Mascot
          size={160}
          petSize="clamp(300px, calc(100vh - 410px), 460px)"
          mood={mascot}
        />
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
