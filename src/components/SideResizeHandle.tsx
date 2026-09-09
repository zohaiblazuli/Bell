import { useCallback, useEffect, useRef, useState } from 'react';
import './SideResizeHandle.css';

export interface SideResizeHandleProps {
  /** The current width in pixels of the pane being resized */
  currentWidth: number;
  /** Minimum allowed width (defaults to 320px) */
  minWidth?: number;
  /** Maximum allowed width (defaults to window.innerWidth - 480px) */
  maxWidth?: number;
  /** Default width for double-click / keyboard reset */
  defaultWidth?: number;
  /** Callback fired continuously during drag */
  onResize: (width: number) => void;
  /** Callback fired when drag starts */
  onResizeStart?: () => void;
  /** Callback fired when drag finishes (passes the settled width) */
  onResizeEnd?: (width: number) => void;
  /** Which edge the handle is on relative to the pane. 'left' means handle is on left edge of a right-docked pane */
  side?: 'left' | 'right';
  /** Accessible label for screen readers */
  label?: string;
}

export default function SideResizeHandle({
  currentWidth,
  minWidth = 320,
  maxWidth,
  defaultWidth = 480,
  onResize,
  onResizeStart,
  onResizeEnd,
  side = 'left',
  label = 'Resize side viewer',
}: SideResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(currentWidth);
  const currentWidthRef = useRef(currentWidth);
  const liveWidthRef = useRef(currentWidth);
  const frameRef = useRef<number | null>(null);
  currentWidthRef.current = currentWidth;

  const getEffectiveMax = useCallback(() => {
    if (typeof maxWidth === 'number') return maxWidth;
    return typeof window !== 'undefined'
      ? Math.max(minWidth + 60, window.innerWidth - 480)
      : 1200;
  }, [maxWidth, minWidth]);

  // Set global cursor and userSelect while dragging
  useEffect(() => {
    if (!isDragging) return;
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [isDragging]);

  useEffect(() => () => {
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    startXRef.current = e.clientX;
    startWidthRef.current = currentWidthRef.current;
    liveWidthRef.current = currentWidthRef.current;
    setIsDragging(true);
    onResizeStart?.();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.preventDefault();

    const deltaX =
      side === 'left' ? startXRef.current - e.clientX : e.clientX - startXRef.current;
    const target = startWidthRef.current + deltaX;
    const effectiveMax = getEffectiveMax();
    const clamped = Math.round(Math.max(minWidth, Math.min(effectiveMax, target)));
    liveWidthRef.current = clamped;
    if (frameRef.current == null) {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        onResize(liveWidthRef.current);
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.preventDefault();

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    setIsDragging(false);
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      onResize(liveWidthRef.current);
    }
    onResizeEnd?.(liveWidthRef.current);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof defaultWidth === 'number') {
      const effectiveMax = getEffectiveMax();
      const resetW = Math.max(minWidth, Math.min(effectiveMax, defaultWidth));
      onResize(resetW);
      onResizeEnd?.(resetW);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 40 : 16;
    const effectiveMax = getEffectiveMax();

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const delta = side === 'left' ? step : -step;
      const next = Math.max(minWidth, Math.min(effectiveMax, currentWidthRef.current + delta));
      onResize(next);
      onResizeEnd?.(next);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const delta = side === 'left' ? -step : step;
      const next = Math.max(minWidth, Math.min(effectiveMax, currentWidthRef.current + delta));
      onResize(next);
      onResizeEnd?.(next);
    } else if (e.key === 'Home' || e.key === 'Enter') {
      e.preventDefault();
      if (typeof defaultWidth === 'number') {
        const resetW = Math.max(minWidth, Math.min(effectiveMax, defaultWidth));
        onResize(resetW);
        onResizeEnd?.(resetW);
      }
    }
  };

  return (
    <div
      className="side-resize-handle"
      data-dragging={isDragging ? 'true' : undefined}
      data-side={side}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(currentWidth)}
      aria-valuemin={minWidth}
      aria-valuemax={getEffectiveMax()}
      tabIndex={0}
      title={`${label} (Drag to resize · Double-click to reset)`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="side-resize-line" aria-hidden="true" />
      <div className="side-resize-grip" aria-hidden="true" />

      {isDragging && (
        <div className="side-resize-badge t-mono-meta" aria-hidden="true">
          {Math.round(currentWidth)} px
        </div>
      )}
    </div>
  );
}
