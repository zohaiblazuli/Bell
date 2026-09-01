/**
 * ─── The hardness formula ────────────────────────────────────────────────────
 *
 * Ported from `C:\scambridge\lib\difficulty-formula.ts`, unchanged in substance so scores
 * stay comparable with the web app. It runs locally over the grade thresholds parsed out of
 * the library's own `gt` PDFs — no network, no server.
 *
 * Cambridge sets grade boundaries *after* marking, specifically to absorb how hard the paper
 * turned out to be. Ofqual states the relationship plainly: "If an exam is easier than in
 * previous years, the grade boundaries for that paper will be higher. If it is harder, the
 * grade boundaries will be lower." So boundary position is a real difficulty signal — but
 * only when compared against the right reference class.
 *
 * The reference class matters more than anything else here. Boundary position also encodes
 * structural design choices, not just difficulty: boundaries sit as low as 13% of the maximum
 * purely as a consequence of how a paper is built. An absolute cutoff ("A below 70% = hard")
 * mostly measures *which paper you're looking at*. Physics 9702 Paper 1 runs structurally far
 * below Maths 9709 Paper 1 every single session.
 *
 * So every paper is scored against its own component's history — 9702/11 is judged against
 * other 9702/11 sittings, never against 9709/11.
 *
 * Three weighted signals:
 *
 *   1. A-threshold position (0.55) — how far this sitting's A boundary sits below the usual A
 *      boundary for this exact component. The core signal.
 *   2. Whole-curve height (0.30) — the same comparison applied to the mean of all five
 *      boundaries (A–E). This catches the paper where A looks unremarkable but B, C, D and E
 *      all collapsed underneath it.
 *   3. Absolute grounding (0.15) — a mild pull toward the raw A percentage, so a component
 *      whose entire history is brutal doesn't score as merely "typical".
 *
 * Signals 1 and 2 are z-scores, so the output is "unusual for this paper" rather than "low in
 * absolute terms". They're combined and squashed through a normal CDF into a bounded 0–100
 * score where 50 means "an ordinary sitting of this component".
 *
 * On boundary compression: the A–E span is computed and stored because it's informative on a
 * paper page, but it is deliberately *not* scored — its direction with respect to difficulty
 * isn't defensible.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';

// Weights must sum to 1.
const W_A_POSITION = 0.55;
const W_CURVE_HEIGHT = 0.3;
const W_ABSOLUTE = 0.15;

// Absolute grounding is expressed on the same z-like scale as the other two signals.
const ABSOLUTE_NEUTRAL_PCT = 70;
const ABSOLUTE_SCALE_PCT = 14;

// A component needs at least this many sittings before its own history is a trustworthy
// reference. Below it we widen the reference class.
const MIN_COMPONENT_SAMPLES = 4;
const MIN_SUBJECT_SAMPLES = 8;

// A floor on standard deviation, so a component whose boundaries barely move doesn't turn a
// 1-point wobble into a 5-sigma "hardest paper ever".
const MIN_SD = 1.5;

// Band cutoffs on the 0–100 score. Fixed rather than recomputed per run, so a paper's badge
// doesn't silently change when unrelated papers are indexed.
export const HARD_SCORE_CUTOFF = 67;
export const MEDIUM_SCORE_CUTOFF = 34;

/** How trustworthy the comparison behind a score is. */
export type DifficultyBasis = 'component' | 'subject' | 'absolute';

export interface PaperBoundaries {
  totalMarks: number;
  /** Raw mark thresholds, top grade first. A–E at component level; A* never exists there. */
  aThreshold: number;
  bThreshold: number | null;
  cThreshold: number | null;
  dThreshold: number | null;
  eThreshold: number | null;
}

export interface PaperMetrics {
  /** A boundary as % of max. */
  aPct: number;
  /** Mean of all available boundaries as % of max. */
  curveMeanPct: number | null;
  /** A minus E as % of max — stored as a diagnostic, not scored. */
  spanPct: number | null;
}

export interface HardnessResult {
  score: number;
  difficulty: Difficulty;
  basis: DifficultyBasis;
  metrics: PaperMetrics;
}

/** Reference distribution a paper is scored against. */
export interface Reference {
  aPctMean: number;
  aPctSd: number;
  curveMeanPctMean: number | null;
  curveMeanPctSd: number | null;
  sampleCount: number;
}

export function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Population standard deviation, floored so tiny spreads can't explode z-scores. */
export function stdDev(values: number[]): number {
  if (values.length < 2) return MIN_SD;
  const m = mean(values);
  const variance = mean(values.map((v) => (v - m) ** 2));
  return Math.max(Math.sqrt(variance), MIN_SD);
}

/**
 * Abramowitz & Stegun 26.2.17 normal CDF approximation. Accurate to ~7.5e-8, far beyond what
 * a difficulty badge needs, and avoids a dependency.
 */
