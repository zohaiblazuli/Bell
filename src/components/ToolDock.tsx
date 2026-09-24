/**
 * The notebook's tool dock. Spec: `design/specs/screen-notebooks.md` §5b — 64 wide, glass with a
 * hairline on all four sides, vertical gap 6, pad 15, and 34x34 buttons separated by 24x1 rules.
 *
 * SEVEN TOOLS IN TWO GROUPS — Ink and Objects — plus undo/redo in a History group pinned to the
 * bottom. Nine buttons in all, and `sep` is what makes the groups read as groups rather than a run
 * of glyphs. The Reader ships three (`type Tool = 'pen'|'hl'|'er'`), no object model and no way to
 * select anything once it is drawn — which is what Zohaib was describing; the object model and the
 * live lasso selection are the answer.
 *
 * WHAT WAS REMOVED, at Zohaib's instruction: the dock had grown to ten tools and three of them earned
 * their place only on paper.
 *   - Image could not create anything — paste, drop and clip (all handled in `NotebookView`) do that
 *     regardless of the selected tool — and its one gesture, tap-to-select, is a strict subset of
 *     Select. It was a weaker Select with an import label it did not honour.
 *   - Sticky opened the SAME inline editor as Text and committed a text object with a yellow box; a
 *     cosmetic variant, not a tool.
 *   - Ruler was a snap-aid whose straight lines Shapes → line already draws.
 * Images and sticky notes already on a page still render and stay movable, resizable and deletable
 * through Select — removing the tools orphans no saved work. The community-reader annotation sheet
 * (`NotebookSheet`) keeps its own tool set; this trim is the desktop dock only.
 *
 * The glyphs are Bell App v2's Shape Kit tools (`ui/shapekit/ToolGlyph`) — flat shapes, not outline
 * icons — and undo/redo are the design's ↶ and ↷.
 *
 * Its CSS lives in `src/views/NotebookView.css` with the rest of the spread — the same arrangement
 * `PaperCanvas` has with `WorkspaceView.css`, and for the same reason: this is mounted nowhere else.
 */
import { Fragment } from 'react';
import ToolGlyph, { type ToolGlyphKind } from '@ui/shapekit/ToolGlyph';
import type { NbTool } from '@/lib/notebooks';

interface Entry {
  tool: NbTool;
  icon: ToolGlyphKind;
  label: string;
  /** What the button does, said plainly — this is the tooltip and it is the only place a student
   *  finds out that the eraser has two modes or that the ruler is a snap guide. */
  title: string;
}

/** §5b's tool groups, in the file's own order. A `sep` goes between each pair. */
const GROUPS: readonly (readonly Entry[])[] = [
  [
    { tool: 'pen', icon: 'pen', label: 'Pen', title: 'Pen — pressure and taper from the nib' },
    { tool: 'pencil', icon: 'pencil', label: 'Pencil', title: 'Pencil — a drier, grainier line' },
    { tool: 'hl', icon: 'hl', label: 'Highlighter', title: 'Highlighter — a flat translucent band' },
    { tool: 'er', icon: 'er', label: 'Eraser', title: 'Eraser — removes whole strokes' },
  ],
  [
    { tool: 'lasso', icon: 'lasso', label: 'Select', title: 'Select — lasso strokes and objects to move, resize by a corner, or delete' },
    { tool: 'shapes', icon: 'shapes', label: 'Shapes', title: 'Shapes — line, arrow, rectangle, ellipse' },
    { tool: 'text', icon: 'text', label: 'Text', title: 'Text — a typed block on the page' },
  ],
];

export interface Props {
  tool: NbTool;
  onTool: (tool: NbTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /**
   * Focus mode. The dock leaves by a transform and fades to nothing, which hides it from the eye and
   * from the pointer but NOT from the keyboard — sixteen invisible buttons in the tab order. `inert`
   * is the one thing that takes all three away without animating anything the design system forbids.
   */
  hidden?: boolean;
}

export default function ToolDock({
  tool,
  onTool,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  hidden = false,
}: Props) {
  return (
    <nav className="nbs-dock" aria-label="Tools" inert={hidden}>
      {GROUPS.map((group, i) => (
        <Fragment key={i}>
          {/* A real element rather than a pseudo: the dock is a flex column and a `::before` on a
              flex child becomes a flex item of that CHILD, which would put the rule inside the group
              it is meant to separate. */}
          {i > 0 && <span className="nbs-dock-sep" aria-hidden="true" />}
          <div className="nbs-dock-grp" role="group" aria-label={['Ink', 'Objects'][i]}>
            {group.map((entry) => (
              <button
                key={entry.tool}
                type="button"
                className={tool === entry.tool ? 'icobtn icobtn--on' : 'icobtn'}
                aria-label={entry.label}
                aria-pressed={tool === entry.tool}
                title={entry.title}
                onClick={() => onTool(entry.tool)}
              >
                <ToolGlyph kind={entry.icon} />
              </button>
            ))}
          </div>
        </Fragment>
      ))}

      {/* §5b's `spacer`, FILL, absorbing 277 at the design height. History belongs at the bottom
          because it acts on what you have already done, not on what you are about to do. */}
      <span className="nbs-dock-gap" />
      <span className="nbs-dock-sep" aria-hidden="true" />

      <div className="nbs-dock-grp" role="group" aria-label="History">
        <button
          type="button"
          className="icobtn nbs-dock-hist"
          aria-label="Undo"
          title="Undo — works across pages, and survives a relaunch"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <span aria-hidden="true">↶</span>
        </button>
        <button
          type="button"
          className="icobtn nbs-dock-hist"
          aria-label="Redo"
          title="Redo"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <span aria-hidden="true">↷</span>
        </button>
      </div>
    </nav>
  );
}
