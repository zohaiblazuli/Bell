/**
 * The stroke engine's unit tests.
 *
 *   npm test            (or: node scripts/test.mjs ink)
 *
 * Everything here runs under plain Node with no DOM, which is the property `src/lib/ink.ts` is built
 * to have: the maths is separated from the canvas and nothing touches `document` or `window` at module
 * scope. The paint pass itself is not tested — it needs a real 2D context — but `createInkLoop`'s
 * scheduler is injectable, so the coalescing that the whole rewrite hangs on is.
 *
 * Colours are written as `var(--token)` rather than literals. Nothing in the engine parses `c`, and a
 * hex in the repo is a bug even in a test.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NIB_IDS, emptyPage, q4, type NbObject, type NbPage, type NbStroke } from '@/lib/notebooks';
import {
  DEFAULT_ERASER_MODE,
  DEFAULT_SMOOTHING,
  HISTORY_DEPTH,
  MIN_POINT_DELTA,
  NIB_SPECS,
  NIB_TILE,
  NO_PRESSURE,
  PAGE,
  PAGE_ASPECT,
  StrokeBuilder,
  acceptsPointer,
  addObjectCmd,
  addStrokeCmd,
  apply,
  bboxCacheSize,
  clearBBoxCache,
  createInkLoop,
  deleteCmd,
  deleteRecords,
  duplicateRecords,
  emptyHistory,
  eraseAt,
  hitTest,
  hitTestLasso,
  invalidateBBox,
  nibOptions,
  nibSample,
  normalisePressure,
  objectBBox,
  paintedBBox,
  parseHistory,
  pasteCmd,
  pointInPolygon,
  pushCommand,
  recolourCmd,
  recolourRecords,
  redo,
  renderPlan,
  revert,
  samplePointer,
  scaleRecords,
  serialiseHistory,
  snapToRuler,
  straightLineLock,
  strokeBBox,
  strokeCentreline,
  strokeOptions,
  strokeOutline,
  transformCmd,
  transformStroke,
  translateRecords,
  translation,
  undo,
  usesPressure,
  widthFraction,
  type InkCommand,
  type InkPoint,
  type NbPages,
  type Rect,
} from '@/lib/ink';

/* ─────────────────────────────────────────────────────────────────── fixtures ──────────────────── */

const INK = 'var(--iris-3)';
const CORRECTION = 'var(--cover-5)';
const GOLD = 'var(--bell-gold)';

/** The page box at design size, so a px assertion below is the file's own number. */
const BOX = { w: PAGE.w, h: PAGE.h };

const pt = (x: number, y: number, pressure = 0.5): InkPoint => ({ x, y, pressure });

const seed = (over: Partial<{ t: NbStroke['t']; c: string; w: number }> = {}) => ({
  t: over.t ?? ('pen' as const),
  c: over.c ?? INK,
  w: over.w ?? widthFraction(8),
});

/** A stroke straight from `[x, y, pressure]` triples, skipping the builder. */
const strokeOf = (triples: number[][], over: Partial<NbStroke> = {}): NbStroke => ({
  id: 'test',
  t: 'pen',
  c: INK,
  w: widthFraction(8),
  p: triples.flat(),
  ...over,
});

/** Rects compare at the precision the format stores, so `0.8 - 0.2` does not fail on binary float. */
const rect4 = (r: Rect) => ({ x: q4(r.x), y: q4(r.y), w: q4(r.w), h: q4(r.h) });

const pointer = (over: Partial<Parameters<typeof acceptsPointer>[0]> = {}) => ({
  pointerId: 1,
  pointerType: 'pen',
  isPrimary: true,
  pressure: 0.6,
  clientX: 200,
  clientY: 300,
  ...over,
});

const RECT = { left: 100, top: 50, width: PAGE.w, height: PAGE.h };

describe('the module is pure enough to test', () => {
  test('there is no DOM here at all', () => {
    assert.equal(typeof document, 'undefined');
    assert.equal(typeof window, 'undefined');
  });
});

describe('capture — point thinning', () => {
  test('a sub-threshold sample is dropped, and the first and last always survive', () => {
    const b = new StrokeBuilder(seed());
    b.begin(pt(0.1, 0.1));
    b.extend([pt(0.1002, 0.1), pt(0.1004, 0.1), pt(0.1006, 0.1)]);
    b.extend([pt(0.2, 0.1)]);
    b.extend([pt(0.2003, 0.1)]);
    assert.deepEqual(
      b.points().map((p) => q4(p.x)),
      [0.1, 0.2, 0.2003],
    );
  });

  test('a slow hand inside one nib writes two points, not nine', () => {
    const b = new StrokeBuilder(seed());
    b.begin(pt(0.5, 0.5));
    for (let i = 1; i <= 8; i++) b.extend([pt(0.5 + i * 0.0001, 0.5)]);
    assert.equal(b.count, 2);
    assert.deepEqual(
      b.points().map((p) => q4(p.x)),
      [0.5, 0.5008],
    );
  });

  test('the threshold is isotropic: the same delta is a hair across and a step down', () => {
    const delta = MIN_POINT_DELTA * 0.8; // under it in x, over it once y is aspect-corrected
    const across = new StrokeBuilder(seed());
    across.begin(pt(0.5, 0.5));
    across.extend([pt(0.5 + delta, 0.5), pt(0.5 + delta * 2, 0.5)]);
    assert.equal(across.points().length, 2, 'the intermediate x sample should be dropped');

    const down = new StrokeBuilder(seed());
    down.begin(pt(0.5, 0.5));
    down.extend([pt(0.5, 0.5 + delta), pt(0.5, 0.5 + delta * 2)]);
    assert.equal(down.points().length, 3, 'the same delta in y is a real step');
    assert.ok(delta * PAGE_ASPECT > MIN_POINT_DELTA);
  });

  test('a tap is one point', () => {
    const b = new StrokeBuilder(seed());
    b.begin(pt(0.5, 0.5));
    assert.equal(b.count, 1);
    assert.equal(b.finish().p.length, 3);
  });
});

