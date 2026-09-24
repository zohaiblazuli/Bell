import { flushSync } from 'react-dom';

/**
 * The theme switch's motion (Bell App v2): the old tone shrinks away into the button you pressed —
 * into the sun on the way to Day, into the moon on the way to Night — revealing the new tone already
 * in place beneath it. Both directions are the same gesture. Night used to GROW out of the moon
 * instead, and a circle flooding the window read as the app re-opening, since Startup v2's full
 * stop floods it the same way.
 *
 * Built on the View Transitions API — the browser snapshots the old frame, `apply` commits the new
 * tone synchronously, and one clip-path animation on the old snapshot does the rest.
 *
 * The flash on dark → light was the old frame reappearing for one frame after its shrink finished;
 * `fill: 'forwards'` holds the clip at zero until the transition tears down. Without the API, or with
 * motion reduced, the tone simply switches.
 */
export function revealTone(origin: { x: number; y: number } | null, apply: () => void, reduced: boolean) {
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
  const vt = doc.startViewTransition(() => flushSync(apply));
  void vt.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(${r}px at ${x}px ${y}px)`, `circle(0px at ${x}px ${y}px)`] },
      {
        duration: 750,
        // Starts fast so it answers the press at once, then settles into the button — the design
        // system's "rise" curve. (An ease-in here made the full screen hang for a beat before
        // collapsing, which read as lag.)
        easing: 'cubic-bezier(.2,.8,.2,1)',
        fill: 'forwards',
        pseudoElement: '::view-transition-old(root)',
      },
    );
  });
}
