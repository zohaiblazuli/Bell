//! SQLite store for the desktop app.
//!
//! Two kinds of data live here, and the difference matters:
//!
//!   * `catalog_*` is a cache of the ShinyPapers catalogue API. It is derived, it is
//!     always safe to drop, and it is replaced wholesale on every sync.
//!
//!   * `download` records PDFs on the user's disk. It is NOT derived from anything
//!     remote, and dropping it would orphan real files. Nothing that refreshes the
//!     catalogue may touch it.
//!
//! That split is the whole reason this file was rewritten: the previous schema was a
//! pure cache of a local folder scan, so wiping everything before a rebuild was
//! always safe. It no longer is.

use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;

pub struct Db(pub Mutex<Connection>);

/// Bumped whenever the schema changes.
///
/// A mismatch drops the catalogue cache and the legacy local-library tables, but
/// deliberately preserves `download` and `meta` — see `open`.
const SCHEMA_VERSION: i64 = 2;

const SCHEMA: &str = r#"
-- ─── Catalogue cache (owned by the server, replaced on every sync) ───────────

CREATE TABLE IF NOT EXISTS catalog_subject (
  id            INTEGER PRIMARY KEY,  -- remote id; stable across syncs
  code          TEXT NOT NULL,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL,
  qualification TEXT NOT NULL,        -- a_level | igcse | o_level
  board         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS catalog_subject_code_idx ON catalog_subject(code);

CREATE TABLE IF NOT EXISTS catalog_session (
  id     INTEGER PRIMARY KEY,         -- remote id
  code   TEXT NOT NULL,               -- s15 | w20 | m16
  year   INTEGER NOT NULL,
  season TEXT NOT NULL                -- may_june | oct_nov | feb_mar
);
CREATE INDEX IF NOT EXISTS catalog_session_code_idx ON catalog_session(code);

CREATE TABLE IF NOT EXISTS catalog_paper (
  id               INTEGER PRIMARY KEY,   -- remote id; what the download API takes
  subject_id       INTEGER NOT NULL REFERENCES catalog_subject(id) ON DELETE CASCADE,
  session_id       INTEGER NOT NULL REFERENCES catalog_session(id) ON DELETE CASCADE,
  component        TEXT NOT NULL,         -- "12"; the third part of a paper key
  paper_number     INTEGER NOT NULL,
  variant          INTEGER NOT NULL,
  total_marks      INTEGER,
  a_threshold      INTEGER,
  b_threshold      INTEGER,
  c_threshold      INTEGER,
  d_threshold      INTEGER,
  e_threshold      INTEGER,
  a_pct            REAL,
  curve_mean_pct   REAL,
  span_pct         REAL,
  hardness_score   INTEGER,              -- 0-100, higher = harder
  difficulty       TEXT,                 -- easy | medium | hard, null when unscored
  difficulty_basis TEXT,                 -- component | subject | absolute
  difficulty_note  TEXT,                 -- pre-rendered upstream; render verbatim
  has_ms           INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS catalog_paper_subject_idx ON catalog_paper(subject_id);
CREATE INDEX IF NOT EXISTS catalog_paper_session_idx ON catalog_paper(session_id);

-- ─── User data (owned by this machine, never dropped by a sync) ──────────────

CREATE TABLE IF NOT EXISTS download (
  paper_id      INTEGER NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('qp','ms')),
  path          TEXT NOT NULL UNIQUE,
  size          INTEGER NOT NULL,
  downloaded_at TEXT NOT NULL,
  PRIMARY KEY (paper_id, kind)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL) WITHOUT ROWID;
"#;

/// Catalogue tables, plus the legacy tables from the local-folder era. Everything
/// here is either a cache of the API or dead weight from before the app went online.
const DROP_DERIVED: &str = "
DROP TABLE IF EXISTS catalog_paper;
DROP TABLE IF EXISTS catalog_session;
DROP TABLE IF EXISTS catalog_subject;
DROP TABLE IF EXISTS difficulty;
DROP TABLE IF EXISTS threshold;
DROP TABLE IF EXISTS doc;
DROP TABLE IF EXISTS session;
DROP TABLE IF EXISTS subject;
";

/// meta keys describing the cached catalogue. Cleared with the cache, because
/// claiming to be in sync while holding no rows would suppress the next fetch.
const CATALOG_META_KEYS: &str =
    "'catalog_etag','catalog_synced_at','catalog_generated_at','catalog_version'";

/// Leftovers from the folder-walking era. Nothing reads either, and a stale document
/// count is worse than none, so they are swept on every open rather than only on a
/// version change — a database that upgraded before this landed still carries them.
const LEGACY_META_KEYS: &str = "'library_root','indexed_docs'";

/// Open (or create) the database at `path`, applying the schema.
pub fn open(path: &PathBuf) -> rusqlite::Result<Connection> {
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let conn = Connection::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;

    // `meta` may not exist yet on a first run, hence the COALESCE-over-subquery.
    conn.execute_batch("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL) WITHOUT ROWID;")?;
    let found: i64 = conn
        .query_row(
            "SELECT COALESCE((SELECT v FROM meta WHERE k='schema_version'),'0')",
            [],
            |r| r.get::<_, String>(0),
        )
        .map(|s| s.parse().unwrap_or(0))
        .unwrap_or(0);

    if found != 0 && found != SCHEMA_VERSION {
        // Only derived tables go. `download` survives, so a schema bump can never
        // orphan files the user has already fetched — and if it somehow does get
        // lost, downloads::repair walks the download root and rebuilds it.
        conn.execute_batch(DROP_DERIVED)?;
        conn.execute(
            &format!("DELETE FROM meta WHERE k IN ({CATALOG_META_KEYS})"),
            [],
        )?;
    }

    conn.execute_batch(SCHEMA)?;
    conn.execute(&format!("DELETE FROM meta WHERE k IN ({LEGACY_META_KEYS})"), [])?;
    conn.execute(
        "INSERT INTO meta(k,v) VALUES('schema_version',?1)
         ON CONFLICT(k) DO UPDATE SET v=excluded.v",
        [SCHEMA_VERSION.to_string()],
    )?;
    Ok(conn)
}

/// Drop the cached catalogue ahead of replacing it.
///
/// Deliberately narrow: this must never touch `download`. The old `clear_index`
/// wiped everything because everything was rebuildable from a folder scan; a
/// catalogue resync has no business deleting records of files on disk.
pub fn clear_catalog(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "DELETE FROM catalog_paper; DELETE FROM catalog_session; DELETE FROM catalog_subject;",
    )
}

