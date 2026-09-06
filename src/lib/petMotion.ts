/**
 * Bell's optional high-fidelity pet motion format.
 *
 * Unlike the legacy fixed-rate atlas, a motion manifest can spread animation over several pages
 * and gives every cel its own hold time. Parsing is deliberately all-or-nothing: these files may
 * come from a downloaded pet, and rendering half of a malformed timeline is worse than falling
 * back to its ordinary spritesheet.
 */

export const BELL_MOTION_FORMAT = 'bell-motion' as const;
export const BELL_MOTION_VERSION = 1 as const;

const MAX_MANIFEST_BYTES = 1_000_000;
const MAX_PAGES = 32;
const MAX_PAGE_AXIS = 256;
const MAX_PAGE_CELLS = 16_384;
const MAX_CLIPS = 256;
const MAX_FRAMES_PER_CLIP = 4_096;
const MAX_FRAMES_TOTAL = 16_384;
const MAX_FRAME_DURATION_MS = 60_000;
const MAX_CLIP_DURATION_MS = 600_000;

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,126}\.(?:webp|png)$/;
const WINDOWS_DEVICE = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

export interface MotionCanvas {
  width: 192;
  height: 208;
  density: 1 | 2 | 3 | 4;
}

export interface MotionPage {
  id: string;
  file: string;
  columns: number;
  rows: number;
}

export interface MotionFrame {
  /** Zero-based, row-major cell on the clip's page. */
  cell: number;
  /** How long this cel remains current. Fractional milliseconds are allowed. */
  durationMs: number;
}

export type MotionPlayback = 'once' | 'loop';

export interface MotionClip {
  page: string;
  playback: MotionPlayback;
  frames: MotionFrame[];
  /** Fraction of each hold, at its end, spent cross-fading to the following cel. */
  blendFraction?: number;
}

export interface MotionReducedPose {
  clip: string;
  /** Frame index within `clip`, rather than an atlas cell number. */
  frame: number;
}

export interface MotionSleepState {
  enter: string;
  loop: string;
  exit: string;
  reducedPose: MotionReducedPose;
}

export type MotionMoodState =
  | { mode: 'clip'; clip: string }
  | { mode: 'playlist'; clips: string[] }
  | { mode: 'routine'; clips: string[] }
  | { mode: 'sequence'; enter: string; loop: string };

export interface PetMotionManifest {
  format: typeof BELL_MOTION_FORMAT;
  version: typeof BELL_MOTION_VERSION;
  canvas: MotionCanvas;
  pages: MotionPage[];
  clips: Record<string, MotionClip>;
  states: {
    sleep: MotionSleepState;
    /** Optional Bell-native overrides keyed by BellMood. Unknown moods simply use the legacy atlas. */
    moods?: Record<string, MotionMoodState>;
  };
}

