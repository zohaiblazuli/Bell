/**
 * Skeleton (Design System v2) — §19.1. A loading placeholder shaped like the content it stands in
 * for. Size it to the real element (a line of text, an avatar, a thumbnail). The shimmer sweep only
 * runs under `prefers-reduced-motion: no-preference`; under reduced motion it is a static block with
 * no pulse (see Skeleton.css).
 */
import type { CSSProperties } from 'react';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  /** Force a circular placeholder (avatars, dots); overrides `radius`. */
  circle?: boolean;
  className?: string;
}

const dim = (v: number | string | undefined): string | undefined =>
  typeof v === 'number' ? `${v}px` : v;

export default function Skeleton({ width, height = '1em', radius, circle, className }: SkeletonProps) {
  const style: CSSProperties = {
    width: dim(width),
    height: dim(height),
    borderRadius: circle ? '50%' : dim(radius),
  };
  return (
    <span
      className={['v2-skeleton', className].filter(Boolean).join(' ')}
      style={style}
      aria-hidden="true"
    />
  );
}
