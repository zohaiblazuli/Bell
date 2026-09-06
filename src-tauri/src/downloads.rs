//! Downloading papers to the user's machine, and keeping the record of what is
//! actually on disk honest.
//!
//! Every download goes through the web app's redirect endpoint rather than straight
//! to the upstream host, so the URL is resolved server-side at the moment of the
//! request. That means a moved or mirrored file needs no new desktop build.
//!
//! Three invariants worth preserving if you touch this:
//!
//!   1. **Nothing is written until the bytes are known to be a PDF.** The body is
//!      buffered, magic-checked, then written temp-and-renamed. A killed download
//!      cannot leave a truncated file that later passes validation.
//!   2. **A `download` row is inserted only after the rename succeeds.** That row is
//!      what makes a path readable through `read_document`, so recording it early
//!      would widen the sandbox to a file that is not there.
//!   3. **Concurrency is the caller's business.** Commands are independent, and the
//!      webview already has a small worker-pool pattern for this. Keeping the queue
//!      up there avoids a second scheduler down here fighting the same mutex.

use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::Duration;

use rusqlite::{Connection, OptionalExtension};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::catalog;
use crate::db::{random_hex, Db};
use crate::paths;

/// Folder name under Documents. Deliberately a constant: there is no folder picker,
/// and a paper library is user content that belongs somewhere a person can find,
/// back up and open outside the app — not in AppData\Roaming, which some roaming
/// profile setups try to synchronise.
const LIBRARY_FOLDER: &str = "ShinyPapers";

const MAX_ATTEMPTS: u32 = 3;
const PROGRESS_EVERY_BYTES: u64 = 64 * 1024;

/// How many documents may be in flight at once, across every caller.
///
/// This has to live down here rather than only in the webview's queue, because a question paper
/// spawns its mark scheme as a detached task: a batch of 1,100 papers would otherwise put 1,100
/// unbounded mark-scheme fetches on the wire behind a queue that thinks it is running four at a
/// time. The reference downloader in the web app uses five; four leaves headroom.
const MAX_IN_FLIGHT: usize = 4;

fn gate() -> &'static tokio::sync::Semaphore {
    static GATE: OnceLock<tokio::sync::Semaphore> = OnceLock::new();
    GATE.get_or_init(|| tokio::sync::Semaphore::new(MAX_IN_FLIGHT))
}

/// Per-launch id, so the server can group a burst of downloads into one session
/// without knowing anything about the machine.
fn session_id() -> &'static str {
    static SESSION: OnceLock<String> = OnceLock::new();
    SESSION.get_or_init(random_hex)
}

/// Where downloads land. Documents when the platform can tell us, app data if not.
pub fn download_root(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .document_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|e| format!("no writable folder for the library: {e}"))?;
    Ok(base.join(LIBRARY_FOLDER))
}

