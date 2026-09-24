/**
 * "Clip to notebook" — the destination picker.
 *
 * Bell App v2 draws it as a 280px framed menu under the Reader's Clip button: a CLIP TO eyebrow,
 * one row per notebook (its cover as a small framed book, the name, then subject and pages), and a
 * "New notebook…" row under a rule.
 *
 * It is deliberately a list of notebooks and nothing else. Asking for a page as well would be the
 * obvious next control and it is the wrong one: a clip goes where your working goes, which is the
 * end of the notebook, and `placeImage` puts it under whatever is already on that page — spilling to
 * the next page if it will not fit. One decision, then a drag.
 */
import './ClipPicker.css';
import { useEffect, useRef } from 'react';
import type { NbEntry } from '@/lib/notebooks';
import { coverColours } from '@ui/NotebookCover';

export interface Props {
  open: boolean;
  notebooks: NbEntry[];
  /** null while the list is still being read, so the empty state cannot flash on the way in. */
  loading?: boolean;
  onPick: (entry: NbEntry) => void;
  onClose: () => void;
  /** The "New notebook…" row at the foot of the menu. Takes the student to the shelf. */
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
      <div className="clipp-head">CLIP TO</div>

      {loading ? (
        <p className="clipp-empty t-body-meta">Reading your notebooks…</p>
      ) : notebooks.length === 0 ? (
        <p className="clipp-empty">
          No notebooks yet. Make one and anything you clip out of a paper lands on its pages.
        </p>
      ) : (
        <ul className="clipp-list">
          {notebooks.map((n, i) => (
            <li key={n.id} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <button type="button" className="clipp-row" onClick={() => onPick(n)}>
                <span
                  className="clipp-swatch"
                  style={{ background: coverColours(n.subject, n.cover).bg }}
                  aria-hidden="true"
                />
                <span className="clipp-text">
                  <span className="clipp-name">{n.name}</span>
                  <span className="clipp-meta">
                    {n.subject ? `${n.subject.name} ${n.subject.code} · ` : ''}
                    {n.pages} pages
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!loading && (
        <button type="button" className="clipp-row clipp-new" onClick={onNew}>
          <span className="clipp-plus" aria-hidden="true">+</span>
          <span className="clipp-name">New notebook…</span>
        </button>
      )}
    </div>
  );
}
