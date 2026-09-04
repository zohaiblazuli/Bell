//! Local study state: bookmarks, done/revision lists, focus minutes, annotation ink.
//!
//! One JSON file per key under the app's own state dir. Deliberately not in SQLite — the
//! catalogue tables there are replaced wholesale on every sync, and none of this is derived from
//! the catalogue, so it has to live somewhere a resync cannot reach.
//!
//! This file also owns `reset_app`, because erasing the user is the same subject as storing them.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use tauri::State;

use crate::db::Db;

pub struct StateDir(pub PathBuf);

/// Keys become file names, so they are restricted rather than escaped: no separators, no dots
/// leading a traversal, nothing Windows forbids.
fn key_path(dir: &Path, key: &str) -> Result<PathBuf, String> {
    let ok = !key.is_empty()
        && key.len() <= 120
        && key
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'-' || b == b'_')
        && !key.contains("..");
    if !ok {
        return Err(format!("bad state key: {key}"));
    }
    Ok(dir.join(format!("{key}.json")))
}

/// Every stored key at once, so the frontend can hydrate before its first render and keep its
/// own accessors synchronous.
#[tauri::command]
pub fn state_load(dir: State<'_, StateDir>) -> Result<HashMap<String, String>, String> {
    let mut out = HashMap::new();
    let entries = match std::fs::read_dir(&dir.0) {
        Ok(e) => e,
        Err(_) => return Ok(out), // first run
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let Some(key) = path.file_stem().and_then(|s| s.to_str()) else { continue };
        if let Ok(text) = std::fs::read_to_string(&path) {
            out.insert(key.to_string(), text);
        }
    }
    Ok(out)
}

/// Write one key. Goes to a temp file first so a crash mid-write can't truncate saved work.
#[tauri::command]
pub fn state_save(dir: State<'_, StateDir>, key: String, value: String) -> Result<(), String> {
    let path = key_path(&dir.0, &key)?;
    std::fs::create_dir_all(&dir.0).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, value.as_bytes()).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn state_delete(dir: State<'_, StateDir>, key: String) -> Result<(), String> {
    let path = key_path(&dir.0, &key)?;
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// Where the JSON keys live, so Settings can name the directory it is offering to clear rather
/// than describing it vaguely. Also what the opener plugin reveals in Explorer.
#[tauri::command]
pub fn state_path(dir: State<'_, StateDir>) -> String {
    dir.0.to_string_lossy().into_owned()
}

/// Every `*.json` in the state dir, removed. Returns how many went, so the UI can say so.
///
/// Scoped to this directory on purpose: `index.sqlite3` is a rung up and holds the catalogue cache
/// plus the record of downloaded files, neither of which is study state. Losing marks, focus
/// minutes and ink is the destructive half, and that is all this touches.
#[tauri::command]
pub fn state_clear(dir: State<'_, StateDir>) -> Result<u32, String> {
    clear_state_files(&dir.0)
}

fn clear_state_files(dir: &std::path::Path) -> Result<u32, String> {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(0),
        Err(e) => return Err(e.to_string()),
    };
    let mut gone = 0;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
        gone += 1;
    }
    Ok(gone)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResetReport {
    /// State keys deleted.
    pub state_files: u32,
    /// Downloaded documents left in place — reported so the UI can say what survived.
    pub downloads_kept: i64,
}

/// Erase everything the app knows and hand the user back to onboarding.
///
/// **What goes:** every study-state key (marks, recents, focus log, annotation ink, settings,
/// the onboarding answers), the cached catalogue, and the install identifier.
///
/// **What stays:** the PDFs in the downloads folder, and the `download` rows that name them.
/// Deleting several gigabytes of papers is not what "reset the app" should mean, and those rows
/// describe files that are still on disk — clearing them would leave the reader refusing to open
/// a paper the user can see in Explorer, since a `download` row is exactly what authorises a read.
/// The dialog that calls this says both halves out loud.
///
/// Note that clearing the catalogue is not something the user will see for long: the webview
/// reloads straight afterwards and syncs on launch, so a fresh copy lands within about a second.
/// It is cleared anyway, because that is what makes a reset a genuinely clean first run — a corrupt
/// or half-written cache must not be able to survive one — and re-fetching it costs ~70 KB.
///
/// Ordering matters: SQLite first, then the state files. A failure part-way then leaves the app
/// with no catalogue but intact study state, which the next launch repairs by syncing — the other
/// order would strand marks against a catalogue that had already gone.
#[tauri::command]
pub fn reset_app(db: State<'_, Db>, dir: State<'_, StateDir>) -> Result<ResetReport, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    reset_into(&conn, &dir.0)
}

