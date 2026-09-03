/**
 * The CAIE subject glyphs — Figma set `47:81`, geometry from `design/specs/icons-paths.md`.
 *
 * Unlike the UI icons these are **not** in the sprite. The set has 17 glyphs used at six sizes
 * (14 / 16 / 18 / 20 / 22 / 28, measured across the sidebar, library rows, cards, the onboarding
 * grid and three dashboard tables), and any one screen draws a handful of subjects — inlining the
 * glyph a row needs beats shipping 17 symbols into every window.
 *
 * Paint follows `color` at the use site, as every glyph in the app does. The set's own default is
 * `--ink-2`, but the file tints this same component three ways: the sidebar rows and the Paper Card
 * use the subject's hashed iris tint (mode-invariant), the Recent rows plain `--ink-2`
 * (`screen-bookmarks-recent.md` note 7). So the component sets no colour of its own.
 *
 * `size` is applied as an inline style as well as width/height attributes, because app.css sizes
 * icons through descendant rules (`.chip svg`, `.btn svg`, `.card-meta svg`, `.nav svg` …) and a
 * stylesheet rule beats a presentation attribute — the prop would otherwise be silently ignored
 * wherever one of those rules reaches.
 *
 * Keyed by **syllabus code, never by name**. Cambridge issues the same subject under a different
 * code at every level (Mathematics is 9709 / 0580 / 4024, and Additional Mathematics 0606 is a
 * syllabus of its own with its own glyph), so a name-keyed map would need the level as well — and
 * the app's rows carry the code. Codes are from `~/.bell-ref/caie-catalogue.md`; the 9–1 variants
 * (0970–0995, 7156–7184, UK centres only) are in because the index keys off whatever code the
 * filename carries.
 */

/** The 17 glyphs, named as Figma's `Subject` variants are. */
export type SubjectGlyph =
  | 'accounting'
  | 'biology'
  | 'business'
  | 'chemistry'
  | 'computing'
  | 'economics'
  | 'maths'
  | 'further-maths'
  | 'add-maths'
  | 'physics'
  | 'psychology'
  | 'english'
  | 'ict'
  | 'global'
  | 'islamiyat'
  | 'pakistan'
  | 'urdu';

/**
 * Syllabus code -> glyph. Anything absent falls back to the `doc` page glyph (Icon `17:93`), which
 * is why this does not have to cover all ~200 syllabuses: an unmapped paper reads as "a paper"
 * instead of as the wrong subject. Three groups are app judgement calls rather than Figma pairings,
 * marked APP — for each of them the alternative was the blank page.
 */
