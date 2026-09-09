import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { availablePaperNumbers, filterByPaperNumber } from '@/lib/libraryFilters';

const papers = [
  { paperNumber: 4, component: '41' },
  { paperNumber: 2, component: '22' },
  { paperNumber: 4, component: '42' },
  { paperNumber: 1, component: '12' },
];

describe('Library paper-number filtering', () => {
  test('offers each valid paper number once, in study order', () => {
    assert.deepEqual(
      availablePaperNumbers([...papers, { paperNumber: 2 }, { paperNumber: 0 }, { paperNumber: 3.5 }]),
      [1, 2, 4],
    );
  });

  test('keeps an unmatched selected paper visible so an empty result can be cleared', () => {
    assert.deepEqual(availablePaperNumbers([{ paperNumber: 1 }, { paperNumber: 2 }], 4), [1, 2, 4]);
    assert.deepEqual(availablePaperNumbers([], 4), [4]);
  });

  test('P4 includes every P4 variant and no other paper', () => {
    assert.deepEqual(
      filterByPaperNumber(papers, 4).map((paper) => paper.component),
      ['41', '42'],
    );
  });

  test('a cleared filter returns the complete input without mutating it', () => {
    const result = filterByPaperNumber(papers, null);
    assert.deepEqual(result, papers);
    assert.notEqual(result, papers);
  });
});
