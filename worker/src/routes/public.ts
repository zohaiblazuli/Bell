import { Hono } from 'hono';
import type { Env } from '../env.ts';
import { fail, reply } from '../http.ts';
import { identity } from '../hashing.ts';
import { consumeRateLimit } from '../ratelimit.ts';
import { present, PUBLIC_COLUMNS, type ResourceRow } from '../present.ts';
import { websearchToFts5 } from '../fts.ts';

// Anonymous, unauthenticated catalogue API. Ports community-public/index.ts to
// D1 + Hono, preserving every route, JSON shape, rate limit and Drive-URL rule.
const ID_RE = /^[0-9a-fA-F-]{1,64}$/;

export const publicRoutes = new Hono<{ Bindings: Env }>();

// Shared thumbnail/download signed-URL builder (mirrors signedAsset()).
async function signedAsset(env: Env, id: string, kind: 'thumbnail' | 'download'): Promise<Response> {
  const resource = await env.DB.prepare(
    `SELECT current_version, sha256 FROM community_resources WHERE id = ? AND status = 'published'`,
  )
    .bind(id)
    .first<{ current_version: number; sha256: string | null }>();
  if (!resource) return fail('That resource is not available.', 404);
  const version = await env.DB.prepare(
    `SELECT drive_published_file_id, drive_thumbnail_file_id
       FROM community_resource_versions WHERE resource_id = ? AND version = ?`,
  )
    .bind(id, resource.current_version)
    .first<{ drive_published_file_id: string | null; drive_thumbnail_file_id: string | null }>();
  const fileId =
    kind === 'thumbnail'
      ? version?.drive_thumbnail_file_id || version?.drive_published_file_id
      : version?.drive_published_file_id;
  if (!fileId) {
    return fail(kind === 'thumbnail' ? 'No preview is available.' : 'The PDF is not available.', 404);
  }
  const base =
    kind === 'thumbnail'
      ? version?.drive_thumbnail_file_id
        ? 'https://drive.google.com/uc?export=view&id='
        : 'https://drive.google.com/thumbnail?sz=w800&id='
      : 'https://drive.usercontent.google.com/download?export=download&id=';
  return reply({ url: `${base}${encodeURIComponent(fileId)}`, sha256: resource.sha256 });
}

