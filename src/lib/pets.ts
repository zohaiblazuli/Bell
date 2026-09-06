/**
 * Pets — the Codex pet atlas contract, and the commands that reach `src-tauri/src/pets.rs`.
 *
 * A pet is two files, and the format is not ours: it is the Codex pet package that
 * `codex-pets.net`, `openai/skills`' own `hatch-pet` and every community tool in that ecosystem
 * already agree on.
 *
 *     <id>\pet.json           { id, displayName, description, spritesheetPath, ... }
 *     <id>\spritesheet.webp   one 8-column atlas, one animation per ROW
 *
 * **Every number in `PET_*` below is the format's, not a taste call**, which is why they are
 * transcribed rather than derived: 192x208 logical cells, 8 columns, and a per-row frame count that varies
 * (idle is 6 frames, `waving` only 4) so a row cannot be assumed full. Two atlas versions ship —
 * v1 is 9 rows / 1536x1872 and v2 adds the two look-around rows for 11 / 1536x2288 — and both are
 * live on the registry today, so both are read.
 *
 * @see https://codex-pets.net/api/pets — the registry, and the source of these row tables
 * @see https://github.com/openai/skills/blob/main/skills/.curated/hatch-pet/SKILL.md
 */
import { invoke } from '@tauri-apps/api/core';
import type { BellMood } from '@ui/brand/MrBell';

/** One frame. Not square: pets are taller than they are wide, which every layout here honours. */
export const PET_CELL = { w: 192, h: 208 } as const;

/** Columns in the sheet, hence the most frames a row can hold. */
export const PET_COLUMNS = 8;

/**
 * Frames a second.
 *
 * The one number in this file the *package* format does not carry — neither the spritesheet spec
 * nor `pet.json` states a duration. It is the registry's own preview rate (`fps: 8`), taken from
 * there rather than guessed, so a pet animates in Bell at the speed its author saw it at.
 */
export const PET_FPS = 8;

/** The nine rows every pet has, in sheet order. `frames` is fixed per row by the format. */
const ROWS_V1 = [
  { id: 'idle', label: 'Idle', row: 0, frames: 6 },
  { id: 'running-right', label: 'Run right', row: 1, frames: 8 },
  { id: 'running-left', label: 'Run left', row: 2, frames: 8 },
  { id: 'waving', label: 'Waving', row: 3, frames: 4 },
  { id: 'jumping', label: 'Jumping', row: 4, frames: 5 },
  { id: 'failed', label: 'Failed', row: 5, frames: 8 },
  { id: 'waiting', label: 'Waiting', row: 6, frames: 6 },
  { id: 'running', label: 'Running', row: 7, frames: 6 },
  { id: 'review', label: 'Review', row: 8, frames: 6 },
] as const;

/** What v2 adds on top. A v1 sheet has no pixels down here, so nothing may select these rows. */
const ROWS_V2_EXTRA = [
  { id: 'look-right-side', label: 'Look around · right', row: 9, frames: 8 },
  { id: 'look-left-side', label: 'Look around · left', row: 10, frames: 8 },
] as const;

export const PET_ROWS = [...ROWS_V1, ...ROWS_V2_EXTRA] as const;

export type PetState = (typeof PET_ROWS)[number]['id'];
export interface PetRow {
  id: PetState;
  label: string;
  row: number;
  frames: number;
}

export type AtlasVersion = 1 | 2;

/** Decoded atlas geometry. Density 2 means 384x416 source cells rendered as 192x208 logical cells. */
export interface AtlasMetadata {
  version: AtlasVersion;
  density: number;
}

/** Rows a version actually has: 9, or 11. */
export const petRows = (version: AtlasVersion): readonly PetRow[] =>
  version === 2 ? PET_ROWS : ROWS_V1;

export const petRowCount = (version: AtlasVersion) => petRows(version).length;

/** Expected sheet size, so a call site can state the geometry it is about to slice. */
export const petSheetSize = (version: AtlasVersion) => ({
  w: PET_CELL.w * PET_COLUMNS,
  h: PET_CELL.h * petRowCount(version),
});

/**
 * Which version a decoded sheet actually is — **read off the image, never off `pet.json`**.
 *
 * `spriteVersionNumber` is a claim the manifest makes and the renderer cannot afford to take on
 * trust: believing a `2` over an 1872px sheet points the last two rows at pixels that do not exist,
 * and the pet plays an empty frame with no error anywhere. The height is the fact.
 *
 * `null` for anything that is neither, which is what makes an unusable sheet fall back to Mr. Bell
 * instead of rendering a sliced-up mess.
 */
export function atlasVersionForHeight(height: number): AtlasVersion | null {
  if (height === PET_CELL.h * ROWS_V1.length) return 1;
  if (height === PET_CELL.h * PET_ROWS.length) return 2;
  return null;
}

