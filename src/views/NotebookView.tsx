/**
 * The open notebook. Spec: `design/specs/screen-notebooks.md` §5 (topbar, dock, spread, spread nav)
 * and §6 (the inspector). Motion is §11, ported in `NotebookView.css`.
 *
 * NO SIDEBAR. §5a puts the window lights inside this screen's own 1320-wide top bar, which is only
 * possible if nothing else owns them, so `App` renders this route in an `app-bare` shell. Getting back
 * is the `back` button at x 78 — the Reader's shape, deliberately, so the two screens read as siblings.
 *
 * THE SPREAD IS ONE SCALED BOX. 936x644 fixed, with `--nbs-scale` measured off the stage, so every
 * number in the stylesheet is the spec's own literal and the whole thing survives any window by
 * scaling rather than reflowing — shrinking to fit a small one, and growing to fill a large one so
 * the pages are never a small island in an empty stage. `NotebookPage` folds the same scale into its
 * canvas backing store, so a scaled page is still sharp.
 *
 * WHAT IS DELIBERATELY ABSENT. §5a's `search` button searches inside the notebook; nothing indexes
 * handwriting, so it opens the app's own palette instead of pretending to. Said in its tooltip.
 */
import './NotebookView.css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import IconButton from '@ui/IconButton';
import TonePill, { type Tone } from '@ui/TonePill';
import WindowLights from '../components/WindowLights';
import ToolDock from '../components/ToolDock';
import NotebookPage from '../components/NotebookPage';
import Inspector from '../components/Inspector';
import { imageFrom, planImage, toPng } from '../lib/clip';
import { addObjectCmd, deleteCmd, type Ruler } from '../lib/ink';
import {
  nbExport,
  nbStat,
  spreadLabel,
  spreadOf,
  spreadPages,
  type NbAuthored,
  type NbEntry,
  type NbTool,
} from '../lib/notebooks';
import { useNotebook } from '../state/useNotebook';
import type { Subject } from '../lib/types';

/** The spread's design box. Both numbers are §5c's and the scale is measured against them. */
const SPREAD_W = 936;
const SPREAD_H = 644;
/**
 * Room the stage keeps around the spread. Trimmed from the design's 26 / 102 so the pages claim more
 * of the stage and read wider: a slim side gutter (`INSET_X`), and enough below (`RESERVE_Y`) that the
 * floating spread nav clears the writing. `RESERVE_Y` is the nav's own height rather than half of it,
 * and it is matched by `padding-bottom` on the stage — reserving it without that padding only put half
 * the room below, because the stage centres what it holds and split the reserve in two.
 */
const INSET_X = 10;
const RESERVE_Y = 64;

/**
 * How far the spread may scale UP to fill the stage. The design size is `fit === 1`; past it the
 * spread keeps growing to use the window rather than sitting as a small island in a large one.
 *
 * It stays sharp at any size because `NotebookPage` folds `scale` into its canvas backing store
 * (`dpr = devicePixelRatio * scale`, capped at a texture-sized backing store), so this is NOT the
 * ruling-softening the old `1` cap guarded against — that reasoning predated the scaled backing store.
 * The real limiter is the window: the two ratios in `measure()` almost always bind first.
 */
const MAX_FIT = 2.5;

/** §5e's zoom readout. The spread already fits the stage, so this is a deliberate extra on top — and
 *  the stage scrolls past `fit`, because a zoom you cannot pan is a zoom that hides the page. */
const ZOOMS = [0.75, 0.9, 1, 1.15, 1.35, 1.6] as const;
const ZOOM_REST = 2;

/** How long §11's `page turn` runs. Kept here because the class is removed on this timer. */
const TURN_MS = 450;

/** The name field types straight through, so the write is held back this long. */
const META_MS = 500;

/** One shared empty list for the pages that hold no selection — a fresh `[]` per render would rebuild
 *  `NotebookPage`'s overlay painter, and with it a clear of the live canvas, on every render. */
const NO_SELECTION: readonly string[] = [];

