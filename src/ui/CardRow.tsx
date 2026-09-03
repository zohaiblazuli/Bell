/**
 * CardRow — one row of the Settings grouped list. Measured off
 * `design/specs/screen-library-settings.md` §6.2, with the roster of real rows in §6.3 / §6.4.
 *
 * A label stack on the left, a control on the right, `padding 11 / 16`, SPACE_BETWEEN and
 * centre-aligned. Rows are siblings inside a `<Card rows>`; the `--hair-2` divider between two of
 * them is drawn by CSS on the second of the pair, so it is full-bleed and the last row needs no
 * special case. Both facts hang off the card holding zero padding — see Card.tsx.
 *
 * `label` is optional on purpose. Three rows in the file have no label at all (`535:432`,
 * `537:554`, `538:464`, spec TRAP 13): a `Body/Meta` `--ink-3` string sits in the label slot
 * instead, which is exactly what `helper` alone renders. `538:464` has no control either.
 *
 * `label` and `helper` are nodes rather than strings because the file overrides their type in
 * three places: the Papers folder helper `535:401` is `Mono/Small` (a path, not prose), the About
 * row `538:455` pairs a `Body/Strong` label with a `Mono/Small` helper. Wrap those at the call
 * site — `helper={<span className="t-mono-small">~/Documents/Bell/Papers</span>}` — and the inner
 * class wins over the ramp class this component applies.
 *
 * Row height is never set. 11 + 16 + 11 = 38 without a helper and 11 + 16 + 2 + 13 + 11 = 53 with
 * one, and those numbers fall out of `line-height: normal` on the ramp classes. Pinning a height
 * would break the moment a helper wraps in the 411px column.
 *
 * `onClick` turns the row into a real `<button>` — the Session length row `536:417` is the case,
 * where the whole row opens a picker. Do **not** combine it with a control that is itself
 * interactive (Switch, Button): that nests one button inside another. Rows whose control is a
 * Button — Choose… `535:405`, Re-index `535:435`, Clear cache `537:557`, Release notes `538:459` —
 * leave `onClick` off and let the button own the click.
 */
import type { ReactNode } from 'react';

export interface CardRowProps {
  /** `Body/Default` on `--ink`. Optional — see the header note on the three label-less rows. */
  label?: ReactNode;
  /** `Body/Meta` on `--ink-3`, under the label with a 2px gap. */
  helper?: ReactNode;
  /** The control slot: Switch, chip row, Button, value + chevron, plain text — or nothing. */
  children?: ReactNode;
  /** Present → the row is a `<button>`. Omit when the control is already interactive. */
  onClick?: () => void;
  /** For the row-level deviations, e.g. the UPDATES notice slot `536:436` at padding 14 / 16. */
  className?: string;
}

export default function CardRow({ label, helper, children, onClick, className }: CardRowProps) {
  const cls = className ? `bell-card-row ${className}` : 'bell-card-row';

  const inner = (
    <>
      {(label != null || helper != null) && (
        <span className="bell-card-row-text">
          {label != null && <span className="bell-card-row-label t-body-default">{label}</span>}
          {helper != null && <span className="bell-card-row-helper t-body-meta">{helper}</span>}
        </span>
      )}
      {children != null && <span className="bell-card-row-control">{children}</span>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}
