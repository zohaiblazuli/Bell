/**
 * The notebook stroke engine — capture, outline, hit-testing, the command stack and the paint pass.
 *
 * Spec: `design/specs/screen-notebooks.md` §5b (the dock's tools), §5c (the page geometry), §6a (the
 * NIB / INK / STROKE / BEHAVIOUR cards) and §14. The saved record types are `src/lib/notebooks.ts`'s
 * and are imported, never restated.
 *
 * WHY THIS IS NOT `annotations.ts`. `drawMarks` does a `getBoundingClientRect()` read, a full
 * `clearRect` and a re-stroke of every mark on **every** pointermove, called synchronously from the
 * move handler (`PaperCanvas.tsx:116-125`). There is no object model, so a committed mark can only
 * be undone or painted over. And the undo stack is per-page, never written to disk and reset on
 * paper change, so Ctrl+Z cannot reach the stroke you made on the page before. Everything here
 * exists to fix one of those three.
 *
 * The maths and the canvas are kept apart on purpose: nothing touches `document` or `window` at
 * module scope, and everything above the PAINT section is pure, so `tests/ink.test.ts` exercises it
 * under Node with no DOM at all.
 *
 * ## The coordinate convention, which the saved format implies but never spells out
 *
 * - `x`, and every horizontal length (`w` on a stroke, `sw`, `size`), is a fraction of the page
 *   WIDTH. A nib is a width-fraction so it feels the same whatever the page aspect.
 * - `y` and `h` are fractions of the page HEIGHT. That is what makes `{x, y, w, h}` a rectangle in
 *   the normalised page rather than a pair of unrelated numbers.
 * - A distance, a tolerance or a rotation therefore needs an ISOTROPIC space, because the page is
 *   455 x 644 and one fraction is not the other. `y * PAGE_ASPECT` puts y into width-fraction units
 *   and every metric below works there. Skip that and a 6px tolerance is 1.4x tighter vertically
 *   than horizontally, which reads to the student as "select is flaky".
 * - `rot` is in DEGREES, matching the spec's own wording ("rotate -3 degrees").
 *
 * Every colour is a token resolved through `resolveInk` against the canvas, which sits inside `.app`
 * so the Night overrides are in scope (`annotations.ts:115-129`). There is no hex in this file.
 */
import {
  getStrokeOutlinePoints,
  getStrokePoints,
  type StrokeOptions,
  type StrokePoint,
} from 'perfect-freehand';
import { resolveInk } from './annotations';
import {
  emptyPage,
  q4,
  type InkTool,
  type NbObject,
  type NbPage,
  type NbStroke,
  type NibId,
  type PaperStyle,
} from './notebooks';

/* ──────────────────────────────────────────────────────── the page, spec §5c ──────────────────── */

/**
 * The page in the design file's own pixels. Every fraction below divides by one of these, so the
 * ruling pitch is stated once and nothing re-derives `34 / 455` by hand.
 */
export const PAGE = {
  w: 455,
  h: 644,
  padX: 34,
  padY: 30,
  inkW: 387,
  inkH: 584,
  /** 22 rects h1 at pitch 26 from y 0 of the ink box. */
  rulePitch: 26,
  ruleCount: 22,
  /** The margin rule sits 24px inside the ruling's left edge — absolute x 58. */
  marginInset: 24,
} as const;

/** 644 / 455. The one number that turns a height-fraction into a width-fraction. */
export const PAGE_ASPECT = PAGE.h / PAGE.w;

/** §5c as page-box fractions, so the paper scales with zoom instead of being redrawn in px. */
export const PAPER = {
  padX: PAGE.padX / PAGE.w,
  padY: PAGE.padY / PAGE.h,
  inkW: PAGE.inkW / PAGE.w,
  inkH: PAGE.inkH / PAGE.h,
  pitchY: PAGE.rulePitch / PAGE.h,
  pitchX: PAGE.rulePitch / PAGE.w,
  lines: PAGE.ruleCount,
  marginX: (PAGE.padX + PAGE.marginInset) / PAGE.w,
} as const;

/**
 * A nib width in px against the notebook page, as a fraction of it.
 *
 * Deliberately not `annotations.ts`'s `strokeFraction`: that one divides by 720, the Reader's PDF
 * reference width, and using it here would make every notebook nib 1.6x too thin.
 */
export const widthFraction = (px: number) => px / PAGE.w;

/** §6a's STROKE card: the 5 / 8 / 12 dots, with 8 lit in `--accent`. */
export const STROKE_PRESETS = [5, 8, 12] as const;
export const DEFAULT_STROKE_PX = 8;

/* ────────────────────────────────────────────────── points, pressure, capture ──────────────────── */

export interface Pt {
  x: number;
  y: number;
}

export interface InkPoint extends Pt {
  /** 0…1, already normalised — see `normalisePressure`. */
  pressure: number;
}

/** The page's CSS size. Passed in rather than measured, which is the whole point of the rewrite. */
export interface PageBox {
  w: number;
  h: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** §6a's "Snap to ruler": an origin in page fractions plus an on-screen angle in degrees. */
export interface Ruler {
  x: number;
  y: number;
  angle: number;
}

/**
 * What a pointer with nothing to say reports.
 *
 * A mouse sends a constant 0.5 while a button is held and 0 otherwise, so its pressure carries no
 * information at all — and on Chromium the FIRST event from several pens reports a literal 0 before
 * the digitizer has a reading. `perfect-freehand` treats 0 as a valid pressure (`p >= 0`), so both
 * cases land a zero-width nib: a stroke that starts as a hairline, or one that is invisible. This is
 * the substitute, and 0.5 is chosen because it is the library's own default for a missing value.
 */
export const NO_PRESSURE = 0.5;

/**
 * The smallest step worth storing, in width-fractions — 0.68px on a 455-wide page, which is the
 * threshold `PaperCanvas` reaches for in device pixels. A slow hand at 240 Hz otherwise writes
 * hundreds of samples inside one nib width, and every one of them is 21 bytes on disk.
 */
export const MIN_POINT_DELTA = 0.0015;

/**
 * A raw `e.pressure` made usable.
 *
 * `pointerType` is consulted rather than trusted-and-clamped because a mouse's 0.5 is real and
 * constant: it would pass any range check while meaning "no pressure sensor". The fallback is
 * documented on `NO_PRESSURE`.
 */
export function normalisePressure(raw: number | null | undefined, pointerType?: string): number {
  if (pointerType === 'mouse' || pointerType === 'touch') return NO_PRESSURE;
  if (raw == null || Number.isNaN(raw)) return NO_PRESSURE;
  const clamped = Math.min(1, Math.max(0, raw));
  return clamped === 0 ? NO_PRESSURE : clamped;
}

/**
 * Does this stroke carry pressure information?
 *
 * §6a's `Pressure` switch has nowhere to live in the saved record — `NbStroke` has no flag for it —
 * so switching it off is written as a FLAT pressure stream, which is precisely what "no pressure
 * information" means. A pen never produces a byte-identical reading across a whole stroke, so the
 * test is safe in the other direction too, and a stroke drawn with pressure off keeps its even width
 * for ever without a format change.
 */
export function usesPressure(stroke: NbStroke): boolean {
  if (stroke.p.length < 6) return false;
  const first = stroke.p[2];
  for (let i = 5; i < stroke.p.length; i += 3) if (stroke.p[i] !== first) return true;
  return false;
}

/** §6a's BEHAVIOUR card, in the file's own default states: pressure on, both aids off. */
export interface InkBehaviour {
  pressure: boolean;
  lock: boolean;
  /** null when the ruler is not on the page. */
  ruler: Ruler | null;
}

export const DEFAULT_BEHAVIOUR: InkBehaviour = { pressure: true, lock: false, ruler: null };

/** §6a's Smoothing slider reads 40%, and the nib table below IS the shape at 40%. */
export const DEFAULT_SMOOTHING = 0.4;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** A height-fraction in width-fraction units, so a distance means the same in both axes. */
const iso = (y: number) => y * PAGE_ASPECT;

/** Isotropic distance between two page-fraction points, in width-fractions. */
const gap = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, iso(a.y - b.y));

/**
 * §6a's "Straight-line lock": keep the two ends, throw the middle away.
 *
 * The intermediate samples are discarded rather than projected onto the line, because a projected
 * wobble still varies the pressure and the taper along the stroke and so still reads as a wobble.
 * Two points is also what makes a locked stroke cost 6 numbers on disk instead of 600.
 */
export function straightLineLock(first: InkPoint, last: InkPoint): InkPoint[] {
  return first.x === last.x && first.y === last.y ? [first] : [first, last];
}

/**
 * §6a's "Snap to ruler": the nearest point on the ruler's line.
 *
 * Projected in the isotropic space, so `ruler.angle` is the angle the student sees on screen rather
 * than an angle in fraction space that would render 1.4x shallower than it was drawn.
 */
