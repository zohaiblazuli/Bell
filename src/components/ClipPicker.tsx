/**
 * "Clip to notebook" — the destination picker.
 *
 * Spec: `design/specs/screen-notebooks.md` §6 gives the glass-popover recipe this borrows (glass,
 * 1px hair, blur 26, clip) and §4e gives the cover swatch. The picker itself is not drawn in Figma —
 * the file specifies the affordance ("Clip to notebook" in the Reader topbar, the new `clip` glyph)
 * and leaves the destination step to the implementation, so this is built from the file's parts
 * rather than invented in a different vocabulary.
 *
 * It is deliberately a list of notebooks and nothing else. Asking for a page as well would be the
 * obvious next control and it is the wrong one: a clip goes where your working goes, which is the
 * end of the notebook, and `placeImage` puts it under whatever is already on that page — spilling to
 * the next page if it will not fit. One decision, then a drag.
 */
import './ClipPicker.css';
import { useEffect, useRef } from 'react';
import Icon from './Icon';
import type { NbEntry } from '@/lib/notebooks';

export interface Props {
  open: boolean;
  notebooks: NbEntry[];
  /** null while the list is still being read, so the empty state cannot flash on the way in. */
  loading?: boolean;
  onPick: (entry: NbEntry) => void;
  onClose: () => void;
  /** Offered when there is nothing to clip into yet. Takes the student to the shelf. */
  onNew: () => void;
}

export default function ClipPicker({ open, notebooks, loading, onPick, onClose, onNew }: Props) {
  const box = useRef<HTMLDivElement>(null);

  // Escape and a press outside both close. Captured at the window, the way the palette does it, so
  // the paper behind never reacts to the click that dismissed this.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) box.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [open, notebooks.length]);

  if (!open) return null;

  return (
    <div className="clipp" ref={box} role="dialog" aria-label="Clip to which notebook?">
      <div className="clipp-head t-label-section">Clip to</div>

      {loading ? (
        <p className="clipp-empty t-body-meta">Reading your notebooks…</p>
      ) : notebooks.length === 0 ? (
        <>
          <p className="clipp-empty t-body-meta">
            No notebooks yet. Make one and anything you clip out of a paper lands on its pages.
          </p>
          <button type="button" className="clipp-row clipp-new" onClick={onNew}>
            <span className="clipp-plus" aria-hidden="true">
              <Icon name="plus" />
            </span>
            <span className="clipp-name t-body-default">New notebook…</span>
          </button>
        </>
      ) : (
        <ul className="clipp-list">
          {notebooks.map((n) => (
            <li key={n.id}>
              <button type="button" className="clipp-row" onClick={() => onPick(n)}>
                <span
                  className="clipp-swatch"
                  style={{ background: `var(--cover-${n.cover})` }}
                  aria-hidden="true"
                />
                <span className="clipp-text">
                  <span className="clipp-name t-body-default">{n.name}</span>
                  <span className="clipp-meta t-body-meta">
                    {n.subject ? `${n.subject.name} ${n.subject.code} · ` : ''}
                    {n.pages} pages
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
