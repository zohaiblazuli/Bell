/**
 * Splash — the startup sequence: a 480 x 320 composition held for 2.0s, then a 0.9s shared-element
 * handoff into the Library. Spec: `design/specs/update-and-startup.md` PART B — `startup` (`391:3`,
 * 2000 ms) and `handoff` (`398:3`, 900 ms), with TRAPS 1-3, 8, 10, 13 and 14 applied. The timelines
 * live in Splash.css, where the percentages are the spec's own `ms / 20` and `ms / 9`.
 *
 * IT HAS A GROUND PLATE, AND NOBODY MAY TAKE IT AWAY. The Figma frame is `fills: []` and the
 * wordmark art is WHITE, because the design assumes a transparent splash window over a dark host
 * surface. Windows gives us no equivalent: the Tauri window is `decorations: false` but opaque, and
 * a transparent one is a gap recorded in the plan rather than an oversight. So this paints `--plate`
 * — the colour `body` already paints, and the only one visible at the window's rounded corners.
 * Restore the file's transparency here and the first frame is white and the wordmark invisible over
 * the light Day ground.
 *
 * APP OWNS THE CLOCK. `phase` comes in, `onFinished` goes out, and nothing in here schedules
 * anything: a slow first paint cannot leave a `setTimeout` holding the splash up, and App can cut
 * the sequence short the moment the library is ready. What it reports is `animationend` on the
 * plate rather than a duration this file restates — each phase's length lives in CSS, where reduced
 * motion shortens it, and a JS copy of 2000/900 would drift the first time either moved.
 *
 * THE LANDING SLOTS ARE MEASURED, NEVER GUESSED. A shared-element handoff needs both rects, and
 * only the live sidebar knows where its mascot slot and brand lockup sit, so they arrive as
 * `targets`. Without them there is no honest travel to run and the handoff degrades to the same
 * cross-fade that reduced motion gets.
 */
import { useLayoutEffect, useRef, type AnimationEvent, type CSSProperties } from 'react';
import MrBellMark, { MARK_BOX } from '@ui/brand/MrBellMark';
import { WORDMARK_BOX, WordmarkShapes } from '@ui/brand/Wordmark';
import Mascot from './Mascot';
import './Splash.css';

export type SplashPhase = 'splash' | 'handoff' | 'done';

