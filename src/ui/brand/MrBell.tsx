/**
 * Mr. Bell — the full 256px rig. Geometry is `design/specs/mr-bell.md`, measured off Figma
 * `374:77`; the group nesting and the six joint centres are also the contract in
 * `design/specs/motion-mr-bell.md` §1, which the twelve timelines animate. Only the rig is here —
 * no keyframes yet, just `data-anim` for the pass that writes them.
 *
 * Needs `@import './brand/MrBell.css'` in `src/ui/ui.css`. The fills, the stroke opt-out and the
 * overflow all live there, and without it he paints nothing and inherits the icon sprite stroke —
 * see the stroke note.
 *
 * WHY THE NESTING IS LOAD-BEARING. `body` holds the claws, shell, eyes and specs; the four leg
 * pivots are **siblings of `body`**, not children. That is the rig: the body can bob while the
 * legs stay planted. It also fixes the z-order — the legs paint in *front* of the shell, the claws
 * *behind* it (they are the first two children of `body`, the shell the third) — and both are
 * relied on. Sliding a claw inward tucks its shoulder under the shell, which is what hides the
 * specs push-up translate of (-56, -2). Do not reorder either. (spec §1, TRAPS 1; motion §7.1)
 *
 * WHY THE PIVOTS MATTER. Figma stores six empty 56-210px frames centred on the joints purely to
 * give ROTATION something to swing from. We drop the frames and put their centres on the limb
 * groups as `transform-origin` + `transform-box: view-box`. Without them a claw turns about its
 * own centre and its pincer can never reach the spectacles. (spec §2, §7)
 *
 * NEVER PUT A STROKE ON HIM. He is 39 rectangles plus 26 more in the spectacles, so a stroke
 * borders every block instead of the silhouette: the shell becomes a grid of squares and each claw
 * a ladder. If he needs edge definition the call site adds a `drop-shadow`, which the sidebar
 * placement already does. (TRAPS 12)
 *
 * NEITHER SIDE IS MIRRORED. claw R is claw L x1.0403 wide and x1.16628 tall on a different tilt;
 * legs R is x0.9259 the width of legs L; `lower legs R` sits 1px higher than L. All three
 * asymmetries are in the file, so both sides are transcribed separately — mirroring one produces a
 * visibly lighter claw. (TRAPS 2, 3)
 *
 * HE OVERFLOWS HIS BOX. `clipsContent` is false and the ink runs x -6 … 265.879, i.e. 6px left and
 * 9.879px right of the 256 viewBox (2.34% / 3.86% of `size`). The empty claw pivot frames push the
 * Figma export bbox to 324.347 wide, which is why an export looks 325 wide; no ink lives out
 * there, but nothing may clip the 16px that does. (spec §1, §7; TRAPS 16)
 */
import type { CSSProperties } from 'react';

/** The component box. Every number in this file is in these coordinates. */
export const BELL_BOX = 256;

/** Drawn pixels, not the box: 271.879 x 150 of ink with 72px of air above and 34px below. A slot
 *  sizing itself against the crab wants these, not `size`. */
export const BELL_INK = { x0: -6, y0: 72, x1: 265.879, y1: 222 } as const;

/**
 * The joints. `transform-origin` in viewBox units for each limb group (spec §2).
 *
 * `body` has no pivot frame: the Figma group box is (-29.5686, 26) 324.347 x 210, so its centre —
 * what a SCALE_Y squash turns about (motion TRAPS 5) — is given explicitly rather than left to
 * `transform-box: fill-box`. That box includes the two empty claw pivot frames, which this rebuild
 * drops, so a fill-box centre would sit ~2.7px left and ~3.3px low. Note that mr-bell §2 offers
 * the shell baseline (y 200) as a squash anchor while the file squashes about the centre; the file
 * wins here, so a pose that genuinely wants the baseline has to say so.
 */
