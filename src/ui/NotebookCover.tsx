/**
 * Notebook Cover — the shelf tile, and a student's notebook drawn as a physical object rather than
 * a card with a colour swatch on it. Spec: `design/specs/components-data.md` §9 (COMPONENT_SET
 * `606:50`) and `screen-notebooks.md` §4e; placed by §4c-4d.
 *
 * FLUID BY CONSTRUCTION, exactly as Paper Card is. The master is 237 x 321 and every instance on
 * the shelf is FILL, landing on 237 at the design width (237 x 4 + 24 x 3 = 1020). Neither number
 * appears below: the tile states no width, the grid owns the track, and the height HUGs.
 *
 * **Why 321 is never written down.** §9 derives it — `300 + 8 + 13` — from a FIXED 300 book, the
 * 8px tile gap and one 11px line of `Body/Meta`. That last 13 is a font metric, so pinning the tile
 * height would crop the `edited` line on any machine whose SF Pro measures differently
 * (components-data TRAP 18). The book's 300 *is* stated, because Figma authors it FILL / FIXED:
 * the width is fluid and the height is a literal. So a wide window widens the tile without making
 * it taller, which is the file's own sizing rather than a compromise made here.
 *
 * `front` is 185 wide at 26,34 inside 237 — a symmetric 26px inset (26 + 185 + 26 = 237), so it is
 * expressed as one, and the label simply gets more room on a wide window. `page edges` live inside
 * that right inset (231 + 6 = 237) and stay 6px wide wherever the edge lands.
 *
 * **Hover changes exactly one thing** (§9): `book`'s effect style goes `Shadow/Card` →
 * `Shadow/Card Hover`. No transform, no fill change, no lift on the label — which is also why this
 * component has nothing to gate behind `prefers-reduced-motion`: nothing moves.
 *
 * **components-data TRAP 9 does not exist in CSS.** Every instance on a Night frame has to override
 * `book` to `Shadow/Card/Night` by hand because Figma ships the Day styles on the component;
 * `--shadow-card` retones on its own, so the override is the token's job here.
 *
 * The 16 variants are `Cover 1…8` x `State Default | Hover`. `cover` is a prop and hover is
 * `:hover`, the same split every other primitive in this layer makes — a design-time variant grid
 * is not a runtime API. There is deliberately **no `selected` prop**: nothing on either notebook
 * screen selects a tile, the shelf opens on press and the dialog's preview is inert.
 */
import type { ReactNode } from 'react';
import MrBellMark from './brand/MrBellMark';
import SubjectIcon, { SUBJECT_GLYPH_BY_CODE } from './icons/SubjectIcon';
import type { CoverId, StickerId } from '@/lib/notebooks';

/* The coils, from §4e: 7 of them, 8 x 8 at x 3 inside a 14-wide spine, pitch 34, first centre y 48.
   Everything else about `rings` is arithmetic over those four numbers — the box is 14 x 212 at
   (0,44) and the last centre lands on 252, leaving 48px clear top and bottom in a 300-tall book.
   Deriving it rather than listing seven y values is what keeps that symmetry true by construction:
   §9 calls it "what makes the spine read as a continuous wire rather than a run of dots that
   happens to stop". */
const COIL_COUNT = 7;
const COIL_PITCH = 34;
const COIL_FIRST = 48;
const COIL_R = 4;

/** `rings` 14 x 212 @(0,44) — the box the coils need, and nothing more. */
const RINGS_TOP = COIL_FIRST - COIL_R;
const RINGS_H = COIL_PITCH * (COIL_COUNT - 1) + COIL_R * 2;
const RINGS_W = 14;
/** Centres inside that box, so coil 0 sits at absolute y 48 and coil 6 at 252. */
const COIL_CY = Array.from({ length: COIL_COUNT }, (_, i) => COIL_R + COIL_PITCH * i);

/**
 * Glyph name → any syllabus code that draws it.
 *
 * `StickerId` stores a `Subject Icon` glyph name (`physics`, `maths`, …) while `SubjectIcon` is
 * keyed by syllabus code — Cambridge issues one subject under a different code at every level, so
 * the code is what the app's rows carry. Inverting the code table is the whole of the bridge: every
 * code that maps to a glyph draws the same 24-unit vector, so which one wins does not matter, and
 * building it from `SUBJECT_GLYPH_BY_CODE` rather than writing a second table means it cannot drift
 * when a syllabus is added over there.
 */
const CODE_FOR_GLYPH: Record<string, string> = {};
for (const [code, glyph] of Object.entries(SUBJECT_GLYPH_BY_CODE)) CODE_FOR_GLYPH[glyph] ??= code;

/**
 * The cover sticker, resolved from what a notebook stores. `bell` is the literal `notebooks.ts`
 * reserves for `MrBellMark`; anything else is a glyph name, and an unmapped one falls through
 * `SubjectIcon`'s own `doc` fallback rather than drawing the wrong subject.
 *
 * Lives here rather than in the two screens because both of them need it and neither should own a
 * lookup the tile is the reason for.
 */
