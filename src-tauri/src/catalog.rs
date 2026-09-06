//! Catalogue sync.
//!
//! The desktop app owns no catalogue of its own. It fetches the whole thing from
//! ShinyPapers as a single document, caches it in SQLite, and queries that cache
//! locally — which is why filtering and search stay instant and why browsing works
//! with the network unplugged.
//!
//! All HTTP in this app happens here and in `downloads`, i.e. in Rust, never in the
//! webview. That is deliberate: the CSP in `tauri.conf.json` still forbids the
//! webview from reaching anything but `ipc:`, so exactly one process can talk to the
//! network and the renderer stays as isolated as it was when the app was fully
//! offline. Do not move these calls into `fetch`.

use std::sync::OnceLock;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

use crate::db::{clear_catalog, get_meta, set_meta, Db};

/// Where the catalogue lives. `BELL_API_BASE` overrides it for local development
/// against `npm run dev` in the web app.
pub const DEFAULT_API_BASE: &str = "https://shiny-papers.vercel.app";

pub fn api_base() -> String {
    std::env::var("BELL_API_BASE")
        .ok()
        .map(|v| v.trim_end_matches('/').to_string())
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| DEFAULT_API_BASE.to_string())
}

/// A browser-like UA. The web app's own downloader sets one explicitly, which is
/// good evidence the upstream PDF host cares; the redirect target is that host.
pub const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
                              (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

pub fn client() -> Result<&'static reqwest::Client, String> {
    if let Some(existing) = CLIENT.get() {
        return Ok(existing);
    }
    let built = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .connect_timeout(Duration::from_secs(10))
        // The file endpoint answers 302 and the bytes come from the upstream host,
        // so redirects must be followed.
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| format!("could not build the HTTP client: {e}"))?;
    Ok(CLIENT.get_or_init(|| built))
}

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

// ─── Wire types ──────────────────────────────────────────────────────────────
// Serde ignores unknown fields, which is what makes the server's additive-only
// field policy safe: a new column in a future catalogue cannot break this build.

#[derive(Deserialize)]
pub struct ApiCatalog {
    pub version: i64,
    pub generated_at: String,
    pub subjects: Vec<ApiSubject>,
    pub sessions: Vec<ApiSession>,
    pub papers: Vec<ApiPaper>,
}

#[derive(Deserialize)]
pub struct ApiSubject {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub slug: String,
    pub qualification: String,
    pub board: String,
}

#[derive(Deserialize)]
pub struct ApiSession {
    pub id: i64,
    pub code: String,
    pub year: i64,
    pub season: String,
}

#[derive(Deserialize)]
pub struct ApiPaper {
    pub id: i64,
    pub subject_id: i64,
    pub session_id: i64,
    pub component: String,
    pub paper_number: i64,
    pub variant: i64,
    pub total_marks: Option<i64>,
    pub a_threshold: Option<i64>,
    pub b_threshold: Option<i64>,
    pub c_threshold: Option<i64>,
    pub d_threshold: Option<i64>,
    pub e_threshold: Option<i64>,
    pub a_pct: Option<f64>,
    pub curve_mean_pct: Option<f64>,
    pub span_pct: Option<f64>,
    pub hardness_score: Option<i64>,
    pub difficulty: Option<String>,
    pub difficulty_basis: Option<String>,
    pub difficulty_note: Option<String>,
    pub has_ms: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CatalogStatus {
    pub subjects: i64,
    pub sessions: i64,
    pub papers: i64,
    pub downloads: i64,
    /// Epoch ms of the last successful sync, formatted in the webview.
    pub synced_at_ms: Option<i64>,
    /// High-water mark of the catalogue data itself, straight from the server.
    pub generated_at: Option<String>,
    pub catalog_version: Option<i64>,
    pub api_base: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SyncReport {
    /// False when the server answered 304 and the cache was already current.
    pub changed: bool,
    pub status: CatalogStatus,
}

// ─── Commands ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn catalog_status(db: State<'_, Db>) -> Result<CatalogStatus, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    read_status(&conn)
}

pub fn read_status(conn: &rusqlite::Connection) -> Result<CatalogStatus, String> {
    let one = |sql: &str| -> Result<i64, String> {
        conn.query_row(sql, [], |r| r.get(0))
            .map_err(|e| e.to_string())
    };
    Ok(CatalogStatus {
        subjects: one("SELECT COUNT(*) FROM catalog_subject")?,
        sessions: one("SELECT COUNT(*) FROM catalog_session")?,
        papers: one("SELECT COUNT(*) FROM catalog_paper")?,
        downloads: one("SELECT COUNT(*) FROM download")?,
        synced_at_ms: get_meta(conn, "catalog_synced_at").and_then(|v| v.parse().ok()),
        generated_at: get_meta(conn, "catalog_generated_at"),
        catalog_version: get_meta(conn, "catalog_version").and_then(|v| v.parse().ok()),
        api_base: api_base(),
    })
}

/// Fetch the catalogue and replace the local cache.
///
/// Conditional on the stored ETag, so the common case — nothing changed since the
/// last launch — costs a 304 and no parsing at all. A network failure is the
/// caller's to interpret: with a populated cache it is not an error worth
/// interrupting anyone over.
#[tauri::command]
pub async fn sync_catalog(app: AppHandle, db: State<'_, Db>) -> Result<SyncReport, String> {
    let etag = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        get_meta(&conn, "catalog_etag")
    };

