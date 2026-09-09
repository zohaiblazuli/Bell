import { createClient } from 'jsr:@supabase/supabase-js@2';

const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const service = createClient(
  Deno.env.get('SUPABASE_URL')!,
  serviceRoleKey,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const fail = (message: string, status = 400) => reply({ error: message }, status);
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const MAX_RESOURCE_BYTES = 209715200;

let driveTokenCache: { value: string; expiresAt: number } | undefined;

async function driveToken() {
  if (driveTokenCache && driveTokenCache.expiresAt > Date.now() + 60_000) return driveTokenCache.value;
  const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET');
  const refreshToken = Deno.env.get('GOOGLE_DRIVE_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) throw new Error('Google Drive OAuth is not configured.');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const body = await response.json() as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !body.access_token) throw new Error(body.error_description || 'Google Drive authorization failed.');
  driveTokenCache = { value: body.access_token, expiresAt: Date.now() + Number(body.expires_in || 3600) * 1000 };
  return driveTokenCache.value;
}

function driveFolder(name: 'quarantine' | 'published' | 'thumbnails') {
  const key = `GOOGLE_DRIVE_${name.toUpperCase()}_FOLDER_ID`;
  const value = Deno.env.get(key);
  if (!value || !/^[A-Za-z0-9_-]{10,200}$/.test(value)) throw new Error(`${key} is not configured.`);
  return value;
}

async function driveFetch(url: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${await driveToken()}`, ...(init.headers || {}) },
  });
}

function safeDriveName(value: string) {
  return value.replace(/[\\/\r\n\0]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'resource.pdf';
}

function driveDownloadUrl(fileId: string) {
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download`;
}

function decodeJwt(token: string): Record<string, unknown> {
  const body = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
  if (!body) return {};
  try {
    return JSON.parse(atob(body.padEnd(Math.ceil(body.length / 4) * 4, '=')));
  } catch {
    return {};
  }
}

async function requireAdmin(request: Request, requireAal2 = true) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new Response(JSON.stringify({ error: 'Administrator sign-in required.' }), { status: 401, headers });
  const user = await service.auth.getUser(token);
  if (user.error || !user.data.user) throw new Response(JSON.stringify({ error: 'That administrator session has expired.' }), { status: 401, headers });
  const allowed = await service.from('admin_users').select('display_name,username').eq('user_id', user.data.user.id).maybeSingle();
  if (!allowed.data) throw new Response(JSON.stringify({ error: 'This account is not a Bell administrator.' }), { status: 403, headers });
  if (requireAal2 && decodeJwt(token).aal !== 'aal2') throw new Response(JSON.stringify({ error: 'Two-step verification is required.' }), { status: 403, headers });
  return { token, user: user.data.user, displayName: String(allowed.data.display_name), username: String(allowed.data.username) };
}

function clientIp(request: Request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

async function ipEncryptionKey(usage: KeyUsage[]) {
  const raw = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`bell:community:admin-ip:v1\0${serviceRoleKey}`),
  );
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, usage);
}

async function encryptIp(value: string) {
  const key = await ipEncryptionKey(['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value)));
  const packed = new Uint8Array(iv.length + encrypted.length);
  packed.set(iv);
  packed.set(encrypted, iv.length);
  return btoa(String.fromCharCode(...packed));
}

async function decryptIp(value: string) {
  const packed = Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  const key = await ipEncryptionKey(['decrypt']);
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: packed.slice(0, 12) }, key, packed.slice(12));
  return new TextDecoder().decode(clear);
}

async function audit(actorId: string, action: string, resourceId?: string, detail: Record<string, unknown> = {}) {
  await service.from('community_admin_audit').insert({ actor_id: actorId, action, resource_id: resourceId || null, detail });
}

async function rememberIp(request: Request, actorId: string, action: string, resourceId?: string) {
  await service.rpc('community_record_admin_ip', {
    p_actor_id: actorId,
    p_action: action,
    p_resource_id: resourceId || null,
    p_ip_ciphertext: await encryptIp(clientIp(request)),
  });
}

function present(row: Record<string, unknown>) {
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
    rightsConfirmed: row.rights_confirmed,
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
    hasVoted: false,
    localPath: null,
  };
}

async function listResources() {
  const result = await service.from('community_resources').select('*').order('updated_at', { ascending: false }).limit(250);
  if (result.error) return fail('Resources could not be loaded.', 500);
  return reply((result.data || []).map((row) => present(row)));
}

