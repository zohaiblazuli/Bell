/**
 * Notice — a tinted card with a warning glyph and a line of text. Supersedes five hand-assembled
 * copies of `.err`: SetupView x2, LibraryView, WorkspaceView and MarkSchemeSheet.
 *
 * Not the design system's `Update Notice` (`440:115`) — that is a 214x30 glass pill whose own fill
 * doubles as a progress bar (components-data.md §5), it is a separate component, and it already
 * spends the name `.notice`.
 *
 * Nothing in the Figma file is an error box, so this is assembled from measured parts rather than
 * invented. The surface is the dashboard hero tile `495:8446` — "fill `--accent-soft`, stroke 1px
 * `--accent` at full strength, INSIDE, radius 13" — the file's one tinted, edged card; the row
 * inside it is the 06 Ready summary-row idiom (`495:8167`: a 16x16 glyph, `itemSpacing 12`).
 * `warn` runs that recipe in `--danger` / `--danger-soft`, the pair that exists for exactly this:
 * `.err` hand-converted `--d5`, borrowing the difficulty heat scale for something that is not
 * difficulty — blocklist item 8, and the reason those two tokens were added. `info` is the recipe
 * verbatim, in the accent.
 *
 * Six things move against `.err`, the spec winning in each: radius `--r-chip` 9 → `--r-card` 13
 * (it is a card), padding 10/12 → 12/14, text 12.5px → Body/Default 13, the border from a 35 %
 * mix of `--danger` to full strength, the baked `margin-top: 16px` gone, and the glyph moves in
 * here at the measured 16px instead of the 14 four call sites hand-set with a `verticalAlign`.
 */
import type { ReactNode } from 'react';

export type NoticeTone = 'warn' | 'info';

export interface NoticeProps {
  /**
   * `warn` is the danger pair, `info` the accent one. Defaults to `warn`: all five call sites this
   * replaces are failures.
   */
  tone?: NoticeTone;
  children: ReactNode;
  className?: string;
}

export default function Notice({ tone = 'warn', children, className }: NoticeProps) {
  return (
    <div
      className={['bell-notice', tone === 'info' && 'bell-notice--info', className]
        .filter(Boolean)
        .join(' ')}
      // A notice appears because of something that just happened, so it announces itself:
      // assertive for a failure, polite for information. Mounting the element only when there is
      // something to say is the React form of a live region, and is announced on insert.
      role={tone === 'warn' ? 'alert' : 'status'}
    >
      {/* The sprite is mounted once at the app root and a `<use>` clone takes its paint from the
          use site (components/Sprite.tsx). Both tones clone `warn`: the 45-glyph set has no `info`
          glyph, so the tone is carried by colour alone. If one is ever drawn, it belongs here. */}
      <svg className="bell-notice__glyph" aria-hidden="true">
        <use href="#i-warn" />
      </svg>
      <span className="bell-notice__text t-body-default">{children}</span>
    </div>
  );
}
