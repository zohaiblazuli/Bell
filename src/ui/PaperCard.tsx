/**
 * Paper Card — the unit of the library grid. Spec: `design/specs/components-data.md` §2
 * (COMPONENT_SET `66:359`), placed in `screen-library-settings.md` §5.3-5.4 and
 * `screen-bookmarks-recent.md` §5a.
 *
 * FLUID BY CONSTRUCTION. The master is 280 x 128 and `layoutSizingHorizontal: FIXED`, but every
 * instance in a grid row is FILL, so a column resolves to (1020 - 2x14) / 3 = 330.667 — +50.67px,
 * +18.1% over the master. Neither number appears here: the card never states a width, the grid owns
 * the track (`repeat(3, minmax(0, 1fr))`, gap 14), and the height HUGs — which is why both widths
 * measure 128 tall. Nothing inside grows with width.
 *
 * TWO DELIBERATE DEVIATIONS FROM FIGMA, both to protect shipped behaviour:
 *
 *   1. THREE mark toggles, not one. The file draws a single 16x16 bookmark (`66:242`). The app has
 *      marked papers bookmarked / done / flagged-for-revision since Phase 3, all three writing
 *      through `store.ts`, so shipping Figma's lone control would delete two live features. The
 *      bookmark is always visible — it *is* the file's `Bookmarked` variant — while done and
 *      revision fade in on hover or focus. A toggle that is ON stays visible at rest: a mark you
 *      cannot see is not a mark. So an unmarked, un-hovered card still matches the file exactly.
 *   2. NO score. The nested meter runs `Show Score = false` on all nine cards of both screens
 *      (§3.1, TRAP 4), so the numeral belongs to the standalone meter only. This card passes
 *      `showScore={false}` and deliberately has no `score` prop to pass.
 *
 * THE BODY IS THE BUTTON. The shipped card was a `<div class="card">` wrapping a
 * `<button class="card-open">`, so the hover lift and the elevation swap sat on a non-interactive
 * element and only the middle third of the card answered the keyboard. Here the shell is a plain
 * `<div>` that owns fill / stroke / radius / shadow, the body — every row the spec lists — is one
 * `<button>`, and the mark toggles are absolutely positioned SIBLINGS of that button, because a
 * button may not nest inside a button.
 *
 * Figma's `subject row` (`66:233`, SPACE_BETWEEN) and `subject label` (`66:234`, FILL) collapse into
 * one row here. Those two frames exist in the file only so the bookmark can be pushed to the far
 * end, and our bookmark is not in that row at all; the gutter it left behind is `padding-right`.
 */

import type { ReactNode } from 'react';
import Icon, { type IconName } from '../components/Icon';
import DifficultyMeter from './DifficultyMeter';
import type { Band } from '../lib/difficulty';

/**
 * The three toggles. `bookmarked` is this component's name for the store's `bookmarks` set: the card
 * speaks the Figma variant's word, the store keeps its own key, and the call site maps between them.
 */
export type MarkName = 'bookmarked' | 'done' | 'revision';

export interface PaperCardMarks {
  bookmarked: boolean;
  done: boolean;
  revision: boolean;
}

/**
 * Left to right, so the bookmark keeps Figma's slot hard against the inner right edge and the two
 * app-only toggles queue up to its left, sliding out from under it. Labels are LibraryView's own
 * strings, verbatim, so the wording does not fork; glyphs are the shipped sprite's.
 */
const MARKS: { name: MarkName; icon: IconName; on: string; off: string }[] = [
  { name: 'revision', icon: 'sync', on: 'Clear revision flag', off: 'Flag for revision' },
  { name: 'done', icon: 'checkc', on: 'Mark as not done', off: 'Mark as done' },
  { name: 'bookmarked', icon: 'bm', on: 'Remove bookmark', off: 'Bookmark this paper' },
];

/** The four brand tints a subject can wear. Mode-invariant — `--iris-*` never retones. */
const TINTS = ['var(--iris-1)', 'var(--iris-2)', 'var(--iris-3)', 'var(--iris-4)'];

/**
 * Subject glyphs are tinted by a hash of the subject, on the card and in the sidebar alike
 * (`screen-bookmarks-recent.md` note 7). This is the sidebar's shipped hash (`Sidebar.tsx`
 * `dotFor`), and it reproduces the measured value: the char codes of `9706` sum to 214, and
 * 214 % 4 = 2 -> `--iris-3`, exactly the `#1436C8` pixel-sampled off Accounting's glyph in the
 * Night render. One function, so a subject wears one colour everywhere.
 */
