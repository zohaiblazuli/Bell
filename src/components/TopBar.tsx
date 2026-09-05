import SearchField from '@ui/SearchField';
import TonePill, { type Tone } from '@ui/TonePill';
import IconButton from '@ui/IconButton';

/**
 * The top bar. Geometry: `design/specs/screen-library-settings.md` §4 — 1082 x 56, padding 0/16,
 * gap 12, and the sum that the layout has to hit:
 *
 *     16 + title + 12 + 420 search + 12 + [spacer grows] + 12 + tone + 12 + 34 + 16 = 1082
 *
 * The spacer is a real element rather than `margin-left: auto` because Figma models it as a 1px
 * frame with `layoutGrow 1`, and keeping it lets the bar's parts stay in DOM order.
 *
 * `data-tauri-drag-region` lives here and only here: `decorations: false` means this bar *is* the
 * title bar, so it has to be the drag handle. Anything interactive inside it must stop the drag
 * from swallowing its clicks, which is why the controls are real buttons.
 *
 * One bar, not two. `WorkspaceView` used to inline a second implementation of this; the Reader now
 * composes this one instead — and three of its props exist for that: `left` for the back button the
 * Reader puts *before* the title, `title` taking a node so the Reader can draw §4's three-style
 * identity row, and `showSearch` because the Reader's composition has no search field. Without
 * them the Reader's controls and the 420px search competed for the same 1,098px and overlapped.
 */
interface Props {
  /** A string for the plain screens; a node for the Reader's three-style identity row. */
  title: React.ReactNode;
  tone: Tone;
  onTone: () => void;
  busy: boolean;
  onReindex: () => void;
  onSearch: () => void;
  /** Before the title. The Reader's back button, which §4 places at x 77. */
  left?: React.ReactNode;
  /**
   * Centred on the WINDOW, not on whatever the row's flex happens to leave — the Reader's focus
   * timer, which Zohaib asked to sit at the top middle. It is absolutely positioned, so it neither
   * takes part in the row's sizing nor pushes the search field off its measured 420.
   */
  center?: React.ReactNode;
  /** Extra controls before the tone pill — the Reader's timer, zoom and tools. */
  right?: React.ReactNode;
  /**
   * The Reader's composition has no search field, and squeezing one in beside its own controls is
   * what made the bar collide. ⌘K still opens the palette from there, so nothing is lost.
   */
  showSearch?: boolean;
}

export default function TopBar({
  title,
  tone,
  onTone,
  busy,
  onReindex,
  onSearch,
  left,
  center,
  right,
  showSearch = true,
}: Props) {
  return (
    <div className="topbar" data-tauri-drag-region>
      <div className="tb">
        {left}

        <div className="title t-title-toolbar">{title}</div>

        {showSearch && (
          <SearchField
            placeholder="Search papers, subjects, sessions"
            hint="Ctrl K"
            onClick={onSearch}
          />
        )}

        <div className="spacer" />
        {right}

        <TonePill tone={tone} onToggle={onTone} />

        <IconButton
          icon="sync"
          label="Sync the catalogue"
          spin={busy}
          disabled={busy}
          onClick={onReindex}
        />
      </div>

      {/* Last in DOM order and absolutely positioned, so it centres on the bar rather than on the
          gap the row leaves. The wrapper takes no pointer events — the bar under it is the window's
          drag handle and a full-width overlay would kill dragging — and the content takes them back. */}
      {center && <div className="tb-center">{center}</div>}
    </div>
  );
}
