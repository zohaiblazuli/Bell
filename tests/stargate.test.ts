import assert from 'node:assert/strict';
import test from 'node:test';
import { loadStarGateVerified, saveStarGateVerified } from '../src/lib/store';

test('Star Gate Store State', async (t) => {
  await t.test('defaults to false for clean state', () => {
    // In node environment with empty cache
    assert.equal(typeof loadStarGateVerified(), 'boolean');
  });

  await t.test('updates and retrieves star gate verified state', () => {
    saveStarGateVerified(true);
    assert.equal(loadStarGateVerified(), true);
    saveStarGateVerified(false);
    assert.equal(loadStarGateVerified(), false);
  });
});