describe('capture — quantisation', () => {
  test('q4 is applied on commit and only on commit', () => {
    const b = new StrokeBuilder({ t: 'pen', c: INK, w: 1 / 3 });
    b.begin({ x: 0.123456789, y: 0.987654321, pressure: 0.333333 });
    assert.equal(b.points()[0].x, 0.123456789, 'the live point keeps full precision');
    assert.equal(b.points()[0].y, 0.987654321);
    assert.equal(b.points()[0].pressure, 0.333333);

    const stroke = b.finish();
    assert.deepEqual(stroke.p, [0.1235, 0.9877, 0.3333]);
    assert.equal(stroke.w, q4(1 / 3));
  });

  test('the seed reaches the record, and absent defaults are not written out', () => {
    const plain = new StrokeBuilder({ t: 'pen', c: INK, w: widthFraction(8), o: 1, sm: DEFAULT_SMOOTHING });
    plain.begin(pt(0.1, 0.1));
    const bare = plain.finish();
    assert.equal('o' in bare, false, 'an absent `o` already means 1');
    assert.equal('sm' in bare, false, 'an absent `sm` already means the default');
    assert.equal(bare.n, 'fountain', 'the nib decides the taper, so it is always stored');

    const swipe = new StrokeBuilder({ t: 'hl', c: INK, w: widthFraction(14), o: 0.34, sm: 0.7 });
    swipe.begin(pt(0.1, 0.1));
    const hl = swipe.finish();
    assert.equal(hl.o, 0.34);
    assert.equal(hl.sm, 0.7);
    assert.equal(hl.n, 'marker');
  });

  test('ids are unique across a burst', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const b = new StrokeBuilder(seed());
      b.begin(pt(0.1, 0.1));
      ids.add(b.finish().id);
    }
    assert.equal(ids.size, 500);
  });
});

describe('capture — pressure', () => {
  test('a mouse reports 0.5 and means nothing by it', () => {
    assert.equal(normalisePressure(0.5, 'mouse'), NO_PRESSURE);
    assert.equal(normalisePressure(0.9, 'mouse'), NO_PRESSURE);
  });

  test("a leading 0 from a pen is the digitizer waking up, not a lift", () => {
    assert.equal(normalisePressure(0, 'pen'), NO_PRESSURE);
  });

  test('a missing or unusable value falls back', () => {
    assert.equal(normalisePressure(undefined), NO_PRESSURE);
    assert.equal(normalisePressure(null), NO_PRESSURE);
    assert.equal(normalisePressure(Number.NaN, 'pen'), NO_PRESSURE);
  });

  test('a real reading survives, clamped to 0…1', () => {
    assert.equal(normalisePressure(0.72, 'pen'), 0.72);
    assert.equal(normalisePressure(1.8, 'pen'), 1);
  });

  test('touch is treated as sensorless too', () => {
    assert.equal(normalisePressure(0.9, 'touch'), NO_PRESSURE);
  });
});

describe('capture — the pressure switch is an even width, never a hairline', () => {
  test('pressure off writes a flat stream and renders without thinning', () => {
    const b = new StrokeBuilder(seed(), { pressure: false, lock: false, ruler: null });
    b.begin(pt(0.1, 0.5, 0.9));
    b.extend([pt(0.4, 0.5, 0.2), pt(0.7, 0.5, 1)]);
    const stroke = b.finish();
    assert.deepEqual([stroke.p[2], stroke.p[5], stroke.p[8]], [NO_PRESSURE, NO_PRESSURE, NO_PRESSURE]);
    assert.equal(usesPressure(stroke), false);
    assert.equal(strokeOptions(stroke, BOX).thinning, 0);
  });

  test('a varying stream keeps the nib taper', () => {
    const b = new StrokeBuilder(seed());
    b.begin(pt(0.1, 0.5, 0.3));
    b.extend([pt(0.4, 0.5, 0.8), pt(0.7, 0.5, 0.55)]);
    const stroke = b.finish();
    assert.equal(usesPressure(stroke), true);
    assert.equal(strokeOptions(stroke, BOX).thinning, NIB_SPECS.fountain.base.thinning);
  });

  test('a mouse stroke is a flat stream by construction, so it is even-width', () => {
    const b = new StrokeBuilder(seed());
    b.begin(pt(0.1, 0.5, normalisePressure(0.5, 'mouse')));
    b.extend([pt(0.4, 0.5, normalisePressure(0.5, 'mouse'))]);
    assert.equal(strokeOptions(b.finish(), BOX).thinning, 0);
  });

  test('a one-point tap has no pressure information to read', () => {
    assert.equal(usesPressure(strokeOf([[0.5, 0.5, 0.8]])), false);
  });
});

describe('behaviour — straight-line lock and snap to ruler', () => {
  test('the lock keeps the two ends and throws the middle away', () => {
    const first = pt(0.1, 0.1, 0.4);
    const last = pt(0.9, 0.8, 0.7);
    assert.deepEqual(straightLineLock(first, last), [first, last]);
  });

  test('a lock over a wobble commits two points', () => {
    const b = new StrokeBuilder(seed(), { pressure: true, lock: true, ruler: null });
    b.begin(pt(0.1, 0.1));
    b.extend([pt(0.4, 0.3), pt(0.6, 0.15), pt(0.9, 0.4)]);
    assert.equal(b.points().length, 2);
    const stroke = b.finish();
    assert.deepEqual(stroke.p.slice(0, 2), [0.1, 0.1]);
    assert.deepEqual(stroke.p.slice(3, 5), [0.9, 0.4]);
  });

  test('a tap under the lock stays a tap', () => {
    const p = pt(0.5, 0.5);
    assert.deepEqual(straightLineLock(p, { ...p }), [p]);
  });

  test('a horizontal ruler pins y and keeps the pressure', () => {
    const snapped = snapToRuler(pt(0.3, 0.2, 0.7), { x: 0, y: 0.5, angle: 0 });
    assert.equal(q4(snapped.x), 0.3);
    assert.equal(q4(snapped.y), 0.5);
    assert.equal(snapped.pressure, 0.7);
  });

  test('a vertical ruler pins x', () => {
    const snapped = snapToRuler(pt(0.3, 0.2), { x: 0.6, y: 0, angle: 90 });
    assert.equal(q4(snapped.x), 0.6);
    assert.equal(q4(snapped.y), 0.2);
  });

  test('45 degrees is 45 degrees ON SCREEN, not in fraction space', () => {
    const snapped = snapToRuler(pt(0.4, 0), { x: 0, y: 0, angle: 45 });
    assert.equal(Math.round(snapped.x * PAGE.w), Math.round(snapped.y * PAGE.h));
  });

  test('the builder applies the ruler, so preview and commit cannot disagree', () => {
    const b = new StrokeBuilder(seed(), { pressure: true, lock: false, ruler: { x: 0, y: 0.5, angle: 0 } });
    b.begin(pt(0.1, 0.2));
    b.extend([pt(0.4, 0.9)]);
    assert.deepEqual(
      b.points().map((p) => q4(p.y)),
      [0.5, 0.5],
    );
    assert.equal(q4(b.finish().p[4]), 0.5);
  });
});

