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
 *   handoff   the window opens behind it, the lockup flies into the sidebar's logo slot and fades as
 *             the real one appears; Home rises underneath (Splash.css `.app[data-startup]` rules)
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
  const lockup = useRef<HTMLDivElement>(null);
  const flight = useRef<HTMLDivElement>(null);
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

  /* The landing is measured, not assumed: the sidebar lockup's rect is wherever the live layout put
     it, and the flight is the translate + scale that lays the splash lockup exactly over it. With no
     sidebar (onboarding, the star gate) the lockup simply fades where it is. */
  useLayoutEffect(() => {
    if (phase !== 'handoff') return;
    const from = lockup.current?.getBoundingClientRect();
    const to = document.querySelector('.sk-side__lockup')?.getBoundingClientRect();
    const el = flight.current;
    if (!el || !from || !to || to.height === 0) return;
    const s = to.height / from.height;
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    el.style.setProperty('--fly', `translate(${dx}px, ${dy}px) scale(${s})`);
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
      <div className="splash__flight" ref={flight}>
        <div className="splash__lockup" ref={lockup}>
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
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
