/**
 * The pure scoring pass: sittings in, difficulty rows out.
 *
 * Kept free of any Tauri import so it can be run head-less against the real library — see
 * `scripts/verify-difficulty.ts`. Reference classes are assembled exactly as the web app's
 * batch pass does (a paper is included in its own component's reference), so scores stay
 * comparable with scambridge.
 */

import {
  buildReference,
  chooseBasis,
  computeHardness,
  computeMetrics,
  type PaperMetrics,
  type Reference,
} from './difficultyFormula';
import type { DifficultyRow } from './types';

export interface Sitting {
  subjectId: number;
  scode: string;
  component: string;
  totalMarks: number;
  /** A–E raw marks; null where the curve was dropped. */
  grades: Array<number | null>;
}

export const boundariesFor = (s: Sitting) => ({
  totalMarks: s.totalMarks,
  aThreshold: s.grades[0] as number,
  bThreshold: s.grades[1] ?? null,
  cThreshold: s.grades[2] ?? null,
  dThreshold: s.grades[3] ?? null,
  eThreshold: s.grades[4] ?? null,
});

export interface ScoreOutcome {
  rows: DifficultyRow[];
  byBasis: Record<string, number>;
  /** Skipped for want of a max mark or an A boundary. */
  skipped: number;
}

export function scoreSittings(sittings: Sitting[]): ScoreOutcome {
  const usable = sittings.filter((s) => s.totalMarks > 0 && s.grades[0] != null);
  const componentKey = (s: Sitting) => `${s.subjectId}:${s.component}`;

  const componentGroups = new Map<string, PaperMetrics[]>();
  const subjectGroups = new Map<number, PaperMetrics[]>();

  for (const s of usable) {
    const m = computeMetrics(boundariesFor(s));
    push(componentGroups, componentKey(s), m);
    push(subjectGroups, s.subjectId, m);
  }

  const componentRefs = new Map<string, Reference>();
  for (const [key, group] of componentGroups) componentRefs.set(key, buildReference(group));
  const subjectRefs = new Map<number, Reference>();
  for (const [key, group] of subjectGroups) subjectRefs.set(key, buildReference(group));

  const byBasis: Record<string, number> = {};
  const rows = usable.map((s) => {
    const key = componentKey(s);
    const basis = chooseBasis(
      componentGroups.get(key)!.length,
      subjectGroups.get(s.subjectId)!.length,
    );
    const reference =
      basis === 'component'
        ? componentRefs.get(key)!
        : basis === 'subject'
          ? subjectRefs.get(s.subjectId)!
          : null;

    const result = computeHardness(boundariesFor(s), reference, basis);
    byBasis[basis] = (byBasis[basis] ?? 0) + 1;

    return {
      subjectId: s.subjectId,
      scode: s.scode,
      component: s.component,
      score: result.score,
      band: result.difficulty,
      sample: reference?.sampleCount ?? 0,
    } satisfies DifficultyRow;
  });

  return { rows, byBasis, skipped: sittings.length - usable.length };
}

/** The reference a given sitting is scored against — used by the verification script. */
export function referenceFor(
  sittings: Sitting[],
  target: Sitting,
): { reference: Reference | null; basis: 'component' | 'subject' | 'absolute' } {
  const componentKey = (s: Sitting) => `${s.subjectId}:${s.component}`;
  const usable = sittings.filter((s) => s.totalMarks > 0 && s.grades[0] != null);
  const sameComponent = usable.filter((s) => componentKey(s) === componentKey(target));
  const sameSubject = usable.filter((s) => s.subjectId === target.subjectId);
  const basis = chooseBasis(sameComponent.length, sameSubject.length);
  const group = basis === 'component' ? sameComponent : sameSubject;
  return {
    basis,
    reference:
      basis === 'absolute'
        ? null
        : buildReference(group.map((s) => computeMetrics(boundariesFor(s)))),
  };
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
