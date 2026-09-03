/**
 * Icon Button — `design/specs/components-controls.md` §5, set `20:12` (2 variants).
 *
 * 34 x 34 fixed on both axes with an 18px glyph centred, radius `--r-btn`, no stroke and no
 * effect in any state. The only Figma axis is `State = Default | Hover`, which is `:hover`, so
 * the set's whole API is the glyph swap — never a variant per glyph.
 *
 * Two states here are ours, and both reuse paint that already exists rather than inventing any:
 * `active` is the Hover fill made sticky, for a control that stays lit while its panel is open,
 * and `disabled` follows §0's set-wide node opacity 0.55, which this set's own variants never show.
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
  /** Held/lit state — renders the Hover paint and reports `aria-pressed`. */
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
