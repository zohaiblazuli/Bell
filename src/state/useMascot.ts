/**
 * Which of the twelve timelines the sidebar mascot is playing.
 *
 * The Figma page is a mood library — twelve frames — and the file specifies triggers for the update
 * notice and dialog and nothing else. Onboarding maps six to its own steps, so those play once per
 * install. This is the rest of the answer: what makes him move during ordinary use.
 *
 *   alarm         a real failure just happened — an ingest error, a query that threw. 0.9s.
 *   tone-handoff  the tone crossed. 1.0s. `Motion — Mr. Bell` §3.12 draws exactly this, and in it the
 *                 crab does not move at all: his tokens are mode-invariant, so only the spectacle
 *                 lenses cross from the Day glass tint to the Night one.
 *   double-take   the mascot was poked. 1.0s; a pet uses its interaction reaction.
 *   scuttle       real background work is active. Held until the work finishes.
 *   glint         that work just finished successfully. 1.0s; a pet waves.
 *   sleep         nothing has happened for a while. A loop, not a beat — he stays asleep.
 *   idle          everything else.
 *
 * The three one-shots are PULSES: they win while they run, then fall back to whatever the resting mood
 * is. Sleep is a resting mood rather than a pulse, which is why it is tracked separately — a pulse that
 * expired would wake him, and being woken by his own yawn is not the behaviour.
 *
 * `alarm` and `tone-handoff` fire on a TRANSITION, never on a value. `error` stays non-null until
 * something clears it, so pulsing on the value would leave him alarmed for as long as the message is on
 * screen; and `tone` has a value from the first render, so keying on it without the guard would flick
 * his lenses every time the app opened.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BellMood } from '@ui/brand/MrBell';
import type { Tone } from '@ui/TonePill';

/** Spec durations plus a frame, so the animation finishes before the mood reverts. */
const PULSE_MS: Partial<Record<BellMood, number>> = {
  alarm: 4500,
  'double-take': 2500,
  glint: 4100,
  'tone-handoff': 3700,
};

/**
 * How long the app has to be untouched before he nods off. A minute, by Zohaib's call — short enough
 * that you will see it, and short enough that he *will* nod off while you are reading a question,
 * which is the point rather than a flaw: a sleeping crab in the corner is not a state anyone has to
 * act on. `pointermove` is one of the waking events, so the smallest movement brings him back.
 */
const IDLE_MS = 60 * 1000;

/** What counts as "you are still there". `pointermove` is included because reading is not typing. */
const WAKING = ['pointerdown', 'pointermove', 'keydown', 'wheel'] as const;

export interface Mascot {
  mood: BellMood;
  /** Fire the double-take. Bound to a press on the mascot slot — see Sidebar for why it is not a button. */
  poke: () => void;
}

export function useMascot(tone: Tone, error: string | null, working = false, studying = false): Mascot {
  const [pulse, setPulse] = useState<BellMood | null>(null);
  const [asleep, setAsleep] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  /** A new pulse cancels the one in flight rather than queueing behind it. */
  const fire = useCallback((mood: BellMood) => {
    window.clearTimeout(timer.current);
    setPulse(mood);
    setAsleep(false);
    timer.current = window.setTimeout(() => setPulse(null), PULSE_MS[mood] ?? 1000);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const poke = useCallback(() => fire('double-take'), [fire]);

  // Active work holds the work row. Its successful falling edge earns one friendly acknowledgment.
  const wasWorking = useRef(false);
  useEffect(() => {
    if (working) {
      wasWorking.current = true;
      setAsleep(false);
      return;
    }
    if (wasWorking.current) {
      wasWorking.current = false;
      if (!error) fire('glint');
    }
  }, [working, error, fire]);

  // Tone: skip the first render, then pulse on every crossing.
  const firstTone = useRef(true);
  useEffect(() => {
    if (firstTone.current) {
      firstTone.current = false;
      return;
    }
    fire('tone-handoff');
  }, [tone, fire]);

  // Failure: pulse only on the null → message edge, so a message that stays does not alarm him twice.
  const hadError = useRef(false);
  useEffect(() => {
    const has = Boolean(error);
    if (has && !hadError.current) fire('alarm');
    hadError.current = has;
  }, [error, fire]);

  /**
   * The sleep timer. Reset on activity through a ref rather than through state, so moving the mouse
   * does not re-render the whole app sixty times a second — `setAsleep` is only ever called when the
   * answer actually changes.
   */
  useEffect(() => {
    let sleepAt: number | undefined;
    const arm = () => {
      window.clearTimeout(sleepAt);
      sleepAt = window.setTimeout(() => setAsleep(true), IDLE_MS);
    };
    const wake = () => {
      setAsleep((was) => (was ? false : was));
      arm();
    };
    arm();
    for (const e of WAKING) window.addEventListener(e, wake, { passive: true });
    return () => {
      window.clearTimeout(sleepAt);
      for (const e of WAKING) window.removeEventListener(e, wake);
    };
  }, []);

  // A reader/notebook session owns the teacher timeline from entry until the route is left. Keeping
  // it above transient pulses also prevents the enter clip from restarting mid-session.
  return { mood: studying ? 'scuttle' : pulse ?? (working ? 'scuttle' : asleep ? 'sleep' : 'idle'), poke };
}