describe('outlines and nibs', () => {
  const line = strokeOf([
    [0.2, 0.5, 0.4],
    [0.5, 0.5, 0.8],
    [0.8, 0.5, 0.5],
  ]);
  /** A realistically sampled stroke: a real hand leaves dozens of points, not three. */
  const sampled = strokeOf(
    Array.from({ length: 24 }, (_, i) => [0.2 + (i / 23) * 0.6, 0.5 + Math.sin(i / 4) * 0.05, 0.4 + (i % 5) * 0.1]),
    { id: 'sampled' },
  );

  test('the nib table is the four nibs the format names, in the file order', () => {
    assert.deepEqual(Object.keys(NIB_SPECS), [...NIB_IDS]);
  });

  test('a marker is flat-capped and does not thin', () => {
    const options = nibOptions('marker', 12);
    assert.equal(options.thinning, 0);
    assert.equal(options.start?.cap, false);
    assert.equal(options.end?.cap, false);
  });

  test('a ballpoint is near-constant and a fountain is not', () => {
    assert.ok(NIB_SPECS.ballpoint.base.thinning < 0.1);
    assert.ok(NIB_SPECS.fountain.base.thinning > 0.5);
    assert.ok(NIB_SPECS.pencil.base.smoothing < NIB_SPECS.fountain.base.smoothing);
    assert.ok(NIB_SPECS.marker.base.streamline < NIB_SPECS.ballpoint.base.streamline);
  });

  test('the taper scales with the nib rather than being a fixed distance', () => {
    assert.equal(nibOptions('fountain', 10).start?.taper, NIB_SPECS.fountain.taper.start * 10);
    assert.equal(nibOptions('fountain', 20).end?.taper, NIB_SPECS.fountain.taper.end * 20);
  });

  test('the smoothing slider scales the table, and 40% reproduces it exactly', () => {
    assert.equal(nibOptions('pencil', 8, DEFAULT_SMOOTHING).streamline, NIB_SPECS.pencil.base.streamline);
    assert.ok(nibOptions('pencil', 8, 0.8).streamline! > NIB_SPECS.pencil.base.streamline);
    assert.equal(nibOptions('pencil', 8, 0).streamline, 0);
    assert.ok(nibOptions('marker', 8, 1).streamline! <= 0.95, 'streamline at 1 collapses the stroke');
  });

  test('an outline is a polygon in pixels that brackets the stroke', () => {
    const points = strokeOutline(sampled, BOX);
    assert.ok(points.length > 8, `expected a real polygon, got ${points.length} points`);
    const xs = points.map((p) => p[0]);
    assert.ok(Math.min(...xs) <= 0.2 * BOX.w + 1);
    assert.ok(Math.max(...xs) >= 0.8 * BOX.w - 1);
  });

  test('the outline is in pixels, so it scales with the box rather than the record', () => {
    const small = Math.max(...strokeOutline(sampled, BOX).map((p) => p[0]));
    const large = Math.max(...strokeOutline(sampled, { w: BOX.w * 2, h: BOX.h * 2 }).map((p) => p[0]));
    assert.ok(large > small * 1.8);
  });

  test('a taper longer than the stroke is clamped, so a tap still leaves a dot', () => {
    // A fountain nib wants 12px + 20px of taper; a tap has no length to spend it over.
    const tap = strokeOf([[0.5, 0.5, 0.5]]);
    assert.equal(strokeOptions(tap, BOX).start?.taper, 0);
    assert.equal(strokeOptions(tap, BOX).end?.taper, 0);
    assert.ok(strokeOutline(tap, BOX).length > 8, 'a tap without a cap is invisible');
    // A long stroke keeps the taper the nib asked for.
    assert.equal(strokeOptions(sampled, BOX).start?.taper, NIB_SPECS.fountain.taper.start * 8);
  });

  test('a single-point tap still leaves a dot', () => {
    assert.ok(strokeOutline(strokeOf([[0.5, 0.5, 0.5]]), BOX).length > 4);
  });

  test('an empty stroke yields nothing rather than throwing', () => {
    assert.deepEqual(strokeOutline(strokeOf([]), BOX), []);
    assert.deepEqual(strokeCentreline(strokeOf([]), BOX), []);
    assert.deepEqual(renderPlan(strokeOf([]), BOX), { kind: 'outline', points: [] });
  });

  test('the highlighter is the one tool that takes the ribbon', () => {
    for (const t of ['pen', 'pencil', 'er'] as const)
      assert.equal(renderPlan({ ...line, t }, BOX).kind, 'outline');
    assert.equal(renderPlan({ ...line, t: 'hl' }, BOX).kind, 'ribbon');
  });

  test('the ribbon is one constant width, taken from the nib', () => {
    const plan = renderPlan({ ...line, t: 'hl', w: widthFraction(14) }, BOX);
    assert.equal(plan.kind, 'ribbon');
    assert.equal(plan.kind === 'ribbon' ? Math.round(plan.width) : 0, 14);
    assert.deepEqual(plan.points, strokeCentreline({ ...line, t: 'hl', w: widthFraction(14) }, BOX));
  });

  test('a nib sample is a real stroke at that nib, not a drawing of one', () => {
    for (const nib of NIB_IDS) {
      const sample = nibSample(nib, INK);
      assert.equal(sample.n, nib);
      assert.ok(strokeOutline(sample, NIB_TILE).length > 8, `${nib} drew nothing`);
    }
  });

  test('a live outline differs from the committed one at the moving end', () => {
    assert.notDeepEqual(strokeOutline(line, BOX, true), strokeOutline(line, BOX, false));
  });
});

