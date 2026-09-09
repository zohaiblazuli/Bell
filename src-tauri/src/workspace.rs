//! Private, machine-local documents for the student's Workspace.

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, OptionalExtension};
use serde::Serialize;
use tauri::State;

use crate::db::{random_hex, Db};

const MAX_DOCUMENT_BYTES: u64 = 200 * 1024 * 1024;

pub struct WorkspaceDir(pub PathBuf);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceDocument {
    id: String,
    title: String,
    original_name: String,
    path: String,
    size: i64,
    imported_at: i64,
    last_opened_at: Option<i64>,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn map_document(row: &rusqlite::Row<'_>) -> rusqlite::Result<WorkspaceDocument> {
    Ok(WorkspaceDocument {
        id: row.get(0)?,
        title: row.get(1)?,
        original_name: row.get(2)?,
        path: row.get(3)?,
        size: row.get(4)?,
        imported_at: row.get(5)?,
        last_opened_at: row.get(6)?,
    })
}

#[tauri::command]
pub fn workspace_list(db: State<'_, Db>) -> Result<Vec<WorkspaceDocument>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut statement = conn
        .prepare(
            "SELECT id,title,original_name,path,size,imported_at,last_opened_at
             FROM workspace_document ORDER BY COALESCE(last_opened_at,imported_at) DESC",
        )
        .map_err(|e| e.to_string())?;
    let documents = statement
        .query_map([], map_document)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(documents)
}

#[tauri::command]
pub fn workspace_import(
    db: State<'_, Db>,
    workspace: State<'_, WorkspaceDir>,
    source_path: String,
) -> Result<WorkspaceDocument, String> {
    let source = PathBuf::from(&source_path);
    let metadata =
        std::fs::metadata(&source).map_err(|e| format!("That document could not be read: {e}"))?;
    if !metadata.is_file() || metadata.len() == 0 {
        return Err("Choose a PDF document.".to_string());
    }
    if metadata.len() > MAX_DOCUMENT_BYTES {
        return Err("Workspace documents must be smaller than 200 MB.".to_string());
    }
    let mut header = [0_u8; 5];
    use std::io::Read;
    std::fs::File::open(&source)
        .and_then(|mut f| f.read_exact(&mut header))
        .map_err(|e| format!("That document could not be inspected: {e}"))?;
    if &header != b"%PDF-" {
        return Err("Workspace currently supports PDF notes and books.".to_string());
    }

    let id = random_hex();
    let destination = workspace.0.join(format!("{id}.pdf"));
    std::fs::copy(&source, &destination)
        .map_err(|e| format!("The document could not be copied into Workspace: {e}"))?;
    let original_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Imported document.pdf")
        .to_string();
    let title = Path::new(&original_name)
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("Imported document")
        .to_string();
    let imported_at = now_ms();
    let path = destination.to_string_lossy().to_string();

    let result = WorkspaceDocument {
        id: id.clone(),
        title: title.clone(),
        original_name: original_name.clone(),
        path: path.clone(),
        size: metadata.len() as i64,
        imported_at,
        last_opened_at: None,
    };
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    if let Err(error) = conn.execute(
        "INSERT INTO workspace_document(id,title,original_name,path,size,imported_at)
         VALUES(?1,?2,?3,?4,?5,?6)",
        params![
            id,
            title,
            original_name,
            path,
            metadata.len() as i64,
            imported_at
        ],
    ) {
        let _ = std::fs::remove_file(&destination);
        return Err(error.to_string());
    }
    Ok(result)
}

#[tauri::command]
pub fn workspace_record_open(db: State<'_, Db>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE workspace_document SET last_opened_at=?1 WHERE id=?2",
        params![now_ms(), id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn workspace_read_document(
    db: State<'_, Db>,
    path: String,
) -> Result<tauri::ipc::Response, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id: Option<String> = conn
        .query_row(
            "SELECT id FROM workspace_document WHERE path=?1",
            [&path],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let Some(id) = id else {
        return Err("That file is not in this Workspace.".to_string());
    };
    match std::fs::read(&path) {
        Ok(bytes) if bytes.starts_with(b"%PDF-") => Ok(tauri::ipc::Response::new(bytes)),
        Ok(_) => Err("The Workspace file is no longer a PDF.".to_string()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            let _ = conn.execute("DELETE FROM workspace_document WHERE id=?1", [id]);
            Err("That Workspace file is no longer on this machine.".to_string())
        }
        Err(error) => Err(format!("The Workspace file could not be read: {error}")),
    }
}

#[tauri::command]
pub fn workspace_delete(
    db: State<'_, Db>,
    workspace: State<'_, WorkspaceDir>,
    id: String,
) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let path: Option<String> = conn
        .query_row(
            "SELECT path FROM workspace_document WHERE id=?1",
            [&id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let Some(path) = path else { return Ok(false) };
    let target = PathBuf::from(&path);
    if target.parent() != Some(workspace.0.as_path())
        || target.extension().and_then(|x| x.to_str()) != Some("pdf")
    {
        return Err("Workspace refused an unexpected document path.".to_string());
    }
    match std::fs::remove_file(&target) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(format!("The document could not be removed: {error}")),
    }
    conn.execute("DELETE FROM workspace_document WHERE id=?1", [&id])
        .map_err(|e| e.to_string())?;
    Ok(true)
}
