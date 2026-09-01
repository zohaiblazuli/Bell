/**
 * Annotation ink for a rendered page.
 *
 * Points and stroke widths are stored as fractions of the page box, never pixels, so ink stays
 * put through zoom, window resizing and a different display's DPR. The drawing pass follows the
 * approach already proven in scambridge's PracticeSession: redraw every mark on change,
 * `destination-out` for the eraser, reduced alpha for the highlighter.
 */

export type Tool = 'pen' | 'hl' | 'er';

export interface Point {
  x: number;
  y: number;
}

export interface Mark {
  tool: Tool;
  color: string;
  /** Fraction of the page width, so zoom doesn't change how thick the pen feels. */
  width: number;
  points: Point[];
}

/** Page number -> the ink on it. */
export type PageInk = Record<number, Mark[]>;

/** The demo's ink blue and highlighter amber — the only two colours ink ever uses. */
export const PEN_COLOR = '#2f4bbf';
export const HL_COLOR = '#e8b248';

/** Widths expressed against the demo's 720px page, then normalised. */
const REFERENCE_PAGE = 720;
const WIDTHS: Record<Tool, number> = {
  pen: 2.4 / REFERENCE_PAGE,
  hl: 15 / REFERENCE_PAGE,
  er: 22 / REFERENCE_PAGE,
};

export function markFor(tool: Tool, first: Point): Mark {
  return {
    tool,
    color: tool === 'hl' ? HL_COLOR : PEN_COLOR,
    width: WIDTHS[tool],
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
    ctx.globalAlpha = mark.tool === 'hl' ? 0.3 : 1;
    ctx.strokeStyle = mark.color;
    ctx.lineWidth = Math.max(1, mark.width * rect.width);
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
