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
 *     all read that log. Reset is immediate, matching an ordinary stopwatch.
 *
 * The face is Bell App v2's: a card pill in a 2px ink frame with a red conic ring. The design mock
 * printed `of 1:50:00` beside the clock; that is exactly the denominator removed above, so it stays
 * out — the ring is the second hand, and it is red in both tones because it is drawn on the card.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import './FocusTimer.css';
import { addFocusSeconds, loadFocus, resetPaperFocus } from '../lib/store';

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

  const reset = () => {
    // Drop the unbanked seconds FIRST: they would otherwise be flushed onto the paper a tick later
    // and the stopwatch would start from 4 instead of 0.
    unsaved.current = 0;
    resetPaperFocus(paper);
    setElapsed(0);
  };

  const pct = ((elapsed % 60) / 60) * 100;

  return (
    <div className="timer" data-running={running ? 'true' : undefined}>
      <span
        className="timer-ring"
        style={{ background: `conic-gradient(var(--live) 0 ${pct.toFixed(2)}%, var(--pale) 0)` }}
        aria-hidden="true"
      >
        <i />
      </span>
      <span className="timer-read">{clock(elapsed)}</span>
      <button
        type="button"
        className="timer-btn timer-run"
        aria-label={running ? 'Pause the clock' : 'Resume the clock'}
        title={running ? 'Pause the clock' : 'Resume the clock'}
        onClick={() => setRunning((r) => !r)}
      >
        {running ? (
          <>
            <i className="timer-bar" />
            <i className="timer-bar" />
          </>
        ) : (
          <i className="timer-play" />
        )}
      </button>
      <button
        type="button"
        className="timer-btn timer-reset"
        aria-label="Reset this paper’s timer"
        title="Reset the clock — the minutes already banked for today are kept"
        onClick={reset}
      >
        <i className="timer-arc" />
      </button>
    </div>
  );
}