pub fn reset_into(
    conn: &rusqlite::Connection,
    state_dir: &std::path::Path,
) -> Result<ResetReport, String> {
    crate::db::clear_catalog(conn).map_err(|e| e.to_string())?;
    // `schema_version` stays: the tables really are v2, and dropping that claim would make the
    // next open treat this as a fresh database.
    conn.execute("DELETE FROM meta WHERE k <> 'schema_version'", [])
        .map_err(|e| e.to_string())?;
    let downloads_kept: i64 = conn
        .query_row("SELECT COUNT(*) FROM download", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let state_files = clear_state_files(state_dir)?;
    Ok(ResetReport { state_files, downloads_kept })
}

/// Copy the state dir into `<app data>/exports/<name>` and return where it landed.
///
/// `name` comes from the frontend rather than being stamped here, because a readable timestamp
/// needs a calendar and the alternative is pulling `chrono` in for one string. It is validated on
/// the same charset as a state key, so it cannot climb out of `exports/` — the frontend chooses the
/// wording, never the location.
#[tauri::command]
pub fn state_export(dir: State<'_, StateDir>, name: String) -> Result<String, String> {
    if !safe_segment(&name) {
        return Err(format!("bad export name: {name}"));
    }
    let root = dir
        .0
        .parent()
        .ok_or_else(|| "state dir has no parent".to_string())?
        .join("exports")
        .join(&name);
    std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;

    let entries = match std::fs::read_dir(&dir.0) {
        Ok(e) => e,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Ok(root.to_string_lossy().into_owned())
        }
        Err(e) => return Err(e.to_string()),
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let Some(file) = path.file_name() else { continue };
        std::fs::copy(&path, root.join(file)).map_err(|e| e.to_string())?;
    }
    Ok(root.to_string_lossy().into_owned())
}