export function snapToRuler(point: InkPoint, ruler: Ruler): InkPoint {
  const radians = (ruler.angle * Math.PI) / 180;
  const ux = Math.cos(radians);
  const uy = Math.sin(radians);
  const along = (point.x - ruler.x) * ux + iso(point.y - ruler.y) * uy;
  return {
    x: ruler.x + along * ux,
    y: ruler.y + (along * uy) / PAGE_ASPECT,
    pressure: point.pressure,
  };
}

/**
 * Ids are minted here rather than by Rust because a stroke needs one before it is ever saved.
 *
 * Not a uuid: the id is 10 chars of counter-plus-random and lives in every one of a page's records,
 * where a 36-char uuid would be a fifth of a small page's bytes. The counter makes a same-millisecond
 * burst collision-free; the random tail makes a collision with a page loaded from disk negligible,
 * which matters because the bbox cache is keyed by id.
 */
let idSeq = 0;
export function newId(): string {
  idSeq = (idSeq + 1) % 46_656; // 36^3, so the prefix is always three chars
  return idSeq.toString(36).padStart(3, '0') + Math.random().toString(36).slice(2, 9);
}

/** Everything the tools card has set at pointer-down. `c` is already a resolved literal. */
export interface StrokeSeed {
  t: InkTool;
  c: string;
  /** Nib width as a fraction of the page width — `widthFraction(px)`. */
  w: number;
  o?: number;
  n?: NibId;
  sm?: number;
  id?: string;
}

/**
 * One stroke, from pointer-down to commit.
 *
 * The BEHAVIOUR switches are applied HERE rather than by the caller, because the live preview and
 * the committed record have to be generated from the same points or the stroke visibly jumps when
 * the pen lifts. Full precision is kept while drawing and `q4` is applied once, in `finish` — the
 * quantisation is a storage decision, and rounding on the way in would make the preview step in
 * visible 0.045px increments on a 455-wide page.
 */
export class StrokeBuilder {
  private readonly seed: StrokeSeed;
  private readonly how: InkBehaviour;
  private readonly kept: InkPoint[] = [];
  /**
   * The most recent sample that was too close to store. Held back rather than dropped so `finish`
   * can always land the last point: a stroke has to end where the pen actually lifted, or a slow
   * flourish loses its tail.
   */
  private held: InkPoint | null = null;

  constructor(seed: StrokeSeed, how: InkBehaviour = DEFAULT_BEHAVIOUR) {
    this.seed = seed;
    this.how = how;
  }

  get count(): number {
    return this.kept.length + (this.held ? 1 : 0);
  }

  begin(point: InkPoint): void {
    this.kept.length = 0;
    this.held = null;
    this.kept.push(this.prepare(point));
  }

  extend(points: readonly InkPoint[]): void {
    for (const raw of points) {
      if (this.kept.length === 0) {
        this.kept.push(this.prepare(raw));
        continue;
      }
      const point = this.prepare(raw);
      if (gap(point, this.kept[this.kept.length - 1]) < MIN_POINT_DELTA) this.held = point;
      else {
        this.kept.push(point);
        this.held = null;
      }
    }
  }

  /** The live points, full precision — what `paintLive` draws. */
  points(): InkPoint[] {
    const all = this.held ? [...this.kept, this.held] : [...this.kept];
    if (!this.how.lock || all.length < 2) return all;
    return straightLineLock(all[0], all[all.length - 1]);
  }

  /** Only meaningful once `begin` has run; `count` says whether there is anything to commit. */
  finish(): NbStroke {
    const points = this.points();
    const p: number[] = [];
    for (const point of points) p.push(q4(point.x), q4(point.y), q4(point.pressure));
    const stroke: NbStroke = {
      id: this.seed.id ?? newId(),
      t: this.seed.t,
      c: this.seed.c,
      w: q4(this.seed.w),
      n: this.seed.n ?? NIB_FOR_TOOL[this.seed.t],
      p,
    };
    // Absent means 1 and absent means the default (`notebooks.ts`), so writing either would only add
    // bytes. Everything on disk is quantised, not just the geometry.
    if (this.seed.o !== undefined && this.seed.o !== 1) stroke.o = q4(this.seed.o);
    if (this.seed.sm !== undefined && this.seed.sm !== DEFAULT_SMOOTHING) stroke.sm = q4(this.seed.sm);
    return stroke;
  }

  private prepare(point: InkPoint): InkPoint {
    const snapped = this.how.ruler ? snapToRuler(point, this.how.ruler) : point;
    return this.how.pressure ? snapped : { x: snapped.x, y: snapped.y, pressure: NO_PRESSURE };
  }
}

/* ─────────────────────────────────────────────────── nibs and outlines, spec §6a ───────────────── */

export interface NibSpec {
  /** The `Body/Small` name under the tile. */
  label: string;
  /** `perfect-freehand` shape at the shipped 40% Smoothing; `nibOptions` scales from here. */
  base: { thinning: number; smoothing: number; streamline: number };
  /**
   * Taper lengths as MULTIPLES OF THE NIB DIAMETER, not pixels, so a 12px marker tapers over the
   * same visual proportion as a 5px one. `perfect-freehand`'s `taper` is a distance along the
   * stroke, so a fixed number would swallow a thin nib's whole line.
   */
  taper: { start: number; end: number };
  /** Round caps, or the marker's flat chisel. */
  caps: boolean;
}

/**
 * The four nibs of §6a's NIB card, in the file's own order — Fountain, Ballpoint, Pencil, Marker.
 *
 * Exported because the tiles have to "draw a real stroke sample at that nib taper": the tile and the
 * page must read from one table, or the sample is a drawing of a nib rather than the nib.
 */
export const NIB_SPECS: Record<NibId, NibSpec> = {
  fountain: {
    label: 'Fountain',
    base: { thinning: 0.7, smoothing: 0.52, streamline: 0.5 },
    taper: { start: 1.5, end: 2.5 },
    caps: true,
  },
  ballpoint: {
    // Near-constant width: a ballpoint deposits the same line however hard you lean on it, so the
    // residual 0.04 is there only to keep the stroke from looking machine-drawn.
    label: 'Ballpoint',
    base: { thinning: 0.04, smoothing: 0.4, streamline: 0.62 },
    taper: { start: 0, end: 0 },
    caps: true,
  },
  pencil: {
    // The low `smoothing` is the graphite: it leaves the outline slightly ragged instead of glassy.
    label: 'Pencil',
    base: { thinning: 0.28, smoothing: 0.18, streamline: 0.44 },
    taper: { start: 0.6, end: 1.2 },
    caps: true,
  },
  marker: {
    // No thinning and a low `streamline`, so the line keeps the hand's own corners rather than
    // rounding them off — a chisel tip does not ease into a turn.
    label: 'Marker',
    base: { thinning: 0, smoothing: 0.46, streamline: 0.22 },
    taper: { start: 0, end: 0 },
    caps: false,
  },
};

/** §6a shows the Pen's NIB card with Fountain selected; the rest follow the tool they belong to. */
export const NIB_FOR_TOOL: Record<InkTool, NibId> = {
  pen: 'fountain',
  pencil: 'pencil',
  hl: 'marker',
  er: 'marker',
};

/**
 * What the inspector's Opacity slider starts at per tool — NOT a render fallback. `notebooks.ts` is
 * explicit that an absent `o` means 1, so `strokeOpacity` honours that and a highlighter writes its
 * 0.34 out. The number is the file's own: §5d measures the swipe on page 12 at node opacity 0.34.
 *
 * Read by `useNotebook.patchInk`, which remembers size and opacity PER ink tool. A single shared pair
 * cannot serve all four: at the pen's 1.0 / 8px a highlighter is an opaque bar that obliterates the
 * words it is meant to tint, which is the one thing a highlighter must not do.
 */
export const DEFAULT_INK_OPACITY: Record<InkTool, number> = { pen: 1, pencil: 1, hl: 0.34, er: 1 };

/**
 * And the matching nib width, in the page's own px. §5d draws the highlighter swipe as a 196 x 14
 * rect, so 14 is measured rather than chosen; the eraser's 18 is the floor `rub` already applies.
 */
export const DEFAULT_INK_WIDTH_PX: Record<InkTool, number> = {
  pen: DEFAULT_STROKE_PX,
  pencil: DEFAULT_STROKE_PX,
  hl: 14,
  er: 18,
};

export const strokeNib = (stroke: NbStroke): NibId => stroke.n ?? NIB_FOR_TOOL[stroke.t];
export const strokeOpacity = (stroke: NbStroke): number => stroke.o ?? 1;
export const strokeSmoothing = (stroke: NbStroke): number => stroke.sm ?? DEFAULT_SMOOTHING;

/**
 * A nib's `perfect-freehand` options at a given size, smoothing and pressure state.
 *
 * The Smoothing slider is a SCALE on the table, not the value itself: `NIB_SPECS` is what each nib
 * looks like at the slider's shipped 40%, so `smoothing / 0.4` reproduces the drawn design at the
 * default and lets the student go either side of it. `streamline` is capped below 1 because at 1 the
 * library's lerp never advances and the stroke collapses to its first point.
 *
 * `simulatePressure` is off throughout. It derives pressure from velocity and OVERRIDES the stream,
 * so with it on a pen's real readings would be thrown away; a pointer with no sensor is handled
 * instead by `thinning: 0`, which is an even width rather than the hairline the requirement forbids.
 */
