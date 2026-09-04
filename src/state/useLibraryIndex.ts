/**
 * The catalogue and the download state: what the server says exists, what is on this
 * machine, and the filters the SQL understands.
 *
 * One hook rather than several because the pieces are not separable — a sync changes
 * the stats, the stats invalidate the paper query, a download changes a row in that
 * same query, and all three write to one error surface. See `usePrefs.ts` for why the
 * views kept explicit props instead of reading a context.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import * as api from '@/lib/api';
import type {
  DocKind,
  DownloadProgress,
  DownloadResult,
  LibraryStats,
  PaperRow,
  RepairReport,
  Subject,
  SyncReport,
} from '@/lib/types';

/** Key for the in-flight download map. */
export const downloadKey = (paperId: number, kind: DocKind) => `${paperId}:${kind}`;

/**
 * Aggregate progress for one batch, which is what an estimate can be built from.
 *
 * Counted in PAPERS, not files: a question paper brings its mark scheme along on a task of its
 * own, so counting files would make the total move while the bar was filling. One unit of
 * progress is one paper and both of its documents.
 */
export interface BulkProgress {
  done: number;
  total: number;
  failed: number;
  /** Epoch ms, so a caller can divide elapsed by done and project the rest. */
  startedAt: number;
}

/** How many downloads run at once. The reference implementation uses five; four
 *  leaves headroom on a slow connection without feeling serial. */
const DOWNLOAD_CONCURRENCY = 4;

export interface LibraryIndex {
  stats: LibraryStats | null;
  subjects: Subject[];
  /** Papers per `code/scode`. The coverage matrix cannot say "done" without it. */
  sittingTotals: Record<string, number>;
  papers: PaperRow[];
  loading: boolean;

  level: string | null;
  setLevel: (l: string | null) => void;
  /** Season-code letter, not a label: `s` | `w` | `m`. Filtered in the view. */
  season: string | null;
  setSeason: (s: string | null) => void;
  subjectId: number | null;
  setSubjectId: (id: number | null) => void;
  /** Narrow to papers whose question paper is already on this machine. */
  downloadedOnly: boolean;
  setDownloadedOnly: (v: boolean) => void;

  /** A catalogue sync is in flight. */
  busy: boolean;
  /** Human-readable step, straight from Rust. */
  progress: string | null;
  report: SyncReport | null;
  error: string | null;
  setError: (e: string | null) => void;
  runSync: () => Promise<void>;
  /** True once a sync has been attempted, so the UI can tell "empty" from "not yet". */
  synced: boolean;

  /** In-flight downloads keyed by `downloadKey`. */
  downloading: Record<string, DownloadProgress>;
  /** Non-null while `downloadAll` is running. */
  bulk: BulkProgress | null;
  /**
   * Fetch one document and return where it landed, or null if it failed.
   *
   * `quiet` suppresses the shared error surface, for callers that count their own failures — see
   * the note in the implementation for why a batch must not raise one.
   */
  download: (paperId: number, kind: DocKind, quiet?: boolean) => Promise<string | null>;
  /** Fetch many, a few at a time. Resolves when the queue drains. */
  downloadAll: (jobs: { paperId: number; kind: DocKind }[]) => Promise<void>;
  remove: (paperId: number, kind: DocKind) => Promise<void>;
  repair: () => Promise<RepairReport | null>;
  /** Result of the last repair, for Settings to report. */
  repairReport: RepairReport | null;
  /** Where downloads land. Null until Rust has answered. */
  downloadRoot: string | null;
  /** Open the downloads folder in Explorer. */
  revealDownloads: () => Promise<void>;
}

