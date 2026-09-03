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
}: Props) {
  const pageCanvas = useRef<HTMLCanvasElement>(null);
  const inkCanvas = useRef<HTMLCanvasElement>(null);
  const draft = useRef<Mark | null>(null);
  const [size, setSize] = useState({ cssWidth: width, cssHeight: Math.round(width * 1.414) });
  const [rendering, setRendering] = useState(true);

  // Held in a ref so a fresh closure from the parent cannot invalidate the render effect and
  // re-rasterise the page for nothing.
  const rendered = useRef(onRendered);
  rendered.current = onRendered;

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
      } catch {
        // A cancelled render (page flipped mid-draw) is normal; nothing to report.
        if (!cancelled) setRendering(false);
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
    if (!tool || e.button !== 0) return;
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
        data-live={tool ? 'true' : undefined}
        aria-label={`Annotation layer for page ${page}`}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
      />
    </div>
  );
}