export function nibOptions(
  nib: NibId,
  sizePx: number,
  smoothing = DEFAULT_SMOOTHING,
  pressure = true,
): StrokeOptions {
  const spec = NIB_SPECS[nib];
  const scale = smoothing / DEFAULT_SMOOTHING;
  return {
    size: sizePx,
    thinning: pressure ? spec.base.thinning : 0,
    smoothing: clamp(spec.base.smoothing * scale, 0, 1),
    streamline: clamp(spec.base.streamline * scale, 0, 0.95),
    simulatePressure: false,
    start: { cap: spec.caps, taper: spec.taper.start * sizePx },
    end: { cap: spec.caps, taper: spec.taper.end * sizePx },
  };
}

/** §6a's nib tiles are 96 x 56, and a sample nib is a fraction of THAT box, not of the page. */
export const NIB_TILE = { w: 96, h: 56 } as const;

/**
 * A NUMERIC taper is a distance in PIXELS and `perfect-freehand` applies it verbatim, so a fountain
 * nib's 20px end taper on a 4px flick eases the whole stroke away to nothing: the outline degenerates
 * to three points, and a fountain-pen TAP leaves no dot at all. Both tapers are therefore clamped to a
 * share of the stroke's own length — which also means a tap gets none, and that is precisely what lets
 * its round cap appear.
 */
const TAPER_SHARE = 0.8;

/** `[x, y, pressure]` triples in PIXELS. The library's internal fudges are in input units — it nudges
 *  a single-point stroke by 1 — so handing it fractions would move that point a whole page width. */
function pixelPoints(stroke: NbStroke, box: PageBox): number[][] {
  const out: number[][] = [];
  for (let i = 0; i + 2 < stroke.p.length; i += 3)
    out.push([stroke.p[i] * box.w, stroke.p[i + 1] * box.h, stroke.p[i + 2]]);
  return out;
}

function pixelLength(points: readonly number[][]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++)
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return total;
}

function optionsFor(stroke: NbStroke, box: PageBox, live: boolean, lengthPx: number): StrokeOptions {
  const size = Math.max(1, stroke.w * box.w);
  const options = nibOptions(strokeNib(stroke), size, strokeSmoothing(stroke), usesPressure(stroke));
  const start = typeof options.start?.taper === 'number' ? options.start.taper : 0;
  const end = typeof options.end?.taper === 'number' ? options.end.taper : 0;
  const wanted = start + end;
  const room = lengthPx * TAPER_SHARE;
  const scale = wanted > room ? room / wanted : 1;
  return {
    ...options,
    start: { ...options.start, taper: start * scale },
    end: { ...options.end, taper: end * scale },
    last: !live,
  };
}

/** The options a saved stroke renders with, taper clamped to its own length. */
export const strokeOptions = (stroke: NbStroke, box: PageBox, live = false): StrokeOptions =>
  optionsFor(stroke, box, live, pixelLength(pixelPoints(stroke, box)));

/**
 * Both render paths in one pass: the smoothed centreline, and the options stage two has to be given
 * the same copy of.
 *
 * This is the reason the two `perfect-freehand` stages are called separately rather than through
 * `getStroke` (which is exactly `getStrokeOutlinePoints(getStrokePoints(p, o), o)`): the highlighter
 * wants this line and nothing else, and a pen and a highlighter drawn over the same samples have to
 * follow the same path or the swipe will not sit under the words.
 */
function pipeline(
  stroke: NbStroke,
  box: PageBox,
  live: boolean,
): { points: StrokePoint[]; options: StrokeOptions } {
  const px = pixelPoints(stroke, box);
  const options = optionsFor(stroke, box, live, pixelLength(px));
  return { points: px.length === 0 ? [] : getStrokePoints(px, options), options };
}

/** The smoothed centreline as `[x, y]` pixel pairs. What the highlighter ribbon is stroked along. */
export function strokeCentreline(stroke: NbStroke, box: PageBox, live = false): number[][] {
  return pipeline(stroke, box, live).points.map((point) => point.point);
}

/**
 * The polygon to FILL, in pixels for the given page box.
 *
 * `live` is the in-progress case: it leaves the last point unsmoothed and the end taper unapplied,
 * because a taper computed against a moving end whips about as the pen travels.
 */
export function strokeOutline(stroke: NbStroke, box: PageBox, live = false): number[][] {
  const { points, options } = pipeline(stroke, box, live);
  if (points.length === 0) return [];
  return getStrokeOutlinePoints(points, options);
}

/** The flat-capped constant-width ribbon, in pixels. The highlighter's path — see `renderPlan`. */
export function strokeRibbon(
  stroke: NbStroke,
  box: PageBox,
  live = false,
): { points: number[][]; width: number } {
  return { points: strokeCentreline(stroke, box, live), width: Math.max(1, stroke.w * box.w) };
}

export type StrokeRender =
  | { kind: 'outline'; points: number[][] }
  | { kind: 'ribbon'; points: number[][]; width: number };

/**
 * Which path a stroke takes, and the highlighter is the one that is not an outline.
 *
 * A highlighter is painted at 34% alpha, and an outline polygon self-intersects wherever the hand
 * doubles back: filled at less than full alpha, the crossing composites twice and prints a dark knot
 * in the middle of a swipe. One `stroke()` of a polyline is a single shape however much it overlaps
 * itself, so every pixel is painted exactly once. The design file agrees — §5d draws the swipe as a
 * 196 x 14 rect, a constant-width bar, not a tapered nib.
 */
export function renderPlan(stroke: NbStroke, box: PageBox, live = false): StrokeRender {
  if (stroke.t === 'hl') return { kind: 'ribbon', ...strokeRibbon(stroke, box, live) };
  return { kind: 'outline', points: strokeOutline(stroke, box, live) };
}

/**
 * A synthetic stroke for §6a's nib tiles: a shallow S with a pressure arc over it, so a tile shows the
 * taper the nib will actually draw. The colour is passed in because a tile is chrome and its ink is
 * resolved by the screen, not frozen here. `w` is a fraction of the TILE, not of the page — hence the
 * default of an 8px nib in a 96-wide tile.
 */
export function nibSample(nib: NibId, c: string, w = DEFAULT_STROKE_PX / NIB_TILE.w): NbStroke {
  const p: number[] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    p.push(
      q4(0.08 + t * 0.84),
      q4(0.62 - Math.sin(t * Math.PI * 1.15) * 0.26),
      q4(0.18 + Math.sin(t * Math.PI) * 0.72),
    );
  }
  return { id: `nib-${nib}`, t: 'pen', c, w, n: nib, p };
}

/* ─────────────────────────────────────────── the object model: bboxes and hits ──────────────────── */

/** Anything a selection can name. */
export type NbRecord = NbStroke | NbObject;

/** `k` is the object discriminant and a stroke has none, which is the cheapest reliable test. */
export const isStroke = (rec: NbRecord): rec is NbStroke => !('k' in rec);

/** The flat `p` stream as points. */
export function strokePoints(stroke: NbStroke): InkPoint[] {
  const out: InkPoint[] = [];
  for (let i = 0; i + 2 < stroke.p.length; i += 3)
    out.push({ x: stroke.p[i], y: stroke.p[i + 1], pressure: stroke.p[i + 2] });
  return out;
}

/**
 * Caveat's own line height, near enough. `CLAUDE.md` sets every line height to `normal` — the font's
 * metrics — so there is no authored number to read; this is the ratio Caveat reports.
 */
const LINE_HEIGHT = 1.35;

/**
 * A text object's height in height-fractions.
 *
 * Only EXPLICIT newlines count. A soft wrap needs `measureText`, which needs a canvas, which this
 * function must not have — so the text tool is expected to commit hard breaks. A wrapped line that
 * was never broken makes this a lower bound, which is the safe direction for a selection box.
 */
const textHeight = (obj: Extract<NbObject, { k: 'text' }>) =>
  (obj.s.split('\n').length * obj.size * LINE_HEIGHT) / PAGE_ASPECT;

/** Negative `w`/`h` are legal — a line drawn up and to the left — so a bbox has to normalise them. */
const normalised = (x: number, y: number, w: number, h: number): Rect => ({
  x: w < 0 ? x + w : x,
  y: h < 0 ? y + h : y,
  w: Math.abs(w),
  h: Math.abs(h),
});

