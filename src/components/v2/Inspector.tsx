/**
 * Inspector (Design System v2) — §10. The reusable right-panel frame: a sticky header (title +
 * close), an independently scrolling body, and an optional sticky footer for a primary action.
 *
 * Purely presentational and un-keyed on purpose: the owner swaps `children` as the selected entity
 * changes and the panel updates in place rather than remounting (§10 — no panel flicker).
 */
import type { ReactNode } from 'react';
import Button from '@ui/v2/Button';
import './Inspector.css';

export interface InspectorProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export default function Inspector({ title, onClose, children, footer, className }: InspectorProps) {
  return (
    <section className={['v2-inspector', className].filter(Boolean).join(' ')} aria-label={typeof title === 'string' ? title : 'Details'}>
      <header className="v2-inspector__header">
        <h2 className="v2-inspector__title t-section-title">{title}</h2>
        <Button variant="ghost" size="dense" iconOnly icon="x" aria-label="Close panel" onClick={onClose} />
      </header>
      <div className="v2-inspector__body">{children}</div>
      {footer ? <footer className="v2-inspector__footer">{footer}</footer> : null}
    </section>
  );
}
