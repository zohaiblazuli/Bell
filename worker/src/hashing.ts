import type { Env } from './env.ts';
import { clientIp } from './http.ts';

// Keyed HMAC-SHA256, hex output. Identical message construction to the old
// community-public Edge Function, but keyed by VOTER_HMAC_SECRET (fresh key)
// rather than the Supabase service-role key.
export async function hmac(env: Env, purpose: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.VOTER_HMAC_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`bell:community:${purpose}:v1\0${value}`),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

// Anonymous voter + ip identity derived from the install id header and client IP.
export async function identity(env: Env, request: Request): Promise<{ voter: string; ip: string }> {
  const install = request.headers.get('x-bell-install-id')?.trim() || 'missing';
  return {
    voter: await hmac(env, 'voter', install),
    ip: await hmac(env, 'ip', clientIp(request)),
  };
}

// SHA-256 hex of an arbitrary string (used for refresh-token storage).
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