/** A measured box in viewport coordinates. A `DOMRect` satisfies this as it comes. */
export interface SplashSlot {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SplashTargets {
  /** The sidebar's mascot slot (`.mascot`) — he is centred and bottom-pinned inside it. */
  mascot: SplashSlot;
  /** The sidebar's horizontal lockup (`.logo-word`). The word and mark boxes are derived from it. */
  lockup: SplashSlot;
}

export interface Props {
  /** `done` renders nothing at all, which is what hands the shell back its own logo and mascot. */
  phase: SplashPhase;
  /** The phase whose CSS timeline just ended. What happens next is App's decision, not ours. */
  onFinished: (finished: 'splash' | 'handoff') => void;
  /** Where the travelling pair lands. Absent means nothing was measured — see the header. */
  targets?: SplashTargets | null;
  /** Settings' own switch (`settings.reduceMotion`), the product twin of the OS preference. */
  reduceMotion?: boolean;
}

/** He is 160 in the splash and 160 in the sidebar slot, which is what makes the travel a pure
 *  translate with no scale track at all (spec B3). 0.625 of the 256 rig, so the 8px art grid still
 *  lands on whole pixels. */
const CRAB = 160;
const SPLASH_PET = 520;

/* `Lockup orientation="horizontal"` is a 296 x 89 viewBox with the mark at (0, 9) scaled 1.25 and
   the word at (100, 0). That geometry is private to Lockup.tsx and restated here because the
   landing pose is derived from the live lockup's measured rect — if it ever changes, this changes
   with it. Everything else comes from the primitives' own exported boxes. */
const LOCKUP_H = 89;
const LOCKUP_WORD_X = 100;
const LOCKUP_MARK_Y = 9;
const LOCKUP_MARK_SCALE = 1.25;

/* The splash pose, as centre offsets from the frame centre. Spec B3 proves the pose is one shared,
   centre-anchored layout rather than two compositions, which is also what lets it sit in a window
   instead of the file's 480 x 320 frame: the crab's box is (159, 44) in a 480 x 320 frame, i.e. its
   centre is 1px left and 36px above the centre of it. */
const CRAB_OFFSET = { x: -1, y: -36 } as const;
// Azure's startup presentation is substantially taller than Mr. Bell's original 160px rig.
// Keep the wordmark below her feet instead of letting it cross her lower body.
const WORD_OFFSET = { x: 2.8, y: 280 } as const;

/** 0.6 of the 196 x 88 master: the splash wordmark is 117.6 x 52.8 (spec B1). */
const WORD_SPLASH_H = WORDMARK_BOX.h * 0.6;

/** 0.35 of the master — the brand row's own size. Only used when nothing was measured, so that the
 *  splash pose is right even when the landing is unknown. */
const WORD_FALLBACK_H = WORDMARK_BOX.h * 0.35;

/* Beat 4's reveal, as the spec's own ms grid — rows top to bottom, columns left to right. Eight
   scattered waves of four cells, 30 ms apart, which is what makes the word dissolve in rather than
   wipe. Pasted from the numeric grid in §B2 Beat 4 rather than rebuilt from the eight wave lists,
   because one 4 x 8 table is checkable against the spec at a glance. */
const CELL_MS: readonly (readonly number[])[] = [
  [1460, 1520, 1580, 1400, 1490, 1550, 1430, 1520],
  [1580, 1460, 1400, 1550, 1490, 1430, 1610, 1520],
  [1460, 1580, 1400, 1490, 1610, 1430, 1520, 1580],
  [1610, 1460, 1550, 1400, 1610, 1490, 1550, 1430],
];

/** 8 columns x 4 rows over the master box: 196/8 = 24.5, 88/4 = 22. The spec measures the cells as
 *  14.7 x 13.2 in the splash's 117.6 x 52.8 box, which is the same thing at 0.6. */
const CELL_W = WORDMARK_BOX.w / 8;
const CELL_H = WORDMARK_BOX.h / 4;

/** Every cell is inflated by this much on all four sides. TRAPS 10 gives the file's mask group a
 *  0.5px bleed so the art has no seam at the outer edge; abutting cells need the same treatment
 *  INSIDE the grid, because two anti-aliased alpha edges meeting on a pixel composite to
 *  0.5 + 0.5 x 0.5 = 0.75, i.e. a visible lattice across the finished word. Overlapping instead of
 *  abutting costs one thing: a cell that is already on reveals ~0.3 screen px of its neighbour's
 *  art early, mid-dissolve. */
const CELL_BLEED = 0.5;

/** SVG ids are document-global and there is exactly one splash per run of the app. */
const REVEAL_ID = 'splash-wordmark-reveal';

export default function Splash({ phase, onFinished, targets = null, reduceMotion = false }: Props) {
  const root = useRef<HTMLDivElement>(null);

  /* A slot that has not been laid out yet is not a measurement, and dividing by its height would
     hand the wordmark an infinite scale. Treat a degenerate rect as absent — the cross-fade is the
     honest answer to "we do not know where this lands". */
  const landing =
    targets && targets.lockup.height > 0 && targets.mascot.height > 0 ? targets : null;

  /* The wordmark element is rendered at its LANDING size and scaled up for the splash, which is how
     spec B4 models the travel (1.714 -> 1, i.e. 0.6 / 0.35) and what keeps the landing frame pixel-
     identical to the lockup it becomes. `--word-up` is therefore derived from the measured landing
     rather than hard-coded at 1.714: the splash box stays 117.6 x 52.8 whatever the sidebar reads. */
  const wordH = landing ? (WORDMARK_BOX.h * landing.lockup.height) / LOCKUP_H : WORD_FALLBACK_H;
  const wordW = (wordH * WORDMARK_BOX.w) / WORDMARK_BOX.h;

  /** The lockup's own mark box: 64 x 1.25 = 80 viewBox units of an 89-tall box. */
  const markSize = landing ? (MARK_BOX * LOCKUP_MARK_SCALE * landing.lockup.height) / LOCKUP_H : 0;

  useLayoutEffect(() => {
    const el = root.current;
    if (!el || !landing) return;

    /* A shared-element handoff needs both rects. The landing ones are props; this one is ours, and
       measuring it beats assuming the overlay is exactly the viewport — it is positioned inside
       `.app`, and `.app` is what the window is, not necessarily what the screen is. */
    const stage = el.getBoundingClientRect();
    const cx = stage.left + stage.width / 2;
    const cy = stage.top + stage.height / 2;

    const { mascot, lockup } = landing;
    const scale = lockup.height / LOCKUP_H;

    // Centred and bottom-pinned in the slot, per app.css `.mascot`.
    const crabX = mascot.x + mascot.width / 2;
    const crabY = mascot.y + mascot.height - CRAB / 2;

    // The word half of the lockup: x 100..296 of the 296 box, so its centre is (198, 44).
    const wordX = lockup.x + (LOCKUP_WORD_X + WORDMARK_BOX.w / 2) * scale;
    const wordY = lockup.y + (WORDMARK_BOX.h / 2) * scale;

    const px = (name: string, value: number) => el.style.setProperty(name, `${value}px`);
    px('--crab-dx', crabX - (cx + CRAB_OFFSET.x));
    px('--crab-dy', crabY - (cy + CRAB_OFFSET.y));
    px('--word-dx', wordX - (cx + WORD_OFFSET.x));
    px('--word-dy', wordY - (cy + WORD_OFFSET.y));
    // The mark never travels — it fades in where it will stay — so it is placed, not offset.
    px('--mark-x', lockup.x - stage.left);
    px('--mark-y', lockup.y - stage.top + LOCKUP_MARK_Y * scale);
  }, [landing]);

  /* One signal per phase, from the plate: during the splash its animation IS the hold, and during
     the handoff it is the reveal. Both span their phase exactly, so `animationend` is the end of
     the phase — no duration is duplicated here, and a phase that is cut short simply never
     reports. */
  const report = (e: AnimationEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.animationName === 'splash-hold') onFinished('splash');
    else if (e.animationName === 'handoff-reveal') onFinished('handoff');
  };

