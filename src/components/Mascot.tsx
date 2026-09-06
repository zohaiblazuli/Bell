/**
 * Mascot — whichever animal is currently the app's, at one of Mr. Bell's five slots.
 *
 * This is the whole of "pets replace Mr. Bell": every call site that used to say `<MrBell size={160}
 * mood={m} />` says `<Mascot size={160} mood={m} />`, and what actually renders is decided here from
 * one setting. Nothing above this component knows a pet exists, and `useMascot` keeps speaking Bell —
 * `alarm`, `double-take`, `sleep` — because those names describe what the *app* just did. The
 * translation into a pet's nine or eleven rows happens in `petStateForMood`, once, at this boundary.
 *
 * **Mr. Bell is the fallback and stays in the binary.** He renders when no pet is selected, while a
 * sheet is still being read, and when the selected pet has gone or will not decode. A downloadable
 * mascot cannot be the thing a fresh install draws before it has ever seen a network.
 *
 * He also stays the *brand*: `MrBellMark` is the app icon (`npm run icon` renders it), the sidebar
 * logo's mark and a notebook sticker, and the wordmark wears his spectacles. Those are the app's
 * identity rather than its mascot, and a pet the student picks at runtime cannot be either — which is
 * why nothing here touches them.
 *
 * The selected pet is read straight out of the store rather than passed in. That is what `store.ts`'s
 * synchronous accessors are for, and it keeps the swap at each of the five call sites to one word.
 */
import MrBell, { type BellMood } from '@ui/brand/MrBell';
import BellPet from '@ui/BellPet';
import Pet from '@ui/Pet';
import { petStateForMood } from '@/lib/pets';
import { loadSettings } from '@/lib/store';
import { usePet } from '@/state/usePet';

export interface MascotProps {
  /** Box size in px — 160 in every sidebar and onboarding slot, 96 in a dialog. */
  size?: number;
  /** Optional pet-only size; lets non-square atlas art use space without resizing Mr. Bell. */
  petSize?: number | string;
  /** What the app just did, in Mr. Bell's vocabulary. Translated for a pet. */
  mood?: BellMood;
  /** Pet-only playback multiplier. Mr. Bell keeps his authored timing. */
  playbackRate?: number;
  className?: string;
}

export default function Mascot({
  size = 160,
  petSize,
  mood = 'idle',
  playbackRate,
  className,
}: MascotProps) {
  const settings = loadSettings();
  // Azure is part of Bell itself now. The selection machinery remains intact for future use, but a
  // stale setting from an older build cannot replace the mascot shipped by this one.
  const pet = usePet('azure');
  if (!pet) return <MrBell size={size} mood={mood} className={className} />;
  if (pet.motion) {
    return (
      <BellPet
        sheet={pet.url}
        version={pet.version}
        density={pet.density}
        motion={pet.motion}
        mood={mood}
        size={petSize ?? size}
        className={className}
        reduceMotion={settings.reduceMotion}
        playbackRate={playbackRate}
      />
    );
  }
  return (
    <Pet
      sheet={pet.url}
      version={pet.version}
      density={pet.density}
      size={petSize ?? size}
      state={petStateForMood(pet.version, mood)}
      className={className}
    />
  );
}
