/**
 * Spinner (Design System v2). An indeterminate busy ring. `role="status"` + a visually-hidden
 * `label` give it an accessible name, so it still communicates "busy" to assistive tech and under
 * reduced motion even when the rotation is suppressed (see Spinner.css). Colour is inherited:
 * `currentColor` drives the head, and a color-mix of it the track.
 */
import type { CSSProperties } from 'react';

export interface SpinnerProps {
  size?: number;
  /** Visually-hidden accessible name announced by `role="status"`. */
  label?: string;
  className?: string;
}

export default function Spinner({ size = 16, label = 'Loading', className }: SpinnerProps) {
  const ringStyle: CSSProperties = { width: `${size}px`, height: `${size}px` };
  return (
    <span className={['v2-spinner', className].filter(Boolean).join(' ')} role="status">
      <span className="v2-spinner__ring" style={ringStyle} aria-hidden="true" />
      <span className="v2-spinner__sr">{label}</span>
    </span>
  );
}
