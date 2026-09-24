import type { MouseEvent } from 'react';
import { revealTone } from '@/lib/toneReveal';
import { loadSettings } from '@/lib/store';

export type Tone = 'day' | 'night';

export interface TonePillProps {
  tone: Tone;
  onToggle: () => void;
  className?: string;
}

/**
 * Day / Night — the compact sun/moon segmented control from Bell App v2. The selected half is a solid
 * ink block (the sun turns yellow on it); pressing the other half runs the circle reveal from that
 * button. Two real buttons with `aria-pressed`, so the choice is announced, not just painted.
 */
export default function TonePill({ tone, onToggle, className }: TonePillProps) {
  const pick = (target: Tone) => (e: MouseEvent<HTMLButtonElement>) => {
    if (target === tone) return;
    const r = e.currentTarget.getBoundingClientRect();
    revealTone({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, onToggle, loadSettings().reduceMotion);
  };
  return (
    <div className={className ? `tonepill ${className}` : 'tonepill'} role="group" aria-label="Day or night">
      <button type="button" className="tonepill__btn tonepill__btn--day" aria-pressed={tone === 'day'} title="Day" onClick={pick('day')}>
        {/* Bell App v2's sun: eight rays, long and short in turn, round a 7px disc. */}
        <span className="tonepill__sun" aria-hidden="true">
          <span className="tonepill__rays">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <i key={deg} style={{ transform: `rotate(${deg}deg)` }} />
            ))}
          </span>
          <b />
        </span>
      </button>
      <button type="button" className="tonepill__btn tonepill__btn--night" aria-pressed={tone === 'night'} title="Night" onClick={pick('night')}>
        {/* A crescent with two diamond stars that twinkle while it is night. */}
        <span className="tonepill__moon" aria-hidden="true">
          <b />
          <i />
          <i />
        </span>
      </button>
    </div>
  );
}
