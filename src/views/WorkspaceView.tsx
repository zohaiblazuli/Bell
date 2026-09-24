/**
 * The Reader. Spec: `design/specs/screen-reader.md` — §2's layout map (page rail 140, the paper
 * well), §4's topbar, §5's page rail, §6's paper and §8's floating tool bar. `WorkspaceView.css`
 * also carries the CSS for `PaperCanvas` and `MarkSchemeSheet`: both are the Reader's own pieces and
 * are mounted nowhere else.
 *
 * ONE TOP BAR, AND IT IS NEARLY EMPTY NOW. The bar is `components/TopBar`. Everything the Reader used
 * to hang off its `right` slot has moved, at Zohaib's instruction (2026-09-06):
 *   the focus timer     -> the bar's new `center` slot, so it sits at the top middle of the window
 *   zoom                -> §8's floating tool bar
 *   the mark scheme     -> §8's floating tool bar, as a labelled button rather than a word chip
 *   focus mode and clip -> hidden; see `SHOW_FOCUS_TOGGLE` / `SHOW_CLIP_TOOL` below
 * What is left is the back button, §4's three-style title, the tone pill and sync.
 *
 * THE TOOLS WRITE ON BOTH PANES. The pen and the eraser act on whichever page the pointer is over,
 * question paper or mark scheme, and each surface keeps its own ink under its own state key — the
 * paper's under `ink.<paper>`, the mark scheme's under `ink.<paper>-ms`. `surface` remembers which one
 * you drew on last, and that is what undo and redo act on; closing the sheet hands them back to the
 * paper. Which is also why the floating bar is centred on the whole reader rather than on the well:
 * it is the screen's toolbar now, not the left pane's.
 *
 * WHAT THE FILE DRAWS AND THE APP CANNOT MEASURE. §7a's `exam timer` card prints `01:12:38`, `of
 * 1h 45m` and `On pace · question 4 of 7`. The app measures exactly one of those — focused seconds
 * per paper — and the target is gone entirely now (`FocusTimer` says why), so the timer stays a
 * stopwatch in the bar rather than being re-mocked as a card full of invented numbers.
 */
import './WorkspaceView.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import Icon, { type IconName } from '../components/Icon';
import IconButton from '@ui/IconButton';
import Notice from '@ui/Notice';
import Slider from '@ui/Slider';
import FocusTimer from '../components/FocusTimer';
import MarkSchemeSheet from '../components/MarkSchemeSheet';
import PaperCanvas from '../components/PaperCanvas';
import { useNearViewport } from '../components/useNearViewport';
import ClipPicker from '../components/ClipPicker';
import WindowLights from '../components/WindowLights';
import PageJumper from '../components/PageJumper';
import SubjectIcon from '@ui/icons/SubjectIcon';
import Faces from '@ui/shapekit/Faces';
import { readDocument } from '../lib/api';
import { placeImage } from '../lib/clip';
import { pageLabel, type NbEntry } from '../lib/notebooks';
import {
  DEFAULT_OPACITY,
  DEFAULT_STROKE,
  INK_SWATCHES,
  STROKE_MAX,
  STROKE_MIN,
  type InkSettings,
  type Mark,
  type PageInk,
  type StrokeWidth,
  type Tool,
} from '../lib/annotations';
import { sessionLabel } from '../lib/difficulty';
import type { DocKind } from '../lib/types';
import { openPdf, renderPage } from '../lib/pdf';
import { loadInk, loadPref, paperKey, saveInk, savePref, saveReaderPos } from '../lib/store';
import type { PaperRow } from '../lib/types';

/**
 * Focus mode stays hidden at Zohaib's instruction — a working feature, kept wired so flipping the
 * constant brings the control back. Clip to notebook was hidden the same way and is back on: the Bell
 * App v2 handoff (2026-09-24) puts a Clip button and its notebook picker in the reader bar.
 */
const SHOW_FOCUS_TOGGLE = false;
const SHOW_CLIP_TOOL = true;

/** The demo's page is 720 logical pixels wide; zoom multiplies that. */
const BASE_WIDTH = 720;
const ZOOMS = [0.7, 0.85, 1, 1.2, 1.45, 1.75, 2.1];

/**
 * How far outside the well a page stays rasterised. Roughly one screen of slack each way: a page is
 * drawn just before it scrolls into view and released again once it is this far past, so the reader
 * holds only the handful of pages around the one you are reading rather than every page you have
 * scrolled through. Larger keeps more resident but re-renders less on a scroll back; smaller is
 * leaner but flips more often. One screen is the balance the old preload margin already used.
 */
const KEEP_MARGIN = '900px 0px';

/** §5's thumbnail sheet is 96 x 136 — and 96 × 1.414 lands on 136, so A4 fills it exactly. */
const THUMB_WIDTH = 96;

/** §8's tool group, in the file's order. */
const TOOLS: { tool: Tool; icon: IconName; label: string }[] = [
  { tool: 'pen', icon: 'pen', label: 'Pen' },
  { tool: 'er', icon: 'eraser', label: 'Eraser' },
];