function computeStrokeBBox(stroke: NbStroke): Rect {
  if (stroke.p.length < 3) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 2 < stroke.p.length; i += 3) {
    const x = stroke.p[i];
    const y = stroke.p[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  // Path bounds, deliberately without the nib: the bbox is geometry, and a nib is a width-fraction
  // that would need the aspect to spend in y. `paintedBBox` is the one that covers the ink.
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function computeObjectBBox(obj: NbObject): Rect {
  // Normalised like every other kind: a text `w` can be negative in a page written before the width
  // was clamped, and a negative rectangle can never contain a point — so the object would silently
  // become unselectable and undeletable rather than merely oddly sized.
  if (obj.k === 'text') return normalised(obj.x, obj.y, obj.w, textHeight(obj));
  const box = normalised(obj.x, obj.y, obj.w, obj.h);
  if (obj.k !== 'img' || !obj.rot) return box;
  // A rotation is only a rotation in the isotropic space, so the corners go out through `iso` and the
  // axis-aligned bounds come back through it.
  const radians = (obj.rot * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const cx = box.x + box.w / 2;
  const cy = iso(box.y + box.h / 2);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [px, py] of [
    [box.x, iso(box.y)],
    [box.x + box.w, iso(box.y)],
    [box.x + box.w, iso(box.y + box.h)],
    [box.x, iso(box.y + box.h)],
  ]) {
    const x = cx + (px - cx) * cos - (py - cy) * sin;
    const y = cy + (px - cx) * sin + (py - cy) * cos;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY / PAGE_ASPECT, w: maxX - minX, h: (maxY - minY) / PAGE_ASPECT };
}

/**
 * The bbox cache. Keyed by id as the plan asks, but VERIFIED BY IDENTITY: every transform below
 * returns new records, so a stale entry is caught by `entry.rec !== rec` and recomputed. That also
 * makes the cache safe against the format's ids being only "stable within a page" — a collision
 * across two pages costs a recompute, never a wrong rectangle.
 *
 * The rect is frozen because it is shared: a selection layer that nudged the returned object while
 * dragging would silently corrupt every later hit test.
 */
const BBOX = new Map<string, { rec: NbRecord; box: Rect }>();

export function recordBBox(rec: NbRecord): Rect {
  const cached = BBOX.get(rec.id);
  if (cached && cached.rec === rec) return cached.box;
  const box = Object.freeze(isStroke(rec) ? computeStrokeBBox(rec) : computeObjectBBox(rec));
  BBOX.set(rec.id, { rec, box });
  return box;
}

export const strokeBBox = (stroke: NbStroke): Rect => recordBBox(stroke);
export const objectBBox = (obj: NbObject): Rect => recordBBox(obj);
export const invalidateBBox = (id: string): void => void BBOX.delete(id);
export const clearBBoxCache = (): void => BBOX.clear();
/** How many rectangles are held. For a debug readout, and for the test that the cache is a cache. */
export const bboxCacheSize = (): number => BBOX.size;

/** Grow a rect. `padX` is in width-fractions and `padY` in height-fractions, as ever. */
export const inflate = (rect: Rect, padX: number, padY: number): Rect => ({
  x: rect.x - padX,
  y: rect.y - padY,
  w: rect.w + padX * 2,
  h: rect.h + padY * 2,
});

/** How far a record's paint reaches past its geometry, as a width-fraction. */
export function nibPad(rec: NbRecord): number {
  if (isStroke(rec)) return rec.w / 2;
  return rec.k === 'shape' ? rec.sw / 2 : 0;
}

/** The bbox of the INK rather than of the path — what a selection rectangle should enclose. */
export function paintedBBox(rec: NbRecord): Rect {
  const pad = nibPad(rec);
  return pad === 0 ? recordBBox(rec) : inflate(recordBBox(rec), pad, pad / PAGE_ASPECT);
}

export function unionBBox(rects: readonly Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.w > maxX) maxX = r.x + r.w;
    if (r.y + r.h > maxY) maxY = r.y + r.h;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

const inRect = (rect: Rect, p: Pt) =>
  p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;

const rectsOverlap = (a: Rect, b: Rect) =>
  a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;

/** Distance from `p` to segment `a`-`b`, all already in the isotropic space. */
function segmentDistance(p: Pt, a: Pt, b: Pt): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len = vx * vx + vy * vy;
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = clamp(((p.x - a.x) * vx + (p.y - a.y) * vy) / len, 0, 1);
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

/**
 * Isotropic distance from a point to a stroke's polyline, in width-fractions.
 *
 * Tested against the STORED samples rather than the smoothed centreline the student sees. With
 * streamline at 0.5 the two can sit a fraction of a nib apart on a fast curve, and the tolerance
 * absorbs that — whereas re-smoothing per hit test would cost a `getStrokePoints` call per stroke per
 * pointer move, which is the cost this module exists to remove.
 */
export function strokeDistance(stroke: NbStroke, point: Pt): number {
  const points = strokePoints(stroke);
  if (points.length === 0) return Infinity;
  const p = { x: point.x, y: iso(point.y) };
  if (points.length === 1) return Math.hypot(p.x - points[0].x, p.y - iso(points[0].y));
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = { x: points[i - 1].x, y: iso(points[i - 1].y) };
    const b = { x: points[i].x, y: iso(points[i].y) };
    const d = segmentDistance(p, a, b);
    if (d < best) best = d;
  }
  return best;
}

function hitsStroke(stroke: NbStroke, point: Pt, tolerance: number): boolean {
  const pad = tolerance + stroke.w / 2;
  if (!inRect(inflate(strokeBBox(stroke), pad, pad / PAGE_ASPECT), point)) return false;
  return strokeDistance(stroke, point) <= pad;
}

function hitsObject(obj: NbObject, point: Pt, tolerance: number): boolean {
  // A line or an arrow has no area, and its bbox is the diagonal's box — testing that would hand you
  // the line from anywhere in a quarter of the page. Everything else is a box you can point at, and
  // an unfilled rect or ellipse is deliberately hit anywhere inside it: the alternative is asking a
  // student to land on a 1.75px edge.
  if (obj.k === 'shape' && (obj.s === 'line' || obj.s === 'arrow')) {
    const pad = tolerance + obj.sw / 2;
    const a = { x: obj.x, y: iso(obj.y) };
    const b = { x: obj.x + obj.w, y: iso(obj.y + obj.h) };
    return segmentDistance({ x: point.x, y: iso(point.y) }, a, b) <= pad;
  }
  const pad = tolerance + nibPad(obj);
  const padY = pad / PAGE_ASPECT;
  if (obj.k === 'img' && obj.rot) {
    // Inverse-rotate the point about the object's centre, in the isotropic space, then it is a plain
    // rectangle test again.
    const box = normalised(obj.x, obj.y, obj.w, obj.h);
    const radians = (-obj.rot * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const cx = box.x + box.w / 2;
    const cy = iso(box.y + box.h / 2);
    const dx = point.x - cx;
    const dy = iso(point.y) - cy;
    const local = { x: cx + dx * cos - dy * sin, y: (cy + dx * sin + dy * cos) / PAGE_ASPECT };
    return inRect(inflate(box, pad, padY), local);
  }
  return inRect(inflate(recordBBox(obj), pad, padY), point);
}

/**
 * The topmost record under `point`, or null. `tolerance` is a width-fraction.
 *
 * PAINT ORDER IS THE Z ORDER, and objects paint over strokes: an image, a sticky or a clipped
 * question is a thing placed ON the page, so ink underneath it is occluded and must not be picked in
 * preference to it. Within each list, array order is paint order, so the search runs backwards.
 * Eraser strokes are searchable too — in paint mode they are real ink in the file, and being unable
 * to select one would make a mis-aimed rub permanent.
 */
export function hitTest(page: NbPage, point: Pt, tolerance: number): NbRecord | null {
  for (let i = page.objects.length - 1; i >= 0; i--)
    if (hitsObject(page.objects[i], point, tolerance)) return page.objects[i];
  for (let i = page.strokes.length - 1; i >= 0; i--)
    if (hitsStroke(page.strokes[i], point, tolerance)) return page.strokes[i];
  return null;
}

/**
 * Even-odd crossing. Affine-invariant, so it runs in plain fraction space — there is no metric in it
 * and pushing it through `iso` would only cost multiplications.
 */
export function pointInPolygon(point: Pt, polygon: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.y > point.y !== b.y > point.y) {
      const x = a.x + ((point.y - a.y) * (b.x - a.x)) / (b.y - a.y);
      if (x > point.x) inside = !inside;
    }
  }
  return inside;
}

/**
 * Every record the lasso caught, in paint order.
 *
 * The bbox test is only a REJECT: a concave loop's bounding box covers ground the loop does not, so
 * intersecting it proves nothing and each survivor is then tested against the polygon itself.
 *
 * A stroke counts if ANY of its points is inside, because a loop drawn round three lines of working
 * will clip the odd descender and dropping the stroke for it is the more annoying failure. An object
 * counts if its CENTRE is inside, because a big pasted clip should be taken when you circle it and
 * not when your loop grazes one corner. Both are one predicate each if that turns out to be wrong.
 */
export function hitTestLasso(page: NbPage, polygon: readonly Pt[]): NbRecord[] {
  if (polygon.length < 3) return [];
  const bounds = unionBBox(polygon.map((p) => ({ x: p.x, y: p.y, w: 0, h: 0 })));
  const caught: NbRecord[] = [];
  for (const stroke of page.strokes) {
    if (!rectsOverlap(strokeBBox(stroke), bounds)) continue;
    if (strokePoints(stroke).some((p) => pointInPolygon(p, polygon))) caught.push(stroke);
  }
  for (const obj of page.objects) {
    const box = objectBBox(obj);
    if (!rectsOverlap(box, bounds)) continue;
    if (pointInPolygon({ x: box.x + box.w / 2, y: box.y + box.h / 2 }, polygon)) caught.push(obj);
  }
  return caught;
}

