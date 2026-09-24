import './ToolGlyph.css';

/**
 * A drawing tool's glyph in the Shape Kit (Bell App v2): flat shapes in currentColor, with each
 * tool's own colour fixed — a blue nib, a yellow highlighter, a red eraser end.
 *
 * `hl` is the notebook editor's highlighter (a yellow square); `marker` is the Reader's, drawn as a
 * chisel-tipped pen because it sits in a row of pens.
 */
export type ToolGlyphKind = 'pen' | 'pencil' | 'hl' | 'marker' | 'er' | 'lasso' | 'shapes' | 'text';

export default function ToolGlyph({ kind }: { kind: ToolGlyphKind }) {
  const cls = `sk-tg sk-tg--${kind}`;
  if (kind === 'pen' || kind === 'pencil' || kind === 'marker')
    return (
      <span className={cls} aria-hidden="true">
        <i>
          <i />
          <i />
          <i />
        </i>
        <b />
      </span>
    );
  if (kind === 'er')
    return (
      <span className={cls} aria-hidden="true">
        <i>
          <i />
        </i>
        <b />
      </span>
    );
  return (
    <span className={cls} aria-hidden="true">
      <b>{kind === 'text' ? 'T' : null}</b>
    </span>
  );
}
