/**
 * Splash — "Full stop", the Bell App v2 launch (Startup v2).
 *
 * The logo builds itself straight on the desktop — the window is transparent and `.app` is held out
 * while this plays, so there is no plate behind it:
 *
 *   0.8–2.1s  a blue square drops, squashes on landing, then grows into the owl head
 *   2.0–2.6s  ears, eyes, pupils and beak pop on
 *   2.7–3.6s  the lockup slides over as "Bell" sweeps in beside it
 *   3.6–4.8s  the full stop lands last and rings twice while the owl glances at it
 *   handoff   from 4.9s the full stop floods outward and swallows the lockup, filling the window with
 *             blue; the app opens under it and the blue lifts away (5.4–5.8s) to reveal Home. Hush then
 *             rises into the sidebar and his bubble types the greeting (Splash.css `.app[data-startup]`
 *             rules, and `useTyped` in the Sidebar)
 *
 * Each phase is reported by a timer from lib/startup.ts, with App's watchdog as the floor. A click, or
 * Escape / Space / Enter, skips straight to the handoff.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import { startupHandoffDurationMs, startupHoldDurationMs } from '@/lib/startup';
import './Splash.css';

export type SplashPhase = 'splash' | 'handoff' | 'done';

export interface Props {
  phase: SplashPhase;
  onFinished: (finished: 'splash' | 'handoff') => void;
  reduceMotion?: boolean;
}

export default function Splash({ phase, onFinished, reduceMotion = false }: Props) {
  const flood = useRef<HTMLElement>(null);
  const reduced =
    reduceMotion || (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    if (phase === 'done') return;
    const ms = phase === 'splash' ? startupHoldDurationMs(reduced) : startupHandoffDurationMs(reduced);
    const timer = window.setTimeout(() => onFinished(phase), ms);
    return () => window.clearTimeout(timer);
  }, [phase, reduced, onFinished]);

  useEffect(() => {
    if (phase !== 'splash') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') onFinished('splash');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onFinished]);

  /* The flood is measured, not assumed: the square grows from wherever the full stop landed until it
     covers the farthest corner of the window, whatever the window's size. A square of side `size`
     scaled by `k` covers the window once `k * size / 2` reaches the larger of the two offsets to each
     corner; the extra 2 keeps its edge off the corner while the ease-in is still finishing. */
  useLayoutEffect(() => {
    if (phase !== 'handoff') return;
    const el = flood.current;
    const r = el?.getBoundingClientRect();
    if (!el || !r || r.width === 0) return;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const reach = Math.max(cx, window.innerWidth - cx, cy, window.innerHeight - cy);
    el.style.setProperty('--flood', String(Math.ceil((2 * reach) / r.width) + 2));
  }, [phase]);

  if (phase === 'done') return null;

  return (
    <div
      className="splash"
      data-phase={phase}
      data-reduced={reduced ? 'true' : undefined}
      onClick={() => phase === 'splash' && onFinished('splash')}
      /* A logo building itself tells a screen reader nothing, and the app behind is already mounted. */
      aria-hidden="true"
      /* The window has no title bar of its own, so for the seconds this covers it the splash is the
         drag handle. */
      data-tauri-drag-region
    >
      <div className="splash__lockup">
        <span className="splash__owl">
          <i className="splash__head" />
          <i className="splash__ear splash__ear--l" />
          <i className="splash__ear splash__ear--r" />
          <i className="splash__eye splash__eye--l" />
          <i className="splash__eye splash__eye--r" />
          <span className="splash__look splash__look--l">
            <i />
          </span>
          <span className="splash__look splash__look--r">
            <i />
          </span>
          <i className="splash__beak" />
        </span>
        <div className="splash__word">
          <span className="splash__bell">Bell</span>
          <span className="splash__stop">
            <i className="splash__ring" />
            <i className="splash__ring splash__ring--2" />
            <i className="splash__dot" />
            <i className="splash__flood" ref={flood} />
          </span>
        </div>
      </div>
    </div>
  );
}
