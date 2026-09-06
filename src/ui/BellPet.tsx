/**
 * BellPet — opt-in high-fidelity motion layered over the legacy Codex pet renderer.
 *
 * Ordinary pets still render through `Pet` unchanged. A pet carrying a valid `motion.json` gets a
 * requestAnimationFrame-driven canvas for the states that definition owns; the legacy sprite stays
 * mounted beneath it and takes over again for unsupported states. The first production state is a
 * deliberately simple sleep loop: switch to the settled pose, breathe indefinitely, switch back.
 */
import { useEffect, useRef, useState } from 'react';
import type { BellMood } from '@ui/brand/MrBell';
import Pet from '@ui/Pet';
import { sampleMotionClip, type MotionClip, type MotionPage } from '@/lib/petMotion';
import { petStateForMood, type AtlasVersion } from '@/lib/pets';
import type { LoadedPetMotion } from '@/state/usePet';

export interface BellPetProps {
  sheet: string;
  version: AtlasVersion;
  density: number;
  motion: LoadedPetMotion;
  mood: BellMood;
  size?: number | string;
  className?: string;
  reduceMotion?: boolean;
  /** Playback multiplier for context-specific presentations such as the short startup splash. */
  playbackRate?: number;
}

interface DecodedPage {
  image: HTMLImageElement;
  page: MotionPage;
}

const cssSize = (size: number | string) => (typeof size === 'number' ? `${size}px` : size);

function systemPrefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('a Bell motion page could not be decoded'));
    image.src = url;
  });
}

/** Natural deceleration for a cross-fade, matching Bell's existing authored motion language. */
function smoothstep(value: number) {
  const bounded = Math.max(0, Math.min(1, value));
  return bounded * bounded * (3 - 2 * bounded);
}

const clipDuration = (clip: MotionClip) =>
  clip.frames.reduce((total, frame) => total + frame.durationMs, 0);

