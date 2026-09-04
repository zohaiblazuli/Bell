/** Shapes returned by the Rust side. Keep in sync with `src-tauri/src/library.rs`. */

/** Display label for a qualification. What the filter chips show. */
export type Level = 'A Level' | 'IGCSE' | 'O Level';

/** Canonical qualification, as the catalogue stores it. */
export type Qualification = 'a_level' | 'igcse' | 'o_level';

/** Canonical season, as the catalogue stores it. Labelled by `seasonLabel`. */
export type Season = 'may_june' | 'oct_nov' | 'feb_mar';

export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * Reference class a hardness score was computed against, in descending order of
 * confidence. `absolute` means there was too little history for a comparison; no
 * live paper currently uses it, but the catalogue's type permits it.
 */
export type DifficultyBasis = 'component' | 'subject' | 'absolute';

/** The two documents a paper can have. Examiner reports are not in the catalogue. */
export type DocKind = 'qp' | 'ms';

export interface LevelCount {
  level: string;
  subjects: number;
  papers: number;
}

export interface LibraryStats {
  subjects: number;
  sessions: number;
  papers: number;
  /** Files on this machine, counting question papers and mark schemes separately. */
  downloads: number;
  /** What those files take up on disk, in bytes. */
  downloadBytes: number;
  levels: LevelCount[];
  /** Epoch ms of the last successful catalogue sync. */
  syncedAtMs: number | null;
}

export interface Subject {
  id: number;
  level: string;
  qualification: Qualification;
  code: string;
  name: string;
  slug: string;
  sessions: number;
  papers: number;
  /** How many of this subject's question papers are downloaded. */
  downloaded: number;
  firstYear: number | null;
  lastYear: number | null;
}

/**
 * One paper in the catalogue.
 *
 * Every catalogued paper has a row whether or not it is on this machine: `qpPath`
 * and `msPath` are non-null only once downloaded. `hasMs` is separate on purpose —
 * it says a mark scheme *exists*, which is not the same as having fetched it.
 */
export interface PaperRow {
  /** Catalogue id. Stable across syncs, and what the download API takes. */
  id: number;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  qualification: Qualification;
  level: string;
  year: number;
  scode: string;
  season: Season;
  /** Two-digit component, e.g. "12". Third part of the paper key. */
  component: string;
  paperNumber: number;
  variant: number;
  totalMarks: number | null;
  aThreshold: number | null;
  bThreshold: number | null;
  cThreshold: number | null;
  dThreshold: number | null;
  eThreshold: number | null;
  aPct: number | null;
  curveMeanPct: number | null;
  spanPct: number | null;
  /** 0-100, higher = harder. 50 is an ordinary sitting of this component. */
  hardnessScore: number | null;
  difficulty: Difficulty | null;
  difficultyBasis: DifficultyBasis | null;
  /** Pre-rendered upstream so the wording always matches the score. Show verbatim. */
  difficultyNote: string | null;
  hasMs: boolean;
  qpPath: string | null;
  msPath: string | null;
}

export interface CatalogStatus {
  subjects: number;
  sessions: number;
  papers: number;
  downloads: number;
  /** Epoch ms. Formatted in the webview so no date handling lives in Rust. */
  syncedAtMs: number | null;
  /** High-water mark of the catalogue data itself, straight from the server. */
  generatedAt: string | null;
  catalogVersion: number | null;
  apiBase: string;
}

export interface SyncReport {
  /** False when the server answered 304 and the cache was already current. */
  changed: boolean;
  status: CatalogStatus;
}

export interface DownloadProgress {
  paperId: number;
  kind: DocKind;
  downloaded: number;
  /** Null when the server sends no content length — some do not. */
  total: number | null;
}

export interface DownloadResult {
  paperId: number;
  kind: DocKind;
  path: string;
  size: number;
  /** True when a valid file was already on disk, so nothing was fetched. */
  cached: boolean;
  /** Whether a mark scheme exists — why a `qp` download can bring one along. */
  hasMs: boolean;
}

export interface RepairReport {
  scanned: number;
  linked: number;
  unmatched: number;
  /** Rows dropped because the file they named is gone. */
  pruned: number;
}

export interface ResetReport {
  /** Study-state keys deleted. */
  stateFiles: number;
  /** Downloaded documents left on disk — a reset does not touch your papers. */
  downloadsKept: number;
}
