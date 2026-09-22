/**
 * Checkbox (Design System v2) — a real native <input type="checkbox"> with a drawn box, so it
 * carries platform activation, focus and form semantics. Supports `indeterminate` for a table's
 * select-all header (a tri-state the DOM only exposes through the element property, hence the ref).
 *
 * v2 §8.2 / §20: 16px box, 1px border, accent fill when checked, visible focus, disabled at 0.55.
 */
import { forwardRef, useEffect, useRef, type ComponentPropsWithoutRef } from 'react';
import Icon from '../../components/Icon';

export interface CheckboxProps extends Omit<ComponentPropsWithoutRef<'input'>, 'type'> {
  /** Tri-state middle value — visually a dash, `aria-checked="mixed"`. */
  indeterminate?: boolean;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { indeterminate = false, className, disabled, ...rest },
  ref,
) {
  const innerRef = useRef<HTMLInputElement>(null);
  // Mirror the caller's ref onto our own so we can set the DOM-only `indeterminate` property.
  useEffect(() => {
    const el = innerRef.current;
    if (el) el.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <span className={['v2-checkbox', className].filter(Boolean).join(' ')} data-disabled={disabled || undefined}>
      <input
        type="checkbox"
        ref={(node) => {
          innerRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        disabled={disabled}
        aria-checked={indeterminate ? 'mixed' : undefined}
        {...rest}
      />
      <span className="v2-checkbox__box" aria-hidden="true">
        {indeterminate ? <span className="v2-checkbox__dash" /> : <Icon name="check" className="v2-checkbox__tick" />}
      </span>
    </span>
  );
});

export default Checkbox;
