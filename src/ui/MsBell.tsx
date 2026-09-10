/**
 * Ms. Bell — 3D Rendered GIF Mascot.
 *
 * Sourced from high-fidelity renders in `msbell/`:
 * - `msbell_idle.gif` … `msbell_idle_5.gif`: 5 ambient idle variants, cycled sequentially as a routine.
 * - `msbell_sleeping.gif`: Inactive sleep loop (triggered after 60s idle).
 * - `msbell_study_start.gif`: Entrance sequence when opening any study area (PDF viewer / notebook).
 * - `msbell_study_loop.gif`: Continuous study loop that takes over once the start sequence completes.
 * - `msbell_interact_1.gif` … `msbell_interact_3.gif`: One-shot reactions, one picked at random per poke.
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

interface AnimationVariant {
  src: string;
  durationMs: number;
}

const IDLE_VARIANTS: AnimationVariant[] = [
  { src: '/msbell/msbell_idle.gif', durationMs: 19_640 },
  { src: '/msbell/msbell_idle_2.gif', durationMs: 9_920 },
  { src: '/msbell/msbell_idle_3.gif', durationMs: 9_440 },
  { src: '/msbell/msbell_idle_4.gif', durationMs: 9_920 },
  { src: '/msbell/msbell_idle_5.gif', durationMs: 9_920 },
];
const SLEEP_GIF = '/msbell/msbell_sleeping.gif';
const STUDY_START_GIF = '/msbell/msbell_study_start.gif';
const STUDY_LOOP_GIF = '/msbell/msbell_study_loop.gif';
const INTERACT_VARIANTS: AnimationVariant[] = [
  { src: '/msbell/msbell_interact_1.gif', durationMs: 8720 },
  { src: '/msbell/msbell_interact_2.gif', durationMs: 8640 },
  { src: '/msbell/msbell_interact_3.gif', durationMs: 9160 },
];
const STARTUP_SPLASH_GIF = '/msbell/startup_splash.gif';

/** 196 clean frames at 25 fps = 7840ms */
const STUDY_START_DURATION_MS = 7840;

const cssSize = (size: number | string) => (typeof size === 'number' ? `${size}px` : size);

const FADE = 'opacity 0.24s cubic-bezier(0.4, 0, 0.2, 1)';
const FADE_DELAYED = 'opacity 0.24s 0.18s cubic-bezier(0.4, 0, 0.2, 1)';

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

  // Idle routine: cycle through all variants sequentially.
  const [idleIndex, setIdleIndex] = useState(0);
  const idleGif = IDLE_VARIANTS[idleIndex].src;

  const [studyPhase, setStudyPhase] = useState<'start' | 'loop'>('start');
  const [startSessionId, setStartSessionId] = useState<number>(() => Date.now());
  const [poked, setPoked] = useState(false);
  /** The interact overlay's current src — non-null means it is visible and playing. */
  const [interactSrc, setInteractSrc] = useState<string | null>(null);

  // Preload interact variants (must be instant on poke) + essential GIFs.
  // Idles are heavy (80–180 MB each) so only the *next* variant is preloaded,
  // keeping at most two idles in memory at a time.
  useEffect(() => {
    const preload = (src: string) => {
      const img = new Image();
      img.src = src;
    };
    for (const v of INTERACT_VARIANTS) preload(v.src);
    preload(SLEEP_GIF);
    preload(STUDY_LOOP_GIF);
    preload(STARTUP_SPLASH_GIF);
  }, []);

  // Preload the next idle variant in the cycle so the cross-fade is seamless.
  useEffect(() => {
    const nextIndex = (idleIndex + 1) % IDLE_VARIANTS.length;
    const img = new Image();
    img.src = IDLE_VARIANTS[nextIndex].src;
  }, [idleIndex]);

  // Advance the idle routine sequentially based on each animation's authored phrase length.
  useEffect(() => {
    if (isStudy || isSleep || isSplash) return;
    const currentDuration = IDLE_VARIANTS[idleIndex].durationMs;
    const timer = window.setTimeout(() => {
      setIdleIndex(i => (i + 1) % IDLE_VARIANTS.length);
    }, currentDuration);
    return () => window.clearTimeout(timer);
  }, [idleIndex, isStudy, isSleep, isSplash]);

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
  const lastInteractIdxRef = useRef<number>(-1);
  const interactDeckRef = useRef<number[]>([]);

  const handlePointerDown = useCallback(() => {
    setPoked(true);
    window.clearTimeout(pokeTimerRef.current);
    pokeTimerRef.current = window.setTimeout(() => setPoked(false), 420);

    // Trigger the interact GIF (only when not in splash, study, or sleep)
    if (!isSplash && !isStudy && !isSleep) {
      // Fair shuffle deck: guarantees all 3 interact variants play equally
      // without repeats or bias toward any single animation.
      if (interactDeckRef.current.length === 0) {
        const indices = [0, 1, 2];
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        if (indices[0] === lastInteractIdxRef.current) {
          indices.push(indices.shift()!);
        }
        interactDeckRef.current = indices;
      }
      const nextIdx = interactDeckRef.current.shift()!;
      lastInteractIdxRef.current = nextIdx;
      const picked = INTERACT_VARIANTS[nextIdx];

      // Cache-bust forces restart from frame 0.
      setInteractSrc(`${picked.src}?t=${Date.now()}`);
      window.clearTimeout(interactTimerRef.current);
      interactTimerRef.current = window.setTimeout(() => {
        setInteractSrc(null);
      }, picked.durationMs);
    }
  }, [isSplash, isStudy, isSleep]);

  useEffect(() => () => {
    window.clearTimeout(pokeTimerRef.current);
    window.clearTimeout(interactTimerRef.current);
  }, []);

  // ── Post-interact flash fix ──────────────────────────────────────────────
  // The CSS `:has(.ms-bell__interact)` rule force-hides the A/B frame images
  // with `opacity:0!important; transition:none!important`.  When the interact
  // overlay unmounts the rule un-matches and the *transition* reverts to the
  // base 240 ms ease — causing a visible fade-in gap (the "flash").  We
  // counter this by holding `transition:none` inline for one paint frame so
  // the idle snaps back to full opacity instantly.
  const [postInteract, setPostInteract] = useState(false);
  const prevInteractRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevInteractRef.current && !interactSrc) {
      setPostInteract(true);
      const id = window.setTimeout(() => setPostInteract(false), 60);
      return () => window.clearTimeout(id);
    }
    prevInteractRef.current = interactSrc;
  }, [interactSrc]);

  // Determine current target GIF source
  let targetSrc = idleGif;
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

  const handleSlotLoad = useCallback((slot: SlotId, loadedSrc: string) => {
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

    if (inactiveSrc && img && img.src.includes(inactiveSrc) && img.complete && img.naturalWidth > 0) {
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
              transition: postInteract
                ? 'none'
                : visibleSlot === 'A' ? FADE : FADE_DELAYED,
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
              transition: postInteract
                ? 'none'
                : visibleSlot === 'B' ? FADE : FADE_DELAYED,
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
