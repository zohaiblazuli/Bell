/**
 * Notebooks — the shelf. Spec: `design/specs/screen-notebooks.md` §2 (the layout map), §4c (the
 * content region), §4d (the eight notebooks), §4e (the tile) and §4f (the empty composition). §12
 * records the complete Day/Night delta and it is entirely tokens: geometry, structure and type are
 * identical in both tones, so nothing below branches on the tone.
 *
 * **There is no page recess on this screen, deliberately** (§3). The Dashboard and the Reader both
 * put a `--ground-veil` rect behind their content region; this one does not, because the covers are
 * saturated enough to sit on the ambient without one. So this stylesheet paints no surface at all
 * under the shelf, and that absence is the design.
 *
 * The dialogs are siblings of `.view`, not children of it. `.view` is the scroll container and
 * carries the `rise` entrance animation, and a `position: fixed` scrim inside an ancestor with a
 * running transform is positioned against that ancestor instead of the window — which would land
 * the New Notebook sheet centred on the content region for the first 400ms whenever the Reader
 * sends someone here with `openNew` set. Out of flow either way, so the fragment costs nothing.
 *
 * THREE THINGS THE FILE DOES NOT DRAW, built from its own parts rather than invented:
 *
 *   1. **The list composition.** §4c specifies the two-segment control and only ever draws the grid;
 *      there is no `list` artboard. So the rows below are assembled from the shelf's own vocabulary
 *      — the cover swatch ClipPicker already reduces the tile to, the `Card` grouped-list surface
 *      Settings and Recent use, and the same four facts the tile states. A row per notebook with its
 *      cover, name, subject, page count and edit time is the honest reading of "list".
 *   2. **Delete on the shelf.** §6c gives Delete a home in the notebook inspector's Notebook tab and
 *      nowhere else, so here it stays quiet: an overflow button revealed on hover or focus, a
 *      one-item menu, and a confirmation before anything is removed. A notebook is pages of a
 *      student's own handwriting — it is the most destructive thing on the screen, and the only one
 *      of its kind in the app that no resync can rebuild.
 *   3. **The loading state.** The file has three shelf artboards and none of them is "reading".
 *      `notebooks === null` is a different fact from having none (§4f is a real screen with copy on
 *      it), so while the list is unread this renders one status line and neither composition.
 *
 * Every number is §4c's. The 1082 max-width is the main column at the design width (1020 + 2 x 31),
 * the 31 is the gutter between the recess edge and `content`, and 26 is the gap under the top bar.
 */
import './NotebooksView.css';
import { useEffect, useMemo, useState } from 'react';
import Button from '@ui/Button';
import Card from '@ui/Card';
import Dialog from '@ui/Dialog';
import NotebookCover, { StickerGlyph } from '@ui/NotebookCover';
import Notice from '@ui/Notice';
import SegmentedControl from '@ui/SegmentedControl';
import Icon from '@/components/Icon';
import NewNotebookDialog from '@/components/NewNotebookDialog';
import type { NbAuthored, NbEntry } from '@/lib/notebooks';
import type { Subject } from '@/lib/types';

/** §4c's `view` control. Both glyphs are the segmented control's own; the labels are ours, because
 *  the segments are icon-only and that name is all a screen reader gets. */
const VIEWS = [
  { icon: 'grid', label: 'Show notebooks as covers' },
  { icon: 'list', label: 'Show notebooks as a list' },
] as const;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const DAY_MS = 86_400_000;