async function stats() {
  const rows = await service.from('community_resources').select('status,size_bytes');
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const daily = await service.from('community_daily_stats').select('opens,downloads,upvotes').gte('day', since);
  const resources = rows.data || [];
  const totals = (daily.data || []).reduce((sum, row) => ({
    opens: sum.opens + row.opens,
    downloads: sum.downloads + row.downloads,
    upvotes: sum.upvotes + row.upvotes,
  }), { opens: 0, downloads: 0, upvotes: 0 });
  return reply({
    published: resources.filter((row) => row.status === 'published').length,
    drafts: resources.filter((row) => row.status === 'draft' || row.status === 'ready_for_review').length,
    quarantined: resources.filter((row) => row.status === 'quarantined').length,
    storageBytes: resources.reduce((sum, row) => sum + Number(row.size_bytes || 0), 0),
    opens30d: totals.opens,
    downloads30d: totals.downloads,
    upvotes30d: totals.upvotes,
  });
}

async function createResource(request: Request, admin: Awaited<ReturnType<typeof requireAdmin>>) {
  const body = await request.json() as Record<string, unknown>;
  if (!body.rightsConfirmed) return fail('Rights confirmation is required.');
  const insert = {
    title: body.title,
    description: body.description,
    qualification: body.qualification,
    level: body.qualification === 'a_level' ? 'A Level' : body.qualification === 'igcse' ? 'IGCSE' : 'O Level',
    subject_code: body.subjectCode,
    subject_name: body.subjectName,
    resource_type: body.resourceType,
    author_name: body.authorName,
    uploader_name: body.uploaderName || admin.displayName,
    contributor_credit: body.contributorCredit || null,
    source_url: body.sourceUrl || null,
    rights_confirmed: true,
    created_by: admin.user.id,
  };
  const result = await service.from('community_resources').insert(insert).select('*').single();
  if (result.error) return fail(result.error.message);
  await audit(admin.user.id, 'resource.created', result.data.id);
  await rememberIp(request, admin.user.id, 'resource.created', result.data.id);
  return reply(present(result.data), 201);
}

async function createUploadSession(request: Request, admin: Awaited<ReturnType<typeof requireAdmin>>, id: string) {
  const body = await request.json() as { filename?: string; sizeBytes?: number };
  const size = Number(body.sizeBytes || 0);
  if (!body.filename || !Number.isSafeInteger(size) || size < 5 || size > MAX_RESOURCE_BYTES) {
    return fail('Choose a PDF no larger than 200 MB.');
  }
  const owned = await service.from('community_resources').select('id,current_version').eq('id', id).eq('created_by', admin.user.id).maybeSingle();
  if (!owned.data) return fail('Resource not found.', 404);
  const version = Number(owned.data.current_version || 0) + 1;
  const response = await driveFetch(`${DRIVE_UPLOAD_API}/files?uploadType=resumable&supportsAllDrives=true`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-upload-content-type': 'application/pdf',
      'x-upload-content-length': String(size),
    },
    body: JSON.stringify({
      name: `${id}-v${version}-${safeDriveName(body.filename)}`,
      mimeType: 'application/pdf',
      parents: [driveFolder('quarantine')],
      appProperties: { bellResourceId: id, bellVersion: String(version), bellKind: 'quarantine' },
    }),
  });
  const uploadUrl = response.headers.get('location');
  if (!response.ok || !uploadUrl) return fail('The Google Drive upload could not start.', 502);
  await audit(admin.user.id, 'resource.upload_started', id, { version, sizeBytes: size });
  await rememberIp(request, admin.user.id, 'resource.upload_started', id);
  return reply({ uploadUrl, version });
}