describe('bounding boxes', () => {
  const img: NbObject = { id: 'img', k: 'img', sha: 'sha1', x: 0.3, y: 0.4, w: 100 / PAGE.w, h: 100 / PAGE.h };
  const note: NbObject = { id: 'note', k: 'note', s: 'this one is in every P4', x: 0.5, y: 0.3, w: 0.25, h: 0.16, c: GOLD };
  const shape: NbObject = { id: 'shape', k: 'shape', s: 'line', x: 0.6, y: 0.7, w: -0.2, h: -0.1, c: INK, sw: widthFraction(1.75) };

  test('a straight stroke bounds its own path', () => {
    assert.deepEqual(rect4(strokeBBox(strokeOf([[0.2, 0.4, 0.5], [0.8, 0.4, 0.5]]))), {
      x: 0.2,
      y: 0.4,
      w: 0.6,
      h: 0,
    });
  });

  test('a single-point tap is a zero-size box at the point', () => {
    assert.deepEqual(rect4(strokeBBox(strokeOf([[0.5, 0.5, 0.5]]))), { x: 0.5, y: 0.5, w: 0, h: 0 });
  });

  test('an empty stroke has no box rather than an infinite one', () => {
    assert.deepEqual(rect4(strokeBBox(strokeOf([]))), { x: 0, y: 0, w: 0, h: 0 });
  });

  test('the painted box covers the nib and the path box does not', () => {
    const stroke = strokeOf([[0.2, 0.4, 0.5], [0.8, 0.4, 0.5]], { w: widthFraction(12) });
    assert.equal(strokeBBox(stroke).h, 0);
    assert.equal(q4(paintedBBox(stroke).h), q4(widthFraction(12) / PAGE_ASPECT));
  });

  test('an image bounds its rect', () => {
    assert.deepEqual(rect4(objectBBox(img)), rect4({ x: 0.3, y: 0.4, w: 100 / PAGE.w, h: 100 / PAGE.h }));
  });

  test('a note bounds its rect', () => {
    assert.deepEqual(rect4(objectBBox(note)), { x: 0.5, y: 0.3, w: 0.25, h: 0.16 });
  });

  test('a shape drawn up and to the left normalises its negative size', () => {
    assert.deepEqual(rect4(objectBBox(shape)), { x: 0.4, y: 0.6, w: 0.2, h: 0.1 });
  });

  test('a text object is as tall as its lines, in Caveat metrics', () => {
    const size = widthFraction(18);
    const one: NbObject = { id: 't1', k: 'text', s: 'F = 27.4 N', x: 0.1, y: 0.2, w: 0.5, size, c: INK };
    const two: NbObject = { ...one, id: 't2', s: 'sum of moments\nabout P = 0' };
    assert.equal(Math.round(objectBBox(one).h * PAGE.h), 24);
    assert.equal(Math.round(objectBBox(two).h * PAGE.h), 49);
    assert.equal(objectBBox(one).w, 0.5);
  });

  test('a text object with a negative width normalises rather than becoming unhittable', () => {
    // A page written before the width was clamped can hold one. `inRect` can never contain a point in a
    // negative rectangle, so an un-normalised box would make the object impossible to select or delete.
    const back: NbObject = {
      id: 't3',
      k: 'text',
      s: 'v = u + at',
      x: 0.9,
      y: 0.2,
      w: -0.2,
      size: widthFraction(16),
      c: INK,
    };
    const box = objectBBox(back);
    assert.equal(q4(box.x), 0.7);
    assert.equal(q4(box.w), 0.2);
    assert.ok(hitTest({ ...emptyPage(), objects: [back] }, { x: 0.8, y: 0.21 }, 0.01));
  });

  test('a rotated image bounds the rotated quad, in isotropic space', () => {
    const turned = { ...img, id: 'turned', rot: 45 };
    const box = objectBBox(turned);
    // A 100x100 square turned 45 degrees has a 141.4px axis-aligned box, in BOTH axes.
    assert.equal(Math.round(box.w * PAGE.w), 141);
    assert.equal(Math.round(box.h * PAGE.h), 141);
  });

  test('a square turned 90 degrees is the box it started as', () => {
    const box = objectBBox({ ...img, id: 'quarter', rot: 90 });
    assert.equal(Math.round(box.w * PAGE.w), 100);
    assert.equal(Math.round(box.h * PAGE.h), 100);
  });
});

describe('the bbox cache', () => {
  test('a second read hands back the very same object', () => {
    clearBBoxCache();
    const stroke = strokeOf([[0.1, 0.1, 0.5], [0.2, 0.2, 0.5]], { id: 'cached' });
    const first = strokeBBox(stroke);
    assert.equal(strokeBBox(stroke), first);
    assert.equal(bboxCacheSize(), 1);
  });

  test('the rect is frozen, because it is shared', () => {
    clearBBoxCache();
    assert.ok(Object.isFrozen(strokeBBox(strokeOf([[0.1, 0.1, 0.5]], { id: 'frozen' }))));
  });

  test('invalidateBBox drops one entry and clearBBoxCache drops them all', () => {
    clearBBoxCache();
    const a = strokeOf([[0.1, 0.1, 0.5]], { id: 'a' });
    const b = strokeOf([[0.2, 0.2, 0.5]], { id: 'b' });
    strokeBBox(a);
    strokeBBox(b);
    assert.equal(bboxCacheSize(), 2);
    invalidateBBox('a');
    assert.equal(bboxCacheSize(), 1);
    const kept = strokeBBox(b);
    assert.equal(strokeBBox(b), kept);
    clearBBoxCache();
    assert.equal(bboxCacheSize(), 0);
    assert.notEqual(strokeBBox(b), kept);
  });

  test('a moved record gets a fresh box even though its id has not changed', () => {
    clearBBoxCache();
    const stroke = strokeOf([[0.1, 0.1, 0.5], [0.2, 0.2, 0.5]], { id: 'same-id' });
    const before = strokeBBox(stroke);
    const moved = transformStroke(stroke, translation(0.3, 0));
    assert.equal(moved.id, stroke.id);
    assert.notEqual(strokeBBox(moved), before);
    assert.equal(q4(strokeBBox(moved).x), 0.4);
    assert.equal(bboxCacheSize(), 1, 'the entry is replaced, not doubled');
  });
});

