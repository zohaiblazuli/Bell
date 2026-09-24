import { pickFrom } from '@/lib/hushLines';

/**
 * Home's headline greeting — "Good evening, Zohaib" — drawn from a pool the way claude.ai picks its
 * own (see docs/claude-greetings.md): every greeting that fits the local hour and weekday is a
 * candidate, and one is chosen at random.
 *
 *   slot     the hour decides it — morning 06–12, afternoon 12–17, evening 17–21, night 21–06.
 *            Start hour inclusive, end hour exclusive, so 12:00 is afternoon and 06:00 is morning.
 *   days     empty means any day; otherwise only those weekdays (0 = Sunday, as `Date#getDay`).
 *   {name}   the name from onboarding, used as typed. With no name the `bare` wording stands in.
 *   flag     greetings under review. A `hold` flag keeps it out of the draw until it is decided;
 *            a `note` flag stays in the draw and only marks it for review.
 */

export type GreetingSlot = 'morning' | 'afternoon' | 'evening' | 'night';

export interface Greeting {
  /** The wording with the student's name. `{name}` is replaced as typed. */
  text: string;
  /** The wording when no name is known. Omitted when `text` carries no `{name}`. */
  bare?: string;
  slot: GreetingSlot;
  /** Weekdays it may show on, `Date#getDay` numbering. Empty: any day. */
  days: readonly number[];
  /** Under review. `hold` greetings never show; `note` ones do. `why` says what is at issue. */
  flag?: { kind: 'hold' | 'note'; why: string };
}

const SUN = 0, MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6;
const ANY: readonly number[] = [];
const WEEKEND = [SAT, SUN];

export const GREETINGS: readonly Greeting[] = [
  // Morning, 06–12.
  { text: 'Good morning, {name}', bare: 'Good morning', slot: 'morning', days: ANY },
  { text: 'Welcome, {name}', bare: 'Welcome', slot: 'morning', days: ANY },
  { text: 'Hey there, {name}', bare: 'Hey there', slot: 'morning', days: ANY },
  { text: 'Coffee & past paper time?', slot: 'morning', days: ANY },
  { text: 'Happy Monday, {name}', bare: 'Happy Monday', slot: 'morning', days: [MON] },
  { text: 'Happy Tuesday, {name}', bare: 'Happy Tuesday', slot: 'morning', days: [TUE] },
  { text: 'Happy Wednesday, {name}', bare: 'Happy Wednesday', slot: 'morning', days: [WED] },
  { text: 'Happy Thursday, {name}', bare: 'Happy Thursday', slot: 'morning', days: [THU] },
  { text: 'Happy Friday, {name}', bare: 'Happy Friday', slot: 'morning', days: [FRI] },
  { text: 'That Friday feeling, {name}', bare: 'That Friday feeling', slot: 'morning', days: [FRI] },
  { text: 'Welcome to the weekend, {name}', bare: 'Welcome to the weekend', slot: 'morning', days: WEEKEND },
  { text: 'Which paper first, {name}?', bare: 'Which paper first?', slot: 'morning', days: WEEKEND },
  { text: 'Happy Saturday, {name}', bare: 'Happy Saturday!', slot: 'morning', days: [SAT] },
  { text: 'Sunday session, {name}?', bare: 'Sunday session?', slot: 'morning', days: [SUN] },
  { text: 'Happy Sunday, {name}', bare: 'Happy Sunday', slot: 'morning', days: [SUN] },

  // Afternoon, 12–17.
  { text: 'Good afternoon, {name}', bare: 'Good afternoon', slot: 'afternoon', days: ANY },
  { text: 'Afternoon, {name}', bare: 'Afternoon', slot: 'afternoon', days: ANY },
  { text: 'Hi {name}, how are you?', bare: 'Hi, how are you?', slot: 'afternoon', days: ANY },
  { text: 'What’s on the list today, {name}?', bare: 'What’s on the list today?', slot: 'afternoon', days: ANY },
  { text: 'Back at it, {name}', bare: 'Back at it!', slot: 'afternoon', days: ANY },

  // Evening, 17–21.
  { text: '{name} returns!', bare: 'Back at it!', slot: 'evening', days: ANY },
  { text: 'Good evening, {name}', bare: 'Good evening', slot: 'evening', days: ANY },
  { text: 'Evening, {name}', bare: 'Evening', slot: 'evening', days: ANY },
  { text: 'How was your day, {name}?', bare: 'How was your day?', slot: 'evening', days: ANY },

  // Night, 21–06.
  { text: 'How’s it going, {name}?', bare: 'How’s it going?', slot: 'night', days: ANY },
  { text: 'One more paper tonight?', slot: 'night', days: ANY },
  { text: 'Hello, night owl', slot: 'night', days: ANY },
];

/** The slot an hour (0–23) falls in. */
export function slotOf(hour: number): GreetingSlot {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/** Every greeting that may show at this moment: right slot, right weekday, not on hold. */
export function greetingsFor(at: Date): Greeting[] {
  const slot = slotOf(at.getHours());
  const day = at.getDay();
  return GREETINGS.filter(
    (g) => g.slot === slot && (g.days.length === 0 || g.days.includes(day)) && g.flag?.kind !== 'hold',
  );
}

/** A greeting's wording for this student — the name as typed, or the nameless wording. */
export function wordGreeting(g: Greeting, name: string): string {
  const who = name.trim();
  if (who) return g.text.replace('{name}', who);
  return g.bare ?? g.text;
}

/**
 * One greeting for this moment, worded for this student. `avoid` is the wording shown last, so a
 * return to Home rarely says the same thing twice; `rng` is injectable for tests.
 */
export function pickGreeting(
  at: Date,
  name: string,
  opts: { avoid?: string | null; rng?: () => number } = {},
): string {
  const pool = greetingsFor(at).map((g) => wordGreeting(g, name));
  return pickFrom(pool, opts);
}
