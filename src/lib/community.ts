import type { Qualification } from './types';

export type CommunityResourceType =
  | 'notes'
  | 'revision_guide'
  | 'formula_sheet'
  | 'topic_questions'
  | 'book'
  | 'other';

export type CommunitySort = 'popular' | 'upvoted' | 'newest' | 'title';

export type CommunityResourceStatus =
  | 'draft'
  | 'uploading'
  | 'ready_for_review'
  | 'published'
  | 'quarantined'
  | 'rejected'
  | 'unpublished'
  | 'archived';

export interface CommunityResource {
  id: string;
  title: string;
  description: string;
  qualification: Qualification;
  level: string;
  subjectCode: string;
  subjectName: string;
  resourceType: CommunityResourceType;
  authorName: string;
  uploaderName: string;
  contributorCredit: string | null;
  sourceUrl: string | null;
  rightsConfirmed: boolean;
  pageCount: number | null;
  sizeBytes: number;
  sha256: string | null;
  version: number;
  upvotes: number;
  downloads: number;
  opens: number;
  popularityScore: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  status: CommunityResourceStatus;
  scanStatus: 'pending' | 'running' | 'passed' | 'failed' | null;
  hasVoted: boolean;
  localPath: string | null;
}

export interface CommunityListResponse {
  items: CommunityResource[];
  total: number;
  nextCursor: string | null;
}

export interface CommunityFilters {
  query: string;
  qualification: Qualification | null;
  subjectCode: string | null;
  resourceType: CommunityResourceType | null;
  sort: CommunitySort;
}

export interface CommunityAdminIdentity {
  userId: string;
  username: string;
  requiresMfa: boolean;
  factorId: string | null;
  mfaEnrollment: string | null;
}

export interface CommunityAdminStats {
  published: number;
  drafts: number;
  quarantined: number;
  storageBytes: number;
  opens30d: number;
  downloads30d: number;
  upvotes30d: number;
}

export interface CommunityAdminInspection {
  securityEvents: Array<{
    action: string;
    ip: string;
    createdAt: string;
    expiresAt: string;
  }>;
  auditTrail: Array<{
    action: string;
    detail: Record<string, unknown>;
    createdAt: string;
  }>;
}

export interface CommunityCreateInput {
  title: string;
  description: string;
  qualification: Qualification;
  subjectCode: string;
  subjectName: string;
  resourceType: CommunityResourceType;
  authorName: string;
  uploaderName: string;
  contributorCredit?: string | null;
  sourceUrl?: string | null;
  rightsConfirmed: boolean;
}

export interface CommunityUpdateInput {
  title?: string;
  description?: string;
  qualification?: Qualification;
  subjectCode?: string;
  subjectName?: string;
  resourceType?: CommunityResourceType;
  authorName?: string;
  uploaderName?: string;
  contributorCredit?: string | null;
  sourceUrl?: string | null;
}

export const COMMUNITY_RESOURCE_TYPES: readonly CommunityResourceType[] = [
  'notes',
  'revision_guide',
  'formula_sheet',
  'topic_questions',
  'book',
  'other',
] as const;

export const COMMUNITY_QUALIFICATIONS: readonly Qualification[] = [
  'a_level',
  'igcse',
  'o_level',
] as const;

export const COMMUNITY_SORTS: readonly CommunitySort[] = [
  'popular',
  'upvoted',
  'newest',
  'title',
] as const;

const TYPE_LABELS: Record<CommunityResourceType, string> = {
  notes: 'Notes',
  revision_guide: 'Revision guide',
  formula_sheet: 'Formula sheet',
  topic_questions: 'Topic questions',
  book: 'Book',
  other: 'Other',
};

const QUALIFICATION_LABELS: Record<Qualification, string> = {
  a_level: 'A Level',
  igcse: 'IGCSE',
  o_level: 'O Level',
};

const SORT_LABELS: Record<CommunitySort, string> = {
  popular: 'Popular',
  upvoted: 'Most upvoted',
  newest: 'Newest',
  title: 'A–Z',
};

export const communityTypeLabel = (type: CommunityResourceType) => TYPE_LABELS[type];
export const communityQualificationLabel = (qualification: Qualification) =>
  QUALIFICATION_LABELS[qualification];