/// Where downloads land, creating it if it does not exist yet.
///
/// The directory is made here rather than only on the first download so that Settings can offer to
/// reveal it on a fresh install: `revealItemInDir` on a path that is not there fails, and a button
/// that does nothing until you have downloaded something is worse than an empty folder.
#[tauri::command]
pub fn download_root_path(app: AppHandle) -> Result<String, String> {
    let root = download_root(&app)?;
    std::fs::create_dir_all(&root).map_err(|e| format!("{}: {e}", root.display()))?;
    Ok(root.to_string_lossy().to_string())
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub paper_id: i64,
    pub kind: String,
    pub downloaded: u64,
    /// None when the server sends no content length — some do not.
    pub total: Option<u64>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    pub paper_id: i64,
    pub kind: String,
    pub path: String,
    pub size: u64,
    /// True when a valid file was already on disk, so nothing was fetched.
    pub cached: bool,
    /// Whether a mark scheme exists for this paper — the reason a `qp` download can
    /// decide to bring one along.
    pub has_ms: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RepairReport {
    pub scanned: i64,
    pub linked: i64,
    pub unmatched: i64,
    /// Rows dropped because the file they named is gone.
    pub pruned: i64,
}

/// Is there already a real PDF here?
///
/// Presence is not enough — a failed download can leave a plausible-looking file, so
/// the first five bytes are checked, mirroring the web app's own `checkLocalPaperExists`.
pub fn is_pdf_on_disk(path: &Path) -> bool {
    let Ok(meta) = std::fs::metadata(path) else {
        return false;
    };
    if !meta.is_file() || meta.len() < 5 {
        return false;
    }
    let Ok(mut file) = std::fs::File::open(path) else {
        return false;
    };
    let mut head = [0u8; 5];
    file.read_exact(&mut head).is_ok() && &head == b"%PDF-"
}

struct Target {
    dir: PathBuf,
    file: String,
    /// Whether the catalogue says a mark scheme exists for this paper.
    has_ms: bool,
}

fn resolve_target(
    conn: &Connection,
    root: &Path,
    paper_id: i64,
    kind: &str,
) -> Result<Target, String> {
    let row = conn
        .query_row(
            "SELECT su.qualification, su.name, su.code, se.year, se.season, se.code,
                    p.component, p.has_ms
             FROM catalog_paper p
             JOIN catalog_subject su ON su.id = p.subject_id
             JOIN catalog_session se ON se.id = p.session_id
             WHERE p.id = ?1",
            [paper_id],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, i64>(3)?,
                    r.get::<_, String>(4)?,
                    r.get::<_, String>(5)?,
                    r.get::<_, String>(6)?,
                    r.get::<_, i64>(7)?,
                ))
            },
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let (qualification, name, code, year, season, scode, component, has_ms) =
        row.ok_or_else(|| format!("paper {paper_id} is not in the catalogue — try syncing first"))?;

    if kind == "ms" && has_ms == 0 {
        return Err("there is no mark scheme on record for this paper".to_string());
    }

    Ok(Target {
        dir: root.join(paths::paper_dir(
            &qualification,
            &name,
            &code,
            year,
            &season,
            &scode,
        )),
        file: paths::paper_file_name(&code, &scode, kind, &component),
        has_ms: has_ms != 0,
    })
}

