import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parsePetMotion, sampleMotionClip, type MotionClip } from '@/lib/petMotion';

const manifest = (change: Record<string, unknown> = {}) => ({
  format: 'bell-motion',
  version: 1,
  canvas: { width: 192, height: 208, density: 2 },
  pages: [{ id: 'sleep', file: 'sleep-2x.webp', columns: 4, rows: 2 }],
  clips: {
    'sleep-enter': {
      page: 'sleep',
      playback: 'once',
      frames: [
        { cell: 0, durationMs: 100 },
        { cell: 1, durationMs: 200 },
      ],
      blendFraction: 0.25,
    },
    'sleep-loop': {
      page: 'sleep',
      playback: 'loop',
      frames: [
        { cell: 2, durationMs: 400 },
        { cell: 3, durationMs: 600 },
      ],
    },
    'sleep-exit': {
      page: 'sleep',
      playback: 'once',
      frames: [{ cell: 4, durationMs: 100 }],
    },
  },
  states: {
    sleep: {
      enter: 'sleep-enter',
      loop: 'sleep-loop',
      exit: 'sleep-exit',
      reducedPose: { clip: 'sleep-loop', frame: 1 },
    },
  },
  ...change,
});

const parse = (value: unknown) => parsePetMotion(JSON.stringify(value));

describe('parsePetMotion', () => {
  test('accepts the v1 contract and returns normalized data', () => {
    const parsed = parse(manifest());
    assert.ok(parsed);
    assert.deepEqual(parsed.canvas, { width: 192, height: 208, density: 2 });
    assert.equal(parsed.pages[0].file, 'sleep-2x.webp');
    assert.equal(parsed.clips['sleep-enter'].frames[1].durationMs, 200);
    assert.deepEqual(parsed.states.sleep.reducedPose, { clip: 'sleep-loop', frame: 1 });
  });

  test('rejects malformed JSON, wrong format, canvas, or unsupported density', () => {
    assert.equal(parsePetMotion('{'), null);
    assert.equal(parse({}), null);
    assert.equal(parse(manifest({ format: 'codex-pet' })), null);
    assert.equal(parse(manifest({ version: 2 })), null);
    assert.equal(parse(manifest({ canvas: { width: 384, height: 208, density: 2 } })), null);
    assert.equal(parse(manifest({ canvas: { width: 192, height: 208, density: 5 } })), null);
    assert.equal(parse(manifest({ canvas: { width: 192, height: 208, density: 1.5 } })), null);
  });

  test('accepts safe PNG/WebP basenames and rejects paths, device names, and duplicate pages', () => {
    assert.ok(parse(manifest({ pages: [{ id: 'sleep', file: 'Sleep_01.png', columns: 4, rows: 2 }] })));
    for (const file of ['../sleep.webp', 'folder/sleep.webp', 'folder\\sleep.png', '.sleep.webp', 'sleep.gif', 'nul.png']) {
      assert.equal(parse(manifest({ pages: [{ id: 'sleep', file, columns: 4, rows: 2 }] })), null, file);
    }
    assert.equal(
      parse(manifest({ pages: [manifest().pages[0], { ...manifest().pages[0] }] })),
      null,
    );
    assert.equal(
      parse(manifest({ pages: [manifest().pages[0], { id: 'other', file: 'SLEEP-2X.WEBP', columns: 1, rows: 1 }] })),
      null,
    );
  });

  test('checks page references, cell bounds, durations, playback and blend', () => {
    const base = manifest();
    for (const badClip of [
      { ...base.clips['sleep-enter'], page: 'missing' },
      { ...base.clips['sleep-enter'], playback: 'sometimes' },
      { ...base.clips['sleep-enter'], frames: [] },
      { ...base.clips['sleep-enter'], frames: [{ cell: 8, durationMs: 10 }] },
      { ...base.clips['sleep-enter'], frames: [{ cell: -1, durationMs: 10 }] },
      { ...base.clips['sleep-enter'], frames: [{ cell: 0.5, durationMs: 10 }] },
      { ...base.clips['sleep-enter'], frames: [{ cell: 0, durationMs: 0 }] },
      { ...base.clips['sleep-enter'], frames: [{ cell: 0, durationMs: Number.NaN }] },
      { ...base.clips['sleep-enter'], blendFraction: 1.01 },
    ]) {
      assert.equal(parse({ ...base, clips: { ...base.clips, 'sleep-enter': badClip } }), null);
    }
  });

  test('checks every sleep clip reference, role playback, and reduced frame bounds', () => {
    const base = manifest();
    const sleep = base.states.sleep;
    assert.equal(parse({ ...base, states: { sleep: { ...sleep, enter: 'missing' } } }), null);
    assert.equal(parse({ ...base, states: { sleep: { ...sleep, reducedPose: { clip: 'missing', frame: 0 } } } }), null);
    assert.equal(parse({ ...base, states: { sleep: { ...sleep, reducedPose: { clip: 'sleep-loop', frame: 2 } } } }), null);
    assert.equal(
      parse({
        ...base,
        clips: { ...base.clips, 'sleep-loop': { ...base.clips['sleep-loop'], playback: 'once' } },
      }),
      null,
    );
  });

  test('accepts validated Bell mood clips, playlists, random routines, and enter-then-loop sequences', () => {
    const base = manifest();
    const parsed = parse({
      ...base,
      states: {
        ...base.states,
        moods: {
          glint: { mode: 'clip', clip: 'sleep-enter' },
          idle: { mode: 'playlist', clips: ['sleep-enter', 'sleep-exit'] },
          periscope: { mode: 'routine', clips: ['sleep-exit', 'sleep-enter', 'sleep-enter'] },
          scuttle: { mode: 'sequence', enter: 'sleep-enter', loop: 'sleep-loop' },
        },
      },
    });
    assert.ok(parsed);
    assert.deepEqual(parsed.states.moods?.idle, {
      mode: 'playlist',
      clips: ['sleep-enter', 'sleep-exit'],
    });
    assert.deepEqual(parsed.states.moods?.periscope, {
      mode: 'routine',
      clips: ['sleep-exit', 'sleep-enter', 'sleep-enter'],
    });
  });

  test('rejects unsafe or inconsistent Bell mood definitions', () => {
    const base = manifest();
    const withMood = (state: unknown) =>
      parse({ ...base, states: { ...base.states, moods: { idle: state } } });
    assert.equal(withMood({ mode: 'clip', clip: 'missing' }), null);
    assert.equal(withMood({ mode: 'playlist', clips: [] }), null);
    assert.equal(withMood({ mode: 'playlist', clips: ['sleep-loop'] }), null);
    assert.equal(withMood({ mode: 'routine', clips: [] }), null);
    assert.equal(withMood({ mode: 'routine', clips: ['sleep-loop'] }), null);
    assert.equal(withMood({ mode: 'sequence', enter: 'sleep-loop', loop: 'sleep-enter' }), null);
    assert.equal(parse({ ...base, states: { ...base.states, moods: { '../idle': { mode: 'clip', clip: 'sleep-enter' } } } }), null);
  });
});