export const BELL_PIVOTS = {
  clawL: { cx: 66.4314, cy: 132 }, // inboard tip of arm_4, 2px inside the shell left edge
  clawR: { cx: 189.7788, cy: 131 }, // inboard tip of arm_8
  legsL: { cx: 58.5, cy: 189 }, // hip — top edge of leg_6
  legsR: { cx: 196.5, cy: 189 }, // hip — top edge of leg_3
  lowerLegsL: { cx: 86, cy: 200 }, // knee — top edge of leg_7
  lowerLegsR: { cx: 172, cy: 199 }, // knee — top edge of leg_9
  body: { cx: 132.6051, cy: 131 },
} as const;

/** The twelve moods on `Motion — Mr. Bell` (`331:289`), in page order. Each drives a `[data-anim]`
 *  block in MrBell.css; the timings and every craft rule are in `design/specs/motion-mr-bell.md`. */
export type BellMood =
  | 'idle'
  | 'specs-push-up'
  | 'periscope'
  | 'lens-draw-on'
  | 'alarm'
  | 'double-take'
  | 'scuttle'
  | 'hop'
  | 'slump'
  | 'sleep'
  | 'glint'
  | 'tone-handoff';

/** Which token class a rect carries. One class per token, not per node, so a brand change is one
 *  declaration (spec §7): 17 x `--bell-cap-mid`, 20 x `--bell-cap-lo`. */
type Tone = 'cap-mid' | 'cap-lo';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A claw rung, given by its measured **centre** — see CLAW_L_TILT. */
interface Rung {
  cx: number;
  cy: number;
  w: number;
  h: number;
  tone: Tone;
}

/** A pivot as an inline `transform-origin`. It stays inline rather than in the stylesheet because
 *  it is measured rig geometry, not styling: a later pass rewriting the animation rules cannot drop
 *  it, and each number lives in exactly one place. `transform-box: view-box` is what makes the px
 *  resolve in viewBox units (spec §7). */
const origin = (p: { cx: number; cy: number }): CSSProperties => ({
  transformOrigin: `${p.cx}px ${p.cy}px`,
  transformBox: 'view-box',
});

/* ── shell · 3 rects · spec §3.1 ────────────────────────────────────────────────────────────────
   A 128x64 slab with an 8px band inset 8px each side above and below — a three-step pixel dome on
   an exact 8px grid, centred on x 128. */
const SHELL: readonly Rect[] = [
  { x: 72, y: 120, w: 112, h: 8 },
  { x: 64, y: 128, w: 128, h: 64 },
  { x: 72, y: 192, w: 112, h: 8 },
];

/* ── eyes · 3 rects each · spec §3.2 ────────────────────────────────────────────────────────────
   eye L (80, 80) and eye R (152, 80), both 24x40 and an exact mirror about x 128, so only the x of
   each part differs and the shared y/w/h sit in the JSX. Paint order inside an eye is stalk,
   socket, pupil. The pupil is centred in its socket, which buys a free 3x3 look-around: it can
   step ±8px in x and y and stay inside. Move the pupil alone for a glance and the whole eye group
   for a head-turn — a socket-only move tears the stalk. */
const EYES = [
  { side: 'l', stalkX: 88, socketX: 80, pupilX: 88 },
  { side: 'r', stalkX: 160, socketX: 152, pupilX: 160 },
] as const;

/* ── legs · 3 rects each · spec §3.3 ────────────────────────────────────────────────────────────
   An 11px hip block under the shell, a step down-and-outward, then a 21px shin ending at y 221.
   legs R paints before legs L, and R is x0.9259 the width of L (25 against 27) at the same
   heights. */
const LEGS_R: readonly Rect[] = [
  { x: 192.3333, y: 200, w: 8.3333, h: 11 }, // step
  { x: 200.6667, y: 200, w: 8.3333, h: 21 }, // shin, ends y 221
  { x: 184, y: 189, w: 16.6667, h: 11 }, // hip
];
const LEGS_L: readonly Rect[] = [
  { x: 54, y: 200, w: 9, h: 11 }, // step
  { x: 45, y: 200, w: 9, h: 21 }, // shin, ends y 221
  { x: 54, y: 189, w: 18, h: 11 }, // hip
];