/// One path segment, on the same restricted charset as a state key. Shared so an export name and
/// a state key cannot drift apart in what they allow.
fn safe_segment(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 120
        && name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'-' || b == b'_')
        && !name.contains("..")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reset_erases_the_user_but_keeps_their_papers() {
        let root = std::env::temp_dir().join(format!(
            "bell-reset-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let state_dir = root.join("state");
        std::fs::create_dir_all(&state_dir).unwrap();
        let conn = crate::db::open(&root.join("index.sqlite3")).unwrap();

        // A used install: a catalogue, a download, sync markers, an install id, study state.
        conn.execute(
            "INSERT INTO catalog_subject(id,code,name,slug,qualification,board)
             VALUES(65,'9709','Mathematics','mathematics','a_level','caie')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO catalog_session(id,code,year,season) VALUES(1,'s24',2024,'may_june')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO catalog_paper(id,subject_id,session_id,component,paper_number,variant,has_ms)
             VALUES(9001,65,1,'12',1,2,1)",
            [],
        )
        .unwrap();
        conn.execute(
            r"INSERT INTO download(paper_id,kind,path,size,downloaded_at)
             VALUES(9001,'qp','C:\papers\9709_s24_qp_12.pdf',1234,'0')",
            [],
        )
        .unwrap();
        crate::db::set_meta(&conn, "catalog_etag", "\"abc\"").unwrap();
        let install = crate::db::install_id(&conn);
        assert!(!install.is_empty());

        for key in ["bookmarks", "settings", "onboarding", "ink.9709-s24-12"] {
            std::fs::write(state_dir.join(format!("{key}.json")), b"[]").unwrap();
        }
        // Something that is not a state key must survive, the same way state_clear leaves it.
        std::fs::write(state_dir.join("notes.txt"), b"keep me").unwrap();

        let report = reset_into(&conn, &state_dir).unwrap();

        assert_eq!(report.state_files, 4, "four json keys went");
        assert_eq!(report.downloads_kept, 1, "the paper on disk is still recorded");

        let count = |sql: &str| -> i64 { conn.query_row(sql, [], |r| r.get(0)).unwrap() };
        assert_eq!(count("SELECT COUNT(*) FROM catalog_paper"), 0);
        assert_eq!(count("SELECT COUNT(*) FROM catalog_session"), 0);
        assert_eq!(count("SELECT COUNT(*) FROM catalog_subject"), 0);
        // The download row is the whole point: it names a file that is still there, and it is
        // what authorises reading it.
        assert_eq!(count("SELECT COUNT(*) FROM download"), 1);

        // Sync markers and the install id go; the schema claim stays, or the next open would
        // treat a v2 database as brand new.
        assert!(crate::db::get_meta(&conn, "catalog_etag").is_none());
        assert!(crate::db::get_meta(&conn, "install_id").is_none());
        assert_eq!(crate::db::get_meta(&conn, "schema_version").as_deref(), Some("2"));

        assert!(!state_dir.join("bookmarks.json").exists());
        assert!(!state_dir.join("onboarding.json").exists());
        assert!(state_dir.join("notes.txt").exists(), "only *.json is ours to delete");

        // Idempotent: resetting an already-reset install is a no-op, not an error.
        let again = reset_into(&conn, &state_dir).unwrap();
        assert_eq!(again.state_files, 0);
        assert_eq!(again.downloads_kept, 1);

        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn rejects_keys_that_would_escape_the_state_dir() {
        let dir = Path::new(r"C:\state");
        assert!(key_path(dir, "bookmarks").is_ok());
        assert!(key_path(dir, "ink.9709-s24-12").is_ok());
        assert!(key_path(dir, "../secrets").is_err());
        assert!(key_path(dir, r"..\secrets").is_err());
        assert!(key_path(dir, "a/b").is_err());
        assert!(key_path(dir, "C:evil").is_err());
        assert!(key_path(dir, "").is_err());
    }

    #[test]
    fn saves_and_loads_round_trip() {
        let root = std::env::temp_dir().join(format!("bell-state-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let path = key_path(&root, "prefs").unwrap();
        std::fs::write(&path, br#"{"tone":"night"}"#).unwrap();

        let entries = std::fs::read_dir(&root).unwrap().count();
        assert_eq!(entries, 1);
        assert_eq!(std::fs::read_to_string(&path).unwrap(), r#"{"tone":"night"}"#);
        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn export_names_are_restricted_to_one_segment() {
        assert!(safe_segment("bell-export-2026-09-03-1421"));
        assert!(safe_segment("state.backup"));
        assert!(!safe_segment("../elsewhere"));
        assert!(!safe_segment(r"..\elsewhere"));
        assert!(!safe_segment("nested/name"));
        assert!(!safe_segment("C:evil"));
        assert!(!safe_segment(""));
    }

    /// Clearing must take the JSON keys and leave anything else alone — the index sits a rung up,
    /// but a stray file in this directory is still not ours to delete.
    #[test]
    fn clearing_takes_only_json() {
        let root = std::env::temp_dir().join(format!("bell-clear-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join("bookmarks.json"), b"[]").unwrap();
        std::fs::write(root.join("focus.json"), b"{}").unwrap();
        std::fs::write(root.join("notes.txt"), b"keep me").unwrap();

        let json: Vec<_> = std::fs::read_dir(&root)
            .unwrap()
            .flatten()
            .map(|e| e.path())
            .filter(|p| p.extension().and_then(|x| x.to_str()) == Some("json"))
            .collect();
        assert_eq!(json.len(), 2);
        for p in &json {
            std::fs::remove_file(p).unwrap();
        }
        assert!(root.join("notes.txt").exists());
        assert_eq!(std::fs::read_dir(&root).unwrap().count(), 1);
        std::fs::remove_dir_all(&root).ok();
    }
}
