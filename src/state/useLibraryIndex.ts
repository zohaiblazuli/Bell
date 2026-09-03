/**
 * The local index: what the Rust walk found, the filters the SQL understands, and the two rebuilds.
 *
 * One hook rather than two because the pieces are not separable — a rebuild changes the stats, the
 * stats invalidate the query, and the query's error surface is the same one the rebuild writes to.
 * See `usePrefs.ts` for why the views kept their explicit props instead of reading a context.
 */
import { useCallback, useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import * as api from '@/lib/api';
import { buildDifficulty, type BuildProgress, type BuildResult } from '@/lib/buildDifficulty';
import type { IngestProgress, IngestReport, LibraryStats, PaperRow, Subject } from '@/lib/types';

export interface LibraryIndex {
  stats: LibraryStats | null;
  subjects: Subject[];
  /** Question papers per `code/scode`. The coverage matrix cannot honestly say "done" without it. */
  sittingTotals: Record<string, number>;
  papers: PaperRow[];
  loading: boolean;

  level: string | null;
  setLevel: (l: string | null) => void;
  /** Season-code letter, not a label: `s` | `w` | `m`. Filtered in the view, not in SQL. */
  season: string | null;
  setSeason: (s: string | null) => void;
  subjectId: number | null;
  setSubjectId: (id: number | null) => void;

  busy: boolean;
  progress: IngestProgress | null;
  report: IngestReport | null;
  error: string | null;
  setError: (e: string | null) => void;
  runIngest: () => Promise<void>;

  diffBusy: boolean;
  diffProgress: BuildProgress | null;
  diffResult: BuildResult | null;
  runDifficulty: () => Promise<void>;
}

/** `paused` suspends the query: onboarding has no library to show and should not spend the trip. */
export function useLibraryIndex(paused: boolean): LibraryIndex {
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sittingTotals, setSittingTotals] = useState<Record<string, number>>({});
  const [papers, setPapers] = useState<PaperRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [level, setLevel] = useState<string | null>(null);
  const [season, setSeason] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<number | null>(null);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<IngestProgress | null>(null);
  const [report, setReport] = useState<IngestReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [diffBusy, setDiffBusy] = useState(false);
  const [diffProgress, setDiffProgress] = useState<BuildProgress | null>(null);
  const [diffResult, setDiffResult] = useState<BuildResult | null>(null);

  useEffect(() => {
    const un = listen<IngestProgress>('ingest:progress', (e) => setProgress(e.payload));
    return () => void un.then((f) => f());
  }, []);

  const refresh = useCallback(async () => {
    const s = await api.libraryStats();
    setStats(s);
    setSubjects(await api.listSubjects(null));
    // Fetched with the rest of the index rather than by the Dashboard: it changes only when the
    // index does, and the Dashboard should not have to know that.
    setSittingTotals(await api.sittingTotals());
    return s;
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await refresh();
      } catch (e) {
        setError(String(e));
      }
    })();
  }, [refresh]);

  // Papers follow the filters the Rust query understands.
  useEffect(() => {
    if (paused) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const rows = await api.listPapers({ subjectId, level, limit: subjectId ? 2500 : 600 });
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
  }, [subjectId, level, paused, stats?.docs, stats?.thresholds]);

  const runIngest = useCallback(async () => {
    setBusy(true);
    setError(null);
    setReport(null);
    setProgress(null);
    try {
      setReport(await api.ingestLibrary());
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [refresh]);

  const runDifficulty = useCallback(async () => {
    setDiffBusy(true);
    setError(null);
    setDiffResult(null);
    setDiffProgress(null);
    try {
      setDiffResult(await buildDifficulty(setDiffProgress));
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setDiffBusy(false);
      setDiffProgress(null);
    }
  }, [refresh]);

  return {
    stats, subjects, sittingTotals, papers, loading,
    level, setLevel, season, setSeason, subjectId, setSubjectId,
    busy, progress, report, error, setError, runIngest,
    diffBusy, diffProgress, diffResult, runDifficulty,
  };
}
