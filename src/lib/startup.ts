/**
 * Startup timing shared by the splash renderer and App's fail-safe clock.
 *
 * The CSS animation is the normal completion signal. These values keep its custom properties and
 * the watchdog on the same clock, so a longer authored mascot sequence cannot be cut short by an
 * older hard-coded timeout.
 */

export type StartupPet = 'msbell' | 'azure' | null;
export type StartupPhase = 'splash' | 'handoff';

const DEFAULT_HOLD_MS = 2000;
const MS_BELL_HOLD_MS = 8480;
const REDUCED_HOLD_MS = 700;
const HANDOFF_MS = 900;
const REDUCED_HANDOFF_MS = 320;

export function startupHoldDurationMs(pet: StartupPet, reduceMotion: boolean): number {
  if (reduceMotion) return REDUCED_HOLD_MS;
  return pet === 'msbell' ? MS_BELL_HOLD_MS : DEFAULT_HOLD_MS;
}

export function startupHandoffDurationMs(reduceMotion: boolean): number {
  return reduceMotion ? REDUCED_HANDOFF_MS : HANDOFF_MS;
}

/** Margin is deliberately generous: this clock is recovery for a lost `animationend`, not pacing. */
export function startupWatchdogMs(
  phase: StartupPhase,
  pet: StartupPet,
  reduceMotion: boolean,
): number {
  const duration =
    phase === 'splash'
      ? startupHoldDurationMs(pet, reduceMotion)
      : startupHandoffDurationMs(reduceMotion);
  return duration + (phase === 'splash' ? 1200 : 900);
}
