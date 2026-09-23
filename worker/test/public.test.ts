import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

const INSTALL = 'test-install-1';

async function seedResource(over: Partial<Record<string, unknown>> = {}): Promise<string> {
  const id = crypto.randomUUID();
  const row = {
    title: 'Pure Mathematics Notes',
    description: 'Comprehensive revision notes for the whole syllabus.',
    qualification: 'a_level',
    level: 'A Level',
    subject_code: '9709',
    subject_name: 'Mathematics',
    resource_type: 'notes',
    author_name: 'A. Author',
    uploader_name: 'Uploader',
    rights_confirmed: 1,
    status: 'published',
    current_version: 1,
    created_by: 'admin-1',
    published_at: new Date().toISOString(),
    ...over,
  };
  await env.DB.prepare(
    `INSERT INTO community_resources
       (id, title, description, qualification, level, subject_code, subject_name, resource_type,
        author_name, uploader_name, rights_confirmed, status, current_version, created_by, published_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  )
    .bind(
      id, row.title, row.description, row.qualification, row.level, row.subject_code,
      row.subject_name, row.resource_type, row.author_name, row.uploader_name,
      row.rights_confirmed, row.status, row.current_version, row.created_by, row.published_at,
    )
    .run();
  return id;
}

const get = (path: string) =>
  SELF.fetch(`https://worker.test/community-public${path}`, {
    headers: { 'x-bell-install-id': INSTALL },
  });

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM community_votes'),
    env.DB.prepare('DELETE FROM community_events'),
    env.DB.prepare('DELETE FROM community_resources'),
  ]);
});

describe('listing', () => {
  it('returns published resources in the camelCase DTO shape', async () => {
    const id = await seedResource();
    const res = await get('/resources');
    expect(res.status).toBe(200);
    const body = await res.json<{ items: any[]; total: number; nextCursor: string | null }>();
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    const item = body.items[0];
    expect(item.id).toBe(id);
    expect(item.subjectCode).toBe('9709');
    expect(item.resourceType).toBe('notes');
    expect(item.rightsConfirmed).toBe(true);
    expect(item.hasVoted).toBe(false);
    expect(item.localPath).toBeNull();
  });

  it('hides non-published resources', async () => {
    await seedResource({ status: 'draft', rights_confirmed: 0, current_version: 0 });
    const body = await (await get('/resources')).json<{ total: number }>();
    expect(body.total).toBe(0);
  });

  it('filters by full-text query', async () => {
    await seedResource({ title: 'Organic Chemistry Guide', subject_code: '9701', subject_name: 'Chemistry' });
    await seedResource({ title: 'Pure Mathematics Notes' });
    const hit = await (await get('/resources?q=chemistry')).json<{ items: any[] }>();
    expect(hit.items).toHaveLength(1);
    expect(hit.items[0].subjectName).toBe('Chemistry');
    const miss = await (await get('/resources?q=biology')).json<{ total: number }>();
    expect(miss.total).toBe(0);
  });
});

describe('voting', () => {
  const vote = (id: string, desired: boolean) =>
    SELF.fetch(`https://worker.test/community-public/resources/${id}/vote`, {
      method: 'PUT',
      headers: { 'x-bell-install-id': INSTALL, 'content-type': 'application/json' },
      body: JSON.stringify({ desired }),
    });

  it('counts a vote once and reverses it', async () => {
    const id = await seedResource();
    let body = await (await vote(id, true)).json<{ hasVoted: boolean; upvotes: number }>();
    expect(body).toEqual({ hasVoted: true, upvotes: 1 });
    // Duplicate vote is idempotent (dedup by voter_hash) — still 1.
    body = await (await vote(id, true)).json();
    expect(body.upvotes).toBe(1);
    // getResource now reports hasVoted.
    const single = await (await get(`/resources/${id}`)).json<{ hasVoted: boolean }>();
    expect(single.hasVoted).toBe(true);
    // Un-vote decrements back to 0.
    body = await (await vote(id, false)).json();
    expect(body).toEqual({ hasVoted: false, upvotes: 0 });
  });
});

describe('events', () => {
  const event = (id: string, type: string) =>
    SELF.fetch(`https://worker.test/community-public/resources/${id}/event`, {
      method: 'POST',
      headers: { 'x-bell-install-id': INSTALL, 'content-type': 'application/json' },
      body: JSON.stringify({ type }),
    });

  it('records an open and increments the counter', async () => {
    const id = await seedResource();
    const body = await (await event(id, 'open')).json<{ recorded: boolean }>();
    expect(body.recorded).toBe(true);
    const single = await (await get(`/resources/${id}`)).json<{ opens: number }>();
    expect(single.opens).toBe(1);
  });

  it('rejects an unknown event type', async () => {
    const id = await seedResource();
    const res = await event(id, 'nope');
    expect(res.status).toBe(400);
  });
});
