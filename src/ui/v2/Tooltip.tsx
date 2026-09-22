/**
 * Tooltip (Design System v2) — §7/§20. A non-interactive hint anchored to a single interactive
 * child. Opens after a ~450ms hover dwell, or IMMEDIATELY on keyboard focus of the trigger (so a
 * keyboard user never waits); closes on blur, mouseleave and Escape. The bubble is rendered through
 * a portal on <body> and positioned from the trigger's getBoundingClientRect with a 6px gap, then
 * clamped/flipped to stay on screen. It is associated to the trigger via aria-describedby and is
 * never itself hoverable (pointer-events: none), so moving the pointer toward it just closes it.
 */
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  /** The hint text/nodes shown in the bubble. */
  content: ReactNode;
  /** Preferred side; flips to the opposite side if it would leave the viewport. */
  placement?: TooltipPlacement;
  /** Exactly one interactive element the tooltip describes. */
  children: ReactElement;
}

const HOVER_DELAY = 450;
const GAP = 6;
const MARGIN = 8;

interface Pos {
  top: number;
  left: number;
  placement: TooltipPlacement;
}

function setRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref && typeof ref === 'object') (ref as { current: T | null }).current = value;
}

function composeHandlers<E>(theirs: ((e: E) => void) | undefined, ours: (e: E) => void) {
  return (e: E) => {
    theirs?.(e);
    ours(e);
  };
}

export default function Tooltip({ content, placement = 'top', children }: TooltipProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos>({ top: 0, left: 0, placement });

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    clearTimer();
    setOpen(false);
  }, [clearTimer]);

  const openNow = useCallback(() => {
    clearTimer();
    setOpen(true);
  }, [clearTimer]);

  const openDelayed = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => setOpen(true), HOVER_DELAY);
  }, [clearTimer]);

  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    const bubble = bubbleRef.current;
    if (!trigger || !bubble) return;
    const r = trigger.getBoundingClientRect();
    const bw = bubble.offsetWidth;
    const bh = bubble.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;

    // Flip to the opposite side if the preferred one lacks room.
    let side = placement;
    if (side === 'top' && r.top - bh - GAP < MARGIN) side = 'bottom';
    else if (side === 'bottom' && r.bottom + bh + GAP > vh - MARGIN) side = 'top';
    else if (side === 'left' && r.left - bw - GAP < MARGIN) side = 'right';
    else if (side === 'right' && r.right + bw + GAP > vw - MARGIN) side = 'left';

    let top: number;
    let left: number;
    if (side === 'top') {
      top = r.top - bh - GAP;
      left = r.left + r.width / 2 - bw / 2;
    } else if (side === 'bottom') {
      top = r.bottom + GAP;
      left = r.left + r.width / 2 - bw / 2;
    } else if (side === 'left') {
      top = r.top + r.height / 2 - bh / 2;
      left = r.left - bw - GAP;
    } else {
      top = r.top + r.height / 2 - bh / 2;
      left = r.right + GAP;
    }

    // Clamp against the cross axis so a centred bubble never spills off-screen.
    left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, vw - bw - MARGIN));
    top = Math.min(Math.max(top, MARGIN), Math.max(MARGIN, vh - bh - MARGIN));

    setPos({ top, left, placement: side });
  }, [placement]);

  // Position before paint, and keep in sync while open.
  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const onScroll = () => reposition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, reposition]);

  // Escape closes even when opened by hover (trigger may not hold focus).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => clearTimer, [clearTimer]);

  if (!isValidElement(children)) return children ?? null;

  const hasContent = content != null && content !== false && content !== '';
  const childProps = children.props as Record<string, unknown>;
  // React 19 carries ref as a regular prop, so we merge from there (avoids the element.ref warning).
  const childRef = childProps.ref as Ref<HTMLElement> | undefined;

  const setTriggerRef = (node: HTMLElement | null) => {
    triggerRef.current = node;
    setRef(childRef, node);
  };

  const describedBy = [childProps['aria-describedby'] as string | undefined, open && hasContent ? tooltipId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  const trigger = cloneElement(children as ReactElement<any>, {
    ref: setTriggerRef,
    'aria-describedby': describedBy,
    onMouseEnter: composeHandlers(childProps.onMouseEnter as ((e: unknown) => void) | undefined, openDelayed),
    onMouseLeave: composeHandlers(childProps.onMouseLeave as ((e: unknown) => void) | undefined, close),
    onFocus: composeHandlers(childProps.onFocus as ((e: unknown) => void) | undefined, (e: unknown) => {
      const target = (e as { target?: HTMLElement })?.target;
      let visible = true;
      try {
        // Show at once for keyboard focus; a plain mouse-click focus is already covered by hover.
        if (target && typeof target.matches === 'function') visible = target.matches(':focus-visible');
      } catch {
        visible = true;
      }
      if (visible) openNow();
    }),
    onBlur: composeHandlers(childProps.onBlur as ((e: unknown) => void) | undefined, close),
    onKeyDown: composeHandlers(childProps.onKeyDown as ((e: unknown) => void) | undefined, (e: unknown) => {
      if ((e as { key?: string })?.key === 'Escape') close();
    }),
  });

  return (
    <>
      {trigger}
      {open && hasContent && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={bubbleRef}
              id={tooltipId}
              role="tooltip"
              className="v2-tooltip t-caption"
              data-placement={pos.placement}
              style={{ top: pos.top, left: pos.left }}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