async function markUploaded(request: Request, admin: Awaited<ReturnType<typeof requireAdmin>>, id: string) {
  const body = await request.json() as { filename?: string; sizeBytes?: number; driveFileId?: string };
  if (!body.filename || !body.driveFileId || !/^[A-Za-z0-9_-]{10,200}$/.test(body.driveFileId) ||
      !body.sizeBytes || body.sizeBytes > MAX_RESOURCE_BYTES) return fail('Invalid upload metadata.');
  const owned = await service.from('community_resources').select('id,current_version').eq('id', id).eq('created_by', admin.user.id).maybeSingle();
  if (!owned.data) return fail('Resource not found.', 404);
  const version = Number(owned.data.current_version || 0) + 1;
  const metadataResponse = await driveFetch(
    `${DRIVE_API}/files/${encodeURIComponent(body.driveFileId)}?supportsAllDrives=true&fields=id,mimeType,size,parents,trashed,appProperties`,
  );
  if (!metadataResponse.ok) return fail('The uploaded Drive file could not be verified.', 502);
  const file = await metadataResponse.json() as {
    id?: string; mimeType?: string; size?: string; parents?: string[]; trashed?: boolean;
    appProperties?: Record<string, string>;
  };
  const valid = !file.trashed && file.mimeType === 'application/pdf' && Number(file.size) === Number(body.sizeBytes) &&
    file.parents?.includes(driveFolder('quarantine')) && file.appProperties?.bellResourceId === id &&
    file.appProperties?.bellVersion === String(version) && file.appProperties?.bellKind === 'quarantine';
  if (!valid) return fail('The uploaded Drive file did not match the expected resource.', 409);

  // Copy the quarantine file to the published folder and grant public read access
  // so that the file is immediately available for preview and download.
  const copyResponse = await driveFetch(
    `${DRIVE_API}/files/${encodeURIComponent(body.driveFileId)}/copy?supportsAllDrives=true`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `${id}-v${version}-${safeDriveName(body.filename)}`,
        parents: [driveFolder('published')],
        appProperties: { bellResourceId: id, bellVersion: String(version), bellKind: 'published' },
      }),
    },
  );
  if (!copyResponse.ok) return fail('The PDF could not be promoted to the published folder.', 502);
  const publishedFile = await copyResponse.json() as { id: string };
  // Make the published copy readable by anyone with the link.
  await driveFetch(
    `${DRIVE_API}/files/${encodeURIComponent(publishedFile.id)}/permissions?supportsAllDrives=true&sendNotificationEmail=false`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'anyone', role: 'reader', allowFileDiscovery: false }),
    },
  );

  const stored = await service.from('community_resource_versions').insert({
    resource_id: id,
    version,
    drive_quarantine_file_id: body.driveFileId,
    drive_published_file_id: publishedFile.id,
    original_filename: body.filename,
    size_bytes: body.sizeBytes,
    created_by: admin.user.id,
  });
  if (stored.error) return fail(stored.error.message);
  await service.from('community_resources').update({ status: 'ready_for_review', scan_status: 'passed', current_version: version, size_bytes: body.sizeBytes }).eq('id', id);
  await audit(admin.user.id, 'resource.uploaded', id, { version, sizeBytes: body.sizeBytes });
  await rememberIp(request, admin.user.id, 'resource.uploaded', id);
  return reply({ published: true, version });
}

async function changeStatus(request: Request, admin: Awaited<ReturnType<typeof requireAdmin>>, id: string) {
  const body = await request.json() as { status?: string; reason?: string };
  const current = await service.from('community_resources').select('status,current_version').eq('id', id).maybeSingle();
  if (!current.data) return fail('Resource not found.', 404);
  const target = body.status;
  if (!['published', 'unpublished', 'rejected', 'archived'].includes(target || '')) return fail('Unsupported status.');
  if (target === 'published' && (current.data.status !== 'ready_for_review' || !current.data.current_version)) {
    return fail('Only a reviewed PDF can be published.');
  }
  const update: Record<string, unknown> = { status: target };
  if (target === 'published') update.published_at = new Date().toISOString();
  const result = await service.from('community_resources').update(update).eq('id', id).select('*').single();
  if (result.error) return fail(result.error.message);
  await audit(admin.user.id, `resource.${target}`, id, body.reason ? { reason: body.reason } : {});
  await rememberIp(request, admin.user.id, `resource.${target}`, id);
  return reply(present(result.data));
}

async function previewUrl(id: string) {
  const resource = await service.from('community_resources').select('current_version').eq('id', id).maybeSingle();
  if (!resource.data) return fail('Resource not found.', 404);
  if (!resource.data.current_version) return fail('No file has been uploaded for this resource.', 409);
  const version = await service.from('community_resource_versions').select('drive_published_file_id').eq('resource_id', id).eq('version', resource.data.current_version).maybeSingle();
  const fileId = version.data?.drive_published_file_id;
  if (!fileId) return fail('The published PDF is not available.', 404);
  return reply({ url: driveDownloadUrl(fileId) });
}

async function inspection(request: Request, admin: Awaited<ReturnType<typeof requireAdmin>>, id: string) {
  const resource = await service.from('community_resources').select('current_version').eq('id', id).maybeSingle();
  if (!resource.data) return fail('Resource not found.', 404);
  const auditRows = await service.from('community_admin_audit')
    .select('action,detail,created_at')
    .eq('resource_id', id)
    .order('created_at', { ascending: false })
    .limit(50);
  const rows = await service.rpc('community_read_admin_ips', { p_resource_id: id });
  await audit(admin.user.id, 'resource.inspected', id);
  const securityEvents = await Promise.all((rows.data || []).map(async (row: {
    action: string;
    ip_ciphertext: string;
    created_at: string;
    expires_at: string;
  }) => ({
    action: row.action,
    ip: await decryptIp(row.ip_ciphertext),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  })));
  return reply({
    securityEvents,
    auditTrail: (auditRows.data || []).map((row) => ({ action: row.action, detail: row.detail, createdAt: row.created_at })),
  });
}

