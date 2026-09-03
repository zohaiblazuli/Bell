/**
 * Local, offline study state: bookmarks, done/revision, focus minutes, annotation ink.
 *
 * Kept on disk (one JSON file per key in the app's state dir) rather than in localStorage, so
 * work survives a webview reset and isn't capped at a few megabytes — annotation ink would hit
 * that. Everything is hydrated once before the first render, which keeps the accessors below
 * synchronous at every call site.
 */

import { invoke } from '@tauri-apps/api/core';
import type { PaperRow } from './types';

const cache = new Map<string, unknown>();
let hydrated = false;

/** Load every stored key. Call once, before rendering. */
export async function hydrate(): Promise<void> {
  if (hydrated) return;
  try {
    const raw = await invoke<Record<string, string>>('state_load');
    for (const [key, text] of Object.entries(raw)) {
      try {
        cache.set(key, JSON.parse(text));
      } catch {
        // A corrupt file shouldn't take the app down; the key just reads as unset.
      }
    }
  } catch {
    // No state yet, or the command is unavailable — everything falls back to defaults.
  }
  hydrated = true;
}

function read<T>(key: string, fallback: T): T {
  return cache.has(key) ? (cache.get(key) as T) : fallback;
}

/** Writes are fire-and-forget: study state is a convenience, never a blocker. */
function write(key: string, value: unknown) {
  cache.set(key, value);
  void invoke('state_save', { key, value: JSON.stringify(value) }).catch(() => {});
}

// --- paper identity ---------------------------------------------------------

/** Stable id for a paper: `9709/s15/12`. */
export const paperKey = (code: string, scode: string, variant: string | null) =>
  `${code}/${scode}/${variant ?? '-'}`;

/** The same paper as a state key — file-name safe. */
export const inkKey = (paper: string) => `ink.${paper.replace(/[^A-Za-z0-9]+/g, '-')}`;

// --- sets ------------------------------------------------------------------

export type SetName = 'bookmarks' | 'done' | 'revision';

/** What the library is listing: everything, one of the three marks, or the recently opened. */
export type MarkFilter = SetName | 'recent' | null;

export function loadSet(name: SetName): Set<string> {
  return new Set(read<string[]>(name, []));
}

export function saveSet(name: SetName, value: Set<string>) {
  write(name, [...value]);
}

// --- scalars ---------------------------------------------------------------

export const loadPref = <T,>(key: string, fallback: T): T => read(key, fallback);
export const savePref = (key: string, value: unknown) => write(key, value);

/** Per-paper ink, keyed by page number. */
export const loadInk = <T,>(paper: string, fallback: T): T => read(inkKey(paper), fallback);
export const saveInk = (paper: string, value: unknown) => write(inkKey(paper), value);

// --- focus minutes ---------------------------------------------------------

export interface FocusLog {
  /** Minutes per ISO date, e.g. `{"2026-09-01": 42}` — the shape the dashboard will read. */
  days: Record<string, number>;
  /** Seconds spent per paper, so a session can be resumed where it stopped. */
  papers: Record<string, number>;
}

export const loadFocus = (): FocusLog => read<FocusLog>('focus', { days: {}, papers: {} });

/** Add elapsed seconds to today's total and to this paper's running total. */
export function addFocusSeconds(paper: string, seconds: number) {
  if (seconds <= 0) return;
  const log = loadFocus();
  const today = new Date().toISOString().slice(0, 10);
  const days = { ...log.days, [today]: (log.days[today] ?? 0) + seconds / 60 };
  const papers = { ...log.papers, [paper]: (log.papers[paper] ?? 0) + seconds };
  write('focus', { days, papers });
}

// --- recently opened, and the rows behind the marks -------------------------

/**
 * Marks and recents are keys (`9709/s15/12`), but the dashboard, the Bookmarks list and the
 * palette's resting state all need to *render* those papers — and a paper marked months ago
 * won't be in whatever 600 rows the current library query happens to hold. So the row that
 * opened or marked a paper is kept alongside: a local convenience copy, never a second source
 * of truth. Paths still go through `read_document`, which only serves files in the index, so a
 * stale snapshot fails loudly instead of reading something unexpected.
 */
export interface RecentEntry {
  key: string;
  /** Epoch ms of the last open. */
  at: number;
}

const RECENT_CAP = 40;

export const loadRecent = (): RecentEntry[] => read<RecentEntry[]>('recent', []);

export const loadRows = (): Record<string, PaperRow> => read<Record<string, PaperRow>>('rows', {});

export const rowFor = (key: string): PaperRow | null => loadRows()[key] ?? null;

/** Keep only what something still points at: the recent list and the three mark sets. */
function writeRows(rows: Record<string, PaperRow>, keep: Iterable<string>) {
  const live = new Set(keep);
  for (const name of ['bookmarks', 'done', 'revision'] as SetName[]) {
    for (const key of loadSet(name)) live.add(key);
  }
  const kept: Record<string, PaperRow> = {};
  for (const key of live) {
    const row = rows[key];
    if (row) kept[key] = row;
  }
  write('rows', kept);
}

/** Remember a paper's row so a mark on it can still be rendered later. */
export function rememberPaper(row: PaperRow) {
  const key = paperKey(row.subjectCode, row.scode, row.variant);
  writeRows({ ...loadRows(), [key]: row }, [key, ...loadRecent().map((r) => r.key)]);
}

