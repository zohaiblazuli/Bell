/**
 * The pet atlas arithmetic — `src/lib/pets.ts`.
 *
 * None of these numbers is ours. They are the Codex pet package format's, transcribed from the
 * registry that serves the sheets and from `openai/skills`' own `hatch-pet`, so what this file pins is
 * that the transcription is internally consistent and that everything downstream of it degrades the
 * way it claims to. Three of the suites below are load-bearing rather than tidy:
 *
 *   · **The frame counts are exactly {4, 5, 6, 8}.** `Pet.css` has one `@keyframes` and one `steps()`
 *     per count, and that is only complete because the set is closed. A row with 7 frames would play
 *     the wrong walk with nothing anywhere reporting it.
 *   · **A v1 sheet must never select a v2 row.** There are no pixels down there; the pet would animate
 *     an empty cell.
 *   · **`parseRegistry` reads somebody else's JSON.** A row that could name a path this app writes to
 *     has to be dropped rather than repaired.
 *
 * `cargo test --lib pets::` is the other half — the same id rule, checked on the side of the IPC where
 * it turns into a directory name.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  PET_CELL,
  PET_COLUMNS,
  PET_FPS,
  PET_ROWS,
  atlasVersionForHeight,
  isPetId,
  parseRegistry,
  petRowCount,
  petRowFor,
  petRows,
  petSheetSize,
  petStateForMood,
  type AtlasVersion,
  type PetState,
} from '@/lib/pets';
import type { BellMood } from '@ui/brand/MrBell';

/** The twelve `Motion — Mr. Bell` timelines, in page order — every mood the app can ask for. */
const MOODS: BellMood[] = [
  'idle',
  'specs-push-up',
  'periscope',
  'lens-draw-on',
  'alarm',
  'double-take',
  'scuttle',
  'hop',
  'slump',
  'sleep',
  'glint',
  'tone-handoff',
];

const VERSIONS: AtlasVersion[] = [1, 2];

describe('the atlas, as the format defines it', () => {
  test('is 8 columns of 192x208, nine rows or eleven', () => {
    assert.deepEqual(PET_CELL, { w: 192, h: 208 });
    assert.equal(PET_COLUMNS, 8);
    assert.equal(petRowCount(1), 9);
    assert.equal(petRowCount(2), 11);
    assert.equal(PET_ROWS.length, 11, 'PET_ROWS is the v2 table');

    // The two sizes the registry actually serves. `atlasVersionForHeight` is what reads them back off
    // a decoded sheet, so these have to be the same numbers from both directions.
    assert.deepEqual(petSheetSize(1), { w: 1536, h: 1872 });
    assert.deepEqual(petSheetSize(2), { w: 1536, h: 2288 });
  });

  test('names each row once, in sheet order, with no gaps', () => {
    PET_ROWS.forEach((row, i) => {
      assert.equal(row.row, i, `${row.id} claims row ${row.row} but sits at ${i}`);
    });
    assert.equal(new Set(PET_ROWS.map((r) => r.id)).size, PET_ROWS.length, 'ids are unique');
    // v1 is a prefix of v2, which is the whole reason a v2 sheet can be read by v1 rules and not the
    // other way round.
    assert.deepEqual(petRows(1), PET_ROWS.slice(0, 9));
  });

  test('uses only 4, 5, 6 or 8 frames a row, which is what makes Pet.css complete', () => {
    const counts = new Set(PET_ROWS.map((r) => r.frames));
    assert.deepEqual(
      [...counts].sort((a, b) => a - b),
      [4, 5, 6, 8],
      'Pet.css writes one @keyframes and one steps() per count — a new count needs a new rule',
    );
    for (const row of PET_ROWS) {
      assert.ok(
        row.frames >= 1 && row.frames <= PET_COLUMNS,
        `${row.id} has ${row.frames} frames in a sheet ${PET_COLUMNS} cells wide`,
      );
    }
  });

  test('runs at the rate the registry previews it at', () => {
    assert.equal(PET_FPS, 8);
    // What `Pet` puts in `animation-duration`: a 6-frame idle is a 750ms loop, not 6 seconds.
    assert.equal(6 / PET_FPS, 0.75);
  });
});

