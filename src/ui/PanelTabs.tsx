/**
 * Panel Tabs — `design/specs/components-controls.md` §6a, set `618:24`. 232 x 30, one axis
 * `Selected = 1 | 2 | 3`, and three TEXT properties: "Tool" / "Pages" / "Notebook".
 *
 * It exists because `SegmentedControl` cannot carry words. That set bakes its grid / list / dash
 * glyphs into its variants and exposes no text property at all (§10 trap 5), which is also why
 * Onboarding step 04 fell back to Chips. The boxes differ too — pad 3 not 4, `--glass-strong` not
 * `--hair-2`, a `--card` selected segment, and no separators — so this is a sibling, not a variant.
 *
 * It is the inspector's first child, 232 x 30 at (18,18) in `screen-notebooks.md` §6.
 *
 * The three segments are FILL, not HUG (§10): a longer label truncates rather than widening the
 * pill, and three short words is the design budget. `tabs` is typed as a 2- or 3-tuple rather than
 * `string[]` for the same reason `SegmentedControl` types its items that way — a fourth segment is
 * not a variant of this component.
 *
 * Real `<button>`s in the ARIA tabs pattern: one tab stop for the whole strip, arrows to move.
 * `aria-selected` is also the CSS hook, so the painted state and the announced state cannot drift
 * apart — the same trick `NavItem` plays with `aria-current`. `aria-controls` is deliberately not
 * wired: the panel these tabs switch is the rest of the inspector column, which the call site owns,
 * and it is a recommendation rather than a requirement of the pattern.
 */
import { useRef } from 'react';
import type { KeyboardEvent } from 'react';

/** Two or three. The set ships three; two is the same box with 113px segments. */
export type PanelTabsLabels = readonly [string, string] | readonly [string, string, string];

export interface PanelTabsProps {
  tabs: PanelTabsLabels;
  /** 0-based. Figma's `Selected` axis is 1-based, so `Selected=2` is `selected={1}`. */
  selected: number;
  onSelect: (index: number) => void;
  /** Accessible name for the strip as a whole, e.g. "Inspector". */
  label?: string;
  className?: string;
}

export default function PanelTabs({
  tabs,
  selected,
  onSelect,
  label,
  className,
}: PanelTabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Left/Right move the selection *and* the focus, which is what the roving tabindex below is for.
  // Home/End come along because they are expected wherever arrows work, and they wrap because a
  // three-item strip has no useful "end".
  const move = (to: number) => {
    const next = (to + tabs.length) % tabs.length;
    onSelect(next);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') move(selected + 1);
    else if (e.key === 'ArrowLeft') move(selected - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(tabs.length - 1);
    else return;
    e.preventDefault();
    // AND stopped, not merely defaulted. `preventDefault` does nothing to a listener further up, and the
    // notebook screen turns the page on Left/Right from `window` — so one arrow moved the tab and the
    // spread at once. The arrows belong to a tablist; saying so here is what keeps that true wherever
    // this is mounted.
    e.stopPropagation();
  };

  return (
    <div
      className={['panel-tabs', className].filter(Boolean).join(' ')}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {tabs.map((tab, i) => (
        <button
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          className="panel-tabs__tab"
          aria-selected={selected === i}
          tabIndex={selected === i ? 0 : -1}
          onClick={() => onSelect(i)}
        >
          {/* The label is its own element so it can truncate: `text-overflow` needs a block
              container, and the button is a flex box to centre it. `NavItem` splits its label the
              same way. Body/Nav is named, never re-derived. */}
          <span className="panel-tabs__label t-body-nav">{tab}</span>
        </button>
      ))}
    </div>
  );
}
