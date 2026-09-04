/**
 * The notebook's tool dock. Spec: `design/specs/screen-notebooks.md` §5b — 64 x 808 at (0,52),
 * glass with a hairline on all four sides, vertical gap 6, pad 15, and sixteen 34x34 buttons in four
 * groups separated by 24x1 rules.
 *
 * TWELVE TOOLS IN FOUR GROUPS, and that count is the argument rather than a flourish. The Reader
 * ships three (`type Tool = 'pen'|'hl'|'er'`), no object model and no way to select anything once it
 * is drawn — which is what Zohaib was describing. Ink, objects, aids, history: the groups are the
 * answer, and `sep` is what makes them read as groups rather than a run of sixteen glyphs.
 *
 * `undo` reuses the existing `ret` glyph; `redo` is a NEW glyph rather than `ret` mirrored, because
 * the Reader mirrors `ret` with a CSS transform and the result reads as a different arrow at 18px.
 *
 * Its CSS lives in `src/views/NotebookView.css` with the rest of the spread — the same arrangement
 * `PaperCanvas` has with `WorkspaceView.css`, and for the same reason: this is mounted nowhere else.
 */
import { Fragment } from 'react';
import IconButton from '@ui/IconButton';
import type { IconName } from './Icon';
import type { NbTool } from '@/lib/notebooks';

interface Entry {
  tool: NbTool;
  icon: IconName;
  label: string;
  /** What the button does, said plainly — this is the tooltip and it is the only place a student
   *  finds out that the eraser has two modes or that the ruler is a snap guide. */
  title: string;
}

/** §5b's four groups, in the file's own order. A `sep` goes between each pair. */
const GROUPS: readonly (readonly Entry[])[] = [
  [
    { tool: 'pen', icon: 'pen', label: 'Pen', title: 'Pen — pressure and taper from the nib' },
    { tool: 'pencil', icon: 'pencil', label: 'Pencil', title: 'Pencil — a drier, grainier line' },
    { tool: 'hl', icon: 'hl', label: 'Highlighter', title: 'Highlighter — a flat translucent band' },
    { tool: 'er', icon: 'eraser', label: 'Eraser', title: 'Eraser — removes whole strokes' },
  ],
  [
    { tool: 'lasso', icon: 'lasso', label: 'Select', title: 'Select — lasso strokes to move, scale, recolour or delete' },
    { tool: 'shapes', icon: 'shapes', label: 'Shapes', title: 'Shapes — line, arrow, rectangle, ellipse' },
    { tool: 'text', icon: 'text', label: 'Text', title: 'Text — a typed block on the page' },
    { tool: 'image', icon: 'image', label: 'Image', title: 'Image — paste, drop or clip one in' },
  ],
  [
    { tool: 'ruler', icon: 'ruler', label: 'Ruler', title: 'Ruler — a straight edge strokes snap to' },
    { tool: 'sticky', icon: 'sticky', label: 'Sticky note', title: 'Sticky note' },
  ],
];

export interface Props {
  tool: NbTool;
  onTool: (tool: NbTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export default function ToolDock({ tool, onTool, onUndo, onRedo, canUndo, canRedo }: Props) {
  return (
    <nav className="nbs-dock" aria-label="Tools">
      {GROUPS.map((group, i) => (
        <Fragment key={i}>
          {/* A real element rather than a pseudo: the dock is a flex column and a `::before` on a
              flex child becomes a flex item of that CHILD, which would put the rule inside the group
              it is meant to separate. */}
          {i > 0 && <span className="nbs-dock-sep" aria-hidden="true" />}
          <div className="nbs-dock-grp" role="group" aria-label={['Ink', 'Objects', 'Aids'][i]}>
            {group.map((entry) => (
              <IconButton
                key={entry.tool}
                icon={entry.icon}
                label={entry.label}
                title={entry.title}
                active={tool === entry.tool}
                onClick={() => onTool(entry.tool)}
              />
            ))}
          </div>
        </Fragment>
      ))}

      {/* §5b's `spacer`, FILL, absorbing 277 at the design height. History belongs at the bottom
          because it acts on what you have already done, not on what you are about to do. */}
      <span className="nbs-dock-gap" />
      <span className="nbs-dock-sep" aria-hidden="true" />

      <div className="nbs-dock-grp" role="group" aria-label="History">
        <IconButton
          icon="ret"
          label="Undo"
          title="Undo — works across pages, and survives a relaunch"
          disabled={!canUndo}
          onClick={onUndo}
        />
        <IconButton icon="redo" label="Redo" disabled={!canRedo} onClick={onRedo} />
      </div>
    </nav>
  );
}
