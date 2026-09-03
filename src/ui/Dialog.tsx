/**
 * Dialog — the generic modal. Geometry is `design/specs/update-and-startup.md` §A1, measured off
 * the Update Dialog `437:7`, the file's only instance; everything specific to updating (the
 * string, Mr. Bell, the two buttons) is passed in.
 *
 * The panel is 420 FIXED wide and hugs vertically. The measured 280 is exactly the stack sum —
 * `20 + 96 + 18 + 20 + 18 + 28 + 18 + 38 + 24` — so a hard-coded height would only fight the
 * content it already agrees with.
 *
 * Real dialog semantics, none of which the app's ⌘K palette has, which is why it was not the
 * model: `role="dialog"` + `aria-modal`, the title wired through `aria-labelledby` and the body
 * through `aria-describedby`, Escape to close, Tab kept inside, focus moved in on open and
 * returned to whatever opened it on close.
 *
 * NOT portalled, deliberately: the tone variables are declared on `.app`, so a dialog rendered
 * into `document.body` would resolve Day tokens while the app is in Night.
 */
import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';

/** Enough for the app's own controls; in practice a dialog holds buttons. */
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogProps {
  open: boolean;
  /** Called by Escape, by a press on the scrim, and by whatever the caller wires into `actions`. */
  onClose: () => void;
  /** Title/Toolbar line, and the dialog's accessible name. */
  title: string;
  /** Body copy. Rendered Body/Small, centred, `--ink-2`. */
  children: ReactNode;
  /** The action row. Laid out 2-up and filled — see the CSS for why the two are not equal height. */
  actions?: ReactNode;
  /** Art above the title. The update dialog puts Mr. Bell at 96px here (0.375 of the 256 rig,
   *  which is still whole pixels). */
  art?: ReactNode;
  className?: string;
}

export default function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
  art,
  className,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const titleId = `${id}-title`;
  const bodyId = `${id}-body`;

  /* Focus in on open, back to the opener on close (the cleanup runs on both close and unmount).
     The panel takes focus rather than the first button: `actions` belongs to the caller, and which
     of them is the safe default — Later, not Restart now — is the caller's call, not ours. */
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => opener?.focus?.();
  }, [open]);

  if (!open) return null;

  /* Keys are handled here on the scrim rather than at the window, so this dialog can never reach
     past something above it: focus starts inside and the panel is click-focusable, so every key
     event passes through. CommandPalette captures Escape at the window while it is open and stops
     it, which means the palette still wins when both are up — the right way round. */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (nodes.length === 0) {
      e.preventDefault(); // nothing to move to, and Tab must not walk out of a modal
      return;
    }
    // −1 means focus is on the panel itself, so Shift+Tab wraps to the last control.
    const i = nodes.indexOf(document.activeElement as HTMLElement);
    if (!e.shiftKey && i === nodes.length - 1) {
      e.preventDefault();
      nodes[0]?.focus();
    } else if (e.shiftKey && i <= 0) {
      e.preventDefault();
      nodes[nodes.length - 1]?.focus();
    }
  };

  /* A press on the scrim dismisses. mousedown, not click: a click event fires on the common
     ancestor of its down and up targets, so a drag that starts inside the panel and ends outside
     it would land on the scrim and close the dialog. */
  const onScrimMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="dlg-scrim" onKeyDown={onKeyDown} onMouseDown={onScrimMouseDown}>
      <div
        ref={panelRef}
        className={className ? `dlg-panel ${className}` : 'dlg-panel'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
      >
        {art ? <div className="dlg-art">{art}</div> : null}
        <h2 id={titleId} className="dlg-title t-title-toolbar">
          {title}
        </h2>
        <div id={bodyId} className="dlg-body t-body-small">
          {children}
        </div>
        {actions ? <div className="dlg-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