describe('hit-testing', () => {
  const line = strokeOf([[0.2, 0.5, 0.5], [0.8, 0.5, 0.5]], { id: 'line', w: widthFraction(8) });
  const page: NbPage = { v: 1, strokes: [line], objects: [] };

  test('a point on the line hits it', () => {
    assert.equal(hitTest(page, { x: 0.5, y: 0.5 }, 0.01), line);
    assert.equal(hitTest(page, { x: 0.2, y: 0.5 }, 0.01), line);
  });

  test('a point inside the tolerance hits and one outside it does not', () => {
    assert.equal(hitTest(page, { x: 0.5, y: 0.51 }, 0.01), line);
    assert.equal(hitTest(page, { x: 0.5, y: 0.515 }, 0.01), null);
  });

  test('past the end of the line is a miss, however close to the y', () => {
    assert.equal(hitTest(page, { x: 0.95, y: 0.5 }, 0.01), null);
  });

  test('the tolerance is isotropic: 0.015 hits across and misses down', () => {
    assert.equal(hitTest(page, { x: 0.815, y: 0.5 }, 0.01), line);
    assert.equal(hitTest(page, { x: 0.5, y: 0.515 }, 0.01), null);
  });

  test('the nib widens the target, so a marker is easier to grab than a fine pen', () => {
    const marker = strokeOf([[0.2, 0.5, 0.5], [0.8, 0.5, 0.5]], { id: 'marker', w: widthFraction(24) });
    const fine = strokeOf([[0.2, 0.5, 0.5], [0.8, 0.5, 0.5]], { id: 'fine', w: widthFraction(1) });
    const at = { x: 0.5, y: 0.517 };
    assert.equal(hitTest({ v: 1, strokes: [marker], objects: [] }, at, 0.001), marker);
    assert.equal(hitTest({ v: 1, strokes: [fine], objects: [] }, at, 0.001), null);
  });

  test('z-order picks the topmost stroke', () => {
    const under = strokeOf([[0.2, 0.5, 0.5], [0.8, 0.5, 0.5]], { id: 'under' });
    const over = strokeOf([[0.2, 0.5, 0.5], [0.8, 0.5, 0.5]], { id: 'over' });
    const stacked: NbPage = { v: 1, strokes: [under, over], objects: [] };
    assert.equal(hitTest(stacked, { x: 0.5, y: 0.5 }, 0.01), over);
  });

  test('an object outranks the ink under it', () => {
    const note: NbObject = { id: 'note', k: 'note', s: 'learn this', x: 0.4, y: 0.45, w: 0.2, h: 0.1, c: GOLD };
    assert.equal(hitTest({ v: 1, strokes: [line], objects: [note] }, { x: 0.5, y: 0.5 }, 0.01), note);
  });

  test('a line object is hit near the segment, not anywhere in its box', () => {
    const diagonal: NbObject = { id: 'beam', k: 'shape', s: 'line', x: 0.1, y: 0.1, w: 0.8, h: 0.8, c: INK, sw: widthFraction(1.75) };
    const withShape: NbPage = { v: 1, strokes: [], objects: [diagonal] };
    assert.equal(hitTest(withShape, { x: 0.5, y: 0.5 }, 0.01), diagonal);
    assert.equal(hitTest(withShape, { x: 0.8, y: 0.2 }, 0.01), null);
  });

  test('a rotated image inverse-rotates the point before testing it', () => {
    const banner: NbObject = { id: 'banner', k: 'img', sha: 'sha2', x: 136.5 / PAGE.w, y: 257.6 / PAGE.h, w: 200 / PAGE.w, h: 60 / PAGE.h, rot: 90 };
    const withImage: NbPage = { v: 1, strokes: [], objects: [banner] };
    // Inside the turned rect but outside the rect as stored.
    assert.equal(hitTest(withImage, { x: 236.5 / PAGE.w, y: 370 / PAGE.h }, 0.002), banner);
    // Inside the rect as stored but outside the turned one.
    assert.equal(hitTest(withImage, { x: 300 / PAGE.w, y: 287.6 / PAGE.h }, 0.002), null);
  });

  test('an empty page hits nothing', () => {
    assert.equal(hitTest(emptyPage(), { x: 0.5, y: 0.5 }, 0.02), null);
  });
});

describe('the lasso', () => {
  /** A U: two arms down each side, joined across the bottom, with a notch out of the top middle. */
  const lasso = [
    { x: 0.1, y: 0.1 },
    { x: 0.4, y: 0.1 },
    { x: 0.4, y: 0.6 },
    { x: 0.6, y: 0.6 },
    { x: 0.6, y: 0.1 },
    { x: 0.9, y: 0.1 },
    { x: 0.9, y: 0.9 },
    { x: 0.1, y: 0.9 },
  ];

  const armed = strokeOf([[0.2, 0.2, 0.5], [0.3, 0.3, 0.5]], { id: 'armed' });
  const notched = strokeOf([[0.45, 0.2, 0.5], [0.55, 0.3, 0.5]], { id: 'notched' });
  const outside = strokeOf([[0.95, 0.95, 0.5]], { id: 'outside' });

  test('even-odd puts the notch outside the loop', () => {
    assert.equal(pointInPolygon({ x: 0.2, y: 0.2 }, lasso), true);
    assert.equal(pointInPolygon({ x: 0.45, y: 0.2 }, lasso), false);
    assert.equal(pointInPolygon({ x: 0.5, y: 0.8 }, lasso), true, 'the base of the U');
    assert.equal(pointInPolygon({ x: 0.05, y: 0.5 }, lasso), false);
  });

  test('a concave loop does not take what its bounding box covers', () => {
    const page: NbPage = { v: 1, strokes: [armed, notched, outside], objects: [] };
    assert.deepEqual(
      hitTestLasso(page, lasso).map((rec) => rec.id),
      ['armed'],
    );
  });

  test('the notched stroke passes the bbox test, which is why the polygon test matters', () => {
    const bounds = strokeBBox(notched);
    assert.ok(bounds.x < 0.9 && bounds.x + bounds.w > 0.1, 'it overlaps the lasso bounds');
    assert.equal(hitTestLasso({ v: 1, strokes: [notched], objects: [] }, lasso).length, 0);
  });

  test('an object is taken by its centre, not by a grazed corner', () => {
    const inArm: NbObject = { id: 'in-arm', k: 'note', s: 'kept', x: 0.18, y: 0.25, w: 0.14, h: 0.1, c: GOLD };
    const inNotch: NbObject = { id: 'in-notch', k: 'note', s: 'dropped', x: 0.44, y: 0.15, w: 0.12, h: 0.1, c: GOLD };
    const page: NbPage = { v: 1, strokes: [], objects: [inArm, inNotch] };
    assert.deepEqual(
      hitTestLasso(page, lasso).map((rec) => rec.id),
      ['in-arm'],
    );
  });

  test('records come back in paint order, strokes then objects', () => {
    const second = strokeOf([[0.22, 0.22, 0.5]], { id: 'second' });
    const obj: NbObject = { id: 'obj', k: 'note', s: 'x', x: 0.2, y: 0.2, w: 0.1, h: 0.1, c: GOLD };
    const page: NbPage = { v: 1, strokes: [armed, second], objects: [obj] };
    assert.deepEqual(
      hitTestLasso(page, lasso).map((rec) => rec.id),
      ['armed', 'second', 'obj'],
    );
  });

  test('a degenerate loop takes nothing', () => {
    const page: NbPage = { v: 1, strokes: [armed], objects: [] };
    assert.deepEqual(hitTestLasso(page, [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }]), []);
    assert.deepEqual(hitTestLasso(page, []), []);
  });
});

/* ────────────────────────────────────────────────── the page the commands work over ─────────────── */

const S1 = strokeOf([[0.1, 0.1, 0.5], [0.4, 0.4, 0.6]], { id: 's1' });
const S2 = strokeOf([[0.5, 0.1, 0.5], [0.8, 0.4, 0.6]], { id: 's2' });
const IMG: NbObject = { id: 'o1', k: 'img', sha: 'sha1', x: 0.1, y: 0.5, w: 0.3, h: 0.2 };
const NOTE: NbObject = { id: 'o2', k: 'note', s: 'learn this', x: 0.5, y: 0.5, w: 0.25, h: 0.16, c: GOLD };

const base = (): NbPage => ({ v: 1, strokes: [S1, S2], objects: [IMG, NOTE] });
const seeded = (): NbPages => ({ 5: base() });

