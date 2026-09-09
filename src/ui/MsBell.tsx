/**
 * Ms. Bell — 3D Rendered GIF Mascot.
 *
 * Sourced from high-fidelity renders in `msbell/`:
 * - `msbell_idle.gif`: Default resting / active ambient animation.
 * - `msbell_sleeping.gif`: Inactive sleep loop (triggered after 60s idle).
 * - `msbell_study_start.gif`: Entrance sequence when opening any study area (PDF viewer / notebook).
 * - `msbell_study_loop.gif`: Continuous study loop that takes over once the start sequence completes.
 * - `msbell_interact_1.gif`: One-shot reaction when the user clicks / pokes Ms. Bell.
 * - `startup_splash.gif`: Startup splash sequence where Ms. Bell writes the Bell mark on glass.
 *
 * Employs a true double-buffered A/B slot cross-fade engine:
 * - Persistent DOM image slots (Slot A and Slot B) alternate foreground/background roles.
 * - Active visible slot is never unmounted and its `src` is never swapped while visible.
 * - Incoming animation loads and decodes completely in the hidden background slot (`img.decode()`).
 * - Incoming slot fades in smoothly on top over 240ms without any transparent gap or decoder flash.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BellMood } from '@ui/brand/MrBell';
import './MsBell.css';

export interface MsBellProps {
  /** Box size in px or CSS clamp expression. */
  size?: number | string;
  /** Mood timeline from Bell's mascot engine. */
  mood?: BellMood;
  /** Whether the user is currently inside a study area (any PDF viewer or notebook). */
  studying?: boolean;
  /** Whether currently running in the startup splash sequence. */
  isSplash?: boolean;
  className?: string;
  reduceMotion?: boolean;
}

const IDLE_GIF = '/msbell/msbell_idle.gif';
const SLEEP_GIF = '/msbell/msbell_sleeping.gif';
const STUDY_START_GIF = '/msbell/msbell_study_start.gif';
const STUDY_LOOP_GIF = '/msbell/msbell_study_loop.gif';
const INTERACT_GIF = '/msbell/msbell_interact_1.gif';
const STARTUP_SPLASH_GIF = '/msbell/startup_splash.gif';

/** 196 clean frames at 25 fps = 7840ms */
const STUDY_START_DURATION_MS = 7840;

/** 218 frames at 40ms = 8720ms */
const INTERACT_DURATION_MS = 8720;

const cssSize = (size: number | string) => (typeof size === 'number' ? `${size}px` : size);

type SlotId = 'A' | 'B';

