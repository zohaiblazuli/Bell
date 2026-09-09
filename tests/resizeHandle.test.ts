import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadPref, savePref } from '../src/lib/store';

describe('Side Viewer Resize Handle & Sizing Calculations', () => {
  // Pure sizing calculation helper matching SideResizeHandle logic
  function calculateResizeWidth({
    startWidth,
    startX,
    currentX,
    side = 'left',
    minWidth = 320,
    maxWidth = 1200,
  }: {
    startWidth: number;
    startX: number;
    currentX: number;
    side?: 'left' | 'right';
    minWidth?: number;
    maxWidth?: number;
  }): number {
    const deltaX = side === 'left' ? startX - currentX : currentX - startX;
    const target = startWidth + deltaX;
    return Math.round(Math.max(minWidth, Math.min(maxWidth, target)));
  }

  function keyboardStepResize({
    currentWidth,
    key,
    shiftKey = false,
    side = 'left',
    minWidth = 320,
    maxWidth = 1200,
    defaultWidth = 480,
  }: {
    currentWidth: number;
    key: 'ArrowLeft' | 'ArrowRight' | 'Home' | 'Enter';
    shiftKey?: boolean;
    side?: 'left' | 'right';
    minWidth?: number;
    maxWidth?: number;
    defaultWidth?: number;
  }): number {
    const step = shiftKey ? 40 : 16;
    if (key === 'ArrowLeft') {
      const delta = side === 'left' ? step : -step;
      return Math.max(minWidth, Math.min(maxWidth, currentWidth + delta));
    }
    if (key === 'ArrowRight') {
      const delta = side === 'left' ? -step : step;
      return Math.max(minWidth, Math.min(maxWidth, currentWidth + delta));
    }
    if (key === 'Home' || key === 'Enter') {
      return Math.max(minWidth, Math.min(maxWidth, defaultWidth));
    }
    return currentWidth;
  }

  it('dragging left increases width for right-docked pane', () => {
    // Pane is docked on the right; handle is on its left border
    // Mouse moving left (smaller clientX) means pane grows wider
    const newWidth = calculateResizeWidth({
      startWidth: 480,
      startX: 900,
      currentX: 800, // dragged 100px to the left
      side: 'left',
      minWidth: 340,
      maxWidth: 900,
    });
    assert.equal(newWidth, 580);
  });

  it('dragging right decreases width for right-docked pane', () => {
    // Mouse moving right (larger clientX) means pane shrinks
    const newWidth = calculateResizeWidth({
      startWidth: 480,
      startX: 900,
      currentX: 1020, // dragged 120px to the right
      side: 'left',
      minWidth: 340,
      maxWidth: 900,
    });
    assert.equal(newWidth, 360);
  });

  it('clamps to minWidth when dragged past minimum', () => {
    const newWidth = calculateResizeWidth({
      startWidth: 480,
      startX: 900,
      currentX: 1200, // dragged 300px right
      side: 'left',
      minWidth: 340,
      maxWidth: 900,
    });
    assert.equal(newWidth, 340);
  });

  it('clamps to maxWidth when dragged past maximum', () => {
    const newWidth = calculateResizeWidth({
      startWidth: 480,
      startX: 900,
      currentX: 200, // dragged 700px left
      side: 'left',
      minWidth: 340,
      maxWidth: 850,
    });
    assert.equal(newWidth, 850);
  });

  it('supports keyboard ArrowLeft to widen right-docked pane', () => {
    const regular = keyboardStepResize({
      currentWidth: 480,
      key: 'ArrowLeft',
      shiftKey: false,
      side: 'left',
    });
    assert.equal(regular, 496);

    const boosted = keyboardStepResize({
      currentWidth: 480,
      key: 'ArrowLeft',
      shiftKey: true,
      side: 'left',
    });
    assert.equal(boosted, 520);
  });

  it('supports keyboard ArrowRight to narrow right-docked pane', () => {
    const regular = keyboardStepResize({
      currentWidth: 480,
      key: 'ArrowRight',
      shiftKey: false,
      side: 'left',
    });
    assert.equal(regular, 464);

    const boosted = keyboardStepResize({
      currentWidth: 480,
      key: 'ArrowRight',
      shiftKey: true,
      side: 'left',
    });
    assert.equal(boosted, 440);
  });

  it('resets to default width on Home or Enter', () => {
    const resetHome = keyboardStepResize({
      currentWidth: 730,
      key: 'Home',
      defaultWidth: 480,
    });
    assert.equal(resetHome, 480);

    const resetEnter = keyboardStepResize({
      currentWidth: 360,
      key: 'Enter',
      defaultWidth: 620,
    });
    assert.equal(resetEnter, 620);
  });

  it('persists and hydrates viewer widths via preferences', () => {
    savePref('pref.viewer.ms-width', 540);
    savePref('pref.viewer.nb-width', 710);

    const loadedMs = loadPref<number>('pref.viewer.ms-width', 480);
    const loadedNb = loadPref<number>('pref.viewer.nb-width', 620);

    assert.equal(loadedMs, 540);
    assert.equal(loadedNb, 710);
  });
});
