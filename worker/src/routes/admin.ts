import { Hono } from 'hono';
import type { Env } from '../env.ts';
import { clientIp, fail, reply } from '../http.ts';
import { present, type ResourceRow } from '../present.ts';
import { requireAdmin } from '../auth/admin.ts';
import { encryptIp, decryptIp } from '../ipcrypto.ts';
import {
  DRIVE_API,
  DRIVE_UPLOAD_API,
  driveDownloadUrl,
  driveFetch,
  driveFolder,
  safeDriveName,
} from '../drive.ts';

// Ports community-admin/index.ts to D1 + Drive + the self-hosted admin guard.
// Route layout, request/response JSON, Drive calls and audit/IP behaviour match.
const ID_RE = /^[0-9a-fA-F-]{1,64}$/;
const MAX_RESOURCE_BYTES = 209_715_200;

export const adminRoutes = new Hono<{ Bindings: Env }>();

// Audit + encrypted-IP writes, as D1 statements so callers can db.batch() them.
function auditStmt(env: Env, actorId: string, action: string, resourceId: string | null, detail: Record<string, unknown> = {}) {
  return env.DB.prepare(
    'INSERT INTO community_admin_audit (actor_id, action, resource_id, detail) VALUES (?, ?, ?, ?)',
  ).bind(actorId, action, resourceId, JSON.stringify(detail));
}

async function ipStmt(env: Env, request: Request, actorId: string, action: string, resourceId: string | null) {
  const ciphertext = await encryptIp(env, clientIp(request));
  return env.DB.prepare(
    'INSERT INTO community_admin_ip_events (actor_id, resource_id, action, ip_ciphertext) VALUES (?, ?, ?, ?)',
  ).bind(actorId, resourceId, action, ciphertext);
}

const levelFor = (q: unknown) => (q === 'a_level' ? 'A Level' : q === 'igcse' ? 'IGCSE' : 'O Level');

adminRoutes.get('/identity', async (c) => {
  const admin = await requireAdmin(c.env, c.req.raw, false); // aal1 is allowed post-password
  if (admin instanceof Response) return admin;
  return reply({ userId: admin.userId, username: admin.username, displayName: admin.displayName });
});

adminRoutes.get('/me', async (c) => {
  const admin = await requireAdmin(c.env, c.req.raw, true);
  if (admin instanceof Response) return admin;
  return reply({ userId: admin.userId, username: admin.username, displayName: admin.displayName });
});

adminRoutes.get('/stats', async (c) => {
  const admin = await requireAdmin(c.env, c.req.raw, true);
  if (admin instanceof Response) return admin;
  const resources = (
    await c.env.DB.prepare('SELECT status, size_bytes FROM community_resources').all<{
      status: string;
      size_bytes: number;
    }>()
  ).results ?? [];
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const daily = (
    await c.env.DB.prepare(
      'SELECT opens, downloads, upvotes FROM community_daily_stats WHERE day >= ?',
    )
      .bind(since)
      .all<{ opens: number; downloads: number; upvotes: number }>()
  ).results ?? [];
  const totals = daily.reduce(
    (sum, row) => ({
      opens: sum.opens + row.opens,
      downloads: sum.downloads + row.downloads,
      upvotes: sum.upvotes + row.upvotes,
    }),
    { opens: 0, downloads: 0, upvotes: 0 },
  );
  return reply({
    published: resources.filter((r) => r.status === 'published').length,
    drafts: resources.filter((r) => r.status === 'draft' || r.status === 'ready_for_review').length,
    quarantined: resources.filter((r) => r.status === 'quarantined').length,
    storageBytes: resources.reduce((sum, r) => sum + Number(r.size_bytes || 0), 0),
    opens30d: totals.opens,
    downloads30d: totals.downloads,
    upvotes30d: totals.upvotes,
  });
});

adminRoutes.get('/resources', async (c) => {
  const admin = await requireAdmin(c.env, c.req.raw, true);
  if (admin instanceof Response) return admin;
  const rows = (
    await c.env.DB.prepare('SELECT * FROM community_resources ORDER BY updated_at DESC LIMIT 250').all<ResourceRow>()
  ).results ?? [];
  return reply(rows.map((row) => present(row)));
});

