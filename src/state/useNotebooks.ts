/**
 * The shelf, and the four things that change it.
 *
 * The list is read from Rust once and kept here; every mutation goes through the same command that
 * writes the disk and then merges the row Rust hands back, so the shelf and the files can never
 * disagree about a name or a cover. There is deliberately no optimistic update: a notebook is a
 * directory, and reporting one as created before the directory exists is how a shelf ends up
 * offering a tile that opens nothing.
 *
 * `null` means "not read yet", which is a different state from "you have none" — the shelf's empty
 * composition (`629:859`) is a real screen with copy on it and it must not flash on the way in.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  nbCreate,
  nbDelete,
  nbList,
  nbMetaSave,
  type NbAuthored,
  type NbEntry,
} from '@/lib/notebooks';

export interface Notebooks {
  list: NbEntry[] | null;
  error: string | null;
  refresh: () => Promise<void>;
  create: (meta: NbAuthored) => Promise<NbEntry | null>;
  save: (id: string, meta: NbAuthored) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** The row for one id, or null. Cheap enough not to memoise; the shelf holds at most a few dozen. */
  find: (id: string) => NbEntry | null;
}

export function useNotebooks(): Notebooks {
  const [list, setList] = useState<NbEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setList(await nbList());
      setError(null);
    } catch (e) {
      setError(String(e));
      // An empty list rather than a permanent null: the shelf then renders its empty state with the
      // error above it, instead of sitting on "reading your notebooks…" for ever.
      setList((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Replace one row in place, or add it, keeping the most-recently-edited-first order. */
  const merge = useCallback((entry: NbEntry) => {
    setList((prev) => {
      const rest = (prev ?? []).filter((n) => n.id !== entry.id);
      return [entry, ...rest].sort((a, b) => b.updatedAt - a.updatedAt);
    });
  }, []);

  const create = useCallback(
    async (meta: NbAuthored) => {
      try {
        const entry = await nbCreate(meta);
        merge(entry);
        setError(null);
        return entry;
      } catch (e) {
        setError(String(e));
        return null;
      }
    },
    [merge],
  );

  const save = useCallback(
    async (id: string, meta: NbAuthored) => {
      try {
        merge(await nbMetaSave(id, meta));
        setError(null);
      } catch (e) {
        setError(String(e));
      }
    },
    [merge],
  );

  const remove = useCallback(async (id: string) => {
    try {
      await nbDelete(id);
      setList((prev) => (prev ?? []).filter((n) => n.id !== id));
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const find = useCallback((id: string) => list?.find((n) => n.id === id) ?? null, [list]);

  return { list, error, refresh, create, save, remove, find };
}