export const SUBJECT_GLYPH_BY_CODE: Readonly<Record<string, SubjectGlyph>> = {
  // Accounting — A 9706 · IGCSE 0452 (9–1 0985) · O 7707
  '9706': 'accounting', '0452': 'accounting', '0985': 'accounting', '7707': 'accounting',
  // Biology — A 9700 · IGCSE 0610 (0970) · O 5090
  '9700': 'biology', '0610': 'biology', '0970': 'biology', '5090': 'biology',
  // Business — A 9609 · IGCSE 0450 (0986), renamed 0264 (0774) from 2027 · O 7115, 7081 from 2027.
  // Both generations are here: the archive keeps papers under the legacy codes for good.
  '9609': 'business', '0450': 'business', '0986': 'business', '0264': 'business',
  '0774': 'business', '7115': 'business', '7081': 'business',
  // Chemistry — A 9701 · IGCSE 0620 (0971) · O 5070
  '9701': 'chemistry', '0620': 'chemistry', '0971': 'chemistry', '5070': 'chemistry',
  // Computer Science — A 9618 · IGCSE 0478 (0984) · O 2210. IT/ICT is its own glyph, below.
  '9618': 'computing', '0478': 'computing', '0984': 'computing', '2210': 'computing',
  // Economics — A 9708 · IGCSE 0455 (0987) · O 2281
  '9708': 'economics', '0455': 'economics', '0987': 'economics', '2281': 'economics',
  // Mathematics — A 9709 · IGCSE 0580 (0980), International 0607 · O 4024 (Syllabus D).
  // APP: Statistics 0479 / 4040 lands here too — at A Level it is a component inside 9709.
  '9709': 'maths', '0580': 'maths', '0980': 'maths', '0607': 'maths', '4024': 'maths',
  '0479': 'maths', '4040': 'maths',
  // Further Mathematics — A 9231 only; there is no lower-level equivalent.
  '9231': 'further-maths',
  // Additional Mathematics — IGCSE 0606 · O 4037. Its own radical glyph, not the compass.
  '0606': 'add-maths', '4037': 'add-maths',
  // Physics — A 9702 · IGCSE 0625 (0972) · O 5054.
  // APP: the multi-science syllabuses have no glyph of their own and the atom is the most generic
  // science mark in the set — Combined 0653 / 5129, Co-ordinated Sciences 0654 (0973),
  // Physical Science 0652.
  '9702': 'physics', '0625': 'physics', '0972': 'physics', '5054': 'physics',
  '0653': 'physics', '5129': 'physics', '0654': 'physics', '0973': 'physics', '0652': 'physics',
  // Psychology — A 9990 · IGCSE 0266 (first assessment 2027)
  '9990': 'psychology', '0266': 'psychology',
  // English, all of it — the glyph is four text rules, so it serves language and literature alike.
  // A 9093 Language · 8021 General Paper · 8695 Lang & Lit (AS) · 9695 Literature
  '9093': 'english', '8021': 'english', '8695': 'english', '9695': 'english',
  // IGCSE 0500 First Language (0990) · 0510 / 0511 ESL (0993 / 0991) · 0465 Core ESL ·
  // 0475 Literature (0992) · 0472 EAL (0772) · O 1123 Language · 2010 Literature
  '0500': 'english', '0990': 'english', '0510': 'english', '0993': 'english',
  '0511': 'english', '0991': 'english', '0465': 'english', '0475': 'english',
  '0992': 'english', '0472': 'english', '0772': 'english', '1123': 'english', '2010': 'english',
  // IT / ICT — A 9626 Information Technology · IGCSE 0417 ICT (0983). Cambridge renames it by
  // level; both are the monitor glyph, never the chip.
  '9626': 'ict', '0417': 'ict', '0983': 'ict',
  // Global Perspectives — A 9239 (& Research) · IGCSE 0457 · O 2069.
  // APP: Geography 9696 / 0460 (0976) / 2217 shares the globe; nothing else in the set fits it.
  '9239': 'global', '0457': 'global', '2069': 'global',
  '9696': 'global', '0460': 'global', '0976': 'global', '2217': 'global',
  // Islamiyat / Islamic Studies — IGCSE 0493 · O 2058 · A 9488 · O 2068
  '0493': 'islamiyat', '2058': 'islamiyat', '9488': 'islamiyat', '2068': 'islamiyat',
  // Pakistan Studies — IGCSE 0448 · O 2059
  '0448': 'pakistan', '2059': 'pakistan',
  // Urdu — A 9686 / 9866 / 8686 · IGCSE 0539 (2nd language) · O 3247 (first) / 3248 (2nd).
  // The speech bubble stays Urdu's: every other language syllabus takes the page rather than a
  // glyph whose name would then lie.
  '9686': 'urdu', '9866': 'urdu', '8686': 'urdu', '0539': 'urdu', '3247': 'urdu', '3248': 'urdu',
};

/** One drawn element. `solid` marks a fill-only shape, which must opt out of the global stroke. */
interface Vector {
  readonly d: string;
  readonly solid?: boolean;
}

/**
 * Geometry, verbatim from `icons-paths.md` in draw order — 3 dp, translated out of the sheet's cell
 * offset, which is lossless because the offsets are whole pixels. Bare paths inherit
 * `fill: none; stroke: currentColor; stroke-width: 1.75; round/round` from the global `svg` rule.
 */