adminRoutes.post('/resources', async (c) => {
  const admin = await requireAdmin(c.env, c.req.raw, true);
  if (admin instanceof Response) return admin;
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  if (!body.rightsConfirmed) return fail('Rights confirmation is required.');
  const id = crypto.randomUUID();
  const uploaderName = (typeof body.uploaderName === 'string' && body.uploaderName) || admin.displayName;
  try {
    const insert = c.env.DB.prepare(
      `INSERT INTO community_resources
         (id, title, description, qualification, level, subject_code, subject_name, resource_type,
          author_name, uploader_name, contributor_credit, source_url, rights_confirmed, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?)`,
    ).bind(
      id, body.title, body.description, body.qualification, levelFor(body.qualification),
      body.subjectCode, body.subjectName, body.resourceType, body.authorName, uploaderName,
      body.contributorCredit || null, body.sourceUrl || null, admin.userId,
    );
    await c.env.DB.batch([
      insert,
      auditStmt(c.env, admin.userId, 'resource.created', id),
      await ipStmt(c.env, c.req.raw, admin.userId, 'resource.created', id),
    ]);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'The resource could not be created.');
  }
  const row = await c.env.DB.prepare('SELECT * FROM community_resources WHERE id = ?').bind(id).first<ResourceRow>();
  return reply(present(row as ResourceRow), 201);
});

adminRoutes.post('/resources/:id/upload-session', async (c) => {
  const admin = await requireAdmin(c.env, c.req.raw, true);
  if (admin instanceof Response) return admin;
  const id = c.req.param('id');
  if (!ID_RE.test(id)) return fail('Resource not found.', 404);
  const body = await c.req.json<{ filename?: string; sizeBytes?: number }>().catch(() => ({}) as { filename?: string; sizeBytes?: number });
  const size = Number(body.sizeBytes || 0);
  if (!body.filename || !Number.isSafeInteger(size) || size < 5 || size > MAX_RESOURCE_BYTES) {
    return fail('Choose a PDF no larger than 200 MB.');
  }
  const owned = await c.env.DB.prepare(
    'SELECT current_version FROM community_resources WHERE id = ? AND created_by = ?',
  )
    .bind(id, admin.userId)
    .first<{ current_version: number }>();
  if (!owned) return fail('Resource not found.', 404);
  const version = Number(owned.current_version || 0) + 1;
  const response = await driveFetch(c.env, `${DRIVE_UPLOAD_API}/files?uploadType=resumable&supportsAllDrives=true`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-upload-content-type': 'application/pdf',
      'x-upload-content-length': String(size),
    },
    body: JSON.stringify({
      name: `${id}-v${version}-${safeDriveName(body.filename)}`,
      mimeType: 'application/pdf',
      parents: [driveFolder(c.env, 'quarantine')],
      appProperties: { bellResourceId: id, bellVersion: String(version), bellKind: 'quarantine' },
    }),
  });
  const uploadUrl = response.headers.get('location');
  if (!response.ok || !uploadUrl) return fail('The Google Drive upload could not start.', 502);
  await c.env.DB.batch([
    auditStmt(c.env, admin.userId, 'resource.upload_started', id, { version, sizeBytes: size }),
    await ipStmt(c.env, c.req.raw, admin.userId, 'resource.upload_started', id),
  ]);
  return reply({ uploadUrl, version });
});

