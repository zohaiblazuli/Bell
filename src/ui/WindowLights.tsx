/**
 * macOS-idiom window controls: three discs, glyphs revealed on hover of the cluster.
 *
 * Geometry is `design/specs/components-data.md` §8 (`41:46`), corroborated by every screen that
 * places the instance — sidebar `44:7`, reader `194:734`, bookmarks `181:433` — all of which
 * report 62 x 16, gap 9, padding 1, three 14px discs at radius 7:
 *
 *     62 = 3x14 disc + 2x9 gap + 2x1 padding        16 = 14 + 2x1 padding
 *
 * That is Apple's **Standard** metric, and 14 is forced by the box: 11px discs cannot add up to
 * 62 at these gaps. `.lights` in `src/styles/app.css` ships 11px discs at 7px gaps — Apple's
 * *Utility* (small-window) metric, 47 wide — so adopting the spec grows each disc by 3px and the
 * cluster from 47 to 62. The old rule also carried the sidebar's placement inside its own
 * `padding: 2px 8px 12px`; this component is exactly the 62 x 16 frame, so that offset has to move
 * onto the sidebar, which the spec places at (12, 14) with `brand` following at y 34.
 *
 * Nothing is wired: `onClose` / `onMinimize` / `onZoom` are the caller's window calls (the old
 * component reached for `getCurrentWindow()` itself). `inactive` is the unfocused window
 * (`Window=No`): it greys all three discs and suppresses the glyphs even under the cursor, which
 * is spec TRAP 15 — hovering an unfocused window must not reveal them.
 *
 * The three colours are mode-invariant, because macOS keeps them constant. Nothing here retones in
 * Night, so the old `[data-tone='night'] .lights button { opacity: .92 }` dimming is gone.
 */

/** The component box, for callers doing titlebar layout maths. */
export const WINDOW_LIGHTS_BOX = { w: 62, h: 16 } as const;

/**
 * The glyphs. The spec ships them as flattened 7 x 7 exports (`41:15` close, `41:18` minimize,
 * `41:21` zoom arrows) without dumping their geometry, so they are drawn here inside that 7 x 7
 * box at macOS's proportions: 3.8-long strokes for the x and the bar, and two 3.8-leg triangles
 * pointing at opposite corners for zoom. Stroke weight is set in the CSS rather than inherited,
 * because the global sprite rule's 1.75 is measured against a 24 box and lands at 0.5px in a 7 box.
 *
 * The triangles set `fill` and `stroke: none` explicitly, or the global `svg { fill: none;
 * stroke: currentColor }` rule would draw them as invisible outlines.
 */
const GLYPH_CLOSE = <path d="M1.6 1.6 5.4 5.4M5.4 1.6 1.6 5.4" />;
const GLYPH_MINIMIZE = <path d="M1.1 3.5H5.9" />;
const GLYPH_ZOOM = (
  <>
    <path d="M0.8 0.8H4.6L0.8 4.6Z" fill="currentColor" stroke="none" />
    <path d="M6.2 6.2H2.4L6.2 2.4Z" fill="currentColor" stroke="none" />
  </>
);

function Light({
  kind,
  label,
  onClick,
  children,
}: {
  kind: 'close' | 'minimize' | 'zoom';
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className={`wl wl-${kind}`} aria-label={label} onClick={onClick}>
      <svg viewBox="0 0 7 7" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

export interface WindowLightsProps {
  onClose: () => void;
  onMinimize: () => void;
  /** macOS calls it zoom; on this app it is the caller's maximise toggle. */
  onZoom: () => void;
  /** The window has lost focus: all three discs go `--traffic-inactive`, and hover reveals nothing. */
  inactive?: boolean;
  className?: string;
}

export default function WindowLights({
  onClose,
  onMinimize,
  onZoom,
  inactive,
  className,
}: WindowLightsProps) {
  return (
    <div
      className={className ? `wlights ${className}` : 'wlights'}
      data-inactive={inactive || undefined}
    >
      <Light kind="close" label="Close" onClick={onClose}>
        {GLYPH_CLOSE}
      </Light>
      <Light kind="minimize" label="Minimise" onClick={onMinimize}>
        {GLYPH_MINIMIZE}
      </Light>
      <Light kind="zoom" label="Zoom" onClick={onZoom}>
        {GLYPH_ZOOM}
      </Light>
    </div>
  );
}
