import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { addFocusSeconds, loadFocus, loadPref, savePref } from '../lib/store';

/** Real CAIE paper lengths, so the target is a plausible number rather than a round one. */
const TARGETS = [45, 60, 75, 90, 105, 120, 135, 180];
const RING_R = 12.5;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;

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
  const [targetMin, setTargetMin] = useState<number>(() => loadPref(`target.${paper}`, 90));
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

  const target = targetMin * 60;
  const progress = Math.min(1, elapsed / target);
  const over = elapsed > target;

  const cycleTarget = () => {
    const next = TARGETS[(TARGETS.indexOf(targetMin) + 1) % TARGETS.length];
    setTargetMin(next);
    savePref(`target.${paper}`, next);
  };

  return (
    <div className="timer">
      <div className="ring" aria-hidden="true">
        <svg width="30" height="30" viewBox="0 0 30 30">
          <circle className="trk" cx="15" cy="15" r={RING_R} />
          <circle
            className="prg"
            cx="15"
            cy="15"
            r={RING_R}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          />
        </svg>
      </div>
      <div>
        <div className="t" data-over={over ? 'true' : undefined}>
          {clock(elapsed)}
        </div>
        <button
          type="button"
          className="tgt"
          onClick={cycleTarget}
          title="Change the target length"
        >
          / {clock(target)}
        </button>
      </div>
      <button
        type="button"
        className="pp"
        aria-label={running ? 'Pause the focus timer' : 'Resume the focus timer'}
        onClick={() => setRunning((r) => !r)}
      >
        <Icon name={running ? 'pause' : 'play'} />
      </button>
    </div>
  );
}
