/**
 * Startup timing — the "Full stop" launch (Bell App v2 · Startup v2).
 *
 * Two phases, each reported by the splash and each backed by a watchdog in App so a lost timer can
 * never strand the user behind it:
 *
 *   splash   0 – 4.9s  on the transparent window, the logo builds itself: a blue square drops and
 *                      squashes, grows into the owl head, ears and eyes pop, the lockup slides over as
 *                      "Bell" sweeps in, and the full stop lands and rings twice.
 *   handoff  4.9 – 8.0s the full stop floods the window blue, the app opens under it and the blue lifts
 *                      away to reveal Home (by 5.8s); Hush rises into the sidebar (5.9s) and his bubble
 *                      pops, shows typing dots and types the greeting (6.5 – 8.0s). The app takes input
 *                      from 5.4s — the phase runs on only so the intro is never cut off half-typed.
 *
 * Reduced motion collapses both to a short hold and a quick fade.
 */
export type StartupPhase = 'splash' | 'handoff';

const HOLD_MS = 4900;
const HANDOFF_MS = 3100;
const REDUCED_HOLD_MS = 500;
const REDUCED_HANDOFF_MS = 250;

export function startupHoldDurationMs(reduceMotion: boolean): number {
  return reduceMotion ? REDUCED_HOLD_MS : HOLD_MS;
}

export function startupHandoffDurationMs(reduceMotion: boolean): number {
  return reduceMotion ? REDUCED_HANDOFF_MS : HANDOFF_MS;
}

/** The phase's own length plus a recovery margin: only a stalled splash ever reaches it. */
export function startupWatchdogMs(phase: StartupPhase, reduceMotion: boolean): number {
  const duration = phase === 'splash' ? startupHoldDurationMs(reduceMotion) : startupHandoffDurationMs(reduceMotion);
  return duration + (phase === 'splash' ? 1200 : 900);
}
