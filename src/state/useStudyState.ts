/**
 * Marks, recents, and the row list a marked view actually renders.
 *
 * The snapshot path is the load-bearing part and it predates the port: a marked list renders from the
 * copies `store.ts` keeps, not from the current query, because a paper bookmarked two sessions ago is
 * not in whatever 600 rows are loaded now. Preserved verbatim. See `usePrefs.ts` for why the views
 * still take explicit props.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  loadRecent,
  loadRows,
  loadSet,
  noteOpened,
  rememberPaper,
  saveSet,
  type MarkFilter,
  type SetName,
} from '@/lib/store';
import type { PaperRow } from '@/lib/types';

export interface StudyState {
  marks: Record<SetName, Set<string>>;
  /**
   * Which marked list the library is rendering. It tracks the route for Bookmarks and Recent but
   * survives as its own value, because `revision` is reachable from the palette and the dashboard
   * without having a nav row of its own.
   */
  markFilter: MarkFilter;
  setMarkFilter: (m: MarkFilter) => void;
  /** The rows to render: the live query, or the store's snapshots for a marked list. */
  rows: (papers: PaperRow[]) => PaperRow[];
  toggleMark: (name: SetName, key: string, paper: PaperRow) => void;
  /** Note a paper as opened. The caller owns routing; this owns the record. */
  open: (paper: PaperRow) => void;
  recentCount: number;
}

export function useStudyState(): StudyState {
  const [marks, setMarks] = useState<Record<SetName, Set<string>>>(() => ({
    bookmarks: loadSet('bookmarks'),
    done: loadSet('done'),
    revision: loadSet('revision'),
  }));
  const [markFilter, setMarkFilter] = useState<MarkFilter>(null);
  /** Bumped whenever the study state on disk changes, so the marked lists re-read it. */
  const [touched, setTouched] = useState(0);

  /**
   * Marks are written through before the snapshot is kept, so the prune inside the store sees the new
   * truth and cannot drop a row the user just marked.
   */
  const toggleMark = useCallback(
    (name: SetName, key: string, paper: PaperRow) => {
      const next = new Set(marks[name]);
      const adding = !next.has(key);
      if (adding) next.add(key);
      else next.delete(key);
      saveSet(name, next);
      if (adding) rememberPaper(paper);
      setMarks((prev) => ({ ...prev, [name]: next }));
      setTouched((n) => n + 1);
    },
    [marks],
  );

  const open = useCallback((paper: PaperRow) => {
    noteOpened(paper);
    setTouched((n) => n + 1);
  }, []);

  const rows = useMemo(() => {
    // `touched` is the signal that the store changed under us; it is read for that alone.
    void touched;
    return (papers: PaperRow[]) => {
      if (!markFilter) return papers;
      const snapshots = loadRows();
      if (markFilter === 'recent') {
        return loadRecent()
          .map((r) => snapshots[r.key])
          .filter((r): r is PaperRow => Boolean(r));
      }
      return [...marks[markFilter]]
        .map((key) => snapshots[key])
        .filter((r): r is PaperRow => Boolean(r))
        .sort((a, b) => b.year - a.year || b.scode.localeCompare(a.scode));
    };
  }, [markFilter, marks, touched]);

  const recentCount = useMemo(() => {
    void touched;
    return loadRecent().length;
  }, [touched]);

  return { marks, markFilter, setMarkFilter, rows, toggleMark, open, recentCount };
}
