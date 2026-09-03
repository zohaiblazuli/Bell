/**
 * The three exam-series badges — Figma set `102:15`, geometry from `design/specs/icons-paths.md`.
 *
 * Structurally unlike the other two icon sets, which is why it is its own component: each glyph is
 * a rounded-square **badge** (18.25 x 18.25 at 2.875, `rx 5.125`, 1.75 stroke) carrying a gradient
 * fill *and* a gradient stroke, with a gradient-stroked **mark** inside it at a thinner weight —
 * 1.6 for May/June's rays, 1.5 for the other two. Nothing here takes `currentColor`.
 *
 * **The one place in the component layer with raw hex.** `get_variable_defs` on `102:15` returns
 * `{}`: these nine colours are unbound in Figma, so there is no token to read and the badges are
 * mode-invariant by design — a light amber/blue/green badge on the Night ground is the drawing, not
 * a bug to "fix" (`icons.md` TRAPS). Keeping them here rather than in a stylesheet keeps the
 * component correct the moment it is imported; if the token generator ever emits `season/*`, swap
 * this table for `var(--season-…)` and nothing else changes. Note the chips that *hold* these
 * badges use a different, also-unbound green/teal/blue ramp (the `Season/…` Wash and Edge
 * paint styles in `foundations.md`) — do not reuse these values there.
 *
 * Gradient ids are per instance (`useId`), because three badges sit side by side in the session
 * chip row and duplicate ids in one document would all resolve to whichever came first.
 */
import { useId } from 'react';

/** What the app's data carries: the session-code letter, not Figma's variant name. */
export type SeasonKey = 's' | 'w' | 'm';

/**
 * First character of a session code (`s15`) or a bare letter, if it is one of the three series.
 * `PaperRow.season` and `scode` are plain strings, so a call site has no literal type to hand.
 */
export function seasonKeyOf(value: string | null | undefined): SeasonKey | null {
  const c = value?.trim().charAt(0).toLowerCase();
  return c === 's' || c === 'w' || c === 'm' ? c : null;
}

/** `x1 y1 x2 y2` of a `userSpaceOnUse` gradient in the local 24-box. */
type Extent = readonly [number, number, number, number];

/** The disc is a filled circle; every other mark is a stroked path at its own weight. */
type Mark =
  | { readonly kind: 'disc'; readonly extent: Extent }
  | { readonly kind: 'stroke'; readonly d: string; readonly width: number; readonly extent: Extent };

interface SeasonSpec {
  /** Badge fill, stops at 0 / 1 on the 2,2 -> 22,22 diagonal. */
  readonly wash: readonly [string, string];
  /** Badge edge and every mark share one triple, stops at 0 / 0.55 / 1. */
  readonly ramp: readonly [string, string, string];
  readonly marks: readonly Mark[];
}

