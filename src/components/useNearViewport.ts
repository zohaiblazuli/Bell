import { useEffect, useState, type RefObject } from 'react';

/**
 * Whether `box` is within `margin` of its scroll container — and, unlike the load-once latch it
 * replaces, it flips BOTH ways. A page that scrolls out of reach reports `false` again, so the
 * reader can unmount its `PaperCanvas` and free the backing store instead of keeping every page it
 * has ever scrolled past resident for the life of the tab. That latch is what grew the webview to
 * ~2 GB: pages only ever mounted, never released.
 *
 * `active` gates the result. An inactive tab pane is hidden with `visibility: hidden`, not
 * `display: none` (chrome.css) — its pages keep their layout boxes, so they still intersect their
 * own well and would stay "near". Threading the tab's active flag through means a reader that is not
 * the one on screen holds no rasterised pages at all; its scroll position and React state survive,
 * and the visible pages re-render the moment it is shown again.
 *
 * The observer stays connected for the element's whole life (the old effect tore itself down once it
 * latched). `seed` is the value before the first callback lands — the top pages pass `true` so they
 * are not a blank frame on open.
 */
export function useNearViewport<T extends HTMLElement>(
  box: RefObject<T | null>,
  options: { rootSelector: string; margin: string; active: boolean; seed?: boolean },
): boolean {
  const { rootSelector, margin, active, seed = false } = options;
  const [visible, setVisible] = useState(seed);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries.some((e) => e.isIntersecting)),
      { root: el.closest(rootSelector), rootMargin: margin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [box, rootSelector, margin]);

  return active && visible;
}