/* ─────────────────────────────────────────────── transforms over a selection ────────────────────── */

/** Scale about `(ax, ay)`, then translate. `x' = ax + (x - ax) * sx + dx`. */
export interface Affine {
  sx: number;
  sy: number;
  ax: number;
  ay: number;
  dx: number;
  dy: number;
}

export const translation = (dx: number, dy: number): Affine => ({
  sx: 1,
  sy: 1,
  ax: 0,
  ay: 0,
  dx,
  dy,
});

export const scaling = (anchor: Pt, sx: number, sy: number): Affine => ({
  sx,
  sy,
  ax: anchor.x,
  ay: anchor.y,
  dx: 0,
  dy: 0,
});

const mapX = (m: Affine, x: number) => q4(m.ax + (x - m.ax) * m.sx + m.dx);
const mapY = (m: Affine, y: number) => q4(m.ay + (y - m.ay) * m.sy + m.dy);

/**
 * One record moved, in the three functions below. Pure, and quantised — the result is going to disk, so
 * it is stored at the same 4 dp everything else is, which is exactly why the Transform command carries a
 * snapshot to undo from rather than inverting the affine.
 *
 * Nib widths, stroke weights and text sizes scale with `sx` because all three are width-fractions.
 * Scaling a group of handwriting down and leaving a fat nib behind reads as a bug, not as a feature.
 */
export function transformStroke(stroke: NbStroke, m: Affine): NbStroke {
  const p = stroke.p.slice();
  for (let i = 0; i + 2 < p.length; i += 3) {
    p[i] = mapX(m, p[i]);
    p[i + 1] = mapY(m, p[i + 1]);
  }
  return { ...stroke, w: q4(stroke.w * Math.abs(m.sx)), p };
}

export function transformObject(obj: NbObject, m: Affine): NbObject {
  const nib = Math.abs(m.sx);
  const x = mapX(m, obj.x);
  const y = mapY(m, obj.y);
  switch (obj.k) {
    case 'text':
      return { ...obj, x, y, w: q4(obj.w * m.sx), size: q4(obj.size * nib) };
    case 'shape':
      return { ...obj, x, y, w: q4(obj.w * m.sx), h: q4(obj.h * m.sy), sw: q4(obj.sw * nib) };
    default:
      // `img` and `note`. An `img`'s `rot` is preserved rather than composed: there is no rotate in
      // the transform set, because only `img` can store one and a rotate over a mixed selection would
      // silently drop on every other kind.
      return { ...obj, x, y, w: q4(obj.w * m.sx), h: q4(obj.h * m.sy) };
  }
}

export const transformRecord = (rec: NbRecord, m: Affine): NbRecord =>
  isStroke(rec) ? transformStroke(rec, m) : transformObject(rec, m);

const setOf = (ids: Iterable<string>): ReadonlySet<string> => new Set(ids);

/** An image is the one object with no ink of its own, so it is the one a recolour cannot touch. */
export const canRecolour = (rec: NbRecord): boolean => isStroke(rec) || rec.k !== 'img';

/**
 * Every transform takes a page and returns a new one. Nothing here mutates, which is what lets the
 * command stack hold a page reference as a snapshot and what keeps React's identity checks honest.
 */
export function transformRecords(page: NbPage, ids: Iterable<string>, m: Affine): NbPage {
  const set = setOf(ids);
  return {
    ...page,
    strokes: page.strokes.map((s) => (set.has(s.id) ? transformStroke(s, m) : s)),
    objects: page.objects.map((o) => (set.has(o.id) ? transformObject(o, m) : o)),
  };
}

export const translateRecords = (page: NbPage, ids: Iterable<string>, dx: number, dy: number) =>
  transformRecords(page, ids, translation(dx, dy));

export const scaleRecords = (
  page: NbPage,
  ids: Iterable<string>,
  anchor: Pt,
  sx: number,
  sy: number,
) => transformRecords(page, ids, scaling(anchor, sx, sy));

/**
 * Repaint the selection in one colour.
 *
 * `c` only — a shape's `fill` is left alone, because a recolour changes the ink and a wash behind it
 * is a separate decision. An `img` is skipped: it has no ink. Frozen literals, like every other
 * colour in the format: the swatch is resolved against the live tone by the caller and the record
 * keeps what it was given for ever.
 */
export function recolourRecords(page: NbPage, ids: Iterable<string>, c: string): NbPage {
  const set = setOf(ids);
  return {
    ...page,
    strokes: page.strokes.map((s) => (set.has(s.id) ? { ...s, c } : s)),
    objects: page.objects.map((o) => (set.has(o.id) && o.k !== 'img' ? { ...o, c } : o)),
  };
}

export function deleteRecords(page: NbPage, ids: Iterable<string>): NbPage {
  const set = setOf(ids);
  return {
    ...page,
    strokes: page.strokes.filter((s) => !set.has(s.id)),
    objects: page.objects.filter((o) => !set.has(o.id)),
  };
}

/** Ctrl+D's default nudge, so a copy is visibly a copy: a quarter of the ruling pitch, both ways. */
export const DUPLICATE_OFFSET: Pt = { x: PAPER.pitchX / 4, y: PAPER.pitchY / 4 };

/**
 * Copy the selection, offset, with fresh ids. `mint` is injectable so a test can pin the ids; the
 * new records come back as well as the page, because the point of duplicating is to select the copy.
 */
export function duplicateRecords(
  page: NbPage,
  ids: Iterable<string>,
  offset: Pt = DUPLICATE_OFFSET,
  mint: () => string = newId,
): { page: NbPage; records: NbRecord[] } {
  const set = setOf(ids);
  const m = translation(offset.x, offset.y);
  const strokes = page.strokes.filter((s) => set.has(s.id)).map((s) => ({ ...transformStroke(s, m), id: mint() }));
  const objects = page.objects.filter((o) => set.has(o.id)).map((o) => ({ ...transformObject(o, m), id: mint() }));
  return {
    page: { ...page, strokes: [...page.strokes, ...strokes], objects: [...page.objects, ...objects] },
    records: [...strokes, ...objects],
  };
}

/* ─────────────────────────────────────────────────────────── the command stack ─────────────────── */

/**
 * The pages a command stack operates over, by DISK page index.
 *
 * Notebook-wide, not per-page, and that is the whole point: the Reader keys `undone` by page, never
 * writes it to disk and resets it on paper change, so Ctrl+Z on page 6 cannot reach the stroke you
 * made on page 5. A missing index is a page that has never been written, which is the normal case for
 * a fresh spread.
 */
export type NbPages = Record<number, NbPage>;

/** A record and the index it sat at, so an undo puts it back in the same z position. */
export interface Placed<T> {
  i: number;
  rec: T;
}

/**
 * Six commands, each carrying everything needed to reverse itself without consulting anything else.
 *
 * `transform` keeps the records as they WERE and the affine, rather than the affine alone: geometry is
 * quantised to 4 dp on the way out, so inverting a scale would drift by up to a 10,000th of the page
 * per undo. Reverting from the snapshot is exact, and re-applying the affine to the same snapshot
 * makes redo deterministic too.
 */
export type InkCommand =
  | { k: 'stroke'; page: number; stroke: NbStroke }
  | { k: 'object'; page: number; object: NbObject }
  | { k: 'transform'; page: number; before: NbRecord[]; m: Affine }
  | { k: 'recolour'; page: number; before: { id: string; c: string }[]; c: string }
  | { k: 'delete'; page: number; strokes: Placed<NbStroke>[]; objects: Placed<NbObject>[] }
  | { k: 'paste'; page: number; strokes: NbStroke[]; objects: NbObject[] };

const pageAt = (state: NbPages, index: number): NbPage => state[index] ?? emptyPage();
const withPage = (state: NbPages, index: number, page: NbPage): NbPages => ({
  ...state,
  [index]: page,
});

/** Insert ascending, so each `i` lands at the index it was taken from. */
function restore<T>(list: readonly T[], placed: readonly Placed<T>[]): T[] {
  const out = list.slice();
  for (const { i, rec } of [...placed].sort((a, b) => a.i - b.i))
    out.splice(Math.min(i, out.length), 0, rec);
  return out;
}

/**
 * Run a command forward.
 *
 * Pure, and it closes over nothing — which is what makes it safe under StrictMode, where an updater
 * passed to `setState` runs twice. The Reader works around that by reading `ink`/`undone` directly
 * instead of through an updater; a reducer does not have to. Adding is idempotent by id for the same
 * reason: a command applied twice is a no-op rather than a doubled stroke.
 */
