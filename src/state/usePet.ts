/**
 * The selected pet's spritesheet, loaded once and shared by every mascot on screen.
 *
 * There are five mascot slots — the sidebar, onboarding, the update dialog, the reset dialog, the
 * startup splash — and up to three can be mounted at the same time. So the sheet is cached at module
 * scope rather than threaded down as a prop from `App`: 1.7 MB should reach the webview once per pet
 * per launch, and a `<Mascot>` should stay a one-word swap for `<MrBell>` at each of those five call
 * sites instead of a new prop through three components that do not otherwise care.
 *
 * **The atlas version is measured here, not read from `pet.json`.** This is the only place in the app
 * that has the decoded image, so it is the only place that can tell 1872 from 2288 — and a manifest
 * claiming v2 over a v1 sheet would otherwise point the last two rows at pixels that do not exist.
 * A sheet whose height is neither is not cached and not rendered: the mascot stays Mr. Bell.
 *
 * Blob URLs are deliberately not revoked. One per pet the student has selected this session, held for
 * as long as the app runs — the sidebar mascot is mounted the whole time, so revoking on a change
 * would pull the sheet out from under a live element to reclaim a handle nobody is short of.
 */
import { useEffect, useState } from 'react';
import { atlasVersionForHeight, isPetId, petSheet, petSheetSize } from '@/lib/pets';
import type { AtlasVersion } from '@/lib/pets';

export interface LoadedPet {
  id: string;
  /** A `blob:` URL — the only kind `img-src 'self' data: blob:` will render. */
  url: string;
  version: AtlasVersion;
}

const loaded = new Map<string, LoadedPet>();
/** In flight, so three slots mounting together read the sheet once. */
const pending = new Map<string, Promise<LoadedPet>>();

/** Decode far enough to learn the sheet's real height. */
function measure(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalHeight);
    img.onerror = () => reject(new Error('the spritesheet could not be decoded'));
    img.src = url;
  });
}

async function load(id: string): Promise<LoadedPet> {
  const bytes = await petSheet(id);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/webp' }));
  try {
    const version = atlasVersionForHeight(await measure(url));
    if (version == null) throw new Error('that spritesheet is not a Codex pet atlas');
    const entry: LoadedPet = { id, url, version };
    loaded.set(id, entry);
    return entry;
  } catch (error) {
    // Nothing usable, so nothing is kept: the handle goes back and the mascot stays Mr. Bell.
    URL.revokeObjectURL(url);
    throw error;
  }
}

/**
 * Read a pet's sheet, measure it, and cache it. Rejects when it is not an atlas this app can slice.
 *
 * Exported because an install wants exactly this: proof that the bytes it just wrote will actually
 * render, before a pet becomes selectable. Verifying and warming the cache are the same work, so the
 * pet the student just imported is in hand by the time the shelf redraws.
 */
export function loadPet(id: string): Promise<LoadedPet> {
  const cached = loaded.get(id);
  if (cached) return Promise.resolve(cached);
  const existing = pending.get(id);
  if (existing) return existing;
  const task = load(id).finally(() => pending.delete(id));
  pending.set(id, task);
  return task;
}

/** What the sheet has to be, for a message a person can act on. */
export const petSheetSpec = () => {
  const v1 = petSheetSize(1);
  const v2 = petSheetSize(2);
  return `${v1.w}x${v1.h} or ${v2.w}x${v2.h}`;
};

/**
 * The loaded pet for `id`, or `null` for Mr. Bell — which covers all three of no pet selected, a pet
 * still loading, and a pet that will not load at all.
 *
 * A cached pet is returned on the first render rather than after an effect, so switching back to a pet
 * that is already in hand does not blink through the crab on the way.
 */
export function usePet(id: string | null): LoadedPet | null {
  const [pet, setPet] = useState<LoadedPet | null>(() => (id ? loaded.get(id) ?? null : null));

  useEffect(() => {
    // A bad id is refused here rather than by Rust, purely to save a pointless round trip and a
    // console line: `pets::valid_id` is still the guard that matters, on the far side of the IPC.
    if (!id || !isPetId(id)) {
      setPet(null);
      return;
    }
    const cached = loaded.get(id);
    if (cached) {
      setPet(cached);
      return;
    }
    // Clear first: the old pet's sheet is the wrong art for the newly selected one, and one frame of
    // Mr. Bell is a better answer than a frame of the pet the student just changed away from.
    setPet(null);

    let live = true;
    void loadPet(id)
      .then((entry) => {
        if (live) setPet(entry);
      })
      .catch((error) => {
        console.warn(
          `[pets] ${id} will not render, so the mascot stays Mr. Bell. ` +
            `A sheet must be ${petSheetSpec()}.`,
          error,
        );
      });
    return () => {
      live = false;
    };
  }, [id]);

  return pet;
}

/** Drop a cached sheet, so deleting a pet and installing it again does not serve the old bytes. */
export function forgetPet(id: string) {
  loaded.delete(id);
  pending.delete(id);
}
