/**
 * SegmentedControl (Design System v2) — §8.3. 2–4 mutually exclusive view modes rendered as a
 * `role="group"` of `aria-pressed` buttons on a shared track.
 *
 * Keyboard: roving tabindex. Exactly one segment is in the tab order (the selected one); arrow keys
 * move focus between segments and selection follows focus, Home/End jump to the ends. This is the
 * standard toolbar-style single-select interaction for view toggles.
 */
import { useRef, type KeyboardEvent } from 'react';
import Icon, { type IconName } from '../../components/Icon';

export interface SegmentedItem {
  value: string;
  label: string;
  icon?: IconName;
}

export interface SegmentedControlProps {
  items: SegmentedItem[];
  value: string;
  onChange: (value: string) => void;
  /** Accessible name for the group. */
  label: string;
  size?: 'dense' | 'default';
}

export default function SegmentedControl({
  items,
  value,
  onChange,
  label,
  size = 'default',
}: SegmentedControlProps) {
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = items.findIndex((i) => i.value === value);

  const moveTo = (index: number) => {
    const n = (index + items.length) % items.length;
    btnRefs.current[n]?.focus();
    onChange(items[n].value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        moveTo(index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        moveTo(index - 1);
        break;
      case 'Home':
        e.preventDefault();
        moveTo(0);
        break;
      case 'End':
        e.preventDefault();
        moveTo(items.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div className={['v2-seg', `v2-seg--${size}`].join(' ')} role="group" aria-label={label}>
      {items.map((item, index) => {
        const selected = item.value === value;
        // Keep one segment tabbable even if `value` matches nothing yet.
        const tabbable = selectedIndex === -1 ? index === 0 : selected;
        return (
          <button
            key={item.value}
            ref={(node) => {
              btnRefs.current[index] = node;
            }}
            type="button"
            className={['v2-seg__item', 't-ui', selected && 'is-selected'].filter(Boolean).join(' ')}
            aria-pressed={selected}
            tabIndex={tabbable ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            {item.icon ? <Icon name={item.icon} className="v2-seg__icon" /> : null}
            <span className="v2-seg__label">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