adminRoutes.post('/resources/:id/uploaded', async (c) => {
  const admin = await requireAdmin(c.env, c.req.raw, true);
  if (admin instanceof Response) return admin;
  const id = c.req.param('id');
  if (!ID_RE.test(id)) return fail('Resource not found.', 404);
  const body = await c.req
    .json<{ filename?: string; sizeBytes?: number; driveFileId?: string }>()
    .catch(() => ({}) as { filename?: string; sizeBytes?: number; driveFileId?: string });
  if (
    !body.filename || !body.driveFileId || !/^[A-Za-z0-9_-]{10,200}$/.test(body.driveFileId) ||
    !body.sizeBytes || body.sizeBytes > MAX_RESOURCE_BYTES
  ) {
    return fail('Invalid upload metadata.');
  }
  const owned = await c.env.DB.prepare(
    'SELECT current_version FROM community_resources WHERE id = ? AND created_by = ?',
  )
    .bind(id, admin.userId)
    .first<{ current_version: number }>();
  if (!owned) return fail('Resource not found.', 404);
  const version = Number(owned.current_version || 0) + 1;

  const metaResp = await driveFetch(
    c.env,
    `${DRIVE_API}/files/${encodeURIComponent(body.driveFileId)}?supportsAllDrives=true&fields=id,mimeType,size,parents,trashed,appProperties`,
  );
  if (!metaResp.ok) return fail('The uploaded Drive file could not be verified.', 502);
  const file = (await metaResp.json()) as {
    mimeType?: string; size?: string; parents?: string[]; trashed?: boolean;
    appProperties?: Record<string, string>;
  };
  const valid =
    !file.trashed && file.mimeType === 'application/pdf' && Number(file.size) === Number(body.sizeBytes) &&
    file.parents?.includes(driveFolder(c.env, 'quarantine')) && file.appProperties?.bellResourceId === id &&
    file.appProperties?.bellVersion === String(version) && file.appProperties?.bellKind === 'quarantine';
  if (!valid) return fail('The uploaded Drive file did not match the expected resource.', 409);

  const copyResp = await driveFetch(
    c.env,
    `${DRIVE_API}/files/${encodeURIComponent(body.driveFileId)}/copy?supportsAllDrives=true`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `${id}-v${version}-${safeDriveName(body.filename)}`,
        parents: [driveFolder(c.env, 'published')],
        appProperties: { bellResourceId: id, bellVersion: String(version), bellKind: 'published' },
      }),
    },
  );
  if (!copyResp.ok) return fail('The PDF could not be promoted to the published folder.', 502);
  const publishedFile = (await copyResp.json()) as { id: string };
  await driveFetch(
    c.env,
    `${DRIVE_API}/files/${encodeURIComponent(publishedFile.id)}/permissions?supportsAllDrives=true&sendNotificationEmail=false`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'anyone', role: 'reader', allowFileDiscovery: false }),
    },
  );

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO community_resource_versions
           (resource_id, version, drive_quarantine_file_id, drive_published_file_id,
            original_filename, size_bytes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(id, version, body.driveFileId, publishedFile.id, body.filename, body.sizeBytes, admin.userId),
      c.env.DB.prepare(
        `UPDATE community_resources
           SET status = 'ready_for_review', scan_status = 'passed', current_version = ?, size_bytes = ?
         WHERE id = ?`,
      ).bind(version, body.sizeBytes, id),
      auditStmt(c.env, admin.userId, 'resource.uploaded', id, { version, sizeBytes: body.sizeBytes }),
      await ipStmt(c.env, c.req.raw, admin.userId, 'resource.uploaded', id),
    ]);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'The upload could not be recorded.');
  }
  return reply({ published: true, version });
});

adminRoutes.post('/resources/:id/status', async (c) => {
  const admin = await requireAdmin(c.env, c.req.raw, true);
  if (admin instanceof Response) return admin;
  const id = c.req.param('id');
  if (!ID_RE.test(id)) return fail('Resource not found.', 404);
  const body = await c.req.json<{ status?: string; reason?: string }>().catch(() => ({}) as { status?: string; reason?: string });
  const current = await c.env.DB.prepare(
    'SELECT status, current_version FROM community_resources WHERE id = ?',
  )
    .bind(id)
    .first<{ status: string; current_version: number }>();
  if (!current) return fail('Resource not found.', 404);
  const target = body.status ?? '';
  if (!['published', 'unpublished', 'rejected', 'archived'].includes(target)) return fail('Unsupported status.');
  if (target === 'published' && (current.status !== 'ready_for_review' || !current.current_version)) {
    return fail('Only a reviewed PDF can be published.');
  }
  const updateStmt =
    target === 'published'
      ? c.env.DB.prepare('UPDATE community_resources SET status = ?, published_at = ? WHERE id = ?').bind(target, new Date().toISOString(), id)
      : c.env.DB.prepare('UPDATE community_resources SET status = ? WHERE id = ?').bind(target, id);
  await c.env.DB.batch([
    updateStmt,
    auditStmt(c.env, admin.userId, `resource.${target}`, id, body.reason ? { reason: body.reason } : {}),
    await ipStmt(c.env, c.req.raw, admin.userId, `resource.${target}`, id),
  ]);
  const row = await c.env.DB.prepare('SELECT * FROM community_resources WHERE id = ?').bind(id).first<ResourceRow>();
  return reply(present(row as ResourceRow));
});

