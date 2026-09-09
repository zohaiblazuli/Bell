import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tabReducer,
  DEFAULT_LIBRARY_TAB,
  type TabsState,
} from '@/state/useTabs';
import type { PaperRow } from '@/lib/types';
import type { CommunityResource } from '@/lib/community';
import type { WorkspaceDocument } from '@/lib/workspace';

const samplePaper: PaperRow = {
  id: 101,
  subjectId: 1,
  subjectCode: '9709',
  subjectName: 'Mathematics',
  qualification: 'a_level',
  level: 'A Level',
  year: 2022,
  scode: 's22',
  season: 'may_june',
  component: '12',
  paperNumber: 1,
  variant: 2,
  totalMarks: 75,
  aThreshold: 55,
  bThreshold: 45,
  cThreshold: 35,
  dThreshold: 25,
  eThreshold: 15,
  aPct: 20,
  curveMeanPct: 50,
  spanPct: 40,
  hardnessScore: 60,
  difficulty: 'medium',
  difficultyBasis: 'component',
  difficultyNote: 'Typical',
  hasMs: true,
};

const sampleBook: CommunityResource = {
  id: 202,
  title: 'Cambridge Pure Mathematics 1',
  description: 'Textbook for AS Level Pure Math',
  resourceType: 'book',
  qualification: 'a_level',
  subjectCode: '9709',
  curriculumBoard: 'CAIE',
  uploaderName: 'Examiner',
  isVerified: true,
  upvotesCount: 42,
  downloadsCount: 150,
  fileSize: 15000000,
  fileFormat: 'pdf',
  originalFileName: 'pure_math_1.pdf',
  storagePath: 'resources/202.pdf',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

describe('Tab System Operations & Lifecycle', () => {
  test('initial state has default library tab', () => {
    const state: TabsState = {
      tabs: [DEFAULT_LIBRARY_TAB],
      activeId: DEFAULT_LIBRARY_TAB.id,
    };
    assert.equal(state.tabs.length, 1);
    assert.equal(state.tabs[0].id, 'shelf:library');
    assert.equal(state.tabs[0].closable, false);
  });

  test('opening a past paper adds a new tab and activates it', () => {
    const initial: TabsState = {
      tabs: [DEFAULT_LIBRARY_TAB],
      activeId: DEFAULT_LIBRARY_TAB.id,
    };

    const next = tabReducer(initial, { type: 'OPEN_PAPER', paper: samplePaper });
    assert.equal(next.tabs.length, 2);
    assert.equal(next.activeId, 'paper:101');
    assert.equal(next.tabs[1].title, 'Mathematics · 9709/1');
    assert.equal(next.tabs[1].subtitle, 's22');
    assert.equal(next.tabs[1].icon, 'doc');
    assert.equal(next.tabs[1].closable, true);
  });

  test('opening a private Workspace document can start with its notebook', () => {
    const initial: TabsState = { tabs: [DEFAULT_LIBRARY_TAB], activeId: DEFAULT_LIBRARY_TAB.id };
    const document: WorkspaceDocument = {
      id: 'local-1', title: 'My mechanics notes', originalName: 'mechanics.pdf',
      path: 'C:\\Bell\\workspace\\local-1.pdf', size: 2048, importedAt: 1, lastOpenedAt: null,
    };
    const next = tabReducer(initial, {
      type: 'OPEN_WORKSPACE_DOCUMENT', document, notebook: true,
    });
    assert.equal(next.activeId, 'workspace:local-1');
    assert.equal(next.tabs[1].kind, 'workspace-doc');
    assert.equal(next.tabs[1].notebookOpen, true);
  });

  test('opening an already-opened paper switches to it without duplicating', () => {
    const initial: TabsState = {
      tabs: [DEFAULT_LIBRARY_TAB],
      activeId: DEFAULT_LIBRARY_TAB.id,
    };

    const withPaper = tabReducer(initial, { type: 'OPEN_PAPER', paper: samplePaper });
    // Switch back to library
    const switchedToLib = tabReducer(withPaper, { type: 'SELECT_TAB', id: DEFAULT_LIBRARY_TAB.id });
    assert.equal(switchedToLib.activeId, DEFAULT_LIBRARY_TAB.id);

    // Open the same paper again
    const reopened = tabReducer(switchedToLib, { type: 'OPEN_PAPER', paper: samplePaper });
    assert.equal(reopened.tabs.length, 2, 'Should not add duplicate tab');
    assert.equal(reopened.activeId, 'paper:101', 'Should activate existing tab');
  });

  test('opening a book adds a book tab with type badge', () => {
    const initial: TabsState = {
      tabs: [DEFAULT_LIBRARY_TAB],
      activeId: DEFAULT_LIBRARY_TAB.id,
    };

    const next = tabReducer(initial, { type: 'OPEN_BOOK', resource: sampleBook });
    assert.equal(next.tabs.length, 2);
    assert.equal(next.activeId, 'book:202');
    assert.equal(next.tabs[1].kind, 'book');
    assert.equal(next.tabs[1].title, 'Cambridge Pure Mathematics 1');
    assert.equal(next.tabs[1].icon, 'book');
  });

  test('opening a notebook tab sets initial page and updates page on reopen', () => {
    const initial: TabsState = {
      tabs: [DEFAULT_LIBRARY_TAB],
      activeId: DEFAULT_LIBRARY_TAB.id,
    };

    const withNotebook = tabReducer(initial, {
      type: 'OPEN_NOTEBOOK',
      id: 'nb-math',
      name: 'Math Working',
      page: 2,
    });
    assert.equal(withNotebook.tabs.length, 2);
    assert.equal(withNotebook.tabs[1].notebook?.page, 2);
    assert.equal(withNotebook.tabs[1].subtitle, 'Page 3');

    // Reopening at page 6 updates the page property
    const updatedPage = tabReducer(withNotebook, {
      type: 'OPEN_NOTEBOOK',
      id: 'nb-math',
      page: 5,
    });
    assert.equal(updatedPage.tabs.length, 2);
    assert.equal(updatedPage.tabs[1].notebook?.page, 5);
    assert.equal(updatedPage.tabs[1].subtitle, 'Page 6');
  });

  test('closing a tab activates the adjacent neighbor', () => {
    let state: TabsState = {
      tabs: [DEFAULT_LIBRARY_TAB],
      activeId: DEFAULT_LIBRARY_TAB.id,
    };
    state = tabReducer(state, { type: 'OPEN_PAPER', paper: samplePaper });
    state = tabReducer(state, { type: 'OPEN_BOOK', resource: sampleBook });
    // Tabs are: [0: Library, 1: Paper, 2: Book(active)]
    assert.equal(state.tabs.length, 3);
    assert.equal(state.activeId, 'book:202');

    // Close rightmost active tab (Book) -> activates left neighbor (Paper)
    state = tabReducer(state, { type: 'CLOSE_TAB', id: 'book:202' });
    assert.equal(state.tabs.length, 2);
    assert.equal(state.activeId, 'paper:101');

    // Close paper tab -> activates Library
    state = tabReducer(state, { type: 'CLOSE_TAB', id: 'paper:101' });
    assert.equal(state.tabs.length, 1);
    assert.equal(state.activeId, DEFAULT_LIBRARY_TAB.id);
  });

  test('cannot close the pinned default library tab', () => {
    const state: TabsState = {
      tabs: [DEFAULT_LIBRARY_TAB],
      activeId: DEFAULT_LIBRARY_TAB.id,
    };
    const afterClose = tabReducer(state, { type: 'CLOSE_TAB', id: DEFAULT_LIBRARY_TAB.id });
    assert.equal(afterClose.tabs.length, 1);
    assert.equal(afterClose.tabs[0].id, DEFAULT_LIBRARY_TAB.id);
  });

  test('cycling tabs with nextTab and prevTab', () => {
    let state: TabsState = {
      tabs: [DEFAULT_LIBRARY_TAB],
      activeId: DEFAULT_LIBRARY_TAB.id,
    };
    state = tabReducer(state, { type: 'OPEN_PAPER', paper: samplePaper });
    state = tabReducer(state, { type: 'OPEN_BOOK', resource: sampleBook });
    // [0: Library, 1: Paper, 2: Book(active)]

    // Next from end wraps to start
    state = tabReducer(state, { type: 'NEXT_TAB' });
    assert.equal(state.activeId, DEFAULT_LIBRARY_TAB.id);

    // Prev from start wraps to end
    state = tabReducer(state, { type: 'PREV_TAB' });
    assert.equal(state.activeId, 'book:202');

    // Prev to paper
    state = tabReducer(state, { type: 'PREV_TAB' });
    assert.equal(state.activeId, 'paper:101');
  });

  test('reordering tabs moves elements cleanly', () => {
    let state: TabsState = {
      tabs: [DEFAULT_LIBRARY_TAB],
      activeId: DEFAULT_LIBRARY_TAB.id,
    };
    state = tabReducer(state, { type: 'OPEN_PAPER', paper: samplePaper });
    state = tabReducer(state, { type: 'OPEN_BOOK', resource: sampleBook });
    // [0: Library, 1: Paper, 2: Book]

    // Move Paper (index 1) to end (index 2)
    state = tabReducer(state, { type: 'REORDER_TABS', startIndex: 1, endIndex: 2 });
    assert.equal(state.tabs[0].id, DEFAULT_LIBRARY_TAB.id);
    assert.equal(state.tabs[1].id, 'book:202');
    assert.equal(state.tabs[2].id, 'paper:101');
  });

  test('closing other tabs keeps only unclosable and specified tab', () => {
    let state: TabsState = {
      tabs: [DEFAULT_LIBRARY_TAB],
      activeId: DEFAULT_LIBRARY_TAB.id,
    };
    state = tabReducer(state, { type: 'OPEN_PAPER', paper: samplePaper });
    state = tabReducer(state, { type: 'OPEN_BOOK', resource: sampleBook });
    assert.equal(state.tabs.length, 3);

    state = tabReducer(state, { type: 'CLOSE_OTHER_TABS', keepId: 'book:202' });
    assert.equal(state.tabs.length, 2);
    assert.equal(state.tabs[0].id, DEFAULT_LIBRARY_TAB.id);
    assert.equal(state.tabs[1].id, 'book:202');
    assert.equal(state.activeId, 'book:202');
  });
});
