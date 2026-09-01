/**
 * Parses every grade-threshold PDF in the index, then scores every component sitting.
 *
 * Runs entirely in the webview: pdf.js reads the `gt` files straight off the read-only library
 * through Tauri's asset protocol, the ported parser turns them into boundary rows, and the
 * ported formula scores them. Results are written back to SQLite through the Rust seams.
 */

import { listThresholdDocs, readDocument, saveDifficulty, saveThresholds } from './api';
import { pdfTextLines } from './pdf';
import { scoreSittings, type Sitting } from './scoreSittings';
import { parseComponentRows } from './thresholdRows';
import type { ThresholdRow } from './types';

const GRADES = ['A', 'B', 'C', 'D', 'E'] as const;
const PARSE_CONCURRENCY = 4;
const SAVE_BATCH = 800;

export interface BuildProgress {
  phase: 'parsing' | 'scoring' | 'saving';
  done: number;
  total: number;
  current: string;
}

export interface BuildResult {
  docs: number;
  parsedDocs: number;
  failedDocs: number;
  failures: string[];
  thresholdRows: number;
  scored: number;
  byBasis: Record<string, number>;
}

export async function buildDifficulty(
  onProgress: (p: BuildProgress) => void,
): Promise<BuildResult> {
  const docs = await listThresholdDocs();
  const sittings: Sitting[] = [];
  const failures: string[] = [];
  let parsedDocs = 0;
  let attempted = 0;

  await pool(docs, PARSE_CONCURRENCY, async (doc) => {
    try {
      const lines = await pdfTextLines(new Uint8Array(await readDocument(doc.path)));
      for (const row of parseComponentRows(lines)) {
        if (!row.accepted) continue;
        sittings.push({
          subjectId: doc.subjectId,
          scode: doc.scode,
          component: row.component,
          totalMarks: row.totalMarks,
          grades: row.grades,
        });
      }
      parsedDocs++;
    } catch (e) {
      if (failures.length < 8) failures.push(`${doc.subjectCode} ${doc.scode}: ${String(e)}`);
    } finally {
      attempted++;
      onProgress({
        phase: 'parsing',
        done: attempted,
        total: docs.length,
        current: `${doc.subjectCode} ${doc.scode}`,
      });
    }
  });

  // --- write the boundaries -------------------------------------------------
  const thresholdRows: ThresholdRow[] = [];
  for (const s of sittings) {
    s.grades.forEach((mark, i) => {
      if (mark == null) return;
      thresholdRows.push({
        subjectId: s.subjectId,
        scode: s.scode,
        component: s.component,
        maxMark: s.totalMarks,
        grade: GRADES[i],
        mark,
      });
    });
  }
  for (let i = 0; i < thresholdRows.length; i += SAVE_BATCH) {
    await saveThresholds(thresholdRows.slice(i, i + SAVE_BATCH));
    onProgress({
      phase: 'saving',
      done: Math.min(i + SAVE_BATCH, thresholdRows.length),
      total: thresholdRows.length,
      current: 'grade thresholds',
    });
  }

  // --- score ---------------------------------------------------------------
  onProgress({ phase: 'scoring', done: 0, total: sittings.length, current: 'building references' });
  const { rows, byBasis } = scoreSittings(sittings);

  for (let i = 0; i < rows.length; i += SAVE_BATCH) {
    await saveDifficulty(rows.slice(i, i + SAVE_BATCH));
    onProgress({
      phase: 'saving',
      done: Math.min(i + SAVE_BATCH, rows.length),
      total: rows.length,
      current: 'difficulty scores',
    });
  }

  return {
    docs: docs.length,
    parsedDocs,
    failedDocs: failures.length,
    failures,
    thresholdRows: thresholdRows.length,
    scored: rows.length,
    byBasis,
  };
}

/** Run `work` over `items` with a fixed number of workers in flight. */
async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await work(item);
    }
  });
  await Promise.all(workers);
}
