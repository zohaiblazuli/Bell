import { invoke } from '@tauri-apps/api/core';
import type {
  CatalogStatus,
  DocKind,
  DownloadResult,
  LibraryStats,
  PaperRow,
  RepairReport,
  ResetReport,
  Subject,
  SyncReport,
} from './types';
import type {
  CommunityAdminIdentity,
  CommunityAdminInspection,
  CommunityAdminStats,
  CommunityCreateInput,
  CommunityUpdateInput,
  CommunityFilters,
  CommunityListResponse,
  CommunityResource,
  CommunityResourceStatus,
} from './community';

// --- the catalogue -----------------------------------------------------------

/**
 * Fetch the catalogue and replace the local cache.
 *
 * Conditional on a stored ETag, so the usual case — nothing changed since the last
 * launch — costs a 304 and no parsing. Rejects on a network failure; a caller with a
 * populated cache should treat that as "carry on offline", not as an error.
 */
export const syncCatalog = () => invoke<SyncReport>('sync_catalog');

/** What is cached right now, without touching the network. */
export const catalogStatus = () => invoke<CatalogStatus>('catalog_status');

export const libraryStats = () => invoke<LibraryStats>('library_stats');

/**
 * Papers per sitting, keyed `9701/s25` — the denominator behind the Dashboard's
 * coverage matrix. Now the catalogue's true count rather than a count of files on
 * disk, so a sitting cannot read "done" just because little of it was downloaded.
 */
export const sittingTotals = () => invoke<Record<string, number>>('sitting_totals');

/** `level` accepts either the display label ("A Level") or the enum ("a_level"). */
export const listSubjects = (level?: string | null) =>
  invoke<Subject[]>('list_subjects', { level: level ?? null });

export const listPapers = (args: {
  subjectId?: number | null;
  level?: string | null;
  scode?: string | null;
  downloadedOnly?: boolean | null;
  limit?: number | null;
}) =>
  invoke<PaperRow[]>('list_papers', {
    subjectId: args.subjectId ?? null,
    level: args.level ?? null,
    scode: args.scode ?? null,
    downloadedOnly: args.downloadedOnly ?? null,
    limit: args.limit ?? null,
  });

/**
 * Palette search: every whitespace-separated token has to match the paper's code,
 * subject, level, session, component or year. Runs in SQL over the cached catalogue.
 */
export const searchPapers = (query: string, limit = 12) =>
  invoke<PaperRow[]>('search_papers', { query, limit });

export const findSubject = (code: string, level?: string | null) =>
  invoke<number | null>('find_subject', { code, level: level ?? null });

// --- downloads ---------------------------------------------------------------

/**
 * Fetch one paper's question paper or mark scheme to this machine.
 *
 * Idempotent — a valid file already on disk is recorded and returned with no network
 * use, so re-running a queue is cheap. Concurrency is the caller's business: run a
 * small pool up here rather than expecting Rust to schedule.
 */
export const downloadPaper = (paperId: number, kind: DocKind) =>
  invoke<DownloadResult>('download_paper', { paperId, kind });

/** Forget a download and delete its file. */
export const deleteDownload = (paperId: number, kind: DocKind) =>
  invoke<boolean>('delete_download', { paperId, kind });

/**
 * Reconcile the download table with what is actually on disk: link files the app
 * does not know about, drop rows whose file has gone.
 */
export const repairDownloads = () => invoke<RepairReport>('repair_downloads');

/** Where downloads land. Shown in Settings; there is deliberately no picker. */
export const downloadRootPath = () => invoke<string>('download_root_path');

/**
 * Bytes of one downloaded PDF. Rust refuses any path not recorded in `download`, so
 * this is the only way to read a paper and it cannot reach anything else.
 */
const paperDocumentReads = new Map<string, Promise<ArrayBuffer>>();
export const readDocument = (path: string) => {
  const pending = paperDocumentReads.get(path);
  if (pending) return pending;
  const request = invoke<ArrayBuffer>('read_document', { path }).finally(() => {
    paperDocumentReads.delete(path);
  });
  paperDocumentReads.set(path, request);
  return request;
};

// --- the state directory, for Settings' Data card ----------------------------

/** Where the JSON keys live, so Settings can name the folder it offers to clear. */
export const statePath = () => invoke<string>('state_path');

/** Delete every stored key. Returns how many files went. Downloads are untouched. */
export const clearState = () => invoke<number>('state_clear');

/**
 * Copy the state dir to `<app data>/exports/<name>` and return where it landed. The
 * name is ours to choose but not the location — Rust validates it as one segment.
 */
export const exportState = (name: string) => invoke<string>('state_export', { name });

/**
 * Erase everything the app knows and return to a first-run state.
 *
 * Clears every study-state key, the cached catalogue and the install identifier. Does
 * NOT delete downloaded PDFs, or the records that name them: those are your files, and
 * dropping the records would leave the reader unable to open a paper still sitting in
 * your downloads folder. Callers should reload the webview afterwards — every hook holds
 * hydrated copies of what just went, and a reload is the only way to be sure none of
 * them is still carrying one.
 */