/** `paused` suspends the paper query: onboarding has nothing to show yet. */
export function useLibraryIndex(paused: boolean): LibraryIndex {
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sittingTotals, setSittingTotals] = useState<Record<string, number>>({});
  const [papers, setPapers] = useState<PaperRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [level, setLevel] = useState<string | null>(null);
  const [season, setSeason] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [downloadedOnly, setDownloadedOnly] = useState(false);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [report, setReport] = useState<SyncReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);

  const [downloading, setDownloading] = useState<Record<string, DownloadProgress>>({});
  const [bulk, setBulk] = useState<BulkProgress | null>(null);
  const [repairReport, setRepairReport] = useState<RepairReport | null>(null);
  const [downloadRoot, setDownloadRoot] = useState<string | null>(null);

  /** Bumped whenever something could change a paper row, to re-run the query. */
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((n) => n + 1), []);

  useEffect(() => {
    const un = listen<string>('catalog:progress', (e) => setProgress(e.payload));
    return () => void un.then((f) => f());
  }, []);

  useEffect(() => {
    const un = listen<DownloadProgress>('download:progress', (e) => {
      const payload = e.payload;
      setDownloading((prev) => ({ ...prev, [downloadKey(payload.paperId, payload.kind)]: payload }));
    });
    return () => void un.then((f) => f());
  }, []);

  // A question paper's mark scheme is fetched by a task Rust spawns after the paper
  // itself lands, so it finishes outside any promise the UI is awaiting. This is what
  // makes it show up: the row it belongs to is re-queried when it arrives.
  useEffect(() => {
    const un = listen<DownloadResult>('download:done', (e) => {
      if (e.payload.kind === 'ms') bump();
    });
    return () => void un.then((f) => f());
  }, [bump]);

  const refresh = useCallback(async () => {
    setStats(await api.libraryStats());
    setSubjects(await api.listSubjects(null));
    // Fetched with the rest of the index rather than by the Dashboard: it changes
    // only when the catalogue does, and the Dashboard should not have to know that.
    setSittingTotals(await api.sittingTotals());
  }, []);

  const runSync = useCallback(async () => {
    setBusy(true);
    setError(null);
    setReport(null);
    setProgress(null);
    try {
      setReport(await api.syncCatalog());
      await refresh();
      bump();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      setProgress(null);
      setSynced(true);
    }
  }, [refresh, bump]);

  // Read the cache first so the app paints something immediately, then sync in the
  // background. Offline with a populated cache is the normal case, not an error worth
  // interrupting anyone over — so it is swallowed unless there is nothing to show.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      let cached = 0;
      try {
        void api.downloadRootPath().then(setDownloadRoot).catch(() => {});
        const initial = await api.libraryStats();
        setStats(initial);
        setSubjects(await api.listSubjects(null));
        setSittingTotals(await api.sittingTotals());
        cached = initial.papers;
      } catch (e) {
        setError(String(e));
      }
      try {
        setReport(await api.syncCatalog());
        await refresh();
        bump();
      } catch (e) {
        if (cached === 0) setError(String(e));
      } finally {
        setSynced(true);
      }
    })();
  }, [refresh, bump]);

  // Papers follow the filters the Rust query understands.
  useEffect(() => {
    if (paused) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const rows = await api.listPapers({ subjectId, level, downloadedOnly });
        if (!cancelled) setPapers(rows);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subjectId, level, downloadedOnly, paused, revision]);

  const clearProgress = useCallback((paperId: number, kind: DocKind) => {
    setDownloading((prev) => {
      const next = { ...prev };
      delete next[downloadKey(paperId, kind)];
      return next;
    });
  }, []);

  /**
   * Fetch one document. A question paper also brings its mark scheme: Rust spawns that
   * fetch after the paper lands, so this resolves on the paper alone and the mark scheme
   * arrives a moment later through `download:done`.
   */
  const download = useCallback(
    async (paperId: number, kind: DocKind, quiet = false): Promise<string | null> => {
      const key = downloadKey(paperId, kind);
      if (!quiet) setError(null);
      // Seed the map before the first progress event so a spinner appears at once.
      setDownloading((prev) => ({
        ...prev,
        [key]: { paperId, kind, downloaded: 0, total: null },
      }));
      try {
        const result = await api.downloadPaper(paperId, kind);
        bump();
        void refresh();
        return result.path;
      } catch (e) {
        /* `quiet` is what keeps a batch from trapping onboarding. A single 404 in a run of a
           thousand papers is normal — the upstream host does not have every component of every
           sitting — and raising it would set the error that step 05 refuses to advance past. So a
           batch counts its failures in `BulkProgress.failed` and says so, while a download the user
           asked for by name still reports itself. */
        if (!quiet) setError(String(e));
        return null;
      } finally {
        clearProgress(paperId, kind);
      }
    },
    [bump, refresh, clearProgress],
  );

  /**
   * Run a batch a few at a time.
   *
   * The queue lives here rather than in Rust so there is exactly one scheduler:
   * commands are independent, and two of them competing for the same connection
   * mutex would serialise anyway.
   */
  const downloadAll = useCallback(
    async (jobs: { paperId: number; kind: DocKind }[]) => {
      if (jobs.length === 0) return;
      const startedAt = Date.now();
      let done = 0;
      let failed = 0;
      setBulk({ done: 0, total: jobs.length, failed: 0, startedAt });

      let cursor = 0;
      const workers = Array.from(
        { length: Math.min(DOWNLOAD_CONCURRENCY, jobs.length) },
        async () => {
          for (;;) {
            const index = cursor++;
            if (index >= jobs.length) return;
            const job = jobs[index];
            const path = await download(job.paperId, job.kind, true);
            done += 1;
            if (path === null) failed += 1;
            setBulk({ done, total: jobs.length, failed, startedAt });
          }
        },
      );
      try {
        await Promise.all(workers);
      } finally {
        // Cleared rather than left at 100%: a null `bulk` is how a caller knows the batch is over,
        // and a frozen full bar is indistinguishable from one that stalled on the last file.
        setBulk(null);
      }
    },
    [download],
  );

  const remove = useCallback(
    async (paperId: number, kind: DocKind) => {
      try {
        await api.deleteDownload(paperId, kind);
        bump();
        void refresh();
      } catch (e) {
        setError(String(e));
      }
    },
    [bump, refresh],
  );

  const revealDownloads = useCallback(async () => {
    try {
      // Asked for fresh rather than using `downloadRoot`, because the Rust side creates the folder
      // as it answers — revealing a path that is not there fails.
      await revealItemInDir(await api.downloadRootPath());
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const repair = useCallback(async (): Promise<RepairReport | null> => {
    try {
      const result = await api.repairDownloads();
      setRepairReport(result);
      bump();
      await refresh();
      return result;
    } catch (e) {
      setError(String(e));
      return null;
    }
  }, [bump, refresh]);

  return {
    stats, subjects, sittingTotals, papers, loading,
    level, setLevel, season, setSeason, subjectId, setSubjectId,
    downloadedOnly, setDownloadedOnly,
    busy, progress, report, error, setError, runSync, synced,
    downloading, bulk, download, downloadAll, remove, repair, repairReport,
    downloadRoot, revealDownloads,
  };
}
