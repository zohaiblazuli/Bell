/**
 * pdf.js access — one place, loaded on demand.
 *
 * pdf.js is the largest thing in the bundle and nothing on the library screen needs it, so it
 * is dynamically imported. Its standard fonts and CMaps are vendored under `public/pdfjs/`
 * rather than fetched from a CDN: the app has to render papers with the network unplugged.
 */

import type * as PdfJs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

/** Rows on the same printed line can differ by a fraction of a point. */
const Y_TOLERANCE = 2.2;

const DOC_OPTIONS = {
  standardFontDataUrl: '/pdfjs/standard_fonts/',
  cMapUrl: '/pdfjs/cmaps/',
  cMapPacked: true,
};

let loaded: typeof PdfJs | null = null;

async function pdfjs(): Promise<typeof PdfJs> {
  if (!loaded) {
    const [mod, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);
    mod.GlobalWorkerOptions.workerSrc = worker.default;
    loaded = mod;
  }
  return loaded;
}

export interface OpenDoc {
  doc: PDFDocumentProxy;
  /** v6 hangs teardown off the loading task, not the document proxy. */
  close: () => Promise<void>;
}

export async function openPdf(data: Uint8Array): Promise<OpenDoc> {
  const lib = await pdfjs();
  const task = lib.getDocument({ data, ...DOC_OPTIONS });
  const doc = await task.promise;
  return { doc, close: () => task.destroy() };
}

export interface RenderedSize {
  cssWidth: number;
  cssHeight: number;
}

/**
 * Draw one page into `canvas` at `targetCssWidth` logical pixels wide, backed at the display's
 * real pixel density so text stays crisp when zoomed.
 */
export async function renderPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  targetCssWidth: number,
): Promise<RenderedSize> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = targetCssWidth / base.width;
  const dpr = window.devicePixelRatio || 1;
  const viewport = page.getViewport({ scale: scale * dpr });

  const cssWidth = Math.round(base.width * scale);
  const cssHeight = Math.round(base.height * scale);
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  await page.render({ canvas, viewport }).promise;
  page.cleanup();
  return { cssWidth, cssHeight };
}

/** Extract every page's text as reconstructed lines, top to bottom. */
export async function pdfTextLines(data: Uint8Array): Promise<string[]> {
  const { doc, close } = await openPdf(data);
  const lines: string[] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      lines.push(...linesFromItems(content.items as TextItem[]));
      page.cleanup();
    }
  } finally {
    await close();
  }
  return lines;
}

/**
 * Group positioned runs into lines by y, then order each line by x.
 *
 * The scambridge threshold parser was written against `pdf-parse`'s line-per-row text; pdf.js
 * hands back positioned glyph runs instead, so the lines have to be rebuilt before the row
 * regex can see a "Component 11 75 50 43 33 23 14" row.
 */
export function linesFromItems(items: TextItem[]): string[] {
  const rows: { y: number; parts: { x: number; str: string }[] }[] = [];

  for (const item of items) {
    if (!item.str || !item.str.trim()) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    let row = rows.find((r) => Math.abs(r.y - y) <= Y_TOLERANCE);
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x, str: item.str });
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) =>
      r.parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.str)
        .join(' ')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    )
    .filter(Boolean);
}
