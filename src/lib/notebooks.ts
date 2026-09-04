/**
 * Notebooks — the on-disk format, the page arithmetic, and the IPC wrappers.
 *
 * Spec: `design/specs/screen-notebooks.md`. This module is the contract both halves build against:
 * `src-tauri/src/notebooks.rs` implements the commands below, `src/lib/ink.ts` produces and consumes
 * the stroke and object records, and the two screens read nothing else.
 *
 * WHY THIS IS NOT `store.ts`. `state_load` slurps *every* `*.json` in the state dir into memory
 * before the first render — that is what keeps `store.ts`'s accessors synchronous. One measured ink
 * file on this machine is 66,673 bytes for a single page, and `state_save` is text-only, so images
 * would have to be base64 inside JSON. Notebooks therefore get their own directory, their own
 * commands, and lazy per-page loading.
 *
 *     <app_data_dir>\notebooks\
 *       index.json            the shelf, cached — see `nbList`
 *       <id>\meta.json        the authored fields; the source of truth
 *       <id>\history.json     the undo stack, so Ctrl+Z survives a relaunch
 *       <id>\pages\NNNN.json  written only once the page has content
 *       <id>\assets\<sha>.png content-addressed, so the same clip pasted twice stores once
 *
 * `<id>` is app-generated and matches `^[a-z0-9]{16}$`. **The name the student types never reaches a
 * filesystem path** — it lives inside JSON only, which is what preserves the guarantee `key_path`
 * gives the state dir without having to reuse it.
 */

import { invoke } from '@tauri-apps/api/core';

/* ─────────────────────────────────────────────────────────── the authored record ─────────────── */

/** A cover swatch, `--cover-1` … `--cover-8`. Mode-invariant: a cover is an object, not chrome. */
export type CoverId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const COVER_IDS: readonly CoverId[] = [1, 2, 3, 4, 5, 6, 7, 8];

/** Spec §6c `paper` card. Drawn as real miniature pages, so none of these needs a glyph. */
export type PaperStyle = 'blank' | 'ruled' | 'grid' | 'dotted';
export const PAPER_STYLES: readonly PaperStyle[] = ['blank', 'ruled', 'grid', 'dotted'];

/**
 * The sticker on the cover: a `Subject Icon` code (`physics`, `maths`, …), the literal `bell` for
 * `MrBellMark`, or null for none. Deliberately not an asset sha — spec §7's `browse` tile is the
 * photo route and `Show Photo#` is false on every shelf tile in the file.
 */
export type StickerId = string | null;

/** What the student chose. Everything else about a notebook is derived or stamped by Rust. */
export interface NbAuthored {
  name: string;
  cover: CoverId;
  sticker: StickerId;
  paper: PaperStyle;
  /** Spec §6c: the `Margin rule` switch, on by default. */
  margin: boolean;
  /** The linked syllabus, e.g. `{ code: '9702', name: 'Physics' }`. Codes, not ids — a resync
   *  replaces `catalog_*` wholesale and would orphan an id. */
  subject: { code: string; name: string } | null;
}

export interface NbMeta extends NbAuthored {
  id: string;
  /** Epoch ms. */
  createdAt: number;
  updatedAt: number;
}

/** A shelf row: the authored record plus the two fields only the filesystem can answer. */
export interface NbEntry extends NbMeta {
  /** Derived, never stored — see `pageCountFromMaxIndex`. */
  pages: number;
  /** Bytes on disk, pages and assets together. Spec §6c prints this as "On this device". */
  bytes: number;
}

export interface NbStat {
  pages: number;
  bytes: number;
  assets: number;
}

export const DEFAULT_AUTHORED: NbAuthored = {
  name: '',
  cover: 1,
  sticker: null,
  paper: 'ruled',
  margin: true,
  subject: null,
};

/* ───────────────────────────────────────────────────────────── the page record ────────────────── */

/**
 * A drawing tool. Ten in the dock's three tool groups plus undo/redo in the fourth; the four that
 * lay ink down are the four that can appear in a saved stroke.
 */
