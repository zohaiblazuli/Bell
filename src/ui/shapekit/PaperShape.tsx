import type { CSSProperties } from 'react';

/**
 * The Shape Kit paper marks — one fixed shape and colour per paper number, the same in every
 * subject, so a red circle always means Paper 1 (Bell App v2's `SH` table):
 *   P1 red circle · P2 blue quarter · P3 blue triangle · P4 yellow square · P5 ink half-moon ·
 *   P6 red diamond.
 * `pale` draws the catalogue state (not on disk yet): the shape in the pale tone.
 */
type Kind = 'circle' | 'quarter' | 'tri' | 'square' | 'half' | 'diamond';

const BY_NUMBER: Record<number, [Kind, string]> = {
  1: ['circle', 'var(--red)'],
  2: ['quarter', 'var(--blue)'],
  3: ['tri', 'var(--blue)'],
  4: ['square', 'var(--sk-yellow)'],
  5: ['half', 'var(--ink)'],
  6: ['diamond', 'var(--red)'],
};

export function paperShape(n: number): [Kind, string] {
  return BY_NUMBER[n] ?? BY_NUMBER[4];
}

/** Geometry at edge `s`, as Bell App v2's `geo()` sizes each shape. */
function geo(kind: Kind, s: number): CSSProperties {
  switch (kind) {
    case 'circle':
      return { width: s, height: s, borderRadius: '50%' };
    case 'quarter':
      return { width: s, height: s, borderRadius: `${s}px 0 0 0` };
    case 'tri':
      return { width: Math.round(s * 1.1), height: s, clipPath: 'polygon(50% 0,100% 100%,0 100%)' };
    case 'square':
      return { width: Math.round(s * 0.88), height: Math.round(s * 0.88) };
    case 'half':
      return { width: Math.round(s * 1.15), height: Math.round(s * 0.58), borderRadius: `${s}px ${s}px 0 0` };
    case 'diamond':
      return { width: s, height: s, clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)' };
  }
}

export default function PaperShape({
  n,
  size = 16,
  pale = false,
  className,
  style,
}: {
  n: number;
  size?: number;
  pale?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const [kind, col] = paperShape(n);
  return (
    <span
      className={className}
      aria-hidden="true"
      style={{ display: 'block', flex: 'none', background: pale ? 'var(--pale)' : col, ...geo(kind, size), ...style }}
    />
  );
}
