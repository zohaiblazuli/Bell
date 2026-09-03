//! Local study state: bookmarks, done/revision lists, focus minutes, annotation ink.
//!
//! One JSON file per key under the app's own state dir. Deliberately not in SQLite — the index
//! is a throwaway cache that a reindex wipes, and none of this is derived from `G:`, so it must
//! survive that. Nothing here ever touches the library.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use tauri::State;

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
/// Scoped to this directory on purpose: `index.sqlite3` is a rung up, and it is a throwaway cache
/// derived from `G:` that a reindex rebuilds — losing study state is the destructive half, and that
/// is all this touches. Nothing here can reach the library.
#[tauri::command]
pub fn state_clear(dir: State<'_, StateDir>) -> Result<u32, String> {
    let entries = match std::fs::read_dir(&dir.0) {
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
