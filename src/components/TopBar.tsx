import SearchField from '@ui/SearchField';
import type { Tone } from '@ui/TonePill';
import IconButton from '@ui/IconButton';

/**
 * The top bar. Geometry: `design/specs/screen-library-settings.md` §4 — 1082 x 56, padding 0/16,
 * gap 12, and the sum that the layout has to hit.
 *
 * `data-tauri-drag-region` lives here and only here: `decorations: false` means this bar *is* the
 * title bar, so it has to be the drag handle. Anything interactive inside it must stop the drag
 * from swallowing its clicks, which is why the controls are real buttons.
 */
interface Props {
  /** A string for the plain screens; a node for the Reader's three-style identity row. */
  title: React.ReactNode;
  tone?: Tone;
  onTone?: () => void;
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
  /** A downloaded community resource has no catalogue action in its reader. */
  showSync?: boolean;
}

export default function TopBar({
  title,
  busy,
  onReindex,
  onSearch,
  left,
  center,
  right,
  showSearch = true,
  showSync = true,
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

        {showSync && (
          <IconButton
            icon="sync"
            label="Sync the catalogue"
            spin={busy}
            disabled={busy}
            onClick={onReindex}
          />
        )}
      </div>

      {/* Last in DOM order and absolutely positioned, so it centres on the bar rather than on the
          gap the row leaves. The wrapper takes no pointer events — the bar under it is the window's
          drag handle and a full-width overlay would kill dragging — and the content takes them back. */}
      {center && <div className="tb-center">{center}</div>}
    </div>
  );
}
