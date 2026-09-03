/**
 * The answer-checker seam.
 *
 * In scambridge this was `lib/topical/keyword-matcher.ts` — a local keyword matcher scoring a
 * typed answer against mark-scheme points — with `components/practice/AnswerChecker.tsx` on top
 * of it. Bell deliberately ships no checker: the mark scheme is right there in the sheet,
 * and a keyword matcher that quietly marks a good answer wrong is worse than no marking at all.
 *
 * What lives here is the shape a checker would plug into, so that adding one later is a
 * registration and a panel rather than a refactor:
 *
 *   - it takes the paper it is marking, the question, the student's answer, and (optionally) the
 *     mark-scheme text the workspace already has in hand;
 *   - it returns marks earned out of available, per-point verdicts, and a `needsReview` flag,
 *     because anything automated has to be able to say "a human should look at this";
 *   - it is async and may run for a while, since an on-device model is the likely implementation.
 *
 * Nothing imports this yet. That is the point: the seam stays open, and nothing else in the app
 * has to know whether a checker exists.
 */

export interface AnswerCheckPaper {
  /** Subject code as it appears on the paper, e.g. `9709`. */
  subjectCode: string;
  /** Session code, e.g. `s24`. */
  scode: string;
  /** Paper/variant, e.g. `12`, when the sitting has one. */
  variant: string | null;
}

export interface AnswerCheckRequest {
  paper: AnswerCheckPaper;
  /** Question number as printed, e.g. `4(b)(ii)`. */
  question: string;
  /** What the student wrote. */
  answer: string;
  /** Marks the question is worth, when known from the paper. */
  availableMarks?: number;
  /** Mark-scheme text for this question, if the caller already has it. */
  markScheme?: string;
}

/** One marking point's verdict. `id` is the checker's own label for the point (`B1`, `M1`, …). */
export interface AnswerCheckPoint {
  id: string;
  awarded: boolean;
  marks: number;
  /** What the scheme wanted, in the scheme's words. */
  expected?: string;
  /** Why the checker decided this, for the student to argue with. */
  note?: string;
}

export interface AnswerCheckResult {
  earnedMarks: number;
  availableMarks: number;
  points: AnswerCheckPoint[];
  /** True when the checker isn't confident enough to stand behind the mark on its own. */
  needsReview: boolean;
}

export interface AnswerChecker {
  /** Stable id, e.g. `local-llm`. */
  id: string;
  /** Shown to the student, so they know what marked them. */
  name: string;
  check(request: AnswerCheckRequest): Promise<AnswerCheckResult>;
}

let checker: AnswerChecker | null = null;

/** Install a checker. Called once at startup by whatever implementation ships. */
export function registerAnswerChecker(next: AnswerChecker | null) {
  checker = next;
}

/** The installed checker, or null — callers must handle null and hide their UI. */
export const answerChecker = (): AnswerChecker | null => checker;

export const hasAnswerChecker = (): boolean => checker !== null;
