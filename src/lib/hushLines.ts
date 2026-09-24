import type { View } from '@/components/Sidebar';

/**
 * Hush's speech — the sidebar bubble, and the reader's "how did this one feel?" reply.
 *
 * His voice (rewritten with Zohaib, from what students actually post on r/igcse, r/alevel, r/olevels
 * and on X): a tired student who has sat these papers before. Dry and flat, lowercase, the turn
 * in the last few words, never explained. The examiner is a real, nosy person; Cambridge is the
 * villain; thresholds, variants and the "five-minute break" are shared lore. Swearing is allowed
 * and lands as the punchline, not as decoration. English only. Slang only where it earns its place
 * (brands saying current slang is itself the joke). Dark humour points at the system or at our own
 * mess — never at a person, never at race, never at self-harm, never at parents hurting anyone.
 * Twelve words at most, because the bubble types at a fixed size (Sidebar).
 *
 * Every screen and moment draws from a POOL and `pickFrom` never repeats the line it just showed,
 * so he reads as alive rather than as one canned string per route.
 */

/** The facts a line may quote. The last three are optional: a line that needs one it lacks is skipped. */
export interface HushFacts {
  papers: number | null;
  recentCount: number;
  bookmarks: number;
  /** Current focus streak in days. `{streak}` lines need two or more. */
  streak?: number;
  /** Minutes until the sitting opens. `{minutes}` lines need it ahead, not under way. */
  minutesToExam?: number | null;
  /** The subject furthest behind. `{behind}` lines need two or more ranked subjects. */
  behind?: string | null;
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

// Lines that quote the student's own numbers. They join every Home pool and are skipped whenever
// the fact they need is missing (see `canSay`).
const HOME_FACTS = [
  "day {streak}. streak's alive. don't make it weird",
  '{minutes} till the exam. not that i’m counting',
  '{behind} is furthest behind. it’s noticed',
];

/** The lines themselves. Tokens are filled at render (`fillTemplate`). */
export const HUSH_LINES: Record<HushSayKey, readonly string[]> = {
  'dashboard-morning': [
    '9am: anything is possible. 2pm: not today. use the 9am',
    '“i’ll start at 10.” it’s 10:40',
    'up before the examiner. small win. take it',
    ...HOME_FACTS,
  ],
  'dashboard-afternoon': [
    '“five-minute break.” that was 3 reels, 2 snacks and an hour ago',
    'made a revision timetable. colour-coded it. that was the revision',
    'lunch was 2 hours ago. productivity was 2 hours before that',
    ...HOME_FACTS,
  ],
  'dashboard-evening': [
    'owl hours. i’m finally awake. you’re finally stressed',
    '“i’ll do it after dinner.” dinner was at 8. it’s 11',
    '“one more reel.” that was 45 minutes ago',
    'one paper tonight and tomorrow-you owes you one',
    ...HOME_FACTS,
  ],
  reader: [
    '“show your working.” the examiner is so nosy',
    '“answer all questions.” ambitious of them',
    '“this page is intentionally left blank.” it literally isn’t',
    '“suggest a reason.” oh, now they want my opinion',
    '“hence, or otherwise.” otherwise what. threatening as hell',
    '“it can be shown that…” then fucking show it',
    'phone’s face down. i can turn my head 270 degrees',
    'the timer doesn’t pause for reels. i asked',
  ],
  notebooks: [
    'rewriting notes in 4 colours isn’t revision. it’s arts and crafts',
    'your handwriting is basically encryption at this point',
    'everything you’ve written, saved. even the bits you regret',
  ],
  settings: [
    'changing the theme instead of studying. respect, honestly',
    'night mode won’t raise the grade. tested the shit out of it',
  ],
  community: [
    'other people’s notes. free trial of having your life together',
    'everyone in here is also cooked. solidarity',
  ],
  'recent-empty': [
    '0 papers opened. bold strategy for exam season',
    'nothing opened yet. the procrastination is immaculate',
  ],
  'recent-some': [
    '{recent} opened lately. the examiner should be nervous',
    '{recent} recently. cambridge has been notified. probably',
  ],
  'bookmarks-empty': [
    'no bookmarks. either very confident or very unaware',
  ],
  'bookmarks-some': [
    '{bookmarks} saved for later. like the 400 reels you also saved',
    '{bookmarks} waiting. like unread texts, but they’re exams',
  ],
  'library-some': [
    '{papers}, all offline. the wifi excuse just died',
    'picking a paper takes longer than doing one. every time',
    'your academy charged a fortune for this shit. i’m free',
  ],
  'library-empty': [
    'nothing here yet. one sync and the excuses run out',
  ],
  poke: [
    'careful. i’m mostly held together by spite',
    'hi. now we’re both procrastinating',
    'poke me again and i’m emailing cambridge',
    'people think owls are wise. we just stare a lot',
    'yes? i was busy judging your posture',
    'i’m an owl, not a fidget toy',
    'poke me one more time. i fucking dare you',
  ],
  asleep: [
    'social battery: 2%. poke gently',
    'resting my eyes. like you in every lecture',
    'asleep in daylight. my body clock is fucked',
  ],
  'feel-easy': [
    'don’t tell anyone. they’ll raise the threshold',
    'screenshot this before paper 2 humbles you',
    'easy. the examiner will be devastated',
  ],
  'feel-okay': [
    'not great, not a crisis. we move',
    'okay is a grade. technically',
  ],
  'feel-tough': [
    'that one was personal. mark scheme, then revenge',
    'snack first. mark scheme second. in that order',
    'that paper was bullshit. mark scheme anyway',
    'somewhere an examiner is smiling',
  ],
  'feel-lost': [
    'examiner report: “many candidates struggled.” hi, many candidates',
    'lost? same. the mark scheme is the walkthrough',
    'understood fuck all. welcome to the club',
    'understood nothing. the threshold will be low. probably',
  ],
};

/** Every declared pool key, for the invariants and for anyone iterating the registry. */
export const SAY_KEYS = Object.keys(HUSH_LINES) as HushSayKey[];

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** `172,800 minutes`, `1 minute`. Days past a week read better as-is: the absurd unit is the joke. */
const minutesLabel = (m: number) => plural(Math.max(1, Math.round(m)), 'minute', 'minutes');

/** Whether every token in a line has a fact behind it right now. */
export function canSay(line: string, facts: HushFacts): boolean {
  if (line.includes('{streak}') && !((facts.streak ?? 0) >= 2)) return false;
  if (line.includes('{minutes}') && !((facts.minutesToExam ?? 0) > 0)) return false;
  if (line.includes('{behind}') && !facts.behind) return false;
  return true;
}

/**
 * Fill the tokens a line may carry. Called every render so the number is current, while the pick
 * that chose the line stays put — see the holder in `App`.
 */
export function fillTemplate(template: string, facts: HushFacts): string {
  return template
    .replace('{recent}', plural(facts.recentCount, 'paper', 'papers'))
    .replace('{papers}', plural(facts.papers ?? 0, 'paper', 'papers'))
    .replace('{bookmarks}', plural(facts.bookmarks, 'bookmark', 'bookmarks'))
    .replace('{streak}', String(facts.streak ?? 0))
    .replace('{minutes}', minutesLabel(facts.minutesToExam ?? 0))
    .replace('{behind}', facts.behind ?? '');
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

/**
 * Pick a line for a pool key. With `facts`, lines whose tokens have nothing to quote are left out,
 * so "day {streak}" never shows on day one.
 */
export function pickLine(
  key: HushSayKey,
  opts: { avoid?: string | null; rng?: () => number; facts?: HushFacts } = {},
): string {
  const { facts } = opts;
  const pool = facts ? HUSH_LINES[key].filter((line) => canSay(line, facts)) : HUSH_LINES[key];
  return pickFrom(pool.length ? pool : HUSH_LINES[key], opts);
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



