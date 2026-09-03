/**
 * The topbar's search field — which is a **button**, not an input: it opens the command palette.
 * Nothing is typed here, so it is a real `<button>` whose accessible name says what it does while
 * still opening with the visible placeholder text (WCAG 2.5.3, Label in Name).
 *
 * Geometry is `design/specs/screen-library-settings.md` §4, the `search` row at x 86 (`45:41`):
 * 420 x 34 FIXED/FIXED, radius `--r-pill`, `--glass-strong` with a 1px `--hair` hairline, padding
 * l12 r10, gap 9, clip. Children are a 16px `Icon=search`, the placeholder as a **FILL** text node
 * in `Body/Default` on `--ink-3`, and a `Kbd` cap reading `Ctrl K`.
 *
 * The cap is pushed right by that FILL, not by a margin — which is why nothing here reproduces
 * app.css's `.search .kbd { margin-left: auto }`.
 *
 * Two differences from `.search` in app.css, both of which a call site can feel:
 *
 *  - **Width.** The old rule is fluid (`flex: 1`, min 230, max 420); the spec is FIXED 420, with a
 *    1px-tall FILL strut absorbing the topbar's slack instead. `width` here is a flex *basis*, so
 *    the field still gives way in a tight row rather than pushing the tone pill off the end.
 *  - **Glyph paint.** The spec does not override the icon's fill, and the Icon set's documented
 *    paint is `--ink-2` (`design/specs/icons.md`), a step darker than the placeholder. The old rule
 *    set `color: --ink-3` on the whole button and let the glyph inherit it.
 */
import Icon from '../components/Icon';
import Kbd from './Kbd';

/** The spec's fixed width. The topbar's `16+58+12+420+12+374+12+116+12+34+16 = 1082` depends on it. */
export const SEARCH_FIELD_WIDTH = 420;

export interface SearchFieldProps {
  /** Visible prompt, and the head of the accessible name. */
  placeholder?: string;
  /** The key cap's text. Display only — it does not bind the shortcut. */
  hint?: string;
  onClick: () => void;
  /** Flex basis, not a floor: 420 per the spec, or e.g. `'100%'` to fill a narrower bar. */
  width?: number | string;
  className?: string;
}

export default function SearchField({
  placeholder = 'Search papers, subjects, sessions',
  hint = 'Ctrl K',
  onClick,
  width = SEARCH_FIELD_WIDTH,
  className,
}: SearchFieldProps) {
  return (
    <button
      type="button"
      className={className ? `searchfield ${className}` : 'searchfield'}
      style={{ width }}
      onClick={onClick}
      aria-label={`${placeholder}. Opens the command palette, ${hint}`}
    >
      <Icon name="search" className="sf-icon" />
      <span className="sf-text t-body-default">{placeholder}</span>
      <Kbd>{hint}</Kbd>
    </button>
  );
}