describe('transforms over a selection', () => {
  test('translate moves what is named and nothing else', () => {
    const page = translateRecords(base(), ['s1', 'o2'], 0.05, 0.02);
    assert.deepEqual(page.strokes[0].p.slice(0, 2), [0.15, 0.12]);
    assert.deepEqual(page.strokes[1], S2);
    assert.deepEqual(page.objects[0], IMG);
    assert.deepEqual([page.objects[1].x, page.objects[1].y], [0.55, 0.52]);
  });

  test('scale about an anchor leaves the anchor where it was', () => {
    const stroke = strokeOf([[0.5, 0.5, 0.5], [0.7, 0.5, 0.5]], { id: 'a' });
    const page = scaleRecords({ v: 1, strokes: [stroke], objects: [] }, ['a'], { x: 0.5, y: 0.5 }, 2, 2);
    assert.deepEqual(page.strokes[0].p.slice(0, 2), [0.5, 0.5]);
    assert.equal(q4(page.strokes[0].p[3]), 0.9);
  });

  test('scaling takes the nib with it, so shrunk handwriting is not fat', () => {
    const page = scaleRecords(base(), ['s1'], { x: 0, y: 0 }, 0.5, 0.5);
    assert.equal(page.strokes[0].w, q4(S1.w * 0.5));
  });

  test('a recolour cannot give an image a colour it has no field for', () => {
    const page = recolourRecords(base(), ['s1', 'o1', 'o2'], CORRECTION);
    assert.equal(page.strokes[0].c, CORRECTION);
    assert.deepEqual(page.objects[0], IMG);
    assert.equal('c' in page.objects[0], false);
    assert.equal((page.objects[1] as Extract<NbObject, { k: 'note' }>).c, CORRECTION);
  });

  test('delete removes only what is named', () => {
    const page = deleteRecords(base(), ['s2', 'o1']);
    assert.deepEqual(page.strokes.map((s) => s.id), ['s1']);
    assert.deepEqual(page.objects.map((o) => o.id), ['o2']);
  });

  test('duplicate mints fresh ids, offsets the copy and reports it', () => {
    let n = 0;
    const { page, records } = duplicateRecords(base(), ['s1'], { x: 0.02, y: 0.02 }, () => `copy${n++}`);
    assert.equal(page.strokes.length, 3);
    assert.deepEqual(records.map((rec) => rec.id), ['copy0']);
    assert.equal(q4(page.strokes[2].p[0]), 0.12);
    assert.equal(page.strokes[0].id, 's1', 'the original is untouched');
  });

  test('nothing mutates the page it was handed', () => {
    const page = base();
    const snapshot = structuredClone(page);
    translateRecords(page, ['s1'], 0.1, 0.1);
    scaleRecords(page, ['s1'], { x: 0, y: 0 }, 2, 2);
    recolourRecords(page, ['s1'], CORRECTION);
    deleteRecords(page, ['s1']);
    duplicateRecords(page, ['s1']);
    assert.deepEqual(page, snapshot);
  });
});

describe('the command stack — apply then revert', () => {
  /** The one property every command has to have: it can put the page back exactly as it found it. */
  const roundTrip = (command: InkCommand) => {
    const before = seeded();
    const after = apply(before, command);
    assert.notDeepEqual(after[5], before[5], 'the command changed nothing, so it proves nothing');
    assert.deepEqual(revert(after, command), before);
  };

  const fresh = strokeOf([[0.2, 0.7, 0.4], [0.35, 0.72, 0.9]], { id: 'new-stroke' });
  const freshText: NbObject = { id: 'new-text', k: 'text', s: 'tau = r F sin theta', x: 0.1, y: 0.8, w: 0.6, size: widthFraction(18), c: INK };

  test('AddStroke', () => roundTrip(addStrokeCmd(5, fresh)));
  test('AddObject', () => roundTrip(addObjectCmd(5, freshText)));
  test('Transform', () => roundTrip(transformCmd(5, base(), ['s1', 'o1'], translation(0.05, 0.02))));
  test('Recolour', () => roundTrip(recolourCmd(5, base(), ['s1', 'o2'], CORRECTION)));
  test('Delete', () => roundTrip(deleteCmd(5, base(), ['s1', 'o1'])));
  test('Paste', () => roundTrip(pasteCmd(5, [fresh, freshText])));

  test('a scale reverts exactly, which inverting the affine would not', () => {
    const command = transformCmd(5, base(), ['s1', 's2', 'o1', 'o2'], { sx: 1.7, sy: 0.63, ax: 0.31, ay: 0.44, dx: 0.017, dy: -0.009 });
    roundTrip(command);
  });

  test('Delete puts records back at the index they were taken from', () => {
    const three = strokeOf([[0.9, 0.9, 0.5]], { id: 's3' });
    const state: NbPages = { 2: { v: 1, strokes: [S1, S2, three], objects: [] } };
    const command = deleteCmd(2, state[2], ['s2']);
    const after = apply(state, command);
    assert.deepEqual(after[2].strokes.map((s) => s.id), ['s1', 's3']);
    assert.deepEqual(revert(after, command)[2].strokes.map((s) => s.id), ['s1', 's2', 's3']);
  });

  test('a multi-record Delete restores every index, not just the first', () => {
    const three = strokeOf([[0.9, 0.9, 0.5]], { id: 's3' });
    const four = strokeOf([[0.95, 0.95, 0.5]], { id: 's4' });
    const page: NbPage = { v: 1, strokes: [S1, S2, three, four], objects: [] };
    const command = deleteCmd(0, page, ['s2', 's4']);
    const after = apply({ 0: page }, command);
    assert.deepEqual(after[0].strokes.map((s) => s.id), ['s1', 's3']);
    assert.deepEqual(revert(after, command)[0].strokes.map((s) => s.id), ['s1', 's2', 's3', 's4']);
  });

  test('applying twice is applying once — StrictMode double-invokes updaters', () => {
    const command = addStrokeCmd(5, fresh);
    const once = apply(seeded(), command);
    assert.deepEqual(apply(once, command), once);
    const paste = pasteCmd(5, [fresh, freshText]);
    const pasted = apply(seeded(), paste);
    assert.deepEqual(apply(pasted, paste), pasted);
  });

  test('a command names its page, so it works on a page that has never been written', () => {
    const state = apply({}, addStrokeCmd(11, fresh));
    assert.deepEqual(state[11].strokes, [fresh]);
    assert.equal(state[11].v, 1);
  });

  test('a record the command names but the page has lost is skipped, not thrown on', () => {
    const command = transformCmd(5, base(), ['s1'], translation(0.1, 0.1));
    const emptied: NbPages = { 5: emptyPage() };
    assert.deepEqual(apply(emptied, command), emptied);
    assert.deepEqual(revert(emptied, command), emptied);
  });
});