describe('the version is measured off the sheet, never read from pet.json', () => {
  test('resolves the two heights the format defines and nothing else', () => {
    assert.equal(atlasVersionForHeight(1872), 1);
    assert.equal(atlasVersionForHeight(2288), 2);
    // A manifest claiming v2 over an 1872 sheet is the case this exists for. Every one of these has to
    // fall back to Mr. Bell rather than slice a sheet that is not one.
    for (const height of [0, 1, 208, 1871, 1873, 2287, 2289, 4576, -2288, 1872.5, NaN]) {
      assert.equal(atlasVersionForHeight(height), null, `${height} is not an atlas`);
    }
  });
});

describe('a v1 sheet never selects a v2 row', () => {
  test('the look-around rows exist on 2 and not on 1', () => {
    for (const id of ['look-right-side', 'look-left-side'] as PetState[]) {
      assert.equal(petRowFor(2, id)?.id, id);
      assert.equal(petRowFor(1, id), null, `${id} has no pixels on a nine-row sheet`);
    }
    assert.equal(petRowFor(1, 'review')?.row, 8, 'the last row v1 does have');
  });

  test('every row a version reports is inside that version’s sheet', () => {
    for (const version of VERSIONS) {
      const { h } = petSheetSize(version);
      for (const row of petRows(version)) {
        assert.ok((row.row + 1) * PET_CELL.h <= h, `${row.id} runs past a v${version} sheet`);
      }
    }
  });
});

describe('Mr. Bell’s twelve moods in a pet’s nine or eleven', () => {
  test('every mood resolves to a row the sheet in hand actually has', () => {
    for (const version of VERSIONS) {
      const rows = new Set(petRows(version).map((r) => r.id));
      for (const mood of MOODS) {
        const state = petStateForMood(version, mood);
        assert.ok(rows.has(state), `${mood} chose ${state}, which a v${version} sheet does not carry`);
      }
    }
  });

  test('carries the intent, and collapses only where a pet has no equivalent', () => {
    assert.equal(petStateForMood(2, 'idle'), 'idle');
    assert.equal(petStateForMood(2, 'hop'), 'jumping');
    assert.equal(petStateForMood(2, 'scuttle'), 'running');
    // A pet's resting-long row, not `idle` — nodding off should read as something.
    assert.equal(petStateForMood(2, 'sleep'), 'waiting');
    // One failure row, so both of Bell's failure moods land on it.
    assert.equal(petStateForMood(2, 'alarm'), 'failed');
    assert.equal(petStateForMood(2, 'slump'), 'failed');
    // No spectacles to catch the light on, so the glint and the poke are both a wave.
    assert.equal(petStateForMood(2, 'glint'), 'waving');
    assert.equal(petStateForMood(2, 'double-take'), 'waving');
    assert.equal(petStateForMood(2, 'lens-draw-on'), 'review');
  });

  test('degrades down its preference list rather than off the sheet', () => {
    // The two moods that want a look-around: v2 glances, v1 does the nearest thing it has.
    assert.equal(petStateForMood(2, 'periscope'), 'look-right-side');
    assert.equal(petStateForMood(1, 'periscope'), 'waiting');
    assert.equal(petStateForMood(2, 'tone-handoff'), 'look-left-side');
    // In the file the crab does not move at all for a tone crossing, so standing still is right here.
    assert.equal(petStateForMood(1, 'tone-handoff'), 'idle');
  });

  test('a mood nobody mapped still returns something drawable', () => {
    assert.equal(petStateForMood(1, 'not-a-mood' as BellMood), 'idle');
  });
});

describe('the id, which arrives from the network and becomes a directory', () => {
  test('accepts the shapes the registry actually serves', () => {
    for (const id of ['sara-heartwave-navysum-0905', 'career-craig-navysum-0905', 'kerno', 'a', '9lives']) {
      assert.ok(isPetId(id), id);
    }
    assert.ok(isPetId('p'.repeat(64)));
  });

  test('refuses anything that could name a path, and the device names', () => {
    for (const id of [
      '',
      '..',
      '../evil',
      '..\\evil',
      'a/b',
      'a\\b',
      'Sara',
      'sara.heartwave',
      '-leading-dash',
      'sara heartwave',
      'sara_heartwave',
      'sаra', // a Cyrillic а is not an a
      'p'.repeat(65),
      'nul',
      'con',
      'prn',
      'aux',
      'com1',
      'lpt9',
    ]) {
      assert.ok(!isPetId(id), id);
    }
    assert.ok(isPetId('com0'), 'com0 is not a device');
    assert.ok(isPetId('com10'), 'nor is com10');
  });
});

