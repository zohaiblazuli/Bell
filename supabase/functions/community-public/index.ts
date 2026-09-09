import { createClient } from 'jsr:@supabase/supabase-js@2';

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const service = createClient(
  Deno.env.get('SUPABASE_URL')!,
  serviceRoleKey,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const fail = (message: string, status = 400) => reply({ error: message }, status);

function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

async function hmac(purpose: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(serviceRoleKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`bell:community:${purpose}:v1\0${value}`),
  );
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function identity(request: Request) {
  const install = request.headers.get('x-bell-install-id')?.trim() || 'missing';
  return {
    voter: await hmac('voter', install),
    ip: await hmac('ip', clientIp(request)),
  };
}

async function consumeRateLimit(key: string, action: string, minutes: number, limit: number) {
  const now = new Date();
  const bucketMs = minutes * 60_000;
  const start = new Date(Math.floor(now.getTime() / bucketMs) * bucketMs).toISOString();
  const { data, error } = await service.rpc('community_consume_rate_limit', {
    p_key_hash: key,
    p_action: action,
    p_window: start,
    p_limit: limit,
  });
  if (error) throw error;
  return Boolean(data);
}

function present(row: Record<string, unknown>, hasVoted = false) {
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
    hasVoted,
    localPath: null,
  };
}

const publicColumns = [
  'id', 'title', 'description', 'qualification', 'level', 'subject_code', 'subject_name',
  'resource_type', 'author_name', 'uploader_name', 'contributor_credit', 'source_url',
  'rights_confirmed', 'page_count', 'size_bytes', 'sha256', 'current_version', 'upvotes',
  'downloads', 'opens', 'popularity_score', 'published_at', 'created_at', 'updated_at',
  'status', 'scan_status',
].join(',');

async function listResources(request: Request, url: URL) {
  const pageSize = Math.min(60, Math.max(1, Number(url.searchParams.get('limit') || 30)));
  const offset = Math.max(0, Number(url.searchParams.get('cursor') || 0));
  const queryText = url.searchParams.get('q')?.trim();
  const qualification = url.searchParams.get('qualification');
  const subject = url.searchParams.get('subject');
  const type = url.searchParams.get('type');
  const sort = url.searchParams.get('sort') || 'popular';

  let query = service
    .from('community_resources')
    .select(publicColumns, { count: 'exact' })
    .eq('status', 'published')
    .range(offset, offset + pageSize - 1);
  if (qualification) query = query.eq('qualification', qualification);
  if (subject) query = query.eq('subject_code', subject);
  if (type) query = query.eq('resource_type', type);
  if (queryText) query = query.textSearch('search_vector', queryText, { config: 'simple', type: 'websearch' });
  if (sort === 'title') query = query.order('title');
  else if (sort === 'newest') query = query.order('published_at', { ascending: false });
  else if (sort === 'upvoted') query = query.order('upvotes', { ascending: false }).order('title');
  else query = query.order('popularity_score', { ascending: false }).order('upvotes', { ascending: false });

  const { data, error, count } = await query;
  if (error) return fail('The resource catalogue could not be read.', 500);
  const rows = (data || []) as unknown as Record<string, unknown>[];
  const ids = rows.map((row) => String(row.id));
  const { voter } = await identity(request);
  const voted = new Set<string>();
  if (ids.length > 0) {
    const result = await service
      .from('community_votes')
      .select('resource_id')
      .eq('voter_hash', voter)
      .in('resource_id', ids);
    for (const row of result.data || []) voted.add(String(row.resource_id));
  }
  const total = count || 0;
  return reply({
    items: rows.map((row) => present(row, voted.has(String(row.id)))),
    total,
    nextCursor: offset + rows.length < total ? String(offset + rows.length) : null,
  });
}

async function getResource(request: Request, id: string) {
  const { data, error } = await service
    .from('community_resources')
    .select(publicColumns)
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle();
  if (error || !data) return fail('That resource is not available.', 404);
  const { voter } = await identity(request);
  const vote = await service
    .from('community_votes')
    .select('resource_id')
    .eq('resource_id', id)
    .eq('voter_hash', voter)
    .maybeSingle();
  return reply(present(data as unknown as Record<string, unknown>, Boolean(vote.data)));
}

