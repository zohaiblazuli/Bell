import type { Env } from '../env.ts';
import { fail } from '../http.ts';
import { verifyJwt } from './jwt.ts';

export interface Admin {
  userId: string;
  username: string;
  displayName: string;
  aal: string;
}

// Self-hosted replacement for community-admin's requireAdmin(): verify our own
// HS256 token, confirm the subject is a Bell admin, and (unless exempt) require
// aal2. Returns the Admin, or a Response to short-circuit — the same 401/403
// messages the client already surfaces.
export async function requireAdmin(
  env: Env,
  request: Request,
  requireAal2 = true,
): Promise<Admin | Response> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return fail('Administrator sign-in required.', 401);
  const claims = await verifyJwt(token, env.AUTH_JWT_SECRET);
  if (!claims?.sub) return fail('That administrator session has expired.', 401);
  const row = await env.DB.prepare('SELECT display_name, username FROM admin_users WHERE user_id = ?')
    .bind(claims.sub)
    .first<{ display_name: string; username: string }>();
  if (!row) return fail('This account is not a Bell administrator.', 403);
  if (requireAal2 && claims.aal !== 'aal2') return fail('Two-step verification is required.', 403);
  return { userId: claims.sub, username: row.username, displayName: row.display_name, aal: claims.aal };
}
