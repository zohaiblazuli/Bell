/**
 * One icon set, inlined once as an SVG sprite — and the `iris` gradient every live
 * element strokes itself with. Ported from the approved demo.
 */
export default function Sprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <linearGradient id="iris" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6aa8ff" />
          <stop offset=".38" stopColor="#6f76f2" />
          <stop offset=".72" stopColor="#9d7bf0" />
          <stop offset="1" stopColor="#f3b7c6" />
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
