/**
 * The open notebook. Spec: `design/specs/screen-notebooks.md` §5 (topbar, dock, spread, spread nav)
 * and §6 (the inspector). Motion is §11, ported in `NotebookView.css`.
 *
 * NO SIDEBAR. §5a puts the window lights inside this screen's own 1320-wide top bar, which is only
 * possible if nothing else owns them, so `App` renders this route in an `app-bare` shell. Getting back
 * is the `back` button at x 78 — the Reader's shape, deliberately, so the two screens read as siblings.
 *
 * THE SPREAD IS ONE SCALED BOX. 936x644 fixed, with `--nbs-scale` measured off the stage, so every
 * number in the stylesheet is the spec's own literal and the whole thing survives a 1040x680 window
 * by shrinking rather than reflowing. `NotebookPage` folds the same scale into its canvas backing
 * store, so a scaled page is still sharp.
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
import { imageFrom, placeImage, toPng } from '../lib/clip';
import { deleteCmd, type Ruler } from '../lib/ink';
import {
  nbExport,
  nbStat,
  spreadLabel,
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
/** Room the stage must keep: 26 either side (§5c's inset), and enough below for the floating nav. */
const INSET_X = 26;
const RESERVE_Y = 102;

/** §5e's zoom readout. The spread already fits the stage, so this is a deliberate extra on top. */
const ZOOMS = [0.75, 0.9, 1, 1.15, 1.35, 1.6] as const;
const ZOOM_REST = 2;