adminRoutes.get('/resources/:id/preview', async (c) => {
  const admin = await requireAdmin(c.env, c.req.raw, true);
  if (admin instanceof Response) return admin;
  const id = c.req.param('id');
  if (!ID_RE.test(id)) return fail('Resource not found.', 404);
  const resource = await c.env.DB.prepare('SELECT current_version FROM community_resources WHERE id = ?')
    .bind(id)
    .first<{ current_version: number }>();
  if (!resource) return fail('Resource not found.', 404);
  if (!resource.current_version) return fail('No file has been uploaded for this resource.', 409);
  const version = await c.env.DB.prepare(
    'SELECT drive_published_file_id FROM community_resource_versions WHERE resource_id = ? AND version = ?',
  )
    .bind(id, resource.current_version)
    .first<{ drive_published_file_id: string | null }>();
  const fileId = version?.drive_published_file_id;
  if (!fileId) return fail('The published PDF is not available.', 404);
  return reply({ url: driveDownloadUrl(fileId) });
});

adminRoutes.get('/resources/:id/inspection', async (c) => {
  const admin = await requireAdmin(c.env, c.req.raw, true);
  if (admin instanceof Response) return admin;
  const id = c.req.param('id');
  if (!ID_RE.test(id)) return fail('Resource not found.', 404);
  const resource = await c.env.DB.prepare('SELECT current_version FROM community_resources WHERE id = ?')
    .bind(id)
    .first();
  if (!resource) return fail('Resource not found.', 404);
  const auditRows = (
    await c.env.DB.prepare(
      'SELECT action, detail, created_at FROM community_admin_audit WHERE resource_id = ? ORDER BY created_at DESC LIMIT 50',
    )
      .bind(id)
      .all<{ action: string; detail: string; created_at: string }>()
  ).results ?? [];
  const ipRows = (
    await c.env.DB.prepare(
      'SELECT action, ip_ciphertext, created_at, expires_at FROM community_admin_ip_events WHERE resource_id = ? AND expires_at > ? ORDER BY created_at DESC',
    )
      .bind(id, new Date().toISOString())
      .all<{ action: string; ip_ciphertext: string; created_at: string; expires_at: string }>()
  ).results ?? [];
  await auditStmt(c.env, admin.userId, 'resource.inspected', id).run();
  const securityEvents = await Promise.all(
    ipRows.map(async (row) => ({
      action: row.action,
      ip: await decryptIp(c.env, row.ip_ciphertext),
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    })),
  );
  const auditTrail = auditRows.map((row) => {
    let detail: Record<string, unknown> = {};
    try {
      detail = JSON.parse(row.detail || '{}');
    } catch {
      detail = {};
    }
    return { action: row.action, detail, createdAt: row.created_at };
  });
  return reply({ securityEvents, auditTrail });
});

