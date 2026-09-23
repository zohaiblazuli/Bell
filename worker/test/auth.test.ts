import { SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll, passwordGrant, seedAdmin, signInAal2 } from './helpers.ts';

const authUrl = (path: string) => `https://worker.test/auth/v1${path}`;
const adminUrl = (path: string) => `https://worker.test/community-admin${path}`;
const bearer = (token: string) => ({ headers: { authorization: `Bearer ${token}` } });

beforeEach(clearAll);

describe('auth shim', () => {
  it('completes password -> enroll -> verify -> aal2', async () => {
    await seedAdmin();
    const { body: pw, res } = await passwordGrant();
    expect(res.status).toBe(200);
    expect(pw.access_token).toBeTruthy();
    expect(pw.refresh_token).toBeTruthy();
    expect(pw.user.factors).toEqual([]); // not enrolled yet

    const session = await signInAal2();
    expect(session.aal2).toBeTruthy();

    // aal2 token satisfies /me; the aal1 token does not.
    const me = await SELF.fetch(adminUrl('/me'), bearer(session.aal2));
    expect(me.status).toBe(200);
    expect((await me.json<any>()).username).toBe('admin');

    const meAal1 = await SELF.fetch(adminUrl('/me'), bearer(session.aal1));
    expect(meAal1.status).toBe(403);
    // /identity is exempt from the aal2 requirement.
    expect((await SELF.fetch(adminUrl('/identity'), bearer(session.aal1))).status).toBe(200);
  });

  it('rejects a bad password', async () => {
    await seedAdmin();
    const { res } = await passwordGrant('admin', 'wrong');
    expect(res.status).toBe(400);
  });

  it('reports a verified factor on subsequent sign-ins', async () => {
    await seedAdmin();
    await signInAal2();
    const { body } = await passwordGrant();
    expect(body.user.factors).toHaveLength(1);
    expect(body.user.factors[0].status).toBe('verified');
  });

  it('rotates refresh tokens and rejects reuse', async () => {
    await seedAdmin();
    const { refresh } = await signInAal2();
    const first = await SELF.fetch(
      authUrl('/token?grant_type=refresh_token'),
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: refresh }) },
    );
    expect(first.status).toBe(200);
    const reuse = await SELF.fetch(
      authUrl('/token?grant_type=refresh_token'),
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: refresh }) },
    );
    expect(reuse.status).toBe(401);
  });

  it('rejects an invalid TOTP code', async () => {
    await seedAdmin();
    const { body: pw } = await passwordGrant();
    const enroll = await (await SELF.fetch(authUrl('/factors'), {
      method: 'POST',
      headers: { authorization: `Bearer ${pw.access_token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ factor_type: 'totp', friendly_name: 'test' }),
    })).json<any>();
    const verify = await SELF.fetch(authUrl(`/factors/${enroll.id}/verify`), {
      method: 'POST',
      headers: { authorization: `Bearer ${pw.access_token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ challenge_id: 'x', code: '000000' }),
    });
    expect(verify.status).toBe(400);
  });

  it('refuses admin routes without a token', async () => {
    expect((await SELF.fetch(adminUrl('/stats'))).status).toBe(401);
  });
});
