import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { renderPage } from '../lib/pdf';
import { drawMarks, markFor, type Mark, type Point, type Tool } from '../lib/annotations';

interface Props {
  doc: PDFDocumentProxy | null;
  page: number;
  /** Target width in logical pixels — zoom is applied by the caller. */
  width: number;
  /** null puts the page in read-only mode; the overlay stops taking pointer events. */
  tool: Tool | null;
  marks: Mark[];
  onCommit: (mark: Mark) => void;
}

/** The white page — always the brightest, highest-contrast thing on screen — plus its ink. */
export default function PaperCanvas({ doc, page, width, tool, marks, onCommit }: Props) {
  const pageCanvas = useRef<HTMLCanvasElement>(null);
  const inkCanvas = useRef<HTMLCanvasElement>(null);
  const draft = useRef<Mark | null>(null);
  const [size, setSize] = useState({ cssWidth: width, cssHeight: Math.round(width * 1.414) });
  const [rendering, setRendering] = useState(true);

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
    draft.current = markFor(tool, pointAt(e));
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
      className="paper"
      style={{ width: size.cssWidth, height: size.cssHeight }}
      data-rendering={rendering ? 'true' : undefined}
    >
      <canvas ref={pageCanvas} className="paper-page" />
      <canvas
        ref={inkCanvas}
        className="paper-ink"
        aria-label={`Annotation layer for page ${page}`}
        style={{
          pointerEvents: tool ? 'auto' : 'none',
          cursor: tool ? 'crosshair' : 'default',
          touchAction: 'none',
        }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
      />
    </div>
  );
}