adminRoutes.delete('/resources/:id', async (c) => {
  const admin = await requireAdmin(c.env, c.req.raw, true);
  if (admin instanceof Response) return admin;
  const id = c.req.param('id');
  if (!ID_RE.test(id)) return fail('Resource not found.', 404);
  const current = await c.env.DB.prepare('SELECT id, title FROM community_resources WHERE id = ?')
    .bind(id)
    .first<{ id: string; title: string }>();
  if (!current) return fail('Resource not found.', 404);

  // Best-effort Drive cleanup (ignore already-deleted / inaccessible files).
  const versions = (
    await c.env.DB.prepare(
      'SELECT drive_quarantine_file_id, drive_published_file_id FROM community_resource_versions WHERE resource_id = ?',
    )
      .bind(id)
      .all<{ drive_quarantine_file_id: string | null; drive_published_file_id: string | null }>()
  ).results ?? [];
  for (const v of versions) {
    for (const fileId of [v.drive_quarantine_file_id, v.drive_published_file_id]) {
      if (!fileId) continue;
      try {
        await driveFetch(c.env, `${DRIVE_API}/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`, { method: 'DELETE' });
      } catch {
        /* already gone */
      }
    }
  }

  // Explicit cascade + audit in one atomic batch (does not rely on the FK pragma).
  try {
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM community_scan_reports WHERE resource_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM community_scan_jobs WHERE resource_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM community_votes WHERE resource_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM community_events WHERE resource_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM community_daily_stats WHERE resource_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM community_resource_versions WHERE resource_id = ?').bind(id),
      c.env.DB.prepare('UPDATE community_admin_audit SET resource_id = NULL WHERE resource_id = ?').bind(id),
      c.env.DB.prepare('UPDATE community_admin_ip_events SET resource_id = NULL WHERE resource_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM community_resources WHERE id = ?').bind(id),
      auditStmt(c.env, admin.userId, 'resource.deleted', null, { title: current.title, id }),
      await ipStmt(c.env, c.req.raw, admin.userId, 'resource.deleted', null),
    ]);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'The resource could not be deleted.', 500);
  }
  return reply({ deleted: true, id });
});

