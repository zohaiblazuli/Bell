import { daysUntil, nextWindow, windowForCode, type ExamWindow, type Season } from '@/lib/sessions';
import type { RecentEntry, SetName } from '@/lib/store';
import type { PaperRow, Subject } from '@/lib/types';

/**
 * The study facts Home shows and Hush quotes: the focus streak, the sitting being counted down to,
 * and the subjects ranked furthest behind first. One implementation, so Hush can never say "day 9"
 * while Home's rail reads 8.
 */

export const DAY_MS = 86_400_000;

const pad2 = (n: number) => String(n).padStart(2, '0');
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const midday = (d: Date, offsetDays = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetDays, 12);
export const parseIso = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

/** The days whose focus log reached the streak floor (`settings.streakMinutes`, at least one). */
export function countedDays(days: Record<string, number>, streakMinutes: number): Set<string> {
  const floor = Math.max(1, streakMinutes);
  return new Set(Object.entries(days).filter(([, m]) => m >= floor).map(([d]) => d));
}

/**
 * The current run is anchored on today, or on yesterday if today has not been counted YET, so the
 * streak does not read zero every morning. The longest run walks the sorted dates once.
 */
export function streaksOf(active: Set<string>, clock: Date): { current: number; longest: number } {
  let current = 0;
  for (let i = active.has(isoOf(clock)) ? 0 : 1; i < 4000; i += 1) {
    if (!active.has(isoOf(midday(clock, -i)))) break;
    current += 1;
  }
  let longest = 0;
  let run = 0;
  let previous = 0;
  for (const date of [...active].sort()) {
    const at = parseIso(date).getTime();
    run = previous && Math.round((at - previous) / DAY_MS) === 1 ? run + 1 : 1;
    previous = at;
    longest = Math.max(longest, run);
  }
  return { current, longest };
}

/**
 * The sitting the countdown is for. Onboarding's target session wins while it is still ahead
 * (`daysUntil` is >= 0 from the sitting's first day through its last); once it has passed, or was
 * never chosen, fall back to the next series the student sits.
 */
export function sittingFor(clock: Date, targetCode: string | null, seasons?: Season[]): ExamWindow | null {
  const target = targetCode ? windowForCode(targetCode) : null;
  return target && daysUntil(clock, target) >= 0 ? target : nextWindow(clock, seasons);
}

export const codeOf = (key: string) => key.split('/')[0] ?? '';

export interface SubjectStanding {
  code: string;
  id: number | null;
  name: string;
  pct: number;
}

/**
 * The student's subjects, furthest behind first: share of the catalogue's papers marked done. Their
 * onboarding subjects if they chose any; failing that, anything they have touched.
 */
export function rankSubjects(input: {
  subjects: Subject[];
  marks: Record<SetName, Set<string>>;
  recent: RecentEntry[];
  rows: Record<string, PaperRow>;
  chosen: string[];
}): SubjectStanding[] {
  const { subjects, marks, recent, rows, chosen } = input;
  const indexed = new Map<string, { id: number; name: string; papers: number }>();
  for (const s of subjects) {
    const seen = indexed.get(s.code);
    if (seen) seen.papers += s.papers;
    else indexed.set(s.code, { id: s.id, name: s.name, papers: s.papers });
  }
  const doneBy = new Map<string, number>();
  for (const key of marks.done) doneBy.set(codeOf(key), (doneBy.get(codeOf(key)) ?? 0) + 1);

  const codes = new Set(chosen);
  if (codes.size === 0) {
    for (const set of [marks.done, marks.revision, marks.bookmarks]) for (const key of set) codes.add(codeOf(key));
    for (const entry of recent) codes.add(codeOf(entry.key));
  }
  codes.delete('');

  const named = new Map<string, string>();
  for (const row of Object.values(rows)) named.set(row.subjectCode, row.subjectName);

  const list = [...codes].map((code) => {
    const index = indexed.get(code);
    const done = doneBy.get(code) ?? 0;
    const total = index?.papers ?? 0;
    return {
      code,
      id: index?.id ?? null,
      name: index?.name ?? named.get(code) ?? code,
      pct: total ? Math.round((done / total) * 100) : 0,
    };
  });
  list.sort((a, b) => a.pct - b.pct || a.name.localeCompare(b.name));
  return list;
}
