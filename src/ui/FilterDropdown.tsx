import './FilterDropdown.css';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Icon from '@/components/Icon';
import type { ChipPalette } from './Chip';

export interface FilterDropdownItem<T> {
  value: T;
  label: string;
  palette?: ChipPalette;
  icon?: ReactNode;
}

export interface FilterDropdownProps<T> {
  /** Category label displayed as a prefix (e.g. "Level", "Season", "Paper") */
  label: string;
  /** Currently selected value (null / undefined indicates default/all) */
  value: T;
  /** Active value display label (e.g. "All", "A Level", "May/June") */
  valueLabel: string;
  /** Available options in the dropdown */
  items: FilterDropdownItem<T>[];
  /** Palette tint for the active trigger button */
  palette?: ChipPalette;
  /** Leading icon for the active selection */
  icon?: ReactNode;
  /** Called when an option is selected */
  onChange: (value: T) => void;
  className?: string;
}

export default function FilterDropdown<T>({
  label,
  value,
  valueLabel,
  items,
  palette,
  icon,
  onChange,
  className,
}: FilterDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const select = useCallback(
    (val: T) => {
      onChange(val);
      setOpen(false);
    },
    [onChange],
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, close]);

  const isFiltered = value !== null && value !== undefined && value !== 'all';
  const rootClass = ['filter-dropdown', className].filter(Boolean).join(' ');

  return (
    <div className={rootClass} ref={containerRef}>
      <button
        type="button"
        className="filter-dropdown-trigger"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="listbox"
        data-open={open ? 'true' : 'false'}
        data-active={isFiltered ? 'true' : 'false'}
        data-palette={palette ?? undefined}
      >
        {icon && <span className="filter-dropdown-icon">{icon}</span>}
        <span className="filter-dropdown-prefix">{label}:</span>
        <span className="filter-dropdown-value">{valueLabel}</span>
        <span className="filter-dropdown-chev" aria-hidden="true">
          <Icon name="chev" />
        </span>
      </button>

      {open && (
        <div className="filter-dropdown-menu" role="listbox" aria-label={label}>
          {items.map((item, idx) => {
            const isSelected = item.value === value;
            return (
              <button
                key={idx}
                type="button"
                className="filter-dropdown-item"
                role="option"
                aria-selected={isSelected}
                data-selected={isSelected ? 'true' : 'false'}
                onClick={() => select(item.value)}
              >
                <span className="filter-dropdown-item-content">
                  {item.icon && <span className="filter-dropdown-item-icon">{item.icon}</span>}
                  <span>{item.label}</span>
                </span>
                {isSelected && (
                  <span className="filter-dropdown-check" aria-hidden="true">
                    <Icon name="check" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
