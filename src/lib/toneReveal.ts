import { flushSync } from 'react-dom';

/** Day's reveal: the dark screen collapses into the sun, fast at first and settling into it — the
 *  design system's "rise" curve. */
const SHRINK = 'cubic-bezier(.2,.8,.2,1)';
/** Night's reveal is that exact motion played backwards. A bezier runs in reverse as
 *  (1 − x2, 1 − y2, 1 − x1, 1 − y1): it eases out of the moon slowly and floods out fast. */
const GROW = 'cubic-bezier(.8,.2,.8,0)';

/** The radius of Night's hole, animatable because it is a registered length. */
let registered = false;
function registerRadius() {
  if (registered) return;
  registered = true;
  try {
    CSS.registerProperty({ name: '--sk-tone-r', syntax: '<length>', inherits: false, initialValue: '0px' });
  } catch {
    // Already registered (a hot reload) — nothing to do.
  }
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
 * So Night instead cuts a growing hole in the old Day snapshot (a mask on a registered radius), and
 * Day clips the old Night snapshot to a shrinking circle. Either way the window never shows through.
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
  const root = document.documentElement;
  registerRadius();
  root.style.setProperty('--sk-tone-x', `${x}px`);
  root.style.setProperty('--sk-tone-y', `${y}px`);
  root.classList.toggle('sk-to-night', toNight);
  const vt = doc.startViewTransition(() => flushSync(apply));
  void vt.finished.finally(() => root.classList.remove('sk-to-night'));
  void vt.ready.then(() => {
    const options = {
      duration: 750,
      easing: toNight ? GROW : SHRINK,
      fill: 'forwards' as const,
      pseudoElement: '::view-transition-old(root)',
    };
    if (toNight) root.animate({ '--sk-tone-r': ['0px', `${r}px`] }, options);
    else root.animate({ clipPath: [`circle(${r}px at ${x}px ${y}px)`, `circle(0px at ${x}px ${y}px)`] }, options);
  });
}
