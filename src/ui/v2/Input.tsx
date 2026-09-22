/**
 * Input (Design System v2) — §8.2. A labelled text field with helper/error text that reserves its
 * own space (so validation appearing on blur never shifts layout). Sizes default (32) and
 * comfortable (36). Validity is the caller's to decide — pass `invalid` (it maps to aria-invalid
 * and the error styling); the component never flags an error while the user is still typing.
 */
import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';

export interface InputProps extends Omit<ComponentPropsWithoutRef<'input'>, 'size'> {
  label?: ReactNode;
  hint?: ReactNode;
  /** Shown in place of the hint when present; also drives the error styling. */
  error?: ReactNode;
  invalid?: boolean;
  size?: 'default' | 'comfortable';
  /** Non-interactive leading glyph or affix. */
  leading?: ReactNode;
  trailing?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, invalid, size = 'default', leading, trailing, className, id, disabled, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const msgId = `${inputId}-msg`;
  const isInvalid = invalid || Boolean(error);
  const message = error ?? hint;

  return (
    <div className={['v2-input', `v2-input--${size}`, className].filter(Boolean).join(' ')} data-disabled={disabled || undefined}>
      {label ? <label className="v2-input__label t-ui" htmlFor={inputId}>{label}</label> : null}
      <div className="v2-input__box" data-invalid={isInvalid || undefined}>
        {leading ? <span className="v2-input__affix" aria-hidden="true">{leading}</span> : null}
        <input
          ref={ref}
          id={inputId}
          type="text"
          className="v2-input__field t-body"
          disabled={disabled}
          aria-invalid={isInvalid || undefined}
          aria-describedby={message ? msgId : undefined}
          {...rest}
        />
        {trailing ? <span className="v2-input__affix" aria-hidden="true">{trailing}</span> : null}
      </div>
      {message ? (
        <span id={msgId} className="v2-input__msg t-caption" data-error={Boolean(error) || undefined} role={error ? 'alert' : undefined}>
          {message}
        </span>
      ) : null}
    </div>
  );
});

export default Input;