const GLYPHS: Readonly<Record<SubjectGlyph | 'doc', readonly Vector[]>> = {
  // balance scales: post, beam, two pans, base
  accounting: [
    { d: 'M12 5.5V19' },
    { d: 'M4.5 8.5H19.5' },
    { d: 'M4.5 8.5L2.2 13.5H6.8L4.5 8.5Z' },
    { d: 'M19.5 8.5L17.2 13.5H21.8L19.5 8.5Z' },
    { d: 'M8.5 19H15.5' },
  ],
  biology: [
    { d: 'M5 19.5C5 11.5 9.5 5.8 19 5.2C19.6 13.8 14.4 19 5 19.5Z' },
    { d: 'M19 5.2L8.6 15.6' },
  ],
  business: [
    { d: 'M18.5 7.5H5.5C4.395 7.5 3.5 8.3954 3.5 9.5V17.5C3.5 18.6046 4.395 19.5 5.5 19.5H18.5C19.605 19.5 20.5 18.6046 20.5 17.5V9.5C20.5 8.3954 19.605 7.5 18.5 7.5Z' },
    { d: 'M9 7.5V6C9 5.6022 9.158 5.2206 9.439 4.9393C9.721 4.658 10.102 4.5 10.5 4.5H13.5C13.898 4.5 14.279 4.658 14.561 4.9393C14.842 5.2206 15 5.6022 15 6V7.5' },
    { d: 'M3.5 12.5H20.5' },
  ],
  chemistry: [
    { d: 'M9 3.5H15' },
    { d: 'M10 3.5V8.5L5.2 18.6C5.073 18.8193 5.007 19.0691 5.011 19.3227C5.015 19.5763 5.087 19.8241 5.22 20.0397C5.354 20.2554 5.543 20.4307 5.769 20.547C5.994 20.6633 6.247 20.7162 6.5 20.7H17.5C17.753 20.7162 18.006 20.6633 18.231 20.547C18.457 20.4307 18.646 20.2554 18.78 20.0397C18.913 19.8241 18.985 19.5763 18.989 19.3227C18.993 19.0691 18.927 18.8193 18.8 18.6L14 8.5V3.5' },
    { d: 'M7.4 14.5H16.6' },
  ],
  // chip square + all 8 legs as one path
  computing: [
    { d: 'M15 7.5H9C8.172 7.5 7.5 8.1716 7.5 9V15C7.5 15.8284 8.172 16.5 9 16.5H15C15.828 16.5 16.5 15.8284 16.5 15V9C16.5 8.1716 15.828 7.5 15 7.5Z' },
    { d: 'M10.5 4V7.5M13.5 4V7.5M10.5 16.5V20M13.5 16.5V20M4 10.5H7.5M4 13.5H7.5M16.5 10.5H20M16.5 13.5H20' },
  ],
  economics: [
    { d: 'M4 4V20H20' },
    { d: 'M7.5 15.5L11 11L14 13.6L18.5 7.5' },
    { d: 'M15.4 7.5H19V11.1' },
  ],
  // compass: head r 1.6, two legs, crossbar
  maths: [
    { d: 'M12 7.7C12.8837 7.7 13.6 6.9837 13.6 6.1C13.6 5.2163 12.8837 4.5 12 4.5C11.1163 4.5 10.4 5.2163 10.4 6.1C10.4 6.9837 11.1163 7.7 12 7.7Z' },
    { d: 'M11.1 7.6L6.4 19.6' },
    { d: 'M12.9 7.6L17.6 19.6' },
    { d: 'M8.7 14.2H15.3' },
  ],
  'further-maths': [{ d: 'M17 5.5H7L13 12L7 18.5H17' }],
  'add-maths': [{ d: 'M3.5 12.6H6.5L9.5 19.2L14.5 5H20.5' }],
  // nucleus r 1.7 first, then the two orbits over it — the set's only fill-only element
  physics: [
    { d: 'M12 13.7C12.939 13.7 13.7 12.9389 13.7 12C13.7 11.0611 12.939 10.3 12 10.3C11.061 10.3 10.3 11.0611 10.3 12C10.3 12.9389 11.061 13.7 12 13.7Z', solid: true },
    { d: 'M12 15.9C16.86 15.9 20.8 14.1539 20.8 12C20.8 9.8461 16.86 8.1 12 8.1C7.14 8.1 3.2 9.8461 3.2 12C3.2 14.1539 7.14 15.9 12 15.9Z' },
    { d: 'M8.622 13.95C11.053 18.159 14.535 20.698 16.4 19.621C18.265 18.5441 17.808 14.259 15.377 10.05C12.947 5.841 9.465 3.302 7.6 4.379C5.735 5.4559 6.192 9.741 8.622 13.95Z' },
  ],
  psychology: [
    { d: 'M12 4.5V19.5' },
    { d: 'M7 8V11.6C7 12.9261 7.527 14.1979 8.464 15.1355C9.402 16.0732 10.674 16.6 12 16.6C13.326 16.6 14.598 16.0732 15.536 15.1355C16.473 14.1979 17 12.9261 17 11.6V8' },
    { d: 'M9 19.5H15' },
  ],
  english: [{ d: 'M4.5 6.5H19.5M4.5 10.5H19.5M4.5 14.5H15.5M4.5 18.5H11.5' }],
  ict: [
    { d: 'M18.7 4.5H5.3C4.3059 4.5 3.5 5.306 3.5 6.3V13.7C3.5 14.694 4.3059 15.5 5.3 15.5H18.7C19.6941 15.5 20.5 14.694 20.5 13.7V6.3C20.5 5.306 19.6941 4.5 18.7 4.5Z' },
    { d: 'M12 15.5V19.5' },
    { d: 'M9 19.5H15' },
  ],
  global: [
    { d: 'M12 20.2C16.5287 20.2 20.2 16.529 20.2 12C20.2 7.471 16.5287 3.8 12 3.8C7.4713 3.8 3.8 7.471 3.8 12C3.8 16.529 7.4713 20.2 12 20.2Z' },
    { d: 'M3.8 12H20.2' },
    { d: 'M12 3.8C14.4 6.1 15.6 8.9 15.6 12C15.6 15.1 14.4 17.9 12 20.2C9.6 17.9 8.4 15.1 8.4 12C8.4 8.9 9.6 6.1 12 3.8Z' },
  ],
  islamiyat: [
    { d: 'M15.6 3.9C14.203 3.321 12.673 3.141 11.179 3.377C9.685 3.614 8.286 4.26 7.137 5.242C5.987 6.224 5.131 7.506 4.664 8.944C4.197 10.382 4.137 11.922 4.49 13.392C4.844 14.863 5.597 16.207 6.666 17.276C7.736 18.345 9.08 19.098 10.551 19.45C12.022 19.803 13.561 19.742 14.999 19.274C16.437 18.807 17.718 17.95 18.7 16.8C17.156 16.822 15.651 16.318 14.432 15.371C13.213 14.424 12.353 13.091 11.992 11.59C11.631 10.089 11.792 8.51 12.448 7.112C13.103 5.715 14.215 4.582 15.6 3.9Z' },
  ],
  pakistan: [
    { d: 'M9 4.5L3.5 7V19.5L9 17L15 19.5L20.5 17V4.5L15 7L9 4.5Z' },
    { d: 'M9 4.5V17M15 7V19.5' },
  ],
  urdu: [
    { d: 'M20 12.4C20 16.3 16.4 19.4 12 19.4C10.8 19.4 9.7 19.2 8.7 18.8L4 20.5L5.3 17.1C4.273 15.761 3.807 14.076 4 12.4C4 8.5 7.6 5.4 12 5.4C16.4 5.4 20 8.5 20 12.4Z' },
    { d: 'M8.5 10.8H15.5M8.5 14H13' },
  ],
  /* The fallback, and the one glyph here that is not from set 47:81: Icon `17:93` (`i-doc`, page +
     dog-ear), copied rather than `<use href="#i-doc">`d so this component stays standalone — the
     Subject set is not in the sprite and a reader should not have to know that one of its 18
     outcomes secretly needs the sprite mounted. */
  doc: [
    { d: 'M6 3H14L18 7V20C18 20.265 17.895 20.52 17.707 20.707C17.52 20.895 17.265 21 17 21H6C5.735 21 5.48 20.895 5.293 20.707C5.105 20.52 5 20.265 5 20V4C5 3.735 5.105 3.48 5.293 3.293C5.48 3.105 5.735 3 6 3Z' },
    { d: 'M14 3V7H18' },
  ],
};

export interface SubjectIconProps {
  /** Cambridge syllabus code as the index carries it — `9709`, `0580`, `2058`. */
  code: string;
  /** Box in px. Measured instances: 14, 16 (sidebar and library rows), 18, 20, 22, 28. */
  size?: number;
  className?: string;
}

export default function SubjectIcon({ code, size = 16, className }: SubjectIconProps) {
  /* Codes reach the frontend as strings from the Rust index, which keeps the leading zero of an
     IGCSE syllabus. Pad anyway: a three-character code means a zero was lost to a numeric
     round-trip somewhere upstream, and `580` should still draw the compass, not the page. */
  const glyph = SUBJECT_GLYPH_BY_CODE[code.trim().padStart(4, '0')] ?? 'doc';

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {GLYPHS[glyph].map((v, i) => (
        <path
          key={i}
          d={v.d}
          fill={v.solid ? 'currentColor' : undefined}
          stroke={v.solid ? 'none' : undefined}
        />
      ))}
    </svg>
  );
}
