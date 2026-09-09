# Community Resources operations

Community Resources is intentionally split into three trust zones:

- Bell clients call the Rust commands only. The webview CSP remains closed to remote APIs.
- Supabase Edge Functions expose a read-mostly public catalogue and an AAL2-only administrator API.
- Google Drive owns the binary files. A private scanner container is the only component that can
  promote a quarantined upload into the sanitized, link-readable collection.

Ordinary users have no accounts and cannot upload. Their generated installation identifier is
HMACed by the public function before it is used for vote toggling. Administrator sessions live in
memory and disappear when Bell closes.

## 1. Create and migrate Supabase

Create a Supabase project, install the CLI, then run from the repository root:

```powershell
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy community-public
supabase functions deploy community-admin
```

The function runtime supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The Edge Functions use
that credential only inside the server runtime to derive purpose-separated HMAC and IP-encryption
keys. Rotating the service-role key invalidates old
anonymous vote identities and makes previously retained IP events unreadable; purge those events as
part of a planned rotation. Disable public
email sign-up in **Authentication → Providers → Email**. Do not enable anonymous sign-ins.

## 2. Connect the resource Drive

Use the owner account for the supplied Community Resources folder. In Google Cloud, enable the
Google Drive API, create an OAuth web client, and authorize that owner once with offline access and
the Drive scope. Store the resulting refresh token and client credentials as Supabase Function
secrets and scanner secrets; never put them in the desktop build or repository:

```text
GOOGLE_DRIVE_CLIENT_ID=...
GOOGLE_DRIVE_CLIENT_SECRET=...
GOOGLE_DRIVE_REFRESH_TOKEN=...
GOOGLE_DRIVE_QUARANTINE_FOLDER_ID=...
GOOGLE_DRIVE_PUBLISHED_FOLDER_ID=...
GOOGLE_DRIVE_THUMBNAILS_FOLDER_ID=...
```

Create `quarantine`, `published`, and `thumbnails` beneath the supplied root folder. Keep the root
and `quarantine` private. The scanner grants `anyone: reader` only on each sanitized PDF and its
thumbnail after both scans and the PDF rewrite succeed. Do not publish the quarantine folder.

The administrator API creates a single resumable Drive upload session after AAL2 authorization. The
desktop sends bytes directly to that session, then the API verifies the returned file ID, MIME type,
size, parent folder, resource ID, and version before queuing a scan.

## 3. Provision the sole administrator

Create one internal email/password user manually in **Authentication → Users**. Bell derives that
non-user-facing identity as `<lowercase username>@auth.bell.invalid`; the administrator only enters
their username and password in the app. On first sign-in Bell displays a one-time TOTP enrollment QR
code, and it refuses management access until the resulting JWT has `aal2`. Then insert the UUID and
the exact lowercase username supplied by the owner:

```sql
insert into public.admin_users(user_id, username, display_name)
values ('ADMIN_USER_UUID', 'admin_username', 'Bell Administrator');
```

The Auth user alone is insufficient: the UUID must also be in `admin_users`, and every management
request must carry an AAL2 JWT. Removing that row revokes administrator API access immediately.

## 4. Deploy the scanner

Build `services/community-scanner/Dockerfile` and deploy exactly one private worker initially. Give
the container only these runtime secrets:

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SCAN_WORKER_ID=bell-scanner-production
GOOGLE_DRIVE_CLIENT_ID=...
GOOGLE_DRIVE_CLIENT_SECRET=...
GOOGLE_DRIVE_REFRESH_TOKEN=...
GOOGLE_DRIVE_PUBLISHED_FOLDER_ID=...
GOOGLE_DRIVE_THUMBNAILS_FOLDER_ID=...
```

Run it without an inbound port, as a non-root process, with a read-only root filesystem, a bounded
temporary volume, no added Linux capabilities, and explicit CPU/memory limits. Keep ClamAV
definitions current. A file must pass PDF structure checks, active-content checks, two antivirus
passes, canonical rewriting, and renderable-page inspection before it becomes `ready_for_review`.
Only then can the administrator review and publish it.

## 5. Configure and build Bell

The checked-in `.cargo/config.toml` supplies these non-secret, project-specific values to desktop
builds:

```text
BELL_COMMUNITY_API_BASE=https://jjmkfcsakwyhpqlziztl.supabase.co/functions/v1
BELL_SUPABASE_URL=https://jjmkfcsakwyhpqlziztl.supabase.co
BELL_SUPABASE_PUBLISHABLE_KEY=the project's publishable client key
```

The publishable key is safe to embed; the service-role key is not.
Run `npm run build` and `cargo test --lib` before packaging.

## 6. Retention and monitoring

Schedule this daily through Supabase Cron or an equivalent trusted scheduler:

```sql
select public.community_purge_expired_security_data();
```

Encrypted administrator IP events expire after 30 days. Viewing those IPs itself writes an audit
entry. Monitor failed/quarantined scan jobs, scanner liveness, Edge Function error rates, Drive
growth, and abnormal vote/event rate-limit denials. Back up catalogue metadata; published objects
can be rebuilt only while a source or sanitized copy still exists.

## Release checklist

- Public sign-up and anonymous Auth are disabled.
- Exactly one intended UUID is present in `admin_users` and its TOTP factor is verified.
- No service-role, HMAC, or encryption secret appears in a Bell binary or repository secret file.
- The Drive root and quarantine folder are private; only passed output files are link-readable.
- The OAuth refresh token is server-only, and the Drive owner has adequate quota.
- Scanner definitions are current and a safe fixture reaches `ready_for_review`.
- Malware, encrypted, active-content, non-PDF, and over-200-MB fixtures are quarantined/rejected.
- Public browse, combined filters, preview, cached open, download, and vote toggle pass on a clean install.
- The administrator can inspect the scan findings, retained IP event, and audit trail before publish.
- The daily 30-day retention purge has run successfully at least once.
