import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Page Jumper Input & Navigation Logic', () => {
  function clampPageJump(input: string, currentPage: number, pageCount: number): number {
    const digits = input.replace(/[^0-9]/g, '');
    const parsed = parseInt(digits, 10);
    if (isNaN(parsed)) {
      return currentPage;
    }
    return Math.max(1, Math.min(pageCount, parsed));
  }

  function stepPage(direction: 'up' | 'down', currentPage: number, pageCount: number): number {
    if (direction === 'up') {
      return Math.min(pageCount, currentPage + 1);
    }
    return Math.max(1, currentPage - 1);
  }

  it('jumps to valid typed page number within document bounds', () => {
    const target = clampPageJump('12', 1, 35);
    assert.equal(target, 12);
  });

  it('clamps to maximum pageCount when typed page exceeds bounds', () => {
    const target = clampPageJump('999', 5, 24);
    assert.equal(target, 24);
  });

  it('clamps to minimum page 1 when typed page is 0', () => {
    const target = clampPageJump('0', 5, 24);
    assert.equal(target, 1);
  });

  it('cleanses non-digit characters from user input', () => {
    const target = clampPageJump('p15!', 1, 24);
    assert.equal(target, 15);
  });

  it('reverts to current page when input contains no digits', () => {
    const target = clampPageJump('abc', 7, 24);
    assert.equal(target, 7);
  });

  it('reverts to current page when input is empty', () => {
    const target = clampPageJump('', 9, 24);
    assert.equal(target, 9);
  });

  it('steps up with ArrowUp without exceeding pageCount', () => {
    assert.equal(stepPage('up', 5, 20), 6);
    assert.equal(stepPage('up', 20, 20), 20);
  });

  it('steps down with ArrowDown without going below 1', () => {
    assert.equal(stepPage('down', 5, 20), 4);
    assert.equal(stepPage('down', 1, 20), 1);
  });
});