export function apply(state: NbPages, command: InkCommand): NbPages {
  const page = pageAt(state, command.page);
  switch (command.k) {
    case 'stroke': {
      if (page.strokes.some((s) => s.id === command.stroke.id)) return state;
      return withPage(state, command.page, { ...page, strokes: [...page.strokes, command.stroke] });
    }
    case 'object': {
      if (page.objects.some((o) => o.id === command.object.id)) return state;
      return withPage(state, command.page, { ...page, objects: [...page.objects, command.object] });
    }
    case 'transform': {
      const before = new Map(command.before.map((rec) => [rec.id, rec]));
      return withPage(state, command.page, {
        ...page,
        // From the snapshot, never from what is on the page now, so redo cannot compound.
        strokes: page.strokes.map((s) => {
          const was = before.get(s.id);
          return was && isStroke(was) ? transformStroke(was, command.m) : s;
        }),
        objects: page.objects.map((o) => {
          const was = before.get(o.id);
          return was && !isStroke(was) ? transformObject(was, command.m) : o;
        }),
      });
    }
    case 'recolour':
      return withPage(
        state,
        command.page,
        recolourRecords(page, command.before.map((entry) => entry.id), command.c),
      );
    case 'delete':
      return withPage(state, command.page, {
        ...page,
        strokes: page.strokes.filter((s) => !command.strokes.some((p) => p.rec.id === s.id)),
        objects: page.objects.filter((o) => !command.objects.some((p) => p.rec.id === o.id)),
      });
    case 'paste': {
      const have = new Set([...page.strokes, ...page.objects].map((rec) => rec.id));
      return withPage(state, command.page, {
        ...page,
        strokes: [...page.strokes, ...command.strokes.filter((s) => !have.has(s.id))],
        objects: [...page.objects, ...command.objects.filter((o) => !have.has(o.id))],
      });
    }
  }
}

/**
 * Run a command backwards. `revert(apply(s, c), c)` is `s`, deep-equal, for all six kinds.
 *
 * A record named by the command but absent from the page is skipped rather than thrown on. A linear
 * stack cannot produce that; a history file that has been edited by hand can, and refusing to open a
 * notebook over it would be the worse failure.
 */
export function revert(state: NbPages, command: InkCommand): NbPages {
  const page = pageAt(state, command.page);
  switch (command.k) {
    case 'stroke':
      return withPage(state, command.page, {
        ...page,
        strokes: page.strokes.filter((s) => s.id !== command.stroke.id),
      });
    case 'object':
      return withPage(state, command.page, {
        ...page,
        objects: page.objects.filter((o) => o.id !== command.object.id),
      });
    case 'transform': {
      const before = new Map(command.before.map((rec) => [rec.id, rec]));
      return withPage(state, command.page, {
        ...page,
        strokes: page.strokes.map((s) => {
          const was = before.get(s.id);
          return was && isStroke(was) ? was : s;
        }),
        objects: page.objects.map((o) => {
          const was = before.get(o.id);
          return was && !isStroke(was) ? was : o;
        }),
      });
    }
    case 'recolour': {
      const was = new Map(command.before.map((entry) => [entry.id, entry.c]));
      return withPage(state, command.page, {
        ...page,
        strokes: page.strokes.map((s) => (was.has(s.id) ? { ...s, c: was.get(s.id)! } : s)),
        objects: page.objects.map((o) =>
          was.has(o.id) && o.k !== 'img' ? { ...o, c: was.get(o.id)! } : o,
        ),
      });
    }
    case 'delete':
      return withPage(state, command.page, {
        ...page,
        strokes: restore(page.strokes, command.strokes),
        objects: restore(page.objects, command.objects),
      });
    case 'paste': {
      const ids = new Set([...command.strokes, ...command.objects].map((rec) => rec.id));
      return withPage(state, command.page, {
        ...page,
        strokes: page.strokes.filter((s) => !ids.has(s.id)),
        objects: page.objects.filter((o) => !ids.has(o.id)),
      });
    }
  }
}

/**
 * The command builders. Hand-writing a command literal is where a wrong `before` snapshot creeps in,
 * and a wrong snapshot is an undo that silently mangles a page, so every kind gets a constructor that
 * reads the page for itself.
 */
export const addStrokeCmd = (page: number, stroke: NbStroke): InkCommand => ({
  k: 'stroke',
  page,
  stroke,
});

export const addObjectCmd = (page: number, object: NbObject): InkCommand => ({
  k: 'object',
  page,
  object,
});

export function transformCmd(
  page: number,
  from: NbPage,
  ids: Iterable<string>,
  m: Affine,
): InkCommand {
  const set = setOf(ids);
  const before: NbRecord[] = [
    ...from.strokes.filter((s) => set.has(s.id)),
    ...from.objects.filter((o) => set.has(o.id)),
  ];
  return { k: 'transform', page, before, m };
}

export function recolourCmd(
  page: number,
  from: NbPage,
  ids: Iterable<string>,
  c: string,
): InkCommand {
  const set = setOf(ids);
  const before: { id: string; c: string }[] = [];
  for (const s of from.strokes) if (set.has(s.id)) before.push({ id: s.id, c: s.c });
  for (const o of from.objects) if (set.has(o.id) && o.k !== 'img') before.push({ id: o.id, c: o.c });
  return { k: 'recolour', page, before, c };
}

export function deleteCmd(page: number, from: NbPage, ids: Iterable<string>): InkCommand {
  const set = setOf(ids);
  const strokes: Placed<NbStroke>[] = [];
  const objects: Placed<NbObject>[] = [];
  from.strokes.forEach((rec, i) => {
    if (set.has(rec.id)) strokes.push({ i, rec });
  });
  from.objects.forEach((rec, i) => {
    if (set.has(rec.id)) objects.push({ i, rec });
  });
  return { k: 'delete', page, strokes, objects };
}

export function pasteCmd(page: number, records: readonly NbRecord[]): InkCommand {
  const strokes: NbStroke[] = [];
  const objects: NbObject[] = [];
  for (const rec of records) {
    if (isStroke(rec)) strokes.push(rec);
    else objects.push(rec);
  }
  return { k: 'paste', page, strokes, objects };
}

/* ────────────────────────────────────────────── the history, persisted to disk ──────────────────── */

export const HISTORY_VERSION = 1;

/**
 * How many commands survive, oldest dropped first.
 *
 * 200 because a command carries its own reversal data and the biggest of them are not small: a
 * `Delete` of a forty-stroke selection holds those forty strokes, and one measured page of Reader ink
 * is already 66,673 bytes. At 200 the log stays the same order of magnitude as a page of ink rather
 * than becoming the largest file in the notebook — and it is far past the few dozen steps a student
 * will ever walk back in a sitting.
 */
export const HISTORY_DEPTH = 200;

export interface InkHistory {
  v: number;
  done: InkCommand[];
  undone: InkCommand[];
}

export const emptyHistory = (): InkHistory => ({ v: HISTORY_VERSION, done: [], undone: [] });

export const canUndo = (history: InkHistory) => history.done.length > 0;
export const canRedo = (history: InkHistory) => history.undone.length > 0;

/** A new command invalidates the redo branch, as every editor does. */
export function pushCommand(history: InkHistory, command: InkCommand): InkHistory {
  const done = [...history.done, command];
  return {
    v: HISTORY_VERSION,
    done: done.length > HISTORY_DEPTH ? done.slice(done.length - HISTORY_DEPTH) : done,
    undone: [],
  };
}

/** The command is returned as well as the new state so the caller knows which page to mark dirty. */
export function undo(
  state: NbPages,
  history: InkHistory,
): { state: NbPages; history: InkHistory; command: InkCommand | null } {
  if (history.done.length === 0) return { state, history, command: null };
  const command = history.done[history.done.length - 1];
  return {
    state: revert(state, command),
    history: { v: HISTORY_VERSION, done: history.done.slice(0, -1), undone: [...history.undone, command] },
    command,
  };
}

export function redo(
  state: NbPages,
  history: InkHistory,
): { state: NbPages; history: InkHistory; command: InkCommand | null } {
  if (history.undone.length === 0) return { state, history, command: null };
  const command = history.undone[history.undone.length - 1];
  return {
    state: apply(state, command),
    history: { v: HISTORY_VERSION, done: [...history.done, command], undone: history.undone.slice(0, -1) },
    command,
  };
}

export const serialiseHistory = (history: InkHistory): string =>
  JSON.stringify({
    v: HISTORY_VERSION,
    done: history.done.slice(-HISTORY_DEPTH),
    undone: history.undone.slice(-HISTORY_DEPTH),
  });

const isRecord = (x: unknown): x is { id: string } =>
  typeof x === 'object' && x !== null && typeof (x as { id?: unknown }).id === 'string';

const isPlaced = (x: unknown): boolean =>
  typeof x === 'object' &&
  x !== null &&
  Number.isInteger((x as { i?: unknown }).i) &&
  isRecord((x as { rec?: unknown }).rec);

const allOf = (x: unknown, test: (item: unknown) => boolean) => Array.isArray(x) && x.every(test);

