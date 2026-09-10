import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SETTINGS_DEFAULTS, loadSettings, saveSettings } from '@/lib/store';
import {
  startupHandoffDurationMs,
  startupHoldDurationMs,
  startupWatchdogMs,
} from '@/lib/startup';

describe('Ms. Bell mascot configuration and assets', () => {
  test('default pet setting is msbell', () => {
    assert.equal(SETTINGS_DEFAULTS.pet, 'msbell');
  });

  test('loadSettings normalizes pet strictly to msbell for all new and existing users', () => {
    // Save msbell
    saveSettings({ ...SETTINGS_DEFAULTS, pet: 'msbell' });
    assert.equal(loadSettings().pet, 'msbell');

    // Existing user with legacy azure saved must normalize to msbell
    saveSettings({ ...SETTINGS_DEFAULTS, pet: 'azure' });
    assert.equal(loadSettings().pet, 'msbell');

    // Existing user with legacy null (Mr. Bell) saved must normalize to msbell
    saveSettings({ ...SETTINGS_DEFAULTS, pet: null });
    assert.equal(loadSettings().pet, 'msbell');

    // Stale or invalid id falls back to msbell
    // @ts-expect-error testing invalid pet id
    saveSettings({ ...SETTINGS_DEFAULTS, pet: 'unknown-cat' });
    assert.equal(loadSettings().pet, 'msbell');

    // Reset back to msbell default
    saveSettings(SETTINGS_DEFAULTS);
    assert.equal(loadSettings().pet, 'msbell');
  });

  test('Mascot component exclusively mounts MsBell for all slots', () => {
    const mascotContent = fs.readFileSync(path.resolve('src/components/Mascot.tsx'), 'utf-8');
    assert.ok(mascotContent.includes('<MsBell'), 'Mascot must render <MsBell');
    assert.ok(!mascotContent.includes('<MrBell'), 'Mascot must not render <MrBell');
    assert.ok(!mascotContent.includes('<BellPet'), 'Mascot must not render <BellPet');
    assert.ok(!mascotContent.includes('<Pet '), 'Mascot must not render <Pet');
  });

  test('public/msbell WebP assets exist and are non-empty', () => {
    const requiredFiles = [
      'msbell_idle.webp',
      'msbell_idle_2.webp',
      'msbell_idle_3.webp',
      'msbell_idle_4.webp',
      'msbell_idle_5.webp',
      'msbell_interact_1.webp',
      'msbell_interact_2.webp',
      'msbell_interact_3.webp',
      'msbell_sleeping.webp',
      'msbell_study_start.webp',
      'msbell_study_loop.webp',
      'startup_splash.webp',
    ];

    for (const file of requiredFiles) {
      const filePath = path.resolve('public/msbell', file);
      assert.ok(fs.existsSync(filePath), `Expected ${file} to exist in public/msbell`);
      const stat = fs.statSync(filePath);
      assert.ok(stat.size > 500 * 1024, `Expected ${file} to be > 500KB, got ${stat.size} bytes`);
    }
  });

  test('all Ms. Bell WebP animations have non-empty initial frames (no loop flash)', () => {
    const webpFiles = [
      'msbell_idle.webp',
      'msbell_idle_2.webp',
      'msbell_idle_3.webp',
      'msbell_idle_4.webp',
      'msbell_idle_5.webp',
      'msbell_interact_1.webp',
      'msbell_interact_2.webp',
      'msbell_interact_3.webp',
      'msbell_sleeping.webp',
      'msbell_study_start.webp',
      'msbell_study_loop.webp',
      'startup_splash.webp',
    ];

    for (const file of webpFiles) {
      const filePath = path.resolve('public/msbell', file);
      assert.ok(fs.existsSync(filePath), `${file} must exist`);

      const buf = fs.readFileSync(filePath);
      // Validate RIFF header
      assert.equal(buf.subarray(0, 4).toString('ascii'), 'RIFF', `${file} must be a valid RIFF file`);
      assert.equal(buf.subarray(8, 12).toString('ascii'), 'WEBP', `${file} must be a valid WebP file`);

      // Locate first ANMF (animation frame) chunk and verify payload size
      let pos = 12;
      let firstFrameBytes = 0;
      while (pos + 8 <= buf.length) {
        const fourcc = buf.subarray(pos, pos + 4).toString('ascii');
        const size = buf.readUInt32LE(pos + 4);
        if (fourcc === 'ANMF') {
          firstFrameBytes = size;
          break;
        }
        pos += 8 + size + (size % 2);
      }

      // A blank/empty 1x1 frame is < 200 bytes; a rendered character frame is > 15KB.
      // msbell_study_start.webp is an entrance sequence with authored off-screen start frames (> 1KB).
      const minExpectedBytes = file === 'msbell_study_start.webp' ? 1000 : 15000;
      assert.ok(
        firstFrameBytes > minExpectedBytes,
        `${file} first frame ANMF must not be empty (got ${firstFrameBytes} bytes)`
      );
    }
  });

  test('startup watchdog cannot cut off the authored Ms. Bell sequence', () => {
    const hold = startupHoldDurationMs('msbell', false);
    assert.equal(hold, 8480);
    assert.equal(startupHoldDurationMs('msbell', true), 8480);
    assert.ok(startupWatchdogMs('splash', 'msbell', false) > hold);
    assert.ok(startupWatchdogMs('splash', 'msbell', true) > 8480);

    assert.equal(startupHoldDurationMs('azure', false), 2000);
    assert.equal(startupHoldDurationMs(null, true), 700);
    assert.equal(startupHandoffDurationMs(false), 900);
    assert.equal(startupHandoffDurationMs(true), 320);
  });

  test('mosaic glitch transition definitions and styles are present', () => {
    const cssPath = path.resolve('src/ui/MsBell.css');
    const tsxPath = path.resolve('src/ui/MsBell.tsx');

    assert.ok(fs.existsSync(cssPath), 'src/ui/MsBell.css must exist');
    assert.ok(fs.existsSync(tsxPath), 'src/ui/MsBell.tsx must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    const tsx = fs.readFileSync(tsxPath, 'utf8');

    // Verify SVG filter and CSS rules
    assert.ok(css.includes('url(#ms-bell-mosaic-glitch)'), 'MsBell.css must reference #ms-bell-mosaic-glitch filter');
    assert.ok(css.includes('ms-bell__glitch-slice'), 'MsBell.css must define glitch slice classes');
    assert.ok(css.includes('ms-bell__glitch-slice--3'), 'MsBell.css must define 3-slice prismatic chromatic aberration');
    assert.ok(css.includes('ms-bell__glitch-scanlines'), 'MsBell.css must define scanline lattice');
    assert.ok(css.includes('ms-bell__electric-halo'), 'MsBell.css must define electric halo');
    assert.ok(css.includes('ms-bell__electric-sparks'), 'MsBell.css must define electric sparks');
    assert.ok(tsx.includes('id="ms-bell-mosaic-glitch"'), 'MsBell.tsx must provide SVG filter definition');
    assert.ok(tsx.includes('data-glitch='), 'MsBell.tsx must bind data-glitch attribute');
    assert.ok(tsx.includes('ms-bell__trail'), 'MsBell.tsx must render motion trail element');
    assert.ok(tsx.includes('ms-bell__electric-halo'), 'MsBell.tsx must render electric halo');
    assert.ok(tsx.includes('ms-bell__electric-sparks'), 'MsBell.tsx must render electric sparks');
  });

  test('all 6 reveal variations are defined and styled', () => {
    const cssPath = path.resolve('src/ui/MsBell.css');
    const tsxPath = path.resolve('src/ui/MsBell.tsx');

    const css = fs.readFileSync(cssPath, 'utf8');
    const tsx = fs.readFileSync(tsxPath, 'utf8');

    const expectedReveals = ['mosaic', 'aurora', 'matrix', 'lightning', 'shutter', 'vortex'];

    for (const rev of expectedReveals) {
      assert.ok(css.includes(`data-reveal='${rev}'`), `MsBell.css must style data-reveal='${rev}'`);
      assert.ok(tsx.includes(`'${rev}'`), `MsBell.tsx must declare '${rev}' reveal variant`);
    }

    // Verify SVG filter IDs
    assert.ok(tsx.includes('id="ms-bell-mosaic-glitch"'), 'MsBell.tsx must declare mosaic SVG filter');
    assert.ok(tsx.includes('id="ms-bell-filter-matrix"'), 'MsBell.tsx must declare matrix SVG filter');
    assert.ok(tsx.includes('id="ms-bell-filter-vortex"'), 'MsBell.tsx must declare vortex SVG filter');
  });

  test('reveal transitions are slowed to 760ms and feathered with edge blur against clipping', () => {
    const cssPath = path.resolve('src/ui/MsBell.css');
    const tsxPath = path.resolve('src/ui/MsBell.tsx');

    const css = fs.readFileSync(cssPath, 'utf8');
    const tsx = fs.readFileSync(tsxPath, 'utf8');

    // Slower reveal duration
    assert.ok(tsx.includes('REVEAL_DURATION_MS = 760'), 'MsBell.tsx must set REVEAL_DURATION_MS to 760ms');
    assert.ok(css.includes('0.76s'), 'MsBell.css must use 0.76s animation durations');

    // Edge blurring & anti-clipping feathering
    assert.ok(css.includes('blur(1.5px)'), 'MsBell.css must blur slice edges to avoid hard cuts');
    assert.ok(css.includes('mask-image: radial-gradient'), 'MsBell.css must apply radial feathering mask to glitch slices');
  });

  test('mosaic transition is applied across all state transitions', () => {
    const tsxPath = path.resolve('src/ui/MsBell.tsx');
    const tsx = fs.readFileSync(tsxPath, 'utf8');

    assert.ok(tsx.includes('triggerMosaicTransition'), 'MsBell.tsx must provide triggerMosaicTransition helper');
    assert.ok(tsx.includes('prevTargetSrcRef.current !== targetSrc'), 'MsBell.tsx must watch targetSrc changes');
    assert.ok(tsx.includes("triggerMosaicTransition('mosaic')"), 'MsBell.tsx must trigger mosaic on target changes');
    assert.ok(tsx.includes('prevInteractRef.current && !interactSrc'), 'MsBell.tsx must watch poke interact completion');
  });

  test('study state is strictly gated on studying prop and exits reliably', () => {
    const tsxPath = path.resolve('src/ui/MsBell.tsx');
    const tsx = fs.readFileSync(tsxPath, 'utf8');

    // Must gate isStudy on studying prop directly, not background work scuttle
    assert.ok(tsx.includes('isStudy = Boolean(studying)'), 'isStudy must be strictly derived from studying prop');
    assert.ok(!tsx.includes("isStudy = studying || mood === 'scuttle'"), 'isStudy must not be triggered by background work scuttle');

    // Inactive slot swap must directly trigger on identical source returns
    assert.ok(
      tsx.includes('nextSlotSrc === targetSrc') && tsx.includes('handleSlotLoad(nextSlot, targetSrc)'),
      'Must directly handle slot load when next slot already contains targetSrc',
    );
  });
});



