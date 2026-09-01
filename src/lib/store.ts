/**
 * Local, offline study state: bookmarks, done/revision, focus minutes, annotation ink.
 *
 * Kept on disk (one JSON file per key in the app's state dir) rather than in localStorage, so
 * work survives a webview reset and isn't capped at a few megabytes — annotation ink would hit
 * that. Everything is hydrated once before the first render, which keeps the accessors below
 * synchronous at every call site.
 */

import { invoke } from '@tauri-apps/api/core';

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