/** Which of the two pages a mark was made on. Each keeps its own ink file and its own undo stack. */
type Surface = 'qp' | 'ms';

/** The reader's tool glyphs, drawn the Bell App v2 way: a slanted capped pen with a blue ink stroke,
 *  a tilted block eraser with a red end, and a highlighter as a chisel nib over a yellow bar. */
function ToolGlyph({ tool }: { tool: Tool }) {
  if (tool === 'er')
    return (
      <span className="rd-glyph rd-glyph--er" aria-hidden="true">
        <i>
          <i />
        </i>
        <b />
      </span>
    );
  return (
    <span className={tool === 'hl' ? 'rd-glyph rd-glyph--hl' : 'rd-glyph rd-glyph--pen'} aria-hidden="true">
      <i>
        <i />
        <i />
        <i />
      </i>
      <b />
    </span>
  );
}

/** "How did this one feel?" — the four faces under the mark scheme, and what Hush says back. */
const FEELINGS = [
  { id: 'easy', label: 'Easy', kind: 'sun' as const, line: 'Easy? Try a Hard one next.' },
  { id: 'okay', label: 'Okay', kind: 'box' as const, line: 'Okay counts. Keep going.' },
  { id: 'tough', label: 'Tough', kind: 'blob' as const, line: 'Tough is where marks hide.' },
  { id: 'lost', label: 'Lost', kind: 'tri' as const, line: 'Mark scheme. Line by line.' },
];

export interface Props {
  paper: PaperRow;
  onBack: () => void;
  /**
   * Whether this reader is the tab on screen. Inactive tabs are only hidden (visibility), not
   * unmounted, so this is what lets a background reader release its rasterised pages while keeping
   * its scroll position and state. Defaults to true for callers that render one reader at a time.
   */
  tabActive?: boolean;
  /** Focus mode lives on `.app`, because it also recedes the sidebar. */
  focus: boolean;
  onToggleFocus: () => void;
  /**
   * Fetch a document to this machine and resolve to where it landed, or null if it
   * failed. The reader calls this itself rather than refusing to open an undownloaded
   * paper: the catalogue lists everything Cambridge published, so "not here yet" is the
   * common case and asking the user to go and fetch it first would be a dead end.
   */
  onDownload: (paperId: number, kind: DocKind) => Promise<string | null>;
  /**
   * The student's notebooks, for "Clip to notebook". `null` means the list has not been read yet,
   * which is a different thing from having none and the picker says so.
   */
  notebooks?: NbEntry[] | null;
  /** No notebooks yet — take them to the shelf, where the New Notebook dialog lives. */
  onNewNotebook?: () => void;
  /** Open a notebook at a disk page index. The "Go there" action on the clip confirmation. */
  onOpenNotebook?: (id: string, page: number) => void;
  /** Reload the notebooks list after a creation */
  onRefreshNotebooks?: () => Promise<void> | void;
  /** Hush answers the feelings row: the line for this paper, or null when it is cleared. */
  onFeel?: (line: string | null) => void;
}