/** How long §11's `page turn` runs. Kept here because the class is removed on this timer. */
const TURN_MS = 450;

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

  /* --- the name field types straight through, so the write has to be held back --------------- */

  /**
   * The inspector's name field is controlled and calls `onMeta` on every keystroke, which is the right
   * shape for it — the cover preview and the topbar title have to follow the letters. But `nbMetaSave`
   * writes `meta.json` and rewrites the shelf's index, so an undebounced pass-through is one disk
   * write per character. 500ms, and a flush on unmount so leaving mid-word still saves the word.
   */
  const metaTimer = useRef(0);
  const pendingMeta = useRef<NbAuthored | null>(null);
  const saveMeta = useCallback(
    (meta: NbAuthored) => {
      pendingMeta.current = meta;
      if (metaTimer.current) window.clearTimeout(metaTimer.current);
      metaTimer.current = window.setTimeout(() => {
        metaTimer.current = 0;
        const next = pendingMeta.current;
        pendingMeta.current = null;
        if (next) void onSaveMeta(next);
      }, 500);
    },
    [onSaveMeta],
  );
  useEffect(
    () => () => {
      if (!metaTimer.current) return;
      window.clearTimeout(metaTimer.current);
      const next = pendingMeta.current;
      pendingMeta.current = null;
      if (next) void onSaveMeta(next);
    },
    [onSaveMeta],
  );

  /* --- how big the spread can be ------------------------------------------ */

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      // Never above 1 from the fit alone: the design size is the design size, and a spread blown up
      // past it would soften the ruling for no reading benefit. Zoom is the opt-in on top.
      setFit(
        Math.max(
          0.4,
          Math.min(
            1,
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

  /* --- keyboard ----------------------------------------------------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      // The inline text editor, the jump-to-page field and the sliders own their own keys.
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

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
        goSpread(nb.spread + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goSpread(nb.spread - 1);
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
   * Both routes end in `placeImage`, which is the same function the Reader's clip uses — so a pasted
   * screenshot, a dropped file and a clipped exam question land identically, under whatever is already
   * on the page, spilling to the next one if there is no room.
   */
  const takeImage = useCallback(
    async (file: Blob) => {
      const target = spreadPages(nb.spread)[1];
      setNotice(null);
      try {
        const png = await toPng(file);
        const { page } = await placeImage(notebook.id, target, png);
        // `placeImage` writes the object straight to the file, because it may land on a page nobody
        // has open — so the only way it appears is to read that page back.
        await nb.reload(page);
        // And go there when it spilled: an image you cannot see has not arrived.
        if (page !== target) goSpread(Math.floor(page / 2));
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
    paper: notebook.paper,
    margin: notebook.margin,
    scale,
    tool: nb.ink.tool,
    ink: nb.ink,
    ruler,
    onRuler: setRuler,
    onCommand: nb.commit,
  };

  return (
    <section
      className="nbs"
      data-enter={entering ? 'on' : undefined}
      data-turn={nb.turning?.dir}
    >
      {/* §5a topbar 1320x52 — a hairline on all four sides, not a border-bottom. */}
      <header className="nbs-top" data-tauri-drag-region>
        <WindowLights />
        <IconButton icon="left" label="Back to your notebooks" onClick={onBack} />

        <div className="nbs-title">
          <span className="nbs-title-name t-body-strong">{notebook.name}</span>
          {notebook.subject && (
            <span className="nbs-title-code t-mono-meta">
              {notebook.subject.name} {notebook.subject.code}
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
      />

      <div
        className="nbs-stage"
        ref={stage}
        data-drop={dropping ? 'over' : undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setDropping(true);
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDropping(false);
          const file = imageFrom(e.dataTransfer);
          if (file) void takeImage(file);
        }}
      >
        <div className="nbs-spread" style={{ ['--nbs-scale' as string]: scale }}>
          {/* During a turn the outgoing leaf stays mounted, because §11's timeline crossfades one page
              into the next — one set of canvases could only ever show the arriving half. */}
          {outgoing != null && (
            <NotebookPage
              key={`out-${outgoing}`}
              {...pageProps}
              index={outgoing}
              side={outgoingSide}
              page={nb.page(outgoing)}
              selection={[]}
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
            selection={selection.page === left ? selection.ids : []}
            onSelection={(ids) => setSelection({ page: left, ids })}
            turn={nb.turning?.dir === 'back' ? 'in' : undefined}
          />
          <NotebookPage
            key={`r-${right}`}
            {...pageProps}
            index={right}
            side="r"
            page={nb.page(right)}
            selection={selection.page === right ? selection.ids : []}
            onSelection={(ids) => setSelection({ page: right, ids })}
            turn={nb.turning?.dir === 'fwd' ? 'in' : undefined}
          />

          {/* §5c `rings` — the LAST child, so the wire paints over both pages. THE COILS NEVER MOVE:
              they are the pivot the leaf hinges on, which is the mechanical argument for spiral
              binding over stitched, and §11's `page turn` holds them perfectly still. */}
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

        {notice && (
          <div className="nbs-notice" role="status">
            <span className="nbs-notice-pill t-body-small">{notice}</span>
          </div>
        )}

        {/* §5e spread nav. TRAP 15: it reads `pages 12-13`, never `12 of 40`, and `next` is NEVER            disabled — turning past the last written spread materialises the next one. That is the
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
            <span className="nbs-nav-zoom t-mono-small">{Math.round(ZOOMS[zoom] * 100)}%</span>
            <IconButton
              icon="zin"
              label="Zoom in"
              disabled={zoom === ZOOMS.length - 1}
              onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))}
            />
          </div>
        </div>
      </div>

      <div className="nbs-inspector">
        <Inspector
          tab={tab}
          onTab={setTab}
          ink={nb.ink}
          onInk={nb.patchInk}
          recentColours={nb.recentColours}
          spread={nb.spread}
          spreadCount={nb.spreadCount}
          onSpread={goSpread}
          /* Both derived figures are the live ones, not the copy the shelf handed over: `pages` grows
             as the student writes and `bytes` is re-measured, so §6c's DETAILS card cannot claim a
             notebook is empty while there is ink on the page in front of it. */
          notebook={{ ...notebook, pages: nb.pages, bytes }}
          subjects={subjects}
          onMeta={saveMeta}
          onExport={() => void exportNotebook(notebook)}
          onDelete={() => void onDelete()}
        />
      </div>
    </section>
  );
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
async function exportNotebook(notebook: NbEntry): Promise<void> {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const safe =
    notebook.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'notebook';
  await nbExport(notebook.id, `${safe}-${stamp}`);
}
