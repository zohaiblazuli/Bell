import { Fragment } from 'react';
import Icon, { type IconName } from '@/components/Icon';

/**
 * The segmented control — `design/specs/components-controls.md` §3, set `42:111`.
 *
 * Figma bakes its glyphs into the variants (Segment 1 = `grid`, 2 = `list`, 3 = `dash`) with no
 * INSTANCE_SWAP property, so they are unreachable through the component API (§10 trap 5) — which
 * is why Onboarding step 04 builds its own row out of Chips rather than use the control at all.
 * Ours takes them as props, so a screen with different glyphs can use the component instead of
 * working around it.
 *
 * The box is verbatim: padding 4, gap 0, 30 x 28 segments, a 3 x 20 separator between them. Every
 * child is fixed, so the container hugs to the file's 71 (two segments) / 104 (three) x 36 without
 * anything here hard-coding a width.
 *
 * Selection is `aria-pressed` on real buttons inside a labelled group, not radio semantics: radios
 * would need a roving tabindex and arrow-key handling to be correct, and for a two- or three-item
 * view toggle every segment being tabbable is the better behaviour.
 */

export interface SegmentedItem {
  /** Glyph from the sprite. Figma's own three are `grid`, `list` and `dash`. */
  icon: IconName;
  /** Accessible name for the segment — it is icon-only, so this is its only label. */
  label: string;
}

/**
 * Two or three, matching the file: the `Segments` axis is `2 | 3` and its grid is sparse —
 * `Segments=2, Selected=3` does not exist (§10 trap 6). A fourth segment is not a variant.
 */
export type SegmentedItems =
  | readonly [SegmentedItem, SegmentedItem]
  | readonly [SegmentedItem, SegmentedItem, SegmentedItem];

export interface SegmentedControlProps {
  items: SegmentedItems;
  /** 0-based index into `items`. Figma's `Selected` axis is 1-based, so `Selected=2` is `value={1}`. */
  value: number;
  onChange: (value: number) => void;
  /** Accessible name for the group as a whole, e.g. "View". */
  label?: string;
  className?: string;
}

export default function SegmentedControl({
  items,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps) {
  return (
    <div className={`bell-seg${className ? ` ${className}` : ''}`} role="group" aria-label={label}>
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && (
            /* A separator neighbouring the selection hides, but keeps its 3px of layout — see the
               CSS. `data-visible` carries that rather than a conditional render for the same
               reason: the box must measure 71 / 104 whatever is selected. */
            <span
              className="bell-seg-sep"
              aria-hidden="true"
              data-visible={value !== i - 1 && value !== i}
            />
          )}
          <button
            type="button"
            className="bell-seg-item"
            aria-label={item.label}
            aria-pressed={value === i}
            onClick={() => onChange(i)}
          >
            <Icon name={item.icon} />
          </button>
        </Fragment>
      ))}
    </div>
  );
}