function validCommand(x: unknown): x is InkCommand {
  if (typeof x !== 'object' || x === null) return false;
  const c = x as Record<string, unknown>;
  if (!Number.isInteger(c.page) || (c.page as number) < 0) return false;
  switch (c.k) {
    case 'stroke':
      return isRecord(c.stroke);
    case 'object':
      return isRecord(c.object);
    case 'transform':
      return allOf(c.before, isRecord) && typeof c.m === 'object' && c.m !== null;
    case 'recolour':
      return typeof c.c === 'string' && allOf(c.before, isRecord);
    case 'delete':
      return allOf(c.strokes, isPlaced) && allOf(c.objects, isPlaced);
    case 'paste':
      return allOf(c.strokes, isRecord) && allOf(c.objects, isRecord);
    default:
      return false;
  }
}

/**
 * Read a history file, or give up and start fresh.
 *
 * Never throws: a corrupt undo log must not stop a notebook opening, and the notebook itself is in
 * `pages\NNNN.json` where nothing here can hurt it. It is also ALL OR NOTHING — one malformed entry
 * discards the whole stack, because undoing *through* a bad command would silently mangle a page,
 * and a half-trusted stack is more dangerous than no stack at all. Version mismatch is the same
 * story: a log written by another format is not partially readable.
 */
export function parseHistory(json: string | null | undefined): InkHistory {
  if (!json) return emptyHistory();
  try {
    const raw: unknown = JSON.parse(json);
    if (typeof raw !== 'object' || raw === null) return emptyHistory();
    const { v, done, undone } = raw as { v?: unknown; done?: unknown; undone?: unknown };
    if (v !== HISTORY_VERSION) return emptyHistory();
    if (!Array.isArray(done) || !Array.isArray(undone)) return emptyHistory();
    if (!done.every(validCommand) || !undone.every(validCommand)) return emptyHistory();
    return {
      v: HISTORY_VERSION,
      done: (done as InkCommand[]).slice(-HISTORY_DEPTH),
      undone: (undone as InkCommand[]).slice(-HISTORY_DEPTH),
    };
  } catch {
    return emptyHistory();
  }
}

/* ─────────────────────────────────────────────────────────── the eraser, two modes ─────────────── */

export type EraserMode = 'stroke' | 'paint';

/**
 * `stroke` is the default, and `paint` is only kept for highlighter clean-up.
 *
 * PAINT-MODE ERASING NEVER RECLAIMS INK. `destination-out` hides pixels; it does not remove records.
 * The erased strokes stay in the page file in full, AND every eraser swipe is itself a stroke that is
 * saved on top of them — so a page that is drawn on and rubbed out repeatedly grows monotonically and
 * can never shrink, however empty it looks. `stroke` mode is a real edit: the records go, the bytes go
 * with them, and the page can fall back to being deleted from disk entirely when it empties.
 */
export const DEFAULT_ERASER_MODE: EraserMode = 'stroke';

/**
 * One erase gesture at a point. `radius` is a width-fraction.
 *
 * Objects are never erased — you delete an image or a sticky, you do not rub it out — and in `paint`
 * mode nothing is removed at all: the caller commits an ordinary `t: 'er'` stroke through the normal
 * `AddStroke` path and `paintStatic` composites it `destination-out`. The removed records come back
 * placed, so the caller can wrap them in a `delete` command that undoes exactly.
 */
export function eraseAt(
  page: NbPage,
  point: Pt,
  radius: number,
  mode: EraserMode = DEFAULT_ERASER_MODE,
): { page: NbPage; removed: Placed<NbStroke>[] } {
  if (mode === 'paint') return { page, removed: [] };
  const removed: Placed<NbStroke>[] = [];
  page.strokes.forEach((rec, i) => {
    if (hitsStroke(rec, point, radius)) removed.push({ i, rec });
  });
  if (removed.length === 0) return { page, removed };
  const ids = new Set(removed.map((entry) => entry.rec.id));
  return { page: { ...page, strokes: page.strokes.filter((s) => !ids.has(s.id)) }, removed };
}

/* ──────────────────────────────────────────────────── pointer capture, the DOM edge ────────────── */

/**
 * The parts of a `PointerEvent` this module reads. Structural rather than the DOM class so the
 * functions below stay testable, and so a caller can hand over either the native event or a React
 * synthetic one — but PASS `e.nativeEvent` when you have a React event, because the synthetic wrapper
 * has no `getCoalescedEvents` and a 240 Hz pen would silently be sampled at compositor rate.
 */
export interface PointerLike {
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;
  pressure: number;
  clientX: number;
  clientY: number;
  getCoalescedEvents?: () => PointerLike[];
}

/** A `DOMRect` satisfies this. Taken as a shape so nothing here has to measure. */
export interface BoxRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The pointer currently drawing, or null. */
export interface PointerOwner {
  pointerId: number;
  pointerType: string;
}

/**
 * Every sample this event carries, as page fractions.
 *
 * `getCoalescedEvents()` is what recovers the samples the browser merged into one dispatch — a 240 Hz
 * pen delivers four of them per frame, and reading only `e` throws three quarters of the stroke away.
 */
export function samplePointer(e: PointerLike, rect: BoxRect): InkPoint[] {
  if (rect.width < 1 || rect.height < 1) return [];
  const merged = e.getCoalescedEvents?.() ?? [];
  const samples = merged.length > 0 ? merged : [e];
  return samples.map((sample) => ({
    x: (sample.clientX - rect.left) / rect.width,
    y: (sample.clientY - rect.top) / rect.height,
    pressure: normalisePressure(sample.pressure, sample.pointerType ?? e.pointerType),
  }));
}

/**
 * Palm rejection, and the reason a second finger cannot eat your stroke.
 *
 * Two rules. A pen that is down owns the surface, so a palm landing beside it — which arrives as
 * `touch`, and as a primary pointer of its own type — is dropped. And while anything is drawing, only
 * that pointer is heard: `PaperCanvas.start` has no such check, so a second simultaneous pointer
 * overwrites `draft.current` and the first stroke is lost with no error anywhere.
 */
export function acceptsPointer(e: PointerLike, owner: PointerOwner | null): boolean {
  if (owner) {
    if (owner.pointerType === 'pen' && e.pointerType === 'touch') return false;
    return e.pointerId === owner.pointerId;
  }
  return e.isPrimary !== false;
}

export interface InkLoop {
  /** The move handler appends its points, then calls this. Cheap, and safe to call many times. */
  mark(): void;
  stop(): void;
}

/**
 * One rAF per frame, however many moves arrive.
 *
 * This is the actual fix for the performance bug: `PaperCanvas.move` calls `drawMarks` synchronously
 * on every pointermove, and `drawMarks` does a layout-forcing `getBoundingClientRect()`, a full
 * `clearRect` and a re-stroke of EVERY mark on the page. With coalesced events that is up to four full
 * repaints per frame, each one longer than the last as the page fills. Here the handler only sets a
 * flag and exactly one paint happens, at the frame boundary where it can actually be shown.
 *
 * The scheduler is injectable so the loop can be tested without a browser.
 */
export function createInkLoop(
  paint: () => void,
  schedule: (cb: () => void) => number = requestAnimationFrame,
  cancel: (handle: number) => void = cancelAnimationFrame,
): InkLoop {
  let dirty = false;
  let frame = 0;
  const tick = () => {
    frame = 0;
    if (!dirty) return;
    dirty = false;
    paint();
  };
  return {
    mark() {
      dirty = true;
      if (frame === 0) frame = schedule(tick);
    },
    stop() {
      if (frame !== 0) cancel(frame);
      frame = 0;
      dirty = false;
    },
  };
}

/* ─────────────────────────────────────────────────── PAINT — the only DOM below ─────────────────── */

/** §5d's sticky note, in the design file's px: radius 3, Caveat 16, and its own inner padding. */
const NOTE = { radius: 3, text: 16, pad: 10 } as const;

/** A live eraser has nothing to cut out of, so it previews as a trail at this alpha instead. */
const ERASER_PREVIEW_ALPHA = 0.35;

const deviceRatio = () => (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);

/**
 * The 2D context, sized for the device.
 *
 * `box` is passed in rather than measured: a `getBoundingClientRect()` here would force layout on
 * every frame, which is half of what makes `drawMarks` expensive. Assigning either dimension clears
 * the canvas, so they are only touched on a real change.
 */
