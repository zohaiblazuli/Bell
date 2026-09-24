# Bell community worker (Cloudflare)

Cloudflare Worker + D1 backend for Bell's **community** subsystem, migrated off
Supabase (Postgres + GoTrue + two Deno Edge Functions). Binaries stay on Google
Drive. The past-papers web app at `C:\scambridge` is **not** part of this and
stays on Supabase.

One Worker fronts one D1 database and mounts three route groups, so the desktop
client's two base URLs can point at a single origin:

| Prefix | Replaces | Auth |
|---|---|---|
| `/community-public/*` | `community-public` Edge Function | anonymous + `x-bell-install-id` |
| `/community-admin/*` | `community-admin` Edge Function | Bearer HS256 JWT + admin + aal2 |
| `/auth/v1/*` | Supabase GoTrue | self-hosted shim (password, TOTP, refresh) |

## Layout
- `migrations/0001_init.sql` — the D1 schema (tables, FTS5, counter/`updated_at` triggers).
- `src/routes/public.ts`, `src/routes/admin.ts` — the two APIs.
- `src/auth/{shim,jwt,password,totp,admin}.ts` — the GoTrue-compatible auth.
- `src/{drive,ipcrypto,hashing,ratelimit,present,fts,http}.ts` — shared logic.
- `scripts/seed-admin.mjs`, `scripts/export-from-supabase.mjs` — one-off tooling.
- `test/*.test.ts` — Vitest against the real `workerd` runtime + local D1.

## Local dev & tests
```
npm install
cp .dev.vars.example .dev.vars   # fill in secrets
npm run typecheck
npm test                         # 19 tests: public, admin, auth
npm run dev                      # wrangler dev (local D1)
```

<!-- README_APPEND -->
## Deploy (needs a Cloudflare account)
```
wrangler d1 create bell-community          # paste database_id into wrangler.toml
wrangler d1 migrations apply bell-community --remote

# Fresh secrets (do NOT reuse the old Supabase service-role key):
wrangler secret put AUTH_JWT_SECRET
wrangler secret put VOTER_HMAC_SECRET
wrangler secret put IP_ENCRYPTION_KEY
# Google Drive (same values the Supabase function used):
wrangler secret put GOOGLE_DRIVE_CLIENT_ID
wrangler secret put GOOGLE_DRIVE_CLIENT_SECRET
wrangler secret put GOOGLE_DRIVE_REFRESH_TOKEN
wrangler secret put GOOGLE_DRIVE_QUARANTINE_FOLDER_ID
wrangler secret put GOOGLE_DRIVE_PUBLISHED_FOLDER_ID
wrangler secret put GOOGLE_DRIVE_THUMBNAILS_FOLDER_ID

wrangler deploy
```

## Seed the admin + migrate data
```
# 1. Create the single admin (new password; TOTP is enrolled on first login):
node scripts/seed-admin.mjs --username admin --password "…"   # prints an INSERT + the wrangler command

# 2. Copy content rows from Supabase (fresh keys: votes / events / IP history are
#    intentionally reset; admin_users is re-seeded above, scanner tables skipped):
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> \
  ADMIN_USER_ID=<the user_id printed by seed-admin> \
  node scripts/export-from-supabase.mjs
wrangler d1 execute bell-community --remote --file seed/seed-data.sql
```

## Cutover & rollback (desktop client)
The client reads its base URLs from env at runtime *before* the compiled-in
fallback (`community_api_base`/`supabase_url` in `src-tauri/src/community.rs`), so
no Rust code changes — only `C:\ShinyPapersDesktop\.cargo\config.toml`:
```toml
BELL_COMMUNITY_API_BASE = "https://bell-community-worker.<subdomain>.workers.dev"
BELL_SUPABASE_URL       = "https://bell-community-worker.<subdomain>.workers.dev"
BELL_SUPABASE_PUBLISHABLE_KEY = "unused"   # kept non-empty; the shim ignores it
```
`/community-public`, `/community-admin` and `/auth/v1` all resolve against that one
origin. Rebuild the desktop app to cut over. **Rollback:** set those two env vars
back to the Supabase URLs (no rebuild needed) or revert `config.toml`. Keep the
Supabase project until the Cloudflare stack has soaked. All 26 Tauri commands keep
their signatures, so the webview is untouched.

## Not included (by decision)
- The Python scanner (`services/community-scanner/`) — already dormant; its tables
  exist in the schema for parity but nothing enqueues jobs.
- R2 — binaries stay on Google Drive.