export type NbTool = 'pen' | 'pencil' | 'hl' | 'er' | 'lasso' | 'shapes' | 'text' | 'image' | 'ruler' | 'sticky';
export type InkTool = 'pen' | 'pencil' | 'hl' | 'er';

/** Spec §6a's NIB card. The nib decides the taper, so it has to be stored with the stroke. */
export type NibId = 'fountain' | 'ballpoint' | 'pencil' | 'marker';
export const NIB_IDS: readonly NibId[] = ['fountain', 'ballpoint', 'pencil', 'marker'];

/**
 * The inspector's Tool tab, as one record — spec §6a's four cards.
 *
 * It lives here rather than in `ink.ts` because three components and two libraries read it: the dock
 * picks the tool, the inspector edits the rest, the page paints with it, and the engine turns it into
 * an outline. Persisted as one pref, so the colour you write in is yours rather than the notebook's —
 * the same decision the Reader made about its own three ink prefs.
 */
export interface NbInkSettings {
  tool: NbTool;
  nib: NibId;
  /** A palette TOKEN. The literal is frozen into each stroke at pointer-down, never stored here. */
  colour: string;
  strokePx: number;
  opacity: number;
  smoothing: number;
  pressure: boolean;
  straightLock: boolean;
  snapRuler: boolean;
  /** `stroke` deletes whole strokes; `paint` is the Reader's `destination-out`. See `ink.ts`. */
  eraser: 'stroke' | 'paint';
}

/**
 * §6a's INK card: two rows of five, `SPACE_BETWEEN`, with `--iris-3` selected.
 *
 * Row one is the neutrals and the brand ramp — all mode-invariant, so they mean the same thing in
 * both tones. Row two borrows five of the eight cover colours, which is why the cover family being
 * mode-invariant matters twice: they are ink on white paper as well as a cover, and ink must never
 * invert. There is deliberately no `--d*` in here; the difficulty ramp retones, and a stroke drawn in
 * Night would then read as a different colour in Day.
 */
export const NB_INK_PALETTE: readonly (readonly string[])[] = [
  ['--page-ink', '--iris-3', '--iris-2', '--iris-1', '--bell-cap-hi'],
  ['--cover-2', '--cover-3', '--cover-4', '--cover-5', '--cover-8'],
];

/** §6a's STROKE card prints `8 px` and lights the middle dot in `--accent`. */
export const NB_STROKES = [5, 8, 12] as const;

export const DEFAULT_INK: NbInkSettings = {
  tool: 'pen',
  nib: 'fountain',
  colour: '--iris-3',
  strokePx: 8,
  opacity: 1,
  smoothing: 0.4,
  pressure: true,
  straightLock: false,
  snapRuler: false,
  eraser: 'stroke',
};

/**
 * One committed stroke.
 *
 * `p` is a FLAT `[x, y, pressure, …]` stream rather than an array of `{x, y}` objects: the Reader
 * stores full-precision object points at roughly 48 bytes each and this lands at about 7. `x` and
 * `y` are fractions of the page box, never pixels, quantised to 4 dp (spec §14) so a page renders
 * identically at any zoom, window size or DPR. `pressure` is 0…1.
 *
 * `c` is a frozen literal, resolved from a palette token exactly once at pointer-down — the same
 * rule `annotations.ts` documents at length. Ink is printed on white paper and must never invert
 * with the tone, and a stroke keeps the colour it was drawn in for ever.
 */
export interface NbStroke {
  /** Stable within a page, so the command stack and the selection can name a stroke. */
  id: string;
  t: InkTool;
  c: string;
  /** Nib width as a fraction of the page width. */
  w: number;
  /** `globalAlpha` 0…1. Absent means 1. */
  o?: number;
  n?: NibId;
  /** 0…1, how much the input is smoothed before the outline is generated. Absent means the default. */
  sm?: number;
  p: number[];
}