/// Record a file on disk. Called only once the bytes are in place.
fn record(
    conn: &Connection,
    paper_id: i64,
    kind: &str,
    path: &Path,
    size: u64,
) -> Result<(), String> {
    let as_text = path.to_string_lossy().to_string();
    // `path` is UNIQUE, and a conflict there would not be caught by the primary-key
    // upsert below, so clear any other row that claims this exact file first.
    conn.execute(
        "DELETE FROM download WHERE path = ?1 AND NOT (paper_id = ?2 AND kind = ?3)",
        rusqlite::params![as_text, paper_id, kind],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO download(paper_id,kind,path,size,downloaded_at) VALUES(?1,?2,?3,?4,?5)
         ON CONFLICT(paper_id,kind) DO UPDATE SET
           path=excluded.path, size=excluded.size, downloaded_at=excluded.downloaded_at",
        rusqlite::params![
            paper_id,
            kind,
            as_text,
            size as i64,
            catalog::now_ms().to_string()
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Write bytes as `dir/file`, via a temporary sibling so no reader ever sees a
/// partial PDF. Mirrors the temp-then-rename pattern `state::state_save` uses.
fn write_atomically(dir: &Path, file: &str, bytes: &[u8]) -> Result<PathBuf, String> {
    std::fs::create_dir_all(dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    let full = dir.join(file);
    let tmp = dir.join(format!(".{file}.part"));
    std::fs::write(&tmp, bytes).map_err(|e| format!("{}: {e}", tmp.display()))?;
    // Windows will not rename onto an existing file.
    let _ = std::fs::remove_file(&full);
    if let Err(e) = std::fs::rename(&tmp, &full) {
        let _ = std::fs::remove_file(&tmp);
        return Err(format!("{}: {e}", full.display()));
    }
    Ok(full)
}

/// A fetch failure, and whether trying again could plausibly help. Retrying a
/// missing paper just delays the same answer three times over.
struct FetchError {
    message: String,
    retryable: bool,
}

impl FetchError {
    fn retry(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            retryable: true,
        }
    }
    fn permanent(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            retryable: false,
        }
    }
}

/// Fetch one PDF through the redirect endpoint, buffering and validating it.
async fn fetch_pdf(
    app: &AppHandle,
    url: &str,
    install: &str,
    paper_id: i64,
    kind: &str,
) -> Result<Vec<u8>, FetchError> {
    let mut res = catalog::client()
        .map_err(FetchError::permanent)?
        .get(url)
        .timeout(Duration::from_secs(180))
        .header("x-bell-install", install)
        .header("x-bell-session", session_id())
        .header("x-bell-version", env!("CARGO_PKG_VERSION"))
        .header("x-bell-platform", std::env::consts::OS)
        .send()
        .await
        .map_err(|e| FetchError::retry(format!("network error: {e}")))?;

    if res.status() == reqwest::StatusCode::NOT_FOUND {
        return Err(FetchError::permanent("no file is recorded for this paper"));
    }
    if !res.status().is_success() {
        return Err(FetchError::retry(format!(
            "the server answered HTTP {}",
            res.status().as_u16()
        )));
    }

    // The upstream host signals a missing paper with an HTML page, not a 404 — the
    // web app's own downloader has the same guard.
    if let Some(content_type) = res
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
    {
        if content_type.contains("text/html") {
            return Err(FetchError::permanent(
                "that paper is not available from the source",
            ));
        }
    }

    let total = res.content_length();
    let mut bytes: Vec<u8> = Vec::with_capacity(total.unwrap_or(1 << 20) as usize);
    let mut announced = 0u64;

    while let Some(chunk) = res
        .chunk()
        .await
        .map_err(|e| FetchError::retry(format!("the transfer was interrupted: {e}")))?
    {
        bytes.extend_from_slice(&chunk);
        let so_far = bytes.len() as u64;
        if so_far - announced >= PROGRESS_EVERY_BYTES {
            announced = so_far;
            let _ = app.emit(
                "download:progress",
                DownloadProgress {
                    paper_id,
                    kind: kind.to_string(),
                    downloaded: so_far,
                    total,
                },
            );
        }
    }

    if bytes.len() < 5 || &bytes[..5] != b"%PDF-" {
        return Err(FetchError::permanent("what came back was not a PDF"));
    }
    Ok(bytes)
}

/// Download one paper's question paper or mark scheme.
///
/// Idempotent: a valid file already on disk is recorded and returned without any
/// network use, which is what makes re-running a queue cheap.
///
/// **A question paper brings its mark scheme with it.** A paper and its answers are one
/// thing to study, and needing a second deliberate action to get the half you check your
/// work against is a papercut. The companion fetch is spawned rather than awaited, so
/// the reader opens on the question paper the moment it lands and the mark scheme arrives
/// quietly behind it; by the time anyone presses `mark scheme` it is normally already
/// there, and if it is not, that button's own download path covers it.
#[tauri::command]
pub async fn download_paper(
    app: AppHandle,
    paper_id: i64,
    kind: String,
) -> Result<DownloadResult, String> {
    if kind != "qp" && kind != "ms" {
        return Err("kind must be 'qp' or 'ms'".to_string());
    }

    let result = fetch_and_store(&app, paper_id, &kind).await?;

    if kind == "qp" && result.has_ms {
        let companion = app.clone();
        tauri::async_runtime::spawn(async move {
            // Failure here is deliberately quiet: the question paper is already in hand,
            // and interrupting someone about a mark scheme they have not asked for yet
            // would be noise. The badge's own press retries it.
            if let Err(error) = fetch_and_store(&companion, paper_id, "ms").await {
                eprintln!("[downloads] mark scheme for paper {paper_id}: {error}");
            }
        });
    }

    Ok(result)
}

/// Fetch one document and record it. Shared by the command and the companion task.
///
/// Takes `AppHandle` rather than `State<'_, Db>` so it can be spawned: a borrowed state
/// guard cannot outlive the command, but a handle can hand back the same managed state
/// from inside a task.
async fn fetch_and_store(
    app: &AppHandle,
    paper_id: i64,
    kind: &str,
) -> Result<DownloadResult, String> {
    let db = app.state::<Db>();
    let root = download_root(app)?;

    let (target, install) = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        (
            resolve_target(&conn, &root, paper_id, kind)?,
            crate::db::install_id(&conn),
        )
    };
    let full = target.dir.join(&target.file);

    if is_pdf_on_disk(&full) {
        let size = std::fs::metadata(&full).map(|m| m.len()).unwrap_or(0);
        {
            let conn = db.0.lock().map_err(|e| e.to_string())?;
            record(&conn, paper_id, kind, &full, size)?;
        }
        return Ok(DownloadResult {
            paper_id,
            kind: kind.to_string(),
            path: full.to_string_lossy().to_string(),
            size,
            cached: true,
            has_ms: target.has_ms,
        });
    }

    let url = format!(
        "{}/api/desktop/v1/file/{}/{}",
        catalog::api_base(),
        paper_id,
        kind
    );

    // Held for the fetch only. Acquired before the retry loop rather than inside it so a retry
    // does not have to queue behind the whole batch again, and dropped the moment the bytes are in
    // hand — the SQLite write below is not what needs rationing.
    let permit = gate()
        .acquire()
        .await
        .map_err(|e| format!("download queue closed: {e}"))?;

    let mut last = String::from("the download did not start");
    for attempt in 1..=MAX_ATTEMPTS {
        match fetch_pdf(app, &url, &install, paper_id, kind).await {
            Ok(bytes) => {
                drop(permit);
                let size = bytes.len() as u64;
                let written = write_atomically(&target.dir, &target.file, &bytes)?;
                {
                    let conn = db.0.lock().map_err(|e| e.to_string())?;
                    record(&conn, paper_id, kind, &written, size)?;
                }
                let result = DownloadResult {
                    paper_id,
                    kind: kind.to_string(),
                    path: written.to_string_lossy().to_string(),
                    size,
                    cached: false,
                    has_ms: target.has_ms,
                };
                let _ = app.emit("download:done", result.clone());
                return Ok(result);
            }
            Err(err) => {
                last = err.message;
                if !err.retryable || attempt == MAX_ATTEMPTS {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(400 * u64::from(attempt))).await;
            }
        }
    }
    Err(last)
}

/// Forget a download and remove its file. Used by "remove from this machine".
#[tauri::command]
pub fn delete_download(db: State<'_, Db>, paper_id: i64, kind: String) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let path: Option<String> = conn
        .query_row(
            "SELECT path FROM download WHERE paper_id = ?1 AND kind = ?2",
            rusqlite::params![paper_id, &kind],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let Some(path) = path else { return Ok(false) };
    // Drop the row first: it is what authorises reads, so it must not outlive the file.
    conn.execute(
        "DELETE FROM download WHERE paper_id = ?1 AND kind = ?2",
        rusqlite::params![paper_id, &kind],
    )
    .map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&path);
    Ok(true)
}

/// Rebuild the download table from what is actually on disk, and prune rows whose
/// file has gone.
///
/// Needed in two situations: a schema bump (which preserves `download`, but this is
/// the belt to that braces), and a user who has moved, deleted or hand-copied files.
/// Because a `download` row is what authorises a read, an unrepaired mismatch shows
/// up as a paper the app believes it has but cannot open.
#[tauri::command]
pub fn repair_downloads(app: AppHandle, db: State<'_, Db>) -> Result<RepairReport, String> {
    let root = download_root(&app)?;
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    repair_into(&mut conn, &root)
}

/// Recurse for PDFs. Depth-capped so a symlink loop cannot hang the app.
fn collect_pdfs(dir: &Path, out: &mut Vec<PathBuf>, depth: usize) {
    if depth > 8 {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        match entry.file_type() {
            Ok(t) if t.is_dir() => collect_pdfs(&path, out, depth + 1),
            Ok(t) if t.is_file() => {
                let is_pdf = path
                    .extension()
                    .map(|e| e.eq_ignore_ascii_case("pdf"))
                    .unwrap_or(false);
                if is_pdf {
                    out.push(path);
                }
            }
            _ => {}
        }
    }
}

pub fn repair_into(conn: &mut Connection, root: &Path) -> Result<RepairReport, String> {
    // (subject code, session code, component, kind) -> paper id
    let mut index: std::collections::HashMap<(String, String, String, String), i64> =
        std::collections::HashMap::new();
    {
        let mut st = conn
            .prepare(
                "SELECT p.id, su.code, se.code, p.component
                 FROM catalog_paper p
                 JOIN catalog_subject su ON su.id = p.subject_id
                 JOIN catalog_session se ON se.id = p.session_id",
            )
            .map_err(|e| e.to_string())?;
        let rows = st
            .query_map([], |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (id, code, scode, component) = row.map_err(|e| e.to_string())?;
            for kind in ["qp", "ms"] {
                index.insert(
                    (
                        code.clone(),
                        scode.clone(),
                        component.clone(),
                        kind.to_string(),
                    ),
                    id,
                );
            }
        }
    }

    let mut files = Vec::new();
    collect_pdfs(root, &mut files, 0);
    let scanned = files.len() as i64;

    let mut matched: Vec<(i64, String, PathBuf, u64)> = Vec::new();
    let mut unmatched = 0i64;
    for path in files {
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        let parsed = paths::parse_file_name(&name);
        let hit = parsed.as_ref().and_then(|p| {
            let component = p.component.as_deref()?;
            if p.doc_type != "qp" && p.doc_type != "ms" {
                return None;
            }
            index
                .get(&(
                    p.code.clone(),
                    p.scode.clone(),
                    component.to_string(),
                    p.doc_type.clone(),
                ))
                .map(|id| (*id, p.doc_type.clone()))
        });
        match hit {
            Some((id, kind)) if is_pdf_on_disk(&path) => {
                let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                matched.push((id, kind, path, size));
            }
            _ => unmatched += 1,
        }
    }

    // Prune first, so a row whose file moved is replaced rather than fought with
    // over the UNIQUE(path) constraint.
    let mut pruned = 0i64;
    {
        let mut stale: Vec<(i64, String)> = Vec::new();
        let mut st = conn
            .prepare("SELECT paper_id, kind, path FROM download")
            .map_err(|e| e.to_string())?;
        let rows = st
            .query_map([], |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (paper_id, kind, path) = row.map_err(|e| e.to_string())?;
            if !is_pdf_on_disk(Path::new(&path)) {
                stale.push((paper_id, kind));
            }
        }
        for (paper_id, kind) in stale {
            conn.execute(
                "DELETE FROM download WHERE paper_id = ?1 AND kind = ?2",
                rusqlite::params![paper_id, kind],
            )
            .map_err(|e| e.to_string())?;
            pruned += 1;
        }
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut linked = 0i64;
    for (paper_id, kind, path, size) in &matched {
        record(&tx, *paper_id, kind, path, *size)?;
        linked += 1;
    }
    tx.commit().map_err(|e| e.to_string())?;

    Ok(RepairReport {
        scanned,
        linked,
        unmatched,
        pruned,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_anything_that_is_not_a_pdf() {
        let dir = std::env::temp_dir().join(format!("bell-magic-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();

        let good = write_atomically(&dir, "9709_m16_qp_62.pdf", b"%PDF-1.4\nhello\n").unwrap();
        assert!(is_pdf_on_disk(&good));

        // Presence is not enough: a failed download can leave a plausible file behind.
        let html = dir.join("decoy.pdf");
        std::fs::write(&html, b"<!DOCTYPE html><title>404</title>").unwrap();
        assert!(!is_pdf_on_disk(&html));

        let tiny = dir.join("tiny.pdf");
        std::fs::write(&tiny, b"%PD").unwrap();
        assert!(!is_pdf_on_disk(&tiny));

        assert!(!is_pdf_on_disk(&dir), "a directory is not a document");
        assert!(!is_pdf_on_disk(&dir.join("absent.pdf")));

        // No `.part` file is left behind once the rename lands.
        let leftovers: Vec<_> = std::fs::read_dir(&dir)
            .unwrap()
            .flatten()
            .filter(|e| e.file_name().to_string_lossy().ends_with(".part"))
            .collect();
        assert!(
            leftovers.is_empty(),
            "temp files must not survive a successful write"
        );

        std::fs::remove_dir_all(&dir).ok();
    }

    /// The real download path, minus the Tauri plumbing.
    ///
    /// Ignored by default because it needs a server. Everything `fetch_and_store` does
    /// apart from emitting progress events is exercised here, for **both** documents: a
    /// question paper never arrives alone, so the pair is what gets asserted.
    ///
    ///   cd src-tauri
    ///   BELL_API_BASE=http://localhost:3000 cargo test -- --ignored --nocapture
    #[test]
    #[ignore = "needs a running catalogue server; set BELL_API_BASE"]
    fn downloads_a_paper_with_its_mark_scheme() {
        let base = catalog::api_base();
        let dir = std::env::temp_dir().join(format!("bell-dl-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let conn = crate::db::open(&dir.join("index.sqlite3")).unwrap();

        // Any catalogued id will do; this one is a real Maths paper.
        let paper_id = 6124i64;
        let client = reqwest::blocking::Client::builder()
            .user_agent(catalog::USER_AGENT)
            .build()
            .expect("client");

        let mut written_paths = Vec::new();
        for (kind, file) in [("qp", "9709_s15_qp_11.pdf"), ("ms", "9709_s15_ms_11.pdf")] {
            let url = format!("{base}/api/desktop/v1/file/{paper_id}/{kind}");
            eprintln!("fetching {url}");
            let res = client.get(&url).send().expect("request");
            assert!(
                res.status().is_success(),
                "{kind} status was {}",
                res.status()
            );
            let bytes = res.bytes().expect("body").to_vec();
            assert!(
                bytes.len() > 5 && &bytes[..5] == b"%PDF-",
                "{kind} was not a PDF"
            );
            eprintln!("  {kind}: {} bytes", bytes.len());

            let target = dir
                .join("library")
                .join("A Level")
                .join("Mathematics (9709)");
            let written = write_atomically(&target, file, &bytes).unwrap();
            assert!(is_pdf_on_disk(&written));

            // Before the row exists the bytes are on disk but unreachable.
            let as_text = written.to_string_lossy().to_string();
            assert!(crate::library::read_downloaded(&conn, &as_text).is_err());

            record(&conn, paper_id, kind, &written, bytes.len() as u64).unwrap();
            let read_back = crate::library::read_downloaded(&conn, &as_text).unwrap();
            assert_eq!(read_back.len(), bytes.len());
            written_paths.push(written);
        }

        // Two documents, one paper: the primary key is (paper_id, kind), so both coexist.
        let rows: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM download WHERE paper_id = ?1",
                [paper_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(rows, 2, "a question paper and its mark scheme");

        // Re-recording must not violate UNIQUE(path).
        record(&conn, paper_id, "qp", &written_paths[0], 1).unwrap();
        let again: i64 = conn
            .query_row("SELECT COUNT(*) FROM download", [], |r| r.get(0))
            .unwrap();
        assert_eq!(again, 2);

        // And both sit side by side in one folder, which is why the per-kind subfolders
        // the web app's own downloader uses were dropped.
        assert_eq!(written_paths[0].parent(), written_paths[1].parent());

        std::fs::remove_dir_all(&dir).ok();
    }
}
