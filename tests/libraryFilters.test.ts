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

describe('Theme switcher and Library Filter dropdowns', () => {
  test('exactly one TonePill exists globally in TabBar.tsx', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const srcFiles = [
      'src/components/TabBar.tsx',
      'src/components/TopBar.tsx',
      'src/views/NotebookView.tsx',
      'src/views/LibraryView.tsx',
    ];

    let count = 0;
    for (const rel of srcFiles) {
      const content = fs.readFileSync(path.resolve(rel), 'utf-8');
      const matches = content.match(/<TonePill/g);
      if (matches) count += matches.length;
    }

    assert.equal(count, 1, 'Expected exactly 1 global <TonePill> across all top bars and views');

    // TabBar.tsx must be the one containing it
    const tabBarContent = fs.readFileSync(path.resolve('src/components/TabBar.tsx'), 'utf-8');
    assert.ok(tabBarContent.includes('<TonePill'), 'TabBar.tsx must contain the global TonePill');
  });

  test('background bloom layers use GPU transform and will-change acceleration', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const bgCss = fs.readFileSync(path.resolve('src/styles/background.css'), 'utf-8');
    assert.ok(bgCss.includes('will-change: opacity;'), 'background.css must declare will-change: opacity');
    assert.ok(
      bgCss.includes('transform: translate3d(0, 0, 0);'),
      'background.css must promote bloom layers to GPU compositing via translate3d',
    );
  });

  test('LibraryView uses FilterDropdown for Level, Season, and Paper filtering', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const lvContent = fs.readFileSync(path.resolve('src/views/LibraryView.tsx'), 'utf-8');
    assert.ok(lvContent.includes("import FilterDropdown from '@ui/FilterDropdown';"));
    assert.ok(lvContent.includes('<FilterDropdown\n                label="Level"'));
    assert.ok(lvContent.includes('<FilterDropdown\n                label="Season"'));
    assert.ok(lvContent.includes('<FilterDropdown\n                    label="Paper"'));
  });
});