export const resetApp = () => invoke<ResetReport>('reset_app');

// --- Community Resources ----------------------------------------------------

export interface CommunityServiceStatus {
  configured: boolean;
  message: string | null;
}

export interface CommunityDownloadResult {
  resourceId: string;
  version: number;
  path: string;
  size: number;
  cached: boolean;
}

export interface CommunityVoteResult {
  hasVoted: boolean;
  upvotes: number;
}

export const communityStatus = () => invoke<CommunityServiceStatus>('community_status');

export const listCommunityResources = (
  filters: CommunityFilters,
  cursor?: string | null,
  limit = 60,
) =>
  invoke<CommunityListResponse>('community_list', {
    query: {
      query: filters.query || null,
      qualification: filters.qualification,
      subjectCode: filters.subjectCode,
      resourceType: filters.resourceType,
      sort: filters.sort,
      cursor: cursor ?? null,
      limit,
    },
  });

export const getCommunityResource = (resourceId: string) =>
  invoke<CommunityResource>('community_get', { resourceId });

export const communityThumbnail = (resourceId: string) =>
  invoke<ArrayBuffer>('community_thumbnail', { resourceId });

export const setCommunityVote = (resourceId: string, desired: boolean) =>
  invoke<CommunityVoteResult>('community_vote', { resourceId, desired });

export const recordCommunityOpen = (resourceId: string) =>
  invoke<void>('community_record_open', { resourceId });

export const downloadCommunityResource = (resource: CommunityResource) =>
  invoke<CommunityDownloadResult>('community_download', { resource });

const communityDocumentReads = new Map<string, Promise<ArrayBuffer>>();
export const readCommunityDocument = (path: string) => {
  const pending = communityDocumentReads.get(path);
  if (pending) return pending;
  const request = invoke<ArrayBuffer>('community_read_document', { path }).finally(() => {
    communityDocumentReads.delete(path);
  });
  communityDocumentReads.set(path, request);
  return request;
};

export const communityAdminStatus = () =>
  invoke<CommunityAdminIdentity | null>('community_admin_status');

export const communityAdminSavedUsername = () =>
  invoke<string | null>('community_admin_saved_username');

export const communityAdminSignIn = (username: string, password: string) =>
  invoke<CommunityAdminIdentity>('community_admin_sign_in', { username, password });

export const communityAdminVerifyMfa = (code: string) =>
  invoke<CommunityAdminIdentity>('community_admin_verify_mfa', { code });

export const communityAdminSignOut = () => invoke<void>('community_admin_sign_out');

export const listCommunityAdminResources = () =>
  invoke<CommunityResource[]>('community_admin_list');

export const communityAdminStats = () =>
  invoke<CommunityAdminStats>('community_admin_stats');

export const communityAdminInspection = (resourceId: string) =>
  invoke<CommunityAdminInspection>('community_admin_inspection', { resourceId });

export const createCommunityResource = (input: CommunityCreateInput) =>
  invoke<CommunityResource>('community_admin_create', { input });

export const setCommunityResourceStatus = (
  resourceId: string,
  status: Extract<CommunityResourceStatus, 'published' | 'unpublished' | 'rejected' | 'archived'>,
) => invoke<CommunityResource>('community_admin_set_status', { resourceId, status });

export const uploadCommunityResource = (resource: CommunityResource, filePath: string) =>
  invoke<void>('community_admin_upload', { resource, filePath });

export const previewCommunityAdminResource = (resource: CommunityResource) =>
  invoke<CommunityDownloadResult>('community_admin_preview', { resource });

export const updateCommunityResource = (
  resourceId: string,
  input: CommunityUpdateInput,
) => invoke<CommunityResource>('community_admin_update', { resourceId, input });

export const uploadCommunityThumbnail = (resourceId: string, filePath: string) =>
  invoke<void>('community_admin_upload_thumbnail', { resourceId, filePath });

export const communityAdminReadLocalFile = (path: string) =>
  invoke<ArrayBuffer>('community_admin_read_local_file', { path });

export const communityAdminSaveTempThumbnail = (bytes: number[]) =>
  invoke<string>('community_admin_save_temp_thumbnail', { bytes });

export const deleteCommunityResource = (resourceId: string) =>
  invoke<void>('community_admin_delete', { resourceId });

export const invalidateCommunityThumbnail = (resourceId?: string) =>
  invoke<void>('community_invalidate_thumbnail', { resourceId: resourceId ?? null });

// --- star gate --------------------------------------------------------------

/**
 * Check if a GitHub user has starred the Bell repository (zohaiblazuli/Bell).
 * Runs natively in Rust to adhere to the desktop app's strict CSP.
 */
export const checkGitHubStar = (username: string) =>
  invoke<boolean>('check_github_star', { username });