/** Opening a paper moves it to the front of Recent and refreshes its snapshot. */
export function noteOpened(row: PaperRow) {
  const key = paperKey(row.subjectCode, row.scode, row.variant);
  const recent = [{ key, at: Date.now() }, ...loadRecent().filter((r) => r.key !== key)].slice(
    0,
    RECENT_CAP,
  );
  write('recent', recent);
  writeRows(
    { ...loadRows(), [key]: row },
    recent.map((r) => r.key),
  );
}

// --- settings ---------------------------------------------------------------

/**
 * One record rather than a scatter of `loadPref` calls, so Settings can hand the whole thing to a
 * form and write it back in one go. Read through `loadSettings`, which fills gaps from the
 * defaults — that is what makes adding a field here safe for someone whose file predates it.
 */

/** The tone the user *chose*. `system` is an explicit opt-in; the product toggle is the default. */
export type ToneChoice = 'day' | 'night' | 'system';

/** Which CAIE series the user actually sits. Drives the Dashboard's days-to-exam. */
export type SeasonChoice = 'm' | 's' | 'w';

export interface Settings {
  tone: ToneChoice;
  /** Product-level twin of `prefers-reduced-motion`; either one collapses the motion. */
  reduceMotion: boolean;
  seasons: SeasonChoice[];
  /** Default focus-session length in minutes, from the real CAIE durations. */
  focusMinutes: number;
  /** Opening a paper starts the timer, on the theory that you opened it to work. */
  focusAutostart: boolean;
  /** Focused minutes in a day for it to count towards the streak. Stated in the UI. */
  streakMinutes: number;
  /**
   * Off by default, and that is load-bearing: offline is a hard requirement, so nothing checks for
   * an update unless the user has asked for it here or pressed Check now.
   */
  updateAuto: boolean;
}

export const SETTINGS_DEFAULTS: Settings = {
  tone: 'day',
  reduceMotion: false,
  seasons: ['m', 's', 'w'],
  focusMinutes: 90,
  focusAutostart: true,
  streakMinutes: 10,
  updateAuto: false,
};

export function loadSettings(): Settings {
  const stored = read<Partial<Settings> | null>('settings', null);
  // Before Settings existed the tone lived alone under `tone`, and that key survived the Foolscap
  // migration — so seed from it rather than resetting a real preference to Day.
  const seed = stored ?? { tone: read<ToneChoice>('tone', SETTINGS_DEFAULTS.tone) };
  return { ...SETTINGS_DEFAULTS, ...seed };
}

export function saveSettings(value: Settings) {
  write('settings', value);
}

// --- onboarding -------------------------------------------------------------

/**
 * What the six-step flow collected. `done` is the gate: the app shows onboarding until it is true,
 * which is a deliberate change from the old behaviour of inferring first-run from an empty index —
 * a rebuilt index used to send an established user back to Setup.
 *
 * The shape is structurally identical to `OnboardingAnswers` in `views/OnboardingView.tsx`, on
 * purpose: that view is the only thing that writes these and the two must not drift. It declares
 * its own copy rather than importing this, so a view never depends on the store's module graph.
 */
export type OnboardingRhythm = 'casual' | 'steady' | 'intense';

export interface OnboardingPlan {
  /** Session code of the target sitting — `s27`. Null until the flow's step 04 is answered. */
  session: string | null;
  rhythm: OnboardingRhythm | null;
}

export interface Onboarding {
  name: string;
  /** A level exactly as the index spells it: `A Level` · `IGCSE` · `O Level`. */
  board: string | null;
  /** Syllabus codes, not ids — a code survives a reindex and a level change cannot orphan it. */
  subjects: string[];
  plan: OnboardingPlan;
  done: boolean;
}

export const ONBOARDING_DEFAULTS: Onboarding = {
  name: '',
  board: null,
  subjects: [],
  plan: { session: null, rhythm: null },
  done: false,
};

export function loadOnboarding(): Onboarding {
  if (!cache.has('onboarding')) return { ...ONBOARDING_DEFAULTS, done: hasHistory() };
  return { ...ONBOARDING_DEFAULTS, ...read<Partial<Onboarding>>('onboarding', {}) };
}

/**
 * Evidence that this install has been used before, which is what stops onboarding from ambushing an
 * established user.
 *
 * The flow is new in Phase 5, so nobody who has been using the app has an `onboarding` key — and a
 * bare default of `done: false` would march someone with 13,447 indexed papers, bookmarks and banked
 * focus minutes through "What should I call you?". An index alone is not the signal, because a fresh
 * install pointed at an existing library builds one in seconds; study state is, because only using
 * the app produces it. The Foolscap migration carries all of it across, so this survives the rename.
 */
function hasHistory(): boolean {
  return (
    read<string[]>('bookmarks', []).length > 0 ||
    read<string[]>('done', []).length > 0 ||
    read<string[]>('revision', []).length > 0 ||
    read<RecentEntry[]>('recent', []).length > 0 ||
    Object.keys(read<FocusLog>('focus', { days: {}, papers: {} }).days).length > 0
  );
}

export const saveOnboarding = (value: Onboarding) => write('onboarding', value);
