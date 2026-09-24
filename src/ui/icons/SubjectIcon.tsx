import type { CSSProperties } from 'react';
/**
 * The CAIE subject glyphs — Bell App v2's Shape Kit set: one solid geometric mark per A Level
 * syllabus, drawn from squares, circles and clipped polygons on a 26-unit grid, exactly as the
 * design's `SUBJECT_ICONS` / `ALL_ICONS` place them.
 *
 * Paint follows `color` at the use site, so the component sets no colour of its own.
 *
 * Keyed by **syllabus code, never by name**. Cambridge issues the same subject under a different
 * code at every level (Mathematics is 9709 / 0580 / 4024, and Additional Mathematics 0606 is a
 * syllabus of its own), so a name-keyed map would need the level as well — and
 * the app's rows carry the code. Codes are from `~/.bell-ref/caie-catalogue.md`; the 9–1 variants
 * (0970–0995, 7156–7184, UK centres only) are in because the index keys off whatever code the
 * filename carries.
 */

/** Subject families: how a code at any level finds its subject's A Level mark. */
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
 * Syllabus code -> subject family. Anything absent falls back to the page glyph, which is why this
 * does not have to cover all ~200 syllabuses: an unmapped paper reads as "a paper" instead of as the
 * wrong subject. Groups marked APP are app judgement calls — for each, the alternative was the page.
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

/* ── the Shape Kit marks ─────────────────────────────────────────────────────────────────────
   Each mark is a list of absolutely placed boxes on a 26 × 26 grid, ported verbatim from the
   design. `sp` is a solid box, `so` an outlined one (2.5px ink), `R` rounds a box into a circle,
   `cp` clips it to a polygon. Paint is `currentColor`, so a mark follows the colour of its row. */
type Part = CSSProperties;
const SI = 'currentColor';
const sp = (l: number, t: number, w: number, h: number, x: Part = {}): Part => ({ left: l, top: t, width: w, height: h, background: SI, ...x });
const so = (l: number, t: number, w: number, h: number, x: Part = {}): Part => ({ left: l, top: t, width: w, height: h, border: '2.5px solid ' + SI, boxSizing: 'border-box', ...x });
const R: Part = { borderRadius: '50%' };
const cp = (c: string): Part => ({ clipPath: 'polygon(' + c + ')' });
const LEAF = '78% 0,100% 14%,50% 100%,0 72%';
const STAR = '50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%';