/* ── lower legs · 2 rects each · spec §3.4 ──────────────────────────────────────────────────────
   Kept in `seg 1` / `seg 2` subgroups so a knee can bend on its own. lower legs R sits 1px higher
   than L (y 199/210 against 200/211) — that asymmetry is in the file. */
const LOWER_L: readonly Rect[] = [
  { x: 80, y: 200, w: 18, h: 11 }, // seg 1
  { x: 74, y: 211, w: 12, h: 11 }, // seg 2
];
const LOWER_R: readonly Rect[] = [
  { x: 160, y: 199, w: 18, h: 11 }, // seg 1
  { x: 172, y: 210, w: 12, h: 11 }, // seg 2
];

/* ── claws · 10 rects each · spec §3.5, §3.6 ────────────────────────────────────────────────────
   From the shoulder rung (touching the shell) four `cap-lo` arm rungs step down-and-outward — L by
   (-10.347, +8.164) each, R by (+10.872, +9.572) — then six `cap-mid` pincer rungs of decreasing
   length fan out into the jaw, closed by one tall block at the tip. Only 3 widths and 3 heights
   exist per claw.

   THE TILT. Every rung is stored 180°-flipped: Figma says `rotation: 176.05` on L and `-175.87` on
   R, applied about the rect origin corner. A solid rect is symmetric under 180°, so that is
   identical to the rect drawn at its measured centre and turned by the *visible* tilt, which is all
   of 3.95° on L and 4.13° on R, outboard end up on both. We use the small angle: it reads as the
   ~4° it looks like and cannot be mistaken for a flip (TRAPS 8). Verified against the measured
   AABBs — 39.0417 x 4.4286 at (24.890, 163.570) tilted 3.95° gives 39.254 x 7.108 at
   (5.263, 160.016), and the tip block lands its left edge on exactly x -6, the documented overflow.

   Keep claw motion rotational. The rungs are ~20x4 at ~4° off-axis, so they do not sit on whole
   pixels at any size; a whole-pixel translate breaks the rung grid where a rotation does not
   (spec §7, motion §7.4). */
const CLAW_L_TILT = 3.95;
const CLAW_R_TILT = -4.13;

const CLAW_L: readonly Rung[] = [
  { cx: 4.5, cy: 175.48, w: 19.5209, h: 22.143, tone: 'cap-mid' }, // jaw tip block
  { cx: 43.296, cy: 180.379, w: 19.5209, h: 8.8572, tone: 'cap-mid' },
  { cx: 34.017, cy: 173.079, w: 19.5209, h: 4.4286, tone: 'cap-mid' },
  { cx: 29.453, cy: 168.324, w: 29.2813, h: 4.4286, tone: 'cap-mid' },
  { cx: 24.89, cy: 163.57, w: 39.0417, h: 4.4286, tone: 'cap-mid' }, // longest rung
  { cx: 25.195, cy: 159.153, w: 19.5209, h: 4.4286, tone: 'cap-mid' },
  { cx: 25.652, cy: 152.526, w: 19.5209, h: 8.8572, tone: 'cap-lo' },
  { cx: 36, cy: 144.362, w: 19.5209, h: 8.8572, tone: 'cap-lo' },
  { cx: 46.347, cy: 136.198, w: 19.5209, h: 8.8572, tone: 'cap-lo' },
  { cx: 56.542, cy: 130.243, w: 19.5209, h: 4.4286, tone: 'cap-lo' }, // shoulder, on the pivot
];

const CLAW_R: readonly Rung[] = [
  { cx: 254.822, cy: 182.975, w: 20.3077, h: 25.8252, tone: 'cap-mid' }, // jaw tip block
  { cx: 214.498, cy: 188.476, w: 20.3077, h: 10.3301, tone: 'cap-mid' },
  { cx: 224.067, cy: 180.017, w: 20.3077, h: 5.165, tone: 'cap-mid' },
  { cx: 228.759, cy: 174.5, w: 30.4616, h: 5.165, tone: 'cap-mid' },
  { cx: 233.45, cy: 168.983, w: 40.6154, h: 5.165, tone: 'cap-mid' }, // longest rung
  { cx: 233.079, cy: 163.831, w: 20.3077, h: 5.165, tone: 'cap-mid' },
  { cx: 232.521, cy: 156.104, w: 20.3077, h: 10.3301, tone: 'cap-lo' },
  { cx: 221.649, cy: 146.532, w: 20.3077, h: 10.3301, tone: 'cap-lo' },
  { cx: 210.778, cy: 136.96, w: 20.3077, h: 10.3301, tone: 'cap-lo' },
  { cx: 200.092, cy: 129.963, w: 20.3077, h: 5.165, tone: 'cap-lo' }, // shoulder, on the pivot
];

