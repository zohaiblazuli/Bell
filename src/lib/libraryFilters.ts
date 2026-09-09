import type { PaperRow } from './types';

type NumberedPaper = Pick<PaperRow, 'paperNumber'>;

/**
 * The real paper numbers in a result set, stable and ready to render as P1, P2, … chips.
 *
 * A selected number stays in the options even when another filter leaves it with no matches. That
 * keeps the empty state recoverable: the P4 chip that caused it remains on screen to be cleared.
 */
export function availablePaperNumbers(
  papers: readonly NumberedPaper[],
  selected: number | null = null,
): number[] {
  const numbers = papers.map((paper) => paper.paperNumber);
  if (selected !== null) numbers.push(selected);
  return [...new Set(numbers)]
    .filter((paper) => Number.isInteger(paper) && paper > 0)
    .sort((a, b) => a - b);
}

/** A null selection means all papers; a number includes every variant of that paper. */
export function filterByPaperNumber<T extends NumberedPaper>(
  papers: readonly T[],
  paperNumber: number | null,
): T[] {
  return paperNumber === null
    ? Array.from(papers)
    : papers.filter((paper) => paper.paperNumber === paperNumber);
}
