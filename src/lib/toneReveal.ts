import { flushSync } from 'react-dom';

/**
 * The theme switch's motion (Bell App v2): Night grows out of the pressed moon as a circle; Day is
 * revealed by the dark screen shrinking back into the sun. Built on the View Transitions API — the
 * browser snapshots the old frame, `apply` commits the new tone synchronously, and one clip-path
 * animation on the right pseudo-element does the rest.
 *
 * The flash on dark → light was the old frame reappearing for one frame after its shrink finished;
 * `fill: 'forwards'` holds the clip at zero until the transition tears down. Without the API, or with
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
  root.classList.toggle('sk-to-day', !toNight);
  const vt = doc.startViewTransition(() => flushSync(apply));
  void vt.finished.finally(() => root.classList.remove('sk-to-day'));
  void vt.ready.then(() => {
    root.animate(
      {
        clipPath: toNight
          ? [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`]
          : [`circle(${r}px at ${x}px ${y}px)`, `circle(0px at ${x}px ${y}px)`],
      },
      {
        duration: 750,
        easing: 'cubic-bezier(.65,0,.25,1)',
        fill: 'forwards',
        pseudoElement: toNight ? '::view-transition-new(root)' : '::view-transition-old(root)',
      },
    );
  });
}
