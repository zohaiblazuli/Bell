/**
 * One open notebook: its pages, its undo stack, where you are in it, and when any of that reaches
 * disk.
 *
 * Spec: `design/specs/screen-notebooks.md` §5 and §14, and the plan's §2.1 save policy.
 *
 * THE SAVE POLICY IS THE POINT OF THIS FILE. A per-page dirty flag, a 400ms debounce, and a forced
 * flush on a page turn, on window blur and on unmount. The Reader writes the paper's ENTIRE ink record
 * on every commit, undo and redo, which is how the eighteenth stroke on a page pushed ~65 KB through
 * the IPC to land about 1 KB of new geometry. Here a stroke marks one page and one page is what gets
 * written, once the hand has stopped.
 *
 * The undo stack is notebook-wide and persisted, so Ctrl+Z on page 6 can undo a stroke made on page 5
 * and the stack is still there after a relaunch. The Reader's is keyed by page, never written to disk
 * and reset on paper change.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_INK,
  emptyPage,
  isInkTool,
  nbHistoryLoad,
  nbHistorySave,
  nbPageDelete,
  nbPageLoad,
  nbPageSave,
  nbStat,
  pageCountFromMaxIndex,
  pageIsEmpty,
  spreadCountFor,
  spreadOf,
  spreadPages,
  type InkTool,
  type NbEntry,
  type NbInkSettings,
  type NbPage,
} from '@/lib/notebooks';
import {
  DEFAULT_INK_OPACITY,
  DEFAULT_INK_WIDTH_PX,
  apply as applyCommand,
  canRedo as historyCanRedo,
  canUndo as historyCanUndo,
  emptyHistory,
  parseHistory,
  pushCommand,
  redo as redoHistory,
  serialiseHistory,
  undo as undoHistory,
  type InkCommand,
  type InkHistory,
  type NbPages,
} from '@/lib/ink';
import { loadPref, savePref } from '@/lib/store';

/** §2.1: long enough that a sentence of handwriting is one write, short enough to feel immediate. */
const FLUSH_MS = 400;

/** Which pages are held in memory: the open spread and its neighbours. */
const PREFETCH = 1;

/**
 * One shared blank page for every index not in memory yet.
 *
 * A fresh `emptyPage()` per call gave every unwritten page a new object identity on every render, which
 * re-ran `NotebookPage`'s static repaint and its whole overlay pass for nothing. Nothing anywhere
 * mutates a page — every transform in `ink.ts` returns a new one — so one frozen instance is safe to
 * hand out, and the identity check that `paintStatic` hangs on becomes meaningful again.
 */
const BLANK: NbPage = Object.freeze(emptyPage());

/**
 * Size and opacity, remembered per ink tool.
 *
 * Persisted beside `nb.ink` rather than inside it, so a prefs file written by an older build simply has
 * no memory and every tool starts on its own measured default. One shared pair cannot serve four tools:
 * at the pen's 1.0 / 8px a highlighter is an opaque 8px bar that obliterates the words it exists to
 * tint, which is `DEFAULT_INK_OPACITY` describing a behaviour nothing implemented.
 */
type InkMemory = Partial<Record<InkTool, { strokePx: number; opacity: number }>>;

const toolInk = (tool: InkTool) => ({
  strokePx: DEFAULT_INK_WIDTH_PX[tool],
  opacity: DEFAULT_INK_OPACITY[tool],
});

export interface NotebookSession {
  /** 0-based spread index. */
  spread: number;
  /** Disk indices of the two open pages, left then right. */
  open: [number, number];
  /** Derived, and grows when the student turns past the end. Never shown as a total. */
  pages: number;
  spreadCount: number;
  /** Loaded pages only — a page that is not here yet is blank, not missing. */
  page: (index: number) => NbPage;
  goSpread: (spread: number) => void;
  turn: (delta: number) => void;
  /** Non-null while a turn is animating: the spread being left, and which way. */
  turning: { from: number; dir: 'fwd' | 'back' } | null;
  endTurn: () => void;
  /**
   * The page at `index`, read from disk only if this session has not got one — and never overwriting
   * what is in memory. Returns the record, so a caller can place something against what is actually
   * there rather than against a copy that may be behind the 400ms save debounce.
   *
   * A command committed onto an index that is merely *unread* lands on `BLANK`, and the flush then
   * writes that blank over a file full of handwriting. Every write path that can target a page off the
   * open spread — an image spilling onto the next one — goes through here first.
   */
  ensure: (index: number) => Promise<NbPage>;

  commit: (command: InkCommand) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  ink: NbInkSettings;
  patchInk: (patch: Partial<NbInkSettings>) => void;

