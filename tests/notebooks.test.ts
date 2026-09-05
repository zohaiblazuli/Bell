/**
 * The page arithmetic — `src/lib/notebooks.ts`.
 *
 * This is the file that makes "infinite pages, never ask the student" true rather than merely claimed,
 * and it is pure, so it is worth pinning. The figures the design file draws are the fixtures: Figma
 * shows `pages 12-13` in the spread nav, lists `Spreads 2-3 … 18-19` in the Pages tab, and prints
 * `48 pages` in the topbar — three independent numbers that only agree under one model, which is what
 * the first suite below asserts. If someone "simplifies" the +2 display offset away, these fail.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  INK_TOOLS,
  PAGE_LABEL_OFFSET,
  emptyPage,
  isInkTool,
  isNbId,
  pageBottom,
  pageCountFromMaxIndex,
  pageIsEmpty,
  pageLabel,
  pageStem,
  q4,
  spreadCountFor,
  spreadLabel,
  spreadOf,
  spreadPages,
  type NbPage,
  type NbTool,
} from '@/lib/notebooks';
import { DEFAULT_INK_OPACITY, DEFAULT_INK_WIDTH_PX } from '@/lib/ink';

describe('the four tools that lay ink down', () => {
  const ALL: NbTool[] = [
    'pen',
    'pencil',
    'hl',
    'er',
    'lasso',
    'shapes',
    'text',
    'image',
    'ruler',
    'sticky',
  ];

  test('exactly four of the ten are ink tools', () => {
    assert.deepEqual(ALL.filter(isInkTool), ['pen', 'pencil', 'hl', 'er']);
    assert.deepEqual([...INK_TOOLS], ['pen', 'pencil', 'hl', 'er']);
  });

  /**
   * Every ink tool needs a size AND an opacity, because `patchInk` remembers them per tool and a gap in
   * either table would hand a tool `undefined` and paint an invisible or a zero-width stroke.
   *
   * The highlighter's numbers are the point of the pair: §5d measures its swipe as a 196x14 rect at node
   * opacity 0.34, and while nothing read these the highlighter drew an opaque 8px bar over the words it
   * exists to tint.
   */
  test('each one carries a measured size and opacity', () => {
    for (const tool of INK_TOOLS) {
      assert.equal(typeof DEFAULT_INK_WIDTH_PX[tool], 'number', tool);
      assert.equal(typeof DEFAULT_INK_OPACITY[tool], 'number', tool);
      assert.ok(DEFAULT_INK_WIDTH_PX[tool] > 0, tool);
      assert.ok(DEFAULT_INK_OPACITY[tool] > 0 && DEFAULT_INK_OPACITY[tool] <= 1, tool);
    }
    assert.equal(DEFAULT_INK_OPACITY.hl, 0.34, 'the file’s own node opacity for the swipe');
    assert.equal(DEFAULT_INK_WIDTH_PX.hl, 14, 'and the 196x14 rect it draws it as');
    assert.ok(DEFAULT_INK_OPACITY.hl < DEFAULT_INK_OPACITY.pen, 'a highlighter is never a pen');
  });
});

describe('the design file’s own numbers', () => {
  test('the spread nav reads `pages 12-13` somewhere real', () => {
    // Spread 5 is the sixth leaf. Under the offset its labels are 12 and 13, which is what §5e draws.
    assert.equal(spreadLabel(5), 'pages 12-13');
    assert.deepEqual(spreadPages(5), [10, 11]);
  });

  test('the Pages tab’s list starts at `2-3` and its ninth row is `18-19`', () => {
    // §6b: five rows of two tiles, nine spreads plus a trailing ghost. Spread 0 is the FIRST leaf, so
    // the list starting at 2-3 is complete rather than scrolled.
    assert.equal(spreadLabel(0), 'pages 2-3');
    assert.equal(spreadLabel(8), 'pages 18-19');
  });

  test('a 48-page notebook’s last spread reads `48-49`', () => {
    // §4d and §5a both say 48 pages. 48 pages is 24 spreads, indices 0..23.
    assert.equal(spreadCountFor(48), 24);
    assert.equal(spreadLabel(23), 'pages 48-49');
    assert.equal(pageCountFromMaxIndex(47), 48);
  });

  test('the offset is 2, and a left page is therefore always even', () => {
    assert.equal(PAGE_LABEL_OFFSET, 2);
    for (let s = 0; s < 30; s++) {
      const [l, r] = spreadPages(s);
      assert.equal(pageLabel(l) % 2, 0, `left page of spread ${s} must be even`);
      assert.equal(pageLabel(r), pageLabel(l) + 1);
    }
  });
});

