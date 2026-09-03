/**
 * Annotation ink for a rendered page.
 *
 * Spec: `design/specs/screen-reader.md` §1 — the six-swatch ink palette on the `tools` card
 * (`198:32`) — and §7b, the 5 / 8 / 12 stroke picker and the opacity meter beside it.
 *
 * Points and stroke widths are stored as fractions of the page box, never pixels, so ink stays
 * put through zoom, window resizing and a different display's DPR. The drawing pass follows the
 * approach already proven in scambridge's PracticeSession: redraw every mark on change,
 * `destination-out` for the eraser, reduced alpha for the highlighter.
 *
 * THE COLOUR IS A FROZEN LITERAL, NOT A TOKEN, and that is the whole design. Ink is printed on
 * the white paper, so it must never invert with the tone, and `mark.color` is the source of truth
 * for every stroke ever drawn. The palette *names* tokens because that is what Figma authors, but
 * the draw site resolves the chosen token against the live tone exactly once and writes the
 * resulting literal into the mark. A stroke therefore keeps the colour it was drawn in for ever,
 * and no saved file has to be migrated, rewritten or re-derived. That also covers the two
 * pre-palette constants the Reader shipped with (`#2f4bbf` pen, `#e8b248` highlighter, both
 * absent from the Figma file — spec TRAP 1): they live on in the `color` field of the marks that
 * used them, which is the only place they were ever needed.
 *
 * `width` and `opacity` are OPTIONAL for the same reason. Marks saved before the palette existed
 * carry no opacity at all, and `markWidth` / `markOpacity` fall back to precisely what the
 * pre-palette build painted — so an old paper renders identically before and after this change.
 */

export type Tool = 'pen' | 'hl' | 'er';

export interface Point {
  x: number;
  y: number;
}

export interface Mark {
  tool: Tool;
  /** The literal this stroke was drawn with. Resolved from a palette token once, then never touched. */
  color: string;
  /** Fraction of the page width, so zoom doesn't change how thick the pen feels. */
  width?: number;
  /** `globalAlpha`, 0..1. Absent on ink drawn before the opacity control existed. */
  opacity?: number;
  points: Point[];
}

/** Page number -> the ink on it. */
export type PageInk = Record<number, Mark[]>;

export interface InkSwatch {
  /** The CSS custom property Figma binds, e.g. `--iris-3`. Resolved to a literal at the draw site. */
  token: string;
  /**
   * The accessible name. Deliberately generic rather than a colour word derived from the hex:
   * `--d2` and `--d5` retone between Day and Night (§1), so "amber" would be a lie in Day.
   */
  label: string;
}

/**
 * §1's palette, in the file's own slot order. Slot 1 (`--iris-3`) is the one the comp shows
 * selected, so it is the default ink. Four of the six are `--iris-*` / `--page-ink`, which never
 * retone; the two heat tokens do, which is exactly why the drawn literal is frozen per stroke.
 */
export const INK_SWATCHES: readonly InkSwatch[] = [
  { token: '--iris-3', label: 'Brand blue' },
  { token: '--iris-1', label: 'Light blue' },
  { token: '--iris-2', label: 'Bright blue' },
  { token: '--d2', label: 'Orange' },
  { token: '--d5', label: 'Red' },
  { token: '--page-ink', label: 'Graphite' },
] as const;

/** §7b's stroke picker: three nibs, in reference-page px (see `REFERENCE_PAGE`). */
export const STROKE_WIDTHS = [5, 8, 12] as const;
export type StrokeWidth = (typeof STROKE_WIDTHS)[number];

/** The `8 px` the comp's readout prints, and the middle dot it lights in `--accent`. */
export const DEFAULT_STROKE: StrokeWidth = 8;

/**
 * §7b's opacity meter reads 45% with the Highlighter selected, while every pen mark in §1 sits at
 * node opacity 1. So the default is per tool rather than one number: one control, seeded so that
 * picking up the pen does not hand you a 45% pen. The eraser's 1 reproduces today's behaviour —
 * a lower value fades ink instead of lifting it, which is a real effect, just not the default one.
 */
export const DEFAULT_OPACITY: Record<Tool, number> = { pen: 1, hl: 0.45, er: 1 };

/** Widths are expressed against this page width, then normalised into a fraction. */
const REFERENCE_PAGE = 720;

/**
 * What `markFor` handed every mark before the width picker existed. These are the numbers that
 * make a pre-palette file render identically today, so they are frozen: retuning a nib belongs in
 * `STROKE_WIDTHS`, which only ever touches new ink.
 */
const LEGACY_WIDTHS: Record<Tool, number> = {
  pen: 2.4 / REFERENCE_PAGE,
  hl: 15 / REFERENCE_PAGE,
  er: 22 / REFERENCE_PAGE,
};

export const strokeFraction = (px: number) => px / REFERENCE_PAGE;

export const markWidth = (mark: Mark) => mark.width ?? LEGACY_WIDTHS[mark.tool];

export const markOpacity = (mark: Mark) => mark.opacity ?? (mark.tool === 'hl' ? 0.3 : 1);

/** What the tools card currently has selected. The nib is px; the canvas normalises it. */
export interface InkSettings {
  /** One of `INK_SWATCHES`'s tokens. */
  token: string;
  strokePx: number;
  opacity: number;
}

/**
 * Read a palette token off the live tone.
 *
 * `context` has to be an element inside `.app`, because that is where the Night overrides are
 * declared — resolving against `documentElement` answers Day in both tones and would silently
 * freeze the wrong literal into every Night stroke.
 */
export function resolveInk(token: string, context: Element): string {
  const style = getComputedStyle(context);
  const value = style.getPropertyValue(token).trim();
  // An unresolvable token would leave the canvas painting with whatever `strokeStyle` was set
  // last, which is worse than a substitute. `--page-ink` is the palette's own neutral and exists
  // in both tones; the CSS keyword behind it is unreachable once tokens.css has loaded.
  return value || style.getPropertyValue('--page-ink').trim() || 'black';
}

export function markFor(tool: Tool, first: Point, ink: InkSettings, context: Element): Mark {
  return {
    tool,
    color: resolveInk(ink.token, context),
    width: strokeFraction(ink.strokePx),
    opacity: ink.opacity,
    points: [first],
  };
}

export function drawMarks(canvas: HTMLCanvasElement, marks: Mark[]): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  for (const mark of marks) {
    if (mark.points.length === 0) continue;
    ctx.save();
    ctx.globalCompositeOperation = mark.tool === 'er' ? 'destination-out' : 'source-over';
    // Node opacity, not a blend mode. §1 measures every highlighter swipe as NORMAL at a reduced
    // node opacity, and spec TRAP 2 is explicit that `multiply` reads darker than the mock.
    ctx.globalAlpha = markOpacity(mark);
    ctx.strokeStyle = mark.color;
    ctx.lineWidth = Math.max(1, markWidth(mark) * rect.width);
    ctx.lineCap = mark.tool === 'hl' ? 'butt' : 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    mark.points.forEach((p, i) => {
      const x = p.x * rect.width;
      const y = p.y * rect.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    // A single tap still leaves a dot.
    if (mark.points.length === 1) {
      const p = mark.points[0];
      ctx.lineTo(p.x * rect.width + 0.01, p.y * rect.height + 0.01);
    }
    ctx.stroke();
    ctx.restore();
  }
}

/** Does this page have any ink worth saving? */
export const hasInk = (ink: PageInk) => Object.values(ink).some((marks) => marks.length > 0);