describe('sampleMotionClip', () => {
  const once: MotionClip = {
    page: 'page',
    playback: 'once',
    frames: [
      { cell: 4, durationMs: 100 },
      { cell: 7, durationMs: 300 },
      { cell: 9, durationMs: 100 },
    ],
    blendFraction: 0.25,
  };

  test('samples variable holds and advances exactly at frame boundaries', () => {
    assert.deepEqual(sampleMotionClip(once, -10), { cell: 4, nextCell: 7, mix: 0, complete: false });
    assert.deepEqual(sampleMotionClip(once, 99), { cell: 4, nextCell: 7, mix: 0.96, complete: false });
    assert.deepEqual(sampleMotionClip(once, 100), { cell: 7, nextCell: 9, mix: 0, complete: false });
    assert.deepEqual(sampleMotionClip(once, 250), { cell: 7, nextCell: 9, mix: 0, complete: false });
    const blended = sampleMotionClip(once, 399);
    assert.deepEqual({ ...blended, mix: 0 }, { cell: 7, nextCell: 9, mix: 0, complete: false });
    assert.ok(Math.abs(blended.mix - 0.9866666666666667) < Number.EPSILON);
  });

  test('clamps a one-shot to its final cel and marks it complete', () => {
    assert.deepEqual(sampleMotionClip(once, 499), { cell: 9, nextCell: 9, mix: 0, complete: false });
    assert.deepEqual(sampleMotionClip(once, 500), { cell: 9, nextCell: 9, mix: 0, complete: true });
    assert.deepEqual(sampleMotionClip(once, Number.POSITIVE_INFINITY), {
      cell: 9,
      nextCell: 9,
      mix: 0,
      complete: true,
    });
  });

  test('wraps a looping timeline and blends its final cel back to its first', () => {
    const loop: MotionClip = { ...once, playback: 'loop', frames: once.frames.slice(0, 2), blendFraction: 0.5 };
    assert.deepEqual(sampleMotionClip(loop, 0), { cell: 4, nextCell: 7, mix: 0, complete: false });
    assert.deepEqual(sampleMotionClip(loop, 400), { cell: 4, nextCell: 7, mix: 0, complete: false });
    assert.deepEqual(sampleMotionClip(loop, 350), {
      cell: 7,
      nextCell: 4,
      mix: 0.6666666666666667,
      complete: false,
    });
  });

  test('does not blend unless the clip opts in', () => {
    assert.deepEqual(sampleMotionClip({ ...once, blendFraction: undefined }, 99), {
      cell: 4,
      nextCell: 7,
      mix: 0,
      complete: false,
    });
  });
});

describe('Azure production motion package', () => {
  test('parses as a whole and never blends two authored cels', () => {
    const parsed = parsePetMotion(readFileSync('pets/azure/motion.json', 'utf8'));
    assert.ok(parsed);
    assert.equal(parsed.pages.length, 10);
    assert.deepEqual(parsed.states.moods?.scuttle, {
      mode: 'sequence',
      enter: 'teacher-enter',
      loop: 'teacher-loop',
    });
    assert.equal(parsed.states.moods?.idle?.mode, 'routine');
    for (const clip of Object.values(parsed.clips)) assert.equal(clip.blendFraction, 0);
  });
});
