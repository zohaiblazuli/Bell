import { flushSync } from 'react-dom';

/** Day's reveal: the dark screen collapses into the sun, fast at first and settling into it — the
 *  design system's "rise" curve. */
const SHRINK = 'cubic-bezier(.2,.8,.2,1)';
/** Night's reveal is that exact motion played backwards. A bezier runs in reverse as
 *  (1 − x2, 1 − y2, 1 − x1, 1 − y1): it eases out of the moon slowly and floods out fast. */
const GROW = 'cubic-bezier(.8,.2,.8,0)';

/**
 * The Day snapshot with a circular hole of radius `r` at (x, y): the whole window, then the circle,
 * filled even-odd so the circle is cut out. Every frame has the same commands, so a clip-path
 * animation between two of these interpolates the numbers — the hole simply grows.
 */
function holed(w: number, h: number, x: number, y: number, r: number) {
  const k = Math.max(r, 0.01);
  return `path(evenodd, 'M0 0H${w}V${h}H0Z M${x - k} ${y}A${k} ${k} 0 1 0 ${x + k} ${y}A${k} ${k} 0 1 0 ${x - k} ${y}Z')`;
}

/**
 * The theme switch's motion (Bell App v2), two halves of one gesture. To Day, the dark screen
 * shrinks away into the pressed sun. To Night is that same film run in reverse: the dark grows back
 * out of the pressed moon, through the same circle, on the time-reversed curve and in the same
 * 750ms — so either switch undoes the other frame for frame.
 *
 * THE OLD SNAPSHOT IS ALWAYS THE ONE ON TOP, and the live new frame always fills the window beneath
 * it. That is what keeps the window solid: an earlier version grew Night by clipping the NEW layer
 * to a circle and trusting the old snapshot to fill the rest, and in the desktop webview the old
 * snapshot is not painted under it — the window went see-through to the desktop outside the circle.
 * So Night instead cuts a growing hole in the old Day snapshot, and Day clips the old Night snapshot
 * to a shrinking circle. Both are plain clip-path animations — the one kind the desktop webview has
 * been seen to run on a transition layer (a mask on an animated custom property did not play there).
 *
 * The flash on dark → light was the old frame reappearing for one frame after its shrink finished;
 * `fill: 'forwards'` holds the end state until the transition tears down. Without the API, or with
 * motion reduced, the tone simply switches.
 */
export function revealTone(toNight: boolean, origin: { x: number; y: number } | null, apply: () => void, reduced: boolean) {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> };
  };
  if (!doc.startViewTransition || reduced || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    apply();
    return;
  }
  const x = origin?.x ?? window.innerWidth - 60;
  const y = origin?.y ?? 40;
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const w = window.innerWidth;
  const h = window.innerHeight;
  const root = document.documentElement;
  const vt = doc.startViewTransition(() => flushSync(apply));
  void vt.ready.then(() => {
    const options = {
      duration: 750,
      easing: toNight ? GROW : SHRINK,
      fill: 'forwards' as const,
      pseudoElement: '::view-transition-old(root)',
    };
    root.animate(
      {
        clipPath: toNight
          ? [holed(w, h, x, y, 0), holed(w, h, x, y, r)]
          : [`circle(${r}px at ${x}px ${y}px)`, `circle(0px at ${x}px ${y}px)`],
      },
      options,
    );
  });
}
