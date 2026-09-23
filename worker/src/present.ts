// Maps a community_resources DB row (snake_case) to the camelCase DTO the Rust
// client deserializes. Field-for-field identical to present() in the old
// community-public Edge Function, except rights_confirmed is coerced from D1's
// 0/1 INTEGER back to a JSON boolean (Postgres returned a real boolean).

export interface ResourceRow {
  id: string;
  title: string;
  description: string;
  qualification: string;
  level: string;
  subject_code: string;
  subject_name: string;
  resource_type: string;
  author_name: string;
  uploader_name: string;
  contributor_credit: string | null;
  source_url: string | null;
  rights_confirmed: number;
  page_count: number | null;
  size_bytes: number;
  sha256: string | null;
  current_version: number;
  upvotes: number;
  downloads: number;
  opens: number;
  popularity_score: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  status: string;
  scan_status: string | null;
}

// The public column list, matching publicColumns in community-public.
export const PUBLIC_COLUMNS =
  'id, title, description, qualification, level, subject_code, subject_name, ' +
  'resource_type, author_name, uploader_name, contributor_credit, source_url, ' +
  'rights_confirmed, page_count, size_bytes, sha256, current_version, upvotes, ' +
  'downloads, opens, popularity_score, published_at, created_at, updated_at, status, scan_status';

export function present(row: ResourceRow, hasVoted = false) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    qualification: row.qualification,
    level: row.level,
    subjectCode: row.subject_code,
    subjectName: row.subject_name,
    resourceType: row.resource_type,
    authorName: row.author_name,
    uploaderName: row.uploader_name,
    contributorCredit: row.contributor_credit,
    sourceUrl: row.source_url,
    rightsConfirmed: Boolean(row.rights_confirmed),
    pageCount: row.page_count,
    sizeBytes: row.size_bytes,
    sha256: row.sha256,
    version: row.current_version,
    upvotes: row.upvotes,
    downloads: row.downloads,
    opens: row.opens,
    popularityScore: row.popularity_score,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    scanStatus: row.scan_status,
    hasVoted,
    localPath: null,
  };
}
