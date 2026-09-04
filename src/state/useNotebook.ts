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
  nbHistoryLoad,
  nbHistorySave,
  nbPageDelete,
  nbPageLoad,
  nbPageSave,
  pageCountFromMaxIndex,
  pageIsEmpty,
  spreadCountFor,
  spreadOf,
  spreadPages,
  type NbEntry,
  type NbInkSettings,
  type NbPage,
} from '@/lib/notebooks';
import {
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
  /** Re-read one page from disk, discarding the copy in memory. Used when an image lands on it. */
  reload: (index: number) => Promise<void>;

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
   */
  const [ink, setInk] = useState<NbInkSettings>(() => ({
    ...DEFAULT_INK,
    ...loadPref<Partial<NbInkSettings>>('nb.ink', {}),
  }));
  const [recentColours, setRecentColours] = useState<string[]>(() =>
    loadPref<string[]>('nb.recentColours', []),
  );

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
    try {
      await Promise.all([
        ...indices.map((index) => {
          const page = latest.current.pages[index];
          // An emptied page is DELETED rather than written as `{strokes:[],objects:[]}`. The page
          // count is `1 + max(stem)`, so leaving an empty file behind would keep claiming pages the
          // student has cleared — and `stroke`-mode erasing exists precisely so the bytes can go.
          if (!page || pageIsEmpty(page)) return nbPageDelete(id, index);
          return nbPageSave(id, index, JSON.stringify(page));
        }),
        alsoHistory ? nbHistorySave(id, serialiseHistory(latest.current.history)) : Promise.resolve(),
      ]);
      setSaveState('idle');
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

  /* --- loading ------------------------------------------------------------ */

  useEffect(() => {
    let cancelled = false;
    setPages({});
    setHistory(emptyHistory());
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
      void nbPageLoad(id, index)
        .then((json) => {
          if (cancelled) return;
          let page = emptyPage();
          if (json) {
            try {
              page = JSON.parse(json) as NbPage;
            } catch {
              // Leave the file alone and open a blank page over it. Overwriting a page that will not
              // parse would turn a bug into lost handwriting.
              page = emptyPage();
            }
          }
          setPages((prev) => (prev[index] !== undefined ? prev : { ...prev, [index]: page }));
        })
        .catch(() => loaded.current.delete(index));
    }
    return () => {
      cancelled = true;
    };
  }, [wanted, id]);

  /**
   * Re-read one page from disk, discarding what is in memory for it.
   *
   * The one caller is an image arriving: `placeImage` writes straight to the file (it has to — it may
   * land on a page nobody has open), so the only way the object appears is to read it back.
   */
  const reload = useCallback(
    async (index: number) => {
      const json = await nbPageLoad(id, index).catch(() => null);
      let page = emptyPage();
      if (json) {
        try {
          page = JSON.parse(json) as NbPage;
        } catch {
          page = emptyPage();
        }
      }
      loaded.current.add(index);
      dirty.current.delete(index);
      setPages((prev) => ({ ...prev, [index]: page }));
      setPageTotal((n) => Math.max(n, pageCountFromMaxIndex(index)));
    },
    [id],
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

      if (command.k === 'stroke') {
        const token = ink.colour;
        setRecentColours((prev) => {
          const next = [token, ...prev.filter((t) => t !== token)].slice(0, 4);
          savePref('nb.recentColours', next);
          return next;
        });
      }
    },
    [schedule, ink.colour],
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

  const patchInk = useCallback((patch: Partial<NbInkSettings>) => {
    setInk((prev) => {
      const next = { ...prev, ...patch };
      savePref('nb.ink', next);
      return next;
    });
  }, []);

  const page = useCallback((index: number) => pages[index] ?? emptyPage(), [pages]);

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
    reload,
    commit,
    undo,
    redo,
    canUndo: historyCanUndo(history),
    canRedo: historyCanRedo(history),
    ink,
    patchInk,
    saveState,
    flush,
    recentColours,
  };
}
