import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { daysUntil, nextWindow, windowForCode } from '@/lib/sessions';

describe('windowForCode', () => {
  test('resolves a session code to its window, matching the calendar', () => {
    const w = windowForCode('s27');
    assert.ok(w);
    assert.equal(w.season, 's');
    assert.equal(w.year, 2027);
    assert.equal(w.code, 's27');
    assert.equal(w.label, 'May/June 2027');
    // May/June opens 1 May in the SERIES table.
    assert.equal(w.start.getMonth(), 4);
    assert.equal(w.start.getDate(), 1);
  });

  test('reads the two-digit year through the 1980–2079 pivot', () => {
    assert.equal(windowForCode('w85')?.year, 1985);
    assert.equal(windowForCode('m16')?.year, 2016);
    assert.equal(windowForCode('w79')?.year, 2079);
  });

  test('rejects anything that is not a real <season><yy> code', () => {
    for (const bad of ['', 'x27', 's', 's2', 's2027', 'sYZ', '27', 's-1']) {
      assert.equal(windowForCode(bad), null, `expected null for ${JSON.stringify(bad)}`);
    }
  });
});

describe('the target session drives the countdown', () => {
  // The Dashboard's rule: honour the onboarding target while daysUntil >= 0, else fall back.
  const from = new Date(2026, 8, 24); // 24 Sep 2026 — matches "7 days to Oct/Nov"

  test('a future target is counted down to, not the next calendar series', () => {
    const target = windowForCode('s27');
    assert.ok(target);
    // The target is honoured (>= 0 days away), so the hero counts to May/June 2027, not Oct/Nov 2026.
    assert.ok(daysUntil(from, target) > 100);
    const shown = daysUntil(from, target) >= 0 ? target : nextWindow(from, undefined);
    assert.equal(shown.code, 's27');
  });

  test('a target that has already passed falls back to the next series', () => {
    const target = windowForCode('s26'); // May/June 2026 — closed well before 24 Sep 2026
    assert.ok(target);
    assert.ok(daysUntil(from, target) < 0);
    const shown = daysUntil(from, target) >= 0 ? target : nextWindow(from, undefined);
    // Next series with no filter is Oct/Nov 2026, 7 days out.
    assert.equal(shown?.code, 'w26');
    assert.equal(daysUntil(from, shown!), 7);
  });

  test('no target chosen falls back to the next series', () => {
    const target = null as ReturnType<typeof windowForCode>;
    const shown = target && daysUntil(from, target) >= 0 ? target : nextWindow(from, undefined);
    assert.equal(shown?.code, 'w26');
  });
});
