/**
 * The whole UI icon set, inlined once as an SVG sprite — plus the brand-line gradient every live
 * element strokes itself with. Geometry is `design/specs/icons-paths.md` (set `17:119`), the
 * contract around it `design/specs/icons.md`.
 *
 * Mount it once, at the app root, above everything that draws an icon. Consumers clone a glyph:
 *
 *     <svg className="…" aria-hidden="true"><use href="#i-check" /></svg>
 *
 * **The `<g>` below is documentation, not paint.** A `<use>` clone inherits presentation from the
 * *use site*, never from the ancestors the symbol was authored under, so this wrapper cannot reach
 * a rendered icon — it only records the defaults every glyph assumes. The rule that actually
 * paints them lives in `src/styles/index.css`:
 *
 *     svg { fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round;
 *           stroke-linejoin: round }
 *
 * That is also why a solid shape inside a glyph must carry `fill="currentColor" stroke="none"` on
 * the element itself: without it the global rule renders it as an invisible outline.
 *
 * 31 glyphs, ordered as the Figma documentation sheet reads (rows of 8, `icons.md` §Sheet layout),
 * so this file can be diffed against the sheet by eye. `sun` `163:2` and `moon` `163:5` are the
 * two the first port missed — they were added to the design system afterwards, and the tone pill
 * needs them at 16px.
 *
 * Where Figma exports a bezier approximation of a circle or a rounded rect, this keeps the
 * primitive (`icons.md` parity note 3): shorter, and exactly circular. Every radius and box below
 * is the measured one — clock r 8.2, checkc / focus r 8.4, search / zin / zout r 7 at (11,11),
 * sliders knobs r 2.4, list bullets r 1.1, warn dot r 0.9, dash panels r 1.4, grid 7x7 r 1.6,
 * max 13x13 r 2 at (5.5,5.5), pause bars 3.4x13 r 1.
 *
 * Nothing renders at 24. Real sizes are 14–18px, so the effective stroke is 1.02–1.31px; 1.75 is
 * a nominal authoring weight.
 */

/** Every glyph in the sprite. Sheet order: 8 per row, `icons.md` §Sheet layout. */
export type IconName =
  | 'lib'
  | 'dash'
  | 'bm'
  | 'clock'
  | 'search'
  | 'sliders'
  | 'grid'
  | 'list'
  | 'left'
  | 'chev'
  | 'pen'
  | 'hl'
  | 'eraser'
  | 'zin'
  | 'zout'
  | 'check'
  | 'checkc'
  | 'x'
  | 'focus'
  | 'book'
  | 'ret'
  | 'doc'
  | 'folder'
  | 'sync'
  | 'warn'
  | 'min'
  | 'max'
  | 'play'
  | 'pause'
  | 'sun'
  | 'moon';