/** A Level syllabus code -> mark. */
const MARKS: Readonly<Record<string, readonly Part[]>> = {
  '9709': [sp(2, 11, 22, 4), sp(10, 2, 6, 6, R), sp(10, 18, 6, 6, R)],
  '9702': [so(0, 8, 26, 10, { borderRadius: '50%', transform: 'rotate(-35deg)' }), so(0, 8, 26, 10, { borderRadius: '50%', transform: 'rotate(35deg)' }), sp(10, 10, 6, 6, R)],
  '9618': [so(1, 1, 24, 24), sp(6, 8, 7, 10, cp('0 0,100% 50%,0 100%,0 72%,58% 50%,0 28%')), sp(14, 15, 7, 3)],
  '9231': [sp(4, 2, 18, 22, cp('0 0,100% 0,100% 20%,36% 20%,66% 50%,36% 80%,100% 80%,100% 100%,0 100%,0 86%,38% 50%,0 14%'))],
  '9701': [sp(3, 3, 20, 21, cp('35% 0,65% 0,65% 38%,100% 100%,0 100%,35% 38%')), sp(8, 1, 10, 3)],
  '9700': [so(3, 3, 20, 20, { borderRadius: '0 18px 0 18px' }), sp(2, 11.75, 22, 2.5, { transform: 'rotate(45deg)' })],
  '9708': [so(2, 2, 22, 22, { borderWidth: '0 0 2.5px 2.5px' }), sp(6, 10.75, 17, 2.5, { transform: 'rotate(35deg)' }), sp(6, 10.75, 17, 2.5, { transform: 'rotate(-35deg)' })],
  '9609': [so(8, 3, 10, 7, { borderWidth: '2.5px 2.5px 0 2.5px' }), so(2, 8, 22, 16, { borderRadius: '2px' }), sp(2, 14.5, 22, 2.5), sp(10.5, 12.5, 5, 6)],
  '9706': [sp(2, 3, 22, 3.5), sp(11.25, 3, 3.5, 21), sp(3, 10, 6, 2.5), sp(3, 15, 6, 2.5), sp(17, 10, 6, 2.5), sp(17, 17, 6, 1.5), sp(17, 20, 6, 1.5)],
  '9093': [sp(2, 11, 10, 10, R), sp(2, 3, 10, 12, cp(LEAF)), sp(14, 11, 10, 10, R), sp(14, 3, 10, 12, cp(LEAF))],
  '9695': [sp(1, 5, 11, 17, cp('0 0,100% 18%,100% 100%,0 82%')), sp(14, 5, 11, 17, cp('0 18%,100% 0,100% 82%,0 100%'))],
  '9489': [sp(4, 1, 18, 3), sp(4, 22, 18, 3), sp(6, 4, 14, 18, cp('0 0,100% 0,57% 50%,100% 100%,0 100%,43% 50%'))],
  '9696': [so(5, 1, 16, 16, { borderWidth: '5px', borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)' }), sp(7, 23, 12, 2.5)],
  '9990': [so(4, 5, 18, 12, { borderWidth: '0 2.5px 2.5px 2.5px', borderRadius: '0 0 9px 9px' }), sp(11.75, 2, 2.5, 22)],
  '9699': [sp(1.5, 8, 6, 6, R), sp(18.5, 8, 6, 6, R), sp(0, 15, 9, 8, { borderRadius: '4.5px 4.5px 0 0' }), sp(17, 15, 9, 8, { borderRadius: '4.5px 4.5px 0 0' }), sp(9.5, 2, 7, 7, R), sp(7, 10, 12, 13, { borderRadius: '6px 6px 0 0', boxShadow: '0 0 0 2px var(--card)' })],
  '9084': [sp(11, 1, 4, 4, R), sp(11.75, 4, 2.5, 18), sp(6, 21, 14, 3), sp(2, 5, 22, 2.5), sp(5, 7, 1.5, 6), sp(19.5, 7, 1.5, 6), sp(1, 13, 10, 5, { borderRadius: '0 0 5px 5px' }), sp(15, 13, 10, 5, { borderRadius: '0 0 5px 5px' })],
  '9479': [sp(2, 2, 10, 10, R), so(14, 2, 10, 10), sp(6, 14, 14, 11, cp('50% 0,100% 100%,0 100%'))],
  '9483': [sp(1, 17, 9, 6.5, { borderRadius: '50%', transform: 'rotate(-20deg)' }), sp(14, 15, 9, 6.5, { borderRadius: '50%', transform: 'rotate(-20deg)' }), sp(7.5, 5, 2.5, 15), sp(20.5, 2.5, 2.5, 15), sp(7.5, 2, 15.5, 6.5, cp('0 46%,100% 0,100% 54%,0 100%'))],
  '9488': [sp(2, 3, 20, 20, { background: 'transparent', borderRadius: '50%', boxShadow: 'inset 6px -2px 0 0 ' + SI }), sp(15, 6, 9, 9, cp(STAR))],
  '9898': [so(2, 3, 22, 16, { borderRadius: '3px' }), sp(5, 18.5, 7, 6, cp('0 0,100% 0,0 100%')), sp(6, 7.5, 14, 2.5), sp(6, 12, 9, 2.5)],
  '9607': [so(2, 4, 22, 18, { borderRadius: '4px' }), sp(10, 8.5, 8, 9, cp('0 0,100% 50%,0 100%'))],
  '9626': [so(2, 2, 22, 15, { borderRadius: '2px' }), sp(11.5, 17, 3, 5), sp(6, 22, 14, 2.5)],
  '9239': [so(2, 2, 22, 22, R), so(8.5, 2, 9, 22, R), sp(2, 11.75, 22, 2.5)],
  '9693': [sp(1, 7, 17, 12, R), sp(15, 5, 10, 16, cp('0 50%,100% 0,78% 50%,100% 100%'))],
  '9396': [sp(10, 1, 6, 2.5), sp(11.75, 2.5, 2.5, 3.5), so(3, 5, 20, 20, R), sp(11.75, 9, 2.5, 7), sp(19.5, 5.5, 2.5, 4, { transform: 'rotate(45deg)' })],
  '9705': [sp(2, 2, 22, 22, cp('evenodd,0 0,100% 100%,0 100%,0 0,12% 32%,12% 88%,68% 88%,12% 32%,0 0'))],
  '9395': [so(2, 2, 22, 22, R), sp(9, 5, 8, 16, { ...cp('50% 0,100% 50%,50% 100%,0 50%'), transform: 'rotate(45deg)' })],
};

/**
 * IGCSE and O Level codes borrow their subject's A Level mark through the glyph family above.
 * Two are app judgement calls, marked APP: the design has no mark for them.
 */
const MARK_FOR_GLYPH: Readonly<Record<SubjectGlyph, string>> = {
  accounting: '9706', biology: '9700', business: '9609', chemistry: '9701', computing: '9618',
  economics: '9708', maths: '9709', 'further-maths': '9231', 'add-maths': '9709', physics: '9702',
  psychology: '9990', english: '9093', ict: '9626', global: '9239', islamiyat: '9488',
  pakistan: '9489', // APP: Pakistan Studies is history and geography; the hourglass reads as history
  urdu: '9898', // APP: the speech bubble is the set's language mark
};

/** The mark a syllabus code draws, or null for "a paper" — the page glyph. */
export function subjectMark(code: string): readonly Part[] | null {
  const c = code.trim().padStart(4, '0');
  if (MARKS[c]) return MARKS[c];
  const glyph = SUBJECT_GLYPH_BY_CODE[c];
  return glyph ? MARKS[MARK_FOR_GLYPH[glyph]] : null;
}

export interface SubjectIconProps {
  /** Cambridge syllabus code as the index carries it — `9709`, `0580`, `2058`. */
  code: string;
  /** Box in px. The marks are drawn at 26 and scale to any size. */
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export default function SubjectIcon({ code, size = 16, className, style }: SubjectIconProps) {
  /* Codes reach the frontend as strings from the Rust index, which keeps the leading zero of an
     IGCSE syllabus. Pad anyway: a three-character code means a zero was lost to a numeric
     round-trip somewhere upstream, and `580` should still draw the maths mark, not the page. */
  const parts = subjectMark(code);
  if (!parts) {
    // No mark: a plain page with a folded corner, so an unmapped paper reads as "a paper" rather
    // than as the wrong subject.
    return (
      <svg className={className} viewBox="0 0 26 26" width={size} height={size} style={{ width: size, height: size, flex: 'none', ...style }} aria-hidden="true">
        <path d="M5 2H16L21 7V24H5Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="miter" />
        <path d="M15 2V8H21" fill="none" stroke="currentColor" strokeWidth="2.5" />
      </svg>
    );
  }
  return (
    <span
      className={className ? `sk-subject ${className}` : 'sk-subject'}
      style={{ width: size, height: size, ...style }}
      aria-hidden="true"
    >
      <span className="sk-subject__grid" style={{ transform: `scale(${size / 26})` }}>
        {parts.map((p, i) => (
          <i key={i} style={p} />
        ))}
      </span>
    </span>
  );
}