adminRoutes.patch('/resources/:id', async (c) => {
  const admin = await requireAdmin(c.env, c.req.raw, true);
  if (admin instanceof Response) return admin;
  const id = c.req.param('id');
  if (!ID_RE.test(id)) return fail('Resource not found.', 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const current = await c.env.DB.prepare('SELECT * FROM community_resources WHERE id = ?').bind(id).first<ResourceRow>();
  if (!current) return fail('Resource not found.', 404);

  const cols: string[] = [];
  const binds: unknown[] = [];
  const set = (col: string, value: unknown) => { cols.push(`${col} = ?`); binds.push(value); };

  if (typeof body.title === 'string') {
    const t = body.title.trim();
    if (t.length < 3 || t.length > 160) return fail('Title must be between 3 and 160 characters.');
    set('title', t);
  }
  if (typeof body.description === 'string') {
    const d = body.description.trim();
    if (d.length < 10 || d.length > 2000) return fail('Description must be between 10 and 2000 characters.');
    set('description', d);
  }
  if (typeof body.qualification === 'string') {
    if (!['a_level', 'igcse', 'o_level'].includes(body.qualification)) return fail('Invalid qualification.');
    set('qualification', body.qualification);
    set('level', levelFor(body.qualification));
  }
  if (typeof body.subjectCode === 'string') {
    const sc = body.subjectCode.trim();
    if (!/^[0-9A-Za-z-]{2,16}$/.test(sc)) return fail('Invalid subject code.');
    set('subject_code', sc);
  }
  if (typeof body.subjectName === 'string') {
    const sn = body.subjectName.trim();
    if (sn.length < 2 || sn.length > 120) return fail('Subject name must be between 2 and 120 characters.');
    set('subject_name', sn);
  }
  if (typeof body.resourceType === 'string') {
    if (!['notes', 'revision_guide', 'formula_sheet', 'topic_questions', 'book', 'other'].includes(body.resourceType)) {
      return fail('Invalid resource type.');
    }
    set('resource_type', body.resourceType);
  }
  if (typeof body.authorName === 'string') {
    const an = body.authorName.trim();
    if (an.length < 1 || an.length > 120) return fail('Author name must be between 1 and 120 characters.');
    set('author_name', an);
  }
  if (typeof body.uploaderName === 'string') {
    const un = body.uploaderName.trim();
    if (un.length < 1 || un.length > 80) return fail('Uploader name must be between 1 and 80 characters.');
    set('uploader_name', un);
  }
  if (body.contributorCredit !== undefined) {
    set('contributor_credit', typeof body.contributorCredit === 'string' && body.contributorCredit.trim()
      ? body.contributorCredit.trim().slice(0, 120)
      : null);
  }
  if (body.sourceUrl !== undefined) {
    set('source_url', typeof body.sourceUrl === 'string' && body.sourceUrl.trim()
      ? body.sourceUrl.trim().slice(0, 1000)
      : null);
  }

  if (cols.length === 0) return reply(present(current));

  const detail: Record<string, unknown> = {};
  cols.forEach((clause, i) => { detail[clause.split(' = ')[0]] = binds[i]; });
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE community_resources SET ${cols.join(', ')} WHERE id = ?`).bind(...binds, id),
      auditStmt(c.env, admin.userId, 'resource.updated', id, detail),
      await ipStmt(c.env, c.req.raw, admin.userId, 'resource.updated', id),
    ]);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'The resource could not be updated.', 400);
  }
  const row = await c.env.DB.prepare('SELECT * FROM community_resources WHERE id = ?').bind(id).first<ResourceRow>();
  return reply(present(row as ResourceRow));
});

adminRoutes.post('/resources/:id/thumbnail', async (c) => {
  const admin = await requireAdmin(c.env, c.req.raw, true);
  if (admin instanceof Response) return admin;
  const id = c.req.param('id');
  if (!ID_RE.test(id)) return fail('Resource not found.', 404);
  const current = await c.env.DB.prepare('SELECT current_version FROM community_resources WHERE id = ?')
    .bind(id)
    .first<{ current_version: number }>();
  if (!current || !current.current_version) {
    return fail('Resource has no uploaded version to attach a thumbnail to.', 400);
  }
  const version = current.current_version;

  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.length < 10 || bytes.length > 5 * 1024 * 1024) {
    return fail('Thumbnail image must be between 10 bytes and 5 MB.', 400);
  }
  let mimeType = 'image/jpeg';
  let ext = 'jpg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    mimeType = 'image/png';
    ext = 'png';
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    mimeType = 'image/jpeg';
    ext = 'jpg';
  } else if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    mimeType = 'image/webp';
    ext = 'webp';
  } else {
    return fail('Unsupported image format. Please use JPEG, PNG, or WebP.', 400);
  }

  const initResponse = await driveFetch(c.env, `${DRIVE_UPLOAD_API}/files?uploadType=resumable&supportsAllDrives=true`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-upload-content-type': mimeType,
      'x-upload-content-length': String(bytes.length),
    },
    body: JSON.stringify({
      name: `${id}-v${version}-thumbnail.${ext}`,
      mimeType,
      parents: [driveFolder(c.env, 'thumbnails')],
      appProperties: { bellResourceId: id, bellVersion: String(version), bellKind: 'thumbnail' },
    }),
  });
  const uploadUrl = initResponse.headers.get('location');
  if (!initResponse.ok || !uploadUrl) return fail('Could not initiate Google Drive thumbnail upload.', 502);

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': mimeType, 'content-length': String(bytes.length) },
    body: bytes,
  });
  if (!uploadResponse.ok) return fail('Could not upload thumbnail bytes to Google Drive.', 502);
  const driveFile = (await uploadResponse.json()) as { id: string };

  await driveFetch(
    c.env,
    `${DRIVE_API}/files/${encodeURIComponent(driveFile.id)}/permissions?supportsAllDrives=true&sendNotificationEmail=false`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'anyone', role: 'reader', allowFileDiscovery: false }),
    },
  );

  const prior = await c.env.DB.prepare(
    'SELECT drive_thumbnail_file_id FROM community_resource_versions WHERE resource_id = ? AND version = ?',
  )
    .bind(id, version)
    .first<{ drive_thumbnail_file_id: string | null }>();
  if (prior?.drive_thumbnail_file_id && prior.drive_thumbnail_file_id !== driveFile.id) {
    try {
      await driveFetch(c.env, `${DRIVE_API}/files/${encodeURIComponent(prior.drive_thumbnail_file_id)}?supportsAllDrives=true`, { method: 'DELETE' });
    } catch {
      /* ignore cleanup error */
    }
  }

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        'UPDATE community_resource_versions SET drive_thumbnail_file_id = ? WHERE resource_id = ? AND version = ?',
      ).bind(driveFile.id, id, version),
      auditStmt(c.env, admin.userId, 'resource.thumbnail_uploaded', id, { version, thumbnailFileId: driveFile.id }),
      await ipStmt(c.env, c.req.raw, admin.userId, 'resource.thumbnail_uploaded', id),
    ]);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'The thumbnail could not be recorded.', 500);
  }
  return reply({ success: true, thumbnailFileId: driveFile.id });
});