/** One entry in §5's rail: a `--paper` sheet, the real page drawn into it, and its number. */
function PageThumb({
  doc,
  page,
  active,
  live,
  onSelect,
}: {
  doc: PDFDocumentProxy;
  page: number;
  active: boolean;
  /** The first read page has rasterised, so the rail may now use the single pdf.js worker. */
  live: boolean;
  onSelect: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLButtonElement>(null);
  const [drawn, setDrawn] = useState(false);
  // Rasterise a thumbnail when it scrolls into the RAIL — not on current-page proximity. The first
  // screen's worth start near so the top of the rail is never blank.
  const [near, setNear] = useState(page <= 6);

  useEffect(() => {
    if (near) return;
    const el = box.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (el.closest('.app-tab-pane')?.getAttribute('data-active') === 'false') return;
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { root: el.closest('.rd-thumbs'), rootMargin: '600px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);

  useEffect(() => {
    if (!live || !near || drawn) return;
    const el = canvas.current;
    if (!el) return;
    let cancelled = false;
    void renderPage(doc, page, el, THUMB_WIDTH)
      .then(() => {
        if (!cancelled) setDrawn(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [doc, page, live, near, drawn]);

  // `nearest`, no smooth: when navigation scrolls the reader, reveal the newly-active thumb rather
  // than animate the rail past every page between. Also the reduced-motion-safe default.
  useEffect(() => {
    if (active) box.current?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <li>
      <button
        ref={box}
        type="button"
        className="rd-thumb"
        aria-current={active ? 'page' : undefined}
        aria-label={`Page ${page}`}
        onClick={onSelect}
      >
        <span className="rd-thumb-sheet">
          <canvas ref={canvas} className="rd-thumb-canvas" aria-hidden="true" />
        </span>
        <span className="rd-thumb-num t-mono-small">{page}</span>
      </button>
    </li>
  );
}

/**
 * One page in the continuous-scroll well. Rasterised only while near the viewport — pdf.js runs a
 * single worker, so mounting every page's canvas at once would queue the whole paper. `useNearViewport`
 * flips both ways, so a page that scrolls out of reach unmounts and frees its canvas; until a page is
 * near, a blank `--paper` box of the A4 estimate holds its scroll height so nothing jumps as pages
 * render in. `tabActive` releases the whole reader's pages when it is not the tab on screen.
 */
function ReaderPage({
  tabActive,
  doc,
  page,
  width,
  tool,
  ink,
  marks,
  onCommit,
  onRendered,
  clipping,
  onClip,
}: {
  tabActive: boolean;
  doc: PDFDocumentProxy;
  page: number;
  width: number;
  tool: Tool | null;
  ink: InkSettings;
  marks: Mark[];
  onCommit: (mark: Mark) => void;
  onRendered: () => void;
  clipping: boolean;
  onClip: (png: Blob) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const near = useNearViewport(box, {
    rootSelector: '.rd-well',
    margin: KEEP_MARGIN,
    active: tabActive,
    seed: page <= 2,
  });

  return (
    <div ref={box} className="rd-page" data-page={page}>
      {near ? (
        <PaperCanvas
          doc={doc}
          page={page}
          width={width}
          tool={tool}
          ink={ink}
          marks={marks}
          onCommit={onCommit}
          onRendered={onRendered}
          clipping={clipping}
          onClip={onClip}
        />
      ) : (
        <div className="rd-paper" style={{ width, height: Math.round(width * 1.414) }} />
      )}
    </div>
  );
}

export default function WorkspaceView({
  paper,
  onBack,
  tabActive = true,
  focus,
  onToggleFocus,
  onDownload,
  notebooks,
  onNewNotebook,
  onOpenNotebook,
  onFeel,
}: Props) {
  const id = paperKey(paper.subjectCode, paper.scode, paper.component);
  /** The mark scheme's ink is its own state key — `inkKey` folds the slash into a dash. */
  const msId = `${id}/ms`;
  const code = `${paper.subjectCode} /${paper.component}`;
  const session = sessionLabel(paper.scode);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  /**
   * Index into `ZOOMS`, not a factor. 2 (1.0 -> 720px): the continuous-scroll well is the design's
   * 1320 width minus the 140 rail (~1180), so a 720px page opens centred with room to spare and
   * reads at full size. Tunable — zoom out for a denser overview.
   */
  const [zoom, setZoom] = useState(2);
  const [msOpen, setMsOpen] = useState(false);
  /** How this paper felt, kept per paper so reopening it remembers. */
  const [feel, setFeel] = useState<string | null>(() => loadPref<string | null>(`feel.${id}`, null));
  const pickFeel = (next: string) => {
    const value = feel === next ? null : next;
    setFeel(value);
    savePref(`feel.${id}`, value);
    onFeel?.(FEELINGS.find((f) => f.id === value)?.line ?? null);
  };
  /** Set while this reader is fetching its own question paper. */
  const [fetching, setFetching] = useState(false);
  /** Resolved mark-scheme path: the row's, or wherever a download just put it. */
  const [msPath, setMsPath] = useState<string | null>(null);
  /** Held back until the page being read has rasterised — see `THUMB_REACH`. */
  const [thumbsLive, setThumbsLive] = useState(false);

  // Opens in read mode: the default tool is the pen but `armed` is false until you pick it up, so a
  // fresh paper never catches a stray click as ink. Clicking the active tool toggles `armed` back off.
  const [tool, setTool] = useState<Tool>('pen');
  const [armed, setArmed] = useState(false);
  /**
   * The tool's settings popover, and it is DELIBERATELY not the same flag as `armed`.
   *
   * It used to be — the popover showed while the pen was armed and nothing else — so the only way to
   * get the swatches and sliders off the screen was to press the pen again, which put the tool down
   * as well. That is the bug Zohaib reported. Three things dismiss it now and none of them disarms
   * the tool: the × in its head, Escape, and a click anywhere outside the bar (including the first
   * stroke on the paper). The caret in the tool group brings it back.
   */
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Ink settings persist across papers: the colour you write in is yours, not the paper's. All three
  // are plain prefs, so nothing new is needed in the store. Stored values are read key by key
  // rather than spread, so a file written by an older build simply has gaps and gets the defaults.
  const [swatch, setSwatch] = useState(() => loadPref('ink.swatch', INK_SWATCHES[0].token));
  const [stroke, setStroke] = useState<StrokeWidth>(() => loadPref('ink.stroke', DEFAULT_STROKE));
  const [opacity, setOpacity] = useState<Record<Tool, number>>(() => {
    const stored = loadPref<Partial<Record<Tool, number>>>('ink.opacity', {});
    return {
      pen: stored.pen ?? DEFAULT_OPACITY.pen,
      hl: stored.hl ?? DEFAULT_OPACITY.hl,
      er: stored.er ?? DEFAULT_OPACITY.er,
    };
  });

  /** Both surfaces' ink, loaded together so a page of either renders on the first frame. */
  const [inks, setInks] = useState<Record<Surface, PageInk>>(() => ({
    qp: loadInk<PageInk>(id, {}),
    ms: loadInk<PageInk>(msId, {}),
  }));
  /** Marks lifted by undo, per surface and page, so redo has something to put back. Never on disk. */
  const [undone, setUndone] = useState<Record<Surface, PageInk>>({ qp: {}, ms: {} });
  /** The surface the last mark was made on — what undo and redo act on. */
  const [surface, setSurface] = useState<Surface>('qp');
  /** The mark-scheme page under the sheet's midline, reported by the sheet as it scrolls. */
  const [msPage, setMsPage] = useState(1);

  /* --- clip to notebook ----------------------------------------------------
   *
   * Two pieces of state, not one: `picking` is the destination popover and `clipTo` is the armed
   * destination. Keeping them apart is what lets the marquee stay armed for several clips in a row —
   * a student pulling three parts of one question out of a paper should not have to choose the same
   * notebook three times. Reachable only while `SHOW_CLIP_TOOL` is on. */
  const [picking, setPicking] = useState(false);
  const [clipTo, setClipTo] = useState<NbEntry | null>(null);
  const [clipped, setClipped] = useState<{ id: string; name: string; page: number } | null>(null);
  const [clipError, setClipError] = useState<string | null>(null);

  const takeClip = useCallback(
    (png: Blob) => {
      const target = clipTo;
      if (!target) return;
      setClipError(null);
      // The clip goes to the end of the notebook, which is where new working goes. `placeImage`
      // decides the exact page: it lands under whatever is already there, or on the next page if
      // there is no room — and the next page always exists, by construction.
      void placeImage(target.id, Math.max(0, target.pages - 1), png)
        .then(({ page: landed }) => setClipped({ id: target.id, name: target.name, page: landed }))
        .catch((e) => setClipError(String(e)));
    },
    [clipTo],
  );

  const well = useRef<HTMLDivElement>(null);
  const barwrap = useRef<HTMLDivElement>(null);

  // --- the paper ------------------------------------------------------------
  //
  // The catalogue lists papers that are not on this machine, so opening one may mean
  // fetching it first. That happens here rather than being refused: the row's own
  // `qpPath` is used when it is already downloaded, and the path the download resolves
  // to is used directly otherwise — never waiting on the list query to refresh, which
  // would leave the reader staring at a stale null.
  //
  // A RECORDED PATH THAT WILL NOT READ IS NOT AN ERROR, IT IS A MISSING DOWNLOAD. `qpPath` comes from
  // the `download` table, and a row can outlive the file it names: the index lives in app data and the
  // papers under Documents, so anything that carries one across without the other — a roaming profile,
  // a restored AppData folder, a second machine — leaves every path dangling. That used to dead-end on
  // a raw `os error 3` with no way forward. Now the failed read falls through to a download, which
  // costs nothing when the bytes are in fact still on disk under the name the current build expects
  // (Rust records them again and hands the path straight back) and fetches them when they are not.
  useEffect(() => {
    let cancelled = false;
    let closer: (() => Promise<void>) | null = null;
    setDoc(null);
    setError(null);
    setPage(1);
    setMsPage(1);
    setSurface('qp');
    setThumbsLive(false);
    setInks({ qp: loadInk<PageInk>(id, {}), ms: loadInk<PageInk>(msId, {}) });
    setUndone({ qp: {}, ms: {} });
    setMsPath(paper.msPath);

    void (async () => {
      let bytes: ArrayBuffer | null = null;

      if (paper.qpPath) {
        try {
          bytes = await readDocument(paper.qpPath);
        } catch {
          // The record outlived the file. Rust has just forgotten the row; fetch it again below.
        }
        if (cancelled) return;
      }

      if (!bytes) {
        setFetching(true);
        const fresh = await onDownload(paper.id, 'qp');
        if (!cancelled) setFetching(false);
        if (cancelled) return;
        if (!fresh) {
          setError('That paper could not be downloaded. Check your connection and try again.');
          return;
        }
        try {
          bytes = await readDocument(fresh);
        } catch (e) {
          if (!cancelled) setError(String(e));
          return;
        }
        if (cancelled) return;
      }

      try {
        const opened = await openPdf(new Uint8Array(bytes));
        if (cancelled) {
          await opened.close();
          return;
        }
        closer = opened.close;
        setDoc(opened.doc);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();

    return () => {
      cancelled = true;
      if (closer) void closer();
    };
  }, [paper.id, paper.qpPath, paper.msPath, id, msId, onDownload]);

  /**
   * Read the mark scheme, healing a record that has outlived its file — the same fallback the question
   * paper takes above, which is why the sheet takes this as a prop rather than calling `readDocument`
   * itself. Held in a ref by the sheet, so a new closure here cannot re-trigger its loader.
   */
  const readMarkScheme = useCallback(
    async (path: string): Promise<ArrayBuffer> => {
      try {
        return await readDocument(path);
      } catch {
        const fresh = await onDownload(paper.id, 'ms');
        if (!fresh) {
          throw new Error(
            'That mark scheme is no longer on this machine and could not be downloaded again.',
          );
        }
        return await readDocument(fresh);
      }
    },
    [paper.id, onDownload],
  );

  /** Open the mark scheme, fetching it first if the catalogue says one exists. */
  const openMarkScheme = useCallback(async () => {
    if (msOpen) {
      setMsOpen(false);
      return;
    }
    if (msPath) {
      setMsOpen(true);
      return;
    }
    if (!paper.hasMs) return;
    setFetching(true);
    const path = await onDownload(paper.id, 'ms');
    setFetching(false);
    if (!path) return;
    setMsPath(path);
    setMsOpen(true);
  }, [msOpen, msPath, paper.hasMs, paper.id, onDownload]);

  // Closing the sheet hands undo and redo back to the paper: the mark scheme's ink is still on disk,
  // but the page it belongs to is no longer on screen and a history button must never act on
  // something the user cannot see.
  useEffect(() => {
    if (!msOpen) setSurface('qp');
  }, [msOpen]);

  const pageCount = doc?.numPages ?? 1;

  // Home's "pick up where you left off" strip reads this.
  useEffect(() => {
    if (doc) saveReaderPos(id, { page, pages: doc.numPages });
  }, [doc, id, page]);
  const nib = useMemo<InkSettings>(
    () => ({ token: swatch, strokePx: stroke, opacity: opacity[tool] }),
    [swatch, stroke, opacity, tool],
  );

  // --- ink ------------------------------------------------------------------
  // These read `inks` and `undone` straight rather than through an updater callback, because each
  // of them has to touch both: a `setState(prev => …)` updater runs twice under StrictMode, which
  // would push the same lifted mark onto the redo stack twice.
  const inkKeyOf = (target: Surface) => (target === 'ms' ? msId : id);
  /** The page each surface's history acts on — the paper's from the well, the sheet's from itself. */
  const activePage = surface === 'ms' ? msPage : page;

  const commit = useCallback(
    (target: Surface, pageNum: number, mark: Mark) => {
      const next = { ...inks[target], [pageNum]: [...(inks[target][pageNum] ?? []), mark] };
      saveInk(inkKeyOf(target), next);
      setInks({ ...inks, [target]: next });
      // Drawing again is the end of that redo branch — the standard undo model, and the only one
      // where the button's enabled state cannot lie about what it will put back.
      if (undone[target][pageNum]?.length)
        setUndone({ ...undone, [target]: { ...undone[target], [pageNum]: [] } });
      setSurface(target);
    },
    [inks, undone, id, msId],
  );

  const undo = useCallback(() => {
    const current = inks[surface][activePage] ?? [];
    if (current.length === 0) return;
    const next = { ...inks[surface], [activePage]: current.slice(0, -1) };
    saveInk(inkKeyOf(surface), next);
    setInks({ ...inks, [surface]: next });
    setUndone({
      ...undone,
      [surface]: {
        ...undone[surface],
        [activePage]: [...(undone[surface][activePage] ?? []), current[current.length - 1]],
      },
    });
  }, [inks, undone, surface, activePage, id, msId]);

  const redo = useCallback(() => {
    const stack = undone[surface][activePage] ?? [];
    if (stack.length === 0) return;
    const next = {
      ...inks[surface],
      [activePage]: [...(inks[surface][activePage] ?? []), stack[stack.length - 1]],
    };
    saveInk(inkKeyOf(surface), next);
    setInks({ ...inks, [surface]: next });
    setUndone({ ...undone, [surface]: { ...undone[surface], [activePage]: stack.slice(0, -1) } });
  }, [inks, undone, surface, activePage, id, msId]);

  const pickSwatch = (token: string) => {
    setSwatch(token);
    savePref('ink.swatch', token);
  };

  const pickStroke = (px: StrokeWidth) => {
    setStroke(px);
    savePref('ink.stroke', px);
  };

  /** The opacity control edits the current tool's value, so picking up a pen is never 45% ink. */
  const pickOpacity = (value: number) => {
    const next: Record<Tool, number> = { pen: opacity.pen, hl: opacity.hl, er: opacity.er };
    next[tool] = value;
    setOpacity(next);
    savePref('ink.opacity', next);
  };

  /** Pick a tool up, or put the one in your hand down. The popover follows the tool. */
  const takeTool = (next: Tool) => {
    if (tool === next) {
      const on = !armed;
      setArmed(on);
      setSettingsOpen(on);
      return;
    }
    setTool(next);
    setArmed(true);
    setSettingsOpen(true);
  };

  // --- pages ----------------------------------------------------------------
  // The well is a continuous vertical stack, so navigation SCROLLS to a page rather than swapping a
  // single canvas. `goTo` brings page n's top just under the well's head padding.
  const goTo = useCallback(
    (target: number) => {
      const el = well.current;
      if (!el) return;
      const n = Math.min(pageCount, Math.max(1, target));
      const node = el.querySelector<HTMLElement>(`.rd-page[data-page="${n}"]`);
      if (!node) return;
      el.scrollTo({
        top: el.scrollTop + node.getBoundingClientRect().top - el.getBoundingClientRect().top - 20,
      });
    },
    [pageCount],
  );

  const go = useCallback((delta: number) => goTo(page + delta), [goTo, page]);

  // The current page is DERIVED from scroll position now: the page whose box spans the well's
  // vertical midpoint. Drives the indicator, the active thumb and the current question. rAF-throttled
  // so a fast scroll does not setState per event.
  useEffect(() => {
    const el = well.current;
    if (!el || !doc) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const mid = el.getBoundingClientRect().top + el.clientHeight / 2;
      let current = 1;
      el.querySelectorAll<HTMLElement>('.rd-page').forEach((p) => {
        if (p.getBoundingClientRect().top <= mid) current = Number(p.dataset.page);
      });
      setPage(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [doc]);

  // --- the settings popover dismisses itself --------------------------------
  //
  // Capture phase, so a pointerdown that lands on a page closes the popover *and* still starts the
  // stroke: the stroke is what the user meant, and the panel was in the way.
  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (e: PointerEvent) => {
      const wrap = barwrap.current;
      if (wrap && !wrap.contains(e.target as Node)) setSettingsOpen(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [settingsOpen]);

  // --- keyboard -------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The size and opacity sliders are real range inputs and own their own arrow keys.
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const mod = e.ctrlKey || e.metaKey;
      if (mod) {
        // Only the history pair is ours. Ctrl-K and the rest belong to App, so anything else with
        // a modifier is left alone rather than swallowed here.
        const key = e.key.toLowerCase();
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        } else if (key === 'y') {
          e.preventDefault();
          redo();
        }
        return;
      }

      if (e.key === 'Escape') {
        // Most transient first: the settings panel is a moment old, the marquee is a mode you entered
        // a second ago, the sheet is one you opened deliberately, and focus mode is one you may have
        // been in for an hour.
        if (settingsOpen) setSettingsOpen(false);
        else if (clipTo) {
          setClipTo(null);
          setClipped(null);
        } else if (msOpen) setMsOpen(false);
        else if (focus) onToggleFocus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, msOpen, focus, onToggleFocus, clipTo, settingsOpen]);

  const width = Math.round(BASE_WIDTH * ZOOMS[zoom]);
  const inkPercent = Math.round(opacity[tool] * 100);
  const toolName = TOOLS.find((t) => t.tool === tool)?.label ?? 'Tool';

  return (
    <>
      {/* Bell App v2's reader bar: back, the subject and its code on the left; the focus clock in
          the middle; Clip, the mark scheme and the window controls on the right. */}
      <div className="rd-top" data-tauri-drag-region>
        <div className="rd-top-l">
          <button type="button" className="rd-back" title="Back to Past Papers" aria-label="Back to Past Papers" onClick={onBack}>
            ←
          </button>
          <SubjectIcon code={paper.subjectCode} size={21} />
          <span className="rd-top-name">{paper.subjectName}</span>
          <span className="rd-top-code">
            {paper.subjectCode}/{paper.component} · {session}
          </span>
        </div>
        <FocusTimer paper={id} />
        <div className="rd-top-r">
          {SHOW_FOCUS_TOGGLE && (
            <IconButton icon="focus" label="Focus mode" active={focus} title="Focus mode — everything but the paper recedes" onClick={onToggleFocus} />
          )}
          {SHOW_CLIP_TOOL && (
            <span className="rd-clipwrap">
              <button
                type="button"
                className="rd-topbtn"
                aria-pressed={clipTo != null || picking}
                title={clipTo ? `Stop clipping to ${clipTo.name}` : 'Clip part of this page into a notebook'}
                onClick={() => {
                  if (clipTo) {
                    setClipTo(null);
                    setClipped(null);
                  } else setPicking((p) => !p);
                }}
              >
                <i className="rd-clip-glyph" aria-hidden="true" />
                Clip
              </button>
              <ClipPicker
                open={picking}
                notebooks={notebooks ?? []}
                loading={notebooks == null}
                onClose={() => setPicking(false)}
                onNew={() => {
                  setPicking(false);
                  onNewNotebook?.();
                }}
                onPick={(entry) => {
                  setPicking(false);
                  setClipped(null);
                  setClipTo(entry);
                }}
              />
            </span>
          )}
          <button
            type="button"
            className="rd-topbtn"
            aria-pressed={msOpen}
            disabled={!msPath && !paper.hasMs}
            title={
              msPath
                ? msOpen
                  ? 'Close the mark scheme'
                  : 'Open the mark scheme beside the paper'
                : paper.hasMs
                  ? 'Download the mark scheme'
                  : 'No mark scheme for this sitting'
            }
            onClick={() => void openMarkScheme()}
          >
            <i className="rd-ms-glyph" aria-hidden="true" />
            Mark scheme
          </button>
          <WindowLights />
        </div>
      </div>

      <section className="view rd" data-ms={msOpen ? 'open' : undefined}>
        {/* §5 page rail `194:732`. The eyebrow is pinned and the thumbs scroll: the file draws five
            pages, the real index hands us as many as the paper has. */}
        <nav className="rd-rail" aria-label="Pages">
          <div className="rd-rail-head t-label-section">Pages</div>
          {doc ? (
            <ol className="rd-thumbs">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <PageThumb
                  /* Keyed by the paper as well as the page: two papers with the same page count
                     would otherwise reuse these components, and a thumb that has already drawn
                     would keep showing the previous paper's page. */
                  key={`${id}-${n}`}
                  doc={doc}
                  page={n}
                  active={n === page}
                  live={thumbsLive}
                  onSelect={() => goTo(n)}
                />
              ))}
            </ol>
          ) : (
            <p className="rd-rail-empty t-body-meta">
              {error ? 'No pages.' : fetching ? 'Downloading…' : 'Opening…'}
            </p>
          )}
        </nav>

        {/* §6 paper `194:741`. The well is the only scroller and holds a continuous vertical STACK of
            pages, each lazily rasterised and centred; a zoomed page pans because the well overflows. */}
        <div className="rd-well" ref={well}>
          <div className="rd-stage">
            {error ? (
              <Notice className="rd-error">{error}</Notice>
            ) : fetching && !doc ? (
              /* First open of a paper that is not on this machine yet. Said plainly, because
                 the alternative — a blank sheet with no explanation — reads as a fault. */
              <Notice className="rd-error">Downloading this paper…</Notice>
            ) : doc ? (
              Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <ReaderPage
                  key={`${id}-${n}`}
                  tabActive={tabActive}
                  doc={doc}
                  page={n}
                  width={width}
                  tool={armed ? tool : null}
                  ink={nib}
                  marks={inks.qp[n] ?? []}
                  onCommit={(mark) => commit('qp', n, mark)}
                  onRendered={() => setThumbsLive(true)}
                  clipping={clipTo != null}
                  onClip={takeClip}
                />
              ))
            ) : null}
          </div>
        </div>

        {/* The armed-mode hint, and then what happened. One slot, because they are two states of the
            same conversation and stacking them would push the paper down. A sibling of the well
            rather than a child, so it cannot scroll away from under the pointer mid-drag. */}
        {clipTo && (
          <div className="rd-cliphint" role="status">
            <div className="rd-cliphint-pill">
              {clipError ? (
                <span className="rd-cliphint-bad t-body-small">{clipError}</span>
              ) : clipped ? (
                <>
                  <span className="t-body-small">
                    Kept in <strong>{clipped.name}</strong>, page {pageLabel(clipped.page)}
                  </span>
                  {onOpenNotebook && (
                    <button
                      type="button"
                      className="rd-cliphint-go t-body-small"
                      onClick={() => onOpenNotebook(clipped.id, clipped.page)}
                    >
                      Go there
                    </button>
                  )}
                </>
              ) : (
                <span className="t-body-small">
                  Drag a box around what you want to keep in <strong>{clipTo.name}</strong>
                  <span className="rd-cliphint-esc t-body-meta">Esc to stop</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* §8 `tool bar` `201:30` — one floating pill, now carrying five groups: the file's three
            plus zoom and the mark scheme, both of which Zohaib moved down here out of the top bar.
            The wrapper spans the frame and a transform shifts the pill onto the well's centre. */}
        <div className="rd-barwrap" ref={barwrap}>
          {/* Mounted whether or not it is open, so opening and closing are a transform and an
              opacity rather than a mount — and `inert` is what keeps a hidden panel's swatches and
              sliders out of the tab order, which `opacity: 0` alone would not. */}
          <div
            className="rd-tool-pop"
            role="group"
            aria-label={`${toolName} settings`}
            data-open={armed && settingsOpen ? 'true' : undefined}
            inert={!(armed && settingsOpen)}
          >
            <div className="rd-tool-pop-head">
              <Icon name={tool === 'er' ? 'eraser' : 'pen'} className="rd-tool-pop-glyph" />
              <b className="t-body-strong">{toolName}</b>
              <span className="rd-tool-pop-gap" />
              <IconButton
                icon="x"
                label={`Hide the ${toolName.toLowerCase()} settings`}
                title="Hide these controls — the tool stays in your hand"
                onClick={() => setSettingsOpen(false)}
              />
            </div>

            {tool !== 'er' && (
              <>
                <div className="rd-swatches" role="group" aria-label="Ink colour">
                  {INK_SWATCHES.map((s) => (
                    <button
                      key={s.token}
                      type="button"
                      className="rd-swatch"
                      style={{ background: `var(${s.token})` }}
                      aria-label={s.label}
                      aria-pressed={s.token === swatch}
                      title={s.label}
                      onClick={() => pickSwatch(s.token)}
                    />
                  ))}
                </div>
                <div className="rd-pen-preview-box">
                  <span
                    className="rd-pen-preview"
                    style={{
                      width: stroke,
                      height: stroke,
                      background: `var(${swatch})`,
                      opacity: opacity.pen,
                    }}
                    aria-hidden="true"
                  />
                </div>
              </>
            )}

            <div className="rd-pen-row">
              <span className="rd-pen-rowlabel t-body-meta">Size</span>
              <Slider
                value={stroke}
                min={STROKE_MIN}
                max={STROKE_MAX}
                step={1}
                label={`${toolName} size`}
                aria-valuetext={`${stroke} px`}
                onChange={(v) => pickStroke(Math.round(v))}
              />
              <span className="rd-pen-val t-mono-small">{stroke} px</span>
            </div>

            {/* The eraser has no opacity row on purpose: below 1 it FADES ink instead of lifting it,
                which is a real effect and a surprising default for something called an eraser. */}
            {tool !== 'er' && (
              <div className="rd-pen-row">
                <span className="rd-pen-rowlabel t-body-meta">Opacity</span>
                <Slider
                  value={inkPercent}
                  min={10}
                  max={100}
                  step={5}
                  label={`${toolName} opacity`}
                  aria-valuetext={`${inkPercent}%`}
                  onChange={(v) => pickOpacity(v / 100)}
                />
                <span className="rd-pen-val t-mono-small">{inkPercent}%</span>
              </div>
            )}
          </div>

          <div className="rd-bar">
            <div className="rd-bar-grp" role="group" aria-label="Annotation tools">
              {TOOLS.map((t) => (
                <button
                  key={t.tool}
                  type="button"
                  className="rd-tool"
                  aria-pressed={armed && tool === t.tool}
                  aria-label={t.label}
                  title={`${t.label} — writes on the paper and on the mark scheme; press again to just read`}
                  onClick={() => takeTool(t.tool)}
                >
                  <ToolGlyph tool={t.tool} />
                </button>
              ))}
              <button
                type="button"
                className={settingsOpen ? 'rd-tool rd-caret rd-caret--open' : 'rd-tool rd-caret'}
                aria-pressed={armed && settingsOpen}
                aria-label={settingsOpen ? `Hide the ${toolName.toLowerCase()} settings` : `${toolName} settings`}
                disabled={!armed}
                onClick={() => setSettingsOpen((open) => !open)}
              >
                <i aria-hidden="true" />
              </button>
            </div>

            <span className="rd-bar-sep" aria-hidden="true" />

            <div className="rd-inks" role="group" aria-label="Ink colour">
              {INK_SWATCHES.slice(0, 3).map((sw) => (
                <button
                  key={sw.token}
                  type="button"
                  className="rd-ink"
                  style={{ background: `var(${sw.token})` }}
                  aria-label={sw.label}
                  aria-pressed={sw.token === swatch}
                  title={sw.label}
                  onClick={() => pickSwatch(sw.token)}
                />
              ))}
            </div>

            <span className="rd-bar-sep" aria-hidden="true" />

            <div className="rd-bar-grp" role="group" aria-label="History">
              <button
                type="button"
                className="rd-glyphbtn"
                aria-label={surface === 'ms' ? 'Undo the last mark on the mark scheme' : 'Undo the last mark'}
                title="Undo"
                disabled={(inks[surface][activePage] ?? []).length === 0}
                onClick={undo}
              >
                ↶
              </button>
              <button
                type="button"
                className="rd-glyphbtn"
                aria-label="Redo"
                title="Redo"
                disabled={(undone[surface][activePage] ?? []).length === 0}
                onClick={redo}
              >
                ↷
              </button>
            </div>

            <span className="rd-bar-sep" aria-hidden="true" />

            <div className="rd-bar-grp" role="group" aria-label="Page">
              <button type="button" className="rd-glyphbtn rd-pagebtn" aria-label="Previous page" title="Previous page" disabled={page === 1} onClick={() => go(-1)}>
                ←
              </button>
              <PageJumper page={page} pageCount={pageCount} onJump={goTo} />
              <button
                type="button"
                className="rd-glyphbtn rd-pagebtn"
                aria-label="Next page"
                title="Next page"
                disabled={page === pageCount}
                onClick={() => go(1)}
              >
                →
              </button>
            </div>

            <span className="rd-bar-sep" aria-hidden="true" />

            <div className="rd-bar-grp rd-zoom" role="group" aria-label="Zoom">
              <button type="button" className="rd-glyphbtn" aria-label="Zoom out" disabled={zoom === 0} onClick={() => setZoom((z) => Math.max(0, z - 1))}>
                −
              </button>
              <span className="rd-zoom-read">{Math.round(ZOOMS[zoom] * 100)}%</span>
              <button
                type="button"
                className="rd-glyphbtn"
                aria-label="Zoom in"
                disabled={zoom === ZOOMS.length - 1}
                onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))}
              >
                +
              </button>
            </div>
          </div>
        </div>

        <MarkSchemeSheet
          path={msPath}
          label={`${code} · ${paper.scode}`}
          open={msOpen}
          tabActive={tabActive}
          onClose={() => setMsOpen(false)}
          read={readMarkScheme}
          tool={armed ? tool : null}
          ink={nib}
          marks={inks.ms}
          onCommit={(n, mark) => commit('ms', n, mark)}
          onPage={setMsPage}
          footer={
            <div className="rd-feel">
              <div className="rd-feel-head">
                <span>HOW DID THIS ONE FEEL?</span>
                <i />
              </div>
              <Faces
                label="How did this paper feel?"
                options={FEELINGS}
                picked={new Set(feel ? [feel] : [])}
                onPick={pickFeel}
              />
            </div>
          }
        />
      </section>
    </>
  );
}