/** Local midnight, so a day boundary is a calendar day rather than a rolling 24 hours. */
const startOfDay = (at: number) => {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Whole calendar days back. `Math.round` absorbs the 23- and 25-hour days either side of a DST
 *  shift — the idiom LibraryView, DashboardView and ActivityGrid all use on the focus log. */
const daysAgo = (at: number) => Math.round((startOfDay(Date.now()) - startOfDay(at)) / DAY_MS);

/**
 * `edited …`, in §4d's own vocabulary: the eight notebooks read `2h ago`, `yesterday`,
 * `3 days ago`, `last week` and `2 weeks ago`. Past four weeks it becomes a date in the form §6c
 * prints for Created (`12 Aug`), because "8 weeks ago" is a number nobody counts in.
 *
 * Minutes are checked before days so a notebook edited at 23:50 and read at 00:30 says `40m ago`
 * rather than `yesterday`.
 */
function editedAgo(at: number): string {
  const minutes = Math.floor((Date.now() - at) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const days = daysAgo(at);
  if (days === 0) return `${Math.floor(minutes / 60)}h ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  if (days < 28) return `${Math.floor(days / 7)} weeks ago`;
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** §4e's `Meta#` — `Physics 9702`, the linked syllabus. Empty when nothing is linked; the tile drops
 *  the line rather than printing a placeholder. */
const metaOf = (n: NbEntry) => (n.subject ? `${n.subject.name} ${n.subject.code}` : undefined);

/** §4e's `Edited#` — `48 pages · edited 2h ago`, both halves measured rather than authored. */
const editedOf = (n: NbEntry) => `${plural(n.pages, 'page')} · edited ${editedAgo(n.updatedAt)}`;

/**
 * What the confirmation says. Named after the three things `notebooks.ts` puts on disk under a
 * notebook's directory — `pages/`, `assets/` and `history.json` — because a warning that lists what
 * actually goes is the one a student can act on.
 */
const deleteCopy = (n: NbEntry) =>
  `“${n.name}” and its ${plural(n.pages, 'page')} go — everything written on them, the clippings` +
  ' pasted onto them and the undo history behind them.';

export interface Props {
  /** null while the shelf is being read — a different state from having none. */
  notebooks: NbEntry[] | null;
  error: string | null;
  /** For the dialog's "Link a subject" chip. Same `Subject` type LibraryView takes. */
  subjects: Subject[];
  onOpen: (id: string) => void;
  onCreate: (meta: NbAuthored) => Promise<NbEntry | null>;
  onDelete: (id: string) => Promise<void>;
  /** Open the New Notebook dialog immediately — set when the Reader sent them here to make one. */
  openNew?: boolean;
  onNewHandled?: () => void;
}

export default function NotebooksView({
  notebooks,
  error,
  subjects,
  onOpen,
  onCreate,
  onDelete,
  openNew,
  onNewHandled,
}: Props) {
  /** §4c ships `Selected=1`, the grid. The toggle is view state, so it resets with the screen. */
  const [asList, setAsList] = useState(false);
  /** Which tile's overflow menu is open, by notebook id. At most one at a time. */
  const [menu, setMenu] = useState<string | null>(null);
  /** The notebook the confirmation is asking about. Null closes it. */
  const [confirm, setConfirm] = useState<NbEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  // The Reader's "clip to a new notebook" route arrives with the sheet already asked for. Handing
  // the flag straight back means it fires once and a later close does not re-open it.
  useEffect(() => {
    if (!openNew) return;
    setNewOpen(true);
    onNewHandled?.();
  }, [openNew, onNewHandled]);

  // Escape and a press outside dismiss the overflow menu — captured at the window, the way
  // ClipPicker and the palette do it, so the tile behind never reacts to the click that closed it.
  useEffect(() => {
    if (menu === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setMenu(null);
    };
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest('.nb-more')) setMenu(null);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [menu]);

  /** §4c's subline is computed, never authored: the count is the shelf's own length and the pages
   *  are summed off the rows Rust measured on disk. */
  const written = useMemo(
    () => (notebooks ?? []).reduce((sum, n) => sum + n.pages, 0),
    [notebooks],
  );

  const runDelete = async () => {
    if (!confirm || deleting) return;
    setDeleting(true);
    try {
      await onDelete(confirm.id);
    } finally {
      // Closed either way: a failure surfaces in the view's own Notice, which is behind the scrim.
      setDeleting(false);
      setConfirm(null);
    }
  };

  /**
   * The overflow control, shared by both compositions. `data-on` says which surface it is sitting on
   * — a cover paints it in `--cover-label` and washes it in `--cover-shade`, a row in `--ink-*` and
   * `--hair-2` — so no rule in either stylesheet has to reach across into the other's classes.
   *
   * Focus deliberately stays on the trigger when the menu opens: `aria-expanded` announces the
   * change, the one item is the next thing in Tab order, and Escape therefore leaves focus somewhere
   * real instead of on `<body>`.
   */
  const overflowFor = (n: NbEntry, on: 'cover' | 'row') => {
    const open = menu === n.id;
    return (
      <span className="nb-more" data-open={open ? '' : undefined}>
        <button
          type="button"
          className="nb-dots"
          data-on={on}
          aria-label={`More for ${n.name}`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setMenu(open ? null : n.id)}
        >
          <Icon name="dots" />
        </button>
        {open && (
          <div className="nb-menu" role="menu" aria-label={n.name}>
            <button
              type="button"
              role="menuitem"
              className="nb-del t-body-small"
              onClick={() => {
                setMenu(null);
                setConfirm(n);
              }}
            >
              <Icon name="trash" />
              Delete notebook
            </button>
          </div>
        )}
      </span>
    );
  };

  const tileFor = (n: NbEntry) => (
    <NotebookCover
      key={n.id}
      cover={n.cover}
      name={n.name}
      meta={metaOf(n)}
      edited={editedOf(n)}
      showSticker={n.sticker !== null}
      sticker={<StickerGlyph id={n.sticker} />}
      onClick={() => onOpen(n.id)}
      title={`Open ${n.name}`}
      actions={overflowFor(n, 'cover')}
    />
  );

  /** A list row. The whole row is the press target and the overflow sits outside it, exactly as the
   *  tile is arranged — a button may not nest inside a button. */
  const rowFor = (n: NbEntry) => (
    <div className="nb-row" key={n.id}>
      <button
        type="button"
        className="nb-row-open"
        title={`Open ${n.name}`}
        onClick={() => onOpen(n.id)}
      >
        {/* The tile reduced to the one thing that still reads at 22px: the spine. ClipPicker's
            swatch, at ClipPicker's size, so a notebook looks the same wherever it is listed. */}
        <span
          className="nb-swatch"
          style={{ background: `var(--cover-${n.cover})` }}
          aria-hidden="true"
        />
        <span className="nb-row-name t-body-nav">{n.name}</span>
        {/* Mono, because §4e's `Meta#` is Mono/Small — the same string in the same face in both
            compositions. */}
        <span className="nb-row-subject t-mono-small">{metaOf(n) ?? ''}</span>
        <span className="nb-row-strut" aria-hidden="true" />
        <span className="nb-row-pages t-mono-small">{plural(n.pages, 'page')}</span>
        <span className="nb-row-edited t-body-meta">edited {editedAgo(n.updatedAt)}</span>
      </button>
      {overflowFor(n, 'row')}
    </div>
  );

  const shelf = notebooks ?? [];
  const empty = notebooks !== null && shelf.length === 0;

  return (
    <>
      <div className="view">
        <div className="nb" data-empty={empty ? '' : undefined}>
          {error && <Notice className="nb-error">{error}</Notice>}

          {notebooks === null && (
            <p className="nb-status t-body-meta" role="status">
              Reading your notebooks…
            </p>
          )}

          {/* §4f: the empty composition has no header at all — the ghost cover teaches the
              affordance and the button names it, so a greeting above them would only repeat itself.
              No Mr. Bell either, and that is explicit: he is already on screen 100px lower in the
              sidebar's mascot slot, and two crabs on one 1320px frame reads as a mistake. */}
          {empty && (
            <div className="nb-empty">
              <div className="nb-ghost" aria-hidden="true">
                <Icon name="plus" />
              </div>
              <div className="nb-words">
                <h2 className="nb-empty-head t-display-setup-title">No notebooks yet</h2>
                <p className="nb-empty-copy t-body-default">
                  Make one for a topic you keep coming back to. It opens on two blank pages, and
                  there are as many more as you need.
                </p>
              </div>
              <Button
                variant="primary"
                icon="plus"
                label="New notebook"
                onClick={() => setNewOpen(true)}
              />
            </div>
          )}

          {shelf.length > 0 && (
            <>
              <header className="nb-head">
                <div className="nb-greeting">
                  <h2 className="nb-greeting-title t-greeting">Your notebooks</h2>
                  <p className="nb-subline t-body-small">
                    {plural(shelf.length, 'notebook')}
                    {' · '}
                    {plural(written, 'page')} written
                    {' · '}
                    stored on this device
                  </p>
                </div>
                <span className="nb-strut" aria-hidden="true" />
                <SegmentedControl
                  items={VIEWS}
                  value={asList ? 1 : 0}
                  onChange={(v) => setAsList(v === 1)}
                  label="Notebook layout"
                />
                <Button
                  variant="primary"
                  icon="plus"
                  label="New notebook"
                  onClick={() => setNewOpen(true)}
                />
              </header>

              {asList ? (
                /* `padding={0}`, not `rows` — see the note in the stylesheet: `rows` clips, and the
                   overflow menu opens outside the card. */
                <Card padding={0}>{shelf.map(rowFor)}</Card>
              ) : (
                <div className="nb-shelf">{shelf.map(tileFor)}</div>
              )}
            </>
          )}
        </div>
      </div>

      {confirm && (
        <Dialog
          open
          onClose={() => setConfirm(null)}
          title="Delete this notebook?"
          actions={
            <>
              {/* Cancel first in DOM order, so Tab and the panel's initial focus reach the safe
                  choice before the destructive one. */}
              <Button label="Cancel" onClick={() => setConfirm(null)} />
              <Button
                variant="primary"
                className="dlg-danger"
                label={deleting ? 'Deleting…' : 'Delete notebook'}
                onClick={() => void runDelete()}
                /* aria-disabled rather than disabled: a real `disabled` drops focus to <body>,
                   where Dialog's scrim-bound key handler can no longer hold Tab inside the modal.
                   `runDelete` gates on the same flag, so a second press cannot fire twice. */
                aria-disabled={deleting ? 'true' : undefined}
                aria-busy={deleting ? true : undefined}
              />
            </>
          }
        >
          {deleteCopy(confirm)}
          <br />
          <br />
          This cannot be undone, and nothing else in the app can rebuild it.
        </Dialog>
      )}

      <NewNotebookDialog
        open={newOpen}
        subjects={subjects}
        onClose={() => setNewOpen(false)}
        onCreate={onCreate}
      />
    </>
  );
}
