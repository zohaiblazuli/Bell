/**
 * One page of a notebook — three canvases and everything that draws on them.
 *
 * Spec: `design/specs/screen-notebooks.md` §5c (the page box, ruling, margin and gutter) and §5d
 * (what ends up on it). The engine is `src/lib/ink.ts`; this file is the DOM edge.
 *
 * THREE CANVASES, NOT ONE. `paper` carries the ruling and repaints only when the style, the margin
 * switch or the page size changes; `static` carries everything committed and repaints on a commit, an
 * undo or a page change; `live` carries the stroke in flight and nothing else. The Reader's single
 * canvas re-strokes every mark on the page on every pointermove, from a synchronous handler, after a
 * layout-forcing `getBoundingClientRect()` — which is the performance bug this split fixes.
 *
 * The page's CSS box is a fixed 455x644 and the whole spread is scaled by one transform, so the
 * backing store is sized by `devicePixelRatio x scale`: a scaled page stays sharp, and no geometry
 * anywhere has to know about zoom.
 *
 * Its CSS lives in `src/views/NotebookView.css` with the rest of the spread.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_ERASER_MODE,
  PAGE,
  StrokeBuilder,
  acceptsPointer,
  addObjectCmd,
  addStrokeCmd,
  createInkLoop,
  deleteCmd,
  eraseAt,
  hitTest,
  hitTestLasso,
  paintLive,
  paintPaper,
  paintStatic,
  recordBBox,
  samplePointer,
  transformCmd,
  translation,
  widthFraction,
  type InkCommand,
  type InkPoint,
  type PageBox,
  type PointerOwner,
  type Pt,
  type Ruler,
} from '@/lib/ink';
import { assetUrl } from '@/lib/clip';
import { resolveInk } from '@/lib/annotations';
import {
  q4,
  type NbInkSettings,
  type NbObject,
  type NbPage,
  type NbTool,
  type PaperStyle,
} from '@/lib/notebooks';

/** The page's own CSS box, before the spread's scale. Every fraction divides by these. */
const BOX: PageBox = { w: PAGE.w, h: PAGE.h };

/** How close a press has to be to count as a hit, as a fraction of the page width. */
const HIT_TOLERANCE = 0.012;

export interface Props {
  /** Disk page index. */
  index: number;
  side: 'l' | 'r';
  page: NbPage;
  notebook: string;
  paper: PaperStyle;
  margin: boolean;
  /** The spread's scale, folded into the canvas backing store so a scaled page is still sharp. */
  scale: number;
  tool: NbTool;
  ink: NbInkSettings;
  ruler: Ruler | null;
  onRuler: (ruler: Ruler | null) => void;
  onCommand: (command: InkCommand) => void;
  /** Ids selected on THIS page. Selection is per page: a lasso cannot cross the binding. */
  selection: readonly string[];
  onSelection: (ids: string[]) => void;
  /** Set during a page turn, so the sheet can animate without the view re-keying the canvases. */
  turn?: 'in' | 'out';
}

