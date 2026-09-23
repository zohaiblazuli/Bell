// RFC 6238 TOTP (HMAC-SHA1, 30s step, 6 digits) plus RFC 4648 base32, on WebCrypto.
// Replaces GoTrue's factor enrollment/verification for the single admin.
import QRCode from 'qrcode-svg';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP = 30;
const DIGITS = 6;

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(secret: string): Uint8Array {
  const clean = secret.replace(/=+$/, '').toUpperCase().replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = B32.indexOf(char);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}

async function codeForCounter(secret: string, counter: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    base32Decode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const msg = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    msg[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }
  const hs = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const offset = hs[hs.length - 1] & 0x0f;
  const bin =
    ((hs[offset] & 0x7f) << 24) |
    ((hs[offset + 1] & 0xff) << 16) |
    ((hs[offset + 2] & 0xff) << 8) |
    (hs[offset + 3] & 0xff);
  return (bin % 10 ** DIGITS).toString().padStart(DIGITS, '0');
}

// Verify against the current step ± `window` to tolerate clock skew.
export async function verifyTotp(secret: string, code: string, window = 1): Promise<boolean> {
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) return false;
  const counter = Math.floor(Date.now() / 1000 / STEP);
  for (let delta = -window; delta <= window; delta++) {
    if (await codeForCounter(secret, counter + delta) === trimmed) return true;
  }
  return false;
}

// The current valid code for a secret. Exported for tests and one-off tooling.
export async function totpCodeNow(secret: string): Promise<string> {
  return codeForCounter(secret, Math.floor(Date.now() / 1000 / STEP));
}

// otpauth:// URI rendered as an SVG QR string — mfaQrImageSource() in
// src/lib/community.ts accepts raw <svg> markup (it rejects a bare otpauth URI).
export function totpQrSvg(username: string, secret: string): string {
  const label = encodeURIComponent(`Bell:${username}`);
  const uri =
    `otpauth://totp/${label}?secret=${secret}&issuer=Bell&algorithm=SHA1&digits=${DIGITS}&period=${STEP}`;
  return new QRCode({ content: uri, padding: 2, width: 220, height: 220, ecl: 'M' }).svg();
}
