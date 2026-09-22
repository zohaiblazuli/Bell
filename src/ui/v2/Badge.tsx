/**
 * Badge (Design System v2) — §8.4 / §17. A compact semantic label / chip.
 *
 * Status must read by text + icon, never by colour alone (§ a11y): the label `children` is always
 * rendered, and `icon`/`dot` are supplementary. `tone` picks the semantic colour token, `variant`
 * how it is applied (tinted `soft`, filled `solid`, or `outline`). Neutral maps to the muted
 * text/border/surface tokens rather than a hue.
 */
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import Icon, { type IconName } from '../../components/Icon';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeVariant = 'soft' | 'solid' | 'outline';

export interface BadgeProps extends ComponentPropsWithoutRef<'span'> {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  icon?: IconName;
  /** Small leading status dot (currentColor). Supplements, never replaces, the text label. */
  dot?: boolean;
  children: ReactNode;
}

export default function Badge({
  tone = 'neutral',
  variant = 'soft',
  icon,
  dot = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={['v2-badge', 't-micro', `v2-badge--${tone}`, `v2-badge--${variant}`, className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {dot ? <span className="v2-badge__dot" aria-hidden="true" /> : null}
      {icon ? <Icon name={icon} className="v2-badge__icon" /> : null}
      <span className="v2-badge__label">{children}</span>
    </span>
  );
}