describe('undo and redo are notebook-wide', () => {
  const fresh = strokeOf([[0.2, 0.7, 0.4], [0.35, 0.72, 0.9]], { id: 'new-stroke' });

  test('Ctrl+Z on page 6 reaches the stroke made on page 5', () => {
    const command = addStrokeCmd(5, fresh);
    const state = apply({ 5: emptyPage(), 6: emptyPage() }, command);
    const history = pushCommand(emptyHistory(), command);

    const back = undo(state, history);
    assert.equal(back.command, command);
    assert.deepEqual(back.state[5].strokes, []);
    assert.deepEqual(back.state[6].strokes, []);

    const forward = redo(back.state, back.history);
    assert.deepEqual(forward.state[5].strokes, [fresh]);
    assert.equal(forward.history.done.length, 1);
    assert.equal(forward.history.undone.length, 0);
  });

  test('undo on an empty stack is a no-op, and so is redo', () => {
    const state = seeded();
    const history = emptyHistory();
    const back = undo(state, history);
    assert.equal(back.state, state);
    assert.equal(back.command, null);
    const forward = redo(state, history);
    assert.equal(forward.state, state);
    assert.equal(forward.command, null);
  });

  test('a new command discards the redo branch', () => {
    const first = addStrokeCmd(0, fresh);
    const second = addStrokeCmd(0, strokeOf([[0.6, 0.6, 0.5]], { id: 'second' }));
    let history = pushCommand(emptyHistory(), first);
    history = undo({ 0: emptyPage() }, history).history;
    assert.equal(history.undone.length, 1);
    history = pushCommand(history, second);
    assert.equal(history.undone.length, 0);
    assert.equal(history.done.length, 1);
  });
});

describe('the history file', () => {
  const strokeIdOf = (command: InkCommand) => (command.k === 'stroke' ? command.stroke.id : '');
  const filled = () => {
    let history = pushCommand(emptyHistory(), addStrokeCmd(0, S1));
    history = pushCommand(history, deleteCmd(1, base(), ['s2']));
    history = pushCommand(history, recolourCmd(1, base(), ['s1'], CORRECTION));
    return history;
  };

  test('serialise then parse round-trips', () => {
    const history = filled();
    assert.deepEqual(parseHistory(serialiseHistory(history)), history);
  });

  test('the undone branch survives a relaunch too', () => {
    const undone = undo(seeded(), pushCommand(emptyHistory(), addStrokeCmd(5, S1))).history;
    assert.deepEqual(parseHistory(serialiseHistory(undone)), undone);
  });

  test('a truncated file degrades to an empty stack rather than throwing', () => {
    const json = serialiseHistory(filled());
    assert.deepEqual(parseHistory(json.slice(0, Math.floor(json.length * 0.6))), emptyHistory());
  });

  test('garbage degrades to an empty stack', () => {
    for (const bad of [
      '',
      '{',
      'null',
      '[]',
      '"a string"',
      '{"v":1}',
      '{"v":1,"done":{},"undone":[]}',
      '{"v":2,"done":[],"undone":[]}',
      JSON.stringify({ v: 1, done: [{ k: 'nope', page: 0 }], undone: [] }),
      JSON.stringify({ v: 1, done: [{ k: 'stroke', page: -1, stroke: { id: 'x' } }], undone: [] }),
      JSON.stringify({ v: 1, done: [{ k: 'stroke', page: 0 }], undone: [] }),
      JSON.stringify({ v: 1, done: [{ k: 'delete', page: 0, strokes: [{ rec: { id: 'x' } }], objects: [] }], undone: [] }),
    ])
      assert.deepEqual(parseHistory(bad), emptyHistory(), `should have rejected ${bad}`);
    assert.deepEqual(parseHistory(null), emptyHistory());
    assert.deepEqual(parseHistory(undefined), emptyHistory());
  });

  test('one bad command discards the whole stack, not just that entry', () => {
    const parsed = JSON.parse(serialiseHistory(filled())) as { done: unknown[] };
    parsed.done.splice(1, 0, { k: 'stroke', page: 0, stroke: 'not a record' });
    assert.deepEqual(parseHistory(JSON.stringify({ v: 1, ...parsed })), emptyHistory());
  });

  test('the depth cap drops the oldest', () => {
    let history = emptyHistory();
    for (let i = 0; i < HISTORY_DEPTH + 5; i++)
      history = pushCommand(history, addStrokeCmd(0, strokeOf([[0.1, 0.1, 0.5]], { id: `s${i}` })));
    assert.equal(history.done.length, HISTORY_DEPTH);
    assert.equal(strokeIdOf(history.done[0]), 's5');
    assert.equal(strokeIdOf(history.done[HISTORY_DEPTH - 1]), `s${HISTORY_DEPTH + 4}`);
  });

  test('a file written past the cap is trimmed on the way in', () => {
    const done = Array.from({ length: HISTORY_DEPTH + 10 }, (_, i) =>
      addStrokeCmd(0, strokeOf([[0.1, 0.1, 0.5]], { id: `s${i}` })),
    );
    const parsed = parseHistory(JSON.stringify({ v: 1, done, undone: [] }));
    assert.equal(parsed.done.length, HISTORY_DEPTH);
    assert.equal(strokeIdOf(parsed.done[0]), 's10');
  });
});

