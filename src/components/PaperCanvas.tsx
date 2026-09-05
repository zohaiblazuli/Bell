/**
 * The white page and its ink. Spec: `design/specs/screen-reader.md` §6 (`paper` `194:741` — fill
 * `--paper`, radius 3, clip) and §1 (the `annotations` layer that paints over it).
 *
 * Two stacked canvases rather than one: the PDF is re-rendered only when the page or the zoom
 * changes, while ink is redrawn on every pointer move, and compositing them separately is what
 * keeps a long stroke from re-rasterising the page under it. Figma models the same split —
 * `annotations` `200:89` is a sibling frame laid over `doc`, not part of it.
 *
 * Its CSS lives in `src/views/WorkspaceView.css` with the rest of the Reader: this component is
 * only ever mounted by `WorkspaceView`, which imports that sheet.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { renderPage } from '../lib/pdf';
import { cropLayers, type ClipRect } from '../lib/clip';
import {
  drawMarks,
  markFor,
  type InkSettings,
  type Mark,
  type Point,
  type Tool,
} from '../lib/annotations';

export interface Props {
  doc: PDFDocumentProxy | null;
  page: number;
  /** Target width in logical pixels — zoom is applied by the caller. */
  width: number;
  /** null puts the page in read-only mode; the overlay stops taking pointer events. */
  tool: Tool | null;
  /** Colour, nib and opacity as the tools card has them set. Frozen into each new mark. */
  ink: InkSettings;
  marks: Mark[];
  onCommit: (mark: Mark) => void;
  /**
   * Fired when a page has finished rasterising. The page rail uses it to hold its thumbnails back
   * until the page you are actually reading is on screen — pdf.js serialises on one worker, so
   * thumbnails started earlier would queue in front of it.
   */
  onRendered?: () => void;
  /**
   * A page could not be rasterised. Optional, and only the mark-scheme sheet passes one: a destroyed
   * document used to show up there as a column of blank sheets with nothing saying why, so that sheet
   * reports the failure instead of swallowing it. The Reader leaves it unset — a cancelled render is
   * the normal outcome of flipping pages, and it has its own error state for a document that will not
   * open at all.
   */
  onError?: (message: string) => void;
  /**
   * Clip mode: a marquee takes the page's pointer events instead of the ink layer, and releasing
   * hands back a PNG of the dragged region. It suppresses drawing entirely rather than layering on
   * top of it — one drag cannot mean both "write here" and "keep this".
   */
  clipping?: boolean;
  onClip?: (png: Blob) => void;
}

