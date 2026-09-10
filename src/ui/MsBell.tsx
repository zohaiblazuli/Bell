/**
 * Ms. Bell — 3D Rendered Animated Mascot.
 *
 * Sourced from high-fidelity renders in `msbell/`:
 * - `msbell_idle.webp` … `msbell_idle_5.webp`: 5 ambient idle variants, cycled sequentially as a routine.
 * - `msbell_sleeping.webp`: Inactive sleep loop (triggered after 60s idle).
 * - `msbell_study_start.webp`: Entrance sequence when opening any study area (PDF viewer / notebook).
 * - `msbell_study_loop.webp`: Continuous study loop that takes over once the start sequence completes.
 * - `msbell_interact_1.webp` … `msbell_interact_3.webp`: One-shot reactions, one picked at random per poke.
 * - `startup_splash.webp`: Startup splash sequence where Ms. Bell writes the Bell mark on glass.
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
  { src: '/msbell/msbell_idle.webp', durationMs: 19_640 },
  { src: '/msbell/msbell_idle_2.webp', durationMs: 9_920 },
  { src: '/msbell/msbell_idle_3.webp', durationMs: 9_440 },
  { src: '/msbell/msbell_idle_4.webp', durationMs: 9_920 },
  { src: '/msbell/msbell_idle_5.webp', durationMs: 9_920 },
];
const SLEEP_GIF = '/msbell/msbell_sleeping.webp';
const STUDY_START_GIF = '/msbell/msbell_study_start.webp';
const STUDY_LOOP_GIF = '/msbell/msbell_study_loop.webp';
const INTERACT_VARIANTS: AnimationVariant[] = [
  { src: '/msbell/msbell_interact_1.webp', durationMs: 8720 },
  { src: '/msbell/msbell_interact_2.webp', durationMs: 8640 },
  { src: '/msbell/msbell_interact_3.webp', durationMs: 9160 },
];
const STARTUP_SPLASH_GIF = '/msbell/startup_splash.webp';

/** 196 clean frames at 25 fps = 7840ms */
const STUDY_START_DURATION_MS = 7840;

export const REVEAL_VARIANTS = [
  'mosaic',     // 1. Crystalline Mosaic Pixel Glitch
  'aurora',     // 2. Diagonal Laser Aurora Sweep
  'matrix',     // 3. Cyber Matrix Voxel Dissolve
  'lightning',  // 4. High-Voltage Electric Arc Flash
  'shutter',    // 5. Venetian Prismatic Slat Shutter
  'vortex',     // 6. Ethereal Radial Pastel Vortex
] as const;

export type RevealVariant = (typeof REVEAL_VARIANTS)[number];