/* ── specs · 26 raw-black rects + 2 lens vectors · spec §4 ──────────────────────────────────────
   THE SPECTACLES ARE DELIBERATELY UNTOKENISED. 26 rects at raw `#000000`, and two lens vectors at
   raw `#0079b5` with 42% fill opacity under a raw 1px `#000000` stroke. Zohaib set them by hand and
   they stay that way: the spectacles read ink-black in both tones, and `--ink` is white on Night,
   which would erase them. Do not tokenise them, do not re-whiten them, do not "fix" the contrast.
   The five raw values live in MrBell.css, one declaration each. (spec §4, TRAPS 7; motion TRAPS 10)

   PAINT ORDER INTERLEAVES: frame L → lens R → frame R → lens L. The lens fill is only 42% opaque,
   so lens L darkens frame L bars where they overlap while lens R sits under frame R. Reorder it and
   the spectacles change tone (TRAPS 4).

   HAND-DRAWN, NOT SYMMETRIC. The assembly runs x 39…212, centre 125.5 against the body 128; frame L
   is 95.177 wide against frame R 87.815; neither lens centres on its eye. It reads fine — do not
   correct it to symmetry (TRAPS 5).

   Figma auto-named these `Rectangle n`, so the roles are read off the geometry. The intermediate
   `Group 3` / `Group 4` / `Group 1` wrappers hold nothing and are flattened, which the spec allows;
   `frame L` / `frame R` are kept, being named in the tree. */

interface Bar {
  role: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** The two near-vertical bars in each frame keep their verbatim source matrix: the near-90°
   *  rotation carries a hair of skew that `rotate()` cannot express. The rect is then drawn at 0,0
   *  and the matrix places it, so `left` carries the measured AABB left edge instead. */
  matrix?: string;
  left?: number;
}

interface Lens {
  role: string;
  /** Path bbox left edge — already the visible left edge. */
  x: number;
  d: string;
}

const FRAME_L: readonly Bar[] = [
  { role: 'ear hook', x: 39, y: 93.5445, w: 6.0471, h: 13.2775 },
  { role: 'rim top', x: 74.7564, y: 72, w: 37.5973, h: 4.7599 },
  { role: 'rim bottom', x: 73.7054, y: 108.325, w: 37.5973, h: 4.7599 },
  { role: 'rim step top in', x: 105.2554, y: 76.7597, w: 11.8313, h: 4.7599 },
  { role: 'rim step top out', x: 67.3951, y: 76.7597, w: 11.8313, h: 4.7599 },
  { role: 'rim step bottom in', x: 105.7814, y: 103.565, w: 11.8313, h: 4.7599 },
  { role: 'rim step bottom out', x: 67.921, y: 103.565, w: 11.3055, h: 4.7599 },
  { role: 'bridge bar', x: 112.6174, y: 81.5196, w: 21.5593, h: 4.7599 },
  { role: 'temple bar', x: 51.883, y: 81.5196, w: 20.7705, h: 4.7599 },
  {
    role: 'rim side in',
    x: 0,
    y: 0,
    w: 17.2849,
    h: 4.9182,
    left: 112.617,
    matrix: 'matrix(-0.00416511 -0.999991 0.999993 -0.00378152 112.6894 103.5830)',
  },
  {
    role: 'rim side out',
    x: 0,
    y: 0,
    w: 17.2849,
    h: 4.736,
    left: 67.838,
    matrix: 'matrix(0.00401085 -0.999992 -0.999992 -0.00392697 72.5744 103.5830)',
  },
  { role: 'temple step', x: 45.31, y: 86.2795, w: 13.1459, h: 3.7578 },
  { role: 'temple tip', x: 39, y: 90.0372, w: 12.883, h: 3.5073 },
];

