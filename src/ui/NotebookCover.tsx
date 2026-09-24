import type { CSSProperties, ReactNode } from 'react';
import OwlMark from './shapekit/OwlMark';
import SubjectIcon, { SUBJECT_GLYPH_BY_CODE } from './icons/SubjectIcon';
import type { CoverId, StickerId } from '@/lib/notebooks';

/**
 * Notebook Cover — Bell App v2's shelf card: a 196px Bauhaus composition (a ground colour with three
 * flat shapes and an ink spine), then the name, the subject line and when it was last edited. The
 * eight covers are fixed compositions, one per `CoverId`; their colours are literal because a cover
 * is an object and a real notebook does not change colour with the lights.
 */
type Shape = [left: string, top: string, width: string, height: string, radius: string, clip: string, colour: string];

const Y = 'var(--sk-yellow)';
const R = 'var(--sk-red)';
const B = 'var(--sk-blue)';
const K = 'var(--sk-black)';
const C = 'var(--sk-cream)';

const COMPOSITIONS: Record<CoverId, Shape[]> = {
  1: [['55%', '45%', '150px', '150px', '50%', 'none', Y], ['0', '60%', '90px', '90px', '0 90px 0 0', 'none', R], ['30%', '10%', '60px', '10px', '0', 'none', K]],
  2: [['20%', '-20%', '140px', '140px', '0 0 140px 0', 'none', K], ['55%', '50%', '80px', '80px', '0', 'none', C], ['62%', '58%', '40px', '40px', '50%', 'none', B]],
  3: [['15%', '30%', '170px', '85px', '170px 170px 0 0', 'none', B], ['60%', '8%', '50px', '50px', '50%', 'none', R], ['10%', '80%', '200px', '10px', '0', 'none', K]],
  4: [['10%', '15%', '120px', '120px', '50%', 'none', R], ['45%', '40%', '130px', '120px', '0', 'polygon(50% 0,100% 100%,0 100%)', Y]],
  5: [['50%', '0', '110px', '110px', '0 0 0 110px', 'none', B], ['12%', '55%', '70px', '70px', '50%', 'none', K], ['40%', '70%', '100px', '12px', '0', 'none', R]],
  6: [['30%', '20%', '120px', '120px', '50%', 'none', C], ['52%', '42%', '60px', '60px', '50%', 'none', K], ['0', '82%', '100%', '10px', '0', 'none', B]],
  7: [['8%', '8%', '90px', '90px', '0', 'polygon(50% 0,100% 50%,50% 100%,0 50%)', C], ['50%', '45%', '140px', '70px', '140px 140px 0 0', 'none', R]],
  8: [['-10%', '50%', '160px', '160px', '50%', 'none', Y], ['60%', '10%', '70px', '70px', '0', 'none', K], ['66%', '16%', '28px', '28px', '50%', 'none', C]],
};

const CODE_FOR_GLYPH: Record<string, string> = {};
for (const [code, glyph] of Object.entries(SUBJECT_GLYPH_BY_CODE)) CODE_FOR_GLYPH[glyph] ??= code;

export function StickerGlyph({ id, size = 28 }: { id: StickerId; size?: number }) {
  if (!id) return null;
  if (id === 'bell') return <OwlMark size={size} />;
  return <SubjectIcon code={CODE_FOR_GLYPH[id] ?? id} size={size} />;
}

/** The composition alone, for anywhere a notebook needs its face (the new-notebook preview). */
export function CoverArt({ cover, className, style }: { cover: CoverId; className?: string; style?: CSSProperties }) {
  return (
    <span className={className ? `nbc-art ${className}` : 'nbc-art'} style={{ background: `var(--cover-${cover})`, ...style }} aria-hidden="true">
      {COMPOSITIONS[cover].map(([left, top, width, height, borderRadius, clipPath, background], i) => (
        <i key={i} style={{ left, top, width, height, borderRadius, clipPath, background }} />
      ))}
      <b className="nbc-spine" />
    </span>
  );
}

export interface NotebookCoverProps {
  cover: CoverId;
  name: string;
  meta?: string;
  edited?: string;
  showSticker?: boolean;
  sticker?: ReactNode;
  /** Kept for callers; the Shape Kit cover has no photo slot. */
  showPhoto?: boolean;
  onClick?: () => void;
  title?: string;
  /** The overflow menu, pinned to the cover's top-right corner. */
  actions?: ReactNode;
  /** Position on the shelf, for the stamped-in stagger. */
  index?: number;
  className?: string;
}

export default function NotebookCover({
  cover,
  name,
  meta,
  edited,
  showSticker = true,
  sticker,
  onClick,
  title,
  actions,
  index = 0,
  className,
}: NotebookCoverProps) {
  const body = (
    <>
      <span className="nbc-face">
        <CoverArt cover={cover} />
        {showSticker && sticker && <span className="nbc-sticker">{sticker}</span>}
      </span>
      <span className="nbc-label">
        <span className="nbc-title">{name}</span>
        <span className="nbc-meta">{meta ?? ''}</span>
        {edited ? <span className="nbc-edited">{edited}</span> : null}
      </span>
    </>
  );

  return (
    <div className={className ? `notebook-cover ${className}` : 'notebook-cover'} style={{ animationDelay: `${index * 50}ms` }}>
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