function surface(canvas: HTMLCanvasElement, box: PageBox, dpr: number): CanvasRenderingContext2D | null {
  if (box.w < 1 || box.h < 1) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const w = Math.max(1, Math.round(box.w * dpr));
  const h = Math.max(1, Math.round(box.h * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/**
 * §5c's four paper styles plus §6c's margin rule.
 *
 * Repainted only when the style, the margin switch or the page size changes — never on a pointer move,
 * which is the reason it is its own canvas. Only `ruled` is drawn in the file, so `grid` and `dotted`
 * reuse the ruling's own 26px pitch on both axes: derived from the one authored number rather than
 * invented beside it, so the four styles read as one family.
 */
export function paintPaper(
  canvas: HTMLCanvasElement,
  style: PaperStyle,
  box: PageBox,
  margin: boolean,
  dpr = deviceRatio(),
): void {
  const ctx = surface(canvas, box, dpr);
  if (!ctx) return;
  ctx.clearRect(0, 0, box.w, box.h);
  ctx.fillStyle = resolveInk('--paper', canvas);
  ctx.fillRect(0, 0, box.w, box.h);

  const x0 = PAPER.padX * box.w;
  const y0 = PAPER.padY * box.h;
  const w = PAPER.inkW * box.w;
  const h = PAPER.inkH * box.h;
  const pitchY = PAPER.pitchY * box.h;
  const pitchX = PAPER.pitchX * box.w;
  // Mode-invariant 14%, so the ruling is identical in Day and Night — §5c is explicit that a red
  // margin rule would need a token that retones and there is no such token.
  ctx.fillStyle = resolveInk('--page-line', canvas);

  if (style === 'ruled' || style === 'grid') {
    for (let i = 0; i < PAPER.lines; i++) ctx.fillRect(x0, y0 + i * pitchY, w, 1);
  }
  if (style === 'grid') {
    for (let x = x0; x <= x0 + w + 0.5; x += pitchX) ctx.fillRect(x, y0, 1, h);
  }
  if (style === 'dotted') {
    // Square dots: at 1.4px a square and a circle are the same three pixels, and this needs no arc.
    for (let y = y0; y <= y0 + h + 0.5; y += pitchY)
      for (let x = x0; x <= x0 + w + 0.5; x += pitchX) ctx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
  }
  if (margin) ctx.fillRect(PAPER.marginX * box.w, y0, 1, h);
}

/** The tokens a static repaint needs, read once. `getComputedStyle` forces style resolution, and
 *  `drawMarks` pays for that per mark; a page of forty objects should pay for it once. */
interface PaintInk {
  font: string;
  pageInk: string;
  hair: string;
}

function paintTokens(canvas: HTMLCanvasElement): PaintInk {
  // Read directly rather than through `resolveInk`, whose fallback is a COLOUR: handing `ctx.font` a
  // hex is a silently ignored assignment that leaves the previous font in place. `--font-ink` (a
  // Caveat handwriting face) was deleted from the design system, so it resolved to '' and typed text
  // fell back to the OS cursive face — `--font-ui` is the intended, always-defined UI stack.
  const family = getComputedStyle(canvas).getPropertyValue('--font-ui').trim();
  return {
    font: family || 'system-ui, sans-serif',
    pageInk: resolveInk('--page-ink', canvas),
    hair: resolveInk('--hair-2', canvas),
  };
}

/** Greedy wrap, honouring explicit newlines. See `textHeight` for why the bbox cannot do this. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

function paintStroke(
  ctx: CanvasRenderingContext2D,
  stroke: NbStroke,
  box: PageBox,
  live: boolean,
): void {
  const plan = renderPlan(stroke, box, live);
  if (plan.points.length === 0) return;
  const erasing = stroke.t === 'er';
  ctx.save();
  // `c` is never read by `destination-out`, which is exactly why it can double as the live preview
  // colour for the eraser.
  ctx.globalCompositeOperation = erasing && !live ? 'destination-out' : 'source-over';
  ctx.globalAlpha = erasing && live ? ERASER_PREVIEW_ALPHA : strokeOpacity(stroke);
  ctx.beginPath();
  ctx.moveTo(plan.points[0][0], plan.points[0][1]);
  for (let i = 1; i < plan.points.length; i++) ctx.lineTo(plan.points[i][0], plan.points[i][1]);
  if (plan.kind === 'ribbon') {
    ctx.strokeStyle = stroke.c;
    ctx.lineWidth = plan.width;
    // Butt caps: a chisel tip, and §5d draws the swipe as a plain bar.
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    // A zero-length butt-capped line paints nothing, so a tap gets one nib of width.
    if (plan.points.length === 1) ctx.lineTo(plan.points[0][0] + plan.width, plan.points[0][1]);
    ctx.stroke();
  } else {
    ctx.fillStyle = stroke.c;
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function paintObject(
  ctx: CanvasRenderingContext2D,
  obj: NbObject,
  box: PageBox,
  ink: PaintInk,
  assets?: ReadonlyMap<string, CanvasImageSource>,
): void {
  const x = obj.x * box.w;
  const y = obj.y * box.h;
  /** A width-fraction in pixels — nib weights, text sizes and the note's own px geometry. */
  const px = (fraction: number) => fraction * box.w;
  ctx.save();
  switch (obj.k) {
    case 'img': {
      const w = obj.w * box.w;
      const h = obj.h * box.h;
      if (obj.rot) {
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate((obj.rot * Math.PI) / 180);
        ctx.translate(-w / 2, -h / 2);
      } else ctx.translate(x, y);
      const asset = assets?.get(obj.sha);
      if (asset) ctx.drawImage(asset, 0, 0, w, h);
      else {
        // An asset that has not loaded yet, or one that is gone. An outline says so; a hole reads as
        // lost work.
        ctx.strokeStyle = ink.hair;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(0.5, 0.5, Math.max(1, w - 1), Math.max(1, h - 1));
      }
      break;
    }
    case 'text': {
      const size = px(obj.size);
      ctx.fillStyle = obj.c;
      ctx.font = `${size}px ${ink.font}`;
      ctx.textBaseline = 'top';
      wrapText(ctx, obj.s, px(obj.w)).forEach((line, i) =>
        ctx.fillText(line, x, y + i * size * LINE_HEIGHT),
      );
      break;
    }
    case 'shape': {
      const w = obj.w * box.w;
      const h = obj.h * box.h;
      ctx.strokeStyle = obj.c;
      ctx.lineWidth = Math.max(1, px(obj.sw));
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (obj.fill) ctx.fillStyle = obj.fill;
      if (obj.s === 'line' || obj.s === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + h);
        ctx.stroke();
        if (obj.s === 'arrow') {
          // The head scales with the WEIGHT, not the length, so a long arrow and a short one are
          // recognisably the same pen.
          const head = Math.max(6, ctx.lineWidth * 4);
          const angle = Math.atan2(h, w);
          ctx.beginPath();
          for (const spread of [-0.4, 0.4]) {
            ctx.moveTo(x + w, y + h);
            ctx.lineTo(x + w - head * Math.cos(angle + spread), y + h - head * Math.sin(angle + spread));
          }
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        if (obj.s === 'rect') ctx.rect(x, y, w, h);
        else ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
        if (obj.fill) ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case 'note': {
      // §5d: one flat colour with an edge of its own and `--page-ink` text. Both `--bell-gold` and
      // `--page-ink` are mode-invariant, which is right — a sticky is an object on the page, not
      // chrome, so it is the same yellow paper with the same dark ink in Day and Night.
      const w = obj.w * box.w;
      const h = obj.h * box.h;
      const pad = px(NOTE.pad / PAGE.w);
      const size = px(NOTE.text / PAGE.w);
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, px(NOTE.radius / PAGE.w));
      ctx.fillStyle = obj.c;
      ctx.fill();
      ctx.strokeStyle = obj.c;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = ink.pageInk;
      ctx.font = `${size}px ${ink.font}`;
      ctx.textBaseline = 'top';
      wrapText(ctx, obj.s, w - pad * 2).forEach((line, i) =>
        ctx.fillText(line, x + pad, y + pad + i * size * LINE_HEIGHT),
      );
      break;
    }
  }
  ctx.restore();
}

/**
 * Everything committed on the page. Repainted on commit, undo, redo or a page change — not on a move.
 *
 * ARRAY ORDER IS PAINT ORDER, and objects go last: an image, a sticky or a clipped question sits on
 * the page and occludes the ink under it. Which is also why a paint-mode eraser cannot rub out an
 * object — it composites `destination-out` during the strokes pass, before any object exists to cut.
 */
export function paintStatic(
  canvas: HTMLCanvasElement,
  page: NbPage,
  box: PageBox,
  assets?: ReadonlyMap<string, CanvasImageSource>,
  dpr = deviceRatio(),
): void {
  const ctx = surface(canvas, box, dpr);
  if (!ctx) return;
  ctx.clearRect(0, 0, box.w, box.h);
  paintRecords(ctx, canvas, page, box, assets);
}

/**
 * The two paint loops without the clear, so a caller that has already prepared a surface can draw a
 * set of records onto it — which is what the live canvas needs to preview a selection being dragged
 * or scaled. `canvas` is taken as well as `ctx` because `paintTokens` reads computed style off the
 * element, once, rather than per object.
 */
export function paintRecords(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  page: NbPage,
  box: PageBox,
  assets?: ReadonlyMap<string, CanvasImageSource>,
): void {
  for (const stroke of page.strokes) paintStroke(ctx, stroke, box, false);
  if (page.objects.length === 0) return;
  const ink = paintTokens(canvas);
  for (const obj of page.objects) paintObject(ctx, obj, box, ink, assets);
}

/** The in-progress stroke, and nothing else. One stroke's worth of work per frame. */
export function paintLive(
  canvas: HTMLCanvasElement,
  stroke: NbStroke | null,
  box: PageBox,
  dpr = deviceRatio(),
): void {
  const ctx = surface(canvas, box, dpr);
  if (!ctx) return;
  ctx.clearRect(0, 0, box.w, box.h);
  if (stroke) paintStroke(ctx, stroke, box, true);
}

