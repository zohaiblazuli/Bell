/**
 * Button (Design System v2) — §8.1. Variants primary | secondary | ghost | danger, sizes
 * dense (28) | default (32) | prominent (40). Flat surfaces, 1px borders, no glass.
 *
 * `loading` keeps the box width stable (§8.1): the label stays laid out but invisible while a
 * spinner overlays it, so an async action never makes the button jump.
 */
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import Icon, { type IconName } from '../../components/Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'dense' | 'default' | 'prominent';

export interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** Icon-only: the visible label is dropped but still required as the accessible name. */
  iconOnly?: boolean;
  loading?: boolean;
  label?: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'default', icon, iconOnly, loading, label, className, children, type = 'button', disabled, 'aria-label': ariaLabel, ...rest },
  ref,
) {
  const content = label ?? children;
  return (
    <button
      ref={ref}
      type={type}
      className={['v2-btn', 't-ui', `v2-btn--${variant}`, `v2-btn--${size}`, iconOnly && 'v2-btn--icon', loading && 'is-loading', className].filter(Boolean).join(' ')}
      data-loading={loading || undefined}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={iconOnly && typeof content !== 'string' ? ariaLabel : ariaLabel}
      {...rest}
    >
      {loading ? <span className="v2-btn__spinner" aria-hidden="true" /> : null}
      <span className="v2-btn__inner">
        {icon ? <Icon name={icon} className="v2-btn__icon" /> : null}
        {!iconOnly && content ? <span className="v2-btn__label">{content}</span> : null}
      </span>
    </button>
  );
});

export default Button;