describe('the derived page count', () => {
  test('a notebook with nothing written still has one whole spread', () => {
    // -1 is "no page file exists at all". A notebook opens on two blank pages, so the floor is 2 —
    // never 0, and never 1, which would be half a leaf.
    assert.equal(pageCountFromMaxIndex(-1), 2);
  });

  test('one written page still reports a whole spread', () => {
    assert.equal(pageCountFromMaxIndex(0), 2);
    assert.equal(pageCountFromMaxIndex(1), 2);
  });

  test('it rounds up to a whole spread, never down', () => {
    assert.equal(pageCountFromMaxIndex(2), 4);
    assert.equal(pageCountFromMaxIndex(3), 4);
    assert.equal(pageCountFromMaxIndex(4), 6);
    assert.equal(pageCountFromMaxIndex(47), 48);
    assert.equal(pageCountFromMaxIndex(48), 50);
  });

  test('a sparse set counts to the highest index, not to how many files exist', () => {
    // Pages are written only when they have content, so 0, 3 and 47 is an ordinary notebook — someone
    // who wrote on page 2, page 5 and then jumped to the end. Counting the FILES would report 4 pages
    // and lose everything after them.
    const highest = Math.max(0, 3, 47);
    assert.equal(pageCountFromMaxIndex(highest), 48);
  });

  test('spread count and page count never disagree', () => {
    for (let max = -1; max < 60; max++) {
      const pages = pageCountFromMaxIndex(max);
      assert.equal(pages % 2, 0, 'a page count must be even');
      assert.equal(spreadCountFor(pages), pages / 2);
      // Every written index has to fall inside the reported range.
      if (max >= 0) assert.ok(max < pages, `index ${max} must be inside ${pages} pages`);
    }
  });
});

describe('index and spread round trips', () => {
  test('spreadOf inverts spreadPages for both halves', () => {
    for (let s = 0; s < 40; s++) {
      const [l, r] = spreadPages(s);
      assert.equal(spreadOf(l), s);
      assert.equal(spreadOf(r), s);
    }
  });

  test('the disk stem is four digits, zero-padded', () => {
    assert.equal(pageStem(0), '0000');
    assert.equal(pageStem(9), '0009');
    assert.equal(pageStem(47), '0047');
    assert.equal(pageStem(1234), '1234');
  });

  test('the stem stays four digits for every page a spread can reach in one lifetime', () => {
    // Rust ignores any stem that is not exactly four digits, so a fifth digit writes a file the page
    // scanner cannot see. 9999 is the documented cap; this pins where it starts to matter.
    assert.equal(pageStem(9999).length, 4);
    assert.equal(pageStem(10_000).length, 5);
  });
});

describe('notebook ids', () => {
  test('sixteen lowercase alphanumerics, and nothing else', () => {
    assert.ok(isNbId('a1b2c3d4e5f6g7h8'));
    assert.ok(isNbId('0000000000000000'));
  });

  test('everything that could escape the notebooks directory is rejected', () => {
    for (const bad of [
      '',
      'a1b2c3d4e5f6g7h', // 15
      'a1b2c3d4e5f6g7h8i', // 17
      'A1B2C3D4E5F6G7H8', // uppercase
      '..',
      '../../secrets',
      'a1b2c3d4/e5f6g7h',
      'a1b2c3d4\\e5f6g7h',
      '.a1b2c3d4e5f6g7h',
      'a1b2c3d4e5f6g7h.',
      'a1b2c3d4e5f6g7h-',
      'а1b2c3d4e5f6g7h8', // leading Cyrillic а, a lookalike
    ]) {
      assert.equal(isNbId(bad), false, `must reject ${JSON.stringify(bad)}`);
    }
  });
});

describe('geometry', () => {
  test('q4 keeps four decimal places and nothing more', () => {
    assert.equal(q4(0.123456789), 0.1235);
    assert.equal(q4(0.99995), 1);
    assert.equal(q4(0), 0);
    assert.equal(q4(-0.00004), -0);
  });

  test('four places is sub-pixel on the page the file draws', () => {
    // 455 wide, so one unit of quantisation is 0.0455px. Anything coarser would be visible.
    assert.ok(0.0001 * 455 < 0.05);
  });
});

describe('pageBottom', () => {
  const stroke = (id: string, ys: number[]): NbPage['strokes'][number] => ({
    id,
    t: 'pen',
    c: '#101010',
    w: 0.01,
    p: ys.flatMap((y) => [0.5, y, 0.5]),
  });

  test('a blank page has no bottom', () => {
    assert.equal(pageBottom(emptyPage()), 0);
    assert.ok(pageIsEmpty(emptyPage()));
  });

  test('it reads the y of every third element, not every element', () => {
    // The stream is [x, y, pressure, …]. Reading it as pairs would pick up pressures as y values and
    // report a bottom of 0.5 for a page whose ink stops at 0.2.
    assert.equal(pageBottom({ v: 1, strokes: [stroke('a', [0.1, 0.2])], objects: [] }), 0.2);
  });

  test('an object counts its own height', () => {
    assert.equal(
      pageBottom({
        v: 1,
        strokes: [],
        objects: [{ id: 'i', k: 'img', sha: 'f'.repeat(64), x: 0.1, y: 0.3, w: 0.5, h: 0.25 }],
      }),
      0.55,
    );
  });

  test('a text object has no height and is measured at its origin', () => {
    assert.equal(
      pageBottom({
        v: 1,
        strokes: [],
        objects: [{ id: 't', k: 'text', s: 'F = 27.4 N', x: 0.1, y: 0.4, w: 0.5, size: 0.03, c: '#1a1c24' }],
      }),
      0.4,
    );
  });

  test('the lowest of everything wins, and it never leaves the page', () => {
    assert.equal(
      pageBottom({
        v: 1,
        strokes: [stroke('a', [0.9]), stroke('b', [0.2])],
        objects: [{ id: 'n', k: 'note', s: 'learn this', x: 0.5, y: 0.6, w: 0.25, h: 0.16, c: '#f7cf5c' }],
      }),
      0.9,
    );
    // A stroke that ran off the page (a fast flick past the edge) is clamped, so a clip placed under
    // it cannot be pushed outside the sheet.
    assert.equal(pageBottom({ v: 1, strokes: [stroke('a', [1.4])], objects: [] }), 1);
  });
});
