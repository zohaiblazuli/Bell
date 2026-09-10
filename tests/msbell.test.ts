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

  test('loadSettings normalizes pet properly', () => {
    // Save msbell
    saveSettings({ ...SETTINGS_DEFAULTS, pet: 'msbell' });
    assert.equal(loadSettings().pet, 'msbell');

    // Save azure
    saveSettings({ ...SETTINGS_DEFAULTS, pet: 'azure' });
    assert.equal(loadSettings().pet, 'azure');

    // Save null (Mr. Bell)
    saveSettings({ ...SETTINGS_DEFAULTS, pet: null });
    assert.equal(loadSettings().pet, null);

    // Stale or invalid id falls back to msbell
    // @ts-expect-error testing invalid pet id
    saveSettings({ ...SETTINGS_DEFAULTS, pet: 'unknown-cat' });
    assert.equal(loadSettings().pet, 'msbell');

    // Reset back to msbell default
    saveSettings(SETTINGS_DEFAULTS);
  });

  test('public/msbell GIF assets exist and are non-empty', () => {
    const requiredFiles = [
      'msbell_idle.gif',
      'msbell_idle_2.gif',
      'msbell_idle_3.gif',
      'msbell_idle_4.gif',
      'msbell_idle_5.gif',
      'msbell_interact_1.gif',
      'msbell_interact_2.gif',
      'msbell_interact_3.gif',
      'msbell_sleeping.gif',
      'msbell_study_start.gif',
      'msbell_study_loop.gif',
      'startup_splash.gif',
    ];

    for (const file of requiredFiles) {
      const filePath = path.resolve('public/msbell', file);
      assert.ok(fs.existsSync(filePath), `Expected ${file} to exist in public/msbell`);
      const stat = fs.statSync(filePath);
      assert.ok(stat.size > 1024 * 1024, `Expected ${file} to be > 1MB, got ${stat.size} bytes`);
    }
  });

  test('all Ms. Bell GIF animations have non-empty initial frames (no loop flash)', () => {
    const gifFiles = [
      'msbell_idle.gif',
      'msbell_idle_2.gif',
      'msbell_idle_3.gif',
      'msbell_idle_4.gif',
      'msbell_idle_5.gif',
      'msbell_interact_1.gif',
      'msbell_interact_2.gif',
      'msbell_interact_3.gif',
      'msbell_sleeping.gif',
      'msbell_study_start.gif',
      'msbell_study_loop.gif',
      'startup_splash.gif',
    ];

    for (const file of gifFiles) {
      const filePath = path.resolve('public/msbell', file);
      assert.ok(fs.existsSync(filePath), `${file} must exist`);

      const buf = fs.readFileSync(filePath);
      let pos = 13;
      const gctFlag = buf[10] & 0x80;
      if (gctFlag) {
        const gctSize = 3 * (1 << ((buf[10] & 0x07) + 1));
        pos += gctSize;
      }

      // Find first image descriptor block (0x2C) and check sub-block size
      let firstFrameBytes = 0;
      while (pos < buf.length) {
        const block = buf[pos++];
        if (block === 0x3B) break;
        if (block === 0x21) {
          pos++; // skip extType
          const blockSize = buf[pos++];
          pos += blockSize;
          while (buf[pos] !== 0) pos += buf[pos] + 1;
          pos++;
        } else if (block === 0x2C) {
          const lctFlag = buf[pos + 8] & 0x80;
          pos += 9;
          if (lctFlag) {
            const lctSize = 3 * (1 << ((buf[pos - 1] & 0x07) + 1));
            pos += lctSize;
          }
          pos++; // lzw code size
          while (buf[pos] !== 0) {
            firstFrameBytes += buf[pos];
            pos += buf[pos] + 1;
          }
          break;
        }
      }
      // A blank/empty transparent frame is ~3KB; a rendered 2189x1207 character frame is > 300KB
      assert.ok(
        firstFrameBytes > 100000,
        `${file} first frame must not be empty (got ${firstFrameBytes} bytes)`
      );
    }
  });

  test('startup watchdog cannot cut off the authored Ms. Bell sequence', () => {
    const hold = startupHoldDurationMs('msbell', false);
    assert.equal(hold, 8480);
    assert.ok(startupWatchdogMs('splash', 'msbell', false) > hold);

    assert.equal(startupHoldDurationMs('azure', false), 2000);
    assert.equal(startupHoldDurationMs(null, true), 700);
    assert.equal(startupHandoffDurationMs(false), 900);
    assert.equal(startupHandoffDurationMs(true), 320);
  });
});