export function subjectTint(subjectCode: string): string {
  return TINTS[[...subjectCode].reduce((sum, c) => sum + c.charCodeAt(0), 0) % TINTS.length];
}

export interface PaperCardProps {
  /** Subject name — `Accounting`. One line, ellipsised: `66:241` is FILL, 1 line, ellipsis. */
  subject: string;
  /** Syllabus code — `9706`. Also hashes the subject glyph's tint. */
  subjectCode: string;
  /**
   * Paper and variant digits WITHOUT the slash — `12`. Figma's TEXT default is the string `/12`,
   * but the app's `PaperRow.variant` is `12`, so the slash is drawn here; a leading one that slips
   * through is dropped rather than rendered twice.
   */
  variant?: string | null;
  /** The rendered session — `May/June 2015`, i.e. `sessionLabel(scode)`, never the raw `s15`. */
  session: string;
  /** The extra documents as one string — `mark scheme · report`. */
  documents?: string;
  /** Figma's `Show Documents`. False hides the separator AND the documents — `66:249` and `66:250`. */
  showDocuments?: boolean;
  /**
   * Figma's `Bookmarked` variant. Optional, and it OVERRIDES `marks.bookmarked` when given, for a
   * surface that already knows the answer without consulting the live set — the Bookmarks screen
   * renders nine cards, all Yes. Pass one or the other, not both, unless the override is the point.
   */
  bookmarked?: boolean;
  /** Which band the meter lights, from `bandFor(score)`. Owned by `src/lib/difficulty.ts`. */
  band: Band;
  marks: PaperCardMarks;
  onMark: (mark: MarkName) => void;
  onOpen: () => void;
  /**
   * The 18x18 subject glyph (`66:235`, INSTANCE_SWAP -> `Subject Icon` `47:81`) — a slot, not a
   * name, so the card never owns the code-to-glyph lookup. The slot collapses when empty, and
   * whatever lands in it inherits the hashed tint through `color`.
   */
  icon?: ReactNode;
  className?: string;
}

export default function PaperCard({
  subject,
  subjectCode,
  variant,
  session,
  documents,
  showDocuments = true,
  bookmarked,
  band,
  marks,
  onMark,
  onOpen,
  icon,
  className,
}: PaperCardProps) {
  const on: PaperCardMarks = { ...marks, bookmarked: bookmarked ?? marks.bookmarked };
  const paper = variant ? variant.replace(/^\//, '') : '';
  /** Show Documents gates the separator and the text together; an empty string is the same case. */
  const docs = showDocuments && documents ? documents : null;

  return (
    <div className={className ? `paper-card ${className}` : 'paper-card'}>
      <button type="button" className="pc-body" onClick={onOpen}>
        <span className="pc-id">
          <span className="pc-subject">
            {icon && (
              <span className="pc-icon" style={{ color: subjectTint(subjectCode) }}>
                {icon}
              </span>
            )}
            <span className="pc-title t-title-card">{subject}</span>
          </span>

          {/* Mono/Meta 12 for both halves, NOT the 15px `.t-mono-paper-code` whose name predates
              this measurement. `66:245` is --ink-2, `66:246` is --ink-3. */}
          <span className="pc-code">
            <span className="pc-code-num t-mono-meta">{subjectCode}</span>
            {paper && <span className="pc-code-var t-mono-meta">/{paper}</span>}
          </span>
        </span>

        <span className="pc-meta t-body-meta">
          <span className="pc-session">{session}</span>
          {docs && (
            <>
              <span className="pc-sep" aria-hidden="true">
                ·
              </span>
              <span className="pc-docs">{docs}</span>
            </>
          )}
        </span>

        {/* `foot` `66:251`: one hairline, then the meter at FILL with the score gated off. */}
        <span className="pc-foot">
          <DifficultyMeter band={band} showScore={false} />
        </span>
      </button>

      {/* Siblings, not children: a nested button is invalid and unreachable. Positioned back into
          the subject row's right end — the arithmetic is in PaperCard.css. */}
      <span className="pc-marks">
        {MARKS.map((m) => (
          <button
            key={m.name}
            type="button"
            className="pc-mark"
            data-mark={m.name}
            aria-pressed={on[m.name]}
            aria-label={on[m.name] ? m.on : m.off}
            title={on[m.name] ? m.on : m.off}
            onClick={() => onMark(m.name)}
          >
            <Icon name={m.icon} />
          </button>
        ))}
      </span>
    </div>
  );
}
