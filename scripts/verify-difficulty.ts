/**
 * Checks the ported difficulty engine against the original, over the real library.
 *
 *   node scripts/verify-difficulty.ts            # 9709 A-Level Maths
 *   node scripts/verify-difficulty.ts 9702       # any subject code
 *
 * Two things are verified:
 *   1. Faithfulness — for every real sitting, the ported formula and
 *      `C:\scambridge\lib\difficulty-formula.ts` must return an identical score and band from
 *      identical inputs. Any drift is a port bug.
 *   2. Calibration health — the original's own comment says a healthy distribution has p25
 *      near 25 and p75 near 75, with no pile-up at the ends. Printed below.
 */

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

// The port under test.
import { computeHardness, computeMetrics } from '../src/lib/difficultyFormula.ts';
import { boundariesFor, referenceFor, scoreSittings, type Sitting } from '../src/lib/scoreSittings.ts';
import { linesFromItems } from '../src/lib/pdf.ts';
import { parseComponentRows } from '../src/lib/thresholdRows.ts';

// The original, imported straight out of the web app.
import * as orig from '../../scambridge/lib/difficulty-formula.ts';

const ROOT = 'G:\\CambridgeDatabase';
const LEVELS = ['A Level', 'IGCSE', 'O Level'];
const focus = process.argv[2] ?? '9709';

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

const files = LEVELS.flatMap((l) => walk(join(ROOT, l))).filter(
  (p) => focus === 'all' || p.includes(`\\${focus}_`),
);
console.log(`${files.length} grade-threshold PDFs for ${focus}\n`);

// Subjects are their own reference class, so each code needs a distinct id.
const subjectIds = new Map<string, number>();
const subjectId = (code: string) => {
  if (!subjectIds.has(code)) subjectIds.set(code, subjectIds.size + 1);
  return subjectIds.get(code)!;
};

const sittings: Sitting[] = [];
const unreadable: string[] = [];
for (const file of files) {
  const name = file.split('\\').pop()!;
  const match = /^(\d{4})_(([smw])\d{2})_gt\.pdf$/i.exec(name);
  if (!match) continue;
  const [, code, scode] = match;
  let parsed;
  try {
    parsed = parseComponentRows(await lines(file));
  } catch (e) {
    unreadable.push(`${name}: ${(e as Error).message ?? String(e)}`);
    continue;
  }
  for (const row of parsed) {
    if (!row.accepted) continue;
    sittings.push({
      subjectId: subjectId(code),
      scode: scode.toLowerCase(),
      component: row.component,
      totalMarks: row.totalMarks,
      grades: row.grades,
    });
  }
}
console.log(`${sittings.length} component sittings parsed across ${subjectIds.size} subject(s)`);
if (unreadable.length) {
  console.log(`${unreadable.length} unreadable PDF(s):`);
  for (const u of unreadable.slice(0, 10)) console.log(`  ${u}`);
}

// --- 1. faithfulness --------------------------------------------------------
const { rows, byBasis } = scoreSittings(sittings);
const index = new Map(rows.map((r) => [`${r.subjectId}/${r.scode}/${r.component}`, r]));

// referenceFor rebuilds a reference class per call, so cap the comparison when the whole
// library is in play. Scoring above still covers every sitting.
const CHECK_CAP = 500;
const step = Math.max(1, Math.ceil(sittings.length / CHECK_CAP));
const checked = sittings.filter((_, i) => i % step === 0);

let compared = 0;
let mismatches = 0;
for (const s of checked) {
  const { reference, basis } = referenceFor(sittings, s);
  const b = boundariesFor(s);

  const mine = computeHardness(b, reference, basis);
  const theirs = orig.computeHardness(b, reference, basis);
  const m1 = computeMetrics(b);
  const m2 = orig.computeMetrics(b);

  compared++;
  const same =
    mine.score === theirs.score &&
    mine.difficulty === theirs.difficulty &&
    near(m1.aPct, m2.aPct) &&
    near(m1.curveMeanPct, m2.curveMeanPct) &&
    near(m1.spanPct, m2.spanPct);

  if (!same && mismatches < 6) {
    mismatches++;
    console.log(
      `  MISMATCH ${s.scode}/${s.component}: port ${mine.score}/${mine.difficulty} vs original ${theirs.score}/${theirs.difficulty}`,
    );
  } else if (!same) {
    mismatches++;
  }
}
console.log(
  `\nfaithfulness: ${compared - mismatches}/${compared} sittings identical to the original` +
    (mismatches ? ` — ${mismatches} MISMATCHES` : ' ✓'),
);
console.log(`basis mix: ${JSON.stringify(byBasis)}`);

// --- 2. calibration ---------------------------------------------------------
const scores = rows.map((r) => r.score).sort((a, b) => a - b);
const pct = (p: number) => scores[Math.min(scores.length - 1, Math.floor((p / 100) * scores.length))];
console.log(
  `\nscore distribution: min ${scores[0]} · p25 ${pct(25)} · median ${pct(50)} · p75 ${pct(75)} · max ${scores[scores.length - 1]}`,
);
const bands = rows.reduce<Record<string, number>>((acc, r) => {
  acc[r.band] = (acc[r.band] ?? 0) + 1;
  return acc;
}, {});
console.log(`bands: ${JSON.stringify(bands)}`);

// --- a readable sample ------------------------------------------------------
const showCode = focus === 'all' ? '9709' : focus;
const showId = subjectIds.get(showCode);
if (showId != null) {
  console.log(`\nnewest sittings of ${showCode}`);
  const mine = sittings.filter((s) => s.subjectId === showId);
  const newest = [...new Set(mine.map((s) => s.scode))]
    .sort((a, b) =>
      a.slice(1) === b.slice(1) ? a.localeCompare(b) : b.slice(1).localeCompare(a.slice(1)),
    )
    .slice(0, 2);
  for (const scode of newest) {
    for (const s of mine.filter((x) => x.scode === scode).slice(0, 8)) {
      const r = index.get(`${s.subjectId}/${s.scode}/${s.component}`)!;
      const aPct = ((s.grades[0] as number) / s.totalMarks) * 100;
      console.log(
        `  ${scode} /${s.component}  A ${String(s.grades[0]).padStart(3)}/${String(s.totalMarks).padEnd(3)} = ${aPct.toFixed(1).padStart(5)}%  score ${String(r.score).padStart(3)}  ${r.band}`,
      );
    }
  }
}

function near(a: number | null, b: number | null): boolean {
  if (a == null || b == null) return a === b;
  return Math.abs(a - b) < 1e-9;
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
