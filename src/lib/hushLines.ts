import type { View } from '@/components/Sidebar';

/**
 * Hush's speech — the sidebar bubble, and the reader's "how did this one feel?" reply.
 *
 * His voice (Bell App v2 behaviour sheet, sharpened by Zohaib): a dry study-buddy who has clearly
 * done this before. Self-deprecating — *we* reorganised the notes, never *you* — specific over
 * motivational, and quiet. No internet slang: it dates in months and this ships in a slow binary.
 * No syllabus in-jokes either; he reacts to the moment you are in, which is fair game because the
 * app is for studying. Twelve words at most, because the bubble types at a fixed size (Sidebar).
 *
 * Every screen and moment draws from a POOL and `pickFrom` never repeats the line it just showed,
 * so he reads as alive rather than as one canned string per route.
 */

/** The counts a line may quote. The shape the sidebar already handed the old `hushLine`. */
export interface HushFacts {
  papers: number | null;
  recentCount: number;
  bookmarks: number;
}

/**
 * Every pool Hush can draw from: one per screen (some split by time of day or empty/populated), the
 * two moments that used to be silent (a poke, a doze), and the four reader feelings.
 */
export type HushSayKey =
  | 'dashboard-morning'
  | 'dashboard-afternoon'
  | 'dashboard-evening'
  | 'reader'
  | 'notebooks'
  | 'settings'
  | 'community'
  | 'recent-empty'
  | 'recent-some'
  | 'bookmarks-empty'
  | 'bookmarks-some'
  | 'library-some'
  | 'library-empty'
  | 'poke'
  | 'asleep'
  | 'feel-easy'
  | 'feel-okay'
  | 'feel-tough'
  | 'feel-lost';

/** The lines themselves. `{recent}`, `{papers}` and `{bookmarks}` are filled at render (`fillTemplate`). */
export const HUSH_LINES: Record<HushSayKey, readonly string[]> = {
  'dashboard-morning': [
    'The hard paper first, while we still mean it.',
    "Morning. Let's spend the good hours on the mean ones.",
    'Early start. I respect it more than I show.',
    'Coffee, then a paper. That is the correct order.',
  ],
  'dashboard-afternoon': [
    'Afternoon. One more section than you planned. Classic.',
    'The afternoon slump is real. A paper cuts through it.',
    'Afternoon. Still time to make today count.',
  ],
  'dashboard-evening': [
    "Evening. My shift, technically. Let's get one done.",
    'Evenings are quiet. Quiet is good for a timed paper.',
    'The night is mine. Borrow it for one paper.',
  ],
  reader: [
    'Watching the clock. Not you.',
    'The paper will not open itself. I already checked.',
    "You have read that line three times. Gently, I counted.",
    "Focus. I will be here, being an owl about it.",
    'First ten minutes are the worst. Then it flows.',
  ],
  notebooks: [
    'Your handwriting. My shelf.',
    'Everything you scribbled, still here. Nothing walks off.',
    'Notes are the warm-up. They live here regardless.',
  ],
  settings: [
    'Change what you like. I adapt.',
    "Tweak away. I will pretend not to watch.",
    'Make it yours. That is the whole point.',
  ],
  community: [
    'The online bit. It all comes home eventually.',
    'Everyone in there is a little behind too. Comforting.',
    'Borrowed brains. Use them, then close the tab.',
  ],
  'recent-empty': [
    'Nothing opened yet. Very restful.',
    'A blank slate. Enjoy it while it lasts.',
  ],
  'recent-some': [
    "{recent} lately. I keep count so you do not have to.",
    '{recent} behind you. That is the good kind of pile.',
    '{recent} opened recently. Quietly, that adds up.',
  ],
  'bookmarks-empty': [
    "Nothing saved. Later has not happened yet.",
    'No bookmarks. A clean conscience, for now.',
  ],
  'bookmarks-some': [
    'Saved for later. Later is coming.',
    "{bookmarks} waiting. 'Soon' is doing a lot of work.",
    "A pile of 'I will get to it.' I believe you.",
  ],
  'library-some': [
    '{papers}. Zero wifi needed.',
    '{papers} here, all offline. Pick a fight.',
    'Every paper works offline. Even at 1am. Especially then.',
  ],
  'library-empty': [
    'Every paper works offline.',
    "Nothing here yet. The catalogue is a sync away.",
  ],
  poke: [
    "I am awake. I am always sort of awake. Owl thing.",
    'Yes? I was watching the clock for you.',
    "You have a paper open and you are poking me. Bold.",
    'Present. Reluctantly majestic, as ever.',
    'That is the feathers. But go on.',
    "Poke all you like. The paper is still there.",
    "Careful. I am mostly held together by spite.",
    "Hi. Now we are both procrastinating.",
  ],
  asleep: [
    "Resting my eyes. Poke me when you are serious.",
    'Five more minutes. Then a paper. Promise.',
    'Zzz. I am a night bird, this is unusual.',
    'Dozing. Wake me for something timed.',
  ],
  'feel-easy': [
    'Easy? Bank it, then pick a mean one.',
    'Too easy is a warning. Level up.',
    'Good. Now go find one that fights back.',
  ],
  'feel-okay': [
    'Okay counts. Okay, repeated, becomes a grade.',
    'Fine is fine. Keep the streak alive.',
    'Middling is momentum. Take it.',
  ],
  'feel-tough': [
    'Tough is where the marks hide. Good.',
    'That is the useful kind of hard. Again tomorrow.',
    'Tough now, easy in June. That is the deal.',
  ],
  'feel-lost': [
    'Lost is data. Mark scheme, line by line.',
    'Nobody starts found. Read the scheme, come back.',
    'Lost means you found the edge. Useful.',
  ],
};