async function deleteResource(request: Request, admin: Awaited<ReturnType<typeof requireAdmin>>, id: string) {
  const current = await service.from('community_resources').select('id,title').eq('id', id).maybeSingle();
  if (!current.data) return fail('Resource not found.', 404);

  // Attempt to delete files from Google Drive
  const versions = await service
    .from('community_resource_versions')
    .select('drive_quarantine_file_id,drive_published_file_id')
    .eq('resource_id', id);

  for (const v of (versions.data || [])) {
    for (const fileId of [v.drive_quarantine_file_id, v.drive_published_file_id]) {
      if (fileId) {
        try {
          await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`, {
            method: 'DELETE',
          });
        } catch {
          // Ignore if Drive file is already deleted or inaccessible
        }
      }
    }
  }

  const result = await service.from('community_resources').delete().eq('id', id);
  if (result.error) return fail(result.error.message, 500);

  await audit(admin.user.id, 'resource.deleted', id, { title: current.data.title });
  await rememberIp(request, admin.user.id, 'resource.deleted', id);
  return reply({ deleted: true, id });
}

async function updateResource(request: Request, admin: Awaited<ReturnType<typeof requireAdmin>>, id: string) {
  const body = await request.json() as Record<string, unknown>;
  const current = await service.from('community_resources').select('*').eq('id', id).maybeSingle();
  if (!current.data) return fail('Resource not found.', 404);

  const updates: Record<string, unknown> = {};
  if (typeof body.title === 'string') {
    const t = body.title.trim();
    if (t.length < 3 || t.length > 160) return fail('Title must be between 3 and 160 characters.');
    updates.title = t;
  }
  if (typeof body.description === 'string') {
    const d = body.description.trim();
    if (d.length < 10 || d.length > 2000) return fail('Description must be between 10 and 2000 characters.');
    updates.description = d;
  }
  if (typeof body.qualification === 'string') {
    if (!['a_level', 'igcse', 'o_level'].includes(body.qualification)) return fail('Invalid qualification.');
    updates.qualification = body.qualification;
    updates.level = body.qualification === 'a_level' ? 'A Level' : body.qualification === 'igcse' ? 'IGCSE' : 'O Level';
  }
  if (typeof body.subjectCode === 'string') {
    const sc = body.subjectCode.trim();
    if (!/^[0-9A-Za-z-]{2,16}$/.test(sc)) return fail('Invalid subject code.');
    updates.subject_code = sc;
  }
  if (typeof body.subjectName === 'string') {
    const sn = body.subjectName.trim();
    if (sn.length < 2 || sn.length > 120) return fail('Subject name must be between 2 and 120 characters.');
    updates.subject_name = sn;
  }
  if (typeof body.resourceType === 'string') {
    if (!['notes', 'revision_guide', 'formula_sheet', 'topic_questions', 'book', 'other'].includes(body.resourceType)) {
      return fail('Invalid resource type.');
    }
    updates.resource_type = body.resourceType;
  }
  if (typeof body.authorName === 'string') {
    const an = body.authorName.trim();
    if (an.length < 1 || an.length > 120) return fail('Author name must be between 1 and 120 characters.');
    updates.author_name = an;
  }
  if (typeof body.uploaderName === 'string') {
    const un = body.uploaderName.trim();
    if (un.length < 1 || un.length > 80) return fail('Uploader name must be between 1 and 80 characters.');
    updates.uploader_name = un;
  }
  if (body.contributorCredit !== undefined) {
    updates.contributor_credit = typeof body.contributorCredit === 'string' && body.contributorCredit.trim()
      ? body.contributorCredit.trim().slice(0, 120)
      : null;
  }
  if (body.sourceUrl !== undefined) {
    updates.source_url = typeof body.sourceUrl === 'string' && body.sourceUrl.trim()
      ? body.sourceUrl.trim().slice(0, 1000)
      : null;
  }

  if (Object.keys(updates).length === 0) return reply(present(current.data));

  const result = await service.from('community_resources').update(updates).eq('id', id).select('*').single();
  if (result.error) return fail(result.error.message, 400);

  await audit(admin.user.id, 'resource.updated', id, updates);
  await rememberIp(request, admin.user.id, 'resource.updated', id);
  return reply(present(result.data));
}

async function uploadThumbnail(request: Request, admin: Awaited<ReturnType<typeof requireAdmin>>, id: string) {
  const current = await service.from('community_resources').select('id,current_version').eq('id', id).maybeSingle();
  if (!current.data || !current.data.current_version) {
    return fail('Resource has no uploaded version to attach a thumbnail to.', 400);
  }
  const version = current.data.current_version;

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length < 10 || bytes.length > 5 * 1024 * 1024) {
    return fail('Thumbnail image must be between 10 bytes and 5 MB.', 400);
  }

  let mimeType = 'image/jpeg';
  let ext = 'jpg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    mimeType = 'image/png';
    ext = 'png';
  } else if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    mimeType = 'image/jpeg';
    ext = 'jpg';
  } else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
             bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    mimeType = 'image/webp';
    ext = 'webp';
  } else {
    return fail('Unsupported image format. Please use JPEG, PNG, or WebP.', 400);
  }

  const initResponse = await driveFetch(`${DRIVE_UPLOAD_API}/files?uploadType=resumable&supportsAllDrives=true`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-upload-content-type': mimeType,
      'x-upload-content-length': String(bytes.length),
    },
    body: JSON.stringify({
      name: `${id}-v${version}-thumbnail.${ext}`,
      mimeType,
      parents: [driveFolder('thumbnails')],
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
  const driveFile = await uploadResponse.json() as { id: string };

  await driveFetch(
    `${DRIVE_API}/files/${encodeURIComponent(driveFile.id)}/permissions?supportsAllDrives=true&sendNotificationEmail=false`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'anyone', role: 'reader', allowFileDiscovery: false }),
    },
  );

  const priorVersion = await service.from('community_resource_versions')
    .select('drive_thumbnail_file_id')
    .eq('resource_id', id)
    .eq('version', version)
    .maybeSingle();
  if (priorVersion.data?.drive_thumbnail_file_id && priorVersion.data.drive_thumbnail_file_id !== driveFile.id) {
    try {
      await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(priorVersion.data.drive_thumbnail_file_id)}?supportsAllDrives=true`, { method: 'DELETE' });
    } catch {
      // Ignore cleanup error
    }
  }

  const updateRes = await service.from('community_resource_versions')
    .update({ drive_thumbnail_file_id: driveFile.id })
    .eq('resource_id', id)
    .eq('version', version);
  if (updateRes.error) return fail(updateRes.error.message, 500);

  await audit(admin.user.id, 'resource.thumbnail_uploaded', id, { version, thumbnailFileId: driveFile.id });
  await rememberIp(request, admin.user.id, 'resource.thumbnail_uploaded', id);
  return reply({ success: true, thumbnailFileId: driveFile.id });
}

Deno.serve(async (request) => {
  try {
    const url = new URL(request.url);
    const route = url.pathname.replace(/^.*\/community-admin/, '') || '/';
    const admin = await requireAdmin(request, route !== '/identity');
    if (request.method === 'GET' && route === '/identity') return reply({ userId: admin.user.id, username: admin.username, displayName: admin.displayName });
    if (request.method === 'GET' && route === '/me') return reply({ userId: admin.user.id, username: admin.username, displayName: admin.displayName });
    if (request.method === 'GET' && route === '/stats') return await stats();
    if (request.method === 'GET' && route === '/resources') return await listResources();
    if (request.method === 'POST' && route === '/resources') return await createResource(request, admin);
    const singleMatch = route.match(/^\/resources\/([0-9a-f-]+)$/i);
    if (request.method === 'DELETE' && singleMatch) return await deleteResource(request, admin, singleMatch[1]);
    if (request.method === 'PATCH' && singleMatch) return await updateResource(request, admin, singleMatch[1]);
    const match = route.match(/^\/resources\/([0-9a-f-]+)\/(upload-session|uploaded|status|preview|inspection|thumbnail)$/i);
    if (!match) return fail('Not found.', 404);
    const [, id, action] = match;
    if (request.method === 'POST' && action === 'upload-session') return await createUploadSession(request, admin, id);
    if (request.method === 'POST' && action === 'uploaded') return await markUploaded(request, admin, id);
    if (request.method === 'POST' && action === 'status') return await changeStatus(request, admin, id);
    if (request.method === 'POST' && action === 'thumbnail') return await uploadThumbnail(request, admin, id);
    if (request.method === 'GET' && action === 'preview') return await previewUrl(id);
    if (request.method === 'GET' && action === 'inspection') return await inspection(request, admin, id);
    return fail('Method not allowed.', 405);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return fail('The administrator service is temporarily unavailable.', 500);
  }
});