/** Slower, cinematic transition duration for edge-feathered electric pastel reveals */
export const REVEAL_DURATION_MS = 760;

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
  // Study state is strictly gated on the studying prop (active study area session).
  // Background work (scuttle mood in MrBell's vocabulary) must not falsely trigger study animations.
  const isStudy = Boolean(studying);
  const isSleep = mood === 'sleep';

  // Idle routine: cycle through all variants sequentially.
  const [idleIndex, setIdleIndex] = useState(0);
  const idleGif = IDLE_VARIANTS[idleIndex].src;

  const [studyPhase, setStudyPhase] = useState<'start' | 'loop'>('start');
  const [startSessionId, setStartSessionId] = useState<number>(() => Date.now());
  const [poked, setPoked] = useState(false);
  /** The interact overlay's current src — non-null means it is visible and playing. */
  const [interactSrc, setInteractSrc] = useState<string | null>(null);

  // Preload interact variants (must be instant on poke) + essential animations.
  // Only the *next* idle variant is preloaded to keep memory lightweight.
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

  // Crystalline Mosaic Transition across all state changes
  const [activeReveal, setActiveReveal] = useState<RevealVariant | null>(null);
  const glitching = Boolean(activeReveal);
  const revealTimerRef = useRef<number | undefined>(undefined);

  const triggerMosaicTransition = useCallback((variant: RevealVariant = 'mosaic') => {
    if (reduceMotion || isSplash) return;
    setActiveReveal(variant);
    window.clearTimeout(revealTimerRef.current);
    revealTimerRef.current = window.setTimeout(() => {
      setActiveReveal(null);
    }, REVEAL_DURATION_MS);
  }, [reduceMotion, isSplash]);

  // Advance the idle routine sequentially with organic timing jitter
  // (varied duration so reveals happen at natural, non-monotonous times).
  useEffect(() => {
    if (isStudy || isSleep || isSplash) return;
    const baseDuration = IDLE_VARIANTS[idleIndex].durationMs;
    // Organic jitter of ±1.8s around base duration (clamped to at least 4.5s)
    const jitter = Math.floor(Math.random() * 3600 - 1800);
    const duration = Math.max(4500, baseDuration + jitter);
    const timer = window.setTimeout(() => {
      setIdleIndex(i => (i + 1) % IDLE_VARIANTS.length);
    }, duration);
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
    window.clearTimeout(revealTimerRef.current);
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
      // Trigger mosaic transition when returning from poke back to normal pose
      triggerMosaicTransition('mosaic');
      return () => window.clearTimeout(id);
    }
    prevInteractRef.current = interactSrc;
  }, [interactSrc, triggerMosaicTransition]);

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

  // ── Universal Mosaic Transition Across All State Changes ──────────────────
  // Applies the crystalline electric pastel mosaic transition whenever:
  // - switching between any of the 5 idle routines
  // - entering study mode (start animation)
  // - transitioning from study start to study loop
  // - exiting study mode back to idle
  // - entering sleep or waking up to idle
  const isFirstMountRef = useRef(true);
  const prevTargetSrcRef = useRef(targetSrc);
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      prevTargetSrcRef.current = targetSrc;
      return;
    }

    if (prevTargetSrcRef.current !== targetSrc) {
      prevTargetSrcRef.current = targetSrc;
      triggerMosaicTransition('mosaic');
    }
  }, [targetSrc, triggerMosaicTransition]);

  // Dynamic motion trail / afterimage echo (ethereal lagging silhouette)
  const activeAnimSrc = interactSrc ?? targetSrc;
  const [trailSrc, setTrailSrc] = useState<string>('');

  useEffect(() => {
    if (reduceMotion) {
      setTrailSrc('');
      return;
    }
    // Delay by 130ms and append echo parameter to give the trail an independent playback timeline
    const sep = activeAnimSrc.includes('?') ? '&' : '?';
    const echoUrl = `${activeAnimSrc}${sep}echo=1`;

    const timer = window.setTimeout(() => {
      setTrailSrc(echoUrl);
    }, 130);
    return () => window.clearTimeout(timer);
  }, [activeAnimSrc, reduceMotion]);

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
      // The inactive slot already holds this src (e.g. idle was loaded initially, study played
      // in the other slot, and now we are returning to idle). setState would be a no-op, so
      // trigger the visibility swap directly.
      handleSlotLoad(nextSlot, targetSrc);
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
      <div
        className="ms-bell__frame"
        data-glitch={glitching ? 'true' : 'false'}
        data-reveal={activeReveal ?? 'none'}
      >
        {/* Hidden SVG Filters for digital pixelated/mosaic/matrix/vortex displacement reveals */}
        <svg
          aria-hidden="true"
          style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
        >
          <defs>
            {/* 1. Crystalline Mosaic Filter */}
            <filter id="ms-bell-mosaic-glitch" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.06 0.35"
                numOctaves={2}
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale={16}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>

            {/* 2. Cyber Matrix Voxel Filter */}
            <filter id="ms-bell-filter-matrix" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence
                type="turbulence"
                baseFrequency="0.28 0.14"
                numOctaves={1}
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale={22}
                xChannelSelector="R"
                yChannelSelector="B"
              />
            </filter>

            {/* 3. Ethereal Vortex Swirl Filter */}
            <filter id="ms-bell-filter-vortex" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.03 0.03"
                numOctaves={3}
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale={20}
                xChannelSelector="G"
                yChannelSelector="R"
              />
            </filter>
          </defs>
        </svg>

        {/* Motion trail / afterimage echo (dynamic silhouette lag) */}
        {trailSrc && (
          <img
            src={trailSrc}
            alt=""
            className="ms-bell__img ms-bell__trail"
            aria-hidden="true"
            draggable={false}
          />
        )}

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

        {/* Artistic Electric Mosaic Glitch Transitions */}
        {glitching && !reduceMotion && (
          <>
            {/* Luminous Electric Pastel Halo */}
            <div className="ms-bell__electric-halo" aria-hidden="true" />

            {/* Prismatic Chromatic Aberration Slices (Blue / Pink / Lavender) */}
            <div className="ms-bell__glitch-slice ms-bell__glitch-slice--1" aria-hidden="true">
              <img
                src={slotBSrc || slotASrc}
                alt=""
                className="ms-bell__img"
                draggable={false}
              />
            </div>
            <div className="ms-bell__glitch-slice ms-bell__glitch-slice--2" aria-hidden="true">
              <img
                src={slotASrc || slotBSrc}
                alt=""
                className="ms-bell__img"
                draggable={false}
              />
            </div>
            <div className="ms-bell__glitch-slice ms-bell__glitch-slice--3" aria-hidden="true">
              <img
                src={slotBSrc || slotASrc}
                alt=""
                className="ms-bell__img"
                draggable={false}
              />
            </div>

            {/* Electric Scanline Lattice & Micro-Sparks */}
            <div className="ms-bell__glitch-scanlines" aria-hidden="true" />
            <div className="ms-bell__electric-sparks" aria-hidden="true" />
          </>
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
