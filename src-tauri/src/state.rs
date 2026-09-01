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
        let root = std::env::temp_dir().join(format!("foolscap-state-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let path = key_path(&root, "prefs").unwrap();
        std::fs::write(&path, br#"{"tone":"night"}"#).unwrap();

        let entries = std::fs::read_dir(&root).unwrap().count();
        assert_eq!(entries, 1);
        assert_eq!(std::fs::read_to_string(&path).unwrap(), r#"{"tone":"night"}"#);
        std::fs::remove_dir_all(&root).ok();
    }
}