export default function PaperCanvas({
  doc,
  page,
  width,
  tool,
  ink,
  marks,
  onCommit,
  onRendered,
  onError,
  clipping,
  onClip,
}: Props) {
  const pageCanvas = useRef<HTMLCanvasElement>(null);
  const inkCanvas = useRef<HTMLCanvasElement>(null);
  const draft = useRef<Mark | null>(null);
  const [size, setSize] = useState({ cssWidth: width, cssHeight: Math.round(width * 1.414) });
  const [rendering, setRendering] = useState(true);
  /** The live marquee, in fractions of the page box. Null when no drag is in flight. */
  const [marquee, setMarquee] = useState<ClipRect | null>(null);
  const clipStart = useRef<Point | null>(null);

  // Held in a ref so a fresh closure from the parent cannot invalidate the render effect and
  // re-rasterise the page for nothing.
  const rendered = useRef(onRendered);
  rendered.current = onRendered;
  const failed = useRef(onError);
  failed.current = onError;

  useEffect(() => {
    if (!doc) return;
    const canvas = pageCanvas.current;
    if (!canvas) return;

    let cancelled = false;
    setRendering(true);
    void (async () => {
      try {
        const next = await renderPage(doc, page, canvas, width);
        if (!cancelled) {
          setSize(next);
          setRendering(false);
          rendered.current?.();
        }
      } catch (e) {
        // A cancelled render (page flipped mid-draw) is normal, and `renderPage` already swallows
        // that one; anything reaching here is real, so a caller that wants to know is told.
        if (!cancelled) {
          setRendering(false);
          failed.current?.(String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, page, width]);

  // Ink is redrawn whenever the marks or the page box change.
  useEffect(() => {
    const canvas = inkCanvas.current;
    if (!canvas) return;
    drawMarks(canvas, draft.current ? [...marks, draft.current] : marks);
  }, [marks, size.cssWidth, size.cssHeight]);

  function pointAt(e: ReactPointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  }

  function redraw() {
    const canvas = inkCanvas.current;
    if (canvas) drawMarks(canvas, draft.current ? [...marks, draft.current] : marks);
  }

  function start(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!tool || clipping || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    // The canvas is the tone context: it sits inside `.app`, so the swatch token resolves to the
    // literal for the tone the stroke is actually being drawn in.
    draft.current = markFor(tool, pointAt(e), ink, e.currentTarget);
    redraw();
  }

  function move(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!draft.current) return;
    const p = pointAt(e);
    const last = draft.current.points[draft.current.points.length - 1];
    // Skip sub-pixel jitter so a long stroke doesn't store hundreds of identical points.
    if (Math.abs(p.x - last.x) * size.cssWidth < 0.7 && Math.abs(p.y - last.y) * size.cssHeight < 0.7)
      return;
    draft.current.points.push(p);
    redraw();
  }

  function finish() {
    const mark = draft.current;
    draft.current = null;
    if (mark) onCommit(mark);
  }

  /* --- clip mode ---------------------------------------------------------- */

  /** A drag smaller than this is a mis-click, not a region. Fractions of the page box. */
  const MIN_CLIP = 0.02;

  const rectBetween = (a: Point, b: Point): ClipRect => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  });

  function clipStartAt(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointIn(e.currentTarget, e);
    clipStart.current = p;
    setMarquee({ x: p.x, y: p.y, w: 0, h: 0 });
  }

  function clipMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!clipStart.current) return;
    setMarquee(rectBetween(clipStart.current, pointIn(e.currentTarget, e)));
  }

  function clipFinish(e: ReactPointerEvent<HTMLDivElement>) {
    const from = clipStart.current;
    clipStart.current = null;
    setMarquee(null);
    if (!from) return;
    const rect = rectBetween(from, pointIn(e.currentTarget, e));
    if (rect.w < MIN_CLIP || rect.h < MIN_CLIP) return;

    const layers = [pageCanvas.current, inkCanvas.current].filter(
      (c): c is HTMLCanvasElement => c != null,
    );
    // Both layers, in paint order, so a clip keeps the highlight that is half the reason for
    // keeping the question.
    void cropLayers(layers, rect)
      .then((png) => onClip?.(png))
      .catch(() => {});
  }

  /** A pointer position as a fraction of an element's own box. */
  function pointIn(el: HTMLElement, e: { clientX: number; clientY: number }): Point {
    const box = el.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
    };
  }

  return (
    <div
      className="rd-paper"
      style={{ width: size.cssWidth, height: size.cssHeight }}
      data-rendering={rendering ? 'true' : undefined}
    >
      <canvas ref={pageCanvas} className="rd-paper-page" />
      <canvas
        ref={inkCanvas}
        className="rd-paper-ink"
        data-live={tool && !clipping ? 'true' : undefined}
        aria-label={`Annotation layer for page ${page}`}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
      />
      {clipping && (
        <div
          className="rd-clip"
          role="application"
          aria-label={`Drag a box around the part of page ${page} to keep`}
          onPointerDown={clipStartAt}
          onPointerMove={clipMove}
          onPointerUp={clipFinish}
          onPointerCancel={clipFinish}
        >
          {marquee && (
            <span
              className="rd-clip-box"
              style={{
                left: `${marquee.x * 100}%`,
                top: `${marquee.y * 100}%`,
                width: `${marquee.w * 100}%`,
                height: `${marquee.h * 100}%`,
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
