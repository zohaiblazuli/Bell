import { env, SELF } from 'cloudflare:test';
import { hashPassword } from '../src/auth/password.ts';
import { totpCodeNow } from '../src/auth/totp.ts';

export const DEFAULT_PASSWORD = 'correct horse battery staple';

export async function seedAdmin(username = 'admin', password = DEFAULT_PASSWORD) {
  const userId = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO admin_users (user_id, display_name, username, password_hash) VALUES (?, ?, ?, ?)',
  )
    .bind(userId, 'Bell Admin', username, await hashPassword(password))
    .run();
  return { userId, username, password };
}

const authUrl = (path: string) => `https://worker.test/auth/v1${path}`;
const jsonInit = (token: string | null, body: unknown) => ({
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify(body),
});

export async function passwordGrant(username = 'admin', password = DEFAULT_PASSWORD) {
  const res = await SELF.fetch(
    authUrl('/token?grant_type=password'),
    jsonInit(null, { email: `${username}@auth.bell.invalid`, password }),
  );
  return { res, body: await res.clone().json<any>() };
}

// Full password -> enroll -> challenge -> verify flow, returning both tokens.
export async function signInAal2(username = 'admin', password = DEFAULT_PASSWORD) {
  const { body: pw } = await passwordGrant(username, password);
  const enroll = await (await SELF.fetch(authUrl('/factors'), jsonInit(pw.access_token, { factor_type: 'totp', friendly_name: 'test' }))).json<any>();
  const secret = (
    await env.DB.prepare('SELECT totp_secret FROM admin_users WHERE lower(username) = ?').bind(username).first<{ totp_secret: string }>()
  )?.totp_secret as string;
  const challenge = await (await SELF.fetch(authUrl(`/factors/${enroll.id}/challenge`), jsonInit(pw.access_token, {}))).json<any>();
  const code = await totpCodeNow(secret);
  const verified = await (await SELF.fetch(authUrl(`/factors/${enroll.id}/verify`), jsonInit(pw.access_token, { challenge_id: challenge.id, code }))).json<any>();
  return {
    userId: pw.user.id as string,
    factorId: enroll.id as string,
    aal1: pw.access_token as string,
    aal2: verified.access_token as string,
    refresh: verified.refresh_token as string,
    secret,
  };
}

export async function clearAll() {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM community_admin_ip_events'),
    env.DB.prepare('DELETE FROM community_admin_audit'),
    env.DB.prepare('DELETE FROM community_votes'),
    env.DB.prepare('DELETE FROM community_events'),
    env.DB.prepare('DELETE FROM community_daily_stats'),
    env.DB.prepare('DELETE FROM community_resource_versions'),
    env.DB.prepare('DELETE FROM community_resources'),
    env.DB.prepare('DELETE FROM admin_refresh_tokens'),
    env.DB.prepare('DELETE FROM admin_users'),
  ]);
}
