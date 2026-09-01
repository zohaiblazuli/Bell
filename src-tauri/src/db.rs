//! SQLite index for the local paper library.
//!
//! The index is a *derived cache* of `G:\CambridgeDatabase`. It is always safe to delete and
//! rebuild. Nothing here ever writes to the source tree.

use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;

pub struct Db(pub Mutex<Connection>);

/// Bumped whenever the schema changes; a mismatch wipes and rebuilds the index.
const SCHEMA_VERSION: i64 = 1;

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS subject (
  id      INTEGER PRIMARY KEY,
  level   TEXT NOT NULL,
  code    TEXT NOT NULL,
  name    TEXT NOT NULL,
  UNIQUE(level, code)
);

CREATE TABLE IF NOT EXISTS session (
  id         INTEGER PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subject(id) ON DELETE CASCADE,
  year       INTEGER NOT NULL,
  scode      TEXT NOT NULL,
  season     TEXT NOT NULL,
  UNIQUE(subject_id, scode)
);

CREATE TABLE IF NOT EXISTS doc (
  id         INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  doc_type   TEXT NOT NULL,
  variant    TEXT,
  path       TEXT NOT NULL UNIQUE,
  file_name  TEXT NOT NULL,
  size       INTEGER NOT NULL,
  doc_folder TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS doc_session_idx ON doc(session_id, doc_type);
CREATE INDEX IF NOT EXISTS doc_type_idx    ON doc(doc_type);

-- Grade thresholds, parsed out of the `gt` PDFs. Filled by the parser, not by the walker.
CREATE TABLE IF NOT EXISTS threshold (
  subject_id INTEGER NOT NULL REFERENCES subject(id) ON DELETE CASCADE,
  scode      TEXT NOT NULL,
  component  TEXT NOT NULL,
  max_mark   INTEGER,
  grade      TEXT NOT NULL,
  mark       INTEGER NOT NULL,
  PRIMARY KEY (subject_id, scode, component, grade)
) WITHOUT ROWID;

-- Difficulty is computed locally from `threshold`.
CREATE TABLE IF NOT EXISTS difficulty (
  subject_id INTEGER NOT NULL REFERENCES subject(id) ON DELETE CASCADE,
  scode      TEXT NOT NULL,
  component  TEXT NOT NULL,
  score      REAL NOT NULL,
  band       TEXT NOT NULL,
  sample     INTEGER NOT NULL,
  PRIMARY KEY (subject_id, scode, component)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL) WITHOUT ROWID;
"#;

/// Open (or create) the index at `path`, applying the schema.
pub fn open(path: &PathBuf) -> rusqlite::Result<Connection> {
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let conn = Connection::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;

    let found: i64 = conn
        .query_row("SELECT COALESCE((SELECT v FROM meta WHERE k='schema_version'),'0')", [], |r| {
            r.get::<_, String>(0)
        })
        .map(|s| s.parse().unwrap_or(0))
        .unwrap_or(0);

    if found != 0 && found != SCHEMA_VERSION {
        // Derived data only — dropping is always safe.
        conn.execute_batch(
            "DROP TABLE IF EXISTS difficulty;
             DROP TABLE IF EXISTS threshold;
             DROP TABLE IF EXISTS doc;
             DROP TABLE IF EXISTS session;
             DROP TABLE IF EXISTS subject;
             DROP TABLE IF EXISTS meta;",
        )?;
    }

    conn.execute_batch(SCHEMA)?;
    conn.execute(
        "INSERT INTO meta(k,v) VALUES('schema_version',?1)
         ON CONFLICT(k) DO UPDATE SET v=excluded.v",
        [SCHEMA_VERSION.to_string()],
    )?;
    Ok(conn)
}

/// Wipe the indexed library (leaves `meta` alone) ahead of a fresh walk.
pub fn clear_index(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "DELETE FROM difficulty; DELETE FROM threshold; DELETE FROM doc;
         DELETE FROM session;    DELETE FROM subject;",
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
