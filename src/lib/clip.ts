/**
 * Clipping a region of a paper into a notebook, and dropping an image onto a page.
 *
 * Spec: `design/specs/screen-notebooks.md` §5d — page 12 carries a `clipping 9702 s25 P4 Q3` frame
 * with a `Mono/Small` caption under it, drawn as the thing this module produces.
 *
 * THIS IS THE ROUTE THAT NEEDS NOTHING. No OS capture API, no new plugin, no new permission: the
 * paper is already a rendered `<canvas>` in this webview, so a marquee plus `drawImage` plus
 * `toBlob` is the whole mechanism. The CSP already allows `img-src 'self' data: blob:`. It is also
 * the reason a student wants a notebook open next to a paper at all, which is why it was built
 * before the shelf rather than after the motion.
 *
 * The two other image routes are here too, because they end in the same place: Ctrl+V (which needs
 * nothing either) and drag-and-drop. `dragDropEnabled` MUST be false in `tauri.conf.json`: when it is
 * true, Tauri's webview swallows the OS drop and the DOM `drop` event never receives the file, so the
 * handler in `NotebookView` gets an empty `dataTransfer` and nothing lands. False lets the standard
 * HTML5 drop through to `imageFrom`, the same path Ctrl+V already uses.
 */

import {
  PAGE_H,
  PAGE_PAD_X,
  PAGE_PAD_Y,
  PAGE_W,
  emptyPage,
  nbAssetLoad,
  nbAssetPut,
  nbPageLoad,
  nbPageSave,
  pageBottom,
  q4,
  type NbObject,
  type NbPage,
} from './notebooks';

/** A rect in fractions of the source canvas, as the marquee reports it. */
export interface ClipRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Longest edge of a stored clip, in pixels.
 *
 * A paper rendered at 2.1x zoom on a 2x display is ~3000px wide, and a full-page clip at that size
 * is several megabytes of PNG for something that will be drawn 340px wide. 1600 keeps a clipped
 * exam question sharp at every zoom the notebook offers while landing well inside the size cap Rust
 * enforces, and it is the one number to change if clips ever look soft.
 */
const MAX_CLIP_PX = 1600;

/**
 * Composite the given layers, cropped to `rect`, into a PNG.
 *
 * Layers are drawn in order, so passing `[page, ink]` clips what the student is actually looking at
 * rather than the bare PDF. That is the right default: if they highlighted the question, the
 * highlight is part of why they are keeping it.
 *
 * Every layer is assumed to cover the same logical box; sizes are taken from the first one, which is
 * the PDF canvas rendered at device pixel density.
 */
export async function cropLayers(layers: HTMLCanvasElement[], rect: ClipRect): Promise<Blob> {
  const src = layers[0];
  if (!src || src.width < 1 || src.height < 1) throw new Error('nothing to clip');

  // Sized off the first layer, which is the PDF canvas at device pixel density — so a clip is as
  // sharp as what is on screen rather than as sharp as the CSS box.
  const sw = Math.max(1, Math.round(rect.w * src.width));
  const sh = Math.max(1, Math.round(rect.h * src.height));

  const scale = Math.min(1, MAX_CLIP_PX / Math.max(sw, sh));
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(sw * scale));
  out.height = Math.max(1, Math.round(sh * scale));

  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('no 2d context for the clip');
  // The paper is white and the ink layer is transparent, so without this a clip of a margin would
  // come out with a transparent background and read as a hole once it is on a notebook page.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  for (const layer of layers) {
    if (layer.width < 1 || layer.height < 1) continue;
    // Each layer may be a different pixel size (the ink canvas is sized from its CSS box), so the
    // source rect is recomputed per layer rather than reused.
    ctx.drawImage(
      layer,
      rect.x * layer.width,
      rect.y * layer.height,
      Math.max(1, rect.w * layer.width),
      Math.max(1, rect.h * layer.height),
      0,
      0,
      out.width,
      out.height,
    );
  }

  return await new Promise<Blob>((resolve, reject) => {
    out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('the clip could not be encoded'))), 'image/png');
  });
}

/** A PNG's intrinsic size, needed to keep the placed object's aspect honest. */
async function measure(blob: Blob): Promise<{ w: number; h: number }> {
  const bitmap = await createImageBitmap(blob);
  const size = { w: bitmap.width, h: bitmap.height };
  bitmap.close();
  return size;
}

export interface Placed {
  /** Where it actually landed — which is not always the page that was asked for. */
  page: number;
  sha: string;
}

