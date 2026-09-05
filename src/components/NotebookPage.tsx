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
  deleteRecords,
  eraseAt,
  hitTest,
  hitTestLasso,
  NIB_FOR_TOOL,
  paintLive,
  paintPaper,
  paintRecords,
  paintStatic,
  paintedBBox,
  samplePointer,
  scaling,
  transformCmd,
  transformObject,
  transformStroke,
  translation,
  unionBBox,
  widthFraction,
  type Affine,
  type InkCommand,
  type InkPoint,
  type PageBox,
  type Placed,
  type PointerOwner,
  type Pt,
  type Rect,
  type Ruler,
} from '@/lib/ink';
import { assetUrl } from '@/lib/clip';
import { resolveInk } from '@/lib/annotations';
import {
  pageLabel,
  q4,
  type NbInkSettings,
  type NbObject,
  type NbPage,
  type NbStroke,
  type NbTool,
  type PaperStyle,
} from '@/lib/notebooks';

/** The page's own CSS box, before the spread's scale. Every fraction divides by these. */
const BOX: PageBox = { w: PAGE.w, h: PAGE.h };

/** How close a press has to be to count as a hit, as a fraction of the page width. */
const HIT_TOLERANCE = 0.012;

/**
 * The longest edge a backing store may reach, in device pixels.
 *
 * `devicePixelRatio x scale` is unbounded above by anything in the view — `MAX_FIT` 2.5 times the top
 * zoom of 1.6 is a scale of 4 — and a canvas past the GPU's maximum texture size is silently demoted
 * to a software surface, which is slower than the sharpness is worth. 4096 is the common floor for
 * that limit and still ~6x device pixels on a 644-tall page.
 */
const MAX_BACKING_PX = 4096;

/** Half the side of §5d's 7px corner handle, and how close a press has to land to take one. */
const HANDLE = 3.5;
const HANDLE_GRAB = 9;

/** How far the selection frame sits outside the ink it encloses, in px. */
const FRAME_PAD = 6;

/** The editor boxes, in the page's own px — see `.nbs-typing`. A spot is clamped so neither the box nor
 *  the object it commits can be opened into the sliver `.nbs-page`'s `overflow: hidden` leaves. */
