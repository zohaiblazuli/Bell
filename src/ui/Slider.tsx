/**
 * Slider — `design/specs/components-controls.md` §6b, COMPONENT `613:3`. 232 x 20, no variants.
 *
 * New in the Notebooks pass, because the design system had no slider at all: the Reader fakes one
 * with `Meter`, which is a display bar with no knob and no drag affordance (§10 — the two look
 * alike and are deliberately not interchangeable). Being draggable is the entire reason this
 * component exists, so it is a real control rather than a div with a pointer handler.
 *
 * **A native `<input type="range">` carries the design.** Figma models the value as `layoutGrow` on
 * a `done` / `rest` pair — the file's meter idiom — with the 14px knob pinned to `done`'s MAX edge.
 * That is a paint split, not a structure worth reproducing in the DOM: the filled part is a
 * hard-stop gradient on `::-webkit-slider-runnable-track` and the knob is `::-webkit-slider-thumb`,
 * which the platform already positions, captures the pointer for, and drives from the arrow keys and
 * Home/End — plus it lands in the accessibility tree as a real `slider` with a value. This webview
 * is Chromium (WebView2), so the `-webkit-` pseudo-elements are the right and only ones needed.
 * The one place the native control and the file disagree is the knob's travel — see Slider.css.
 *
 * `value` is a fraction on the default 0..1 range, matching `Meter`'s `0.61`-not-`61`; pass `min` /
 * `max` and it becomes whatever range you named. Announcement is the call site's: a bare 0..1 reads
 * out as "0.4", so where the row prints a percentage — the STROKE card's Opacity "100%" and
 * Smoothing "40%" (`screen-notebooks.md` §6a) — pass `aria-valuetext={`${pct}%`}` as well. Nothing
 * is generated here, because a fabricated format would contradict the visible readout.
 */
import type { CSSProperties, ComponentPropsWithoutRef } from 'react';

export interface SliderProps
  extends Omit<
    ComponentPropsWithoutRef<'input'>,
    'value' | 'defaultValue' | 'onChange' | 'type' | 'min' | 'max' | 'step' | 'children'
  > {
  /** Position within `min`..`max`. On the default range that is a fraction: `0.4`, not `40`. */
  value: number;
  /** Fires with the new number, not the event — as `Switch` and `SegmentedControl` do. */
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /**
   * Accessible name, the same prop `Switch`, `IconButton` and `Meter` take. The control is
   * unlabelled on its own; the STROKE row's visible "Opacity" is a sibling cell, not part of it.
   * An explicit `aria-label` wins if a call site passes both.
   */
  label?: string;
}

export default function Slider({
  value,
  onChange,
  min = 0,
  max = 1,
  step,
  label,
  className,
  style,
  ...rest
}: SliderProps) {
  const span = max - min || 1;
  // `--value` is the fraction the CSS needs, clamped, so an out-of-range prop cannot paint a fill
  // wider than the track. The browser clamps the thumb the same way.
  const fraction = Math.min(1, Math.max(0, (value - min) / span));

  return (
    <input
      type="range"
      className={['bell-slider', className].filter(Boolean).join(' ')}
      min={min}
      max={max}
      /* HTML's default step is 1, which on the default 0..1 range would make this a two-position
         switch rather than a slider. One percent of whatever range the call site set is the useful
         default and it is what both measured rows want — Opacity "100%", Smoothing "40%". */
      step={step ?? span / 100}
      value={value}
      /* Derived attributes sit before the spread so an explicit prop always wins, the way
         IconButton does it. */
      aria-label={label}
      {...rest}
      onChange={(e) => onChange(e.currentTarget.valueAsNumber)}
      style={{ ...style, '--value': fraction } as CSSProperties}
    />
  );
}
