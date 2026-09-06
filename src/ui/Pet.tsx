/**
 * Pet — one Codex pet spritesheet, playing one row.
 *
 * The sheet is an 8-column atlas of 192x208 cells with one animation per row (`src/lib/pets.ts`
 * holds the tables), so drawing a pet is: clip a window one cell wide, park the sheet at the row you
 * want, and step it sideways one cell at a time. Three elements, one job each — the box clips, the
 * middle one picks the row, the inner one carries the sheet and the animation.
 *
 * **It steps `transform`, not `background-position`.** CLAUDE.md allows `transform` and `opacity` and
 * nothing else, and a sprite walk is the one animation where the cheap way and the permitted way are
 * the same: the whole sheet is one composited layer sliding behind a clip. Which is also why the row
 * is a separate element — a single element cannot hold a static Y and an animated X in one property.
 *
 * **The keyframes carry no variables.** The travel is expressed as a percentage of the strip's own
 * width, so `-75%` means "six of eight cells" at any size, on any sheet, at any DPR — and since the
 * format only ever uses 4, 5, 6 or 8 frames a row, four static rules cover every pet there can be.
 * That closed set is what keeps `steps()` a literal rather than a `var()` nobody would notice failing.
 *
 * `image-rendering: pixelated` is not a preference. These are hand-placed pixels and the box is not a
 * whole multiple of 192; smoothing them turns a crisp eye into a grey smudge.
 */
import type { CSSProperties } from 'react';
import { PET_CELL, PET_COLUMNS, PET_FPS, petRowCount, petRowFor } from '@/lib/pets';
import type { AtlasVersion, PetState } from '@/lib/pets';

export interface PetProps {
  /**
   * The spritesheet as a `blob:` or `data:` URL — never a remote one. `img-src` is
   * `'self' data: blob:`, and the bytes come through `pet_sheet` for exactly that reason.
   */
  sheet: string;
  /** Measured from the decoded image, never read from `pet.json`. */
  version: AtlasVersion;
  /** Physical source pixels per logical atlas pixel. */
  density?: number;
  /**
   * Box height in px, the same number `MrBell` takes: 160 in every mascot slot, 96 in a dialog. A
   * cell is taller than it is wide, so the drawn box is `size` tall and `size * 192/208` wide — which
   * keeps a pet inside the square footprint Mr. Bell occupied rather than displacing the layout.
   */
  size?: number | string;
  state?: PetState;
  className?: string;
}

export default function Pet({
  sheet,
  version,
  density = 1,
  size = 160,
  state = 'idle',
  className,
}: PetProps) {
  const rows = petRowCount(version);
  // Defensive rather than expected: `petStateForMood` only ever returns a row this version carries.
  const row = petRowFor(version, state) ?? petRowFor(version, 'idle')!;

  const cssSize = typeof size === 'number' ? `${size}px` : size;

  /** The whole sheet, sized past the clip on both axes and parked on `row`. */
  const sheetBox: CSSProperties = {
    width: `${PET_COLUMNS * 100}%`,
    height: `${rows * 100}%`,
    // A percentage of the sheet itself: one row is exactly 100 / rows of this box.
    transform: `translateY(${(-row.row / rows) * 100}%)`,
  };

  return (
    <div
      className={className ? `pet ${className}` : 'pet'}
      /* Square, and exactly the box `MrBell` would have taken — so `<Pet>` is a pure swap for him at
         every call site and no slot's CSS has to learn that a cell is 192 wide and 208 tall. */
      style={{ width: cssSize, height: cssSize }}
      /* Nearest-neighbour is only right on the way up — see the note in Pet.css. */
      data-upscaled={
        typeof size === 'number' && size >= PET_CELL.h * density ? '' : undefined
      }
      /* Decorative. Every screen that hosts a mascot also names the app somewhere, and announcing
         somebody's pixel crab by name tells a screen reader nothing it needs. Same call MrBell makes. */
      aria-hidden
    >
      <div
        className="pet__clip"
        style={{ width: `${(PET_CELL.w / PET_CELL.h) * 100}%`, height: '100%' }}
      >
        <div className="pet__row" style={sheetBox}>
          <div
            className="pet__strip"
            data-frames={row.frames}
            style={{
              backgroundImage: `url("${sheet}")`,
              animationDuration: `${row.frames / PET_FPS}s`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
