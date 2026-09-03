/**
 * Button — `design/specs/components-controls.md` §1, set `22:47` (9 variants).
 *
 * Figma's axes are `Style` (Secondary | Toggle | Primary) and `State` (Default | Hover |
 * Disabled). Only `Style` becomes a prop: `State` is `:hover` and `:disabled`, because a
 * design-time variant grid is not a runtime API.
 *
 * The two heights are measured and deliberately not uniform — Secondary and Toggle are
 * 123 x 34, Primary is 131 x 38 at the default "Start focus" label. The spec notes that action
 * rows centre on the cross axis precisely because of it, so a row holding both **must** be
 * `align-items: center`. Do not normalise the heights to make a row easier to lay out.
 *
 * `variant="toggle"` plus `active` is one control, not two. Figma has no "toggle off" face:
 * Secondary is it, which is exactly why Secondary and Toggle share their geometry to the pixel —
 * flipping the state cannot move the box. So `variant="toggle"` alone renders the Secondary
 * paint and reads `aria-pressed="false"`; `active` swaps in the accent-soft face. This is how
 * `.btn` / `.btn.on` was already used in WorkspaceView, with the semantics added.
 *
 * What it supersedes in app.css: `.btn`, `.btn:hover`, `.btn svg`, `.btn.on`, `.btn.primary`,
 * `.btn.primary:hover`, `.btn:disabled`.
 */
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import Icon, { type IconName } from '../components/Icon';

/** Figma `Style`. The set's own default is `Secondary`, and so is this component's. */
export type ButtonVariant = 'secondary' | 'toggle' | 'primary';

/**
 * Measured heights in px, for a caller that has to reserve the space. Kept here rather than
 * derived, because the asymmetry is the surprising part: Primary is 4px taller than the other two.
 */
export const BUTTON_HEIGHT = { secondary: 34, toggle: 34, primary: 38 } as const;

export interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: ButtonVariant;
  /**
   * Leading glyph, rendered 16 x 16. Figma's instance-swap default is `Icon=check`, which is a
   * canvas placeholder rather than a sensible code default — pass one or get none.
   */
  icon?: IconName;
  /**
   * Figma `Show Icon#22:28`. Only meaningful alongside `icon`; it lets a call site name its glyph
   * once and still suppress it conditionally.
   */
  showIcon?: boolean;
  /** Figma `Label#22:27`. `children` works too, for a label that is not a single string. */
  label?: ReactNode;
  /** Pressed state for `variant="toggle"`; the other two variants ignore it. */
  active?: boolean;
}

export default function Button({
  variant = 'secondary',
  icon,
  showIcon = true,
  label,
  active,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = ['bell-btn', 't-body-strong'];
  if (variant === 'primary') classes.push('bell-btn--primary');
  if (variant === 'toggle' && active) classes.push('bell-btn--on');
  if (className) classes.push(className);

  return (
    <button
      type={type}
      /* A toggle reports its state even when it is off; the other two variants are not toggles
         and must not carry the attribute at all. Sits before the spread so a call site can still
         override it — undefined never clobbers an explicit one. */
      aria-pressed={variant === 'toggle' ? Boolean(active) : undefined}
      {...rest}
      className={classes.join(' ')}
    >
      {showIcon && icon ? <Icon name={icon} /> : null}
      {label ?? children}
    </button>
  );
}