export default function Sprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {/* The brand line — Figma's `Blue/Line 90`. Stops read the tokens rather than repeating
            hex, so this stays in step with --grad-line and inverts nothing. The id is still
            `iris`: the name is inherited and now lies (every stop is blue), but Figma's variables
            are still called iris/*, so the two stay greppable. It is also a collision hazard —
            never merge this sprite into another SVG that defines an `iris` gradient. */}
        <linearGradient id="iris" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--bell-cap-hi)" />
          <stop offset=".33" stopColor="var(--bell-cap-mid)" />
          <stop offset=".67" stopColor="var(--bell-cap-lo)" />
          <stop offset="1" stopColor="var(--bell-cap-deep)" />
        </linearGradient>
      </defs>

      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* row 1 */}
        <symbol id="i-lib" viewBox="0 0 24 24">
          <path d="M12 6.5C10 5 6.5 5 4.5 6.2V19C6.5 17.8 10 17.8 12 19.3" />
          <path d="M12 6.5C14 5 17.5 5 19.5 6.2V19C17.5 17.8 14 17.8 12 19.3" />
        </symbol>
        <symbol id="i-dash" viewBox="0 0 24 24">
          <rect x="3.5" y="3.5" width="7" height="9" rx="1.4" />
          <rect x="13.5" y="3.5" width="7" height="5.5" rx="1.4" />
          <rect x="13.5" y="12" width="7" height="8.5" rx="1.4" />
          <rect x="3.5" y="15.5" width="7" height="5" rx="1.4" />
        </symbol>
        {/* consumers fill this for the bookmarked state — `.card .bm.on svg { fill: currentColor }` */}
        <symbol id="i-bm" viewBox="0 0 24 24">
          <path d="M6.5 4.5H17.5C17.765 4.5 18.02 4.6054 18.207 4.7929C18.395 4.9804 18.5 5.2348 18.5 5.5V20L12 15.8L5.5 20V5.5C5.5 5.2348 5.605 4.9804 5.793 4.7929C5.98 4.6054 6.235 4.5 6.5 4.5Z" />
        </symbol>
        <symbol id="i-clock" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8.2" />
          <path d="M12 7.6V12L15 13.8" />
        </symbol>
        <symbol id="i-search" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" />
          <path d="M20.5 20.5L16.4 16.4" />
        </symbol>
        <symbol id="i-sliders" viewBox="0 0 24 24">
          <path d="M4 8H20M4 16H20" />
          <circle cx="15" cy="8" r="2.4" fill="currentColor" stroke="none" />
          <circle cx="9" cy="16" r="2.4" fill="currentColor" stroke="none" />
        </symbol>
        <symbol id="i-grid" viewBox="0 0 24 24">
          <rect x="4" y="4" width="7" height="7" rx="1.6" />
          <rect x="13" y="4" width="7" height="7" rx="1.6" />
          <rect x="4" y="13" width="7" height="7" rx="1.6" />
          <rect x="13" y="13" width="7" height="7" rx="1.6" />
        </symbol>
        <symbol id="i-list" viewBox="0 0 24 24">
          <path d="M9 6H20M9 12H20M9 18H20" />
          <circle cx="4.5" cy="6" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="18" r="1.1" fill="currentColor" stroke="none" />
        </symbol>
        {/* row 2 */}
        <symbol id="i-left" viewBox="0 0 24 24">
          <path d="M19 12H5M12 5L5 12L12 19" />
        </symbol>
        <symbol id="i-chev" viewBox="0 0 24 24">
          <path d="M6 9.5L12 15.5L18 9.5" />
        </symbol>
        <symbol id="i-pen" viewBox="0 0 24 24">
          <path d="M12 20H21" />
          <path d="M16.5 3.6C16.898 3.2022 17.437 2.9787 18 2.9787C18.563 2.9787 19.102 3.2022 19.5 3.6C19.898 3.9978 20.121 4.5374 20.121 5.1C20.121 5.6626 19.898 6.2022 19.5 6.6L7.2 18.9L3 20L4.1 15.8L16.5 3.6Z" />
        </symbol>
        <symbol id="i-hl" viewBox="0 0 24 24">
          <path d="M15 4.5L19.5 9L11 17.5H6.5V13L15 4.5Z" />
          <path d="M5 21H12" />
        </symbol>
        <symbol id="i-eraser" viewBox="0 0 24 24">
          <path d="M4.5 15.2L12.8 6.9C13.174 6.5336 13.676 6.3283 14.2 6.3283C14.724 6.3283 15.226 6.5336 15.6 6.9L18.6 9.9C18.966 10.2739 19.172 10.7765 19.172 11.3C19.172 11.8235 18.966 12.3261 18.6 12.7L12.3 19H8L4.5 15.2Z" />
          <path d="M8.5 11L13.5 16" />
          <path d="M6 19.2H19" />
        </symbol>
        <symbol id="i-zin" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" />
          <path d="M20.5 20.5L16.4 16.4M11 8.4V13.6M8.4 11H13.6" />
        </symbol>
        <symbol id="i-zout" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" />
          <path d="M20.5 20.5L16.4 16.4M8.4 11H13.6" />
        </symbol>
        <symbol id="i-check" viewBox="0 0 24 24">
          <path d="M5 12.5L9.5 17L19 7.5" />
        </symbol>

        {/* row 3 */}
        <symbol id="i-checkc" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8.4" />
          <path d="M8.4 12.2L10.8 14.6L15.4 9.8" />
        </symbol>
        <symbol id="i-x" viewBox="0 0 24 24">
          <path d="M6 6L18 18M18 6L6 18" />
        </symbol>
        <symbol id="i-focus" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8.4" />
          <circle cx="12" cy="12" r="3.4" />
        </symbol>
        <symbol id="i-book" viewBox="0 0 24 24">
          <path d="M5 4.5H16C16.53 4.5 17.039 4.711 17.414 5.086C17.789 5.461 18 5.97 18 6.5V20H7C6.47 20 5.961 19.789 5.586 19.414C5.211 19.039 5 18.53 5 18V4.5Z" />
          <path d="M18 16H7C6.47 16 5.961 16.211 5.586 16.586C5.211 16.961 5 17.47 5 18" />
        </symbol>
        {/* ONE path, two subpaths — deliberately merged. Figma's `17:89` is two independently
            painted vectors (arrow head, hooked shaft) and the file's own consumers recolour only
            the first child, so on a Primary button the shaft keeps ink/2 and vanishes
            against the blue. One path cannot be half-recoloured. Rendering is identical: both
            subpaths are stroked, neither is filled, and round caps are per-subpath. */}
        <symbol id="i-ret" viewBox="0 0 24 24">
          <path d="M9 10L5 14L9 18M5 14H16C16.796 14 17.559 13.684 18.121 13.121C18.684 12.559 19 11.796 19 11V6" />
        </symbol>
        <symbol id="i-doc" viewBox="0 0 24 24">
          <path d="M6 3H14L18 7V20C18 20.265 17.895 20.52 17.707 20.707C17.52 20.895 17.265 21 17 21H6C5.735 21 5.48 20.895 5.293 20.707C5.105 20.52 5 20.265 5 20V4C5 3.735 5.105 3.48 5.293 3.293C5.48 3.105 5.735 3 6 3Z" />
          <path d="M14 3V7H18" />
        </symbol>
        <symbol id="i-folder" viewBox="0 0 24 24">
          <path d="M3.5 7.5C3.5 7.235 3.605 6.98 3.793 6.793C3.98 6.605 4.235 6.5 4.5 6.5H8.5L10.5 9H18.5C18.765 9 19.02 9.105 19.207 9.293C19.395 9.48 19.5 9.735 19.5 10V18.5C19.5 18.765 19.395 19.02 19.207 19.207C19.02 19.395 18.765 19.5 18.5 19.5H4.5C4.235 19.5 3.98 19.395 3.793 19.207C3.605 19.02 3.5 18.765 3.5 18.5V7.5Z" />
        </symbol>
        {/* the 300-degree arc is Figma's measured bezier, not an `a8 8 0 1 1` sweep: the gap the
            arrow head sits in is 60 degrees wide and an arc rounds it visibly at 18px */}
        <symbol id="i-sync" viewBox="0 0 24 24">
          <path d="M20 12C20.003 13.848 19.366 15.64 18.198 17.072C17.029 18.503 15.401 19.486 13.59 19.854C11.779 20.221 9.896 19.95 8.263 19.086C6.629 18.223 5.344 16.821 4.627 15.118C3.91 13.414 3.804 11.516 4.329 9.744C4.853 7.971 5.975 6.436 7.503 5.397C9.031 4.358 10.872 3.88 12.713 4.045C14.553 4.21 16.28 5.006 17.6 6.3" />
          <path d="M20 4.5V10H14.5" />
        </symbol>

        {/* row 4 */}
        <symbol id="i-warn" viewBox="0 0 24 24">
          <path d="M12 4.5L21 19.5H3L12 4.5Z" />
          <path d="M12 10V14.2" />
          <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
        </symbol>
        {/* min 2.6 and max 2.4 are deliberately heavier than the 1.75 body weight — the window
            controls have to hold their own inside a 7px traffic light. Do not normalise them. */}
        <symbol id="i-min" viewBox="0 0 24 24">
          <path d="M5 12H19" strokeWidth="2.6" />
        </symbol>
        <symbol id="i-max" viewBox="0 0 24 24">
          <rect x="5.5" y="5.5" width="13" height="13" rx="2" strokeWidth="2.4" />
        </symbol>
        {/* play / pause are the only glyphs authored with a fill. They carry no `stroke="none"`,
            so they also pick up the use site's 1.75 stroke — which is exactly Figma's paint for
            `17:114` / `17:118` (fill AND stroke), and ~0.875px of extra edge with rounded corners.
            Adding `stroke="none"` would thin them against both the file and what ships. */}
        <symbol id="i-play" viewBox="0 0 24 24">
          <path d="M8 5.5V18.5L19 12L8 5.5Z" fill="currentColor" />
        </symbol>
        <symbol id="i-pause" viewBox="0 0 24 24">
          <rect x="7" y="5.5" width="3.4" height="13" rx="1" fill="currentColor" />
          <rect x="13.6" y="5.5" width="3.4" height="13" rx="1" fill="currentColor" />
        </symbol>
        {/* Figma sets no cap on the sun's rays, i.e. butt. Left round: every other glyph in the
            file is round, the global rule supplies round anyway, and `icons.md` divergence 2 reads
            it as a Figma bug rather than intent. */}
        <symbol id="i-sun" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3.125" />
          <path d="M18.2 12H21.4M16.384 16.384L18.647 18.647M12 18.2V21.4M7.616 16.384L5.353 18.647M5.8 12H2.6M7.616 7.616L5.353 5.353M12 5.8V2.6M16.384 7.616L18.647 5.353" />
        </symbol>
        <symbol id="i-moon" viewBox="0 0 24 24">
          <path d="M20.983 12.77C20.566 17.516 16.517 21.118 11.755 20.979C6.993 20.84 3.161 17.009 3.021 12.247C2.881 7.485 6.484 3.434 11.23 3.017C9.191 5.797 9.485 9.639 11.923 12.077C14.361 14.515 18.199 14.809 20.981 12.772L20.983 12.77Z" />
        </symbol>
      </g>
    </svg>
  );
}
