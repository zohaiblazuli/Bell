/**
 * Menu (Design System v2) — a dropdown/context menu that shares Popover's surface, positioning and
 * dismissal (Escape + outside pointerdown), and adds the WAI-ARIA menu-button keyboard model on top.
 *
 * Composition: `<Menu>` renders the `role="menu"` container; `<MenuItem>` and `<MenuSeparator>` are
 * its children. Roving focus (Arrow/Home/End, wrapping, skipping disabled items and separators) is
 * driven off the live DOM inside the panel, so callers compose items freely without registering them.
 * Enter/Space activate the focused item and close; Escape closes and restores focus to the anchor
 * (handled by Popover). On open the first enabled item is focused.
 */
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import Icon, { type IconName } from '../../components/Icon';
import Popover, { type PopoverPlacement } from './Popover';

interface MenuContextValue {
  close: () => void;
}
const MenuContext = createContext<MenuContextValue | null>(null);

export interface MenuProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  placement?: PopoverPlacement;
  children: ReactNode;
  /** Accessible name for the menu (role="menu" aria-label). */
  label?: string;
}

export interface MenuItemProps {
  icon?: IconName;
  label: ReactNode;
  /** Right-aligned shortcut hint, e.g. "⌘K". */
  shortcut?: ReactNode;
  /** Destructive action styling (text in --danger). */
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

const ITEM_SELECTOR = '[role="menuitem"]';

export default function Menu({ open, onClose, anchorRef, placement, children, label }: MenuProps) {
  const listRef = useRef<HTMLDivElement>(null);

  /** Enabled (focusable) items in DOM order. */
  const items = (): HTMLElement[] => {
    const root = listRef.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).filter(
      (el) => el.getAttribute('aria-disabled') !== 'true',
    );
  };

  // Focus the first enabled item once the menu opens. Runs after Popover's own (fallback) focus
  // move because parent effects run after child effects, so this is the authoritative focus.
  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
  }, [open]);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const list = items();
    if (list.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const idx = active ? list.indexOf(active) : -1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        list[idx < 0 ? 0 : (idx + 1) % list.length]?.focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        list[idx < 0 ? list.length - 1 : (idx - 1 + list.length) % list.length]?.focus();
        break;
      case 'Home':
        e.preventDefault();
        list[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        list[list.length - 1]?.focus();
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        (idx >= 0 ? list[idx] : list[0])?.click();
        break;
      // Escape is handled by Popover (closes + restores anchor focus).
    }
  };

  return (
    <MenuContext.Provider value={{ close: onClose }}>
      <Popover open={open} onClose={onClose} anchorRef={anchorRef} placement={placement}>
        <div ref={listRef} className="v2-menu" role="menu" aria-label={label} onKeyDown={onKeyDown}>
          {children}
        </div>
      </Popover>
    </MenuContext.Provider>
  );
}

export function MenuItem({ icon, label, shortcut, danger, disabled, onSelect }: MenuItemProps) {
  const ctx = useContext(MenuContext);
  const activate = () => {
    if (disabled) return;
    onSelect();
    ctx?.close();
  };
  return (
    <div
      className={['v2-menu__item', 't-ui', danger && 'v2-menu__item--danger'].filter(Boolean).join(' ')}
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      data-disabled={disabled || undefined}
      onClick={activate}
    >
      <span className="v2-menu__item-icon" aria-hidden="true">
        {icon ? <Icon name={icon} /> : null}
      </span>
      <span className="v2-menu__item-label">{label}</span>
      {shortcut != null ? <span className="v2-menu__item-shortcut t-micro">{shortcut}</span> : null}
    </div>
  );
}

export function MenuSeparator() {
  return <div className="v2-menu__sep" role="separator" />;
}