export function StickerGlyph({ id, size = 28 }: { id: StickerId; size?: number }) {
  if (!id) return null;
  if (id === 'bell') return <MrBellMark size={size} decorative />;
  return <SubjectIcon code={CODE_FOR_GLYPH[id] ?? id} size={size} />;
}

export interface NotebookCoverProps {
  /** Which of the eight mode-invariant cover tokens paints the book. §8: a cover is an object. */
  cover: CoverId;
  /** `Name#608:0` — Title/Card in `--cover-label`. One line; a long name ellipsises. */
  name: string;
  /** `Meta#608:17` — Mono/Small in `--cover-label-2`, e.g. `Physics 9702`. Omitted when unlinked. */
  meta?: string;
  /**
   * `Edited#608:34` — Body/Meta `--ink-3` under the book, e.g. `48 pages · edited 2h ago`.
   * Optional, and its absence is load-bearing: the dialog's preview has no such fact to state, and
   * dropping the line is what makes that instance measure the 202.5 §7 records rather than 216.7.
   */
  edited?: string;
  /** `Show Sticker#608:51`. */
  showSticker?: boolean;
  /**
   * `Sticker#608:85` INSTANCE_SWAP — a slot, not a name, so the tile never owns the id-to-glyph
   * lookup. `StickerGlyph` above is what call sites put in it.
   */
  sticker?: ReactNode;
  /**
   * `Show Photo#608:68`. The `photo` plate is `visible: false` in all 16 variants, so the file
   * measures its box (185 x 120, radius 8, `--cover-shade` on a 1px `--cover-wire`) and nothing
   * else; it renders where §9 lists it, between the sticker and the label.
   */
  showPhoto?: boolean;
  /** Press to open. Without it the tile is inert — which is what the dialog's preview wants. */
  onClick?: () => void;
  /** Native tooltip and accessible name for the press target. */
  title?: string;
  /**
   * APP ADDITION: an overflow control inside the tile. The file gives Delete a home only in the
   * notebook inspector, so the shelf needs somewhere quiet to put one. It is a slot rather than a
   * prop pair because the menu, its open state and the confirmation all belong to the screen — and
   * it lives *inside* this component so that reaching for it does not drop the tile's own hover.
   */
  actions?: ReactNode;
  className?: string;
}

export default function NotebookCover({
  cover,
  name,
  meta,
  edited,
  showSticker = true,
  sticker,
  showPhoto = false,
  onClick,
  title,
  actions,
  className,
}: NotebookCoverProps) {
  const body = (
    <>
      {/* `book` 237 x 300, radius `--r-card`, clipped, fill `--cover-N`. The fill is inline for the
          same reason ClipPicker's swatch is: eight tokens, one of them chosen at runtime. */}
      <span className="nbc-book" style={{ background: `var(--cover-${cover})` }}>
        <span className="nbc-spine" aria-hidden="true" />

        {/* The coils are the whole tell that this is a spiral notebook. `stroke-width` and the
            paint are in the CSS, where they can beat index.css's global `svg` rule. */}
        <svg
          className="nbc-rings"
          width={RINGS_W}
          height={RINGS_H}
          viewBox={`0 0 ${RINGS_W} ${RINGS_H}`}
          style={{ top: RINGS_TOP }}
          aria-hidden="true"
        >
          {COIL_CY.map((cy) => (
            <circle key={cy} cx={RINGS_W / 2} cy={cy} r={COIL_R} />
          ))}
        </svg>

        {/* `page edges` — three 2 x 268 rects at x 0 / 2 / 4 in `--paper` at node opacity
            1 / 0.70 / 0.45, flush to the book's right edge with 16px clear top and bottom. */}
        <span className="nbc-edges" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>

        <span className="nbc-front">
          {showSticker && <span className="nbc-sticker">{sticker}</span>}
          {showPhoto && <span className="nbc-photo" aria-hidden="true" />}
          <span className="nbc-label">
            <span className="nbc-title t-title-card">{name}</span>
            {meta ? <span className="nbc-meta t-mono-small">{meta}</span> : null}
          </span>
        </span>
      </span>

      {edited ? <span className="nbc-edited t-body-meta">{edited}</span> : null}
    </>
  );

  return (
    <div className={className ? `notebook-cover ${className}` : 'notebook-cover'}>
      {onClick ? (
        <button type="button" className="nbc-open" onClick={onClick} title={title}>
          {body}
        </button>
      ) : (
        <div className="nbc-open">{body}</div>
      )}
      {/* A sibling of the press target, never a child: a button may not nest inside a button. */}
      {actions ? <span className="nbc-actions">{actions}</span> : null}
    </div>
  );
}
