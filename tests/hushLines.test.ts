import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HUSH_LINES,
  SAY_KEYS,
  pickFrom,
  routeSayKey,
  fillTemplate,
  canSay,
  pickLine,
  drawFrom,
  pokeMs,
  type HushBag,
  type HushSayKey,
} from '@/lib/hushLines';
import { slotOf } from '@/lib/greetings';

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

  test('the small hours are evening, not morning', () => {
    assert.equal(routeSayKey('dashboard', facts, 2), 'dashboard-evening');
    assert.equal(routeSayKey('dashboard', facts, 23), 'dashboard-evening');
  });

  test("Hush keeps the headline greeting's clock, hour by hour", () => {
    const expected = { morning: 'dashboard-morning', afternoon: 'dashboard-afternoon', evening: 'dashboard-evening', night: 'dashboard-evening' } as const;
    for (let hour = 0; hour < 24; hour++) {
      assert.equal(routeSayKey('dashboard', facts, hour), expected[slotOf(hour)], `hour ${hour}`);
    }
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

/**
 * The student's own numbers. A line quoting a fact Hush doesn't have is never picked, so "day
 * {streak}" can't show on day one and the countdown can't show mid-sitting.
 */
describe('fact lines — only said when the fact is there', () => {
  const base = { papers: 2605, recentCount: 3, bookmarks: 1 };

  test('canSay needs a streak of two or more', () => {
    assert.equal(canSay('day {streak}.', { ...base, streak: 1 }), false);
    assert.equal(canSay('day {streak}.', { ...base, streak: 2 }), true);
    assert.equal(canSay('day {streak}.', base), false);
  });

  test('canSay needs the sitting ahead, not under way', () => {
    assert.equal(canSay('{minutes} left', { ...base, minutesToExam: -5 }), false);
    assert.equal(canSay('{minutes} left', { ...base, minutesToExam: null }), false);
    assert.equal(canSay('{minutes} left', { ...base, minutesToExam: 90 }), true);
  });

  test('canSay needs a subject furthest behind', () => {
    assert.equal(canSay('{behind} is behind', { ...base, behind: null }), false);
    assert.equal(canSay('{behind} is behind', { ...base, behind: 'Physics' }), true);
  });

  test('fillTemplate writes the streak, minutes and subject', () => {
    const facts = { ...base, streak: 9, minutesToExam: 172800, behind: 'Chemistry' };
    assert.equal(fillTemplate('day {streak}.', facts), 'day 9.');
    assert.equal(fillTemplate('{minutes} left', facts), '172,800 minutes left');
    assert.equal(fillTemplate('{behind} is behind', facts), 'Chemistry is behind');
  });

  test('a Home pick without facts never lands on a fact line', () => {
    for (const key of ['dashboard-morning', 'dashboard-afternoon', 'dashboard-evening'] as HushSayKey[]) {
      for (let i = 0; i < HUSH_LINES[key].length; i++) {
        const line = pickLine(key, { facts: base, rng: () => i / HUSH_LINES[key].length });
        assert.ok(canSay(line, base), `"${line}" needs a fact that is missing`);
      }
    }
  });
});

/** A seeded rng, so the dealing tests shuffle for real but reproducibly. */
function seeded(seed: number): () => number {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

/**
 * The deck: the fix for "I keep seeing the same line". Every line once before any line twice, never
 * the same line back to back — even across a reshuffle — and a deck saved before the pool was edited
 * still deals only lines that exist.
 */
describe('drawFrom — a shuffled deck, not a dice roll', () => {
  const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

  test('deals every line once before any repeats', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = seeded(seed);
      let bag: HushBag | null = null;
      const seen = new Set<string>();
      for (let i = 0; i < pool.length; i++) {
        const next = drawFrom(pool, bag, { rng });
        bag = next.bag;
        assert.ok(!seen.has(next.line), `seed ${seed}: "${next.line}" came up twice in one round`);
        seen.add(next.line);
      }
      assert.equal(seen.size, pool.length);
    }
  });

  test('never repeats a line back to back, across rounds included', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = seeded(seed);
      let bag: HushBag | null = null;
      let prev: string | null = null;
      for (let i = 0; i < pool.length * 6; i++) {
        const next = drawFrom(pool, bag, { rng });
        assert.notEqual(next.line, prev, `seed ${seed}, draw ${i}`);
        prev = next.line;
        bag = next.bag;
      }
    }
  });

  test('a saved deck drops lines the pool no longer has', () => {
    const bag: HushBag = { left: ['gone', 'b'], last: 'a' };
    const { line } = drawFrom(['a', 'b', 'c'], bag, { rng: () => 0 });
    assert.equal(line, 'b');
  });

  test('an unsayable line is skipped but kept for later', () => {
    const can = (l: string) => l !== 'fact';
    const first = drawFrom(['fact', 'x', 'y'], { left: ['fact', 'x', 'y'], last: null }, { can });
    assert.equal(first.line, 'x');
    assert.deepEqual(first.bag.left, ['fact', 'y']);
    // Once the fact exists, the kept line is dealt.
    const later = drawFrom(['fact', 'x', 'y'], first.bag);
    assert.equal(later.line, 'fact');
  });

  test('a one-line pool keeps saying its line', () => {
    let bag: HushBag | null = null;
    for (let i = 0; i < 3; i++) {
      const next = drawFrom(['solo'], bag);
      assert.equal(next.line, 'solo');
      bag = next.bag;
    }
  });

  test('a pool with nothing sayable still answers', () => {
    const { line } = drawFrom(['only {streak}'], null, { can: () => false });
    assert.equal(line, 'only {streak}');
  });
});

describe('pokeMs — long enough to read', () => {
  test('a short quip still gets four seconds', () => {
    assert.equal(pokeMs('hi.'), 4000);
  });

  test('longer lines get longer, up to seven seconds', () => {
    assert.ok(pokeMs('x'.repeat(50)) > 4000);
    assert.equal(pokeMs('x'.repeat(200)), 7000);
  });

  test('every poke line stays up at least four seconds', () => {
    for (const line of HUSH_LINES.poke) assert.ok(pokeMs(line) >= 4000, line);
  });
});

/**
 * The bubble spans the sidebar foot: about 170px of text at 13px, some 24 characters. A word longer
 * than that cannot wrap and would push out of the balloon, and a line past four rows starts to crowd
 * the foot. Checked AFTER filling, with the widest facts the app can produce.
 */
describe('HUSH_LINES — every filled line fits the bubble', () => {
  const worst = {
    papers: 9_999_999,
    recentCount: 9_999,
    bookmarks: 9_999,
    streak: 999,
    minutesToExam: 9_999_999,
    behind: 'Information and Communication Technology',
  };

  test('no word is wider than a bubble line', () => {
    for (const key of SAY_KEYS) {
      for (const template of HUSH_LINES[key as HushSayKey]) {
        for (const word of fillTemplate(template, worst).split(/\s+/)) {
          assert.ok(word.length <= 24, `"${word}" in "${template}" (${key}) is too wide to wrap`);
        }
      }
    }
  });

  test('no line runs past four rows', () => {
    for (const key of SAY_KEYS) {
      for (const template of HUSH_LINES[key as HushSayKey]) {
        const filled = fillTemplate(template, worst);
        assert.ok(filled.length <= 96, `"${filled}" (${key}) is ${filled.length} characters`);
      }
    }
  });
});
