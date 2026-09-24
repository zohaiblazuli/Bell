import type { CSSProperties } from 'react';

/**
 * The exam-season glyphs — Shape Kit (Bell App v2): May/June a sun, Oct/Nov a snowflake, Feb/Mar a
 * sprout, each built from bars and circles on an 18px box and drawn in its season's colour (gold,
 * blue, red — the same three the heatmap's season bars use). `mono` draws it in the current ink.
 */
export type SeasonKey = 's' | 'w' | 'm';

export function seasonKeyOf(value: string | null | undefined): SeasonKey | null {
  const c = value?.trim().charAt(0).toLowerCase();
  return c === 's' || c === 'w' || c === 'm' ? c : null;
}

export const SEASON_COLOUR: Record<SeasonKey, string> = {
  s: 'var(--gold)',
  w: 'var(--blue)',
  m: 'var(--red)',
};

const bar = (left: number, width: number, deg: number): CSSProperties => ({
  left,
  top: 7.75,
  width,
  height: 2.5,
  background: 'currentColor',
  transform: `rotate(${deg}deg)`,
});

const PARTS: Record<SeasonKey, CSSProperties[]> = {
  s: [
    bar(0, 18, 0),
    bar(0, 18, 90),
    bar(2, 14, 45),
    bar(2, 14, 135),
    { left: 4, top: 4, width: 10, height: 10, borderRadius: '50%', background: 'currentColor' },
  ],
  w: [
    bar(0, 18, 90),
    bar(0, 18, 30),
    bar(0, 18, 150),
    { left: 6.5, top: 6.5, width: 5, height: 5, transform: 'rotate(45deg)', background: 'currentColor' },
  ],
  m: [
    { left: 7.75, top: 7, width: 2.5, height: 11, background: 'currentColor' },
    { left: 1, top: 4, width: 8, height: 6, borderRadius: '0 100% 0 100%', background: 'currentColor' },
    { left: 9, top: 1, width: 8, height: 6, borderRadius: '100% 0 100% 0', background: 'currentColor' },
  ],
};

export interface SeasonIconProps {
  season: SeasonKey;
  size?: number;
  mono?: boolean;
  className?: string;
}

export default function SeasonIcon({ season, size = 18, mono = false, className }: SeasonIconProps) {
  return (
    <span
      className={className}
      aria-hidden="true"
      style={{ position: 'relative', display: 'block', flex: 'none', width: size, height: size, color: mono ? undefined : SEASON_COLOUR[season] }}
    >
      <span style={{ position: 'absolute', left: 0, top: 0, width: 18, height: 18, transform: `scale(${size / 18})`, transformOrigin: '0 0' }}>
        {PARTS[season].map((s, i) => (
          <i key={i} style={{ position: 'absolute', display: 'block', ...s }} />
        ))}
      </span>
    </span>
  );
}