publicRoutes.get('/resources', async (c) => {
  const env = c.env;
  const url = new URL(c.req.url);
  const pageSize = Math.min(60, Math.max(1, Number(url.searchParams.get('limit') || 30)));
  const offset = Math.max(0, Number(url.searchParams.get('cursor') || 0));
  const queryText = url.searchParams.get('q')?.trim();
  const qualification = url.searchParams.get('qualification');
  const subject = url.searchParams.get('subject');
  const type = url.searchParams.get('type');
  const sort = url.searchParams.get('sort') || 'popular';

  const where: string[] = [`status = 'published'`];
  const binds: unknown[] = [];
  if (qualification) { where.push('qualification = ?'); binds.push(qualification); }
  if (subject) { where.push('subject_code = ?'); binds.push(subject); }
  if (type) { where.push('resource_type = ?'); binds.push(type); }
  if (queryText) {
    const match = websearchToFts5(queryText);
    if (!match) return reply({ items: [], total: 0, nextCursor: null });
    where.push('rowid IN (SELECT rowid FROM community_resources_fts WHERE community_resources_fts MATCH ?)');
    binds.push(match);
  }

  const orderBy =
    sort === 'title' ? 'title ASC'
    : sort === 'newest' ? 'published_at DESC'
    : sort === 'upvoted' ? 'upvotes DESC, title ASC'
    : 'popularity_score DESC, upvotes DESC';

  const page = await env.DB.prepare(
    `SELECT ${PUBLIC_COLUMNS}, COUNT(*) OVER() AS total_count
       FROM community_resources WHERE ${where.join(' AND ')}
       ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
  )
    .bind(...binds, pageSize, offset)
    .all<ResourceRow & { total_count: number }>();
  const rows = page.results ?? [];
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

  const { voter } = await identity(env, c.req.raw);
  const voted = new Set<string>();
  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const votes = await env.DB.prepare(
      `SELECT resource_id FROM community_votes
         WHERE voter_hash = ? AND resource_id IN (${ids.map(() => '?').join(',')})`,
    )
      .bind(voter, ...ids)
      .all<{ resource_id: string }>();
    for (const v of votes.results ?? []) voted.add(v.resource_id);
  }

  return reply({
    items: rows.map((row) => present(row, voted.has(row.id))),
    total,
    nextCursor: offset + rows.length < total ? String(offset + rows.length) : null,
  });
});

publicRoutes.get('/resources/:id', async (c) => {
  const id = c.req.param('id');
  if (!ID_RE.test(id)) return fail('That resource is not available.', 404);
  const row = await c.env.DB.prepare(
    `SELECT ${PUBLIC_COLUMNS} FROM community_resources WHERE id = ? AND status = 'published'`,
  )
    .bind(id)
    .first<ResourceRow>();
  if (!row) return fail('That resource is not available.', 404);
  const { voter } = await identity(c.env, c.req.raw);
  const vote = await c.env.DB.prepare(
    `SELECT 1 AS ok FROM community_votes WHERE resource_id = ? AND voter_hash = ?`,
  )
    .bind(id, voter)
    .first<{ ok: number }>();
  return reply(present(row, Boolean(vote)));
});

publicRoutes.get('/resources/:id/thumbnail', async (c) => {
  const id = c.req.param('id');
  if (!ID_RE.test(id)) return fail('That resource is not available.', 404);
  return signedAsset(c.env, id, 'thumbnail');
});

publicRoutes.get('/resources/:id/download', async (c) => {
  const id = c.req.param('id');
  if (!ID_RE.test(id)) return fail('That resource is not available.', 404);
  return signedAsset(c.env, id, 'download');
});

publicRoutes.put('/resources/:id/vote', async (c) => {
  const id = c.req.param('id');
  if (!ID_RE.test(id)) return fail('That resource is not available.', 404);
  const { voter, ip } = await identity(c.env, c.req.raw);
  if (!(await consumeRateLimit(c.env, ip, 'vote', 10, 30))) {
    return fail('Too many vote changes. Try again later.', 429);
  }
  const exists = await c.env.DB.prepare(
    `SELECT 1 AS ok FROM community_resources WHERE id = ? AND status = 'published'`,
  )
    .bind(id)
    .first<{ ok: number }>();
  if (!exists) return fail('That resource is not available.', 404);
  const body = await c.req.json<{ desired?: boolean }>().catch(() => ({}) as { desired?: boolean });
  const desired = body.desired !== false;
  try {
    if (desired) {
      await c.env.DB.prepare(
        `INSERT INTO community_votes (resource_id, voter_hash) VALUES (?, ?)
           ON CONFLICT(resource_id, voter_hash) DO NOTHING`,
      )
        .bind(id, voter)
        .run();
    } else {
      await c.env.DB.prepare(`DELETE FROM community_votes WHERE resource_id = ? AND voter_hash = ?`)
        .bind(id, voter)
        .run();
    }
  } catch {
    return fail('Your upvote could not be saved.', 500);
  }
  const updated = await c.env.DB.prepare(`SELECT upvotes FROM community_resources WHERE id = ?`)
    .bind(id)
    .first<{ upvotes: number }>();
  return reply({ hasVoted: desired, upvotes: updated?.upvotes ?? 0 });
});

publicRoutes.post('/resources/:id/event', async (c) => {
  const id = c.req.param('id');
  if (!ID_RE.test(id)) return fail('That resource is not available.', 404);
  const body = await c.req.json<{ type?: string }>().catch(() => ({}) as { type?: string });
  if (body.type !== 'open' && body.type !== 'download') return fail('Unknown event type.');
  const eventType = body.type;
  const { voter, ip } = await identity(c.env, c.req.raw);
  if (!(await consumeRateLimit(c.env, ip, `event:${eventType}`, 10, 120))) {
    return reply({ recorded: false });
  }
  let recorded = true;
  try {
    await c.env.DB.prepare(
      `INSERT INTO community_events (resource_id, voter_hash, event_type) VALUES (?, ?, ?)
         ON CONFLICT(resource_id, voter_hash, event_type, event_day) DO NOTHING`,
    )
      .bind(id, voter, eventType)
      .run();
  } catch {
    recorded = false;
  }
  return reply({ recorded });
});