const FRAME_R: readonly Bar[] = [
  { role: 'ear hook', x: 206.421, y: 93.5446, w: 5.5794, h: 13.2775 },
  { role: 'rim top', x: 144.319, y: 72, w: 34.6892, h: 4.7599 },
  { role: 'rim bottom', x: 145.29, y: 108.325, w: 34.6892, h: 4.7599 },
  { role: 'rim step top in', x: 139.953, y: 76.7597, w: 10.9162, h: 4.7599 },
  { role: 'rim step top out', x: 174.885, y: 76.7597, w: 10.9162, h: 4.7599 },
  { role: 'rim step bottom in', x: 139.468, y: 103.565, w: 10.9162, h: 4.7599 },
  { role: 'rim step bottom out', x: 174.885, y: 103.565, w: 10.431, h: 4.7599 },
  { role: 'bridge bar', x: 124.186, y: 81.5197, w: 19.8917, h: 4.7599 },
  { role: 'temple bar', x: 180.9494, y: 81.5197, w: 19.164, h: 4.7599 },
  {
    role: 'rim side in',
    x: 0,
    y: 0,
    w: 17.2849,
    h: 4.5378,
    left: 139.473,
    matrix: 'matrix(0.00384295 -0.999993 -0.999992 -0.00409853 144.010 103.5830)',
  },
  {
    role: 'rim side out',
    x: 0,
    y: 0,
    w: 17.2849,
    h: 4.3697,
    left: 180.958,
    matrix: 'matrix(-0.00370062 -0.999993 0.999991 -0.00425617 181.0224 103.5830)',
  },
  { role: 'temple step', x: 194.049, y: 86.2795, w: 12.1291, h: 3.7578 },
  { role: 'temple tip', x: 200.114, y: 90.0372, w: 11.8865, h: 3.5073 },
];

/* Both lenses are 12-vertex stepped octagons — a tall centre rect with a wing bulging each side —
   and both paths are in component coordinates, with the scaleX -1 that lens R carries in Figma
   already baked in. The 1px CENTER stroke makes each render box 1px larger than its node box, which
   is why Figma codegen insets the image by -0.5px per edge. It scales with `size` like everything
   else here: 0.625px at the sidebar 160, 0.375px in the 96px dialog. (spec §4.3, TRAPS 6) */
const LENS_L: Lens = {
  role: 'lens L',
  x: 72.592,
  d: 'M79.11 108.308H105.683V103.53H112.702V81.5545H105.181V76.7772H79.11V81.5545H72.592V103.53H79.11V108.308Z',
};
const LENS_R: Lens = {
  role: 'lens R',
  x: 141.281,
  d: 'M176.553 110.219H148.651V104.717H141.281V79.412H149.177V73.9108H176.553V79.412H183.397V104.717H176.553V110.219Z',
};

/** Paint order across the assembly, which is fixed. `lens draw-on` instead staggers all 28 parts in
 *  **x order** — `t(i) = 0.05 + 0.028i`, i = 0…27 (motion §3.4) — and CSS cannot recover that from
 *  the DOM, since paint order is not x order. So every part carries its rank as `--x-order` and the
 *  animation pass writes one `animation-delay: calc(…)` rule instead of 28. */
const PAINT_ORDER: readonly (Bar | Lens)[] = [...FRAME_L, LENS_R, ...FRAME_R, LENS_L];

/** Left edge as painted: `x`, except for the matrix bars whose `x` is an origin corner. */
const leftEdge = (p: { x: number; left?: number }) => p.left ?? p.x;

const X_ORDER = new Map<Bar | Lens, number>(
  // frame R has two bars at x 174.885; sort is stable, so a tie keeps paint order
  [...PAINT_ORDER].sort((a, b) => leftEdge(a) - leftEdge(b)).map((p, i) => [p, i] as const),
);