  /** What the topbar's save dot says. `saving` is a flush in flight. */
  saveState: 'idle' | 'saving' | 'error';
  /** Force everything out now — the page turn, the window losing focus, and leaving all use it. */
  flush: () => Promise<void>;
  /**
   * Throw away everything not yet written. Only for delete: a flush after the directory has gone would
   * recreate it as an unreachable orphan.
   */
  discard: () => void;
  /** Colours actually used, most recent first — §6a's `recent` row. */
  recentColours: string[];
}

export function useNotebook(entry: NbEntry, startPage = 0): NotebookSession {
  const id = entry.id;

  const [spread, setSpread] = useState(() => spreadOf(startPage));
  const [pageTotal, setPageTotal] = useState(entry.pages);
  const [pages, setPages] = useState<NbPages>({});
  const [history, setHistory] = useState<InkHistory>(() => emptyHistory());
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [turning, setTurning] = useState<{ from: number; dir: 'fwd' | 'back' } | null>(null);

  /**
   * Ink settings persist across notebooks, not per notebook: the colour you write in is yours, the
   * same call the Reader made about its own three ink prefs. Read key by key so a file written by an
   * older build simply has gaps and gets the defaults.
   *
   * Size and opacity then come from the TOOL's own memory, so a relaunch on the highlighter comes up
   * as a highlighter rather than at whatever the pen was last set to.
   */
  const perTool = useRef<InkMemory | null>(null);
  perTool.current ??= loadPref<InkMemory>('nb.inkPerTool', {});

  const [ink, setInk] = useState<NbInkSettings>(() => {
    const stored: NbInkSettings = {
      ...DEFAULT_INK,
      ...loadPref<Partial<NbInkSettings>>('nb.ink', {}),
    };
    if (!isInkTool(stored.tool)) return stored;
    return { ...stored, ...(perTool.current?.[stored.tool] ?? toolInk(stored.tool)) };
  });
  const [recentColours, setRecentColours] = useState<string[]>(() =>
    loadPref<string[]>('nb.recentColours', []),
  );

  /** The live ink and recent list, for the callbacks below: neither writes through an updater, because
   *  an updater runs twice under StrictMode and both of these have a `savePref` beside them. */
  const inkNow = useRef(ink);
  inkNow.current = ink;
  const recentNow = useRef(recentColours);
  recentNow.current = recentColours;

  /** What the shelf handed over, for the reset when a different notebook is opened in place. */
  const opened = useRef({ pages: entry.pages, startPage });
  opened.current = { pages: entry.pages, startPage };

  /* --- what is on disk, and what is not yet ------------------------------- */

  /** Page indices whose in-memory record differs from the file. */
  const dirty = useRef(new Set<number>());
  /** Page indices already read (or being read), so a prefetch never fires twice for one page. */
  const loaded = useRef(new Set<number>());
  const historyDirty = useRef(false);
  const timer = useRef(0);
  /** The latest state, for a flush that runs from a listener rather than a render. */
  const latest = useRef({ pages, history });
  latest.current = { pages, history };

  const writeOut = useCallback(async () => {
    const indices = [...dirty.current];
    const alsoHistory = historyDirty.current;
    if (indices.length === 0 && !alsoHistory) return;
    dirty.current = new Set();
    historyDirty.current = false;
    setSaveState('saving');
    const emptied: number[] = [];
    try {
      await Promise.all([
        ...indices.map((index) => {
          const page = latest.current.pages[index];
          // An emptied page is DELETED rather than written as `{strokes:[],objects:[]}`. The page
          // count is `1 + max(stem)`, so leaving an empty file behind would keep claiming pages the
          // student has cleared — and `stroke`-mode erasing exists precisely so the bytes can go.
          if (!page || pageIsEmpty(page)) {
            emptied.push(index);
            return nbPageDelete(id, index);
          }
          return nbPageSave(id, index, JSON.stringify(page));
        }),
        alsoHistory ? nbHistorySave(id, serialiseHistory(latest.current.history)) : Promise.resolve(),
      ]);
      setSaveState('idle');
      // A page erased back to nothing has just left the disk, so the derived count can now be LOWER
      // than what is in memory — and `pageTotal` only ever grows on its own, which would leave the
      // topbar claiming pages the student has cleared. Re-read it rather than recompute: the
      // filesystem is where that number lives, and every dirty page has just landed on it.
      if (emptied.length > 0) {
        const stat = await nbStat(id).catch(() => null);
        if (stat) setPageTotal(stat.pages);
      }
    } catch {
      // Put them back so the next flush retries rather than losing the work silently.
      for (const index of indices) dirty.current.add(index);
      if (alsoHistory) historyDirty.current = true;
      setSaveState('error');
    }
  }, [id]);

  const schedule = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = 0;
      void writeOut();
    }, FLUSH_MS);
  }, [writeOut]);

  const flush = useCallback(async () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = 0;
    }
    await writeOut();
  }, [writeOut]);

  /**
   * Forget everything not yet written.
   *
   * The one caller is delete. `write_atomic` creates its parent directory, so a page still in `dirty`
   * when the notebook's folder goes would be written straight back by the unmount flush — recreating
   * `notebooks\<id>\pages\` with no `meta.json`, which `nb_list` then skips, stranding a real page file
   * where nothing in the product can reach it.
   */
  const discard = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = 0;
    }
    dirty.current = new Set();
    historyDirty.current = false;
  }, []);

  /* --- loading ------------------------------------------------------------ */

  /** A page file as a record. A file that will not parse opens as blank and is LEFT ALONE on disk —
   *  overwriting a page that will not parse would turn a bug into lost handwriting. */
  const readPage = useCallback(async (index: number): Promise<NbPage> => {
    const json = await nbPageLoad(id, index).catch(() => null);
    if (!json) return emptyPage();
    try {
      return JSON.parse(json) as NbPage;
    } catch {
      return emptyPage();
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setPages({});
    setHistory(emptyHistory());
    setTurning(null);
    // The whole session resets, not just the pages: a stale `pageTotal` would have the topbar report
    // the previous notebook's length, and a stale `spread` would open the new one where the old one
    // was left. Both are read from the row the shelf handed over, as the initial state is.
    setPageTotal(opened.current.pages);
    setSpread(spreadOf(opened.current.startPage));
    dirty.current = new Set();
    historyDirty.current = false;
    loaded.current = new Set();
    void nbHistoryLoad(id)
      .then((json) => {
        // A corrupt undo log must never stop a notebook opening; `parseHistory` degrades to empty.
        if (!cancelled) setHistory(parseHistory(json));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  /** The spread on show plus its neighbours, so a turn is instant rather than a round trip. */
  const wanted = useMemo(() => {
    const out: number[] = [];
    for (let s = spread - PREFETCH; s <= spread + PREFETCH; s++) {
      if (s < 0) continue;
      const [l, r] = spreadPages(s);
      out.push(l, r);
    }
    return out;
  }, [spread]);

  /**
   * Load whatever of `wanted` is not in memory.
   *
   * `pages` is deliberately NOT a dependency: it changes on every stroke, and re-running this on each
   * one would fire a read per sample. The `prev[index] !== undefined` guard inside the setter is what
   * makes that safe — a page that arrived while a read was in flight wins, so the file can never
   * overwrite work in progress. A page already in memory is never re-read, because it may be dirty
   * and the file would then be the older copy.
   */
  useEffect(() => {
    let cancelled = false;
    for (const index of wanted) {
      if (loaded.current.has(index)) continue;
      loaded.current.add(index);
      void readPage(index)
        .then((page) => {
          if (cancelled) return;
          setPages((prev) => (prev[index] !== undefined ? prev : { ...prev, [index]: page }));
        })
        .catch(() => loaded.current.delete(index));
    }
    return () => {
      cancelled = true;
    };
  }, [wanted, readPage]);

  /**
   * The page at `index`, loading it only if this session has not read it, and never overwriting what is
   * in memory.
   *
   * A command committed onto an index that is merely *unread* lands on `BLANK`, and the flush then
   * writes that blank over a file full of handwriting. Every write path that can target a page off the
   * open spread — an image spilling onto the next one — goes through here first, and gets back the
   * record it should be placing against.
   */
  const ensure = useCallback(
    async (index: number): Promise<NbPage> => {
      const held = latest.current.pages[index];
      if (held !== undefined) return held;
      const read = await readPage(index);
      loaded.current.add(index);
      // A page that arrived while this read was in flight wins — the same rule the prefetch follows, and
      // what makes it impossible for the file to overwrite work in progress.
      const now = latest.current.pages[index];
      if (now !== undefined) return now;
      setPages((prev) => (prev[index] !== undefined ? prev : { ...prev, [index]: read }));
      return read;
    },
    [readPage],
  );

  /* --- editing ------------------------------------------------------------ */

  const commit = useCallback(
    (command: InkCommand) => {
      setPages((prev) => applyCommand(prev, command));
      setHistory((prev) => pushCommand(prev, command));
      dirty.current.add(command.page);
      historyDirty.current = true;
      // A stroke on a page past the current end is what materialises that page — the count follows
      // the writing rather than being asked for. TRAP 15's promise, in one line.
      setPageTotal((n) => Math.max(n, pageCountFromMaxIndex(command.page)));
      schedule();

      // An eraser swipe is a stroke too in paint mode, and "recent colours" means colours the student
      // chose to write in — rubbing something out is not a choice of colour. `savePref` sits outside
      // the updater for the reason `undo` documents below.
      if (command.k === 'stroke' && command.stroke.t !== 'er') {
        const token = inkNow.current.colour;
        if (recentNow.current[0] !== token) {
          const next = [token, ...recentNow.current.filter((t) => t !== token)].slice(0, 4);
          recentNow.current = next;
          savePref('nb.recentColours', next);
          setRecentColours(next);
        }
      }
    },
    [schedule],
  );

  const undo = useCallback(() => {
    // Read the refs rather than using an updater: an updater runs twice under StrictMode and would
    // pop two commands for one press. `ink.ts`'s reducer is pure, so calling it here is safe.
    const result = undoHistory(latest.current.pages, latest.current.history);
    if (!result.command) return;
    setPages(result.state);
    setHistory(result.history);
    dirty.current.add(result.command.page);
    historyDirty.current = true;
    schedule();
  }, [schedule]);

  const redo = useCallback(() => {
    const result = redoHistory(latest.current.pages, latest.current.history);
    if (!result.command) return;
    setPages(result.state);
    setHistory(result.history);
    dirty.current.add(result.command.page);
    historyDirty.current = true;
    setPageTotal((n) => Math.max(n, pageCountFromMaxIndex(result.command!.page)));
    schedule();
  }, [schedule]);

  /* --- navigation --------------------------------------------------------- */

  const goSpread = useCallback(
    (target: number) => {
      const next = Math.max(0, target);
      if (next === spread) return;
      setTurning({ from: spread, dir: next > spread ? 'fwd' : 'back' });
      setSpread(next);
      // Flushed on the turn, not just on the debounce: the page you are leaving is the one you most
      // want on disk, and a crash between two spreads should cost nothing.
      //
      // Nothing is added to the page count here, deliberately. `next` is always reachable — the
      // spread exists in memory the moment you turn to it — but a count is a claim about what has
      // been WRITTEN, and inflating it by turning would have the topbar reporting 22 pages of which
      // 20 are blank. `spreadCount` widens instead, so the Pages tab can still list where you are.
      void flush();
    },
    [flush, spread],
  );

  const turn = useCallback((delta: number) => goSpread(spread + delta), [goSpread, spread]);

  /* --- leaving ------------------------------------------------------------ */

  useEffect(() => {
    const out = () => void flush();
    window.addEventListener('blur', out);
    window.addEventListener('beforeunload', out);
    return () => {
      window.removeEventListener('blur', out);
      window.removeEventListener('beforeunload', out);
      // Unmount is the last chance: leaving the route must not be able to drop the 400ms window.
      out();
    };
  }, [flush]);

  /**
   * One control changes, and size and opacity follow the TOOL.
   *
   * Switching away files the current pair under the outgoing tool; switching in restores the incoming
   * tool's, or its measured default the first time. That is what `DEFAULT_INK_OPACITY` was recording
   * and nothing was reading — at the pen's 1.0 the highlighter painted an opaque bar over the words it
   * exists to tint. A slider move is filed immediately rather than only on the next tool change, so a
   * relaunch remembers it.
   *
   * `savePref` sits outside the updater deliberately: an updater runs twice under StrictMode.
   */
  const patchInk = useCallback((patch: Partial<NbInkSettings>) => {
    const prev = inkNow.current;
    let next: NbInkSettings = { ...prev, ...patch };
    let memory = perTool.current ?? {};

    if (patch.tool !== undefined && patch.tool !== prev.tool) {
      if (isInkTool(prev.tool)) {
        memory = { ...memory, [prev.tool]: { strokePx: prev.strokePx, opacity: prev.opacity } };
      }
      if (isInkTool(patch.tool)) {
        next = { ...next, ...(memory[patch.tool] ?? toolInk(patch.tool)) };
      }
    }
    if ((patch.strokePx !== undefined || patch.opacity !== undefined) && isInkTool(next.tool)) {
      memory = { ...memory, [next.tool]: { strokePx: next.strokePx, opacity: next.opacity } };
    }

    perTool.current = memory;
    inkNow.current = next;
    savePref('nb.ink', next);
    savePref('nb.inkPerTool', memory);
    setInk(next);
  }, []);

  const page = useCallback((index: number) => pages[index] ?? BLANK, [pages]);

  return {
    spread,
    open: spreadPages(spread),
    pages: pageTotal,
    // Widened to include where you are, so the Pages tab can list the spread you turned to even
    // before anything has been written on it. The page COUNT stays honest — see `goSpread`.
    spreadCount: Math.max(spreadCountFor(pageTotal), spread + 1),
    page,
    goSpread,
    turn,
    turning,
    endTurn: useCallback(() => setTurning(null), []),
    ensure,
    commit,
    undo,
    redo,
    canUndo: historyCanUndo(history),
    canRedo: historyCanRedo(history),
    ink,
    patchInk,
    saveState,
    flush,
    discard,
    recentColours,
  };
}
