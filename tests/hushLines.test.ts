import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HUSH_LINES,
  SAY_KEYS,
  pickFrom,
  routeSayKey,
  fillTemplate,
  type HushSayKey,
} from '@/lib/hushLines';

/**
 * The picker is the whole of Hush's variety: a random line from a pool that never repeats the one
 * just shown. `pickFrom` takes the pool directly so the selection logic is testable without reaching
 * through the registry, and an injectable `rng` makes "random" deterministic here.
 */
describe('pickFrom — random line, never an immediate repeat', () => {
  test('rng at the bottom of the range picks the first line', () => {
    assert.equal(pickFrom(['a', 'b', 'c'], { rng: () => 0 }), 'a');
  });

  test('rng near the top of the range picks the last line', () => {
    assert.equal(pickFrom(['a', 'b', 'c'], { rng: () => 0.999 }), 'c');
  });

  test('skips the avoided line even when the roll lands on it', () => {
    // rng → index 0, which is the line we just said, so it must move off it.
    assert.equal(pickFrom(['a', 'b'], { avoid: 'a', rng: () => 0 }), 'b');
  });

  test('a one-line pool returns its line even if that is the avoided one', () => {
    assert.equal(pickFrom(['solo'], { avoid: 'solo', rng: () => 0 }), 'solo');
  });
});

/**
 * Which pool a screen resolves to. The route, the time of day (dashboard only) and the count facts
 * decide it; the actual wording is the pool's business.
 */
describe('routeSayKey — screen and facts choose the pool', () => {
  const facts = { papers: 2605, recentCount: 3, bookmarks: 2 };

  test('the dashboard greeting splits by time of day', () => {
    assert.equal(routeSayKey('dashboard', facts, 9), 'dashboard-morning');
    assert.equal(routeSayKey('dashboard', facts, 14), 'dashboard-afternoon');
    assert.equal(routeSayKey('dashboard', facts, 20), 'dashboard-evening');
  });

  test('every reading surface shares the reader pool', () => {
    assert.equal(routeSayKey('reader', facts, 9), 'reader');
    assert.equal(routeSayKey('workspace', facts, 9), 'reader');
    assert.equal(routeSayKey('community-reader', facts, 9), 'reader');
  });

  test('both notebook routes share the notebooks pool', () => {
    assert.equal(routeSayKey('notebooks', facts, 9), 'notebooks');
    assert.equal(routeSayKey('notebook', facts, 9), 'notebooks');
  });

  test('recent and bookmarks split empty from populated', () => {
    assert.equal(routeSayKey('recent', { ...facts, recentCount: 0 }, 9), 'recent-empty');
    assert.equal(routeSayKey('recent', { ...facts, recentCount: 3 }, 9), 'recent-some');
    assert.equal(routeSayKey('bookmarks', { ...facts, bookmarks: 0 }, 9), 'bookmarks-empty');
    assert.equal(routeSayKey('bookmarks', { ...facts, bookmarks: 2 }, 9), 'bookmarks-some');
  });

  test('the library default splits on whether any papers are indexed', () => {
    assert.equal(routeSayKey('library', { ...facts, papers: 2605 }, 9), 'library-some');
    assert.equal(routeSayKey('library', { ...facts, papers: null }, 9), 'library-empty');
    assert.equal(routeSayKey('library', { ...facts, papers: 0 }, 9), 'library-empty');
  });
});

/**
 * Count tokens are filled at render time, so a line can carry the real number and still pluralise
 * correctly. Lines with no token pass through untouched.
 */
describe('fillTemplate — real counts, correct plurals', () => {
  const facts = { papers: 2605, recentCount: 3, bookmarks: 1 };

  test('{recent} pluralises against the recent count', () => {
    assert.equal(fillTemplate('{recent} lately.', { ...facts, recentCount: 1 }), '1 paper lately.');
    assert.equal(fillTemplate('{recent} lately.', { ...facts, recentCount: 3 }), '3 papers lately.');
  });

  test('{papers} carries the localised count and its noun', () => {
    assert.equal(fillTemplate('{papers}. Zero wifi needed.', facts), '2,605 papers. Zero wifi needed.');
  });

  test('{bookmarks} pluralises against the bookmark count', () => {
    assert.equal(fillTemplate('{bookmarks} waiting.', { ...facts, bookmarks: 1 }), '1 bookmark waiting.');
    assert.equal(fillTemplate('{bookmarks} waiting.', { ...facts, bookmarks: 4 }), '4 bookmarks waiting.');
  });

  test('a line with no token is returned unchanged', () => {
    assert.equal(fillTemplate('Watching the clock. Not you.', facts), 'Watching the clock. Not you.');
  });
});

/**
 * Invariants that keep the registry honest: a pool for every key, no empty pool, and every line
 * inside Hush's bubble constraint — twelve words at most, because the bubble types at a fixed size.
 */
describe('HUSH_LINES — the registry stays within Hush\'s constraints', () => {
  test('every declared key has a non-empty pool', () => {
    for (const key of SAY_KEYS) {
      const pool = HUSH_LINES[key as HushSayKey];
      assert.ok(Array.isArray(pool) && pool.length > 0, `pool "${key}" must be a non-empty array`);
    }
  });

  test('every line is twelve words or fewer', () => {
    for (const key of SAY_KEYS) {
      for (const line of HUSH_LINES[key as HushSayKey]) {
        const words = line.trim().split(/\s+/).length;
        assert.ok(words <= 12, `"${line}" (${key}) is ${words} words — over the twelve-word cap`);
      }
    }
  });

  test('no line is blank', () => {
    for (const key of SAY_KEYS) {
      for (const line of HUSH_LINES[key as HushSayKey]) {
        assert.ok(line.trim().length > 0, `a line in "${key}" is blank`);
      }
    }
  });
});
