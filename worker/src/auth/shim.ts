import { Hono } from 'hono';
import type { Env } from '../env.ts';
import { fail, reply } from '../http.ts';
import { sha256Hex } from '../hashing.ts';
import { signJwt } from './jwt.ts';
import { verifyPassword } from './password.ts';
import { requireAdmin } from './admin.ts';
import { generateTotpSecret, totpQrSvg, verifyTotp } from './totp.ts';

// GoTrue-compatible auth shim. Emits exactly the JSON the Rust client's
// AuthResponse / AuthUser / AuthFactor / MfaEnrollment / ChallengeResponse
// structs deserialize, so community.rs is unchanged. The `apikey` header is
// ignored (the publishable key is now meaningless).
const ACCESS_TTL = 3600; // 1 hour
const REFRESH_TTL = 30 * 86_400; // 30 days

export const authRoutes = new Hono<{ Bindings: Env }>();

interface AdminAuthRow {
  user_id: string;
  username: string;
  password_hash: string;
  totp_verified: number;
  factor_id: string | null;
}

function factorsFor(row: { totp_verified: number; factor_id: string | null }) {
  return row.totp_verified && row.factor_id
    ? [{ id: row.factor_id, status: 'verified', factor_type: 'totp' }]
    : [];
}

function randomToken(): string {
  return [...crypto.getRandomValues(new Uint8Array(32))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

// Issue an access token (aal-scoped) + a rotating opaque refresh token stored hashed.
async function issueSession(env: Env, userId: string, aal: 'aal1' | 'aal2') {
  const access_token = await signJwt({ sub: userId, aal, ttlSeconds: ACCESS_TTL }, env.AUTH_JWT_SECRET);
  const refresh_token = randomToken();
  await env.DB.prepare(
    'INSERT INTO admin_refresh_tokens (token_hash, user_id, aal, expires_at) VALUES (?, ?, ?, ?)',
  )
    .bind(await sha256Hex(refresh_token), userId, aal, new Date(Date.now() + REFRESH_TTL * 1000).toISOString())
    .run();
  return { access_token, refresh_token };
}

authRoutes.post('/token', async (c) => {
  const grant = c.req.query('grant_type');

  if (grant === 'password') {
    const body = await c.req.json<{ email?: string; password?: string }>().catch(() => ({}) as { email?: string; password?: string });
    const username = String(body.email || '').split('@')[0]?.trim().toLowerCase();
    if (!username || !body.password) return fail('Enter your administrator credentials.', 400);
    const admin = await c.env.DB.prepare(
      'SELECT user_id, username, password_hash, totp_verified, factor_id FROM admin_users WHERE lower(username) = ?',
    )
      .bind(username)
      .first<AdminAuthRow>();
    if (!admin || !(await verifyPassword(body.password, admin.password_hash))) {
      return fail('Those administrator credentials were not recognised.', 400);
    }
    const session = await issueSession(c.env, admin.user_id, 'aal1');
    return reply({ ...session, user: { id: admin.user_id, factors: factorsFor(admin) } });
  }

  if (grant === 'refresh_token') {
    const body = await c.req.json<{ refresh_token?: string }>().catch(() => ({}) as { refresh_token?: string });
    if (!body.refresh_token) return fail('A refresh token is required.', 400);
    const hash = await sha256Hex(body.refresh_token);
    const record = await c.env.DB.prepare(
      'SELECT user_id, aal, expires_at FROM admin_refresh_tokens WHERE token_hash = ?',
    )
      .bind(hash)
      .first<{ user_id: string; aal: 'aal1' | 'aal2'; expires_at: string }>();
    if (!record || Date.parse(record.expires_at) <= Date.now()) {
      return fail('That administrator session has expired.', 401);
    }
    const admin = await c.env.DB.prepare(
      'SELECT user_id, username, password_hash, totp_verified, factor_id FROM admin_users WHERE user_id = ?',
    )
      .bind(record.user_id)
      .first<AdminAuthRow>();
    if (!admin) return fail('That administrator session has expired.', 401);
    await c.env.DB.prepare('DELETE FROM admin_refresh_tokens WHERE token_hash = ?').bind(hash).run(); // single-use
    const session = await issueSession(c.env, record.user_id, record.aal);
    return reply({ ...session, user: { id: record.user_id, factors: factorsFor(admin) } });
  }

  return fail('Unsupported grant type.', 400);
});

// Enroll a TOTP factor. Requires a valid (aal1) admin token — the client calls
// this straight after the password grant when no verified factor exists.
authRoutes.post('/factors', async (c) => {
  const admin = await requireAdmin(c.env, c.req.raw, false);
  if (admin instanceof Response) return admin;
  const secret = generateTotpSecret();
  const factorId = crypto.randomUUID();
  await c.env.DB.prepare('UPDATE admin_users SET totp_secret = ?, totp_verified = 0, factor_id = ? WHERE user_id = ?')
    .bind(secret, factorId, admin.userId)
    .run();
  return reply({ id: factorId, totp: { qr_code: totpQrSvg(admin.username, secret) } });
});

// Challenge is stateless; the client only needs an id to echo back on verify.
authRoutes.post('/factors/:id/challenge', async (c) => {
  const admin = await requireAdmin(c.env, c.req.raw, false);
  if (admin instanceof Response) return admin;
  return reply({ id: crypto.randomUUID() });
});

// Verify the TOTP code and, on success, upgrade the session to aal2.
authRoutes.post('/factors/:id/verify', async (c) => {
  const admin = await requireAdmin(c.env, c.req.raw, false);
  if (admin instanceof Response) return admin;
  const factorId = c.req.param('id');
  const body = await c.req.json<{ challenge_id?: string; code?: string }>().catch(() => ({}) as { challenge_id?: string; code?: string });
  const row = await c.env.DB.prepare('SELECT totp_secret, factor_id FROM admin_users WHERE user_id = ?')
    .bind(admin.userId)
    .first<{ totp_secret: string | null; factor_id: string | null }>();
  if (!row?.totp_secret || row.factor_id !== factorId) return fail('Two-step verification is not set up.', 400);
  if (!(await verifyTotp(row.totp_secret, body.code || ''))) return fail('That verification code is not valid.', 400);
  await c.env.DB.prepare('UPDATE admin_users SET totp_verified = 1 WHERE user_id = ?').bind(admin.userId).run();
  const session = await issueSession(c.env, admin.userId, 'aal2');
  return reply({
    ...session,
    user: { id: admin.userId, factors: [{ id: factorId, status: 'verified', factor_type: 'totp' }] },
  });
});