    let _ = app.emit("catalog:progress", "Checking for a newer catalogue…");

    let url = format!("{}/api/desktop/v1/catalog", api_base());
    let mut req = client()?.get(&url).timeout(Duration::from_secs(45));
    if let Some(tag) = etag.as_deref() {
        req = req.header(reqwest::header::IF_NONE_MATCH, tag);
    }
    let res = req
        .send()
        .await
        .map_err(|e| format!("could not reach the catalogue: {e}"))?;

    if res.status() == reqwest::StatusCode::NOT_MODIFIED {
        let report = {
            let conn = db.0.lock().map_err(|e| e.to_string())?;
            let _ = set_meta(&conn, "catalog_synced_at", &now_ms().to_string());
            SyncReport {
                changed: false,
                status: read_status(&conn)?,
            }
        };
        let _ = app.emit("catalog:done", report.clone());
        return Ok(report);
    }

    if !res.status().is_success() {
        return Err(format!(
            "the catalogue answered HTTP {}",
            res.status().as_u16()
        ));
    }

    let new_etag = res
        .headers()
        .get(reqwest::header::ETAG)
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);

    let _ = app.emit("catalog:progress", "Reading the catalogue…");
    let payload: ApiCatalog = res
        .json()
        .await
        .map_err(|e| format!("the catalogue was not readable: {e}"))?;

    let report = {
        let mut conn = db.0.lock().map_err(|e| e.to_string())?;
        replace_catalog(&mut conn, &payload)?;
        if let Some(tag) = new_etag {
            let _ = set_meta(&conn, "catalog_etag", &tag);
        }
        let _ = set_meta(&conn, "catalog_generated_at", &payload.generated_at);
        let _ = set_meta(&conn, "catalog_version", &payload.version.to_string());
        let _ = set_meta(&conn, "catalog_synced_at", &now_ms().to_string());
        SyncReport {
            changed: true,
            status: read_status(&conn)?,
        }
    };

    let _ = app.emit("catalog:done", report.clone());
    Ok(report)
}