export interface Props {
  notebook: NbEntry;
  /** Disk page index to open at — the Reader's clip confirmation lands the student on its page. */
  startPage?: number;
  subjects: Subject[];
  tone: Tone;
  onTone: () => void;
  focus: boolean;
  onToggleFocus: () => void;
  onSearch: () => void;
  onBack: () => void;
  onSaveMeta: (meta: NbAuthored) => Promise<void>;
  onDelete: () => Promise<void>;
}

export default function NotebookView({
  notebook,
  startPage = 0,
  subjects,
  tone,
  onTone,
  focus,
  onToggleFocus,
  onSearch,
  onBack,
  onSaveMeta,
  onDelete,
}: Props) {
  const nb = useNotebook(notebook, startPage);
  const [tab, setTab] = useState(0);
  const [zoom, setZoom] = useState(ZOOM_REST);
  const [selection, setSelection] = useState<{ page: number; ids: string[] }>({
    page: -1,
    ids: [],
  });
  const [ruler, setRuler] = useState<Ruler | null>(null);
  /**
   * `bytes` measured now, rather than the copy the shelf row carried in.
   *
   * §14's third requirement is "always saved locally", and §6c prints `On this device 2.4 MB` as the
   * evidence. A figure taken from the row the shelf handed over reads 0 B for a notebook that has just
   * been written in, which undercuts precisely the promise it exists to make. Re-measured whenever the
   * Notebook tab is opened and after every flush settles.
   */
  const [bytes, setBytes] = useState(notebook.bytes);
  const [dropping, setDropping] = useState(false);
  /**
   * A transient line over the stage. Only one thing writes to it today — an image that would not
   * arrive — and that is exactly why it exists: a paste that silently does nothing is indistinguishable
   * from a paste that was never noticed, and the student is left pressing Ctrl+V again.
   */
  const [notice, setNotice] = useState<string | null>(null);
  /** Plays §11's `cover open` once, on the way in. */
  const [entering, setEntering] = useState(true);

  const stage = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);

  /* --- the authored record, held here rather than fetched back from disk --------------------- */

  /**
   * `NbAuthored` is edited locally and the write is the ECHO, not the source.
   *
   * Every control in §6c is direct manipulation, but the only copy of `notebook` this screen is handed
   * comes back from disk: `nbMetaSave` writes `meta.json`, rewrites the shelf index, and only then does
   * the row reach here through `App`. Rendering off that had three separate consequences. The name
   * field is controlled, so React restored the stale value under the cursor whenever a save landed
   * mid-word — and Rust trims the stored name, so a space typed after a word was deleted on the way
   * back and the next letter joined the previous one. A second edit inside the debounce window was
   * built from a record that did not have the first one in it, and dropped it silently. And a paper
   * style did not reach the ruling for 500ms plus a round trip.
   *
   * Re-seeded only when a different notebook arrives, so the echo can never overwrite what is on screen.
   */
  const [authored, setAuthored] = useState<NbAuthored>(() => authoredOf(notebook));
  const seeded = useRef(notebook.id);
  if (seeded.current !== notebook.id) {
    seeded.current = notebook.id;
    setAuthored(authoredOf(notebook));
  }
  /** What the topbar and the export name use: the field may be empty mid-rename, and the notebook still
   *  has the name it was last saved under. */
  const title = authored.name.trim() || notebook.name;

  /* --- the name field types straight through, so the write has to be held back --------------- */

  const metaTimer = useRef(0);
  const pendingMeta = useRef<NbAuthored | null>(null);
  /** `App` passes a fresh arrow every render, so the write is reached through a ref — see `flushMeta`. */
  const saveRef = useRef(onSaveMeta);
  saveRef.current = onSaveMeta;

  /**
   * Write whatever is pending, now. Stable, and that is the whole point.
   *
   * The unmount flush below used to be keyed on `onSaveMeta`, which `App` re-creates on every render —
   * so its cleanup ran on every parent render, flushed the pending write, and defeated the 500ms it
   * exists to be. Since each write resolving IS a parent render, that came to one `meta.json` plus one
   * whole-index rewrite per keystroke.
   */
  const flushMeta = useCallback(() => {
    if (metaTimer.current) {
      window.clearTimeout(metaTimer.current);
      metaTimer.current = 0;
    }
    const next = pendingMeta.current;
    pendingMeta.current = null;
    if (!next) return;
    void saveRef.current(next).catch((e: unknown) => {
      setNotice(`That change could not be saved — ${String(e).replace(/^Error:\s*/, '')}`);
    });
  }, []);

  const saveMeta = useCallback(
    (next: NbAuthored) => {
      setAuthored(next);
      // Trimmed here so Rust's own trim is a no-op and the echo matches what is on screen. An empty
      // field keeps the stored name instead of being refused, so every other edit still lands while the
      // student is mid-rename — and `checked()` in Rust never sees a name it would reject.
      pendingMeta.current = { ...next, name: next.name.trim() || notebook.name };
      if (metaTimer.current) window.clearTimeout(metaTimer.current);
      metaTimer.current = window.setTimeout(flushMeta, META_MS);
    },
    [flushMeta, notebook.name],
  );

  useEffect(() => () => flushMeta(), [flushMeta]);

  /* --- how big the spread can be ------------------------------------------ */

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      // The WELL is measured, not the scroller inside it: a box that can grow scrollbars cannot be the
      // thing a scale is derived from without the two chasing each other.
      const box = el.getBoundingClientRect();
      // Fill the stage: the spread grows past its design size to use the window, bounded by whichever
      // of width or height runs out first, so two pages are never a small island in a large window.
      // `MAX_FIT` is only a safety bound for enormous displays; the window almost always binds first.
      // Still sharp at any size — `NotebookPage` multiplies `scale` into its canvas backing store.
      setFit(
        Math.max(
          0.4,
          Math.min(
            MAX_FIT,
            (box.width - INSET_X * 2) / SPREAD_W,
            (box.height - RESERVE_Y) / SPREAD_H,
          ),
        ),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = fit * ZOOMS[zoom];

  useEffect(() => {
    if (!entering) return;
    const timer = window.setTimeout(() => setEntering(false), 1200);
    return () => window.clearTimeout(timer);
  }, [entering]);

  useEffect(() => {
    if (tab !== 2 || nb.saveState === 'saving') return;
    let cancelled = false;
    void nbStat(notebook.id)
      .then((stat) => {
        if (!cancelled) setBytes(stat.bytes);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tab, nb.saveState, notebook.id]);

  /* --- turning ------------------------------------------------------------ */

  useEffect(() => {
    if (!nb.turning) return;
    const timer = window.setTimeout(nb.endTurn, TURN_MS);
    return () => window.clearTimeout(timer);
  }, [nb.turning, nb.endTurn]);

  const goSpread = useCallback(
    (target: number) => {
      setSelection({ page: -1, ids: [] });
      nb.goSpread(target);
    },
    [nb],
  );

  /** A selection belongs to the Select tool. Leaving the tool with one still live left the frame painted
   *  and Delete still destructive over ink the student was no longer thinking about. */
  useEffect(() => {
    if (nb.ink.tool !== 'lasso') setSelection({ page: -1, ids: [] });
  }, [nb.ink.tool]);

  /* --- keyboard ----------------------------------------------------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      // The inline text editor, the jump-to-page field, the sliders and the subject select own their own
      // keys — a `<select>` changes option on Left/Right and must not turn the page as well.
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) nb.redo();
          else nb.undo();
        } else if (key === 'y') {
          e.preventDefault();
          nb.redo();
        }
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        // Auto-repeat is dropped: one press is one leaf, and a held key otherwise queues a spread per
        // repeat, each with its own flush and its own 450ms turn to sit through.
        if (!e.repeat) goSpread(nb.spread + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        if (!e.repeat) goSpread(nb.spread - 1);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selection.ids.length > 0) {
        e.preventDefault();
        nb.commit(deleteCmd(selection.page, nb.page(selection.page), selection.ids));
        setSelection({ page: -1, ids: [] });
      } else if (e.key === 'Escape') {
        if (selection.ids.length > 0) setSelection({ page: -1, ids: [] });
        else if (focus) onToggleFocus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nb, goSpread, selection, focus, onToggleFocus]);

  /* --- images: paste and drop --------------------------------------------- */

  /**
   * Both routes end in `planImage`, so a pasted screenshot, a dropped file and a clipped exam question
   * land identically: under whatever is already on the page, spilling to the next one if there is no
   * room.
   *
   * The object is COMMITTED rather than written, which is what makes it one Ctrl+Z like everything else
   * on the page. It also removes a race the old path could not close: `placeImage` read the target page
   * off disk, merged, wrote, and the reload afterwards replaced memory with that file — so a stroke made
   * while a large screenshot was still encoding was quietly dropped. `nb.ensure` reads a page only when
   * this session has not got one, and never overwrites what is in memory.
   */
  const takeImage = useCallback(
    async (file: Blob) => {
      const target = spreadPages(nb.spread)[1];
      setNotice(null);
      try {
        const png = await toPng(file);
        const { page, object } = await planImage(notebook.id, target, png, nb.ensure);
        // A command must never land on a page that is merely unread, or the flush writes a blank over
        // it. `planImage` has already read both candidates; this states the invariant at the commit.
        await nb.ensure(page);
        nb.commit(addObjectCmd(page, object));
        // And go there when it spilled: an image you cannot see has not arrived.
        if (page !== target) goSpread(spreadOf(page));
      } catch (e) {
        setNotice(`That image could not be added — ${String(e).replace(/^Error:\s*/, '')}`);
      }
    },
    [nb, notebook.id, goSpread],
  );

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = imageFrom(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      void takeImage(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [takeImage]);

  const [left, right] = nb.open;
  /**
   * The leaf that is leaving. Forward, it is the right page folding onto the binding; backward, the
   * left page folding the other way. Only one of the two moves, because only one leaf is being turned.
   */
  const outgoing = nb.turning
    ? spreadPages(nb.turning.from)[nb.turning.dir === 'fwd' ? 1 : 0]
    : null;
  const outgoingSide = nb.turning?.dir === 'fwd' ? 'r' : 'l';

  const pageProps = {
    notebook: notebook.id,
    // From the local copy, so picking a paper style redraws the ruling on the press rather than after
    // a 500ms debounce and a disk round trip.
    paper: authored.paper,
    margin: authored.margin,
    scale,
    tool: nb.ink.tool,
    ink: nb.ink,
    ruler,
    onRuler: setRuler,
    onCommand: nb.commit,
  };

  /* --- leaving, and the one irreversible thing here ------------------------ */

  /**
   * Flush before the route changes, so the shelf `App` refreshes behind us reports the pages that were
   * just written rather than the count from before the session. The unmount cleanup flushes too; this is
   * about ORDER, not about whether the write happens.
   */
  const leave = useCallback(() => {
    flushMeta();
    void nb.flush().finally(onBack);
  }, [flushMeta, nb, onBack]);

  /**
   * Delete, with nothing left pending.
   *
   * `write_atomic` creates its parent directory, so a page still dirty when the unmount flush runs would
   * recreate `notebooks\<id>\pages\` with no `meta.json` beside it — and `nb_list` skips a directory it
   * cannot read a meta from, stranding a real page file where nothing in the product will ever look.
   */
  const remove = useCallback(() => {
    nb.discard();
    pendingMeta.current = null;
    if (metaTimer.current) {
      window.clearTimeout(metaTimer.current);
      metaTimer.current = 0;
    }
    void onDelete();
  }, [nb, onDelete]);

  return (
    <section
      className="nbs"
      data-enter={entering ? 'on' : undefined}
      data-turn={nb.turning?.dir}
    >
      {/* §5a topbar 1320x52 — a hairline on all four sides, not a border-bottom. */}
      <header className="nbs-top" data-tauri-drag-region>
        <WindowLights />
        <IconButton icon="left" label="Back to your notebooks" onClick={leave} />

        <div className="nbs-title">
          <span className="nbs-title-name t-body-strong">{title}</span>
          {authored.subject && (
            <span className="nbs-title-code t-mono-meta">
              {authored.subject.name} {authored.subject.code}
            </span>
          )}
          <span className="nbs-title-sep t-body-small" aria-hidden="true">
            ·
          </span>
          <span className="nbs-title-pages t-body-small">{nb.pages} pages</span>
        </div>

        {/* §5a `save` — the one place in the product that admits it is writing to disk, and the whole
            of requirement 3 made visible. Lifted verbatim from the Reader's running-timer indicator. */}
        <div className="nbs-save" data-state={nb.saveState} role="status">
          <span className="nbs-save-dot" aria-hidden="true" />
          <span className="nbs-save-label">
            {nb.saveState === 'error' ? 'Could not save' : 'Saved on this device'}
          </span>
        </div>

        <span className="nbs-top-gap" />

        <TonePill tone={tone} onToggle={onTone} />
        <IconButton
          icon="search"
          label="Search"
          title="Search your papers — nothing reads handwriting, so this is the app's own search"
          onClick={onSearch}
        />
        <IconButton
          icon="focus"
          label="Focus mode"
          active={focus}
          title="Focus mode — the dock and the inspector recede"
          onClick={onToggleFocus}
        />
      </header>

      <ToolDock
        tool={nb.ink.tool}
        onTool={(tool: NbTool) => nb.patchInk({ tool })}
        onUndo={nb.undo}
        onRedo={nb.redo}
        canUndo={nb.canUndo}
        canRedo={nb.canRedo}
        hidden={focus}
      />

      {/* The WELL holds the scroller and everything that must float over it. The nav and the notice sat
          inside the stage until it could scroll; an absolutely positioned child of a scroll container
          scrolls with the content, which would have carried them off the bottom of a zoomed spread. */}
      <div
        className="nbs-well"
        ref={stage}
        data-drop={dropping ? 'over' : undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setDropping(true);
        }}
        onDragLeave={(e) => {
          // Moving onto a child fires `dragleave` on the parent too, which made the outline flicker for
          // the whole drag.
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          setDropping(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDropping(false);
          const file = imageFrom(e.dataTransfer);
          if (file) void takeImage(file);
        }}
      >
        {/* The stage scrolls, and the SIZER is what gives it something to scroll: a `transform` does not
            create scrollable overflow, so zooming in past the fit used to crop the pages with no way to
            reach the rest. Its box is the scaled spread, and the spread draws inside it from the top
            left — which is also why `.nbs-spread` sets `transform-origin`. */}
        <div className="nbs-stage">
          <div className="nbs-sizer" style={{ width: SPREAD_W * scale, height: SPREAD_H * scale }}>
            <div className="nbs-spread" style={{ ['--nbs-scale' as string]: scale }}>
              {/* During a turn the outgoing leaf stays mounted, because §11's timeline crossfades one
                  page into the next — one set of canvases could only ever show the arriving half. */}
              {outgoing != null && (
                <NotebookPage
                  key={`out-${outgoing}`}
                  {...pageProps}
                  index={outgoing}
                  side={outgoingSide}
                  page={nb.page(outgoing)}
                  selection={NO_SELECTION}
                  onSelection={() => {}}
                  turn="out"
                />
              )}
              <NotebookPage
                key={`l-${left}`}
                {...pageProps}
                index={left}
                side="l"
                page={nb.page(left)}
                selection={selection.page === left ? selection.ids : NO_SELECTION}
                onSelection={(ids) => setSelection({ page: left, ids })}
                turn={nb.turning?.dir === 'back' ? 'in' : undefined}
              />
              <NotebookPage
                key={`r-${right}`}
                {...pageProps}
                index={right}
                side="r"
                page={nb.page(right)}
                selection={selection.page === right ? selection.ids : NO_SELECTION}
                onSelection={(ids) => setSelection({ page: right, ids })}
                turn={nb.turning?.dir === 'fwd' ? 'in' : undefined}
              />

              {/* §5c `rings` — the LAST child, so the wire paints over both pages. THE COILS NEVER
                  MOVE: they are the pivot the leaf hinges on, which is the mechanical argument for
                  spiral binding over stitched, and §11's `page turn` holds them perfectly still. */}
              <div className="nbs-rings" aria-hidden="true">
                <svg viewBox="0 0 26 644" fill="none">
                  {Array.from({ length: 13 }, (_, i) => (
                    <ellipse
                      key={i}
                      cx="13"
                      cy={34 + i * 48}
                      rx="11"
                      ry="6.5"
                      stroke="var(--page-ink-2)"
                      strokeWidth="2"
                    />
                  ))}
                </svg>
              </div>
            </div>
          </div>
        </div>

        {notice && (
          <div className="nbs-notice" role="status">
            <span className="nbs-notice-pill t-body-small">{notice}</span>
          </div>
        )}

        {/* §5e spread nav. TRAP 15: it reads `pages 12-13`, never `12 of 40`, and `next` is NEVER
            disabled — turning past the last written spread materialises the next one. That is the
            whole of "infinite pages, never ask the student", in one bar. */}
        <div className="nbs-nav">
          <div className="nbs-nav-bar">
            <IconButton
              icon="left"
              label="Previous spread"
              disabled={nb.spread === 0}
              onClick={() => goSpread(nb.spread - 1)}
            />
            <span className="nbs-nav-read t-mono-small">{spreadLabel(nb.spread)}</span>
            <IconButton icon="right" label="Next spread" onClick={() => goSpread(nb.spread + 1)} />

            <span className="nbs-nav-sep" aria-hidden="true" />

            <IconButton
              icon="zout"
              label="Zoom out"
              disabled={zoom === 0}
              onClick={() => setZoom((z) => Math.max(0, z - 1))}
            />
            {/* The EFFECTIVE scale, not `ZOOMS[zoom]`. The step is a multiplier on a fit that is 0.735
                at the minimum window and can exceed 1 on a large one, so printing the step as a
                percentage said "100%" for anything between three quarters and half again. */}
            <span className="nbs-nav-zoom t-mono-small">{Math.round(scale * 100)}%</span>
            <IconButton
              icon="zin"
              label="Zoom in"
              disabled={zoom === ZOOMS.length - 1}
              onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))}
            />
          </div>
        </div>
      </div>

      <div className="nbs-inspector" inert={focus}>
        <Inspector
          tab={tab}
          onTab={setTab}
          ink={nb.ink}
          onInk={nb.patchInk}
          recentColours={nb.recentColours}
          spread={nb.spread}
          spreadCount={nb.spreadCount}
          onSpread={goSpread}
          /* The authored fields come from the local copy so every control is direct manipulation; the
             two derived figures are the live ones rather than the copy the shelf handed over, so §6c's
             DETAILS card cannot claim a notebook is empty while there is ink on the page in front of
             it. */
          notebook={{ ...notebook, ...authored, pages: nb.pages, bytes }}
          subjects={subjects}
          onMeta={saveMeta}
          onExport={() => void exportNotebook(notebook.id, title)}
          onDelete={remove}
        />
      </div>
    </section>
  );
}

/** The authored fields alone. `NbEntry` carries five more that the filesystem answers, and posting one
 *  of those back as authored data is how a derived value turns into a stored one. */
function authoredOf(entry: NbEntry): NbAuthored {
  return {
    name: entry.name,
    cover: entry.cover,
    sticker: entry.sticker,
    paper: entry.paper,
    margin: entry.margin,
    subject: entry.subject,
  };
}

/**
 * §6c's export. It copies the notebook — `meta.json`, every page and every asset — into the app's
 * `exports` folder and returns where it landed.
 *
 * IT IS NOT A PDF, and the spec's button says "Export PDF". Writing a PDF means either a new Rust
 * crate or rasterising every page and assembling the file by hand, and neither is this pass. What
 * ships is the honest half: everything the notebook contains, in a folder you can copy elsewhere,
 * which is what protects the work. Flagged in TASKS.md rather than papered over.
 */
async function exportNotebook(id: string, name: string): Promise<void> {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const safe = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'notebook';
  await nbExport(id, `${safe}-${stamp}`);
}
