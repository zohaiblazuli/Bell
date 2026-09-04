/**
 * Icon Button — `design/specs/components-controls.md` §5, set `20:12` (**3 variants**).
 *
 * 34 x 34 fixed on both axes with an 18px glyph centred, radius `--r-btn`, no effect in any state.
 * The axis is `State = Default | Hover | Active`; Hover is a CSS `:hover`, so `Active` is the only
 * one that becomes a prop, and the set's whole API past that is the glyph swap — never a variant
 * per glyph.
 *
 * **`Active` `601:29` is new**, added for the Notebooks tool dock (`screen-notebooks.md` §5b), the
 * nib tiles and a Reader retrofit: `--accent-soft` plus a 1px inside `--accent` stroke, which is the
 * design system's own "accent as a line on live elements" rule doing the work that a bare
 * `--accent-soft` fill could not at 34px. `active` used to paint the Hover grey made sticky, because
 * the set had no third variant to paint; it now paints the real one, so anything that was hand-
 * filling a button to fake this state can drop its override.
 *
 * `disabled` is still ours: §0's set-wide node opacity 0.55, which this set's own variants never
 * show. `aria-pressed` rides along with `active`, because a tool that stays lit is a toggle.
 *
 * What it supersedes in app.css: `.icobtn`, `.icobtn:hover`, `.icobtn svg`, `.icobtn.spin svg`.
 * That block also carried a transparent 1px border, which the spec does not have — see the CSS.
 */
import type { ComponentPropsWithoutRef } from 'react';
import Icon, { type IconName } from '../components/Icon';

/** The square, px. Fixed on both axes — a wider glyph does not widen the button. */
export const ICON_BUTTON_SIZE = 34;

export interface IconButtonProps extends ComponentPropsWithoutRef<'button'> {
  /** Required: the glyph is the entire content, and a 34px empty box is not a button. */
  icon: IconName;
  /**
   * Accessible name. Required, because the control carries no visible text. Also seeds the native
   * tooltip, which a call site can replace by passing its own longer `title`.
   */
  label: string;
  /** `State=Active` — the lit/live state, and it reports `aria-pressed`. */
  active?: boolean;
  /** Rotate the glyph while a job runs. The reindex button's busy state. */
  spin?: boolean;
}

export default function IconButton({
  icon,
  label,
  active,
  spin = false,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const classes = ['icobtn'];
  if (active) classes.push('icobtn--on');
  if (spin) classes.push('icobtn--spin');
  if (className) classes.push(className);

  return (
    <button
      type={type}
      /* Derived attributes sit before the spread so an explicit prop always wins and an undefined
         one never clobbers a call site's own value; `className` is merged instead of overridden. */
      aria-label={label}
      aria-pressed={active}
      title={label}
      {...rest}
      className={classes.join(' ')}
    >
      <Icon name={icon} />
    </button>
  );
}
