import type { CSSProperties } from 'react';

/**
 * Hush — the Shape Kit owl, Bell's companion (not its logo; the logo is `OwlMark`).
 *
 * Built only from the kit's shapes on a fixed 180×180 stage and scaled to `size`, exactly as the
 * Bell App v2 / Hush behaviour sheet draws him: quarter-triangle ears, a blue square body, cream
 * circle eyes with blue lids, a red triangle beak, navy half-round wings and yellow feet. His colours
 * are literal in both tones — he is a character, not chrome.
 *
 * Each pose is one of the sheet's behaviours:
 *   idle     head tilt, glancing, blinking            (sidebar default)
 *   watch    eyes follow the clock, slower blink       (while a paper is open)
 *   empty    drooping sigh, ears down, lids half shut  (empty states)
 *   proud    puffed chest, sparkling stars             (About, onboarding finished)
 *   hello    one wing waving                           (onboarding)
 *   download hugs a page while a bar fills             (download toast)
 *   done     hops with wings up while shapes burst     (paper done)
 *   asleep   lids shut, Zs rising                      (idle for a minute / offline)
 *   alarm    time's up: hop, ears flapping             (errors, destructive dialogs)
 *
 * Motion is CSS keyframes from motion.css, so the app-wide reduced-motion switch stops all of it.
 */
export type HushPose =
  | 'idle'
  | 'watch'
  | 'empty'
  | 'proud'
  | 'hello'
  | 'download'
  | 'done'
  | 'asleep'
  | 'alarm';

interface Props {
  pose?: HushPose;
  /** Rendered edge in px; the stage is 180 and scales from its top-left. */
  size?: number;
  /** Draw the soft floor shadow under his feet. */
  shadow?: boolean;
  className?: string;
  style?: CSSProperties;
}

const LID: Record<HushPose, number> = {
  idle: 0,
  watch: 0,
  empty: 12,
  proud: 10,
  hello: 0,
  download: 0,
  done: 6,
  asleep: 23,
  alarm: 0,
};

export default function Hush({ pose = 'idle', size = 86, shadow = true, className, style }: Props) {
  const blinking = pose === 'idle' || pose === 'watch' || pose === 'hello' || pose === 'alarm';
  const looking = pose === 'idle' || pose === 'watch';
  const pupil =
    pose === 'empty' ? 'translateY(8px)' : pose === 'download' ? 'translateY(6px)' : pose === 'hello' ? 'translateX(2px)' : undefined;

  return (
    <div
      className={`hush hush--${pose}${className ? ' ' + className : ''}`}
      style={{ width: size, height: size, ...style }}
      aria-hidden="true"
    >
      <div className="hush__stage" style={{ transform: `scale(${size / 180})` }}>
        {pose === 'done' && (
          <>
            <i className="hush__burst hush__burst--1" />
            <i className="hush__burst hush__burst--2" />
            <i className="hush__burst hush__burst--3" />
            <i className="hush__burst hush__burst--4" />
          </>
        )}
        {shadow && pose !== 'download' && pose !== 'done' && <i className="hush__floor" />}
        <div className="hush__body">
          <i className="hush__wing hush__wing--l" />
          <i className="hush__wing hush__wing--r" />
          <i className="hush__ear hush__ear--l" />
          <i className="hush__ear hush__ear--r" />
          <i className="hush__torso" />
          <i className="hush__chev" style={{ left: 66, top: 132 }} />
          <i className="hush__chev" style={{ left: 84, top: 138 }} />
          <i className="hush__chev" style={{ left: 102, top: 132 }} />
          {(['l', 'r'] as const).map((side) => (
            <span key={side} className={`hush__eye hush__eye--${side}`}>
              <span className={`hush__pupil${looking ? ' is-looking' : ''}`}>
                <i style={pupil ? { transform: pupil } : undefined} />
              </span>
              <i className={`hush__lid${blinking ? ' is-blinking' : ''}`} style={{ height: LID[pose] }} />
            </span>
          ))}
          <i className="hush__beak" />
          <i className="hush__foot hush__foot--l" />
          <i className="hush__foot hush__foot--r" />
          {pose === 'download' && (
            <span className="hush__page">
              <i style={{ width: 30, top: 8 }} />
              <i style={{ width: 36, top: 14 }} />
            </span>
          )}
        </div>
        {pose === 'download' && (
          <span className="hush__bar">
            <i />
          </span>
        )}
        {pose === 'proud' && (
          <>
            <i className="hush__star hush__star--a" />
            <i className="hush__star hush__star--b" />
          </>
        )}
        {pose === 'asleep' && (
          <>
            <i className="hush__z hush__z--a" />
            <i className="hush__z hush__z--b" />
          </>
        )}
      </div>
    </div>
  );
}