/** Every declared pool key, for the invariants and for anyone iterating the registry. */
export const SAY_KEYS = Object.keys(HUSH_LINES) as HushSayKey[];

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

/**
 * Fill the count tokens a line may carry. Called every render so the number is current, while the
 * pick that chose the line stays put — see the holder in `App`.
 */
export function fillTemplate(template: string, facts: HushFacts): string {
  return template
    .replace('{recent}', plural(facts.recentCount, 'paper', 'papers'))
    .replace('{papers}', plural(facts.papers ?? 0, 'paper', 'papers'))
    .replace('{bookmarks}', plural(facts.bookmarks, 'bookmark', 'bookmarks'));
}

/**
 * One line from a pool, never the `avoid` line when the pool has an alternative — that is what keeps
 * Hush from repeating himself twice running. `rng` is injectable so the choice is testable.
 */
export function pickFrom(
  pool: readonly string[],
  opts: { avoid?: string | null; rng?: () => number } = {},
): string {
  const rng = opts.rng ?? Math.random;
  let i = Math.floor(rng() * pool.length);
  if (i >= pool.length) i = pool.length - 1;
  if (pool.length > 1 && pool[i] === opts.avoid) i = (i + 1) % pool.length;
  return pool[i];
}

/** Pick a line for a pool key directly. */
export function pickLine(key: HushSayKey, opts?: { avoid?: string | null; rng?: () => number }): string {
  return pickFrom(HUSH_LINES[key], opts);
}

/** A reader feeling id → its pool key. Keeps `WorkspaceView`'s FEELINGS free of wording. */
export function feelSayKey(id: string): HushSayKey {
  return `feel-${id}` as HushSayKey;
}

/**
 * Which pool a screen resolves to. The route decides it; the dashboard splits by the hour, and
 * recent/bookmarks/library split on whether they hold anything.
 */
export function routeSayKey(view: View, facts: HushFacts, hour: number): HushSayKey {
  switch (view) {
    case 'dashboard':
      return hour < 12 ? 'dashboard-morning' : hour < 18 ? 'dashboard-afternoon' : 'dashboard-evening';
    case 'reader':
    case 'community-reader':
    case 'workspace':
      return 'reader';
    case 'notebooks':
    case 'notebook':
      return 'notebooks';
    case 'settings':
      return 'settings';
    case 'community':
      return 'community';
    case 'recent':
      return facts.recentCount === 0 ? 'recent-empty' : 'recent-some';
    case 'bookmarks':
      return facts.bookmarks === 0 ? 'bookmarks-empty' : 'bookmarks-some';
    default:
      return facts.papers ? 'library-some' : 'library-empty';
  }
}



