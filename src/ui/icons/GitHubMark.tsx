/**
 * The GitHub mark — Figma `Brand Mark / GitHub` `427:4`, geometry from `design/specs/icons-paths.md`.
 *
 * One closed path, **fill only, no stroke** — the only fill-only whole glyph in the design system,
 * which is why it carries `fill="currentColor" stroke="none"` explicitly: the global
 * `svg { fill: none; stroke: currentColor }` rule would otherwise render it as an invisible outline.
 *
 * The 24-box is not square around the ink. The mark is 24 wide but 23.4057 tall, sitting at
 * y 0.297..23.7027 — that top gap is GitHub's own metric, so the geometry is not re-centred.
 *
 * Paint stays `currentColor`. The file binds the mark to `--ink-3`, and the credit row it lives in
 * is `--ink-3` text ("Built with ♥ by" … then the mark, then "zohaiblazuli" in `--ink-2`), so plain
 * inheritance already lands on the measured colour with no extra rule. Integration note: the Figma
 * instances carry `mix-blend-mode: darken` on the mark and `difference` on the label to compensate
 * for a raw macOS-kit fill — with the paint bound, both blend modes go away
 * (`screen-library-settings.md` §7, rows 2–3). Do not port them.
 *
 * Decorative by default: in both measured placements the handle is right beside it as text.
 */

/** The measured instance size — 11 x 11, i.e. the 24 master at 0.458, in the sidebar dev footer
 *  and again in Settings → About. Nothing in the file uses it at 24. */
export const GITHUB_MARK_SIZE = 11;

const MARK_PATH =
  'M12 0.297C5.37 0.297 0 5.67 0 12.297C0 17.6 3.438 22.097 8.205 23.682C8.805 23.795 9.025 23.424 9.025 23.105C9.025 22.82 9.015 22.065 9.01 21.065C5.672 21.789 4.968 19.455 4.968 19.455C4.422 18.07 3.633 17.7 3.633 17.7C2.546 16.956 3.717 16.971 3.717 16.971C4.922 17.055 5.555 18.207 5.555 18.207C6.625 20.042 8.364 19.512 9.05 19.205C9.158 18.429 9.467 17.9 9.81 17.6C7.145 17.3 4.344 16.268 4.344 11.67C4.344 10.36 4.809 9.29 5.579 8.45C5.444 8.147 5.039 6.927 5.684 5.274C5.684 5.274 6.689 4.952 8.984 6.504C9.944 6.237 10.964 6.105 11.984 6.099C13.004 6.105 14.024 6.237 14.99 6.504C17.27 4.952 18.275 5.274 18.275 5.274C18.92 6.927 18.515 8.147 18.395 8.45C19.16 9.29 19.625 10.36 19.625 11.67C19.625 16.28 16.82 17.295 14.15 17.59C14.57 17.95 14.96 18.686 14.96 19.81C14.96 21.416 14.945 22.706 14.945 23.096C14.945 23.411 15.155 23.786 15.77 23.666C20.565 22.092 24 17.592 24 12.297C24 5.67 18.627 0.297 12 0.297Z';

export interface GitHubMarkProps {
  /** Box in px; defaults to the 11 the file uses. */
  size?: number;
  className?: string;
}

export default function GitHubMark({ size = GITHUB_MARK_SIZE, className }: GitHubMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <path d={MARK_PATH} fill="currentColor" stroke="none" />
    </svg>
  );
}
