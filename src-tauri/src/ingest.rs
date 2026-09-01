//! Walks the read-only paper library into the local SQLite index.
//!
//! `G:` is never written to. Nothing here opens a file for anything but `metadata()`.

use std::collections::HashMap;
use std::path::Path;
use std::time::Instant;

use rusqlite::Connection;
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use walkdir::WalkDir;

use crate::db::{self, Db};
use crate::paths;

pub const DEFAULT_ROOT: &str = r"G:\CambridgeDatabase";

#[derive(Debug, Default, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestReport {
    pub root: String,
    pub subjects: usize,
    pub sessions: usize,
    pub docs: usize,
    /// Files under a valid level whose name we refused to guess at.
    pub skipped: usize,
    /// A handful of the skipped names, so the shape of the problem is visible.
    pub skipped_samples: Vec<String>,
    pub elapsed_ms: u128,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub docs: usize,
    pub subjects: usize,
    pub current: String,
}

/// The whole walk, with no Tauri involvement — so it can be exercised from a plain binary
/// against the real tree before any UI depends on it.
pub fn walk_into(
    conn: &mut Connection,
    root: &Path,
    mut on_subject: impl FnMut(&Progress),
) -> Result<IngestReport, String> {
    let started = Instant::now();
    let mut report = IngestReport { root: root.display().to_string(), ..Default::default() };

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    db::clear_index(&tx).map_err(|e| e.to_string())?;

    {
        let mut ins_subject = tx
            .prepare(
                "INSERT INTO subject(level,code,name) VALUES(?1,?2,?3)
                 ON CONFLICT(level,code) DO UPDATE SET name=excluded.name RETURNING id",
            )
            .map_err(|e| e.to_string())?;
        let mut ins_session = tx
            .prepare(
                "INSERT INTO session(subject_id,year,scode,season) VALUES(?1,?2,?3,?4)
                 ON CONFLICT(subject_id,scode) DO UPDATE SET year=excluded.year,
                 season=excluded.season RETURNING id",
            )
            .map_err(|e| e.to_string())?;
        let mut ins_doc = tx
            .prepare(
                "INSERT OR IGNORE INTO doc(session_id,doc_type,variant,path,file_name,size,doc_folder)
                 VALUES(?1,?2,?3,?4,?5,?6,?7)",
            )
            .map_err(|e| e.to_string())?;

        let mut subjects: HashMap<(String, String), i64> = HashMap::new();
        let mut sessions: HashMap<(i64, String), i64> = HashMap::new();

        for level_entry in std::fs::read_dir(root).map_err(|e| e.to_string())?.flatten() {
            let level_name = level_entry.file_name().to_string_lossy().to_string();
            let Some(level) = paths::canonical_level(&level_name) else { continue };
            if !level_entry.path().is_dir() {
                continue;
            }

            for entry in WalkDir::new(level_entry.path()).min_depth(1).into_iter().flatten() {
                if !entry.file_type().is_file() {
                    continue;
                }
                let file_name = entry.file_name().to_string_lossy().to_string();
                if !file_name.to_ascii_lowercase().ends_with(".pdf") {
                    continue;
                }
                let Some(parsed) = paths::parse_file_name(&file_name) else {
                    report.skipped += 1;
                    if report.skipped_samples.len() < 12 {
                        report.skipped_samples.push(file_name.clone());
                    }
                    continue;
                };

                // level / subject / year / season / [doc folder ...] / file
                let rel: Vec<String> = entry
                    .path()
                    .strip_prefix(root)
                    .map(|p| {
                        p.components().map(|c| c.as_os_str().to_string_lossy().to_string()).collect()
                    })
                    .unwrap_or_default();
                if rel.len() < 5 {
                    report.skipped += 1;
                    if report.skipped_samples.len() < 12 {
                        report.skipped_samples.push(file_name.clone());
                    }
                    continue;
                }

                let (subject_name, subject_code) = paths::parse_subject_dir(&rel[1])
                    .unwrap_or_else(|| (rel[1].clone(), parsed.code.clone()));
                let season = paths::parse_season_dir(&rel[3])
                    .map(|(s, _)| s)
                    .unwrap_or_else(|| season_label(&parsed.scode).to_string());
                let year: i64 = rel[2]
                    .parse()
                    .ok()
                    .filter(|y| (1980..=2099).contains(y))
                    .or_else(|| paths::scode_year(&parsed.scode))
                    .unwrap_or(0);
                let doc_folder = rel[rel.len() - 2].clone();

                let subject_key = (level.to_string(), subject_code.clone());
                let subject_id = match subjects.get(&subject_key) {
                    Some(id) => *id,
                    None => {
                        let id: i64 = ins_subject
                            .query_row((level, &subject_code, &subject_name), |r| r.get(0))
                            .map_err(|e| e.to_string())?;
                        subjects.insert(subject_key, id);
                        report.subjects += 1;
                        on_subject(&Progress {
                            docs: report.docs,
                            subjects: report.subjects,
                            current: format!("{subject_name} ({subject_code})"),
                        });
                        id
                    }
                };

                let session_key = (subject_id, parsed.scode.clone());
                let session_id = match sessions.get(&session_key) {
                    Some(id) => *id,
                    None => {
                        let id: i64 = ins_session
                            .query_row((subject_id, year, &parsed.scode, &season), |r| r.get(0))
                            .map_err(|e| e.to_string())?;
                        sessions.insert(session_key, id);
                        report.sessions += 1;
                        id
                    }
                };

                let size = entry.metadata().map(|m| m.len() as i64).unwrap_or(0);
                ins_doc
                    .execute((
                        session_id,
                        &parsed.doc_type,
                        &parsed.variant,
                        entry.path().to_string_lossy().to_string(),
                        &file_name,
                        size,
                        &doc_folder,
                    ))
                    .map_err(|e| e.to_string())?;
                report.docs += 1;
            }
        }
    }

    db::set_meta(&tx, "library_root", &report.root).map_err(|e| e.to_string())?;
    db::set_meta(&tx, "indexed_docs", &report.docs.to_string()).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;

    report.elapsed_ms = started.elapsed().as_millis();
    Ok(report)
}

/// Rebuild the whole index from `root` (defaults to `G:\CambridgeDatabase`).
#[tauri::command]
pub async fn ingest_library(
    app: AppHandle,
    db: State<'_, Db>,
    root: Option<String>,
) -> Result<IngestReport, String> {
    let root = std::path::PathBuf::from(root.unwrap_or_else(|| DEFAULT_ROOT.to_string()));
    if !root.is_dir() {
        return Err(format!("Library root not found: {}", root.display()));
    }

    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    let report = walk_into(&mut conn, &root, |p| {
        let _ = app.emit("ingest:progress", p.clone());
    })?;
    let _ = app.emit("ingest:done", report.clone());
    Ok(report)
}

pub fn season_label(scode: &str) -> &'static str {
    match scode.as_bytes().first() {
        Some(b's') => "May-June",
        Some(b'w') => "Oct-Nov",
        Some(b'm') => "Feb-March",
        _ => "Unknown",
    }
}