/**
 * Store an image, then decide which page it goes on and how big it is — WITHOUT writing the page.
 *
 * The placement rule is "below whatever is already there": the object is left-aligned to the page's
 * ink box, sized to 70% of the page width, and dropped under the lowest existing mark. If it will
 * not fit, it goes to the top of the NEXT page — which is the infinite-pages promise doing something
 * useful rather than merely being true. `page` is a disk index; the caller labels it.
 *
 * `read` answers what is already on a page. The open notebook passes a reader that prefers its own
 * in-memory copy, because that copy can hold strokes the 400ms save debounce has not flushed yet, and
 * placing against the file would put the image on top of them. `placeImage` passes a plain file read,
 * which is right for its case: a Reader clip goes to a notebook nobody has open.
 */
export async function planImage(
  notebook: string,
  page: number,
  blob: Blob,
  read: (index: number) => Promise<NbPage>,
  opts: { widthFraction?: number } = {},
): Promise<{ page: number; object: NbObject; sha: string }> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const [sha, size] = await Promise.all([nbAssetPut(notebook, bytes), measure(blob)]);

  const w = opts.widthFraction ?? 0.7;
  // The page box is taller than it is wide, so a fraction of the width and a fraction of the height
  // are different units. Converting through the real 455 x 644 box is what stops a square clip
  // rendering as a portrait rectangle.
  const h = (w * (size.h / size.w) * PAGE_W) / PAGE_H;

  let target = page;
  let doc = await read(target);
  let top = Math.max(PAGE_PAD_Y, pageBottom(doc) + 0.02);
  if (top + h > 1 - PAGE_PAD_Y) {
    target = page + 1;
    doc = await read(target);
    top = Math.max(PAGE_PAD_Y, pageBottom(doc) + 0.02);
  }

  return {
    page: target,
    sha,
    object: {
      id: `img-${sha.slice(0, 8)}-${Date.now().toString(36)}`,
      k: 'img',
      sha,
      x: q4(PAGE_PAD_X),
      y: q4(top),
      w: q4(Math.min(w, 1 - 2 * PAGE_PAD_X)),
      h: q4(Math.min(h, 1 - PAGE_PAD_Y - top)),
    },
  };
}

/** Read one page straight off disk. A file that will not parse reads as blank, so a damaged page is
 *  left alone and the clip goes on the next one rather than overwriting whatever is in there. */
async function readFromDisk(notebook: string, index: number): Promise<NbPage> {
  const json = await nbPageLoad(notebook, index);
  if (!json) return emptyPage();
  try {
    return JSON.parse(json) as NbPage;
  } catch {
    return emptyPage();
  }
}

/**
 * `planImage`, then write the page.
 *
 * The read-modify-write is why this one is only for a notebook that is NOT open: a page the student is
 * drawing on has a copy in memory that this cannot see, and rereading the file afterwards to pick the
 * object up would drop anything drawn in between. The Reader's clip is exactly that case — it targets
 * a notebook on the shelf — and the open notebook uses `planImage` plus its own command stack instead.
 */
export async function placeImage(
  notebook: string,
  page: number,
  blob: Blob,
  opts: { widthFraction?: number } = {},
): Promise<Placed> {
  const read = (index: number) => readFromDisk(notebook, index);
  const { page: target, object, sha } = await planImage(notebook, page, blob, read, opts);
  const doc = await read(target);
  await nbPageSave(notebook, target, JSON.stringify({ ...doc, objects: [...doc.objects, object] }));
  return { page: target, sha };
}

/**
 * The first image on a clipboard or drop payload, or null.
 *
 * Win+Shift+S puts a PNG on the clipboard, which is what makes Ctrl+V cover literal screenshots
 * with no capture code of our own. `DataTransfer.files` is checked before `items` because a paste
 * from Snipping Tool exposes the bitmap as a file, while a paste from a browser exposes it as an
 * item with no name.
 */
export function imageFrom(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const file of Array.from(data.files)) {
    if (file.type.startsWith('image/')) return file;
  }
  for (const item of Array.from(data.items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}

/**
 * Re-encode any image to PNG, and hold it to `MAX_CLIP_PX`.
 *
 * Rust stores assets under a `.png` name and magic-byte validates them, so a pasted JPEG or WebP has
 * to be converted rather than renamed. Doing it here keeps that guarantee cheap to hold: everything
 * on disk really is a PNG.
 *
 * **A PNG is measured too, not waved through.** Win+Shift+S puts a PNG on the clipboard, so the
 * commonest paste in the product arrives already in the target format — and a 4K screenshot is several
 * megabytes that would go out as a JSON number array (four bytes of IPC per byte of image) and be
 * stored at full resolution to be drawn 320px wide. The cap applies to every route or it caps nothing.
 */
export async function toPng(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_CLIP_PX / Math.max(bitmap.width, bitmap.height));
  if (file.type === 'image/png' && scale === 1) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('no 2d context');
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('could not re-encode'))), 'image/png');
  });
}

/** An object URL for a stored asset. Callers must revoke it; `NotebookPage` owns a small cache. */
export async function assetUrl(notebook: string, sha: string): Promise<string> {
  const bytes = await nbAssetLoad(notebook, sha);
  return URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
}
