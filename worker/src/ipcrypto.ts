import type { Env } from './env.ts';

// AES-GCM encryption of admin IPs, ported verbatim from community-admin/index.ts
// (12-byte IV prepended, base64), except the key is derived from IP_ENCRYPTION_KEY
// (a fresh secret) instead of the Supabase service-role key. Because the key is
// fresh, old Supabase ciphertext is intentionally not carried over.
async function ipKey(env: Env, usage: ('encrypt' | 'decrypt')[]): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`bell:community:admin-ip:v1\0${env.IP_ENCRYPTION_KEY}`),
  );
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, usage);
}

export async function encryptIp(env: Env, value: string): Promise<string> {
  const key = await ipKey(env, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value)),
  );
  const packed = new Uint8Array(iv.length + encrypted.length);
  packed.set(iv);
  packed.set(encrypted, iv.length);
  let bin = '';
  for (const byte of packed) bin += String.fromCharCode(byte);
  return btoa(bin);
}

export async function decryptIp(env: Env, value: string): Promise<string> {
  const packed = Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  const key = await ipKey(env, ['decrypt']);
  const clear = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: packed.slice(0, 12) },
    key,
    packed.slice(12),
  );
  return new TextDecoder().decode(clear);
}