async function vote(request: Request, id: string) {
  const { voter, ip } = await identity(request);
  if (!(await consumeRateLimit(ip, 'vote', 10, 30))) return fail('Too many vote changes. Try again later.', 429);
  const existing = await service
    .from('community_resources')
    .select('id')
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle();
  if (!existing.data) return fail('That resource is not available.', 404);
  const body = await request.json().catch(() => ({})) as { desired?: boolean };
  const desired = body.desired !== false;
  const mutation = desired
    ? service.from('community_votes').upsert({ resource_id: id, voter_hash: voter }, { onConflict: 'resource_id,voter_hash', ignoreDuplicates: true })
    : service.from('community_votes').delete().eq('resource_id', id).eq('voter_hash', voter);
  const { error } = await mutation;
  if (error) return fail('Your upvote could not be saved.', 500);
  const updated = await service.from('community_resources').select('upvotes').eq('id', id).single();
  return reply({ hasVoted: desired, upvotes: updated.data?.upvotes || 0 });
}

async function recordEvent(request: Request, id: string, eventType: 'open' | 'download') {
  const { voter, ip } = await identity(request);
  if (!(await consumeRateLimit(ip, `event:${eventType}`, 10, 120))) return reply({ recorded: false });
  const { error } = await service.from('community_events').upsert(
    { resource_id: id, voter_hash: voter, event_type: eventType },
    { onConflict: 'resource_id,voter_hash,event_type,event_day', ignoreDuplicates: true },
  );
  return reply({ recorded: !error });
}

async function signedAsset(id: string, kind: 'thumbnail' | 'download') {
  const resource = await service
    .from('community_resources')
    .select('current_version,sha256')
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle();
  if (!resource.data) return fail('That resource is not available.', 404);
  const version = await service
    .from('community_resource_versions')
    .select('drive_published_file_id,drive_thumbnail_file_id')
    .eq('resource_id', id)
    .eq('version', resource.data.current_version)
    .maybeSingle();
  const fileId = kind === 'thumbnail'
    ? (version.data?.drive_thumbnail_file_id || version.data?.drive_published_file_id)
    : version.data?.drive_published_file_id;
  if (!fileId) return fail(kind === 'thumbnail' ? 'No preview is available.' : 'The PDF is not available.', 404);
  const base = kind === 'thumbnail'
    ? (version.data?.drive_thumbnail_file_id
        ? 'https://drive.google.com/uc?export=view&id='
        : 'https://drive.google.com/thumbnail?sz=w800&id=')
    : 'https://drive.usercontent.google.com/download?export=download&id=';
  return reply({ url: `${base}${encodeURIComponent(fileId)}`, sha256: resource.data.sha256 });
}

Deno.serve(async (request) => {
  try {
    const url = new URL(request.url);
    const route = url.pathname.replace(/^.*\/community-public/, '') || '/';
    if (request.method === 'GET' && route === '/resources') return await listResources(request, url);
    const match = route.match(/^\/resources\/([0-9a-f-]+)(?:\/(thumbnail|download|vote|event))?$/i);
    if (!match) return fail('Not found.', 404);
    const [, id, action] = match;
    if (request.method === 'GET' && !action) return await getResource(request, id);
    if (request.method === 'GET' && (action === 'thumbnail' || action === 'download')) {
      return await signedAsset(id, action);
    }
    if (request.method === 'PUT' && action === 'vote') return await vote(request, id);
    if (request.method === 'POST' && action === 'event') {
      const body = await request.json().catch(() => ({})) as { type?: string };
      if (body.type !== 'open' && body.type !== 'download') return fail('Unknown event type.');
      return await recordEvent(request, id, body.type);
    }
    return fail('Method not allowed.', 405);
  } catch (error) {
    console.error(error);
    return fail('Community Resources is temporarily unavailable.', 500);
  }
});