const SEASONS: Readonly<Record<SeasonKey, SeasonSpec>> = {
  // s = may-june, Figma 102:6 — amber. Sun: disc r 3.1 filled, then 8 rays at 1.6 on a wider gradient.
  s: {
    wash: ['var(--season-s-wash-0)', 'var(--season-s-wash-1)'],
    ramp: ['var(--season-s-mark-0)', 'var(--season-s-mark-1)', 'var(--season-s-mark-2)'],
    marks: [
      { kind: 'disc', extent: [8.9, 8.9, 15.1, 15.1] },
      {
        kind: 'stroke',
        width: 1.6,
        extent: [4.9, 4.9, 19.1, 19.1],
        d: 'M16.5 12H19.1M7.5 12H4.9M12 16.5V19.1M12 7.5V4.9M15.182 8.818L17.02 6.98M8.818 8.818L6.98 6.98M15.182 15.182L17.02 17.02M8.818 15.182L6.98 17.02',
      },
    ],
  },
  // w = oct-nov, Figma 102:10 — blue. Snowflake, one path at 1.5.
  w: {
    wash: ['var(--season-w-wash-0)', 'var(--season-w-wash-1)'],
    ramp: ['var(--season-w-mark-0)', 'var(--season-w-mark-1)', 'var(--season-w-mark-2)'],
    marks: [
      {
        kind: 'stroke',
        width: 1.5,
        extent: [5.598, 5.909, 17.7649, 18.6971],
        d: 'M12 12H18.3M12 12L15.15 17.456M12 12L8.85 17.456M12 12H5.7M12 12L8.85 6.544M12 12L15.15 6.544M16.802 13.093L15.5 12L16.802 10.907M18.402 13.093L17.1 12L18.402 10.907M13.455 16.705L13.75 15.031L15.347 15.613M14.255 18.091L14.55 16.417L16.147 16.998M8.653 15.613L10.25 15.031L10.545 16.705M7.853 16.998L9.45 16.417L9.745 18.091M7.198 10.907L8.5 12L7.198 13.093M5.598 10.907L6.9 12L5.598 13.093M10.545 7.295L10.25 8.969L8.653 8.387M9.745 5.909L9.45 7.583L7.853 7.002M15.347 8.387L13.75 8.969L13.455 7.295M16.147 7.002L14.55 7.583L14.255 5.909',
      },
    ],
  },
  // m = feb-march, Figma 102:14 — green. Sprout: stem plus two leaves, one path at 1.5.
  m: {
    wash: ['var(--season-m-wash-0)', 'var(--season-m-wash-1)'],
    ramp: ['var(--season-m-mark-0)', 'var(--season-m-mark-1)', 'var(--season-m-mark-2)'],
    marks: [
      {
        kind: 'stroke',
        width: 1.5,
        extent: [7.596, 7.3, 16.976, 16.0889],
        d: 'M12 16.7V10.7M12 11.7C9.4 11.9 7.5 10 7.6 7.3C10.2 7.5 12 9.2 12 11.7ZM12 11.7C14.6 11.9 16.5 10 16.4 7.3C13.8 7.5 12 9.2 12 11.7Z',
      },
    ],
  },
};

export interface SeasonIconProps {
  /** Session-code letter: `s` May/June, `w` Oct/Nov, `m` Feb/March. See `seasonKeyOf`. */
  season: SeasonKey;
  /** Box in px. Every measured instance in the file is 18 — chips, rows and the setup choices. */
  size?: number;
  className?: string;
}

export default function SeasonIcon({ season, size = 18, className }: SeasonIconProps) {
  const spec = SEASONS[season];
  /* Strip React's punctuation (`:r0:`) so the value is safe in a `url(#…)` and in a selector. The
     counter survives, so instances stay distinct. */
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <defs>
        {/* Badge fill and badge edge both run the 2,2 -> 22,22 diagonal. */}
        <linearGradient
          id={`${uid}-wash`}
          x1="2"
          y1="2"
          x2="22"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={spec.wash[0]} />
          <stop offset="1" stopColor={spec.wash[1]} />
        </linearGradient>
        <linearGradient
          id={`${uid}-edge`}
          x1="2"
          y1="2"
          x2="22"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={spec.ramp[0]} />
          <stop offset="0.55" stopColor={spec.ramp[1]} />
          <stop offset="1" stopColor={spec.ramp[2]} />
        </linearGradient>
        {spec.marks.map((m, i) => (
          <linearGradient
            key={i}
            id={`${uid}-mark-${i}`}
            x1={m.extent[0]}
            y1={m.extent[1]}
            x2={m.extent[2]}
            y2={m.extent[3]}
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor={spec.ramp[0]} />
            <stop offset="0.55" stopColor={spec.ramp[1]} />
            <stop offset="1" stopColor={spec.ramp[2]} />
          </linearGradient>
        ))}
      </defs>

      <rect
        x="2.875"
        y="2.875"
        width="18.25"
        height="18.25"
        rx="5.125"
        fill={`url(#${uid}-wash)`}
        stroke={`url(#${uid}-edge)`}
        strokeWidth="1.75"
      />
      {spec.marks.map((m, i) =>
        m.kind === 'disc' ? (
          <circle key={i} cx="12" cy="12" r="3.1" fill={`url(#${uid}-mark-${i})`} stroke="none" />
        ) : (
          <path
            key={i}
            d={m.d}
            fill="none"
            stroke={`url(#${uid}-mark-${i})`}
            strokeWidth={m.width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )
      )}
    </svg>
  );
}