export type NbObject =
  | { id: string; k: 'img'; sha: string; x: number; y: number; w: number; h: number; rot?: number }
  | { id: string; k: 'text'; s: string; x: number; y: number; w: number; size: number; c: string }
  | {
      id: string;
      k: 'shape';
      s: 'line' | 'arrow' | 'rect' | 'ellipse';
      x: number;
      y: number;
      w: number;
      h: number;
      c: string;
      sw: number;
      fill?: string;
    }
  | { id: string; k: 'note'; s: string; x: number; y: number; w: number; h: number; c: string };

export interface NbPage {
  v: 1;
  strokes: NbStroke[];
  objects: NbObject[];
}

export const emptyPage = (): NbPage => ({ v: 1, strokes: [], objects: [] });

export const pageIsEmpty = (page: NbPage) => page.strokes.length === 0 && page.objects.length === 0;

/**
 * The lowest point anything on the page reaches, as a fraction of the page height, or 0 for a blank
 * page. Lives here rather than in `ink.ts` because it is arithmetic over the stored format rather
 * than part of the drawing engine — a clip landing on a page needs it, and so does anything that
 * wants to append below existing working without reading a bbox cache into existence.
 *
 * Stroke points are a flat `[x, y, pressure, …]` stream, so the y values are every third element
 * starting at 1.
 */
export function pageBottom(page: NbPage): number {
  let bottom = 0;
  for (const s of page.strokes) {
    for (let i = 1; i < s.p.length; i += 3) if (s.p[i] > bottom) bottom = s.p[i];
  }
  for (const o of page.objects) {
    const h = 'h' in o ? o.h : 0;
    if (o.y + h > bottom) bottom = o.y + h;
  }
  return Math.min(1, bottom);
}

/** The page box the spread draws, from spec §5c. Used to keep an image's aspect honest. */
export const PAGE_W = 455;
export const PAGE_H = 644;
/** Page padding, also §5c — the Reader's `doc` padding, deliberately the same. */
export const PAGE_PAD_X = 34 / PAGE_W;
export const PAGE_PAD_Y = 30 / PAGE_H;

/* ──────────────────────────────────────────────────────── the page arithmetic ─────────────────── */

/**
 * Pages are stored 0-indexed and DISPLAYED with an offset of 2, and that offset is what makes every
 * number the design file draws come out right.
 *
 * Figma shows `pages 12-13` in the spread nav, lists `Spreads 2-3 … 18-19` in the Pages tab, and
 * prints `48 pages` in the topbar. A left page is therefore always EVEN, and the lowest spread the
 * Pages tab lists is `2-3` — so the first leaf of a notebook is pages 2 and 3, exactly as a bound
 * notebook whose cover is leaf one behaves. With the offset: disk indices 0 and 1 are the first
 * spread and read `2-3`; spread 5 reads `12-13`; a notebook whose highest written index is 47 has
 * 48 pages and its last spread reads `48-49`. Every drawn figure is consistent, which is the check
 * that says the model is the file's own rather than one invented next to it.
 */
export const PAGE_LABEL_OFFSET = 2;

/** What the spread nav prints for a disk index. */
export const pageLabel = (index: number) => index + PAGE_LABEL_OFFSET;

/** The two disk indices on spread `s`, left then right. */
export const spreadPages = (spread: number): [number, number] => [spread * 2, spread * 2 + 1];

/** Which spread a disk index falls on. */
export const spreadOf = (index: number) => Math.floor(index / 2);

/** `pages 12-13`. Never a total — spec TRAP 15, and `next` is always enabled. */
export const spreadLabel = (spread: number) => {
  const [l, r] = spreadPages(spread);
  return `pages ${pageLabel(l)}-${pageLabel(r)}`;
};

/**
 * "Infinite pages, never asked for" made arithmetic.
 *
 * The plan's rule is `1 + max(page file stem)`, with two corrections that fall out of the spread
 * being the unit the student actually sees: a notebook always has at least one whole spread even
 * before anything is written, and a page count must be even or the last spread would be half a
 * leaf. `maxIndex` is -1 when no page file exists at all.
 */