/** React types have no slot for a custom property, hence the assertion. */
const stagger = (p: Bar | Lens) => ({ '--x-order': X_ORDER.get(p) ?? 0 }) as CSSProperties;

export interface MrBellProps {
  /** Box size in px; he is square. 160 is every sidebar mascot slot (x0.625 of the 256 rig) and 96
   *  the update dialog (x0.375) — both land the 8px grid on whole pixels, 5px and 3px. */
  size?: number;
  /** Which of the twelve timelines to play, published as `data-anim` and read by MrBell.css. The
   *  eight one-shots hold their last frame; `idle`, `periscope`, `lens-draw-on`, `scuttle` and
   *  `sleep` loop. Changing it restarts the timeline, which is how a caller retriggers a one-shot. */
  mood?: BellMood;
  className?: string;
}

/** A run of axis-aligned blocks — shell, legs. */
function Blocks({ rects, tone }: { rects: readonly Rect[]; tone: Tone }) {
  return (
    <>
      {rects.map((r, i) => (
        <rect key={i} className={tone} x={r.x} y={r.y} width={r.w} height={r.h} />
      ))}
    </>
  );
}

/** One claw: every rung at its measured centre, turned by the claw visible tilt. */
function Rungs({ rungs, tilt }: { rungs: readonly Rung[]; tilt: number }) {
  return (
    <>
      {rungs.map((r, i) => (
        <rect
          key={i}
          className={r.tone}
          x={r.cx - r.w / 2}
          y={r.cy - r.h / 2}
          width={r.w}
          height={r.h}
          transform={`rotate(${tilt} ${r.cx} ${r.cy})`}
        />
      ))}
    </>
  );
}

/** One spectacle frame, in its own paint order — rim top first, temple tip last. */
function Bars({ bars }: { bars: readonly Bar[] }) {
  return (
    <>
      {bars.map((b) => (
        <rect
          key={b.role}
          className="specs-ink"
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          transform={b.matrix}
          style={stagger(b)}
        />
      ))}
    </>
  );
}

/**
 * The extras three of the twelve timelines need, which do NOT exist in the master rig — in Figma they
 * are children of their own animation frame, so a still of Mr. Bell has never contained them
 * (motion TRAPS 14). They are here because the app has one rig, not twelve frames, and they cost
 * nothing: every one of them starts at `opacity: 0` and only the mood that owns it animates it.
 *
 * Coordinates are Mr. Bell space. The file gives dust and the Z glyphs in FRAME space, where the rig
 * sits at (62, 40) — so frame (92, 254) is (30, 214) here.
 */
const DUST = [
  { side: 'l', x: 30 },
  { side: 'r', x: 160 },
] as const;

/** `sleep`'s two Z glyphs: SF Pro Semibold at 16 and 12, rising and fading in turn. */
const ZS = [
  { rank: 1, x: 208, y: 104, size: 16 },
  { rank: 2, x: 236, y: 80, size: 12 },
] as const;

/**
 * `glint`'s clip is the spectacle row's own box, 173 x 41.085 at (39, 72), with an 8 x 45 streak
 * starting at (23, 70) — one step outside the left edge, which is why it needs no entry fade.
 *
 * The id is fixed rather than generated, and two rigs on one screen therefore declare it twice. That
 * is safe here and only here: both declarations are byte-identical in viewBox units, so whichever the
 * document keeps clips both correctly. A `useId()` would be the general answer and is not worth the
 * render cost for a shape that cannot differ.
 */
const GLINT_CLIP = 'bell-glint-clip';

