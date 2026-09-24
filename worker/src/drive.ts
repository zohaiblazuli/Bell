import type { Env } from './env.ts';

// Google Drive v3 client, ported from community-admin/index.ts. Drive stays the
// binary store, so this moves across essentially unchanged. The OAuth token is
// cached per isolate exactly as before.
export const DRIVE_API = 'https://www.googleapis.com/drive/v3';
export const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

let driveTokenCache: { value: string; expiresAt: number } | undefined;

export async function driveToken(env: Env): Promise<string> {
  if (driveTokenCache && driveTokenCache.expiresAt > Date.now() + 60_000) return driveTokenCache.value;
  const { GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN } = env;
  if (!GOOGLE_DRIVE_CLIENT_ID || !GOOGLE_DRIVE_CLIENT_SECRET || !GOOGLE_DRIVE_REFRESH_TOKEN) {
    throw new Error('Google Drive OAuth is not configured.');
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_DRIVE_CLIENT_ID,
      client_secret: GOOGLE_DRIVE_CLIENT_SECRET,
      refresh_token: GOOGLE_DRIVE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const body = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description || 'Google Drive authorization failed.');
  }
  driveTokenCache = {
    value: body.access_token,
    expiresAt: Date.now() + Number(body.expires_in || 3600) * 1000,
  };
  return driveTokenCache.value;
}

export function driveFolder(env: Env, name: 'quarantine' | 'published' | 'thumbnails'): string {
  const key = `GOOGLE_DRIVE_${name.toUpperCase()}_FOLDER_ID` as keyof Env;
  const value = env[key];
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{10,200}$/.test(value)) {
    throw new Error(`${key} is not configured.`);
  }
  return value;
}

export async function driveFetch(env: Env, url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${await driveToken(env)}`, ...(init.headers || {}) },
  });
}

export function safeDriveName(value: string): string {
  return value.replace(/[\\/\r\n\0]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'resource.pdf';
}

export function driveDownloadUrl(fileId: string): string {
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download`;
}