/**
 * Read both the atlas version and its pixel density from decoded dimensions.
 *
 * Codex packages are 1x by default, but clean-line illustration benefits from a 2x source on HiDPI
 * screens. The row/column contract remains unchanged: a dense atlas carries exact integer multiples
 * of every logical dimension, and CSS still slices it into the same 192x208 logical cells.
 */
export function atlasMetadataForDimensions(width: number, height: number): AtlasMetadata | null {
  const logicalWidth = PET_CELL.w * PET_COLUMNS;
  if (width <= 0 || width % logicalWidth !== 0) return null;
  const density = width / logicalWidth;
  if (!Number.isSafeInteger(density) || density < 1 || density > 4) return null;

  const logicalHeight = height / density;
  const version = atlasVersionForHeight(logicalHeight);
  return version == null ? null : { version, density };
}

/** The row a state occupies, or `null` when this version does not carry it. */
export function petRowFor(version: AtlasVersion, state: PetState): PetRow | null {
  return petRows(version).find((r) => r.id === state) ?? null;
}

/* ── Mr. Bell's twelve moods, in a pet's nine or eleven ───────────────────────────────────────── */

/**
 * What each of Mr. Bell's timelines becomes on a pet.
 *
 * `useMascot` keeps speaking Bell — `alarm`, `double-take`, `sleep` — and it should: those names
 * describe what the *app* just did, not which art is on screen. The translation happens here, once,
 * at the render boundary, so swapping the mascot changes no state machine anywhere.
 *
 * Each mood lists its states in order of preference and **every list ends on a row v1 carries**, so
 * a nine-row sheet degrades by walking down the list instead of selecting a row that has no pixels.
 * A pet has one failure row, so `alarm` and `slump` share it. A poke uses `jumping` as the
 * interaction reaction, while `glint` carries the friendly wave shown after successful work.
 */
const MOOD_STATES: Record<BellMood, readonly PetState[]> = {
  idle: ['idle'],
  'specs-push-up': ['review', 'idle'],
  periscope: ['look-right-side', 'review', 'idle'],
  'lens-draw-on': ['review'],
  alarm: ['failed'],
  'double-take': ['jumping'],
  scuttle: ['running'],
  hop: ['jumping'],
  slump: ['failed'],
  // Not `idle`: a pet's resting-long row is `waiting`, and it is the nearest thing to nodding off.
  sleep: ['waiting'],
  glint: ['waving'],
  // In the file the crab does not move for a tone crossing — only his lenses re-tint. A pet has no
  // lenses, so it glances instead, and on v1 it stays exactly where it was.
  'tone-handoff': ['look-left-side', 'idle'],
};

/** The state to play for a mood, guaranteed to exist on this version's sheet. */
export function petStateForMood(version: AtlasVersion, mood: BellMood): PetState {
  const rows = petRows(version);
  for (const state of MOOD_STATES[mood] ?? []) {
    if (rows.some((r) => r.id === state)) return state;
  }
  return 'idle';
}

/* ── Identity ─────────────────────────────────────────────────────────────────────────────────── */

/** Names Windows will not let a directory have, whatever the charset says. */
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/;

/**
 * `^[a-z0-9][a-z0-9-]{0,63}$`, and not a device name.
 *
 * **A pet id arrives from the network**, which is the whole difference between this guard and
 * `isNbId`: a notebook id is minted by the app, so its charset is closed by construction, whereas
 * this one is whatever a registry hands over. Closed rather than escaped for the same reason —
 * there is no dot, no separator and nothing to normalise, so `root.join(id)` stays safe to say once.
 * `pets.rs::valid_id` is the copy that matters; this one keeps a bad row out of the UI.
 */
export const isPetId = (id: string) => /^[a-z0-9][a-z0-9-]{0,63}$/.test(id) && !RESERVED.test(id);

/* ── The wire ─────────────────────────────────────────────────────────────────────────────────── */

/** `pet.json`, exactly as the format defines it. Only the first two fields are guaranteed. */
export interface PetManifest {
  id: string;
  displayName: string;
  description: string;
  /** Always `spritesheet.webp` in practice, and the only value Bell stores. */
  spritesheetPath: string;
  /** The manifest's *claim*; the renderer trusts `atlasVersionForHeight` instead. */
  spriteVersionNumber: number;
  /** `person` · `animal` · `creature` · `object`. Free text upstream, so shown, never switched on. */
  kind: string;
}

/** An installed pet: its manifest plus the one thing only the filesystem can answer. */
export interface PetEntry extends PetManifest {
  /** Size of the spritesheet on disk. Settings prints this as what the pet costs. */
  bytes: number;
}