export default function BellPet({
  sheet,
  version,
  density,
  motion,
  mood,
  size = 160,
  className,
  reduceMotion = false,
  playbackRate = 1,
}: BellPetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pages, setPages] = useState<ReadonlyMap<string, DecodedPage> | null>(null);
  const [canvasVisible, setCanvasVisible] = useState(false);
  const [osReduced, setOsReduced] = useState(systemPrefersReducedMotion);
  const reduced = reduceMotion || osReduced;
  const canvasWidth = motion.manifest.canvas.width * motion.manifest.canvas.density;
  const canvasHeight = motion.manifest.canvas.height * motion.manifest.canvas.density;

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setOsReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    let live = true;
    void Promise.all(
      motion.manifest.pages.map(async (page) => {
        const url = motion.pages[page.id];
        if (!url) throw new Error(`Bell motion page ${page.id} was not loaded`);
        const image = await loadImage(url);
        const expectedWidth = canvasWidth * page.columns;
        const expectedHeight = canvasHeight * page.rows;
        if (image.naturalWidth !== expectedWidth || image.naturalHeight !== expectedHeight) {
          throw new Error(
            `Bell motion page ${page.id} is ${image.naturalWidth}x${image.naturalHeight}; ` +
              `expected ${expectedWidth}x${expectedHeight}`,
          );
        }
        return [page.id, { image, page }] as const;
      }),
    )
      .then((entries) => {
        if (live) setPages(new Map(entries));
      })
      .catch((error) => {
        console.warn('[pets] Bell-native motion could not start; using the legacy spritesheet.', error);
        if (live) setPages(null);
      });
    return () => {
      live = false;
    };
  }, [canvasHeight, canvasWidth, motion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !pages) {
      setCanvasVisible(false);
      return;
    }

    const definition = motion.manifest;
    const sleep = definition.states.sleep;
    const wantsSleep = mood === 'sleep';
    const moodState = wantsSleep
      ? ({ mode: 'clip', clip: sleep.loop } as const)
      : definition.states.moods?.[mood];
    let animationFrame = 0;
    let live = true;

    const drawCell = (clip: MotionClip, cell: number, alpha = 1) => {
      const decoded = pages.get(clip.page);
      if (!decoded) return;
      const sourceX = (cell % decoded.page.columns) * canvasWidth;
      const sourceY = Math.floor(cell / decoded.page.columns) * canvasHeight;
      context.globalAlpha = alpha;
      context.drawImage(
        decoded.image,
        sourceX,
        sourceY,
        canvasWidth,
        canvasHeight,
        0,
        0,
        canvasWidth,
        canvasHeight,
      );
    };

    const drawClip = (clipId: string, elapsedMs: number) => {
      const clip = definition.clips[clipId];
      const sample = sampleMotionClip(clip, elapsedMs);
      context.clearRect(0, 0, canvasWidth, canvasHeight);
      const mix = smoothstep(sample.mix);
      // Keep the outgoing cel at full coverage while the incoming cel dissolves over it. Fading
      // both transparent sprites makes their combined alpha dip around the midpoint, which exposes
      // the page behind Azure as a bright flash and changes her apparent colours.
      drawCell(clip, sample.cell);
      if (mix > 0) drawCell(clip, sample.nextCell, mix);
      context.globalAlpha = 1;
      return sample;
    };

    const emissionAt = (index: number) => 750 + index * 1900 + Math.sin(index * 2.17) * 130;

    const drawZs = (elapsedMs: number, cutoffMs = Number.POSITIVE_INFINITY) => {
      const lifetime = 2950;
      const newest = Math.floor(Math.max(0, elapsedMs - 750) / 1900);
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      for (let index = Math.max(0, newest - 2); index <= newest + 1; index += 1) {
        const emitted = emissionAt(index);
        if (emitted > cutoffMs) continue;
        const age = elapsedMs - emitted;
        if (age < 0 || age > lifetime) continue;
        const progress = age / lifetime;
        const fadeIn = smoothstep(Math.min(1, progress / 0.18));
        const fadeOut = 1 - smoothstep((progress - 0.68) / 0.32);
        const alpha = fadeIn * fadeOut;
        const direction = index % 2 === 0 ? -1 : 1;
        const x = 392 + direction * (4 + 7 * progress);
        const y = 152 - 56 * progress;
        const fontSize = 28 + 18 * progress;
        context.save();
        context.globalAlpha = alpha;
        context.font = `700 ${fontSize}px "SF Pro Text", "Segoe UI", sans-serif`;
        context.lineWidth = 5;
        context.strokeStyle = 'rgb(241 249 255)';
        context.fillStyle = 'rgb(54 139 235)';
        context.strokeText('Z', x, y);
        context.fillText('Z', x, y);
        context.restore();
      }
    };

    const drawReducedPose = () => {
      const pose = sleep.reducedPose;
      const clip = definition.clips[pose.clip];
      const frame = clip.frames[pose.frame];
      context.clearRect(0, 0, canvasWidth, canvasHeight);
      drawCell(clip, frame.cell);
      context.save();
      context.font = '700 42px "SF Pro Text", "Segoe UI", sans-serif';
      context.lineWidth = 5;
      context.strokeStyle = 'rgb(241 249 255)';
      context.fillStyle = 'rgb(54 139 235)';
      context.strokeText('Z', 392, 116);
      context.fillText('Z', 392, 116);
      context.restore();
    };

    if (!moodState || (reduced && !wantsSleep)) {
      context.clearRect(0, 0, canvasWidth, canvasHeight);
      setCanvasVisible(false);
      return;
    }

    if (reduced) {
      drawReducedPose();
      setCanvasVisible(true);
      return;
    }

    const started = performance.now();
    let routineClip = '';
    let previousRoutineClip = '';
    let routineStarted = started;
    const chooseRoutineClip = (clips: string[]) => {
      const withoutImmediateRepeat = clips.filter((clipId) => clipId !== previousRoutineClip);
      const choices = withoutImmediateRepeat.length > 0 ? withoutImmediateRepeat : clips;
      return choices[Math.floor(Math.random() * choices.length)];
    };
    const tick = (timestamp: number) => {
      if (!live) return;
      const elapsed = (timestamp - started) * playbackRate;
      let continueAnimating = true;

      if (wantsSleep) {
        drawClip(sleep.loop, elapsed);
        drawZs(elapsed);
      } else if (moodState.mode === 'clip') {
        const sample = drawClip(moodState.clip, elapsed);
        continueAnimating = !sample.complete;
      } else if (moodState.mode === 'sequence') {
        const enter = definition.clips[moodState.enter];
        const enterDuration = clipDuration(enter);
        if (elapsed < enterDuration) drawClip(moodState.enter, elapsed);
        else drawClip(moodState.loop, elapsed - enterDuration);
      } else if (moodState.mode === 'playlist') {
        const durations = moodState.clips.map((clipId) => clipDuration(definition.clips[clipId]));
        const total = durations.reduce((sum, duration) => sum + duration, 0);
        let local = elapsed % total;
        let selected = moodState.clips[moodState.clips.length - 1];
        for (let index = 0; index < moodState.clips.length; index += 1) {
          if (local < durations[index]) {
            selected = moodState.clips[index];
            break;
          }
          local -= durations[index];
        }
        drawClip(selected, local);
      } else {
        if (!routineClip) {
          routineClip = chooseRoutineClip(moodState.clips);
          routineStarted = timestamp;
        }
        const sample = drawClip(routineClip, (timestamp - routineStarted) * playbackRate);
        if (sample.complete) {
          previousRoutineClip = routineClip;
          routineClip = chooseRoutineClip(moodState.clips);
          routineStarted = timestamp;
          drawClip(routineClip, 0);
        }
      }

      if (continueAnimating) animationFrame = requestAnimationFrame(tick);
    };

    // Paint before revealing the canvas. Waiting for the first RAF leaves one transparent frame
    // between the legacy sprite and Bell-native motion, which is especially visible on pale pages.
    tick(started);
    setCanvasVisible(true);
    return () => {
      live = false;
      cancelAnimationFrame(animationFrame);
    };
  }, [canvasHeight, canvasWidth, mood, motion, pages, playbackRate, reduced]);

  const rootClass = className ? `bell-pet ${className}` : 'bell-pet';
  return (
    <div
      className={rootClass}
      style={{ width: cssSize(size), height: cssSize(size) }}
      data-canvas={canvasVisible ? 'visible' : 'hidden'}
      aria-hidden
    >
      <Pet
        sheet={sheet}
        version={version}
        density={density}
        size="100%"
        state={petStateForMood(version, mood)}
        className="bell-pet__legacy"
      />
      <canvas
        ref={canvasRef}
        className="bell-pet__canvas"
        width={canvasWidth}
        height={canvasHeight}
      />
    </div>
  );
}
