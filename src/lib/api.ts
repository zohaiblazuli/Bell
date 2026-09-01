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

export const findSubject = (code: string, level?: string | null) =>
  invoke<number | null>('find_subject', { code, level: level ?? null });

/**
 * Bytes of one indexed PDF. Rust refuses any path that isn't in the index, so this is the
 * only way into the library and it can't reach outside it.
 */
export const readDocument = (path: string) => invoke<ArrayBuffer>('read_document', { path });

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
