//! One-time carry-over from the app's previous identity.
//!
//! Tauri derives `app_data_dir()` from the bundle identifier, so renaming the app from
//! `com.foolscap.study` to `com.bell.study` moves the whole data directory — and with it the
//! study state (bookmarks, done/revision marks, focus minutes, annotation ink) and the index,
//! which holds the parsed grade thresholds and every computed difficulty score. None of that is
//! derivable from `G:` again cheaply, and the ink is not derivable at all.
//!
//! So on first launch under the new identifier we **copy** the old directory across. Copy, never
//! move: if anything goes wrong the old data is still sitting there to try again from. A marker
//! file records that the pass has run, so it happens exactly once even when the copy found
//! nothing.

use std::path::{Path, PathBuf};

/// The identifier the app shipped under before it was named Bell.
const PREVIOUS_IDENTIFIER: &str = "com.foolscap.study";

/// Written into the new data dir once the pass has run, so it never runs twice.
const MARKER: &str = ".migrated-from-foolscap";

#[derive(Debug, Default, PartialEq)]
pub struct Report {
    pub state_files: usize,
    pub index_copied: bool,
}

/// Runs the carry-over if it has not run before. Errors are returned rather than propagated into
/// `setup`, because a failed migration must not stop the app from starting — the worst case is a
/// user who starts from zero, which is exactly where they would be without this code at all.
pub fn run(new_dir: &Path) -> Result<Option<Report>, String> {
    if new_dir.join(MARKER).exists() {
        return Ok(None);
    }

    // `app_data_dir()` is `<roaming>/<identifier>`, so the sibling directory named after the old
    // identifier is the old data dir. Deriving it this way keeps the platform lookup in one place
    // (Tauri's) instead of hard-coding %APPDATA%.
    let old_dir: PathBuf = match new_dir.parent() {
        Some(parent) => parent.join(PREVIOUS_IDENTIFIER),
        None => return Ok(None),
    };

    std::fs::create_dir_all(new_dir).map_err(|e| e.to_string())?;

    if !old_dir.is_dir() {
        // Nothing to carry over — a genuinely fresh install. Still mark it, so we do not stat a
        // missing directory on every launch forever.
        mark(new_dir)?;
        return Ok(None);
    }

    let mut report = Report::default();

    // Study state: one JSON file per key.
    let old_state = old_dir.join("state");
    let new_state = new_dir.join("state");
    if old_state.is_dir() {
        std::fs::create_dir_all(&new_state).map_err(|e| e.to_string())?;
        for entry in std::fs::read_dir(&old_state).map_err(|e| e.to_string())?.flatten() {
            let from = entry.path();
            if from.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            let Some(name) = from.file_name() else { continue };
            let to = new_state.join(name);
            // Never overwrite: anything already here was written under the new identifier and is
            // newer than what we are copying.
            if to.exists() {
                continue;
            }
            if std::fs::copy(&from, &to).is_ok() {
                report.state_files += 1;
            }
        }
    }

    // The index is nominally a cache, but it also holds the parsed thresholds and the difficulty
    // scores for ~6k sittings, so rebuilding it is minutes of work rather than none.
    let old_index = old_dir.join("index.sqlite3");
    let new_index = new_dir.join("index.sqlite3");
    if old_index.is_file() && !new_index.exists() && std::fs::copy(&old_index, &new_index).is_ok() {
        report.index_copied = true;
    }

    mark(new_dir)?;
    Ok(Some(report))
}

fn mark(new_dir: &Path) -> Result<(), String> {
    std::fs::write(
        new_dir.join(MARKER),
        format!("carried over from {PREVIOUS_IDENTIFIER}\n"),
    )
    .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A temp root holding the two sibling data dirs, laid out exactly as Tauri would.
    fn scratch(tag: &str) -> (PathBuf, PathBuf, PathBuf) {
        let root = std::env::temp_dir().join(format!("bell-migrate-{}-{tag}", std::process::id()));
        std::fs::remove_dir_all(&root).ok();
        let old = root.join(PREVIOUS_IDENTIFIER);
        let new = root.join("com.bell.study");
        std::fs::create_dir_all(old.join("state")).unwrap();
        (root, old, new)
    }

    #[test]
    fn carries_state_and_index_across() {
        let (root, old, new) = scratch("copies");
        std::fs::write(old.join("state").join("bookmarks.json"), r#"["9709-s24-12"]"#).unwrap();
        std::fs::write(old.join("state").join("focus.json"), r#"{"2026-09-02":41}"#).unwrap();
        std::fs::write(old.join("state").join("ink.9709-s24-12.json"), "[]").unwrap();
        std::fs::write(old.join("index.sqlite3"), b"not really sqlite").unwrap();

        let report = run(&new).unwrap().expect("should report a migration");
        assert_eq!(report, Report { state_files: 3, index_copied: true });
        assert_eq!(
            std::fs::read_to_string(new.join("state").join("bookmarks.json")).unwrap(),
            r#"["9709-s24-12"]"#
        );
        assert!(new.join("index.sqlite3").is_file());
        // The source is left untouched, so a failed run can be retried by hand.
        assert!(old.join("state").join("bookmarks.json").is_file());

        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn runs_only_once() {
        let (root, old, new) = scratch("once");
        std::fs::write(old.join("state").join("bookmarks.json"), "[]").unwrap();
        assert!(run(&new).unwrap().is_some());
        assert!(run(&new).unwrap().is_none(), "the marker should short-circuit the second run");
        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn never_overwrites_newer_state() {
        let (root, old, new) = scratch("nooverwrite");
        std::fs::write(old.join("state").join("bookmarks.json"), r#"["old"]"#).unwrap();
        std::fs::create_dir_all(new.join("state")).unwrap();
        std::fs::write(new.join("state").join("bookmarks.json"), r#"["new"]"#).unwrap();

        let report = run(&new).unwrap().expect("should still run");
        assert_eq!(report.state_files, 0);
        assert_eq!(
            std::fs::read_to_string(new.join("state").join("bookmarks.json")).unwrap(),
            r#"["new"]"#
        );
        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn a_fresh_install_marks_and_moves_on() {
        let root = std::env::temp_dir().join(format!("bell-migrate-{}-fresh", std::process::id()));
        std::fs::remove_dir_all(&root).ok();
        let new = root.join("com.bell.study");
        assert!(run(&new).unwrap().is_none());
        assert!(new.join(MARKER).is_file(), "even a no-op should leave the marker");
        std::fs::remove_dir_all(&root).ok();
    }
}
