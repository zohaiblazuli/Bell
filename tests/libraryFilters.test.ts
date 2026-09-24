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

describe('Shape Kit chrome and the Past Papers filters (Bell App v2)', () => {
  test('Day/Night lives in the shared top bar and the notebook bar, and nowhere else', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const count = (rel: string) =>
      (fs.readFileSync(path.resolve(rel), 'utf-8').match(/<TonePill/g) ?? []).length;

    assert.equal(count('src/components/TopBar.tsx'), 1, 'TopBar draws the tone switch');
    assert.equal(count('src/views/NotebookView.tsx'), 1, 'the notebook owns its own bar');
    assert.equal(count('src/components/TabBar.tsx'), 0, 'the document tab row carries no tone switch');
    assert.equal(count('src/views/LibraryView.tsx'), 0);
  });

  test('Past Papers filters are chips, season chips and a P1–P6 toggle, with no Downloaded chip', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const lv = fs.readFileSync(path.resolve('src/views/LibraryView.tsx'), 'utf-8');
    assert.ok(lv.includes('className="lv-filters-btn"'), 'a collapsible Filters button');
    assert.ok(lv.includes('className="lv-papers"'), 'a paper-number toggle');
    assert.ok(lv.includes('<SeasonIcon season={s.key}'), 'season chips carry their glyph');
    assert.ok(!/['">]Downloaded['"<]/.test(lv), 'the Downloaded chip is gone — cards say Solve or Download');
    assert.ok(!lv.includes('FilterDropdown'), 'no dropdowns');
  });
});