  if (phase === 'done') return null;

  return (
    <div
      ref={root}
      className="splash"
      data-phase={phase}
      data-travel={landing ? 'on' : 'off'}
      data-motion={reduceMotion ? 'reduced' : undefined}
      style={
        {
          '--word-w': `${wordW}px`,
          '--word-h': `${wordH}px`,
          '--word-up': WORD_SPLASH_H / wordH,
        } as CSSProperties
      }
      /* Nothing here is announceable: a crab landing and a word dissolving in tell a screen reader
         nothing, and the app behind is already mounted and readable. Better to be transparent to
         assistive tech than to invent a status line for it. */
      aria-hidden="true"
      /* The window has no title bar of its own (`decorations: false`), so for the seconds this
         covers it the splash is the drag handle — same idiom as TopBar. */
      data-tauri-drag-region
    >
      <div className="splash-plate" onAnimationEnd={report} />

      <div className="splash-art">
        <div className="splash-crab">
          {/* The mascot, not necessarily the crab: the handoff hides `.mascot` and travels this box
              into that slot, so the two have to be the same animal or the landing reads as a swap. */}
          <Mascot size={CRAB} petSize={SPLASH_PET} mood="glint" playbackRate={2} />
        </div>

        <div className="splash-word">
          <svg viewBox={`0 0 ${WORDMARK_BOX.w} ${WORDMARK_BOX.h}`} width={wordW} height={wordH}>
            {/* TRAPS 8: one wordmark element for both frames, transform and colour only — the file's
                two are a masked pixel instance and a live TEXT node, and swapping representations
                mid-flight is what makes a handoff read as a cut. TRAPS 10: the mask is the reveal,
                and it is the first child. `userSpaceOnUse` because the default mask region is a
                percentage of the ink bbox, which would crop the top row's bleed. */}
            <mask
              id={REVEAL_ID}
              className="splash-reveal"
              maskUnits="userSpaceOnUse"
              x={-CELL_BLEED}
              y={-CELL_BLEED}
              width={WORDMARK_BOX.w + CELL_BLEED * 2}
              height={WORDMARK_BOX.h + CELL_BLEED * 2}
            >
              {CELL_MS.flatMap((row, r) =>
                row.map((ms, c) => (
                  <rect
                    key={`${r}-${c}`}
                    className="splash-cell"
                    x={c * CELL_W - CELL_BLEED}
                    y={r * CELL_H - CELL_BLEED}
                    width={CELL_W + CELL_BLEED * 2}
                    height={CELL_H + CELL_BLEED * 2}
                    style={{ '--at': `${ms}ms` } as CSSProperties}
                  />
                )),
              )}
            </mask>
            <g mask={`url(#${REVEAL_ID})`}>
              {/* `specs={false}`, for three reasons that agree: the 52.8 box is under Wordmark's own
                  58px floor, the crab in the frame above is already wearing them, and the mark this
                  lands beside carries them in the sidebar. The spectacles appear once. */}
              <WordmarkShapes specs={false} />
            </g>
          </svg>
        </div>

        {/* The small mark has no splash counterpart at all (spec B3), so it only exists where it can
            land: it fades in mid-travel, at the lockup's own mark box. */}
        {landing && (
          <div className="splash-mark">
            <MrBellMark size={markSize} decorative />
          </div>
        )}
      </div>
    </div>
  );
}
