/**
 * Hush's decks, kept on disk.
 *
 * `hushLines.ts` stays pure — pools, templates and the dealing rule — and this is the one stateful
 * seam over it: each pool's deck is stored under one state key, so a restart carries on dealing the
 * same round rather than rolling fresh dice that happily land on the line from five minutes ago.
 */
import { loadPref, savePref } from './store';
import { HUSH_LINES, canSay, drawFrom, type HushBag, type HushFacts, type HushSayKey } from './hushLines';

const KEY = 'hushBags';

type Bags = Partial<Record<HushSayKey, HushBag>>;

/**
 * The next line from a pool. With `facts`, lines quoting a fact that is missing are passed over but
 * kept for later, so "day {streak}" still gets its turn once the streak exists.
 */
export function sayLine(key: HushSayKey, facts?: HushFacts): string {
  const bags = loadPref<Bags>(KEY, {});
  const { line, bag } = drawFrom(HUSH_LINES[key], bags[key], {
    can: facts ? (l) => canSay(l, facts) : undefined,
  });
  savePref(KEY, { ...bags, [key]: bag });
  return line;
}
