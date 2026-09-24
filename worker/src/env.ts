/// <reference types="@cloudflare/workers-types" />

// Worker bindings. Secrets are set with `wrangler secret put <NAME>`; DB is the D1 binding.
export interface Env {
  DB: D1Database;

  // Self-hosted auth (replaces Supabase GoTrue).
  AUTH_JWT_SECRET: string; // HS256 signing key for admin session tokens
  VOTER_HMAC_SECRET: string; // HMAC key for voter_hash / ip hashing
  IP_ENCRYPTION_KEY: string; // AES-GCM seed for admin-IP ciphertext

  // Google Drive (binaries stay on Drive; carried over verbatim from Supabase).
  GOOGLE_DRIVE_CLIENT_ID: string;
  GOOGLE_DRIVE_CLIENT_SECRET: string;
  GOOGLE_DRIVE_REFRESH_TOKEN: string;
  GOOGLE_DRIVE_QUARANTINE_FOLDER_ID: string;
  GOOGLE_DRIVE_PUBLISHED_FOLDER_ID: string;
  GOOGLE_DRIVE_THUMBNAILS_FOLDER_ID: string;
}
