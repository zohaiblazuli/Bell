-- Bell community subsystem — D1 (SQLite) schema.
-- Translated from supabase/migrations/*.sql (Postgres) for the Cloudflare migration.
-- Substitutions: enum -> TEXT + CHECK(IN ...); uuid -> TEXT (Worker crypto.randomUUID());
-- jsonb -> TEXT (JSON string); identity -> INTEGER PRIMARY KEY AUTOINCREMENT;
-- timestamptz/now() -> ISO-8601 TEXT; date -> 'YYYY-MM-DD' TEXT; double precision -> REAL.
-- Regex CHECKs are enforced in the Worker (SQLite has no regexp). RLS/GRANTs are dropped:
-- the Worker is the only DB client and enforces authorization in code.

PRAGMA foreign_keys = ON;

-- admin_users ---------------------------------------------------------------
-- The Postgres FK to auth.users is gone; user_id is a Worker-generated UUID.
-- password_hash / totp_* / factor_id are NEW, backing the self-hosted auth shim.
CREATE TABLE admin_users (
  user_id       TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  username      TEXT NOT NULL,                -- format ^[a-z0-9][a-z0-9_-]{2,63}$ enforced in Worker
  password_hash TEXT NOT NULL,                -- PBKDF2-HMAC-SHA256 (salt + params encoded)
  totp_secret   TEXT,                          -- base32; NULL until enrolled
  totp_verified INTEGER NOT NULL DEFAULT 0,    -- 0 | 1
  factor_id     TEXT,                           -- stable id echoed to the client
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX admin_users_username_unique ON admin_users (lower(username));

-- admin_refresh_tokens (hashed, rotated) — replaces GoTrue's refresh store.
CREATE TABLE admin_refresh_tokens (
  token_hash TEXT PRIMARY KEY,                 -- SHA-256 of the opaque refresh token
  user_id    TEXT NOT NULL REFERENCES admin_users(user_id) ON DELETE CASCADE,
  aal        TEXT NOT NULL DEFAULT 'aal2',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX admin_refresh_tokens_user_idx ON admin_refresh_tokens (user_id);

-- community_resources -------------------------------------------------------
CREATE TABLE community_resources (
  id                 TEXT PRIMARY KEY,          -- UUIDv4 from the Worker
  title              TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 160),
  description        TEXT NOT NULL CHECK (length(description) BETWEEN 10 AND 2000),
  qualification      TEXT NOT NULL CHECK (qualification IN ('a_level','igcse','o_level')),
  level              TEXT NOT NULL,
  subject_code       TEXT NOT NULL,             -- ^[0-9A-Za-z-]{2,16}$ enforced in Worker
  subject_name       TEXT NOT NULL CHECK (length(subject_name) BETWEEN 2 AND 120),
  resource_type      TEXT NOT NULL CHECK (resource_type IN
                       ('notes','revision_guide','formula_sheet','topic_questions','other','book')),
  author_name        TEXT NOT NULL CHECK (length(author_name) BETWEEN 1 AND 120),
  uploader_name      TEXT NOT NULL CHECK (length(uploader_name) BETWEEN 1 AND 80),
  contributor_credit TEXT CHECK (contributor_credit IS NULL OR length(contributor_credit) <= 120),
  source_url         TEXT CHECK (source_url IS NULL OR length(source_url) <= 1000),
  rights_confirmed   INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
                       ('draft','uploading','scanning','ready_for_review','published',
                        'quarantined','rejected','unpublished','archived')),
  current_version    INTEGER NOT NULL DEFAULT 0,
  page_count         INTEGER CHECK (page_count IS NULL OR page_count > 0),
  size_bytes         INTEGER NOT NULL DEFAULT 0 CHECK (size_bytes BETWEEN 0 AND 209715200),
  sha256             TEXT,                       -- ^[a-f0-9]{64}$ enforced in Worker
  upvotes            INTEGER NOT NULL DEFAULT 0 CHECK (upvotes >= 0),
  downloads          INTEGER NOT NULL DEFAULT 0 CHECK (downloads >= 0),
  opens              INTEGER NOT NULL DEFAULT 0 CHECK (opens >= 0),
  popularity_score   REAL NOT NULL DEFAULT 0,
  scan_status        TEXT CHECK (scan_status IS NULL OR scan_status IN
                       ('pending','running','passed','failed')),
  created_by         TEXT NOT NULL,             -- admin_users.user_id (no hard FK: admin may be pruned)
  published_at       TEXT,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  -- published_requires_upload (supersedes the baseline published_requires_scan)
  CHECK (status <> 'published' OR (current_version > 0 AND rights_confirmed = 1))
);
CREATE INDEX community_resources_public_idx
  ON community_resources (status, qualification, subject_code, published_at DESC);
CREATE INDEX community_resources_popular_idx
  ON community_resources (status, popularity_score DESC, upvotes DESC);
CREATE INDEX community_resources_created_by_idx ON community_resources (created_by);

-- recursive_triggers is OFF by default in SQLite, so this self-update does not re-fire.
CREATE TRIGGER community_resources_touch AFTER UPDATE ON community_resources BEGIN
  UPDATE community_resources SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE id = NEW.id;
END;

-- full-text search (replaces the generated tsvector column + GIN index) ------
-- External-content FTS5 over community_resources. Four columns carry the old
-- setweight groups (title=A, subject=A, author/contributor=B, description=C);
-- weighting is applied at query time via bm25() if/when a relevance sort is added.
CREATE VIRTUAL TABLE community_resources_fts USING fts5(
  title, subject, author, description,
  content='community_resources', content_rowid='rowid', tokenize='unicode61'
);
CREATE TRIGGER community_resources_fts_ai AFTER INSERT ON community_resources BEGIN
  INSERT INTO community_resources_fts(rowid, title, subject, author, description)
  VALUES (new.rowid, new.title,
          new.subject_name || ' ' || new.subject_code,
          new.author_name || ' ' || coalesce(new.contributor_credit, ''),
          new.description);
END;
CREATE TRIGGER community_resources_fts_ad AFTER DELETE ON community_resources BEGIN
  INSERT INTO community_resources_fts(community_resources_fts, rowid, title, subject, author, description)
  VALUES ('delete', old.rowid, old.title,
          old.subject_name || ' ' || old.subject_code,
          old.author_name || ' ' || coalesce(old.contributor_credit, ''),
          old.description);
END;
CREATE TRIGGER community_resources_fts_au AFTER UPDATE ON community_resources BEGIN
  INSERT INTO community_resources_fts(community_resources_fts, rowid, title, subject, author, description)
  VALUES ('delete', old.rowid, old.title,
          old.subject_name || ' ' || old.subject_code,
          old.author_name || ' ' || coalesce(old.contributor_credit, ''),
          old.description);
  INSERT INTO community_resources_fts(rowid, title, subject, author, description)
  VALUES (new.rowid, new.title,
          new.subject_name || ' ' || new.subject_code,
          new.author_name || ' ' || coalesce(new.contributor_credit, ''),
          new.description);
END;

-- community_resource_versions -----------------------------------------------
-- Columns renamed to drive_* in 20260907202425; the ^[A-Za-z0-9_-]{10,200}$
-- checks on those ids are enforced in the Worker.
CREATE TABLE community_resource_versions (
  resource_id              TEXT NOT NULL REFERENCES community_resources(id) ON DELETE CASCADE,
  version                  INTEGER NOT NULL,
  drive_quarantine_file_id TEXT NOT NULL,
  drive_published_file_id  TEXT,
  drive_thumbnail_file_id  TEXT,
  original_filename        TEXT NOT NULL,
  mime_type                TEXT NOT NULL DEFAULT 'application/pdf',
  size_bytes               INTEGER NOT NULL CHECK (size_bytes BETWEEN 5 AND 209715200),
  sha256                   TEXT,
  page_count               INTEGER CHECK (page_count IS NULL OR page_count > 0),
  created_by               TEXT NOT NULL,
  created_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (resource_id, version),
  UNIQUE (sha256)
);
CREATE INDEX community_resource_versions_created_by_idx
  ON community_resource_versions (created_by);

CREATE TABLE community_votes (
  resource_id TEXT NOT NULL REFERENCES community_resources(id) ON DELETE CASCADE,
  voter_hash  TEXT NOT NULL CHECK (length(voter_hash) = 64),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (resource_id, voter_hash)
);

CREATE TABLE community_events (
  resource_id TEXT NOT NULL REFERENCES community_resources(id) ON DELETE CASCADE,
  voter_hash  TEXT NOT NULL CHECK (length(voter_hash) = 64),
  event_type  TEXT NOT NULL CHECK (event_type IN ('open','download')),
  event_day   TEXT NOT NULL DEFAULT (date('now')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (resource_id, voter_hash, event_type, event_day)
);

CREATE TABLE community_daily_stats (
  resource_id TEXT NOT NULL REFERENCES community_resources(id) ON DELETE CASCADE,
  day         TEXT NOT NULL,
  opens       INTEGER NOT NULL DEFAULT 0,
  downloads   INTEGER NOT NULL DEFAULT 0,
  upvotes     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (resource_id, day)
);

-- counters (mirror community_vote_counter / community_event_counter) ---------
-- Kept as triggers so the Worker just INSERT/DELETEs and the count stays atomic
-- inside that statement. In DO UPDATE, an unqualified column is the existing row.
CREATE TRIGGER community_votes_counter_ins AFTER INSERT ON community_votes BEGIN
  UPDATE community_resources
    SET upvotes = upvotes + 1, popularity_score = popularity_score + 4
    WHERE id = NEW.resource_id;
  INSERT INTO community_daily_stats(resource_id, day, upvotes)
    VALUES (NEW.resource_id, date('now'), 1)
    ON CONFLICT(resource_id, day) DO UPDATE SET upvotes = upvotes + 1;
END;
CREATE TRIGGER community_votes_counter_del AFTER DELETE ON community_votes BEGIN
  UPDATE community_resources
    SET upvotes = max(0, upvotes - 1), popularity_score = max(0, popularity_score - 4)
    WHERE id = OLD.resource_id;
END;

CREATE TRIGGER community_events_counter_open AFTER INSERT ON community_events
WHEN NEW.event_type = 'open' BEGIN
  UPDATE community_resources
    SET opens = opens + 1, popularity_score = popularity_score + 1
    WHERE id = NEW.resource_id;
  INSERT INTO community_daily_stats(resource_id, day, opens)
    VALUES (NEW.resource_id, NEW.event_day, 1)
    ON CONFLICT(resource_id, day) DO UPDATE SET opens = opens + 1;
END;
CREATE TRIGGER community_events_counter_download AFTER INSERT ON community_events
WHEN NEW.event_type = 'download' BEGIN
  UPDATE community_resources
    SET downloads = downloads + 1, popularity_score = popularity_score + 2
    WHERE id = NEW.resource_id;
  INSERT INTO community_daily_stats(resource_id, day, downloads)
    VALUES (NEW.resource_id, NEW.event_day, 1)
    ON CONFLICT(resource_id, day) DO UPDATE SET downloads = downloads + 1;
END;

-- community_scan_jobs / _reports — scanner is out of scope (dormant). Kept for
-- schema parity so a future revival needs no destructive migration.
CREATE TABLE community_scan_jobs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_id TEXT NOT NULL,
  version     INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','running','passed','failed')),
  attempts    INTEGER NOT NULL DEFAULT 0,
  locked_at   TEXT,
  locked_by   TEXT,
  last_error  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (resource_id, version),
  FOREIGN KEY (resource_id, version)
    REFERENCES community_resource_versions(resource_id, version) ON DELETE CASCADE
);
CREATE TRIGGER community_scan_jobs_touch AFTER UPDATE ON community_scan_jobs BEGIN
  UPDATE community_scan_jobs SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE id = NEW.id;
END;

CREATE TABLE community_scan_reports (
  resource_id     TEXT NOT NULL,
  version         INTEGER NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('pending','running','passed','failed')),
  scanner_version TEXT NOT NULL,
  findings        TEXT NOT NULL DEFAULT '{}',   -- JSON
  scanned_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (resource_id, version),
  FOREIGN KEY (resource_id, version)
    REFERENCES community_resource_versions(resource_id, version) ON DELETE CASCADE
);

CREATE TABLE community_admin_audit (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id    TEXT NOT NULL,
  action      TEXT NOT NULL,
  resource_id TEXT REFERENCES community_resources(id) ON DELETE SET NULL,
  detail      TEXT NOT NULL DEFAULT '{}',        -- JSON
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX community_admin_audit_actor_idx ON community_admin_audit (actor_id);
CREATE INDEX community_admin_audit_resource_idx ON community_admin_audit (resource_id);

CREATE TABLE community_rate_limits (
  key_hash     TEXT NOT NULL,
  action       TEXT NOT NULL,
  window_start TEXT NOT NULL,
  hits         INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (key_hash, action, window_start)
);

-- Was private.community_admin_ip_events in Postgres; access is Worker-only here.
CREATE TABLE community_admin_ip_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id      TEXT NOT NULL,
  resource_id   TEXT REFERENCES community_resources(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  ip_ciphertext TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now','+30 days'))
);
CREATE INDEX community_admin_ip_events_actor_idx ON community_admin_ip_events (actor_id);
CREATE INDEX community_admin_ip_events_resource_idx
  ON community_admin_ip_events (resource_id, created_at DESC);