describe('parseRegistry reads somebody else’s JSON', () => {
  /** One row shaped the way `GET /api/pets` really shapes them. */
  const row = (extra: Record<string, unknown> = {}) => ({
    id: 'sara-heartwave-navysum-0905',
    displayName: 'Sara',
    description: 'A warm and stylish pixel-chibi companion.',
    spritesheetPath: 'spritesheet.webp',
    spriteVersionNumber: 2,
    kind: 'person',
    tags: ['anime', 'cute', 'mascot'],
    ownerHandle: 'craigstfn',
    spritesheetUrl: 'https://codex-pets.net/assets/pets/v/1788633460733/sara/spritesheet.webp',
    posterUrl: 'https://codex-pets.net/assets/pets/v/1788633460733/sara/poster.webp',
    previewUrl: 'https://codex-pets.net/assets/pets/v/1788633460733/sara/preview.webp',
    ...extra,
  });

  test('keeps the fields Bell renders and ignores the rest', () => {
    const [pet] = parseRegistry(
      JSON.stringify({ pets: [row({ viewCount: 5, likedByMe: false, somethingNew: 1 })] }),
    );
    assert.equal(pet.id, 'sara-heartwave-navysum-0905');
    assert.equal(pet.displayName, 'Sara');
    assert.equal(pet.kind, 'person');
    assert.equal(pet.spriteVersionNumber, 2);
    assert.deepEqual(pet.tags, ['anime', 'cute', 'mascot']);
    assert.equal(pet.ownerHandle, 'craigstfn');
    assert.ok(pet.sheetUrl.startsWith('https://codex-pets.net/'));
    // The POSTER, not the strip — `previewUrl` is all eight frames side by side.
    assert.ok(pet.posterUrl?.endsWith('poster.webp'), pet.posterUrl ?? 'no poster');
  });

  test('drops a row it could not install rather than repairing it', () => {
    const bad = [
      row({ id: '../../../etc/passwd' }),
      row({ id: 'Sara' }),
      row({ id: 'nul' }),
      row({ id: 42 }),
      row({ id: undefined }),
      row({ spritesheetUrl: undefined }),
      row({ spritesheetUrl: '' }),
    ];
    assert.deepEqual(parseRegistry(JSON.stringify({ pets: bad })), []);
    // And one good row beside them still comes through.
    const kept = parseRegistry(JSON.stringify({ pets: [...bad, row()] }));
    assert.equal(kept.length, 1);
  });

  test('clamps the text a stranger wrote, because it lands in a fixed tile', () => {
    const [pet] = parseRegistry(
      JSON.stringify({
        pets: [
          row({
            displayName: 'S'.repeat(400),
            description: 'd'.repeat(9000),
            kind: 'k'.repeat(90),
            tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 9, null],
            ownerHandle: 'o'.repeat(200),
          }),
        ],
      }),
    );
    assert.equal(pet.displayName.length, 80);
    assert.equal(pet.description.length, 300);
    assert.equal(pet.kind.length, 24);
    assert.equal(pet.tags.length, 6, 'six tags, and only the ones that were strings');
    assert.ok(pet.tags.every((t) => typeof t === 'string'));
    assert.equal(pet.ownerHandle?.length, 40);
  });

  test('falls back rather than throwing on anything that is not the shape', () => {
    for (const json of [
      '',
      'not json',
      '{}',
      'null',
      '[]',
      '{"pets":null}',
      '{"pets":{}}',
      '{"pets":"nope"}',
    ]) {
      assert.deepEqual(parseRegistry(json), [], json);
    }
    // A missing name falls back to the id, and a missing path to the format's own file name — neither
    // is worth dropping a pet over, because neither is a path this app builds.
    const [pet] = parseRegistry(
      JSON.stringify({ pets: [row({ displayName: undefined, spritesheetPath: undefined })] }),
    );
    assert.equal(pet.displayName, 'sara-heartwave-navysum-0905');
    assert.equal(pet.spritesheetPath, 'spritesheet.webp');
  });
});