export const communitySortLabel = (sort: CommunitySort) => SORT_LABELS[sort];

export function formatResourceBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Size unavailable';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function communityResourceSearchText(resource: CommunityResource): string {
  return [
    resource.title,
    resource.description,
    resource.authorName,
    resource.contributorCredit,
    resource.subjectCode,
    resource.subjectName,
    resource.level,
    communityTypeLabel(resource.resourceType),
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();
}

/** Local filtering backs the offline cache and is intentionally identical to the API semantics. */
export function filterCommunityResources(
  resources: readonly CommunityResource[],
  filters: CommunityFilters,
): CommunityResource[] {
  const terms = filters.query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const narrowed = resources.filter((resource) => {
    if (resource.status !== 'published') return false;
    if (filters.qualification && resource.qualification !== filters.qualification) return false;
    if (filters.subjectCode && resource.subjectCode !== filters.subjectCode) return false;
    if (filters.resourceType && resource.resourceType !== filters.resourceType) return false;
    if (terms.length === 0) return true;
    const haystack = communityResourceSearchText(resource);
    return terms.every((term) => haystack.includes(term));
  });

  return narrowed.sort((a, b) => {
    if (filters.sort === 'title') return a.title.localeCompare(b.title);
    if (filters.sort === 'newest') {
      return Date.parse(b.publishedAt ?? b.createdAt) - Date.parse(a.publishedAt ?? a.createdAt);
    }
    if (filters.sort === 'upvoted') return b.upvotes - a.upvotes || a.title.localeCompare(b.title);
    return b.popularityScore - a.popularityScore || b.upvotes - a.upvotes;
  });
}

export function resourceInkKey(resource: Pick<CommunityResource, 'id' | 'sha256' | 'version'>) {
  const revision = resource.sha256?.slice(0, 16) || `v${resource.version}`;
  return `community/${resource.id}/${revision}`;
}

/** Supabase may return the TOTP QR as raw SVG or as a partly encoded data URL. */
export function mfaQrImageSource(payload: string | null | undefined): string | null {
  const value = payload?.trim();
  if (!value) return null;
  if (!value.startsWith('data:')) {
    if (value.indexOf('<svg') >= 0) {
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`;
    }
    return null;
  }
  const comma = value.indexOf(',');
  const header = comma >= 0 ? value.slice(0, comma).toLocaleLowerCase() : '';
  if (!header.startsWith('data:image/svg+xml')) return null;
  if (header.includes(';base64')) return value;
  const body = value.slice(comma + 1);
  let svg = body;
  try {
    svg = decodeURIComponent(body);
  } catch {
    // A raw SVG body can contain a stray percent sign; encoding the whole body is still safe.
  }
  if (svg.indexOf('<svg') < 0) return null;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const emptyCommunityFilters = (): CommunityFilters => ({
  query: '',
  qualification: null,
  subjectCode: null,
  resourceType: null,
  sort: 'popular',
});

export type TransferPhase = 'starting' | 'downloading' | 'verifying' | 'opening';

export interface TransferProgress {
  resourceId: string;
  uploaded: number;
  total: number;
  phase?: TransferPhase;
  speed?: number;
  secondsLeft?: number | null;
  startedAt?: number;
}

/** Calculate clamped 0–100 progress percentage, or null if total is unknown */
export function getTransferPercent(uploaded: number, total: number): number | null {
  if (total <= 0 || !isFinite(total)) return null;
  const pct = Math.round((uploaded / total) * 100);
  return Math.min(100, Math.max(0, pct));
}

/** Formats transfer speed into e.g. "2.4 MB/s" or "350 KB/s" */
export function formatTransferSpeed(bytesPerSec: number | undefined | null): string {
  if (!bytesPerSec || bytesPerSec <= 0 || !isFinite(bytesPerSec)) return '';
  if (bytesPerSec >= 1024 * 1024) {
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  return `${Math.round(bytesPerSec / 1024)} KB/s`;
}

/** Formats seconds remaining into e.g. "~12s left" or "~2m 15s left" */
export function formatTransferEta(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0 || !isFinite(seconds)) return '';
  if (seconds < 60) return `~${seconds}s left`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `~${mins}m ${secs}s left` : `~${mins}m left`;
}