export interface MotionSample {
  cell: number;
  nextCell: number;
  /** Cross-fade amount in [0, 1]. Zero means only `cell` is visible. */
  mix: number;
  /** True only after a `once` clip reaches its end. Looping clips never complete. */
  complete: boolean;
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const positiveInteger = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= max;

const safeId = (value: unknown): value is string => typeof value === 'string' && ID.test(value);

const safeImageBasename = (value: unknown): value is string =>
  typeof value === 'string' && FILE.test(value) && !WINDOWS_DEVICE.test(value);

/** Parse and validate an untrusted `motion.json`. Returns null rather than a partial manifest. */
export function parsePetMotion(json: string): PetMotionManifest | null {
  if (typeof json !== 'string' || json.length === 0 || json.length > MAX_MANIFEST_BYTES) return null;

  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  if (!record(value) || value.format !== BELL_MOTION_FORMAT || value.version !== BELL_MOTION_VERSION) {
    return null;
  }

  const canvas = value.canvas;
  if (
    !record(canvas) ||
    canvas.width !== 192 ||
    canvas.height !== 208 ||
    !Number.isSafeInteger(canvas.density) ||
    (canvas.density as number) < 1 ||
    (canvas.density as number) > 4
  ) {
    return null;
  }

  if (!Array.isArray(value.pages) || value.pages.length === 0 || value.pages.length > MAX_PAGES) {
    return null;
  }
  const pages: MotionPage[] = [];
  const pageCells = new Map<string, number>();
  const pageFiles = new Set<string>();
  for (const candidate of value.pages) {
    if (
      !record(candidate) ||
      !safeId(candidate.id) ||
      !safeImageBasename(candidate.file) ||
      !positiveInteger(candidate.columns, MAX_PAGE_AXIS) ||
      !positiveInteger(candidate.rows, MAX_PAGE_AXIS) ||
      candidate.columns * candidate.rows > MAX_PAGE_CELLS ||
      pageCells.has(candidate.id) ||
      pageFiles.has(candidate.file.toLowerCase())
    ) {
      return null;
    }
    const page: MotionPage = {
      id: candidate.id,
      file: candidate.file,
      columns: candidate.columns,
      rows: candidate.rows,
    };
    pages.push(page);
    pageCells.set(page.id, page.columns * page.rows);
    pageFiles.add(page.file.toLowerCase());
  }

  if (!record(value.clips)) return null;
  const clipEntries = Object.entries(value.clips);
  if (clipEntries.length === 0 || clipEntries.length > MAX_CLIPS) return null;
  const clips: Record<string, MotionClip> = Object.create(null) as Record<string, MotionClip>;
  let totalFrameCount = 0;
  for (const [id, candidate] of clipEntries) {
    if (!safeId(id) || !record(candidate) || !safeId(candidate.page) || !pageCells.has(candidate.page)) {
      return null;
    }
    if (candidate.playback !== 'once' && candidate.playback !== 'loop') return null;
    if (
      !Array.isArray(candidate.frames) ||
      candidate.frames.length === 0 ||
      candidate.frames.length > MAX_FRAMES_PER_CLIP
    ) {
      return null;
    }
    if (
      candidate.blendFraction !== undefined &&
      (typeof candidate.blendFraction !== 'number' ||
        !Number.isFinite(candidate.blendFraction) ||
        candidate.blendFraction < 0 ||
        candidate.blendFraction > 1)
    ) {
      return null;
    }

    const cells = pageCells.get(candidate.page) as number;
    const frames: MotionFrame[] = [];
    let clipDuration = 0;
    for (const frame of candidate.frames) {
      if (
        !record(frame) ||
        typeof frame.cell !== 'number' ||
        !Number.isSafeInteger(frame.cell) ||
        frame.cell < 0 ||
        frame.cell >= cells ||
        typeof frame.durationMs !== 'number' ||
        !Number.isFinite(frame.durationMs) ||
        frame.durationMs <= 0 ||
        frame.durationMs > MAX_FRAME_DURATION_MS
      ) {
        return null;
      }
      clipDuration += frame.durationMs;
      if (clipDuration > MAX_CLIP_DURATION_MS) return null;
      frames.push({ cell: frame.cell, durationMs: frame.durationMs });
    }
    totalFrameCount += frames.length;
    if (totalFrameCount > MAX_FRAMES_TOTAL) return null;

    clips[id] = {
      page: candidate.page,
      playback: candidate.playback,
      frames,
      ...(candidate.blendFraction === undefined ? {} : { blendFraction: candidate.blendFraction }),
    };
  }

  const states = record(value.states) ? value.states : null;
  const sleep = states?.sleep ?? null;
  const reducedPose = record(sleep) ? sleep.reducedPose : null;
  if (
    !record(sleep) ||
    !safeId(sleep.enter) ||
    !safeId(sleep.loop) ||
    !safeId(sleep.exit) ||
    !record(reducedPose) ||
    !safeId(reducedPose.clip) ||
    typeof reducedPose.frame !== 'number' ||
    !Number.isSafeInteger(reducedPose.frame) ||
    reducedPose.frame < 0
  ) {
    return null;
  }
  for (const clipId of [sleep.enter, sleep.loop, sleep.exit, reducedPose.clip]) {
    if (!Object.prototype.hasOwnProperty.call(clips, clipId)) return null;
  }
  if (reducedPose.frame >= clips[reducedPose.clip].frames.length) return null;
  // Entry and exit are transitions; the resting portion is the only sequence that should repeat.
  if (clips[sleep.enter].playback !== 'once' || clips[sleep.loop].playback !== 'loop' || clips[sleep.exit].playback !== 'once') {
    return null;
  }

  let moods: Record<string, MotionMoodState> | undefined;
  if (states && Object.prototype.hasOwnProperty.call(states, 'moods')) {
    if (!record(states.moods)) return null;
    const entries = Object.entries(states.moods);
    if (entries.length > 32) return null;
    moods = Object.create(null) as Record<string, MotionMoodState>;
    for (const [mood, candidate] of entries) {
      if (!safeId(mood) || !record(candidate)) return null;
      if (candidate.mode === 'clip') {
        if (!safeId(candidate.clip) || !Object.prototype.hasOwnProperty.call(clips, candidate.clip)) return null;
        moods[mood] = { mode: 'clip', clip: candidate.clip };
      } else if (candidate.mode === 'playlist' || candidate.mode === 'routine') {
        if (!Array.isArray(candidate.clips) || candidate.clips.length === 0 || candidate.clips.length > 16) return null;
        const playlist: string[] = [];
        for (const clipId of candidate.clips) {
          if (
            !safeId(clipId) ||
            !Object.prototype.hasOwnProperty.call(clips, clipId) ||
            clips[clipId].playback !== 'once'
          ) {
            return null;
          }
          playlist.push(clipId);
        }
        moods[mood] = { mode: candidate.mode, clips: playlist };
      } else if (candidate.mode === 'sequence') {
        if (
          !safeId(candidate.enter) ||
          !safeId(candidate.loop) ||
          !Object.prototype.hasOwnProperty.call(clips, candidate.enter) ||
          !Object.prototype.hasOwnProperty.call(clips, candidate.loop) ||
          clips[candidate.enter].playback !== 'once' ||
          clips[candidate.loop].playback !== 'loop'
        ) {
          return null;
        }
        moods[mood] = { mode: 'sequence', enter: candidate.enter, loop: candidate.loop };
      } else {
        return null;
      }
    }
  }

  return {
    format: BELL_MOTION_FORMAT,
    version: BELL_MOTION_VERSION,
    canvas: { width: 192, height: 208, density: canvas.density as 1 | 2 | 3 | 4 },
    pages,
    clips,
    states: {
      sleep: {
        enter: sleep.enter,
        loop: sleep.loop,
        exit: sleep.exit,
        reducedPose: { clip: reducedPose.clip, frame: reducedPose.frame },
      },
      ...(moods === undefined ? {} : { moods }),
    },
  };
}

/** Resolve a variable-duration clip at an elapsed time, including its optional outgoing blend. */
export function sampleMotionClip(clip: MotionClip, elapsedMs: number): MotionSample {
  const total = clip.frames.reduce((sum, frame) => sum + frame.durationMs, 0);
  const finiteElapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : elapsedMs > 0 ? total : 0;
  const complete = clip.playback === 'once' && finiteElapsed >= total;
  if (complete) {
    const cell = clip.frames[clip.frames.length - 1].cell;
    return { cell, nextCell: cell, mix: 0, complete: true };
  }

  const time = clip.playback === 'loop' ? finiteElapsed % total : finiteElapsed;
  let frameStart = 0;
  let index = 0;
  for (; index < clip.frames.length - 1; index += 1) {
    if (time < frameStart + clip.frames[index].durationMs) break;
    frameStart += clip.frames[index].durationMs;
  }

  const frame = clip.frames[index];
  const nextIndex = index + 1 < clip.frames.length ? index + 1 : clip.playback === 'loop' ? 0 : index;
  const blend = clip.blendFraction ?? 0;
  const progress = Math.min(1, Math.max(0, (time - frameStart) / frame.durationMs));
  const mix = blend > 0 && nextIndex !== index ? Math.max(0, (progress - (1 - blend)) / blend) : 0;
  return { cell: frame.cell, nextCell: clip.frames[nextIndex].cell, mix, complete: false };
}
