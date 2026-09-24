import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { startupHandoffDurationMs, startupHoldDurationMs, startupWatchdogMs } from '@/lib/startup';
import { paperShape } from '@ui/shapekit/PaperShape';

/** Every stylesheet and component under src, read once. */
function walk(dir: string, exts: string[]): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return walk(p, exts);
    return exts.some((e) => d.name.endsWith(e)) ? [p] : [];
  });
}
const SRC = path.resolve('src');
const css = walk(SRC, ['.css']).map((f) => [f, fs.readFileSync(f, 'utf-8')] as const);
const tsx = walk(SRC, ['.ts', '.tsx']).map((f) => [f, fs.readFileSync(f, 'utf-8')] as const);
const motion = fs.readFileSync(path.join(SRC, 'styles/motion.css'), 'utf-8');

describe('Startup v2 "Full stop" splash timings', () => {
  test('the lockup holds, then hands off to the sidebar', () => {
    assert.equal(startupHoldDurationMs(false), 4500);
    assert.equal(startupHandoffDurationMs(false), 1200);
  });

  test('reduced motion cuts both phases short', () => {
    assert.ok(startupHoldDurationMs(true) < startupHoldDurationMs(false));
    assert.ok(startupHandoffDurationMs(true) < startupHandoffDurationMs(false));
  });

  test('the watchdog only fires after a phase has overrun', () => {
    for (const reduce of [false, true]) {
      assert.ok(startupWatchdogMs('splash', reduce) > startupHoldDurationMs(reduce));
      assert.ok(startupWatchdogMs('handoff', reduce) > startupHandoffDurationMs(reduce));
    }
  });
});

describe('Shape Kit paper numbers', () => {
  test('P1–P6 map to the design’s shapes and colours', () => {
    assert.deepEqual(paperShape(1), ['circle', 'var(--red)']);
    assert.deepEqual(paperShape(2), ['quarter', 'var(--blue)']);
    assert.deepEqual(paperShape(3), ['tri', 'var(--blue)']);
    assert.deepEqual(paperShape(4), ['square', 'var(--sk-yellow)']);
    assert.deepEqual(paperShape(5), ['half', 'var(--ink)']);
    assert.deepEqual(paperShape(6), ['diamond', 'var(--red)']);
  });

  test('an unknown paper number still gets a shape', () => {
    assert.deepEqual(paperShape(9), paperShape(4));
  });
});

describe('Hush and the motion pack', () => {
  test('Hush has a style for every pose he can take', () => {
    const src = fs.readFileSync(path.join(SRC, 'ui/shapekit/Hush.tsx'), 'utf-8');
    const union = src.match(/export type HushPose =([^;]+);/);
    assert.ok(union, 'HushPose is a string union');
    const poses = [...union[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    assert.equal(poses.length, 9);
    const hushCss = fs.readFileSync(path.join(SRC, 'ui/shapekit/Hush.css'), 'utf-8');
    for (const pose of poses) {
      assert.ok(hushCss.includes(`.hush--${pose}`), `.hush--${pose} is styled`);
    }
  });

  test('every sk- keyframe the app names is defined in motion.css', () => {
    const defined = new Set([...motion.matchAll(/@keyframes (sk-[a-z0-9-]+)/g)].map((m) => m[1]));
    const used = new Map<string, string>();
    for (const [file, text] of [...css, ...tsx]) {
      for (const m of text.matchAll(/\b(sk-[a-z0-9-]+)\b/g)) {
        const name = m[1];
        // Only names in an animation position: `animation: sk-x …`, `animationName: 'sk-x'`, or a
        // comma-separated follow-on in the same animation list.
        const before = text.slice(Math.max(0, m.index! - 80), m.index);
        if (/animation(-name)?\s*:[^;{}]*$|animationName\s*:\s*['"]$/.test(before)) used.set(name, file);
      }
    }
    assert.ok(used.size > 20, 'the scan found the app’s animations');
    for (const [name, file] of used) {
      assert.ok(defined.has(name), `${name} (used in ${path.relative(SRC, file)}) has a @keyframes rule`);
    }
  });

  test('switching motion off stops every animation', () => {
    assert.match(motion, /@media \(prefers-reduced-motion: reduce\)[^}]*\{[^}]*animation: none !important/);
    assert.match(motion, /\[data-motion='off'\] \*[^{]*\{[^}]*animation: none !important/);
  });
});

describe('Shape Kit chrome', () => {
  test('no glass: nothing blurs what is behind it', () => {
    for (const [file, text] of css) {
      assert.ok(!/backdrop-filter\s*:/.test(text), `${path.relative(SRC, file)} has no backdrop-filter`);
    }
  });

  test('the retired mascots are gone', () => {
    for (const [file, text] of tsx) {
      assert.ok(!/from ['"][^'"]*(MrBell|MsBell|BellPet|PetShelf|usePet|lib\/pets)['"]/.test(text), `${path.relative(SRC, file)} imports no retired mascot`);
    }
  });
});
