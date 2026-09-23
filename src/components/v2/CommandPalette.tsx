/**
 * CommandPalette (Design System v2) — §11. The global ⌘K command centre: a modal overlay with a
 * search field over grouped, keyboard-navigable actions/entities. Flat v2 surface, focus-trapped,
 * Escape/scrim to close. Purely presentational + controlled — the owner supplies the command groups
 * and open state, so it drives papers, screens and actions without knowing about any of them.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Icon, { type IconName } from '../Icon';
import './CommandPalette.css';

export interface CommandItem {
  id: string;
  label: string;
  icon?: IconName;
  shortcut?: string;
  hint?: string;
  keywords?: string;
  run: () => void;
}
export interface CommandGroup {
  id: string;
  label?: string;
  items: CommandItem[];
}
export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  groups: CommandGroup[];
  placeholder?: string;
}

export default function CommandPalette({ open, onClose, groups, placeholder = 'Search papers, screens, actions…' }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // Filter each group by a case-insensitive substring over label + keywords, then flatten for cursor.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .map((g) => ({ ...g, items: q ? g.items.filter((i) => (i.label + ' ' + (i.keywords ?? '')).toLowerCase().includes(q)) : g.items }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);
  const flat = useMemo(() => filtered.flatMap((g) => g.items), [filtered]);

  useEffect(() => { setActive(0); }, [query, open]);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      restoreRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const runAt = (i: number) => {
    const item = flat[i];
    if (!item) return;
    onClose();
    item.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); runAt(active); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };
  /* V2CMDK_MARKER */

  let idx = -1; // running index across groups, to match the flat cursor
  return createPortal(
    <div className="v2-cmdk__scrim" onMouseDown={onClose}>
      <div
        className="v2-cmdk"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="v2-cmdk__search">
          <Icon name="search" className="v2-cmdk__search-icon" />
          <input
            ref={inputRef}
            className="v2-cmdk__input t-body"
            role="combobox"
            aria-expanded="true"
            aria-controls="v2-cmdk-list"
            aria-activedescendant={flat[active] ? `v2-cmdk-opt-${flat[active].id}` : undefined}
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="v2-cmdk__list" id="v2-cmdk-list" role="listbox">
          {flat.length === 0 ? (
            <div className="v2-cmdk__empty t-caption">No matches for “{query}”.</div>
          ) : (
            filtered.map((g) => (
              <div key={g.id} className="v2-cmdk__group" role="group" aria-label={g.label}>
                {g.label ? <div className="v2-cmdk__group-label t-micro">{g.label}</div> : null}
                {g.items.map((item) => {
                  idx += 1;
                  const i = idx;
                  return (
                    <button
                      key={item.id}
                      id={`v2-cmdk-opt-${item.id}`}
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      className="v2-cmdk__item"
                      data-active={i === active || undefined}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => runAt(i)}
                    >
                      {item.icon ? <Icon name={item.icon} className="v2-cmdk__item-icon" /> : <span className="v2-cmdk__item-icon" />}
                      <span className="v2-cmdk__item-label t-ui">{item.label}</span>
                      {item.hint ? <span className="v2-cmdk__item-hint t-caption">{item.hint}</span> : null}
                      {item.shortcut ? <kbd className="v2-cmdk__kbd t-micro">{item.shortcut}</kbd> : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  ) as ReactNode;
}
