/**
 * Opens a spread of real question papers to confirm they load and page-count correctly.
 *
 *   node scripts/run.mjs verify-papers.ts          # ~40 papers across the library
 *   node scripts/run.mjs verify-papers.ts 9709 20  # one subject
 *
 * Canvas rendering itself needs a browser, so this checks everything up to that point: the
 * document opens, pages resolve, and the viewport has sane dimensions. It also surfaces files
 * that are corrupt on disk, the way `0610_s19_gt.pdf` is.
 */

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const ROOT = 'G:\\CambridgeDatabase';
const LEVELS = ['A Level', 'IGCSE', 'O Level'];
const focus = process.argv[2] ?? 'all';
const cap = Number(process.argv[3] ?? 40);

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (/_qp_\d+\.pdf$/i.test(name)) out.push(full);
  }
  return out;
}

const all = LEVELS.flatMap((l) => walk(join(ROOT, l))).filter(
  (p) => focus === 'all' || p.includes(`\\${focus}_`),
);
const step = Math.max(1, Math.floor(all.length / cap));
const sample = all.filter((_, i) => i % step === 0).slice(0, cap);

console.log(`${all.length} question papers matched; opening ${sample.length}\n`);

let ok = 0;
let pages = 0;
const failures: string[] = [];

for (const file of sample) {
  const name = file.split('\\').pop()!;
  const task = pdfjs.getDocument({ url: pathToFileURL(file).href });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const vp = page.getViewport({ scale: 1 });
    if (!(vp.width > 100 && vp.height > 100)) throw new Error(`odd page box ${vp.width}x${vp.height}`);
    ok++;
    pages += doc.numPages;
    if (ok <= 6) {
      console.log(
        `  ${name.padEnd(22)} ${String(doc.numPages).padStart(2)} pages  ${Math.round(vp.width)}x${Math.round(vp.height)}pt`,
      );
    }
    page.cleanup();
  } catch (e) {
    failures.push(`${name}: ${(e as Error).message ?? String(e)}`);
  } finally {
    await task.destroy();
  }
}

console.log(`\nopened ${ok}/${sample.length} · ${pages} pages total`);
if (failures.length) {
  console.log(`${failures.length} failed:`);
  for (const f of failures.slice(0, 10)) console.log(`  ${f}`);
} else {
  console.log('no unreadable papers in the sample');
}
