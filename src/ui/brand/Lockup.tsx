/**
 * The Bell lockups — mark plus word. Geometry from `design/specs/brand-wordmark-lockups.md`.
 *
 * Both use the wordmark's **Specs=Off** variant, so the spectacles appear once (on the mark)
 * rather than twice. Pairing Specs=On with the mark double-spectacles the identity.
 *
 * Horizontal, 296x88: mark at (0, 9) 80x80 — 1.25x — and the wordmark at (100, 0). The 20px box
 * gap reads as 25.5px optically, because the mark's ink stops 5px inside its own box and the B
 * starts 0.531px inside the wordmark's. The mark's ink top (y 19) lands within 0.641px of the
 * cap line (18.359), which is what makes the pairing look aligned rather than merely adjacent.
 * The mark box overhangs the frame by 1px (9 + 80 = 89), so the viewBox is 89 tall — clipping at
 * 88 costs a pixel of leg.
 *
 * Stacked, 196x200: mark at (48, 0) 96x96 — 1.5x — and the wordmark at (0, 112), baseline y 198.
 * x=48 is measured, not derived: it puts the mark 2px left of the frame centre and 2.5px right of
 * the type-ink centre. Neither "centred" reading is literally true; ship the measurement.
 */
import { MarkShapes } from './MrBellMark';
import { WordmarkShapes } from './Wordmark';

export interface LockupProps {
  orientation?: 'horizontal' | 'stacked';
  /** Height in px. Width follows the orientation's own ratio. */
  size?: number;
  className?: string;
}

const BOX = {
  horizontal: { w: 296, h: 89 },
  stacked: { w: 196, h: 200 },
} as const;

export default function Lockup({
  orientation = 'horizontal',
  size = 89,
  className,
}: LockupProps) {
  const box = BOX[orientation];
  const horizontal = orientation === 'horizontal';

  return (
    <svg
      className={className}
      viewBox={`0 0 ${box.w} ${box.h}`}
      height={size}
      width={(size * box.w) / box.h}
      role="img"
      aria-label="Bell"
      style={{ display: 'block' }}
    >
      {horizontal ? (
        <>
          {/* 80/64 = 1.25 */}
          <g transform="translate(0 9) scale(1.25)">
            <MarkShapes />
          </g>
          <g transform="translate(100 0)">
            <WordmarkShapes specs={false} />
          </g>
        </>
      ) : (
        <>
          {/* 96/64 = 1.5 */}
          <g transform="translate(48 0) scale(1.5)">
            <MarkShapes />
          </g>
          <g transform="translate(0 112)">
            <WordmarkShapes specs={false} />
          </g>
        </>
      )}
    </svg>
  );
}
