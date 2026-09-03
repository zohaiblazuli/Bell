import { invoke } from '@tauri-apps/api/core';
import type {
  DifficultyRow,
  GtDoc,
  IngestReport,
  LibraryStats,
  PaperRow,
  Subject,
  ThresholdRow,
} from './types';

export const DEFAULT_ROOT = 'G:\\CambridgeDatabase';

/** Rebuild the local index by walking the read-only library. */
export const ingestLibrary = (root?: string) =>
  invoke<IngestReport>('ingest_library', { root: root ?? null });

export const libraryStats = () => invoke<LibraryStats>('library_stats');

/**
 * Question papers per sitting, keyed `9701/s25` — the denominator behind the Dashboard's coverage
 * matrix. `qp` rows only: mark schemes and threshold tables are not things you sit.
 */
export const sittingTotals = () => invoke<Record<string, number>>('sitting_totals');

export const listSubjects = (level?: string | null) =>
  invoke<Subject[]>('list_subjects', { level: level ?? null });

export const listPapers = (args: {
  subjectId?: number | null;
  level?: string | null;
  scode?: string | null;
  limit?: number | null;
}) =>
  invoke<PaperRow[]>('list_papers', {
    subjectId: args.subjectId ?? null,
    level: args.level ?? null,
    scode: args.scode ?? null,
    limit: args.limit ?? null,
  });

/**
 * Palette search: every whitespace-separated token has to match the paper's code, subject,
 * level, session, variant or year. Runs in SQL over the whole index rather than filtering a
 * page of rows in the webview.
 */
export const searchPapers = (query: string, limit = 12) =>
  invoke<PaperRow[]>('search_papers', { query, limit });

export const findSubject = (code: string, level?: string | null) =>
  invoke<number | null>('find_subject', { code, level: level ?? null });

/**
 * Bytes of one indexed PDF. Rust refuses any path that isn't in the index, so this is the
 * only way into the library and it can't reach outside it.
 */
export const readDocument = (path: string) => invoke<ArrayBuffer>('read_document', { path });

// --- the state directory, for Settings' Data card ----------------------------

/** Where the JSON keys live, so Settings can name the folder it offers to clear. */
export const statePath = () => invoke<string>('state_path');

/** Delete every stored key. Returns how many files went. The index is untouched. */
export const clearState = () => invoke<number>('state_clear');

/**
 * Copy the state dir to `<app data>/exports/<name>` and return where it landed. The name is ours
 * to choose but not the location — Rust validates it as a single path segment.
 */
export const exportState = (name: string) => invoke<string>('state_export', { name });

// --- threshold / difficulty seams -------------------------------------------

export const listThresholdDocs = (opts?: { unparsedOnly?: boolean; limit?: number }) =>
  invoke<GtDoc[]>('list_threshold_docs', {
    unparsedOnly: opts?.unparsedOnly ?? false,
    limit: opts?.limit ?? null,
  });

export const saveThresholds = (rows: ThresholdRow[]) =>
  invoke<number>('save_thresholds', { rows });

export const getThresholds = (subjectId: number, scode?: string | null) =>
  invoke<
    { component: string; maxMark: number | null; grade: string; mark: number; scode: string }[]
  >('get_thresholds', { subjectId, scode: scode ?? null });

export const saveDifficulty = (rows: DifficultyRow[]) =>
  invoke<number>('save_difficulty', { rows });