function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/** Per-paper percentages derived from raw boundary marks. */
export function computeMetrics(b: PaperBoundaries): PaperMetrics {
  const pct = (mark: number) => (mark / b.totalMarks) * 100;
  const present = [
    b.aThreshold,
    b.bThreshold,
    b.cThreshold,
    b.dThreshold,
    b.eThreshold,
  ].filter((v): v is number => v != null);

  const lowest = present.length > 1 ? present[present.length - 1] : null;

  return {
    aPct: pct(b.aThreshold),
    curveMeanPct: present.length > 1 ? mean(present.map(pct)) : null,
    spanPct: lowest != null ? pct(b.aThreshold) - pct(lowest) : null,
  };
}

/** Build a reference distribution from the sibling papers of a component or subject. */
export function buildReference(siblings: PaperMetrics[]): Reference {
  const aPcts = siblings.map((m) => m.aPct);
  const curveMeans = siblings.map((m) => m.curveMeanPct).filter((v): v is number => v != null);

  return {
    aPctMean: mean(aPcts),
    aPctSd: stdDev(aPcts),
    curveMeanPctMean: curveMeans.length ? mean(curveMeans) : null,
    curveMeanPctSd: curveMeans.length ? stdDev(curveMeans) : null,
    sampleCount: siblings.length,
  };
}

/** Pick the tightest reference class with enough data behind it. */
export function chooseBasis(
  componentSampleCount: number,
  subjectSampleCount: number,
): DifficultyBasis {
  if (componentSampleCount >= MIN_COMPONENT_SAMPLES) return 'component';
  if (subjectSampleCount >= MIN_SUBJECT_SAMPLES) return 'subject';
  return 'absolute';
}

export function scoreToDifficulty(score: number): Difficulty {
  if (score >= HARD_SCORE_CUTOFF) return 'hard';
  if (score >= MEDIUM_SCORE_CUTOFF) return 'medium';
  return 'easy';
}

/**
 * Score one paper against a reference distribution.
 *
 * `reference` is null when basis is 'absolute' — there isn't enough history for a relative
 * comparison, so the absolute signal carries the whole score.
 */
export function computeHardness(
  boundaries: PaperBoundaries,
  reference: Reference | null,
  basis: DifficultyBasis,
): HardnessResult {
  const metrics = computeMetrics(boundaries);

  // Higher = harder, on a z-like scale, for every term.
  const absoluteSignal = (ABSOLUTE_NEUTRAL_PCT - metrics.aPct) / ABSOLUTE_SCALE_PCT;

  let raw: number;

  if (basis === 'absolute' || !reference) {
    raw = absoluteSignal;
  } else {
    // Negated: sitting *below* the usual boundary means harder.
    const aSignal = -((metrics.aPct - reference.aPctMean) / reference.aPctSd);

    const canUseCurve =
      metrics.curveMeanPct != null &&
      reference.curveMeanPctMean != null &&
      reference.curveMeanPctSd != null;

    if (canUseCurve) {
      const curveSignal = -(
        (metrics.curveMeanPct! - reference.curveMeanPctMean!) / reference.curveMeanPctSd!
      );
      raw = W_A_POSITION * aSignal + W_CURVE_HEIGHT * curveSignal + W_ABSOLUTE * absoluteSignal;
    } else {
      // No curve data — redistribute its weight onto the A-position signal rather than
      // silently treating the curve as average.
      const w = W_A_POSITION + W_CURVE_HEIGHT;
      raw = w * aSignal + W_ABSOLUTE * absoluteSignal;
    }
  }

  // Squash to 0–100 through the normal CDF.
  //
  // SPREAD must approximate the actual standard deviation of `raw`. Too small and scores
  // saturate at 0 and 100; too large and everything bunches around 50. Calibrated
  // empirically against 2,448 real papers in the web app — re-check after changing any
  // weight above; a healthy result has p25 near 25 and p75 near 75.
  const SPREAD = 0.98;
  const score = Math.round(100 * normalCdf(raw / SPREAD));
  const clamped = Math.min(100, Math.max(0, score));

  return { score: clamped, difficulty: scoreToDifficulty(clamped), basis, metrics };
}

/** Human-readable explanation of a score, for the paper page. */
export function explainHardness(result: HardnessResult, reference: Reference | null): string {
  const { metrics, basis, score } = result;
  const a = metrics.aPct.toFixed(1);

  if (basis === 'absolute' || !reference) {
    return `An A needed ${a}% of the marks. There isn't enough history for this component yet, so this score reflects the raw threshold alone.`;
  }

  const delta = metrics.aPct - reference.aPctMean;
  const direction = delta < 0 ? 'below' : 'above';
  const scope = basis === 'component' ? 'this exact paper' : 'this subject';

  if (Math.abs(delta) < 1) {
    return `An A needed ${a}% of the marks — right about average for ${scope} across ${reference.sampleCount} sittings. Score ${score}/100.`;
  }

  return `An A needed ${a}% of the marks, ${Math.abs(delta).toFixed(1)} points ${direction} the ${reference.aPctMean.toFixed(1)}% average for ${scope} across ${reference.sampleCount} sittings. Score ${score}/100.`;
}
