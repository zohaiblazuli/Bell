/**
 * Mascot — Ms. Bell is the sole mascot across all new and existing users.
 *
 * Every call site that renders the mascot mounts `<Mascot />`.
 * Ms. Bell is unconditionally rendered with her rich animated WebP states,
 * custom idle routines, sleep cycle, interactive pokes, and study mode animations.
 */
import type { BellMood } from '@ui/brand/MrBell';
import MsBell from '@ui/MsBell';
import { loadSettings } from '@/lib/store';

export interface MascotProps {
  /** Box size in px — 160 in every sidebar and onboarding slot, 96 in a dialog. */
  size?: number;
  /** Optional pet-only size; lets non-square art use space. */
  petSize?: number | string;
  /** What the app just did, in Mr. Bell's vocabulary. Translated for Ms. Bell. */
  mood?: BellMood;
  /** Whether currently in a study area (PDF viewer / notebook). */
  studying?: boolean;
  /** Playback multiplier. */
  playbackRate?: number;
  className?: string;
  /** Whether currently running in the startup splash sequence. */
  isSplash?: boolean;
}

export default function Mascot({
  size = 160,
  petSize,
  mood = 'idle',
  studying = false,
  className,
  isSplash = false,
}: MascotProps) {
  const settings = loadSettings();
  return (
    <MsBell
      size={petSize ?? size}
      mood={mood}
      studying={studying}
      isSplash={isSplash}
      className={className}
      reduceMotion={settings.reduceMotion}
    />
  );
}