export function pageCountFromMaxIndex(maxIndex: number): number {
  const written = Math.max(0, maxIndex + 1);
  const whole = written + (written % 2); // round up to a whole spread
  return Math.max(2, whole);
}

/** How many spreads a page count covers. Always at least one. */
export const spreadCountFor = (pages: number) => Math.max(1, Math.ceil(pages / 2));

/**
 * The four-digit stem `nb_page_*` addresses. Kept here rather than in Rust alone so a test can pin
 * both halves against one definition.
 */
export const pageStem = (index: number) => String(index).padStart(4, '0');

/** `^[a-z0-9]{16}$` — Rust generates these; this is the guard every call site can reuse. */
export const NB_ID = /^[a-z0-9]{16}$/;
export const isNbId = (id: string) => NB_ID.test(id);

/** Round a page-box fraction to the 4 dp the format stores. */
export const q4 = (n: number) => Math.round(n * 10_000) / 10_000;

/* ──────────────────────────────────────────────────────────────────── the IPC ────────────────── */

/**
 * The shelf. Rust reads the cached `index.json`, overlays `pages` and `bytes` from the filesystem,
 * and reconciles both ways — a directory with a `meta.json` but no index entry is adopted, an index
 * entry whose directory has gone is dropped. That self-healing is deliberate and follows
 * `downloads::repair`: the per-notebook `meta.json` is the source of truth and the index is a cache,
 * so losing the cache costs a directory walk rather than a notebook.
 *
 * Sorted most-recently-edited first, which is the order the shelf renders.
 */
export const nbList = () => invoke<NbEntry[]>('nb_list');

/** Rust generates the id, stamps both timestamps, and returns the row the shelf should show. */
export const nbCreate = (meta: NbAuthored) => invoke<NbEntry>('nb_create', { meta });

/** Replace the authored fields. `updatedAt` is stamped by Rust; `createdAt` and `id` are ignored. */
export const nbMetaSave = (id: string, meta: NbAuthored) =>
  invoke<NbEntry>('nb_meta_save', { id, meta });

/** The notebook, its pages, its history and its assets. Irreversible. */
export const nbDelete = (id: string) => invoke<void>('nb_delete', { id });

/** `null` when the page has never been written — which is the normal case for a fresh spread. */
export const nbPageLoad = (id: string, page: number) =>
  invoke<string | null>('nb_page_load', { id, page });

export const nbPageSave = (id: string, page: number, json: string) =>
  invoke<void>('nb_page_save', { id, page, json });

/** Used when a page is emptied, so an all-erased page stops counting towards the page total. */
export const nbPageDelete = (id: string, page: number) =>
  invoke<void>('nb_page_delete', { id, page });

export const nbHistoryLoad = (id: string) => invoke<string | null>('nb_history_load', { id });

export const nbHistorySave = (id: string, json: string) =>
  invoke<void>('nb_history_save', { id, json });

/**
 * Store an image and return its sha256, which is also its file name. Content-addressed, so pasting
 * the same clip onto two pages stores one file.
 *
 * Bytes go out as a plain number array. That is the slow direction of the IPC and it is chosen
 * knowingly: a paste or a clip is a one-off gesture at a few hundred KB, and the alternative — a raw
 * request body with the id in a header — trades a measurable millisecond for an exotic call shape.
 * Reads come back through `tauri::ipc::Response`, which is the efficient path and the one that
 * matters, because a page with six clips reads them on every open.
 */
export const nbAssetPut = (id: string, bytes: Uint8Array) =>
  invoke<string>('nb_asset_put', { id, bytes: Array.from(bytes) });

export const nbAssetLoad = (id: string, sha: string) =>
  invoke<ArrayBuffer>('nb_asset_load', { id, sha });

export const nbStat = (id: string) => invoke<NbStat>('nb_stat', { id });

/**
 * Copy one notebook to `<app data>\exports\<name>`, returning where it landed. Same shape and the
 * same one-segment validation as `state_export`: the frontend words the name, Rust owns the location.
 */
export const nbExport = (id: string, name: string) => invoke<string>('nb_export', { id, name });