const TYPING = { text: { w: 240, h: 44 }, note: { w: 116, h: 104 } } as const;

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
  /** A selection being moved. `ids` rather than the prop, because a press can select and start dragging
   *  in one gesture, before the selection has come back down as a prop. */
  const drag = useRef<{ ids: string[]; from: Pt; last: Pt } | null>(null);
  /** A corner handle being pulled: the anchor it scales about, the corner it started from, and the two
   *  independent factors `scaling` takes. */
  const sizing = useRef<{ ids: string[]; anchor: Pt; corner: Pt; sx: number; sy: number } | null>(
    null,
  );
  const shape = useRef<{ from: Pt; to: Pt } | null>(null);
  const rulerDraft = useRef<{ from: Pt; to: Pt } | null>(null);
  /**
   * An erase swipe in flight.
   *
   * `from` is the page as it stood when the rubber went down, `now` is that page with everything rubbed
   * out so far taken off it, and `removed` is the whole swipe's worth of records so it can be one undo
   * step. All three are needed: erasing against the PROP page every sample collected the same record
   * once per sample — so an undo restored it several times over — and repainting from a page reduced by
   * that sample alone put previously erased strokes back on screen mid-swipe.
   */
  const rubbing = useRef<{ from: NbPage; now: NbPage; removed: Placed<NbStroke>[] } | null>(null);

  /** A text or sticky note being typed, positioned in page fractions. */
  const [editing, setEditing] = useState<{ at: Pt; kind: 'text' | 'note' } | null>(null);
  const typingRef = useRef<HTMLTextAreaElement>(null);

  const dpr = useMemo(() => {
    if (typeof window === 'undefined') return 1;
    const wanted = (window.devicePixelRatio || 1) * scale;
    return Math.min(wanted, MAX_BACKING_PX / Math.max(BOX.w, BOX.h));
  }, [scale]);

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

  /**
   * Shas already decoded for THIS notebook.
   *
   * Without it the effect below refetched every image on the page whenever the set changed, so a second
   * clip pulled the first back through the IPC, decoded it again and minted a blob URL that the next
   * cleanup would revoke — all to add nothing, because the name IS the hash and the copy already held is
   * the same bytes.
   */
  const decoded = useRef({ notebook, shas: new Set<string>() });
  if (decoded.current.notebook !== notebook) decoded.current = { notebook, shas: new Set() };

  useEffect(() => {
    const wanted = (shaKey ? shaKey.split(',') : []).filter((sha) => !decoded.current.shas.has(sha));
    if (wanted.length === 0) return;
    let cancelled = false;
    const urls: string[] = [];
    void (async () => {
      const loaded: [string, HTMLImageElement][] = [];
      for (const sha of wanted) {
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
      // Recorded only once the bytes are actually in hand, so a read that failed — or one abandoned
      // mid-flight by a page turn — is tried again rather than remembered as done.
      for (const [sha] of loaded) decoded.current.shas.add(sha);
      setAssets((prev) => {
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

  /**
   * Everything transient: a selection being moved or scaled, the lasso path, a shape preview, the
   * ruler, and §5d's selection frame with its four corner handles.
   *
   * The frame lives HERE rather than in an effect of its own, which is what stops it being wiped: every
   * `loop.mark()` runs this painter, and a painter that cleared the canvas without redrawing the frame
   * made a drag look like the selection had vanished.
   */
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

      /* A move or a scale in flight. Its own `ids` rather than the `selection` prop, because a press
         that selects and starts dragging in one gesture has not re-rendered yet. */
      const gesture = drag.current ?? sizing.current;
      const live: Affine | null = drag.current
        ? translation(drag.current.last.x - drag.current.from.x, drag.current.last.y - drag.current.from.y)
        : sizing.current
          ? scaling(sizing.current.anchor, sizing.current.sx, sizing.current.sy)
          : null;
      const frame = selectionFrame(page, gesture?.ids ?? selection);
      if (live && frame) {
        // The ink itself is lifted off the static canvas for the duration of the gesture, so this IS
        // the selection rather than a second copy of it — the difference between a drag you can watch
        // and one that only happens on release.
        ctx.save();
        paintRecords(ctx, canvas, ghostOf(page, gesture?.ids ?? selection, live), BOX, assets);
        ctx.restore();
      }

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

      // Last, so the frame and its handles sit over the preview they describe.
      if (frame) drawFrame(ctx, live ? mapRect(frame, live) : frame, accent, resolveInk('--paper', canvas));
    },
    [dpr, ink, page, selection, assets],
  );
  overlay.current = paintOverlay;

  /**
   * Repaint the transients whenever what they describe changes.
   *
   * `paintOverlay` clears the live canvas, so this is also what puts the selection frame back after a
   * commit, an undo or a page load — and the `builder` guard is what keeps it from wiping a stroke that
   * is still being drawn.
   */
  useEffect(() => {
    const canvas = liveRef.current;
    if (!canvas || builder.current) return;
    paintOverlay(canvas);
  }, [paintOverlay]);

  // Focus the inline text/sticky editor when it opens. `autoFocus` alone was unreliable — the tap
  // that opens it briefly held pointer capture on the canvas — so focus is placed explicitly here.
  useEffect(() => {
    if (editing) typingRef.current?.focus();
  }, [editing]);

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
          // The nib follows the tool — pen→fountain, pencil→pencil, highlighter→marker — so the dock
          // is the single control for a stroke's character; smoothing rides the engine default.
          n: NIB_FOR_TOOL[tool],
        };
        // Pressure is always on (a mouse reports a flat stream and simply draws an even width); there
        // is no straight-line lock; and a stroke snaps to the ruler whenever a guide has been placed.
        builder.current = new StrokeBuilder(seed, { pressure: true, lock: false, ruler });
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
          // The swipe carries its own copy of the page from here on, and `rub` reduces THAT — never the
          // prop — so nothing is collected twice and nothing rubbed out comes back mid-swipe.
          rubbing.current = { from: page, now: page, removed: [] };
          rub(at);
        }
        loop.mark();
        break;
      }
      case 'lasso': {
        const frame = selection.length > 0 ? selectionFrame(page, selection) : null;
        const grab = frame ? grabHandle(frame, at) : null;
        if (grab) {
          // §5d draws four corner handles; this is what makes them the control they look like, instead
          // of a press that missed every record and cleared the selection.
          sizing.current = { ids: [...selection], ...grab, sx: 1, sy: 1 };
          lift(selection);
        } else {
          const hit = hitTest(page, at, HIT_TOLERANCE);
          if (hit && selection.includes(hit.id)) {
            drag.current = { ids: [...selection], from: at, last: at };
            lift(selection);
          } else if (hit) {
            // Selected and dragged in one gesture, so the ids are carried on the gesture rather than
            // read back from a `selection` prop that has not re-rendered yet.
            onSelection([hit.id]);
            drag.current = { ids: [hit.id], from: at, last: at };
            lift([hit.id]);
          } else {
            onSelection([]);
            lasso.current = [at];
          }
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
      case 'sticky': {
        // Release the capture taken above: a click-to-place tool must not hold the pointer, or the
        // textarea that opens below cannot take focus cleanly — which is what made the editor feel
        // dead. Focus is then placed explicitly by the effect keyed on `editing`.
        e.currentTarget.releasePointerCapture(e.pointerId);
        owner.current = null;
        const kind = tool === 'text' ? 'text' : 'note';
        // Clamped once, here, so the editor and the object it commits agree on where they are: the page
        // clips its own children, and an unclamped press near an edge opened the box into a sliver.
        setEditing({ at: clampSpot(at, kind), kind });
        break;
      }
      case 'image':
        // Nothing to draw: the image tool is the paste / drop / clip target, and the spread's own
        // handlers own those. Said in the dock's tooltip rather than by a dead press here.
        e.currentTarget.releasePointerCapture(e.pointerId);
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
    if (sizing.current) {
      const grip = sizing.current;
      const spanX = grip.corner.x - grip.anchor.x;
      const spanY = grip.corner.y - grip.anchor.y;
      // A selection with no extent in one axis — a horizontal rule, a single dot — cannot be scaled in
      // it, and dividing by that zero would send every point to infinity.
      grip.sx = Math.abs(spanX) < 1e-4 ? 1 : clampScale((at.x - grip.anchor.x) / spanX);
      grip.sy = Math.abs(spanY) < 1e-4 ? 1 : clampScale((at.y - grip.anchor.y) / spanY);
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

  /**
   * The gesture ends — but only for the pointer that owns it.
   *
   * Without the identity check, a palm resting beside the pen and then LIFTING committed the pen's
   * stroke half-drawn and dropped its owner, so the rest of the stroke went nowhere. `acceptsPointer`
   * rejects that palm on the way down; this is the same guarantee at the other end of the gesture.
   */
  function up(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!owner.current || e.pointerId !== owner.current.pointerId) return;

    const stroke = builder.current;
    builder.current = null;

    if (stroke) {
      if (stroke.count > 1 || tool !== 'er') onCommand(addStrokeCmd(index, stroke.finish()));
      finishGesture();
      return;
    }
    const swipe = rubbing.current;
    if (swipe) {
      rubbing.current = null;
      // One swipe, one undo step, taken against the page as it stood when the rubber went down — and
      // the removed records carry the index they sat at, so an undo puts each back in its own z
      // position rather than on top.
      if (swipe.removed.length > 0) {
        onCommand(deleteCmd(index, swipe.from, swipe.removed.map((entry) => entry.rec.id)));
      }
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
    if (sizing.current) {
      const { ids, anchor, sx, sy } = sizing.current;
      sizing.current = null;
      if (Math.abs(sx - 1) > 0.001 || Math.abs(sy - 1) > 0.001) {
        onCommand(transformCmd(index, page, ids, scaling(anchor, sx, sy)));
      } else settle();
      finishGesture();
      return;
    }
    if (drag.current) {
      const { ids, from, last } = drag.current;
      drag.current = null;
      const dx = q4(last.x - from.x);
      const dy = q4(last.y - from.y);
      if (dx !== 0 || dy !== 0) onCommand(transformCmd(index, page, ids, translation(dx, dy)));
      // Nothing moved, so no commit will repaint: the lifted ink has to be put back by hand.
      else settle();
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

  /** Take a set of records off the static canvas, so a move or scale preview replaces them rather than
   *  doubling them. Put back by the commit, or by `settle` when the gesture came to nothing. */
  function lift(ids: readonly string[]) {
    if (staticRef.current && ids.length > 0)
      paintStatic(staticRef.current, deleteRecords(page, ids), BOX, assets, dpr);
  }

  function settle() {
    if (staticRef.current) paintStatic(staticRef.current, page, BOX, assets, dpr);
  }

  /**
   * One erase step, against the swipe's own copy of the page.
   *
   * Reducing `swipe.now` each sample is what makes the rubber behave like one: a record already taken
   * out cannot be collected again — which is what duplicated it on undo, once per sample that touched
   * it — and the repaint is of everything erased so far rather than of this sample alone, which is what
   * used to put earlier strokes back on screen halfway through the swipe.
   */
  function rub(at: Pt) {
    const swipe = rubbing.current;
    if (!swipe || ink.eraser === 'paint') return;
    const radius = widthFraction(Math.max(ink.strokePx, 18)) / 2;
    const result = eraseAt(swipe.now, at, radius, DEFAULT_ERASER_MODE);
    if (result.removed.length === 0) return;
    swipe.now = result.page;
    swipe.removed = [...swipe.removed, ...result.removed];
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
              // Floored as well as capped. A negative width is not merely a thin column: `inRect` can
              // never contain a point in one, so the object would be unselectable and undeletable.
              w: q4(Math.max(TYPING.text.w / PAGE.w, Math.min(0.6, 1 - spot.at.x - PAGE.padX / PAGE.w))),
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
        aria-label={`Page ${pageLabel(index)}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      {editing && (
        <textarea
          key={`${editing.kind}-${editing.at.x}-${editing.at.y}`}
          ref={typingRef}
          className="nbs-typing"
          data-kind={editing.kind}
          /* The page's own px rather than a percentage: the box has a fixed pixel size, so a percentage
             origin is what let it hang off the right edge into `overflow: hidden`. `clampSpot` has
             already kept the origin inside. */
          style={{ left: editing.at.x * PAGE.w, top: editing.at.y * PAGE.h }}
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
  switch (ink.shape) {
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
  const kind = ink.shape;
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

/* ──────────────────────────────────────────────────── the selection frame ─────────────────────── */

/**
 * What a selection encloses, in page fractions, or null when nothing named is on this page.
 *
 * `paintedBBox` rather than `recordBBox`: the frame is drawn around ink, and a nib is a width-fraction
 * the path bounds deliberately leave out.
 */
function selectionFrame(page: NbPage, ids: readonly string[]): Rect | null {
  const set = new Set(ids);
  const records = [...page.strokes, ...page.objects].filter((r) => set.has(r.id));
  return records.length === 0 ? null : unionBBox(records.map(paintedBBox));
}

/** The frame as page px, padding included — what is drawn, and what a handle press is measured against. */
const framePx = (rect: Rect): Rect => ({
  x: rect.x * PAGE.w - FRAME_PAD,
  y: rect.y * PAGE.h - FRAME_PAD,
  w: rect.w * PAGE.w + FRAME_PAD * 2,
  h: rect.h * PAGE.h + FRAME_PAD * 2,
});

/** The four corners of a px frame, in one fixed order — so the paint and the hit test cannot disagree
 *  about which corner is which, and `3 - i` is always the diagonally opposite one. */
const cornersOf = (box: Rect): [number, number][] => [
  [box.x, box.y],
  [box.x + box.w, box.y],
  [box.x, box.y + box.h],
  [box.x + box.w, box.y + box.h],
];

/** A rect under a live transform, for previewing the frame where the selection is going. */
const mapRect = (rect: Rect, m: Affine): Rect => ({
  x: m.ax + (rect.x - m.ax) * m.sx + m.dx,
  y: m.ay + (rect.y - m.ay) * m.sy + m.dy,
  w: rect.w * m.sx,
  h: rect.h * m.sy,
});

/** Never mirrored and never collapsed: a negative factor would flip handwriting, and a zero would
 *  discard it. */
const clampScale = (n: number) => Math.min(20, Math.max(0.05, n));

/** The handle under `at`, as the anchor to scale about and the corner being pulled — both in fractions. */
function grabHandle(rect: Rect, at: Pt): { anchor: Pt; corner: Pt } | null {
  const box = framePx(rect);
  const px = at.x * PAGE.w;
  const py = at.y * PAGE.h;
  const corners = cornersOf(box);
  for (let i = 0; i < corners.length; i++) {
    const [cx, cy] = corners[i];
    if (Math.hypot(px - cx, py - cy) > HANDLE_GRAB) continue;
    // The anchor is the diagonally opposite corner, so the selection grows away from the hand rather
    // than sliding while it resizes.
    const [ax, ay] = corners[3 - i];
    return {
      anchor: { x: ax / PAGE.w, y: ay / PAGE.h },
      corner: { x: cx / PAGE.w, y: cy / PAGE.h },
    };
  }
  return null;
}

/** The selected records under a live transform — the move / scale preview on the live canvas. */
function ghostOf(page: NbPage, ids: readonly string[], m: Affine): NbPage {
  const set = new Set(ids);
  return {
    v: 1,
    strokes: page.strokes.filter((s) => set.has(s.id)).map((s) => transformStroke(s, m)),
    objects: page.objects.filter((o) => set.has(o.id)).map((o) => transformObject(o, m)),
  };
}

/** §5d's dashed accent frame and its four 7px corner handles. `rect` is in fractions. */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  accent: string,
  paper: string,
): void {
  const box = framePx(rect);
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  ctx.setLineDash([]);
  ctx.fillStyle = paper;
  ctx.lineWidth = 1.5;
  for (const [hx, hy] of cornersOf(box)) {
    ctx.beginPath();
    ctx.roundRect(hx - HANDLE, hy - HANDLE, HANDLE * 2, HANDLE * 2, 1.5);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** Keep an editor — and the object it commits — inside the page. `.nbs-page` clips its children, so an
 *  unclamped origin near the right or bottom edge opened the box into a sliver of itself. */
function clampSpot(at: Pt, kind: 'text' | 'note'): Pt {
  const box = TYPING[kind];
  return {
    x: Math.min(Math.max(0, at.x), (PAGE.w - box.w) / PAGE.w),
    y: Math.min(Math.max(0, at.y), (PAGE.h - box.h) / PAGE.h),
  };
}

