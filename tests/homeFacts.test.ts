import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { countedDays, rankSubjects, streaksOf } from '@/lib/homeFacts';
import type { Subject } from '@/lib/types';

/** The streak and ranking Home and Hush share. Moved out of DashboardView; pinned here. */
describe('streaksOf — current run anchored on today or yesterday', () => {
  const clock = new Date(2026, 8, 24, 15);

  test('counts back from today when today is counted', () => {
    const days = countedDays({ '2026-09-22': 30, '2026-09-23': 30, '2026-09-24': 30 }, 10);
    assert.deepEqual(streaksOf(days, clock), { current: 3, longest: 3 });
  });

  test('counts back from yesterday when today is not counted yet', () => {
    const days = countedDays({ '2026-09-22': 30, '2026-09-23': 30, '2026-09-24': 2 }, 10);
    assert.equal(streaksOf(days, clock).current, 2);
  });

  test('a gap resets the current run but not the longest', () => {
    const days = countedDays({ '2026-09-01': 30, '2026-09-02': 30, '2026-09-03': 30, '2026-09-24': 30 }, 10);
    assert.deepEqual(streaksOf(days, clock), { current: 1, longest: 3 });
  });
});

describe('rankSubjects — furthest behind first', () => {
  const subject = (code: string, name: string, papers: number) => ({ id: Number(code), code, name, papers }) as Subject;
  const marks = { done: new Set(['9702/s25/12', '9702/s25/22']), revision: new Set<string>(), bookmarks: new Set<string>() };

  test('orders the chosen subjects by share done', () => {
    const ranked = rankSubjects({
      subjects: [subject('9702', 'Physics', 10), subject('9701', 'Chemistry', 10)],
      marks,
      recent: [],
      rows: {},
      chosen: ['9702', '9701'],
    });
    assert.deepEqual(ranked.map((r) => [r.name, r.pct]), [['Chemistry', 0], ['Physics', 20]]);
  });
});
