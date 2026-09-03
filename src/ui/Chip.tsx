/**
 * Chip — the filter pill. Figma set `21:20`, 21 variants, measured in
 * `design/specs/components-controls.md` §2; the palette paints in `foundations.md` §5 / §8.
 *
 * 21 variants, 13 distinct pictures. `State` is `Default | Hover | Filled` and **Default ignores
 * `Palette` entirely** (spec TRAP 1) — all seven Default cells are pixel-identical. So `palette`
 * and `filled` are props while Hover is plain `:hover`: the palette only ever surfaces on the
 * hover ring and on the Filled wash.
 *
 * One box for all 21: 32 tall, 12 side padding, 7 gap, radius `--r-pill`. Width hugs at
 * `24 + Σchildren + 7 × (n − 1)` = 66 for the default "A Level" label. Icon (18), code and close
 * (14) each add themselves plus one 7px gap; none of them touches the height.
 *
 * Colour is the secondary cue. Every chip carries its text label and the palette is the tint
 * behind it, so no state here is signalled by colour alone.
 *
 * Handlers decide the DOM. One handler → the whole pill is that one button, which is how every
 * chip on screen today behaves. Two handlers need two targets, so the pill becomes a container
 * with a body button and a close button — the only shape that is valid HTML and still lets the
 * close be reached on its own.
 */
import type { ReactNode } from 'react';

/**
 * Measured geometry, for callers doing row maths (the library filter row sets an 8×1 strut
 * between two of these to open a 24px break). Chip.css owns what renders; this is the same
 * measured table, not a second source of truth.
 */
export const CHIP_BOX = {
  height: 32,
  padX: 12,
  gap: 7,
  icon: 18,
  close: 14,
  /** `"A Level"` with every boolean off — the width every screen spec derives its chips from. */
  defaultWidth: 66,
} as const;

/** Figma's `Palette` axis, lower-cased. Neutral is the default, and the only flat Filled. */
export type ChipPalette =
  | 'neutral'
  | 'a-level'
  | 'igcse'
  | 'o-level'
  | 'feb-march'
  | 'may-june'
  | 'oct-nov';

export interface ChipProps {
  /** `Label#21:12`, Body/Chip. Required: the label is the cue, the tint only supports it. */
  label: string;
  /** `Code#21:13`, Mono/Small. A syllabus code (`9706`) or a count. */
  code?: string;
  /**
   * `Show Code#21:14`. Figma defaults this false because its master carries a placeholder code;
   * here it defaults to "show what you passed", so a supplied code cannot silently vanish.
   */
  showCode?: boolean;
  palette?: ChipPalette;
  /**
   * `State=Filled` — the selected state. Leave it undefined on chips that are actions rather
   * than toggles: an explicit `true`/`false` is what turns `aria-pressed` on.
   */
  filled?: boolean;
  /** `Show Icon#109:0` + `Icon#109:13` — an 18×18 leading glyph. */
  icon?: ReactNode;
  /** Shows the 14px close glyph. Fires from the glyph when `onClick` is set too, else from the pill. */
  onClose?: () => void;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * The close glyph — `Icon / Icon=x` `17:77`, `M6 6L18 18M18 6L6 18` in the icon set's 24 box.
 * Inlined rather than taken from the sprite so the pill depends on nothing outside `src/ui`, and
 * because a 24-box glyph drawn in a 14px slot lands the spec's 1.02083 stroke by itself
 * (1.75 × 14/24 — spec §0). Paint comes from the global `svg` rule and `currentColor`.
 */
function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6L18 18M18 6L6 18" />
    </svg>
  );
}

export default function Chip({
  label,
  code,
  showCode = code != null,
  palette = 'neutral',
  filled,
  icon,
  onClose,
  onClick,
  disabled,
  className,
}: ChipProps) {
  const cls = `chip${filled ? ' filled' : ''}${className ? ` ${className}` : ''}`;

  const body = (
    <>
      {icon ? <span className="chip-icon">{icon}</span> : null}
      <span className="t-body-chip">{label}</span>
      {showCode && code != null ? <span className="chip-code t-mono-small">{code}</span> : null}
    </>
  );

  // Two actions, two targets. The body button is a real child of the pill rather than the pill
  // itself, because a <button> inside a <button> is invalid and the close has to be reachable.
  if (onClick && onClose) {
    return (
      <span className={cls} data-palette={palette} aria-disabled={disabled || undefined}>
        <button
          type="button"
          className="chip-main"
          onClick={onClick}
          disabled={disabled}
          aria-pressed={filled}
        >
          {body}
        </button>
        <button
          type="button"
          className="chip-x"
          onClick={onClose}
          disabled={disabled}
          aria-label={`Remove ${label}`}
        >
          <CloseGlyph />
        </button>
      </span>
    );
  }

  // One action: the pill is the button and the close glyph, if any, is decoration on it. The
  // accessible name becomes "Remove <label>" in that case — the visible text alone would not say
  // that pressing the chip drops the filter.
  if (onClick || onClose) {
    return (
      <button
        type="button"
        className={cls}
        data-palette={palette}
        disabled={disabled}
        onClick={onClick ?? onClose}
        aria-pressed={onClick ? filled : undefined}
        aria-label={onClose ? `Remove ${label}` : undefined}
      >
        {body}
        {onClose ? (
          <span className="chip-x">
            <CloseGlyph />
          </span>
        ) : null}
      </button>
    );
  }

  // No handler: a display chip (the onboarding session chips are exactly this). Not a button,
  // because nothing happens when you press it.
  return (
    <span className={cls} data-palette={palette} aria-disabled={disabled || undefined}>
      {body}
    </span>
  );
}
