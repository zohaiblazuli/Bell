/**
 * Reading "Component" rows out of a grade-threshold PDF's text.
 *
 * Ported from `C:\scambridge\pipeline\threshold-rows.ts`. One deliberate change: the original
 * validated the component against a hand-maintained allowlist of the subjects that app
 * ingested. Bell indexes the whole library, so an allowlist would reject valid rows —
 * the structural checks below (two digits, plausible max mark, plausible A%) do the work.
 */

// "Component 11 75 50 43 33 23 14"  ->  Component | MaxMark | A B C D E
// There is no component-level A* in any Cambridge subject.
const ROW_REGEX = /^Component\s+(\d{2})\s+(\d+)\s+(\d+)/;

const GRADE_COLUMNS = 5;
export const GRADE_NAMES = ['A', 'B', 'C', 'D', 'E'] as const;

export interface ComponentRow {
  raw: string;
  component: string;
  totalMarks: number;
  aThreshold: number;
  aPct: number | null;
  /** Full A–E curve; null entries were missing or failed validation. */
  grades: Array<number | null>;
  fullCurve: boolean;
  curveWarning?: string;
  accepted: boolean;
  rejectReason?: string;
}

export function toLines(pdfText: string): string[] {
  return pdfText
    .split('\n')
    .map((l) => l.replace(/\t/g, ' ').replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean);
}

export function parseComponentRows(lines: string[]): ComponentRow[] {
  const rows: ComponentRow[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (!ROW_REGEX.test(line)) continue;

    const parts = line.split(/\s+/);
    const component = parts[1];
    const totalMarks = parseInt(parts[2], 10);
    const aThreshold = parseInt(parts[3], 10);
    const aPct = totalMarks > 0 ? (aThreshold / totalMarks) * 100 : null;

    let rejectReason: string | undefined;
    if (parts.length < 4) rejectReason = 'too few columns';
    else if (Number.isNaN(totalMarks) || Number.isNaN(aThreshold))
      rejectReason = 'unparseable numbers';
    else if (totalMarks < 20 || totalMarks > 200)
      rejectReason = `max mark ${totalMarks} out of range (20–200)`;
    else if (aThreshold > totalMarks || aThreshold < 1)
      rejectReason = `A threshold ${aThreshold} out of range`;
    else if (aPct === null || aPct < 30 || aPct > 100)
      rejectReason = `A% ${aPct?.toFixed(1)} out of range (30–100)`;
    else if (seen.has(component)) rejectReason = 'duplicate (kept first occurrence)';

    const accepted = !rejectReason;
    if (accepted) seen.add(component);

    // Monotonic-descending validation: once a boundary is missing or out of order, that
    // grade and everything below it is dropped rather than trusted.
    const grades: Array<number | null> = [];
    let previous = Number.POSITIVE_INFINITY;
    let broken = false;
    let curveWarning: string | undefined;

    for (let g = 0; g < GRADE_COLUMNS; g++) {
      const rawValue = parts[3 + g];
      const value = rawValue != null ? parseInt(rawValue, 10) : NaN;

      if (Number.isNaN(value)) {
        grades.push(null);
        if (!broken && g > 0) curveWarning = `${GRADE_NAMES[g]} onwards missing from the row`;
        broken = true;
        continue;
      }
      if (broken || value >= previous || value < 0 || value > totalMarks) {
        grades.push(null);
        if (!broken) {
          curveWarning =
            value >= previous
              ? `${GRADE_NAMES[g]} (${value}) not below ${GRADE_NAMES[g - 1]} (${previous}) — curve dropped from here`
              : `${GRADE_NAMES[g]} (${value}) out of range — curve dropped from here`;
        }
        broken = true;
        continue;
      }
      grades.push(value);
      previous = value;
    }

    rows.push({
      raw: line,
      component,
      totalMarks,
      aThreshold,
      aPct,
      grades,
      fullCurve: grades.every((g) => g != null),
      curveWarning,
      accepted,
      rejectReason,
    });
  }

  return rows;
}