export default function MsBell({
  size = 160,
  mood = 'idle',
  studying = false,
  isSplash = false,
  className,
  reduceMotion = false,
}: MsBellProps) {
  const isStudy = studying || mood === 'scuttle';
  const isSleep = mood === 'sleep';

  const [studyPhase, setStudyPhase] = useState<'start' | 'loop'>('start');
  const [startSessionId, setStartSessionId] = useState<number>(() => Date.now());
  const [poked, setPoked] = useState(false);
  /** The interact overlay's current src — non-null means it is visible and playing. */
  const [interactSrc, setInteractSrc] = useState<string | null>(null);

  // Preload all animations in the background
  useEffect(() => {
    const preload = (src: string) => {
      const img = new Image();
      img.src = src;
    };
    preload(IDLE_GIF);
    preload(SLEEP_GIF);
    preload(STUDY_LOOP_GIF);
    preload(INTERACT_GIF);
    preload(STARTUP_SPLASH_GIF);
  }, []);

  // Study sequence state machine:
  // On enter study area: play start sequence (7840ms) with unique timestamp, then switch to loop.
  const wasStudyingRef = useRef(false);
  useEffect(() => {
    if (isStudy) {
      if (!wasStudyingRef.current) {
        wasStudyingRef.current = true;
        if (reduceMotion) {
          setStudyPhase('loop');
        } else {
          setStudyPhase('start');
          setStartSessionId(Date.now());
          const timer = window.setTimeout(() => {
            setStudyPhase('loop');
          }, STUDY_START_DURATION_MS);
          return () => window.clearTimeout(timer);
        }
      }
    } else {
      if (wasStudyingRef.current) {
        wasStudyingRef.current = false;
        setStudyPhase('start');
      }
    }
  }, [isStudy, reduceMotion]);

  // Handle poke visual reaction + interact GIF
  const pokeTimerRef = useRef<number | undefined>(undefined);
  const interactTimerRef = useRef<number | undefined>(undefined);
  const handlePointerDown = useCallback(() => {
    setPoked(true);
    window.clearTimeout(pokeTimerRef.current);
    pokeTimerRef.current = window.setTimeout(() => setPoked(false), 420);

    // Trigger the interact GIF (only when not in splash, study, or sleep)
    if (!isSplash && !isStudy && !isSleep) {
      // Cache-bust forces the browser to restart the GIF from frame 0.
      setInteractSrc(`${INTERACT_GIF}?t=${Date.now()}`);
      window.clearTimeout(interactTimerRef.current);
      interactTimerRef.current = window.setTimeout(() => {
        setInteractSrc(null);
      }, INTERACT_DURATION_MS);
    }
  }, [isSplash, isStudy, isSleep]);

  useEffect(() => () => {
    window.clearTimeout(pokeTimerRef.current);
    window.clearTimeout(interactTimerRef.current);
  }, []);

  // Determine current target GIF source
  let targetSrc = IDLE_GIF;
  if (isSplash) {
    targetSrc = `${STARTUP_SPLASH_GIF}?t=${startSessionId}`;
  } else if (isStudy) {
    if (studyPhase === 'start') {
      targetSrc = `${STUDY_START_GIF}?t=${startSessionId}`;
    } else {
      targetSrc = STUDY_LOOP_GIF;
    }
  } else if (isSleep) {
    targetSrc = SLEEP_GIF;
  }

  // True Double-Buffering State Machine
  // Slot A and Slot B persist in the DOM. Neither is ever unmounted.
  const [slotASrc, setSlotASrc] = useState<string>(targetSrc);
  const [slotBSrc, setSlotBSrc] = useState<string>('');
  const [visibleSlot, setVisibleSlot] = useState<SlotId>('A');
  const [topSlot, setTopSlot] = useState<SlotId>('A');

  const imgRefA = useRef<HTMLImageElement>(null);
  const imgRefB = useRef<HTMLImageElement>(null);

  const visibleSlotRef = useRef<SlotId>('A');
  visibleSlotRef.current = visibleSlot;

  const slotASrcRef = useRef(slotASrc);
  slotASrcRef.current = slotASrc;
  const slotBSrcRef = useRef(slotBSrc);
  slotBSrcRef.current = slotBSrc;

  const targetSrcRef = useRef(targetSrc);
  targetSrcRef.current = targetSrc;

  const handleSlotLoad = useCallback(async (slot: SlotId, loadedSrc: string) => {
    const img = slot === 'A' ? imgRefA.current : imgRefB.current;
    if (img && 'decode' in img) {
      try {
        await img.decode();
      } catch {
        // Decode was interrupted or aborted; safe to ignore
      }
    }

    // Only transition if this loaded source is still the desired targetSrc
    if (targetSrcRef.current === loadedSrc) {
      setVisibleSlot(slot);
    }
  }, []);

  // When targetSrc changes, stage the new animation in the inactive slot
  useEffect(() => {
    const curVisible = visibleSlotRef.current;
    const curActiveSrc = curVisible === 'A' ? slotASrcRef.current : slotBSrcRef.current;

    // If the currently visible slot already has the exact targetSrc, nothing to do
    if (targetSrc === curActiveSrc) {
      return;
    }

    const nextSlot: SlotId = curVisible === 'A' ? 'B' : 'A';
    const nextSlotSrc = nextSlot === 'A' ? slotASrcRef.current : slotBSrcRef.current;
    setTopSlot(nextSlot);

    if (nextSlotSrc === targetSrc) {
      // The inactive slot already holds this src (e.g. idle was loaded initially, sleep played
      // in the other slot, and now we are returning to idle). setState would be a no-op, so
      // trigger the visibility swap directly.
      const img = nextSlot === 'A' ? imgRefA.current : imgRefB.current;
      if (img && img.complete && img.naturalWidth > 0) {
        handleSlotLoad(nextSlot, targetSrc);
      }
    } else if (nextSlot === 'A') {
      setSlotASrc(targetSrc);
    } else {
      setSlotBSrc(targetSrc);
    }
  }, [targetSrc, handleSlotLoad]);

  // Check if the staged slot is already cached and complete
  useEffect(() => {
    const curVisible = visibleSlotRef.current;
    const inactiveSlot: SlotId = curVisible === 'A' ? 'B' : 'A';
    const inactiveSrc = inactiveSlot === 'A' ? slotASrc : slotBSrc;
    const img = inactiveSlot === 'A' ? imgRefA.current : imgRefB.current;

    if (inactiveSrc && img && img.complete && img.naturalWidth > 0) {
      handleSlotLoad(inactiveSlot, inactiveSrc);
    }
  }, [slotASrc, slotBSrc, handleSlotLoad]);

  const rootClass = ['ms-bell', className].filter(Boolean).join(' ');

  return (
    <div
      className={rootClass}
      style={{ width: cssSize(size), height: cssSize(size) }}
      data-poked={poked ? 'true' : 'false'}
      data-study={isStudy ? studyPhase : 'off'}
      data-sleep={isSleep ? 'true' : 'false'}
      onPointerDown={handlePointerDown}
      aria-hidden="true"
    >
      <div className="ms-bell__frame">
        {/* Slot A */}
        {slotASrc && (
          <img
            ref={imgRefA}
            src={slotASrc}
            alt="Ms. Bell Mascot"
            className="ms-bell__img"
            style={{
              opacity: visibleSlot === 'A' ? 1 : 0,
              zIndex: topSlot === 'A' ? 2 : 1,
            }}
            onLoad={() => handleSlotLoad('A', slotASrc)}
          />
        )}

        {/* Slot B */}
        {slotBSrc && (
          <img
            ref={imgRefB}
            src={slotBSrc}
            alt="Ms. Bell Mascot"
            className="ms-bell__img"
            style={{
              opacity: visibleSlot === 'B' ? 1 : 0,
              zIndex: topSlot === 'B' ? 2 : 1,
            }}
            onLoad={() => handleSlotLoad('B', slotBSrc)}
          />
        )}
      </div>

        {/* Interact overlay — sits above A/B slots with no transition so it appears instantly.
            Hidden (unmounted) when not interacting; the idle GIF keeps playing underneath. */}
        {interactSrc && (
          <img
            src={interactSrc}
            alt="Ms. Bell Mascot"
            className="ms-bell__img ms-bell__interact"
          />
        )}
    </div>
  );
}
