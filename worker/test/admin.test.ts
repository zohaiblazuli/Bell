import { SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll, seedAdmin, signInAal2 } from './helpers.ts';

const adminUrl = (path: string) => `https://worker.test/community-admin${path}`;

const NEW_RESOURCE = {
  title: 'Mechanics Summary',
  description: 'Key formulae and worked examples for M1.',
  qualification: 'a_level',
  subjectCode: '9709',
  subjectName: 'Mathematics',
  resourceType: 'notes',
  authorName: 'A. Author',
  uploaderName: 'Admin',
  rightsConfirmed: true,
};

let token: string;

beforeEach(async () => {
  await clearAll();
  await seedAdmin();
  token = (await signInAal2()).aal2;
});

const authed = (method: string, body?: unknown) => ({
  method,
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

async function createResource() {
  const res = await SELF.fetch(adminUrl('/resources'), authed('POST', NEW_RESOURCE));
  return { res, body: await res.json<any>() };
}

describe('admin resources', () => {
  it('creates, lists and reports stats', async () => {
    const { res, body } = await createResource();
    expect(res.status).toBe(201);
    expect(body.status).toBe('draft');
    expect(body.rightsConfirmed).toBe(true);
    expect(body.level).toBe('A Level');

    const list = await (await SELF.fetch(adminUrl('/resources'), authed('GET'))).json<any[]>();
    expect(list).toHaveLength(1);

    const stats = await (await SELF.fetch(adminUrl('/stats'), authed('GET'))).json<any>();
    expect(stats.drafts).toBe(1);
    expect(stats.published).toBe(0);
  });

  it('rejects create without rights confirmation', async () => {
    const res = await SELF.fetch(adminUrl('/resources'), authed('POST', { ...NEW_RESOURCE, rightsConfirmed: false }));
    expect(res.status).toBe(400);
  });

  it('updates editable fields', async () => {
    const { body } = await createResource();
    const updated = await (await SELF.fetch(adminUrl(`/resources/${body.id}`), authed('PATCH', { title: 'Mechanics Revision' }))).json<any>();
    expect(updated.title).toBe('Mechanics Revision');
  });

  it('refuses to publish a resource with no reviewed upload', async () => {
    const { body } = await createResource();
    const res = await SELF.fetch(adminUrl(`/resources/${body.id}/status`), authed('POST', { status: 'published' }));
    expect(res.status).toBe(400);
  });

  it('409s a preview when nothing is uploaded', async () => {
    const { body } = await createResource();
    const res = await SELF.fetch(adminUrl(`/resources/${body.id}/preview`), authed('GET'));
    expect(res.status).toBe(409);
  });

  it('exposes the audit trail and decrypts recorded IPs', async () => {
    const { body } = await createResource();
    await SELF.fetch(adminUrl(`/resources/${body.id}`), authed('PATCH', { title: 'Renamed' }));
    const inspection = await (await SELF.fetch(adminUrl(`/resources/${body.id}/inspection`), authed('GET'))).json<any>();
    const actions = inspection.auditTrail.map((row: any) => row.action);
    expect(actions).toContain('resource.created');
    expect(actions).toContain('resource.updated');
    expect(Array.isArray(inspection.securityEvents)).toBe(true);
    expect(inspection.securityEvents[0].ip).toBe('unknown'); // no cf-connecting-ip in tests
  });

  it('deletes a resource with no versions', async () => {
    const { body } = await createResource();
    const del = await (await SELF.fetch(adminUrl(`/resources/${body.id}`), authed('DELETE'))).json<any>();
    expect(del).toEqual({ deleted: true, id: body.id });
    const list = await (await SELF.fetch(adminUrl('/resources'), authed('GET'))).json<any[]>();
    expect(list).toHaveLength(0);
  });
});
