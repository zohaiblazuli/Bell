/**
 * Update Notice — the sidebar's update indicator. Geometry is
 * `design/specs/update-and-startup.md` §A2: set `440:115`, variants Available `440:112`,
 * Downloading `440:113`, Ready `440:114`. All three are 214 x 30.
 *
 * Why a 30px pill and not a card: the spec's own note on `440:118` says a 112px card would have
 * squeezed the sidebar's mascot slot to 106px against a 176px need, and Mr. Bell has only ~45px
 * of empty headroom before his artwork gets cut. So the indicator stays one line tall and the
 * dialog owns the restart moment. 214 is not arbitrary either — the sidebar is 238 wide at
 * `padding: 14px 12px`, so its content column is exactly 238 − 24 = 214.
 *
 * In Downloading the pill's own fill IS the progress bar (`438:120`): a rect pinned to the pill's
 * OUTER box, behind the label, painting over the hairline on three sides, with its left corners
 * coming from the pill's radius + clip and its right edge left as a hard vertical line. The spec's
 * formula is `width = 214 x fraction` off the outer width; `transform: scaleX()` on a full-width
 * rect is that formula with no arithmetic and nothing for the browser to re-lay-out per frame.
 */

/** Figma's only variant axis on `440:115`. */
export type UpdateNoticeState = 'available' | 'downloading' | 'ready';

/** The measured component box. 214 is the sidebar's content column; 30 is the whole argument above. */
export const NOTICE_BOX = { w: 214, h: 30 } as const;

/** Trailing glyph size: 14 x 14 = 0.583 of the icon set's 24 box (`17:119`). */
const ICON_PX = 14;

/** Verbatim from the file. Each state owns its string, so there is no label prop to get wrong. */
const TEXT: Record<UpdateNoticeState, string> = {
  available: 'Update available',
  downloading: 'Downloading',
  ready: 'Restart to update',
};

/*
 * The two trailing glyphs. The design system's 31-glyph set has neither a download nor a restart
 * icon — in Figma both are flattened SVG exports whose paint the MCP cannot resolve — so they are
 * authored here to the icon contract: a 24 box, bare paths, no presentation attributes, so
 * index.css's global `svg { fill:none; stroke:currentColor; stroke-width:1.75 }` paints them.
 * At 14px the 1.75 stroke lands at 1.02 device px, which is the same weight as every other icon
 * in the app rendered small.
 */

function DownloadGlyph() {
  return (
    <svg className="upd-icon" viewBox="0 0 24 24" width={ICON_PX} height={ICON_PX} aria-hidden="true">
      <path d="M12 4.8v9.9" />
      <path d="M8 10.9 12 14.9l4-4" />
      <path d="M5.2 16.4v1.9a1.4 1.4 0 0 0 1.4 1.4h10.8a1.4 1.4 0 0 0 1.4-1.4v-1.9" />
    </svg>
  );
}

function RestartGlyph() {
  return (
    <svg className="upd-icon" viewBox="0 0 24 24" width={ICON_PX} height={ICON_PX} aria-hidden="true">
      {/* The sprite's own `i-sync` arc mirrored about x = 12, so the gap and its corner flag sit
          top-LEFT. Same r=8 construction as the rest of the set — it reads as native, and it is
          plainly not the same glyph as sync, which the spec requires (Ready's icon differs from
          Available's). */}
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M4 4.5V10h5.5" />
    </svg>
  );
}

export interface UpdateNoticeProps {
  state: UpdateNoticeState;
  /** 0–1, Downloading only; clamped, and ignored by the other two states. */
  progress?: number;
  /** Available and Ready are tappable. Downloading is a status readout and takes no handler. */
  onClick?: () => void;
  className?: string;
}

export default function UpdateNotice({
  state,
  progress = 0,
  onClick,
  className,
}: UpdateNoticeProps) {
  const cls = className ? `upd ${className}` : 'upd';

  if (state === 'downloading') {
    const p = Math.min(1, Math.max(0, progress));
    // The measured variant reads 62% against a 133px bar: 214 x 0.62 = 132.68, rounded. scaleX
    // keeps the sub-pixel, so the bar and the readout can never disagree.
    const pct = Math.round(p * 100);
    return (
      <div
        className={cls}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Downloading update"
      >
        <span className="upd-fill" style={{ transform: `scaleX(${p})` }} aria-hidden="true" />
        <span className="upd-label">
          <span className="upd-dot" aria-hidden="true" />
          <span className="upd-text t-body-chip">{TEXT.downloading}</span>
        </span>
        {/* No trailing 14px icon in this state: the mono readout occupies that slot, so the
            right-hand inset is set by the text metrics. */}
        <span className="upd-pct t-mono-small">{pct}%</span>
      </div>
    );
  }

  return (
    <button type="button" className={cls} onClick={onClick}>
      <span className="upd-label">
        <span className="upd-dot" aria-hidden="true" />
        <span className="upd-text t-body-chip">{TEXT[state]}</span>
      </span>
      {state === 'available' ? <DownloadGlyph /> : <RestartGlyph />}
    </button>
  );
}