export default function MrBell({ size = 160, mood = 'idle', className }: MrBellProps) {
  return (
    <svg
      className={className ? `bell ${className}` : 'bell'}
      data-anim={mood}
      viewBox={`0 0 ${BELL_BOX} ${BELL_BOX}`}
      width={size}
      height={size}
      /* Decorative. Every screen that hosts him also carries the wordmark, which names the brand,
         and a twelve-mood crab announced as "Mr. Bell" tells a screen reader nothing it needs. */
      aria-hidden
    >
      <g className="body" style={origin(BELL_PIVOTS.body)}>
        {/* claws first: the shell draws over their shoulders, which is what lets one slide inward
            without detaching (TRAPS 1) */}
        <g className="claw-l" style={origin(BELL_PIVOTS.clawL)}>
          <Rungs rungs={CLAW_L} tilt={CLAW_L_TILT} />
        </g>
        <g className="claw-r" style={origin(BELL_PIVOTS.clawR)}>
          <Rungs rungs={CLAW_R} tilt={CLAW_R_TILT} />
        </g>
        <g className="shell">
          <Blocks rects={SHELL} tone="cap-mid" />
        </g>
        {EYES.map((e) => (
          <g className={`eye-${e.side}`} key={e.side}>
            {/* the stalk keeps y 104 and animates `height`, never scaleY — that is what telescopes
                it while its foot stays welded to the shell top band (motion §7.5) */}
            <rect className="stalk cap-lo" x={e.stalkX} y={104} width={8} height={16} />
            <rect className="socket cap-mid" x={e.socketX} y={80} width={24} height={24} />
            <rect className="pupil" x={e.pupilX} y={88} width={8} height={8} />
          </g>
        ))}
        {/* specs stays the last child of body — it was a page-level sibling once and desynced from
            every bob (TRAPS 14) */}
        <g className="specs">
          <g className="frame-l">
            <Bars bars={FRAME_L} />
          </g>
          <path className="lens" d={LENS_R.d} style={stagger(LENS_R)} />
          <g className="frame-r">
            <Bars bars={FRAME_R} />
          </g>
          <path className="lens" d={LENS_L.d} style={stagger(LENS_L)} />
        </g>
      </g>

      {/* The four leg pivots are siblings of `body`, painting after it — so the legs cross in front
          of the shell, and a body bob leaves them planted. legs R before legs L (spec §1). */}
      <g className="legs-r" style={origin(BELL_PIVOTS.legsR)}>
        <Blocks rects={LEGS_R} tone="cap-lo" />
      </g>
      <g className="legs-l" style={origin(BELL_PIVOTS.legsL)}>
        <Blocks rects={LEGS_L} tone="cap-lo" />
      </g>
      <g className="lower-legs-l" style={origin(BELL_PIVOTS.lowerLegsL)}>
        {LOWER_L.map((r, i) => (
          <g className={`seg-${i + 1}`} key={i}>
            <rect className="cap-lo" x={r.x} y={r.y} width={r.w} height={r.h} />
          </g>
        ))}
      </g>
      <g className="lower-legs-r" style={origin(BELL_PIVOTS.lowerLegsR)}>
        {LOWER_R.map((r, i) => (
          <g className={`seg-${i + 1}`} key={i}>
            <rect className="cap-lo" x={r.x} y={r.y} width={r.w} height={r.h} />
          </g>
        ))}
      </g>

      {/* `hop`'s two kicked-up puffs. Siblings of `body` and of the legs, not children of either: in
          the file they were reparented onto the frame precisely so they stay on the ground while he
          rises (motion TRAPS 14). */}
      {DUST.map((d) => (
        <rect key={d.side} className={`dust dust-${d.side}`} x={d.x} y={214} width={16} height={8} />
      ))}

      {/* `sleep`'s Zs. Text, not art, so they take the UI face — the file draws them in SF Pro
          Semibold and `--font-ui` is that same stack. */}
      {ZS.map((z) => (
        <text
          key={z.rank}
          className={`zzz zzz-${z.rank}`}
          x={z.x}
          y={z.y}
          fontSize={z.size}
          fontWeight={600}
        >
          Z
        </text>
      ))}

      {/* `glint`'s streak, clipped to the spectacle row. */}
      <clipPath id={GLINT_CLIP}>
        <rect x={39} y={72} width={173} height={41.085} />
      </clipPath>
      <g className="glint" clipPath={`url(#${GLINT_CLIP})`}>
        <rect className="streak" x={23} y={70} width={8} height={45} />
      </g>
    </svg>
  );
}