describe('the eraser', () => {
  const line = strokeOf([[0.2, 0.5, 0.5], [0.8, 0.5, 0.5]], { id: 'line' });
  const away = strokeOf([[0.2, 0.9, 0.5], [0.8, 0.9, 0.5]], { id: 'away' });
  const page = (): NbPage => ({ v: 1, strokes: [line, away], objects: [IMG] });

  test('the default is a real edit, not a paint', () => {
    assert.equal(DEFAULT_ERASER_MODE, 'stroke');
  });

  test('stroke mode removes whole strokes and reports where they were', () => {
    const start = page();
    const { page: next, removed } = eraseAt(start, { x: 0.5, y: 0.5 }, 0.01, 'stroke');
    assert.deepEqual(removed.map((entry) => entry.rec.id), ['line']);
    assert.deepEqual(removed.map((entry) => entry.i), [0]);
    assert.deepEqual(next.strokes.map((s) => s.id), ['away']);
    assert.deepEqual(start.strokes.map((s) => s.id), ['line', 'away'], 'the page handed in is untouched');
  });

  test('paint mode leaves every stroke exactly where it is', () => {
    const start = page();
    const { page: next, removed } = eraseAt(start, { x: 0.5, y: 0.5 }, 0.01, 'paint');
    assert.equal(next, start);
    assert.deepEqual(removed, []);
  });

  test('objects are deleted, never rubbed out', () => {
    const { page: next } = eraseAt(page(), { x: 0.2, y: 0.55 }, 0.5, 'stroke');
    assert.deepEqual(next.objects, [IMG]);
  });

  test('a miss returns the same page object', () => {
    const start = page();
    assert.equal(eraseAt(start, { x: 0.02, y: 0.02 }, 0.005).page, start);
  });

  test('a wide radius takes everything it covers', () => {
    const { removed } = eraseAt(page(), { x: 0.5, y: 0.7 }, 0.3);
    assert.deepEqual(removed.map((entry) => entry.rec.id), ['line', 'away']);
  });

  test('the removed records rebuild an exact undo', () => {
    const start = page();
    const { removed } = eraseAt(start, { x: 0.5, y: 0.5 }, 0.01);
    const command = deleteCmd(4, start, removed.map((entry) => entry.rec.id));
    const state: NbPages = { 4: start };
    assert.deepEqual(revert(apply(state, command), command), state);
  });

  /**
   * A whole SWIPE, driven the way `NotebookPage.rub` drives it — because the way it used to be driven
   * corrupted the page on undo, and neither half of that is visible from a single `eraseAt` call.
   *
   * Each sample must erase against the page as reduced by the samples before it, and the command must be
   * built from the page as it stood when the rubber went down. Erasing against the untouched prop page
   * instead collected the same record once per sample AND handed `deleteCmd` a `before` with those
   * records appended to a list that already held them, so one rub produced two `Placed` entries for one
   * id and `revert` spliced both back in.
   */
  const swipe = (start: NbPage, points: Pt[]) => {
    let now = start;
    let removed: ReturnType<typeof eraseAt>['removed'] = [];
    const frames: string[][] = [];
    for (const at of points) {
      const result = eraseAt(now, at, 0.02);
      if (result.removed.length === 0) continue;
      now = result.page;
      removed = [...removed, ...result.removed];
      frames.push(now.strokes.map((s) => s.id));
    }
    return { removed, frames };
  };

  test('a swipe collects each record once, however many samples touch it', () => {
    const start = page();
    const { removed } = swipe(start, [
      { x: 0.5, y: 0.5 },
      { x: 0.502, y: 0.5 },
      { x: 0.504, y: 0.5 },
    ]);
    assert.deepEqual(removed.map((entry) => entry.rec.id), ['line']);
  });

  test('nothing already rubbed out comes back mid-swipe', () => {
    const { frames } = swipe(page(), [
      { x: 0.5, y: 0.9 },
      { x: 0.5, y: 0.5 },
    ]);
    assert.deepEqual(frames, [['line'], []], 'each frame is a subset of the one before it');
  });

  test('undoing a whole swipe restores the page exactly, not several copies of it', () => {
    const start = page();
    const { removed } = swipe(start, [
      { x: 0.5, y: 0.5 },
      { x: 0.502, y: 0.5 },
      { x: 0.5, y: 0.9 },
    ]);
    const command = deleteCmd(4, start, removed.map((entry) => entry.rec.id));
    const state: NbPages = { 4: start };
    const after = apply(state, command);
    assert.deepEqual(after[4].strokes, [], 'both strokes went');
    assert.deepEqual(revert(after, command), state);
  });
});

describe('the rAF coalescer', () => {
  test('many marks inside one frame paint exactly once', () => {
    let painted = 0;
    const queue: (() => void)[] = [];
    const loop = createInkLoop(
      () => painted++,
      (cb) => queue.push(cb),
      () => {},
    );
    loop.mark();
    loop.mark();
    loop.mark();
    assert.equal(queue.length, 1, 'one frame scheduled for three moves');
    queue.shift()!();
    assert.equal(painted, 1);

    loop.mark();
    assert.equal(queue.length, 1, 'the next move schedules a fresh frame');
    queue.shift()!();
    assert.equal(painted, 2);
  });

  test('a frame with nothing to show does not paint', () => {
    let painted = 0;
    const queue: (() => void)[] = [];
    const loop = createInkLoop(
      () => painted++,
      (cb) => queue.push(cb),
      () => {},
    );
    loop.mark();
    loop.stop();
    queue.shift()!();
    assert.equal(painted, 0);
  });

  test('stop cancels the pending frame by its handle', () => {
    let cancelled = 0;
    const loop = createInkLoop(
      () => {},
      () => 7,
      (handle) => {
        cancelled = handle;
      },
    );
    loop.mark();
    loop.stop();
    assert.equal(cancelled, 7);
  });
});

describe('the pointer edge', () => {
  test('every coalesced sample is recovered, as page fractions', () => {
    const merged = [pointer({ clientX: 200, clientY: 100, pressure: 0.4 }), pointer({ clientX: 210, clientY: 110, pressure: 0.5 })];
    const samples = samplePointer({ ...pointer({ clientX: 210, clientY: 110 }), getCoalescedEvents: () => merged }, RECT);
    assert.equal(samples.length, 2);
    assert.equal(samples[0].x, (200 - RECT.left) / RECT.width);
    assert.equal(samples[0].y, (100 - RECT.top) / RECT.height);
    assert.equal(samples[0].pressure, 0.4);
  });

  test('a pointer with no coalesced list still yields its own sample', () => {
    const samples = samplePointer(pointer({ clientX: 300, clientY: 400 }), RECT);
    assert.equal(samples.length, 1);
    assert.equal(samples[0].x, (300 - RECT.left) / RECT.width);
  });

  test('an empty coalesced list falls back to the event itself', () => {
    const samples = samplePointer({ ...pointer(), getCoalescedEvents: () => [] }, RECT);
    assert.equal(samples.length, 1);
  });

  test('a mouse sample is normalised even though its pressure looks plausible', () => {
    assert.equal(samplePointer(pointer({ pointerType: 'mouse', pressure: 0.5 }), RECT)[0].pressure, NO_PRESSURE);
  });

  test('an unlaid-out canvas yields nothing rather than dividing by zero', () => {
    assert.deepEqual(samplePointer(pointer(), { left: 0, top: 0, width: 0, height: 0 }), []);
  });

  test('a palm landing beside a pen is dropped', () => {
    const pen = { pointerId: 1, pointerType: 'pen' };
    assert.equal(acceptsPointer(pointer({ pointerId: 9, pointerType: 'touch' }), pen), false);
  });

  test('a second pointer cannot steal an in-flight stroke', () => {
    const owner = { pointerId: 1, pointerType: 'pen' };
    assert.equal(acceptsPointer(pointer({ pointerId: 2, pointerType: 'pen' }), owner), false);
    assert.equal(acceptsPointer(pointer({ pointerId: 1 }), owner), true);
  });

  test('a non-primary pointer never starts one', () => {
    assert.equal(acceptsPointer(pointer({ isPrimary: false }), null), false);
    assert.equal(acceptsPointer(pointer({ isPrimary: true }), null), true);
  });
});