/** One row of the registry — a pet that could be installed, not one that is. */
export interface RegistryPet extends PetManifest {
  tags: string[];
  /** Who made it. Shown as credit, because a pet is somebody's drawing. */
  ownerHandle: string | null;
  /** Absolute, and on the registry host. Rust re-checks the host before fetching either. */
  sheetUrl: string;
  /**
   * A single framed still, for the gallery tile.
   *
   * **This is `posterUrl`, not `previewUrl`, and the difference is not cosmetic.** The registry's
   * `previewUrl` is a whole animation STRIP — all eight frames of a row side by side, 156 KB of it —
   * so a tile that fits it with `object-fit: contain` renders a 64px-wide, 8px-tall sliver and reads
   * as an empty box. The poster is one 29 KB portrait, which is what a 64px tile wants.
   */
  posterUrl: string | null;
}

/** A field that may be missing, the wrong type, or hostile. Anything else becomes `fallback`. */
const str = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);

/**
 * Read the registry's own JSON into rows Bell will render.
 *
 * Deliberately tolerant in one direction and strict in the other: an unknown field is ignored so the
 * registry can grow, and a row missing an `id` this app would put in a path, or a sheet to fetch, is
 * dropped rather than repaired. Text is clamped because `displayName` and `description` are
 * user-submitted and land in a fixed-width tile.
 */
export function parseRegistry(json: string): RegistryPet[] {
  let body: unknown;
  try {
    body = JSON.parse(json);
  } catch {
    return [];
  }
  const rows = (body as { pets?: unknown })?.pets;
  if (!Array.isArray(rows)) return [];

  const out: RegistryPet[] = [];
  for (const row of rows as Record<string, unknown>[]) {
    const id = str(row?.id);
    const sheetUrl = str(row?.spritesheetUrl);
    if (!isPetId(id) || !sheetUrl) continue;
    out.push({
      id,
      displayName: str(row.displayName, id).slice(0, 80),
      description: str(row.description).slice(0, 300),
      spritesheetPath: str(row.spritesheetPath, 'spritesheet.webp'),
      spriteVersionNumber: typeof row.spriteVersionNumber === 'number' ? row.spriteVersionNumber : 1,
      kind: str(row.kind, 'pet').slice(0, 24),
      tags: Array.isArray(row.tags) ? row.tags.filter((t) => typeof t === 'string').slice(0, 6) : [],
      ownerHandle: typeof row.ownerHandle === 'string' ? row.ownerHandle.slice(0, 40) : null,
      sheetUrl,
      // Poster first — see the field's note. `previewUrl` is the strip, and only a fallback.
      posterUrl: str(row.posterUrl) || str(row.previewUrl) || null,
    });
  }
  return out;
}

/* ── The commands ─────────────────────────────────────────────────────────────────────────────────
   Thin wrappers, one per `#[tauri::command]` in `src-tauri/src/pets.rs`. The argument names are the
   contract and have to match it exactly. Every one of the three that reaches the network reaches it
   from RUST — the webview's CSP has no origin for codex-pets.net and must not gain one. */

/** Every installed pet. The shelf renders these; `null` in Settings means Mr. Bell. */
export const petList = () => invoke<PetEntry[]>('pet_list');

/**
 * Fetch one pet's spritesheet and write it beside a `pet.json` built from `manifest`.
 *
 * Rust owns the location, validates the id, checks the host on `sheetUrl` and refuses bytes that are
 * not a WebP — the same posture `downloads::fetch_pdf` takes with a paper. Idempotent: installing a
 * pet that is already on disk replaces it.
 */
export const petInstall = (manifest: PetManifest, sheetUrl: string) =>
  invoke<PetEntry>('pet_install', { manifest, sheetUrl });

/** Remove a pet's directory. The selection is Settings' business, not this command's. */
export const petDelete = (id: string) => invoke<void>('pet_delete', { id });

/** The raw spritesheet, the efficient direction of the IPC — the same shape as `nb_asset_load`. */
export const petSheet = (id: string) => invoke<ArrayBuffer>('pet_sheet', { id });

/** Optional Bell-native motion definition. Legacy two-file pets return `null`. */
export const petMotion = (id: string) => invoke<string | null>('pet_motion', { id });

/** One image page named by a validated Bell-native motion definition. */
export const petAsset = (id: string, file: string) =>
  invoke<ArrayBuffer>('pet_asset', { id, file });

/** The registry's JSON, verbatim. Parsed here by `parseRegistry`, never in Rust. */
export const petRegistry = () => invoke<string>('pet_registry');

/** One gallery thumbnail's bytes, for a pet that is not installed yet. */
export const petPreview = (url: string) => invoke<ArrayBuffer>('pet_preview', { url });
