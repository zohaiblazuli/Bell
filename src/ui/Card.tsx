/**
 * Card — the content surface. Measured off `design/specs/screen-dashboard.md` (§7a resume card,
 * §7b subject progress, §8a due for review, §8b session coverage, §3 year activity) and
 * `design/specs/screen-library-settings.md` §6.2 (the Settings grouped list).
 *
 * `--card` fill, 1px `--card-brd`, radius `--r-card`, and **no shadow**. The missing shadow is the
 * design, not an omission: elevation on these screens comes from the `page recess` scrim sitting
 * behind the whole content region (library/settings §2 z5; dashboard §9), so a per-card shadow
 * would count it twice. screen-dashboard TRAP 21 is explicit — "Nothing in the content region has
 * a shadow, cards included." The Library `Paper Card` is the one surface that does carry
 * `Shadow/Card/*`, and it is its own component.
 *
 * Two modes:
 *  - default   a padded surface; `padding` picks a measured inset or takes a raw px number.
 *  - `rows`    the Settings grouped list: padding 0, gap 0, clip on. Each CardRow then supplies
 *              its own 11/16, which is the only reason the `--hair-2` dividers run full-bleed.
 *
 * Radius is `var(--r-card)` throughout. Figma binds it inconsistently — `hero`, `due for review`
 * and `year activity` use a literal 13 while everything else binds `radius/card` (dashboard
 * TRAP 4) — but every one of them renders 13, so the token is the right thing to ship.
 */
import type { ReactNode } from 'react';

/**
 * The insets Figma actually authors on a card, named after the surface each was measured on:
 *
 *  `card`      16 all round — resume card `185:85`, year activity `495:2009`
 *  `list`      6 / 16       — subject progress `186:95`, due for review `184:97`. The 6 pairs with
 *                             each list row's own 8, so the first row's content sits 14 off the
 *                             top edge while the row separators still reach the full inner width.
 *  `coverage`  10 / 16      — session coverage `187:115`
 *  `none`      0            — the Settings grouped-list card `534:382`; what `rows` forces
 *
 * The Stat tile's 12/14 (`24:5`, dashboard §2b) is deliberately absent: Stat is its own component
 * and owns that padding.
 */
export type CardInset = 'none' | 'card' | 'list' | 'coverage';

export interface CardProps {
  /** A measured inset, or a px number for a one-off. Ignored when `rows` is set. */
  padding?: number | CardInset;
  /** Grouped-list mode — the card becomes a bare clipped surface and CardRow carries the padding. */
  rows?: boolean;
  className?: string;
  children?: ReactNode;
}

export default function Card({ padding = 'card', rows = false, className, children }: CardProps) {
  // `rows` wins outright over `padding`. §6.2: "The card holds zero padding and zero gap; every
  // row supplies its own 11 / 16." Letting a padding through here would inset every divider.
  const inset = rows ? 'none' : typeof padding === 'string' ? padding : undefined;

  return (
    <div
      className={className ? `bell-card ${className}` : 'bell-card'}
      data-inset={inset}
      data-rows={rows ? '' : undefined}
      style={!rows && typeof padding === 'number' ? { padding } : undefined}
    >
      {children}
    </div>
  );
}