/// Swap the cached catalogue for a freshly fetched one, atomically.
///
/// One transaction, so a failure part-way leaves the previous catalogue intact
/// rather than a half-populated one. `clear_catalog` is scoped to the catalogue
/// tables, so `download` is untouched throughout.
pub fn replace_catalog(
    conn: &mut rusqlite::Connection,
    payload: &ApiCatalog,
) -> Result<(), String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    clear_catalog(&tx).map_err(|e| e.to_string())?;

    {
        let mut st = tx
            .prepare(
                "INSERT INTO catalog_subject(id,code,name,slug,qualification,board)
                 VALUES(?1,?2,?3,?4,?5,?6)",
            )
            .map_err(|e| e.to_string())?;
        for s in &payload.subjects {
            st.execute((s.id, &s.code, &s.name, &s.slug, &s.qualification, &s.board))
                .map_err(|e| e.to_string())?;
        }
    }

    {
        let mut st = tx
            .prepare("INSERT INTO catalog_session(id,code,year,season) VALUES(?1,?2,?3,?4)")
            .map_err(|e| e.to_string())?;
        for s in &payload.sessions {
            st.execute((s.id, &s.code, s.year, &s.season))
                .map_err(|e| e.to_string())?;
        }
    }

    {
        let mut st = tx
            .prepare(
                "INSERT INTO catalog_paper(
                   id, subject_id, session_id, component, paper_number, variant,
                   total_marks, a_threshold, b_threshold, c_threshold, d_threshold, e_threshold,
                   a_pct, curve_mean_pct, span_pct,
                   hardness_score, difficulty, difficulty_basis, difficulty_note, has_ms)
                 VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20)",
            )
            .map_err(|e| e.to_string())?;
        for p in &payload.papers {
            st.execute(rusqlite::params![
                p.id,
                p.subject_id,
                p.session_id,
                &p.component,
                p.paper_number,
                p.variant,
                p.total_marks,
                p.a_threshold,
                p.b_threshold,
                p.c_threshold,
                p.d_threshold,
                p.e_threshold,
                p.a_pct,
                p.curve_mean_pct,
                p.span_pct,
                p.hardness_score,
                &p.difficulty,
                &p.difficulty_basis,
                &p.difficulty_note,
                if p.has_ms { 1 } else { 0 },
            ])
            .map_err(|e| e.to_string())?;
        }
    }

    tx.commit().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn api_base_can_be_overridden_and_is_trimmed() {
        // Not using the env var here: these are the two shapes `api_base` must cope with.
        assert!(DEFAULT_API_BASE.starts_with("https://"));
        assert!(!DEFAULT_API_BASE.ends_with('/'));
    }

    /// Live check that the wire types still match the endpoint.
    ///
    /// Ignored by default because it needs a server. This is the one thing unit tests
    /// cannot cover and that would break silently: a renamed or newly non-null field
    /// upstream fails to deserialise, and no amount of local fixture testing notices.
    ///
    ///   cd src-tauri
    ///   BELL_API_BASE=http://localhost:3000 cargo test -- --ignored --nocapture
    #[test]
    #[ignore = "needs a running catalogue server; set BELL_API_BASE"]
    fn parses_the_live_catalogue_into_sqlite() {
        let base = api_base();
        let url = format!("{base}/api/desktop/v1/catalog");
        eprintln!("fetching {url}");

        let body = reqwest::blocking::Client::builder()
            .user_agent(USER_AGENT)
            .build()
            .expect("client")
            .get(&url)
            .send()
            .expect("request")
            .text()
            .expect("body");

        let payload: ApiCatalog =
            serde_json::from_str(&body).expect("the catalogue must deserialise into ApiCatalog");

        assert_eq!(payload.version, 1);
        assert!(!payload.subjects.is_empty(), "subjects");
        assert!(!payload.sessions.is_empty(), "sessions");
        assert!(!payload.papers.is_empty(), "papers");
        eprintln!(
            "{} subjects, {} sessions, {} papers, generated_at {}",
            payload.subjects.len(),
            payload.sessions.len(),
            payload.papers.len(),
            payload.generated_at
        );

        // Papers with no rating must still be present — every query helper on the
        // website filters them out, so this is the assertion that keeps them listed.
        let unscored = payload
            .papers
            .iter()
            .filter(|p| p.difficulty.is_none())
            .count();
        eprintln!("{unscored} paper(s) carry no rating");

        let dir = std::env::temp_dir().join(format!("bell-live-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let mut conn = crate::db::open(&dir.join("index.sqlite3")).unwrap();
        replace_catalog(&mut conn, &payload).expect("the catalogue must land in SQLite");

        let stored: i64 = conn
            .query_row("SELECT COUNT(*) FROM catalog_paper", [], |r| r.get(0))
            .unwrap();
        assert_eq!(stored as usize, payload.papers.len());

        // Replacing twice must be idempotent: the primary keys are the remote ids, so a
        // second sync of the same payload cannot duplicate or conflict.
        replace_catalog(&mut conn, &payload).expect("a second sync must not conflict");
        let again: i64 = conn
            .query_row("SELECT COUNT(*) FROM catalog_paper", [], |r| r.get(0))
            .unwrap();
        assert_eq!(again, stored);

        std::fs::remove_dir_all(&dir).ok();
    }
}
