/**
 * Table (Design System v2) — §8.4 / §9.2. A CSS-grid data table: sticky header, controlled sort,
 * controlled row selection (checkbox column with a tri-state select-all), keyboard row navigation,
 * and dedicated loading/empty states. Virtualization is layered on by the Library in Phase 4; this
 * primitive renders the rows it is given.
 *
 * Selection and sort are controlled — the owner holds the Set and the sort descriptor — so the same
 * table drives the Library's contextual toolbar without a second source of truth.
 */
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import Icon from '../../components/Icon';
import Checkbox from './Checkbox';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  width?: number | string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  /** Render the cell in the tabular mono face (codes, marks, dates). */
  mono?: boolean;
}

export interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (next: Set<string>) => void;
  sort?: { key: string; dir: 'asc' | 'desc' };
  onSortChange?: (key: string) => void;
  /** Enter / double-click. */
  onRowActivate?: (row: T) => void;
  /** Single click — e.g. open the inspector without navigating. */
  onRowClick?: (row: T) => void;
  /** Row that reads as current (inspector target). */
  activeKey?: string;
  loading?: boolean;
  emptyState?: ReactNode;
  className?: string;
}
/* V2TABLE_BODY */

export default function Table<T>({
  columns, rows, rowKey, selectable, selected, onSelectedChange, sort, onSortChange,
  onRowActivate, onRowClick, activeKey, loading, emptyState, className,
}: TableProps<T>) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const keys = rows.map(rowKey);
  const selCount = selected ? keys.filter((k) => selected.has(k)).length : 0;
  const allSel = selCount > 0 && selCount === keys.length;
  const someSel = selCount > 0 && !allSel;

  const toggleAll = () => onSelectedChange?.(allSel ? new Set() : new Set(keys));
  const toggleOne = (k: string) => {
    if (!onSelectedChange) return;
    const next = new Set(selected ?? []);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onSelectedChange(next);
  };

  const onRowKeyDown = (e: KeyboardEvent<HTMLDivElement>, row: T, idx: number) => {
    const els = bodyRef.current?.querySelectorAll<HTMLElement>('[role="row"]');
    if (e.key === 'ArrowDown') { e.preventDefault(); els?.[idx + 1]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); els?.[idx - 1]?.focus(); }
    else if (e.key === 'Enter') { e.preventDefault(); onRowActivate?.(row); }
    else if (e.key === ' ' && selectable) { e.preventDefault(); toggleOne(rowKey(row)); }
  };

  const template = [
    selectable ? '40px' : null,
    ...columns.map((c) => (typeof c.width === 'number' ? `${c.width}px` : c.width ?? 'minmax(0,1fr)')),
  ].filter(Boolean).join(' ');

  const cellClass = (c: Column<T>, head: boolean) =>
    ['v2-table__cell', head ? 't-micro' : c.mono ? 'is-mono' : 't-body', c.align && `is-${c.align}`, c.sortable && head && 'is-sortable']
      .filter(Boolean).join(' ');

  return (
    <div className={['v2-table', className].filter(Boolean).join(' ')} role="table">
      <div className="v2-table__head" role="rowgroup">
        <div className="v2-table__row v2-table__row--head" role="row" style={{ gridTemplateColumns: template }}>
          {selectable ? (
            <div className="v2-table__cell v2-table__cell--check" role="columnheader">
              <Checkbox checked={allSel} indeterminate={someSel} onChange={toggleAll} aria-label="Select all rows" />
            </div>
          ) : null}
          {columns.map((c) => (
            <div
              key={c.key}
              role="columnheader"
              aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
              className={cellClass(c, true)}
            >
              {c.sortable ? (
                <button type="button" className="v2-table__sort" onClick={() => onSortChange?.(c.key)}>
                  {c.header}
                  <Icon name="chev" className={`v2-table__chev${sort?.key === c.key ? ` is-on is-${sort.dir}` : ''}`} />
                </button>
              ) : (
                c.header
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="v2-table__body" role="rowgroup" ref={bodyRef}>
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="v2-table__row v2-table__row--skel" style={{ gridTemplateColumns: template }} aria-hidden="true">
              {(selectable ? [null, ...columns] : columns).map((_c, ci) => (
                <div key={ci} className="v2-table__cell"><span className="v2-table__skel" /></div>
              ))}
            </div>
          ))
        ) : rows.length === 0 ? (
          <div className="v2-table__empty t-body">{emptyState ?? 'Nothing to show.'}</div>
        ) : (
          rows.map((row, idx) => {
            const k = rowKey(row);
            const isSel = selected?.has(k) ?? false;
            return (
              <div
                key={k}
                role="row"
                tabIndex={idx === 0 ? 0 : -1}
                aria-selected={selectable ? isSel : undefined}
                data-active={activeKey === k || undefined}
                data-selected={isSel || undefined}
                className="v2-table__row"
                style={{ gridTemplateColumns: template }}
                onClick={() => onRowClick?.(row)}
                onDoubleClick={() => onRowActivate?.(row)}
                onKeyDown={(e) => onRowKeyDown(e, row, idx)}
              >
                {selectable ? (
                  <div className="v2-table__cell v2-table__cell--check" role="cell" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={isSel} onChange={() => toggleOne(k)} aria-label="Select row" />
                  </div>
                ) : null}
                {columns.map((c) => (
                  <div key={c.key} role="cell" className={cellClass(c, false)}>
                    {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