pub fn set_meta(conn: &Connection, k: &str, v: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO meta(k,v) VALUES(?1,?2) ON CONFLICT(k) DO UPDATE SET v=excluded.v",
        [k, v],
    )?;
    Ok(())
}

pub fn get_meta(conn: &Connection, k: &str) -> Option<String> {
    conn.query_row("SELECT v FROM meta WHERE k=?1", [k], |r| r.get(0)).ok()
}

/// A stable per-install identifier, minted on first use.
///
/// Sent with download requests so the server can tell one install pulling 200
/// papers from 200 installs pulling one. Random, never derived from anything about
/// the machine or the person, and never leaves this database except as that header.
pub fn install_id(conn: &Connection) -> String {
    if let Some(existing) = get_meta(conn, "install_id") {
        if !existing.is_empty() {
            return existing;
        }
    }
    let fresh = random_hex();
    let _ = set_meta(conn, "install_id", &fresh);
    fresh
}

/// 32 hex chars from splitmix64, seeded off the clock and the process id.
///
/// Hand-rolled rather than pulling in `uuid`/`rand`: this is a bucketing token, not
/// a secret, and the crate graph is deliberately small.
pub fn random_hex() -> String {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0);
    let mut state = nanos ^ ((std::process::id() as u64) << 32) ^ 0x9E37_79B9_7F4A_7C15;
    let mut out = String::with_capacity(32);
    for _ in 0..4 {
        state = state.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = state;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^= z >> 31;
        out.push_str(&format!("{z:016x}"));
    }
    out.truncate(32);
    out
}

