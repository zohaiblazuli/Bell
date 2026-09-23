/**
 * One-off scout: dump the text of a local 9702 Paper 3 QP or MS so we can
 * author a simulator exam from the real question + mark scheme.
 *
 *   node scripts/run.mjs scout-exam.ts "G:\\path\\to\\9702_s22_qp_31.pdf"
 *
 * Uses the same legacy pdf.js entry the paper verifier does, so no poppler.
 */

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFileSync } from 'node:fs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

const Y_TOLERANCE = 2.2;

function linesFromItems(items: TextItem[]): string[] {
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

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: node scripts/run.mjs scout-exam.ts <file.pdf>');
    process.exit(2);
  }
  const bytes = new Uint8Array(readFileSync(path));
  const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;
  console.log(`=== ${path} (${doc.numPages} pages) ===\n`);
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const lines = linesFromItems(content.items as TextItem[]);
    console.log(`----- page ${n} -----`);
    console.log(lines.join('\n'));
    console.log('');
    page.cleanup();
  }
  await doc.cleanup();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
