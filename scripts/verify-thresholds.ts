/**
 * Validates the ported threshold parser against the real `gt` PDFs on G:, without the app.
 *
 *   node scripts/verify-thresholds.ts            # 9709 in full, plus a spread of others
 *   node scripts/verify-thresholds.ts 9702 40    # one subject, cap the sample
 *
 * The plan flagged this as the known integration risk: the parser was written for
 * PapaCambridge PDFs read through `pdf-parse`, and here the same official CAIE documents are
 * read with pdf.js. Run this before trusting any difficulty score.
 */

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// The legacy build is the one that runs outside a browser.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

import { linesFromItems } from '../src/lib/pdf.ts';
import { parseComponentRows } from '../src/lib/thresholdRows.ts';

const ROOT = process.argv[4] ?? 'G:\\CambridgeDatabase';
const LEVELS = ['A Level', 'IGCSE', 'O Level'];
const focus = process.argv[2] ?? '9709';
const cap = Number(process.argv[3] ?? 60);

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
    else if (/_gt\.pdf$/i.test(name)) out.push(full);
  }
  return out;
}

const all: string[] = [];
for (const level of LEVELS) walk(join(ROOT, level), all);
console.log(`${all.length} grade-threshold PDFs on disk\n`);

const focused = all.filter((p) => p.includes(`\\${focus}_`) || p.includes(`(${focus})`));
const others = all.filter((p) => !focused.includes(p));
const sample = [...focused, ...spread(others, Math.max(0, cap - focused.length))].slice(
  0,
  Math.max(cap, focused.length),
);

let ok = 0;
let failed = 0;
let accepted = 0;
let rejected = 0;
let fullCurves = 0;
const rejectReasons = new Map<string, number>();
const noRows: string[] = [];

for (const file of sample) {
  let rows;
  try {
    rows = parseComponentRows(await lines(file));
  } catch (e) {
    failed++;
    console.log(`  FAIL ${file.split('\\').pop()}: ${String(e)}`);
    continue;
  }
  ok++;
  if (rows.length === 0) noRows.push(file.split('\\').pop()!);
  for (const r of rows) {
    if (r.accepted) {
      accepted++;
      if (r.fullCurve) fullCurves++;
    } else {
      rejected++;
      const key = r.rejectReason ?? 'unknown';
      rejectReasons.set(key, (rejectReasons.get(key) ?? 0) + 1);
    }
  }
}

console.log(`sample: ${sample.length} PDFs (${focused.length} matching "${focus}")`);
console.log(`read:   ${ok} ok · ${failed} failed`);
console.log(`rows:   ${accepted} accepted (${fullCurves} with a full A–E curve) · ${rejected} rejected`);
if (rejectReasons.size) {
  console.log('reject reasons:');
  for (const [reason, n] of [...rejectReasons].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${reason}`);
  }
}
if (noRows.length) console.log(`\nno component rows found in ${noRows.length}: ${noRows.slice(0, 6).join(', ')}`);

// Show one file in full so the shape is inspectable by eye.
const showcase = focused[0] ?? sample[0];
if (showcase) {
  console.log(`\n--- ${showcase}`);
  for (const r of parseComponentRows(await lines(showcase))) {
    const curve = r.grades.map((g) => (g == null ? '–' : String(g))).join(' ');
    console.log(
      `  ${r.accepted ? 'OK ' : 'rej'} component ${r.component}  max ${String(r.totalMarks).padStart(3)}  A–E ${curve}` +
        (r.rejectReason ? `   (${r.rejectReason})` : '') +
        (r.curveWarning ? `   [${r.curveWarning}]` : ''),
    );
  }
}

async function lines(file: string): Promise<string[]> {
  const task = pdfjs.getDocument({ url: pathToFileURL(file).href });
  const out: string[] = [];
  try {
    const doc = await task.promise;
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      out.push(...linesFromItems(content.items as never));
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return out;
}

/** Evenly spaced picks, so the sample isn't all one subject. */
function spread<T>(items: T[], n: number): T[] {
  if (n <= 0 || items.length === 0) return [];
  if (items.length <= n) return items;
  const step = items.length / n;
  return Array.from({ length: n }, (_, i) => items[Math.floor(i * step)]);
}
