// Minimal HS256 JWT sign/verify on WebCrypto — the self-hosted replacement for
// GoTrue's access tokens. Claims carry { sub, aal, iat, exp }; requireAdmin and
// the auth shim are the only callers. base64url throughout (no '=' padding).

function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  return Uint8Array.from(bin, (char) => char.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export interface JwtClaims {
  sub: string;
  aal: 'aal1' | 'aal2';
  iat: number;
  exp: number;
  [key: string]: unknown;
}

export async function signJwt(
  claims: Omit<JwtClaims, 'iat' | 'exp'> & { ttlSeconds: number },
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const { ttlSeconds, ...rest } = claims;
  const payload = { ...rest, iat: now, exp: now + ttlSeconds };
  const enc = new TextEncoder();
  const header = b64urlEncode(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(`${header}.${body}`)),
  );
  return `${header}.${body}.${b64urlEncode(signature)}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtClaims | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const enc = new TextEncoder();
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    b64urlToBytes(parts[2]),
    enc.encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) return null;
  let claims: JwtClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch {
    return null;
  }
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) return null;
  return claims;
}
