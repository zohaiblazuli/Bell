/**
 * Popover (Design System v2) — an anchored floating panel rendered through a portal into
 * document.body, so it escapes any `overflow`/clip ancestor. It positions against `anchorRef`
 * with a 6px gap, flips vertically when it would overflow the viewport, and recomputes on
 * scroll/resize while open. It is NOT a modal: focus is moved into the panel on open and restored
 * to the anchor on close, but never trapped. Escape and a pointerdown outside the panel close it
 * (clicks on the anchor are ignored — the anchor owns its own toggle).
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

export type PopoverPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  placement?: PopoverPlacement;
  children: ReactNode;
  className?: string;
}

/** Gap between the anchor edge and the panel, in px. */
const GAP = 6;

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface Coords {
  top: number;
  left: number;
  side: 'top' | 'bottom';
}

/** Place the panel in viewport (fixed) coordinates, flipping the vertical side on overflow. */
function computeCoords(
  anchor: DOMRect,
  panelW: number,
  panelH: number,
  placement: PopoverPlacement,
): Coords {
  const [side, align] = placement.split('-') as ['top' | 'bottom', 'start' | 'end'];
  const spaceBelow = window.innerHeight - anchor.bottom;
  const spaceAbove = anchor.top;

  let resolved: 'top' | 'bottom' = side;
  if (side === 'bottom' && spaceBelow < panelH + GAP && spaceAbove > spaceBelow) resolved = 'top';
  else if (side === 'top' && spaceAbove < panelH + GAP && spaceBelow > spaceAbove) resolved = 'bottom';

  const top = resolved === 'bottom' ? anchor.bottom + GAP : anchor.top - GAP - panelH;
  const rawLeft = align === 'start' ? anchor.left : anchor.right - panelW;
  // Keep the panel inside the viewport horizontally.
  const maxLeft = Math.max(GAP, window.innerWidth - panelW - GAP);
  const left = Math.max(GAP, Math.min(rawLeft, maxLeft));

  return { top, left, side: resolved };
}

export default function Popover({
  open,
  onClose,
  anchorRef,
  placement = 'bottom-start',
  children,
  className,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<Coords | null>(null);

  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    setCoords(computeCoords(anchor.getBoundingClientRect(), panel.offsetWidth, panel.offsetHeight, placement));
  }, [anchorRef, placement]);

  // Measure + place synchronously before paint so the panel never flashes at 0,0.
  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    reposition();
  }, [open, reposition]);

  // Recompute while open — scroll uses capture so it catches scrolling in any ancestor.
  useEffect(() => {
    if (!open) return;
    const handle = () => reposition();
    window.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
    };
  }, [open, reposition]);

  // Move focus into the panel on open; restore it to the anchor on close. Not trapped.
  useEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    const target = panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
    target?.focus();
    return () => {
      anchor?.focus();
    };
  }, [open, anchorRef]);

  // Escape, and pointerdown outside the panel (ignoring the anchor), close it.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return; // inside the panel — keep open
      if (anchorRef.current?.contains(target)) return; // the anchor toggles itself
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      className={['v2-popover', className].filter(Boolean).join(' ')}
      tabIndex={-1}
      data-side={coords?.side ?? 'bottom'}
      data-ready={coords ? 'true' : undefined}
      style={{ top: coords?.top ?? 0, left: coords?.left ?? 0 }}
    >
      {children}
    </div>,
    document.body,
  );
}