export default function NotebookPage({
  index,
  side,
  page,
  notebook,
  paper,
  margin,
  scale,
  tool,
  ink,
  ruler,
  onRuler,
  onCommand,
  selection,
  onSelection,
  turn,
}: Props) {
  const paperRef = useRef<HTMLCanvasElement>(null);
  const staticRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);

  /** The stroke in flight, the pointer that owns it, and the gesture it belongs to. */
  const builder = useRef<StrokeBuilder | null>(null);
  const owner = useRef<PointerOwner | null>(null);
  const lasso = useRef<Pt[] | null>(null);
  const drag = useRef<{ from: Pt; last: Pt } | null>(null);
  const shape = useRef<{ from: Pt; to: Pt } | null>(null);
  const rulerDraft = useRef<{ from: Pt; to: Pt } | null>(null);
  /** Erased strokes accumulate across one swipe, so the whole swipe is a single undo step. */
  const erased = useRef<ReturnType<typeof eraseAt>['removed']>([]);

  /** A text or sticky note being typed, positioned in page fractions. */
  const [editing, setEditing] = useState<{ at: Pt; kind: 'text' | 'note' } | null>(null);

  const dpr = useMemo(
    () => (typeof window === 'undefined' ? 1 : (window.devicePixelRatio || 1) * scale),
    [scale],
  );

  /* --- assets ------------------------------------------------------------- */

  /**
   * Decoded images for this page's `img` objects, by sha. Content-addressed, so the same clip pasted
   * on two pages is decoded once per page and fetched once per notebook.
   *
   * The set of shas is derived as a sorted STRING rather than an array, so the effect re-runs when the
   * page's images actually change and not on every stroke — `page.objects` is a new array on each
   * commit, and depending on it would refetch every image per sample.
   */
  const [assets, setAssets] = useState<Map<string, HTMLImageElement>>(new Map());
  const shaKey = useMemo(
    () =>
      page.objects
        .filter((o) => o.k === 'img')
        .map((o) => (o as { sha: string }).sha)
        .sort()
        .join(','),
    [page.objects],
  );

  useEffect(() => {
    const shas = shaKey ? shaKey.split(',') : [];
    if (shas.length === 0) return;
    let cancelled = false;
    const urls: string[] = [];
    void (async () => {
      const loaded: [string, HTMLImageElement][] = [];
      for (const sha of shas) {
        try {
          const url = await assetUrl(notebook, sha);
          urls.push(url);
          const img = new Image();
          await new Promise<void>((done) => {
            img.onload = () => done();
            img.onerror = () => done();
            img.src = url;
          });
          loaded.push([sha, img]);
        } catch {
          /* A missing asset leaves a gap on the page rather than failing the whole render. */
        }
      }
      if (cancelled) return;
      setAssets((prev) => {
        // Only add: an image already decoded is the same bytes, because the name IS the hash.
        const next = new Map(prev);
        for (const [sha, img] of loaded) if (!next.has(sha)) next.set(sha, img);
        return next;
      });
    })();
    return () => {
      cancelled = true;
      // Revoked on the way out, not on the way in: an <img> keeps its own decoded copy, so holding
      // the URL any longer would leak one blob per clip per page turn.
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [shaKey, notebook]);

  /* --- painting ----------------------------------------------------------- */

  useEffect(() => {
    if (paperRef.current) paintPaper(paperRef.current, paper, BOX, margin, dpr);
  }, [paper, margin, dpr]);

  useEffect(() => {
    if (staticRef.current) paintStatic(staticRef.current, page, BOX, assets, dpr);
  }, [page, assets, dpr]);

  /**
   * One rAF per frame however many moves arrive. The move handler only appends and marks; this is the
   * single place a frame's worth of pointer input becomes pixels.
   *
   * The overlay painter is reached through a ref rather than closed over, so changing a slider does not
   * rebuild the loop — recreating it mid-stroke would drop the frame already scheduled.
   */
  const overlay = useRef<(canvas: HTMLCanvasElement) => void>(() => {});
  const loop = useMemo(
    () =>
      createInkLoop(() => {
        const canvas = liveRef.current;
        if (!canvas) return;
        if (builder.current && builder.current.count > 0) {
          paintLive(canvas, builder.current.finish(), BOX, dpr);
          return;
        }
        overlay.current(canvas);
      }),
    [dpr],
  );

  useEffect(() => () => loop.stop(), [loop]);

  /** The lasso path, a shape preview, the ruler and the selection frame — everything transient. */
  const paintOverlay = useCallback(
    (canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = Math.max(1, Math.round(BOX.w * dpr));
      const h = Math.max(1, Math.round(BOX.h * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, BOX.w, BOX.h);

      const accent = resolveInk('--accent', canvas);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
      ctx.lineJoin = 'round';

      const path = lasso.current;
      if (path && path.length > 1) {
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        path.forEach((p, i) =>
          i === 0 ? ctx.moveTo(p.x * BOX.w, p.y * BOX.h) : ctx.lineTo(p.x * BOX.w, p.y * BOX.h),
        );
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      const box = shape.current;
      if (box) {
        ctx.save();
        ctx.strokeStyle = resolveInk(ink.colour, canvas);
        ctx.lineWidth = Math.max(1, widthFraction(ink.strokePx) * BOX.w);
        drawShape(ctx, ink, box);
        ctx.restore();
      }

      const guide = rulerDraft.current;
      if (guide) {
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(guide.from.x * BOX.w, guide.from.y * BOX.h);
        ctx.lineTo(guide.to.x * BOX.w, guide.to.y * BOX.h);
        ctx.stroke();
        ctx.restore();
      }
    },
    [dpr, ink],
  );
  overlay.current = paintOverlay;

  /**
   * §5d's live lasso selection: a dashed accent box with four 7px corner handles. Painted on the live
   * canvas so it costs nothing when nothing is selected — and it is the whole answer to "you cannot
   * select anything the Reader has drawn".
   */
  useEffect(() => {
    const canvas = liveRef.current;
    if (!canvas) return;
    if (builder.current) return;
    paintOverlay(canvas);
    if (selection.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const records = [...page.strokes, ...page.objects].filter((r) => selection.includes(r.id));
    if (records.length === 0) return;
    const boxes = records.map(recordBBox);
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    const right = Math.max(...boxes.map((b) => b.x + b.w));
    const bottom = Math.max(...boxes.map((b) => b.y + b.h));
    const accent = resolveInk('--accent', canvas);
    const pad = 6;
    const px = x * BOX.w - pad;
    const py = y * BOX.h - pad;
    const pw = (right - x) * BOX.w + pad * 2;
    const ph = (bottom - y) * BOX.h + pad * 2;
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(px, py, pw, ph);
    ctx.setLineDash([]);
    ctx.fillStyle = resolveInk('--paper', canvas);
    ctx.lineWidth = 1.5;
    for (const [hx, hy] of [
      [px, py],
      [px + pw, py],
      [px, py + ph],
      [px + pw, py + ph],
    ]) {
      ctx.beginPath();
      ctx.roundRect(hx - 3.5, hy - 3.5, 7, 7, 1.5);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }, [selection, page, paintOverlay]);

  /* --- pointer ------------------------------------------------------------ */

  const fractionOf = (e: { clientX: number; clientY: number }, el: HTMLElement): Pt => {
    const rect = el.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  };

  const sample = (e: React.PointerEvent<HTMLCanvasElement>): InkPoint[] =>
    samplePointer(e.nativeEvent, e.currentTarget.getBoundingClientRect());

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    // Palm rejection lives in the engine: a pen that is down owns the surface, and while anything is
    // drawing only that pointer is heard.
    if (!acceptsPointer(e.nativeEvent, owner.current)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    owner.current = { pointerId: e.pointerId, pointerType: e.pointerType };
    const at = fractionOf(e, e.currentTarget);

    switch (tool) {
      case 'pen':
      case 'pencil':
      case 'hl': {
        // The canvas is the tone context — it sits inside `.app` — so the token resolves to the
        // literal for the tone the stroke is actually being drawn in, and is frozen into the record.
        const seed = {
          t: tool,
          c: resolveInk(ink.colour, e.currentTarget),
          w: widthFraction(ink.strokePx),
          o: ink.opacity,
          n: ink.nib,
          sm: ink.smoothing,
        };
        builder.current = new StrokeBuilder(seed, {
          pressure: ink.pressure,
          lock: ink.straightLock,
          ruler: ink.snapRuler ? ruler : null,
        });
        const points = sample(e);
        builder.current.begin(points[0] ?? { ...at, pressure: 0.5 });
        if (points.length > 1) builder.current.extend(points.slice(1));
        loop.mark();
        break;
      }
      case 'er': {
        if (ink.eraser === 'paint') {
          builder.current = new StrokeBuilder(
            {
              t: 'er',
              c: resolveInk('--paper', e.currentTarget),
              w: widthFraction(Math.max(ink.strokePx, 18)),
              n: 'marker',
            },
            { pressure: false, lock: false, ruler: null },
          );
          builder.current.begin(sample(e)[0] ?? { ...at, pressure: 0.5 });
        } else {
          erased.current = [];
          rub(at);
        }
        loop.mark();
        break;
      }
      case 'lasso': {
        const hit = hitTest(page, at, HIT_TOLERANCE);
        if (hit && selection.includes(hit.id)) {
          drag.current = { from: at, last: at };
        } else if (hit) {
          onSelection([hit.id]);
          drag.current = { from: at, last: at };
        } else {
          onSelection([]);
          lasso.current = [at];
        }
        loop.mark();
        break;
      }
      case 'shapes':
        shape.current = { from: at, to: at };
        loop.mark();
        break;
      case 'ruler':
        rulerDraft.current = { from: at, to: at };
        loop.mark();
        break;
      case 'text':
      case 'sticky':
        setEditing({ at, kind: tool === 'text' ? 'text' : 'note' });
        owner.current = null;
        break;
      case 'image':
        // Nothing to draw: the image tool is the paste / drop / clip target, and the spread's own
        // handlers own those. Said in the dock's tooltip rather than by a dead press here.
        owner.current = null;
        break;
    }
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!owner.current || e.pointerId !== owner.current.pointerId) return;
    const at = fractionOf(e, e.currentTarget);

    if (builder.current) {
      builder.current.extend(sample(e));
      loop.mark();
      return;
    }
    if (tool === 'er') {
      rub(at);
      return;
    }
    if (lasso.current) {
      lasso.current.push(at);
      loop.mark();
      return;
    }
    if (drag.current) {
      drag.current.last = at;
      loop.mark();
      return;
    }
    if (shape.current) {
      shape.current.to = at;
      loop.mark();
      return;
    }
    if (rulerDraft.current) {
      rulerDraft.current.to = at;
      loop.mark();
    }
  }

  function up() {
    const stroke = builder.current;
    builder.current = null;

    if (stroke) {
      if (stroke.count > 1 || tool !== 'er') onCommand(addStrokeCmd(index, stroke.finish()));
      finishGesture();
      return;
    }
    if (erased.current.length > 0) {
      // One swipe, one undo step — and the removed records carry the index they sat at, so an undo
      // puts each back in its own z position rather than on top.
      const ids = erased.current.map((entry) => entry.rec.id);
      const before: NbPage = {
        ...page,
        strokes: [...page.strokes, ...erased.current.map((entry) => entry.rec)],
      };
      onCommand(deleteCmd(index, before, ids));
      erased.current = [];
      finishGesture();
      return;
    }
    if (lasso.current) {
      const path = lasso.current;
      lasso.current = null;
      if (path.length > 2) onSelection(hitTestLasso(page, path).map((r) => r.id));
      finishGesture();
      return;
    }
    if (drag.current) {
      const { from, last } = drag.current;
      drag.current = null;
      const dx = q4(last.x - from.x);
      const dy = q4(last.y - from.y);
      if (dx !== 0 || dy !== 0) {
        onCommand(transformCmd(index, page, selection, translation(dx, dy)));
      }
      finishGesture();
      return;
    }
    if (shape.current) {
      const box = shape.current;
      shape.current = null;
      const el = liveRef.current;
      const object = el ? shapeObject(ink, box, el) : null;
      if (object) onCommand(addObjectCmd(index, object));
      finishGesture();
      return;
    }
    if (rulerDraft.current) {
      const { from, to } = rulerDraft.current;
      rulerDraft.current = null;
      const dx = (to.x - from.x) * BOX.w;
      const dy = (to.y - from.y) * BOX.h;
      // A tap rather than a drag clears the guide, which is how you put the ruler away.
      if (Math.hypot(dx, dy) < 8) onRuler(null);
      else onRuler({ x: from.x, y: from.y, angle: (Math.atan2(dy, dx) * 180) / Math.PI });
      finishGesture();
    }
  }

  function finishGesture() {
    owner.current = null;
    loop.mark();
  }

  /** One erase step. Accumulated across the swipe so the whole rub is one undo. */
  function rub(at: Pt) {
    if (ink.eraser === 'paint') return;
    const radius = widthFraction(Math.max(ink.strokePx, 18)) / 2;
    const result = eraseAt(page, at, radius, DEFAULT_ERASER_MODE);
    if (result.removed.length === 0) return;
    erased.current = [...erased.current, ...result.removed];
    // Painted immediately from the reduced page rather than waiting for the commit, so the rubber
    // feels like a rubber. The commit at pointer-up is what makes it an edit.
    if (staticRef.current) paintStatic(staticRef.current, result.page, BOX, assets, dpr);
  }

  /* --- the inline editor for text and sticky notes ------------------------- */

  const commitText = useCallback(
    (value: string) => {
      const spot = editing;
      setEditing(null);
      const text = value.trim();
      if (!spot || !text || !liveRef.current) return;
      const el = liveRef.current;
      const colour =
        spot.kind === 'note' ? resolveInk('--bell-gold', el) : resolveInk(ink.colour, el);
      const object: NbObject =
        spot.kind === 'note'
          ? {
              id: `note-${Date.now().toString(36)}`,
              k: 'note',
              s: text,
              x: q4(spot.at.x),
              y: q4(spot.at.y),
              w: q4(116 / PAGE.w),
              h: q4(104 / PAGE.h),
              c: colour,
            }
          : {
              id: `text-${Date.now().toString(36)}`,
              k: 'text',
              s: text,
              x: q4(spot.at.x),
              y: q4(spot.at.y),
              w: q4(Math.min(0.6, 1 - spot.at.x - 0.08)),
              size: q4(widthFraction(16)),
              c: colour,
            };
      onCommand(addObjectCmd(index, object));
    },
    [editing, index, ink.colour, onCommand],
  );

  const armed = tool !== 'image';

  return (
    <div className="nbs-page" data-side={side} data-armed={armed} data-turn={turn}>
      <canvas ref={paperRef} className="nbs-layer" data-layer="paper" aria-hidden="true" />
      <canvas ref={staticRef} className="nbs-layer" data-layer="static" aria-hidden="true" />
      <div className="nbs-fold" aria-hidden="true" />
      <canvas
        ref={liveRef}
        className="nbs-layer"
        data-layer="live"
        role="img"
        aria-label={`Page ${index + 2}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      {editing && (
        <textarea
          className="nbs-typing"
          data-kind={editing.kind}
          autoFocus
          style={{
            left: `${editing.at.x * 100}%`,
            top: `${editing.at.y * 100}%`,
          }}
          onBlur={(e) => commitText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setEditing(null);
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              commitText((e.target as HTMLTextAreaElement).value);
            }
          }}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── shapes ───────────────────────── */

/** Which of §5d's four shapes the STROKE card's current settings make. */
function shapeKind(ink: NbInkSettings): 'line' | 'arrow' | 'rect' | 'ellipse' {
  // The dock has one `shapes` button and the file draws a line, an arrow, a rect and an ellipse on
  // page 12's free-body diagram. Cycling would be a hidden mode, so the nib doubles as the picker:
  // the four nibs map to the four shapes, which keeps one visible control for one choice.
  switch (ink.nib) {
    case 'fountain':
      return 'line';
    case 'ballpoint':
      return 'arrow';
    case 'pencil':
      return 'rect';
    default:
      return 'ellipse';
  }
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  ink: NbInkSettings,
  box: { from: Pt; to: Pt },
): void {
  const x1 = box.from.x * PAGE.w;
  const y1 = box.from.y * PAGE.h;
  const x2 = box.to.x * PAGE.w;
  const y2 = box.to.y * PAGE.h;
  ctx.beginPath();
  switch (shapeKind(ink)) {
    case 'line':
    case 'arrow':
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      break;
    case 'rect':
      ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      break;
    default:
      ctx.ellipse(
        (x1 + x2) / 2,
        (y1 + y2) / 2,
        Math.abs(x2 - x1) / 2,
        Math.abs(y2 - y1) / 2,
        0,
        0,
        Math.PI * 2,
      );
  }
  ctx.stroke();
}

function shapeObject(
  ink: NbInkSettings,
  box: { from: Pt; to: Pt },
  context: HTMLElement,
): NbObject | null {
  const w = box.to.x - box.from.x;
  const h = box.to.y - box.from.y;
  // A click is not a shape. 4px on a 455-wide page, the same threshold the marquee uses.
  if (Math.abs(w) * PAGE.w < 4 && Math.abs(h) * PAGE.h < 4) return null;
  const kind = shapeKind(ink);
  const line = kind === 'line' || kind === 'arrow';
  return {
    id: `shape-${Date.now().toString(36)}`,
    k: 'shape',
    s: kind,
    // A line keeps its direction — its w and h are signed, so an arrow drawn up-left points up-left.
    // A rect and an ellipse are normalised, because a negative box has no meaning once it is drawn.
    x: q4(line ? box.from.x : Math.min(box.from.x, box.to.x)),
    y: q4(line ? box.from.y : Math.min(box.from.y, box.to.y)),
    w: q4(line ? w : Math.abs(w)),
    h: q4(line ? h : Math.abs(h)),
    // Resolved against the canvas, which sits inside `.app`, so a Night stroke freezes the Night
    // literal — the rule `annotations.ts` documents at length, and why there is no hex fallback here.
    c: resolveInk(ink.colour, context),
    sw: q4(widthFraction(ink.strokePx)),
  };
}

