import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import OwlMark from './shapekit/OwlMark';
import SubjectIcon, { SUBJECT_GLYPH_BY_CODE } from './icons/SubjectIcon';
import type { CoverId, StickerId } from '@/lib/notebooks';

/**
 * Notebook Cover — Bell App v2's "Exercise book": the cover is the subject's colour with an ink
 * spine, and a school-book label sheet printed on it — the subject's mark and BELL · A LEVEL, then
 * SUBJECT, CODE and BOOK rows — with the page count at the foot. A notebook with no subject keeps
 * the cover colour its author picked and is labelled General. Colours are literal because a cover is
 * an object and a real notebook does not change colour with the lights.
 */

/** A notebook's subject, as `NbAuthored.subject` stores it. */
export type CoverSubject = { code: string; name: string } | null;

/**
 * The cover colour and the ink printed on it. The three flagship subjects keep the design's
 * pairings (Physics blue, Mathematics red, Computer Science yellow), Chemistry is green, and every
 * other subject is an ink book. Codes at any level go through their subject family.
 */
export function coverColours(subject: CoverSubject, cover: CoverId): { bg: string; fg: string } {
  if (!subject) return { bg: `var(--cover-${cover})`, fg: 'var(--cover-label, var(--sk-black))' };
  const glyph = SUBJECT_GLYPH_BY_CODE[subject.code.trim().padStart(4, '0')];
  switch (glyph) {
    case 'physics':
      return { bg: 'var(--sk-blue)', fg: 'var(--sk-cream)' };
    case 'maths':
    case 'further-maths':
    case 'add-maths':
      return { bg: 'var(--sk-red)', fg: 'var(--sk-cream)' };
    case 'computing':
      return { bg: 'var(--sk-yellow)', fg: 'var(--sk-black)' };
    case 'chemistry':
      return { bg: 'var(--sk-green)', fg: 'var(--sk-cream)' };
    default:
      return { bg: 'var(--sk-black)', fg: 'var(--sk-cream)' };
  }
}

/** The level a syllabus code belongs to, for the label's masthead. */
function levelOf(code: string): string {
  const c = code.trim().padStart(4, '0');
  if (c.startsWith('9')) return 'A LEVEL';
  if (c.startsWith('0')) return 'IGCSE';
  return 'O LEVEL';
}

export interface ExerciseBookProps {
  subject: CoverSubject;
  cover: CoverId;
  /** "No. 2" — this notebook's place among the ones for the same subject. */
  bookNo?: number;
  pages?: number;
  /** Printed on a General book's label in place of a subject mark. */
  sticker?: ReactNode;
  style?: CSSProperties;
}

/** The cover face alone: fills its box, drawn for a 240 × 196 shelf card. */
export function ExerciseBook({ subject, cover, bookNo, pages, sticker, style }: ExerciseBookProps) {
  const { bg, fg } = coverColours(subject, cover);
  return (
    <span className="nbc-book" style={{ background: bg, color: fg, ...style }} aria-hidden="true">
      <b className="nbc-book__spine" />
      <span className="nbc-book__label">
        <span className="nbc-book__mast">
          {subject ? <SubjectIcon code={subject.code} size={16} /> : sticker ?? <OwlMark size={16} />}
          <span>BELL · {subject ? levelOf(subject.code) : 'NOTEBOOK'}</span>
        </span>
        <span className="nbc-book__rows">
          <span className="nbc-book__key">SUBJECT</span>
          <span className="nbc-book__val">{subject ? subject.name : 'General'}</span>
          <span className="nbc-book__key">CODE</span>
          <span className="nbc-book__val nbc-book__val--mono">{subject ? subject.code : '—'}</span>
          <span className="nbc-book__key">BOOK</span>
          <span className="nbc-book__val">{bookNo ? `No. ${bookNo}` : 'New'}</span>
        </span>
      </span>
      {pages != null && <span className="nbc-book__pp">{pages} pp</span>}
    </span>
  );
}

/** The shelf card's cover is this wide; the label is laid out in its pixels. */
const ART_W = 240;

/**
 * `ExerciseBook` for a box of any size: laid out at shelf width and scaled to fit, so a small cover
 * shows the same book rather than a crop of the big one's label.
 */
export function ScaledExerciseBook({ className, ...book }: ExerciseBookProps & { className?: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const k = size && size.w > 0 ? size.w / ART_W : 0;
  return (
    <span ref={box} className={className ? `nbc-scaled ${className}` : 'nbc-scaled'} aria-hidden="true">
      {k > 0 && size && (
        <ExerciseBook
          {...book}
          style={{ inset: 'auto', width: ART_W, height: size.h / k, transform: `scale(${k})`, transformOrigin: '0 0' }}
        />
      )}
    </span>
  );
}

const CODE_FOR_GLYPH: Record<string, string> = {};
for (const [code, glyph] of Object.entries(SUBJECT_GLYPH_BY_CODE)) CODE_FOR_GLYPH[glyph] ??= code;

export function StickerGlyph({ id, size = 28 }: { id: StickerId; size?: number }) {
  if (!id) return null;
  if (id === 'bell') return <OwlMark size={size} />;
  return <SubjectIcon code={CODE_FOR_GLYPH[id] ?? id} size={size} />;
}

export interface NotebookCoverProps {
  cover: CoverId;
  subject: CoverSubject;
  bookNo?: number;
  pages?: number;
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
  subject,
  bookNo,
  pages,
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
        <ExerciseBook
          subject={subject}
          cover={cover}
          bookNo={bookNo}
          pages={pages}
          sticker={showSticker && sticker ? sticker : undefined}
        />
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
