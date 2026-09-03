/**
 * Stat — the figure tile. Geometry is `design/specs/components-data.md` §1 (`24:5`), a plain
 * COMPONENT with no variant set; `screen-dashboard.md` §2b measures three of them in the hero row.
 *
 * The tile is hug x hug. 120 x 63 is only what the master happens to measure with its default
 * `Focus minutes` caption (TRAP 13 — never pin either), and 63 is the one number that is load
 * bearing: `12 + 25 + 2 + 12 + 12 = 63`. Show Delta drops a 14-tall node into the 25-tall value
 * row at BASELINE, so turning the delta on cannot grow the row and therefore cannot grow the tile
 * (TRAP 11). Everything about the value row exists to protect that.
 *
 * The delta is uncoloured on purpose (`--ink-2`): the system ships no success/danger token, so
 * direction is carried by the string — `+6`, `−48m vs last` (U+2212 MINUS SIGN, not a hyphen),
 * `↑6`. Never tint it (TRAP 12).
 *
 * Supersedes, in `src/styles/app.css`: `.stat` / `.stat b` / `.stat small` / `.stat small svg`,
 * `button.stat` and its `:hover` / `:disabled`, and `.kv` / `.kv b` / `.kv small` — nine call
 * sites, being DashboardView's two `.kv` hero tiles, its mapped trio of `button.stat` mark tiles
 * and its three library `.stat` figures, plus SetupView's three index `.stat` figures.
 */

export interface StatProps {
  /** The figure, pre-formatted by the caller: `1,284`, `4h 12m`, `68%`, `—`. `Mono/Stat` 19. */
  value: React.ReactNode;
  /** Stored lower case; `.t-label-stat` uppercases it, exactly as `textCase UPPER` does in Figma. */
  caption: React.ReactNode;
  /** The trend, beside the figure on its baseline. `Mono/Small` 11, `--ink-2`, never tinted. */
  delta?: React.ReactNode;
  /**
   * Show the delta. Defaults to "there is one". The master's `Show Delta = false` exists because a
   * Figma TEXT prop cannot be empty and so always carries the `+6` placeholder; in code an absent
   * delta is simply absent. Pass `false` to suppress a delta you do have.
   */
  showDelta?: boolean;
  /** Glyph before the caption, e.g. `<Icon name="check" />`. Sized to 12 in Stat.css. */
  icon?: React.ReactNode;
  /** Given, the tile renders as a real `<button>` — the dashboard's mark tiles filter the library. */
  onClick?: () => void;
  /** Dims the tile and blocks the click, for a mark set with nothing in it. */
  disabled?: boolean;
  /** Native tooltip; the mark tiles use it to say why they are dead. */
  title?: string;
  className?: string;
}

export default function Stat({
  value,
  caption,
  delta,
  showDelta,
  icon,
  onClick,
  disabled,
  title,
  className,
}: StatProps) {
  const cls = className ? `stat-tile ${className}` : 'stat-tile';

  // Every element is a <span>: a <button>'s content model is phrasing content, so the same markup
  // has to be legal inside both branches below.
  const body = (
    <>
      <span className="stat-row">
        <span className="stat-value t-mono-stat">{value}</span>
        {(showDelta ?? Boolean(delta)) && <span className="stat-delta t-mono-small">{delta}</span>}
      </span>
      <span className="stat-caption t-label-stat">
        {icon}
        {caption}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} disabled={disabled} title={title}>
        {body}
      </button>
    );
  }

  // No handler, so no button: a static figure must not take a tab stop. `aria-disabled` still
  // carries the dimmed state for a tile whose figure is unavailable ("difficulty not built yet").
  return (
    <div className={cls} title={title} aria-disabled={disabled || undefined}>
      {body}
    </div>
  );
}
