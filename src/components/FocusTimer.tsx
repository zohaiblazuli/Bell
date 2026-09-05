/**
 * The focus timer — a stopwatch, not a countdown.
 *
 * THERE IS NO TARGET ANY MORE, and that is the point of this shape. It used to print `0:07:22 /
 * 1:30:00` against a cycling list of CAIE paper lengths, and the denominator turned "how long have I
 * been at this" into "how much of my allowance is left" — a limit the student never asked for.
 * Zohaib asked for it gone, so `TARGETS`, the `target.<paper>` pref and the over-target red are gone
 * with it, and what is left counts up for as long as you work.
 *
 * WHICH LEAVES THE RING WITH NOTHING TO DIVIDE BY, so it is a SECOND HAND: the arc sweeps once a
 * minute, `(elapsed % 60) / 60`. That is a real reading rather than a fabricated fraction, and it is
 * the one thing a stopwatch face is for — telling you at a glance that it is still running. At the
 * wrap the arc has to snap rather than unwind, which `data-wrap` does in CSS; see FocusTimer.css.
 *
 * Two controls, both of them measured against the same banked seconds:
 *   PAUSE flushes to disk, because whatever happens next — closing the paper, closing the window —
 *     must not lose the minutes already counted.
 *   RESET zeroes THIS PAPER's stopwatch and nothing else. `store.resetPaperFocus` deliberately keeps
 *     the day log: those minutes were studied, and the streak, the week total and the activity grid
 *     all read that log. It asks first — one mis-click should not throw away an hour of tracking.
 *
 * `Ring` is the shared primitive (`@ui/Ring`), and the arc paints through a gradient THIS COMPONENT
 * defines rather than the app-wide `#iris`. Two reasons, and the second is the load-bearing one:
 *   `#iris` ends on `--bell-cap-deep` `#0e2596`, which on the Night glass composites to all but
 *     nothing — the ring simply vanished in Night, which is what Zohaib reported.
 *   the fix wants the mode-PAIRED `--accent`, and `components/Sprite` is mounted as a sibling of
 *     `.app` where the Night overrides are declared, so a `var(--accent)` stop defined there would
 *     inherit `:root` and paint Day's value in both tones. Defined here it is inside `.app` and
 *     resolves per tone: `#1436c8 → #58c8ff` in Day, `#6aa8ff → #58c8ff` in Night. Still the accent
 *     spent as a line on a live element, which is the rule that licenses a timer ring at all.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Ring from '@ui/Ring';
import Icon from './Icon';
import './FocusTimer.css';
import { addFocusSeconds, loadFocus, resetPaperFocus } from '../lib/store';

/** How long an armed reset stays armed before it forgets it was asked. */
const CONFIRM_MS = 3000;

const clock = (total: number) => {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

interface Props {
  /** Paper id from `store.paperKey` — the timer resumes where this paper left off. */
  paper: string;
}

export default function FocusTimer({ paper }: Props) {
  const [elapsed, setElapsed] = useState(() => Math.floor(loadFocus().papers[paper] ?? 0));
  const [running, setRunning] = useState(true);
  /** Reset has been asked for once and is waiting to be confirmed. */
  const [confirming, setConfirming] = useState(false);
  // Seconds counted but not yet written to disk.
  const unsaved = useRef(0);

  const flush = useCallback(() => {
    if (unsaved.current > 0) {
      addFocusSeconds(paper, unsaved.current);
      unsaved.current = 0;
    }
  }, [paper]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      unsaved.current += 1;
      setElapsed((e) => e + 1);
      if (unsaved.current >= 30) flush();
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, flush]);

  // Pausing, leaving the paper and closing the window all bank the time.
  useEffect(() => {
    if (!running) flush();
  }, [running, flush]);
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener('beforeunload', onHide);
    return () => {
      window.removeEventListener('beforeunload', onHide);
      flush();
    };
  }, [flush]);

  // An armed reset disarms itself, so a confirm the user walked away from is not still live an hour
  // later next to a button they meant to press once.
  useEffect(() => {
    if (!confirming) return;
    const id = window.setTimeout(() => setConfirming(false), CONFIRM_MS);
    return () => window.clearTimeout(id);
  }, [confirming]);

  const reset = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    // Drop the unbanked seconds FIRST: they would otherwise be flushed onto the paper a tick later
    // and the stopwatch would start from 4 instead of 0.
    unsaved.current = 0;
    resetPaperFocus(paper);
    setElapsed(0);
  };

  return (
    <div
      className="timer"
      data-running={running ? 'true' : undefined}
      /* The second hand snaps home at the top of each minute instead of unwinding for most of a
         second. Set on the wrap render, so the arc's own transition is off in the same commit that
         moves it. */
      data-wrap={running && elapsed > 0 && elapsed % 60 === 0 ? 'true' : undefined}
    >
      {/* Inside `.app`, which is the whole point — see the header. 0 x 0 and absolutely positioned, so
          it is a definition and not a layout participant. */}
      <svg className="timer-defs" aria-hidden="true">
        <defs>
          <linearGradient id="bell-timer-arc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--accent)" />
            <stop offset="1" stopColor="var(--bell-cap-hi)" />
          </linearGradient>
        </defs>
      </svg>

      <Ring value={(elapsed % 60) / 60} size={30} stroke={3} fill="url(#bell-timer-arc)" />

      <span className="timer-read t-mono-timer">{clock(elapsed)}</span>

      <span className="timer-sep" aria-hidden="true" />

      <div className="timer-btns">
        <button
          type="button"
          className="timer-btn"
          aria-label={running ? 'Pause the focus timer' : 'Resume the focus timer'}
          title={running ? 'Pause' : 'Resume'}
          onClick={() => setRunning((r) => !r)}
        >
          <Icon name={running ? 'pause' : 'play'} />
        </button>
        <button
          type="button"
          className="timer-btn timer-reset"
          data-armed={confirming ? 'true' : undefined}
          aria-label={
            confirming ? 'Press again to reset this paper’s timer' : 'Reset this paper’s timer'
          }
          title={
            confirming
              ? 'Press again to reset'
              : 'Reset this paper’s timer — the minutes already banked for today are kept'
          }
          onClick={reset}
        >
          <Icon name="reset" />
        </button>
      </div>
    </div>
  );
}
