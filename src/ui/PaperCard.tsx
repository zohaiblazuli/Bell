import { memo, type CSSProperties, type ReactNode } from 'react';
import SeasonIcon, { seasonKeyOf } from './icons/SeasonIcon';
import type { DifficultyBand } from '../lib/difficulty';

export type MarkName = 'bookmarked' | 'done' | 'revision';

export interface PaperCardMarks {
  bookmarked: boolean;
  done: boolean;
  revision: boolean;
}

export interface PaperCardProps {
  subject: string;
  subjectCode: string;
  variant?: string | null;
  /** `s25` — drives the season glyph. */
  scode?: string;
  session: string;
  documents?: string;
  band: DifficultyBand;
  /** Lit steps of the three-step difficulty meter (0 = unrated). */
  steps: number;
  marks: PaperCardMarks;
  onMark: (mark: MarkName) => void;
  onOpen: () => void;
  /** On disk: the card ends in Solve. Otherwise Download. */
  downloaded: boolean;
  downloading?: boolean;
  onDownload?: () => void;
  icon?: ReactNode;
  /** Position in its grid, for the dealt-in stagger. */
  index?: number;
  className?: string;
}

/**
 * Paper Card — Bell App v2. A card on the card colour in a 2px ink frame, dealt onto the table one
 * after another; on hover it lifts and tilts with a hard ink shadow, and presses down when clicked.
 *
 *   corner      a folded bookmark corner (ink when saved)
 *   identity    the subject mark tumbling in, subject name, `9709 /32`
 *   meta        season glyph + session · documents, then the ✓ done / ↻ revise tags
 *   foot        the 1/2/3-step difficulty meter + word, and Solve (on disk) or Download
 *
 * The done and revise tags are toggles: shown when set, and offered as outlines on hover/focus.
 */
function PaperCard({
  subject,
  subjectCode,
  variant,
  scode,
  session,
  documents,
  band,
  steps,
  marks,
  onMark,
  onOpen,
  downloaded,
  downloading = false,
  onDownload,
  icon,
  index = 0,
  className,
}: PaperCardProps) {
  const paper = variant ? variant.replace(/^\//, '') : '';
  const season = seasonKeyOf(scode);
  const delay = Math.min(index, 14) * 45;

  return (
    <div
      className={className ? `paper-card ${className}` : 'paper-card'}
      style={{ '--deal': `${delay}ms`, '--tumble': `${delay + 220}ms` } as CSSProperties}
      data-downloaded={downloaded ? 'true' : undefined}
    >
      <button type="button" className="pc-open" onClick={downloaded ? onOpen : onDownload ?? onOpen} aria-label={`${downloaded ? 'Open' : 'Download'} ${subject} ${subjectCode}/${paper}, ${session}`} />

      <button
        type="button"
        className="pc-corner"
        aria-pressed={marks.bookmarked}
        title={marks.bookmarked ? 'Remove bookmark' : 'Bookmark this paper'}
        aria-label={marks.bookmarked ? 'Remove bookmark' : 'Bookmark this paper'}
        onClick={() => onMark('bookmarked')}
      />

      <div className="pc-id">
        {icon && <span className="pc-icon">{icon}</span>}
        <span className="pc-name">
          <span className="pc-title">{subject}</span>
          <span className="pc-code">
            {subjectCode}
            {paper && <span> /{paper}</span>}
          </span>
        </span>
      </div>

      <div className="pc-meta">
        <span className="pc-session">
          {season && <SeasonIcon season={season} size={14} />}
          {session}
        </span>
        {documents && (
          <>
            <span aria-hidden="true">·</span>
            <span className="pc-docs" data-strong={documents === 'mark scheme' ? 'true' : undefined}>
              {documents}
            </span>
          </>
        )}
        <span className="pc-tags">
          <button type="button" className="pc-tag pc-tag--done" aria-pressed={marks.done} title={marks.done ? 'Mark as not done' : 'Mark as done'} onClick={() => onMark('done')}>
            ✓ done
          </button>
          <button type="button" className="pc-tag pc-tag--rev" aria-pressed={marks.revision} title={marks.revision ? 'Clear revision flag' : 'Flag for revision'} onClick={() => onMark('revision')}>
            ↻ revise
          </button>
        </span>
      </div>

      <div className="pc-foot">
        <span className="pc-band" title={band.rated ? `${band.label} paper` : 'Not rated'}>
          <span className="pc-steps" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <i key={n} style={{ background: n <= steps ? band.color : undefined }} />
            ))}
          </span>
          <span>{band.label}</span>
        </span>
        {downloaded ? (
          <button type="button" className="pc-solve" title="Open in the reader" onClick={onOpen}>
            Solve
            <i aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            className="pc-download"
            title="Download this paper to your machine"
            disabled={downloading}
            aria-busy={downloading || undefined}
            onClick={onDownload ?? onOpen}
          >
            {downloading ? 'Fetching…' : 'Download'}
            <i aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(PaperCard);
