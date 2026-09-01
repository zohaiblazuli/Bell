/** Shapes returned by the Rust side. Keep in sync with `src-tauri/src/library.rs`. */

export type Level = 'A Level' | 'IGCSE' | 'O Level';

export interface LevelCount {
  level: string;
  subjects: number;
  docs: number;
}

export interface TypeCount {
  docType: string;
  docs: number;
}

export interface LibraryStats {
  root: string | null;
  subjects: number;
  sessions: number;
  docs: number;
  thresholds: number;
  levels: LevelCount[];
  docTypes: TypeCount[];
}

export interface Subject {
  id: number;
  level: string;
  code: string;
  name: string;
  sessions: number;
  papers: number;
  firstYear: number | null;
  lastYear: number | null;
}

export interface PaperRow {
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  level: string;
  year: number;
  scode: string;
  season: string;
  variant: string | null;
  qpPath: string | null;
  msPath: string | null;
  erPath: string | null;
  difficulty: number | null;
  band: string | null;
}

export interface IngestReport {
  root: string;
  subjects: number;
  sessions: number;
  docs: number;
  skipped: number;
  skippedSamples: string[];
  elapsedMs: number;
}

export interface IngestProgress {
  docs: number;
  subjects: number;
  current: string;
}

export interface GtDoc {
  subjectId: number;
  subjectCode: string;
  level: string;
  scode: string;
  path: string;
}

export interface ThresholdRow {
  subjectId: number;
  scode: string;
  component: string;
  maxMark: number | null;
  grade: string;
  mark: number;
}

export interface DifficultyRow {
  subjectId: number;
  scode: string;
  component: string;
  score: number;
  band: string;
  sample: number;
}
