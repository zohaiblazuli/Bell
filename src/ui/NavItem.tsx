/**
 * Nav Item — the sidebar's primary rows. Spec: `design/specs/components-data.md` §4 (`25:24`),
 * with the sidebar's own numbers in `screen-library-settings.md` §3.1 and
 * `screen-bookmarks-recent.md` §3.
 *
 * Figma ships three variants on one axis, `State = Default | Hover | Active`. Hover is a CSS
 * `:hover`, so Active is the only axis that becomes a prop — and it is the only variant that
 * draws the 3x17 gradient indicator out in the sidebar's left gutter.
 *
 * The master is 220 FIXED, but every instance in the file is resized to 214 — the sidebar's inner
 * width (238 - 2x12). TRAP 8 says never hard-code a resized master, so the row stretches and
 * lands on 214 in the sidebar it was drawn for.
 */
import type { ReactNode } from 'react';

export interface NavItemProps {
  /** The 18px glyph, e.g. `<Icon name="lib" />`. Figma models it as an INSTANCE_SWAP. */
  icon: ReactNode;
  label: string;
  /**
   * Already formatted, exactly as Figma stores it (`13,447`). Thousands separators stay the call
   * site's job, because `Count` is a TEXT property over there, not a number.
   */
  count?: string | number;
  /** Figma's `Show Count` BOOLEAN. Nothing renders when `count` is absent either way. */
  showCount?: boolean;
  /** The screen this row leads to is the one on show: accent ink plus the gutter indicator. */
  active?: boolean;
  disabled?: boolean;
  /** Native tooltip — how the two empty rows explain themselves ("Bookmark a paper and…"). */
  title?: string;
  onClick?: () => void;
}

export default function NavItem({
  icon,
  label,
  count,
  showCount = true,
  active = false,
  disabled = false,
  title,
  onClick,
}: NavItemProps) {
  // Active is read off `aria-current` in the CSS rather than a parallel `.active` class, so the
  // painted state and the announced state cannot drift apart.
  return (
    <button
      type="button"
      className="nav-item"
      aria-current={active ? 'page' : undefined}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      <span className="nav-item__icon">{icon}</span>
      <span className="nav-item__label t-body-nav">{label}</span>
      {showCount && count != null && <span className="nav-item__count">{count}</span>}
    </button>
  );
}
