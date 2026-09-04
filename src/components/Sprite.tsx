/**
 * One icon set, inlined once as an SVG sprite — and the brand-line gradient every live
 * element strokes itself with.
 */
export default function Sprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {/* The brand line — Figma's `Blue/Line 90`. Stops read the tokens rather than
            repeating hex, so this stays in step with --grad-line and inverts nothing.
            The id is still `iris`: the name is inherited and now lies (every stop is blue),
            but Figma's variables are still called iris/*, so the two stay greppable. */}
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
        <symbol id="i-lib" viewBox="0 0 24 24">
          <path d="M12 6.5C10 5 6.5 5 4.5 6.2V19c2-1.2 5.5-1.2 7.5.3" />
          <path d="M12 6.5C14 5 17.5 5 19.5 6.2V19c-2-1.2-5.5-1.2-7.5.3" />
        </symbol>
        <symbol id="i-dash" viewBox="0 0 24 24">
          <rect x="3.5" y="3.5" width="7" height="9" rx="1.4" />
          <rect x="13.5" y="3.5" width="7" height="5.5" rx="1.4" />
          <rect x="13.5" y="12" width="7" height="8.5" rx="1.4" />
          <rect x="3.5" y="15.5" width="7" height="5" rx="1.4" />
        </symbol>
        <symbol id="i-bm" viewBox="0 0 24 24">
          <path d="M6.5 4.5h11a1 1 0 0 1 1 1V20l-6.5-4.2L5.5 20V5.5a1 1 0 0 1 1-1z" />
        </symbol>
        <symbol id="i-clock" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8.2" />
          <path d="M12 7.6V12l3 1.8" />
        </symbol>
        <symbol id="i-search" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" />
          <path d="M20.5 20.5 16.4 16.4" />
        </symbol>
        <symbol id="i-sliders" viewBox="0 0 24 24">
          <path d="M4 8h16M4 16h16" />
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
          <path d="M9 6h11M9 12h11M9 18h11" />
          <circle cx="4.5" cy="6" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="18" r="1.1" fill="currentColor" stroke="none" />
        </symbol>
        <symbol id="i-left" viewBox="0 0 24 24">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </symbol>
        <symbol id="i-chev" viewBox="0 0 24 24">
          <path d="M6 9.5l6 6 6-6" />
        </symbol>
        <symbol id="i-pen" viewBox="0 0 24 24">
          <path d="M12 20h9" />
          <path d="M16.5 3.6a2.1 2.1 0 0 1 3 3L7.2 18.9 3 20l1.1-4.2z" />
        </symbol>
        <symbol id="i-hl" viewBox="0 0 24 24">
          <path d="M15 4.5l4.5 4.5-8.5 8.5H6.5v-4.5z" />
          <path d="M5 21h7" />
        </symbol>
        <symbol id="i-eraser" viewBox="0 0 24 24">
          <path d="M4.5 15.2 12.8 6.9a2 2 0 0 1 2.8 0l3 3a2 2 0 0 1 0 2.8L12.3 19H8z" />
          <path d="M8.5 11l5 5" />
          <path d="M6 19.2h13" />
        </symbol>
        <symbol id="i-zin" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" />
          <path d="M20.5 20.5 16.4 16.4M11 8.4v5.2M8.4 11h5.2" />
        </symbol>
        <symbol id="i-zout" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" />
          <path d="M20.5 20.5 16.4 16.4M8.4 11h5.2" />
        </symbol>
        <symbol id="i-check" viewBox="0 0 24 24">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </symbol>
        <symbol id="i-checkc" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8.4" />
          <path d="M8.4 12.2l2.4 2.4 4.6-4.8" />
        </symbol>
        <symbol id="i-x" viewBox="0 0 24 24">
          <path d="M6 6l12 12M18 6 6 18" />
        </symbol>
        <symbol id="i-focus" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8.4" />
          <circle cx="12" cy="12" r="3.4" />
        </symbol>
        <symbol id="i-book" viewBox="0 0 24 24">
          <path d="M5 4.5h11a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2z" />
          <path d="M18 16H7a2 2 0 0 0-2 2" />
        </symbol>
        <symbol id="i-ret" viewBox="0 0 24 24">
          <path d="M9 10 5 14l4 4" />
          <path d="M5 14h11a3 3 0 0 0 3-3V6" />
        </symbol>
        <symbol id="i-doc" viewBox="0 0 24 24">
          <path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
          <path d="M14 3v4h4" />
        </symbol>
        <symbol id="i-folder" viewBox="0 0 24 24">
          <path d="M3.5 7.5a1 1 0 0 1 1-1h4l2 2.5h8a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1h-14a1 1 0 0 1-1-1z" />
        </symbol>
        <symbol id="i-sync" viewBox="0 0 24 24">
          <path d="M20 12a8 8 0 1 1-2.4-5.7" />
          <path d="M20 4.5V10h-5.5" />
        </symbol>
        <symbol id="i-warn" viewBox="0 0 24 24">
          <path d="M12 4.5 21 19.5H3z" />
          <path d="M12 10v4.2" />
          <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
        </symbol>
        <symbol id="i-min" viewBox="0 0 24 24">
          <path d="M5 12h14" strokeWidth="2.6" />
        </symbol>
        <symbol id="i-max" viewBox="0 0 24 24">
          <rect x="5.5" y="5.5" width="13" height="13" rx="2" strokeWidth="2.4" />
        </symbol>
        {/* sun `163:2` / moon `163:5` — added to the design system after the first port, which is
            why TonePill and Settings each inlined their own copy of these two paths. The rays keep
            the spec's `butt` cap: it is the one cap in the set that is not round, and rounding it
            would lengthen every ray by half a stroke at each end. */}
        <symbol id="i-sun" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3.125" />
          <path
            d="M18.2 12H21.4M16.384 16.384L18.647 18.647M12 18.2V21.4M7.616 16.384L5.353 18.647M5.8 12H2.6M7.616 7.616L5.353 5.353M12 5.8V2.6M16.384 7.616L18.647 5.353"
            strokeLinecap="butt"
          />
        </symbol>
        <symbol id="i-moon" viewBox="0 0 24 24">
          <path d="M20.983 12.77C20.566 17.516 16.517 21.118 11.755 20.979C6.993 20.84 3.161 17.009 3.021 12.247C2.881 7.485 6.484 3.434 11.23 3.017C9.191 5.797 9.485 9.639 11.923 12.077C14.361 14.515 18.199 14.809 20.981 12.772L20.983 12.77Z" />
        </symbol>

        {/* The 14 Notebooks glyphs — `screen-notebooks.md` §10, geometry from `icons-paths.md`.
            Sheet order continues from `moon`: `pencil` fills row 4's one empty cell, then rows 5
            and 6. Ported verbatim, so these carry Figma's bezier circles rather than the `<circle>`
            / `<rect>` primitives the first 29 were rewritten with. `plus`, `right`, `pan`, `ruler`
            and `trash` each pack several subpaths into one `d` — left packed, as exported. */}
        <symbol id="i-pencil" viewBox="0 0 24 24">
          <path d="M17.2 3.8L20.2 6.8L10 17L5.2 18.8L7 14L17.2 3.8Z" />
          <path d="M7 14L10 17" />
          <path d="M14.4 6.6L17.4 9.6" />
        </symbol>
        <symbol id="i-lasso" viewBox="0 0 24 24">
          <path d="M12 15.5C16.694 15.5 20.5 13.038 20.5 10C20.5 6.962 16.694 4.5 12 4.5C7.306 4.5 3.5 6.962 3.5 10C3.5 13.038 7.306 15.5 12 15.5Z" />
          <path d="M7.8 14.9C7.6 17 8.4 18.6 9.8 19.4" />
          <path d="M10.6 21.8C11.373 21.8 12 21.173 12 20.4C12 19.627 11.373 19 10.6 19C9.827 19 9.2 19.627 9.2 20.4C9.2 21.173 9.827 21.8 10.6 21.8Z" />
        </symbol>
        <symbol id="i-shapes" viewBox="0 0 24 24">
          <path d="M12.9 3.5H5.1C4.216 3.5 3.5 4.216 3.5 5.1V12.9C3.5 13.784 4.216 14.5 5.1 14.5H12.9C13.784 14.5 14.5 13.784 14.5 12.9V5.1C14.5 4.216 13.784 3.5 12.9 3.5Z" />
          <path d="M15.4 20.5C18.217 20.5 20.5 18.217 20.5 15.4C20.5 12.583 18.217 10.3 15.4 10.3C12.583 10.3 10.3 12.583 10.3 15.4C10.3 18.217 12.583 20.5 15.4 20.5Z" />
        </symbol>
        <symbol id="i-text" viewBox="0 0 24 24">
          <path d="M5.5 5.5H18.5" />
          <path d="M12 5.5V18.5" />
          <path d="M9 18.5H15" />
        </symbol>
        <symbol id="i-image" viewBox="0 0 24 24">
          <path d="M18.6 4.6H5.4C4.185 4.6 3.2 5.585 3.2 6.8V17.2C3.2 18.415 4.185 19.4 5.4 19.4H18.6C19.815 19.4 20.8 18.415 20.8 17.2V6.8C20.8 5.585 19.815 4.6 18.6 4.6Z" />
          <path d="M9 11.7C9.939 11.7 10.7 10.939 10.7 10C10.7 9.061 9.939 8.3 9 8.3C8.061 8.3 7.3 9.061 7.3 10C7.3 10.939 8.061 11.7 9 11.7Z" />
          <path d="M4 17.6L9.6 12L14.6 16.4L17.2 14.2L20 16.8" />
        </symbol>
        <symbol id="i-clip" viewBox="0 0 24 24">
          <path d="M7.5 3V15.5C7.5 16.3 8.2 17 9 17H21" />
          <path d="M3 7.5H15C15.8 7.5 16.5 8.2 16.5 9V21" />
        </symbol>
        <symbol id="i-sticky" viewBox="0 0 24 24">
          <path d="M4.5 4.5H19.5V14.5L14.5 19.5H4.5V4.5Z" />
          <path d="M19.5 14.5H14.5V19.5" />
          <path d="M8 9H16" />
          <path d="M8 12.2H13" />
        </symbol>
        <symbol id="i-ruler" viewBox="0 0 24 24">
          <path d="M2.06 18.06L18.06 2.06L21.95 5.95L5.95 21.95L2.06 18.06Z" />
          <path d="M5.24 14.88L6.65 16.29M8.42 11.7L9.83 13.11M11.61 8.51L13.02 9.92M14.79 5.33L16.2 6.74" />
        </symbol>
        <symbol id="i-pan" viewBox="0 0 24 24">
          <path d="M12 3.2V20.8M3.2 12H20.8" />
          <path d="M9.6 5.8L12 3.2L14.4 5.8M9.6 18.2L12 20.8L14.4 18.2M5.8 9.6L3.2 12L5.8 14.4M18.2 9.6L20.8 12L18.2 14.4" />
        </symbol>
        <symbol id="i-plus" viewBox="0 0 24 24">
          <path d="M12 5V19M5 12H19" />
        </symbol>
        <symbol id="i-trash" viewBox="0 0 24 24">
          <path d="M4.5 7.5H19.5" />
          <path d="M9.5 7.5V4.8C9.5 4.3 9.9 3.9 10.4 3.9H13.6C14.1 3.9 14.5 4.3 14.5 4.8V7.5" />
          <path d="M6.6 7.5L7.5 19.6C7.6 20.3 8.2 20.9 8.9 20.9H15.1C15.8 20.9 16.4 20.3 16.5 19.6L17.4 7.5" />
          <path d="M10.4 11.4V17M13.6 11.4V17" />
        </symbol>
        {/* the only solid glyph in the batch — three discs r 1.5, each carrying its own paint so it
            survives the global `svg{}` rule rather than rendering as an invisible outline */}
        <symbol id="i-dots" viewBox="0 0 24 24">
          <path d="M5.6 13.5C6.428 13.5 7.1 12.828 7.1 12C7.1 11.172 6.428 10.5 5.6 10.5C4.772 10.5 4.1 11.172 4.1 12C4.1 12.828 4.772 13.5 5.6 13.5Z" fill="currentColor" stroke="none" />
          <path d="M12 13.5C12.828 13.5 13.5 12.828 13.5 12C13.5 11.172 12.828 10.5 12 10.5C11.172 10.5 10.5 11.172 10.5 12C10.5 12.828 11.172 13.5 12 13.5Z" fill="currentColor" stroke="none" />
          <path d="M18.4 13.5C19.228 13.5 19.9 12.828 19.9 12C19.9 11.172 19.228 10.5 18.4 10.5C17.572 10.5 16.9 11.172 16.9 12C16.9 12.828 17.572 13.5 18.4 13.5Z" fill="currentColor" stroke="none" />
        </symbol>
        {/* a MIRRORED `ret`, not a 180-degree rotation — rotating it puts the hook above the shaft */}
        <symbol id="i-redo" viewBox="0 0 24 24">
          <path d="M15 10L19 14L15 18" />
          <path d="M19 14H8C7.204 14 6.441 13.684 5.879 13.121C5.316 12.559 5 11.796 5 11V6" />
        </symbol>
        <symbol id="i-right" viewBox="0 0 24 24">
          <path d="M5 12H19M12 5L19 12L12 19" />
        </symbol>
      </g>

      <g>
        <symbol id="i-play" viewBox="0 0 24 24">
          <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
        </symbol>
        <symbol id="i-pause" viewBox="0 0 24 24">
          <rect x="7" y="5.5" width="3.4" height="13" rx="1" fill="currentColor" />
          <rect x="13.6" y="5.5" width="3.4" height="13" rx="1" fill="currentColor" />
        </symbol>
      </g>
    </svg>
  );
}
