//! Read queries over the cached catalogue, plus the sandboxed document reader.
//!
//! Every paper in the catalogue is listed here whether or not its PDF has been
//! downloaded — that is the substantive change from the folder-scanning era, where a
//! paper only existed if a file did. "Downloaded" is now a property of a row
//! (`qpPath` present), not a precondition for having one.

use rusqlite::{Connection, OptionalExtension};
use serde::Serialize;
use std::collections::HashMap;
use tauri::State;

use crate::db::{get_meta, Db};
use crate::paths;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryStats {
    pub subjects: i64,
    pub sessions: i64,
    pub papers: i64,
    /// Files on this machine, question papers and mark schemes counted separately.
    pub downloads: i64,
    /// What those files take up. Summed from the recorded sizes rather than walked, so this
    /// costs one aggregate instead of a stat() per file.
    pub download_bytes: i64,
    pub levels: Vec<LevelCount>,
    /// Epoch ms; formatted in the webview so no date handling lives in Rust.
    pub synced_at_ms: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LevelCount {
    pub level: String,
    pub subjects: i64,
    pub papers: i64,
}

#[tauri::command]
pub fn library_stats(db: State<'_, Db>) -> Result<LibraryStats, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let one = |sql: &str| -> Result<i64, String> {
        conn.query_row(sql, [], |r| r.get(0)).map_err(|e| e.to_string())
    };

    let mut levels = Vec::new();
    {
        let mut st = conn
            .prepare(
                "SELECT su.qualification, COUNT(DISTINCT su.id), COUNT(p.id)
                 FROM catalog_subject su
                 LEFT JOIN catalog_paper p ON p.subject_id = su.id
                 GROUP BY su.qualification",
            )
            .map_err(|e| e.to_string())?;
        let rows = st
            .query_map([], |r| {
                let qualification: String = r.get(0)?;
                Ok(LevelCount {
                    level: paths::level_label(&qualification).to_string(),
                    subjects: r.get(1)?,
                    papers: r.get(2)?,
                })
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            levels.push(row.map_err(|e| e.to_string())?);
        }
    }
    levels.sort_by(|a, b| a.level.cmp(&b.level));

    Ok(LibraryStats {
        subjects: one("SELECT COUNT(*) FROM catalog_subject")?,
        sessions: one("SELECT COUNT(*) FROM catalog_session")?,
        papers: one("SELECT COUNT(*) FROM catalog_paper")?,
        downloads: one("SELECT COUNT(*) FROM download")?,
        download_bytes: one("SELECT COALESCE(SUM(size),0) FROM download")?,
        levels,
        synced_at_ms: get_meta(&conn, "catalog_synced_at").and_then(|v| v.parse().ok()),
    })
}

/// Papers per sitting, keyed `9701/s25`.
///
/// The Dashboard's coverage matrix needs a denominator: without one a cell can only
/// say "you have done some of this sitting", never "all of it". Now that the
/// catalogue is authoritative this is the *true* number of papers in a sitting,
/// rather than however many happened to be on disk — so coverage stops flattering.
#[tauri::command]
pub fn sitting_totals(db: State<'_, Db>) -> Result<HashMap<String, i64>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    count_sittings(&conn)
}

pub fn count_sittings(conn: &Connection) -> Result<HashMap<String, i64>, String> {
    let mut st = conn
        .prepare(
            "SELECT su.code || '/' || se.code, COUNT(*)
             FROM catalog_paper p
             JOIN catalog_subject su ON su.id = p.subject_id
             JOIN catalog_session se ON se.id = p.session_id
             GROUP BY 1",
        )
        .map_err(|e| e.to_string())?;
    let rows = st
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))
        .map_err(|e| e.to_string())?;
    let mut out = HashMap::new();
    for row in rows {
        let (key, n) = row.map_err(|e| e.to_string())?;
        out.insert(key, n);
    }
    Ok(out)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Subject {
    pub id: i64,
    pub level: String,
    pub qualification: String,
    pub code: String,
    pub name: String,
    pub slug: String,
    pub sessions: i64,
    pub papers: i64,
    pub downloaded: i64,
    pub first_year: Option<i64>,
    pub last_year: Option<i64>,
}

/// `level` accepts either the display label ("A Level") or the enum ("a_level").
#[tauri::command]
pub fn list_subjects(db: State<'_, Db>, level: Option<String>) -> Result<Vec<Subject>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    query_subjects(&conn, level)
}

pub fn query_subjects(conn: &Connection, level: Option<String>) -> Result<Vec<Subject>, String> {
    let qualification = match level.as_deref() {
        None => None,
        Some(raw) => match paths::qualification_from_label(raw) {
            Some(q) => Some(q.to_string()),
            // An unrecognised filter should show nothing, not everything.
            None => return Ok(Vec::new()),
        },
    };

    let mut st = conn
        .prepare(
            "SELECT su.id, su.qualification, su.code, su.name, su.slug,
                    COUNT(DISTINCT p.session_id),
                    COUNT(p.id),
                    COUNT(d.paper_id),
                    MIN(se.year), MAX(se.year)
             FROM catalog_subject su
             LEFT JOIN catalog_paper p   ON p.subject_id = su.id
             LEFT JOIN catalog_session se ON se.id = p.session_id
             LEFT JOIN download d         ON d.paper_id = p.id AND d.kind = 'qp'
             WHERE (?1 IS NULL OR su.qualification = ?1)
             GROUP BY su.id
             ORDER BY su.qualification, su.name",
        )
        .map_err(|e| e.to_string())?;
    let rows = st
        .query_map([qualification], |r| {
            let qualification: String = r.get(1)?;
            Ok(Subject {
                id: r.get(0)?,
                level: paths::level_label(&qualification).to_string(),
                qualification,
                code: r.get(2)?,
                name: r.get(3)?,
                slug: r.get(4)?,
                sessions: r.get(5)?,
                papers: r.get(6)?,
                downloaded: r.get(7)?,
                first_year: r.get(8)?,
                last_year: r.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// One row per paper in the catalogue.
///
/// `qpPath` / `msPath` are present only when that file is on this machine, so the
/// reader's existing "is there a path?" guards keep working — they now mean "has it
/// been downloaded" rather than "is it in the folder". `hasMs` is separate on purpose:
/// it distinguishes *no mark scheme exists* from *not fetched yet*.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaperRow {
    /// Remote catalogue id — stable across syncs, and what the download API takes.
    pub id: i64,
    pub subject_id: i64,
    pub subject_code: String,
    pub subject_name: String,
    pub qualification: String,
    /// Display label for `qualification`, e.g. "A Level".
    pub level: String,
    pub year: i64,
    pub scode: String,
    /// Upstream enum: may_june | oct_nov | feb_mar. Labelled in the webview.
    pub season: String,
    /// Two-digit component, e.g. "12". Third part of the paper key.
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
    /// 0-100, higher = harder. Computed upstream; never recomputed here.
    pub hardness_score: Option<i64>,
    pub difficulty: Option<String>,
    pub difficulty_basis: Option<String>,
    pub difficulty_note: Option<String>,
    pub has_ms: bool,
    pub qp_path: Option<String>,
    pub ms_path: Option<String>,
}

const PAPER_SELECT: &str = "
SELECT p.id, p.subject_id, su.code, su.name, su.qualification,
       se.year, se.code, se.season,
       p.component, p.paper_number, p.variant,
       p.total_marks, p.a_threshold, p.b_threshold, p.c_threshold, p.d_threshold, p.e_threshold,
       p.a_pct, p.curve_mean_pct, p.span_pct,
       p.hardness_score, p.difficulty, p.difficulty_basis, p.difficulty_note, p.has_ms,
       dq.path, dm.path
FROM catalog_paper p
JOIN catalog_subject su  ON su.id = p.subject_id
JOIN catalog_session se  ON se.id = p.session_id
LEFT JOIN download dq    ON dq.paper_id = p.id AND dq.kind = 'qp'
LEFT JOIN download dm    ON dm.paper_id = p.id AND dm.kind = 'ms'
";

const PAPER_ORDER: &str = " ORDER BY se.year DESC, se.code DESC, su.name, p.component ";

fn map_paper(r: &rusqlite::Row) -> rusqlite::Result<PaperRow> {
    let qualification: String = r.get(4)?;
    Ok(PaperRow {
        id: r.get(0)?,
        subject_id: r.get(1)?,
        subject_code: r.get(2)?,
        subject_name: r.get(3)?,
        // Borrowed before the move below; struct fields evaluate in written order.
        level: paths::level_label(&qualification).to_string(),
        qualification,
        year: r.get(5)?,
        scode: r.get(6)?,
        season: r.get(7)?,
        component: r.get(8)?,
        paper_number: r.get(9)?,
        variant: r.get(10)?,
        total_marks: r.get(11)?,
        a_threshold: r.get(12)?,
        b_threshold: r.get(13)?,
        c_threshold: r.get(14)?,
        d_threshold: r.get(15)?,
        e_threshold: r.get(16)?,
        a_pct: r.get(17)?,
        curve_mean_pct: r.get(18)?,
        span_pct: r.get(19)?,
        hardness_score: r.get(20)?,
        difficulty: r.get(21)?,
        difficulty_basis: r.get(22)?,
        difficulty_note: r.get(23)?,
        has_ms: r.get::<_, i64>(24)? != 0,
        qp_path: r.get(25)?,
        ms_path: r.get(26)?,
    })
}

/// Resolve an optional level filter to a qualification enum.
///
/// An unrecognised value returns `None` inside `Some`, meaning "match nothing" —
/// showing the whole catalogue when a filter fails to parse would be worse.
fn filter_qualification(level: Option<String>) -> Result<Option<String>, ()> {
    match level.as_deref() {
        None => Ok(None),
        Some(raw) => paths::qualification_from_label(raw)
            .map(|q| Some(q.to_string()))
            .ok_or(()),
    }
}

#[tauri::command]
pub fn list_papers(
    db: State<'_, Db>,
    subject_id: Option<i64>,
    level: Option<String>,
    scode: Option<String>,
    downloaded_only: Option<bool>,
    limit: Option<i64>,
) -> Result<Vec<PaperRow>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    query_papers(&conn, subject_id, level, scode, downloaded_only, limit)
}

pub fn query_papers(
    conn: &Connection,
    subject_id: Option<i64>,
    level: Option<String>,
    scode: Option<String>,
    downloaded_only: Option<bool>,
    limit: Option<i64>,
) -> Result<Vec<PaperRow>, String> {
    let Ok(qualification) = filter_qualification(level) else {
        return Ok(Vec::new());
    };

    let sql = format!(
        "{PAPER_SELECT}
         WHERE (?1 IS NULL OR p.subject_id = ?1)
           AND (?2 IS NULL OR su.qualification = ?2)
           AND (?3 IS NULL OR se.code = ?3)
           AND (?4 = 0 OR dq.path IS NOT NULL)
         {PAPER_ORDER}
         LIMIT ?5"
    );

    let mut st = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = st
        .query_map(
            rusqlite::params![
                subject_id,
                qualification,
                scode,
                if downloaded_only.unwrap_or(false) { 1 } else { 0 },
                // The whole catalogue is ~2.6k rows, so the default lets everything
                // through: the Library now lists papers that are not on disk too.
                limit.unwrap_or(4000)
            ],
            map_paper,
        )
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Free-text search for the ⌘K palette.
///
/// Every whitespace-separated token must match somewhere in the paper's searchable
/// text, so `9709 s24 12` and `maths w23` both narrow the way you would expect.
/// Still a LIKE scan rather than FTS5: the catalogue is ~2.6k rows, which is fewer
/// than the folder-scanning version had to cope with.
#[tauri::command]
pub fn search_papers(
    db: State<'_, Db>,
    query: String,
    limit: Option<i64>,
) -> Result<Vec<PaperRow>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    search_catalog(&conn, &query, limit)
}

pub fn search_catalog(
    conn: &Connection,
    query: &str,
    limit: Option<i64>,
) -> Result<Vec<PaperRow>, String> {
    // A blank query is the palette's resting state; it shows recents instead.
    let tokens: Vec<String> = query
        .split_whitespace()
        .take(8)
        .map(|t| format!("%{}%", t.to_lowercase()))
        .collect();
    if tokens.is_empty() {
        return Ok(Vec::new());
    }

    // `replace(qualification,'_',' ')` is what lets "a level" match `a_level`.
    const HAY: &str = "lower(su.code||' '||su.name||' '||replace(su.qualification,'_',' ')||' '\
                       ||se.code||' '||p.component||' '||se.year||' '||se.season)";
    let clauses = tokens
        .iter()
        .enumerate()
        .map(|(i, _)| format!("{HAY} LIKE ?{}", i + 1))
        .collect::<Vec<_>>()
        .join(" AND ");

    let sql = format!(
        "{PAPER_SELECT} WHERE {clauses} {PAPER_ORDER} LIMIT ?{}",
        tokens.len() + 1
    );

    let mut params: Vec<Box<dyn rusqlite::ToSql>> = tokens
        .iter()
        .map(|t| Box::new(t.clone()) as Box<dyn rusqlite::ToSql>)
        .collect();
    params.push(Box::new(limit.unwrap_or(12)));

    let mut st = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = st
        .query_map(
            rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())),
            map_paper,
        )
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Resolve a subject `code` (with an optional level) to its catalogue id.
///
/// Codes are unique across the catalogue in practice, but the level narrows it in
/// case a code is ever reused across qualifications.
#[tauri::command]
pub fn find_subject(
    db: State<'_, Db>,
    code: String,
    level: Option<String>,
) -> Result<Option<i64>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let Ok(qualification) = filter_qualification(level) else {
        return Ok(None);
    };
    conn.query_row(
        "SELECT id FROM catalog_subject
         WHERE code = ?1 AND (?2 IS NULL OR qualification = ?2) LIMIT 1",
        rusqlite::params![code, qualification],
        |r| r.get(0),
    )
    .optional()
    .map_err(|e| e.to_string())
}

/// Read one downloaded PDF's bytes for the webview.
///
/// The path must be recorded in `download`, which only ever names files this app has
/// itself fetched and validated. That check *is* the sandbox: there is no path glob
/// to get subtly wrong, and nothing else on the disk is reachable. Do not replace it
/// with the asset protocol.
#[tauri::command]
pub fn read_document(db: State<'_, Db>, path: String) -> Result<tauri::ipc::Response, String> {
    let bytes = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        read_downloaded(&conn, &path)?
    };
    Ok(tauri::ipc::Response::new(bytes))
}

pub fn read_downloaded(conn: &Connection, path: &str) -> Result<Vec<u8>, String> {
    let known: i64 = conn
        .query_row("SELECT COUNT(*) FROM download WHERE path = ?1", [path], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if known == 0 {
        return Err(format!("not a downloaded paper: {path}"));
    }
    std::fs::read(path).map_err(|e| format!("{path}: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalog::{replace_catalog, ApiCatalog, ApiPaper, ApiSession, ApiSubject};
    use crate::{db, downloads};
    use std::path::{Path, PathBuf};

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "bell-{tag}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn paper(id: i64, subject_id: i64, session_id: i64, component: &str, scored: bool) -> ApiPaper {
        ApiPaper {
            id,
            subject_id,
            session_id,
            component: component.to_string(),
            paper_number: component[0..1].parse().unwrap(),
            variant: component[1..2].parse().unwrap(),
            total_marks: Some(75),
            a_threshold: Some(60),
            b_threshold: Some(51),
            c_threshold: Some(41),
            d_threshold: Some(31),
            e_threshold: Some(21),
            a_pct: Some(80.0),
            curve_mean_pct: Some(54.4),
            span_pct: Some(52.0),
            hardness_score: scored.then_some(71),
            difficulty: scored.then(|| "hard".to_string()),
            difficulty_basis: scored.then(|| "component".to_string()),
            difficulty_note: scored.then(|| "An A needed 80.0% of the marks.".to_string()),
            has_ms: true,
        }
    }

    /// Two subjects, two sittings, three papers — one of them deliberately unscored,
    /// because the catalogue includes papers whose thresholds were never parsed.
    fn sample() -> ApiCatalog {
        ApiCatalog {
            version: 1,
            generated_at: "2026-07-29T16:26:35.419Z".into(),
            subjects: vec![
                ApiSubject {
                    id: 65,
                    code: "9709".into(),
                    name: "Mathematics".into(),
                    slug: "mathematics".into(),
                    qualification: "a_level".into(),
                    board: "caie".into(),
                },
                ApiSubject {
                    id: 70,
                    code: "0610".into(),
                    name: "Biology".into(),
                    slug: "biology".into(),
                    qualification: "igcse".into(),
                    board: "caie".into(),
                },
            ],
            sessions: vec![
                ApiSession { id: 1, code: "s24".into(), year: 2024, season: "may_june".into() },
                ApiSession { id: 2, code: "w23".into(), year: 2023, season: "oct_nov".into() },
            ],
            papers: vec![
                paper(9001, 65, 1, "12", true),
                paper(9002, 65, 2, "12", false),
                paper(9003, 70, 1, "42", true),
            ],
        }
    }

    fn fixture(tag: &str) -> (PathBuf, Connection) {
        let dir = temp_dir(tag);
        let mut conn = db::open(&dir.join("index.sqlite3")).unwrap();
        replace_catalog(&mut conn, &sample()).unwrap();
        (dir, conn)
    }

    /// Write a valid PDF where a real download would land, and return that path.
    fn place_pdf(root: &Path, conn: &Connection, paper_id: i64, kind: &str) -> PathBuf {
        let (qualification, name, code, year, season, scode, component): (
            String,
            String,
            String,
            i64,
            String,
            String,
            String,
        ) = conn
            .query_row(
                "SELECT su.qualification, su.name, su.code, se.year, se.season, se.code, p.component
                 FROM catalog_paper p
                 JOIN catalog_subject su ON su.id = p.subject_id
                 JOIN catalog_session se ON se.id = p.session_id
                 WHERE p.id = ?1",
                [paper_id],
                |r| {
                    Ok((
                        r.get(0)?,
                        r.get(1)?,
                        r.get(2)?,
                        r.get(3)?,
                        r.get(4)?,
                        r.get(5)?,
                        r.get(6)?,
                    ))
                },
            )
            .unwrap();
        let dir = root.join(paths::paper_dir(
            &qualification,
            &name,
            &code,
            year,
            &season,
            &scode,
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join(paths::paper_file_name(&code, &scode, kind, &component));
        std::fs::write(&path, b"%PDF-1.4\ntest\n").unwrap();
        path
    }

    #[test]
    fn lists_every_catalogue_paper_downloaded_or_not() {
        let (dir, conn) = fixture("list");

        let papers = query_papers(&conn, None, None, None, None, None).unwrap();
        assert_eq!(papers.len(), 3, "nothing is on disk, yet every paper is listed");
        assert_eq!(papers[0].year, 2024, "newest sitting first");
        assert!(papers.iter().all(|p| p.qp_path.is_none()));
        assert!(papers.iter().all(|p| p.has_ms), "the catalogue says a mark scheme exists");

        let maths = papers.iter().find(|p| p.id == 9001).unwrap();
        assert_eq!(maths.component, "12");
        assert_eq!(maths.paper_number, 1);
        assert_eq!(maths.variant, 2);
        assert_eq!(maths.level, "A Level");
        assert_eq!(maths.qualification, "a_level");
        assert_eq!(maths.season, "may_june");
        assert_eq!(maths.difficulty.as_deref(), Some("hard"));
        assert_eq!(maths.hardness_score, Some(71));
        assert_eq!(maths.a_pct, Some(80.0));

        // An unscored paper still appears; it simply has no rating to show.
        let unscored = papers.iter().find(|p| p.id == 9002).unwrap();
        assert!(unscored.difficulty.is_none());
        assert!(unscored.hardness_score.is_none());
        assert!(unscored.difficulty_note.is_none());

        // Filters
        assert_eq!(query_papers(&conn, None, Some("IGCSE".into()), None, None, None).unwrap().len(), 1);
        assert_eq!(query_papers(&conn, None, Some("igcse".into()), None, None, None).unwrap().len(), 1);
        assert_eq!(query_papers(&conn, None, None, Some("w23".into()), None, None).unwrap().len(), 1);
        assert_eq!(query_papers(&conn, Some(65), None, None, None, None).unwrap().len(), 2);
        // A filter we cannot parse must match nothing rather than everything.
        assert!(query_papers(&conn, None, Some("A-Level".into()), None, None, None).unwrap().is_empty());

        let subjects = query_subjects(&conn, None).unwrap();
        assert_eq!(subjects.len(), 2);
        let maths = subjects.iter().find(|s| s.code == "9709").unwrap();
        assert_eq!(maths.papers, 2);
        assert_eq!(maths.downloaded, 0);
        assert_eq!(maths.first_year, Some(2023));
        assert_eq!(maths.last_year, Some(2024));

        // The coverage denominator is the catalogue's count, not a file count.
        let totals = count_sittings(&conn).unwrap();
        assert_eq!(totals.get("9709/s24"), Some(&1));
        assert_eq!(totals.get("0610/s24"), Some(&1));

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_resync_keeps_downloads() {
        let (dir, mut conn) = fixture("resync");
        let root = dir.join("library");
        let qp = place_pdf(&root, &conn, 9001, "qp");
        let ms = place_pdf(&root, &conn, 9001, "ms");
        downloads::repair_into(&mut conn, &root).unwrap();

        let before = query_papers(&conn, Some(65), None, Some("s24".into()), None, None).unwrap();
        assert_eq!(before.len(), 1);
        assert_eq!(before[0].qp_path.as_deref(), Some(qp.to_string_lossy().as_ref()));
        assert_eq!(before[0].ms_path.as_deref(), Some(ms.to_string_lossy().as_ref()));

        // The downloaded-only filter is what the Library's chip drives.
        assert_eq!(query_papers(&conn, None, None, None, Some(true), None).unwrap().len(), 1);
        assert_eq!(query_subjects(&conn, None).unwrap().iter().find(|s| s.code == "9709").unwrap().downloaded, 1);

        // Re-syncing replaces the catalogue wholesale. Under the old folder-walking
        // schema that wiped every derived table; now it must leave download records
        // — and therefore the user's files — completely alone. This is the inverse of
        // the assertion the previous test suite pinned, and the reason `clear_catalog`
        // exists instead of `clear_index`.
        replace_catalog(&mut conn, &sample()).unwrap();

        let after = query_papers(&conn, Some(65), None, Some("s24".into()), None, None).unwrap();
        assert_eq!(after.len(), 1);
        assert_eq!(after[0].qp_path.as_deref(), Some(qp.to_string_lossy().as_ref()));
        assert_eq!(after[0].ms_path.as_deref(), Some(ms.to_string_lossy().as_ref()));
        assert_eq!(after[0].difficulty.as_deref(), Some("hard"), "difficulty comes back with the catalogue");
        assert!(qp.exists() && ms.exists(), "the files themselves are untouched");

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn repair_links_what_is_on_disk_and_prunes_what_is_not() {
        let (dir, mut conn) = fixture("repair");
        let root = dir.join("library");
        let qp = place_pdf(&root, &conn, 9001, "qp");

        // Something that is not a paper, and something that looks like one but isn't
        // in the catalogue — both must be ignored rather than guessed at.
        std::fs::write(root.join("notes.txt"), b"ignore me").unwrap();
        let stray = qp.parent().unwrap().join("9709_s24_qp_99.pdf");
        std::fs::write(&stray, b"%PDF-1.4\n").unwrap();

        let first = downloads::repair_into(&mut conn, &root).unwrap();
        assert_eq!(first.linked, 1, "only the catalogued paper links");
        assert_eq!(first.unmatched, 1, "the stray component 99 does not");
        assert_eq!(first.scanned, 2, "the .txt is not even scanned as a candidate");
        assert_eq!(first.pruned, 0);

        // A user deleting a PDF by hand must not leave the app claiming to have it,
        // because that row is what authorises a read.
        std::fs::remove_file(&qp).unwrap();
        let second = downloads::repair_into(&mut conn, &root).unwrap();
        assert_eq!(second.pruned, 1);
        assert_eq!(second.linked, 0);
        assert!(query_papers(&conn, None, None, None, Some(true), None).unwrap().is_empty());

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn searches_by_code_subject_session_and_level() {
        let (dir, conn) = fixture("search");

        let hits = search_catalog(&conn, "9709 s24", None).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].component, "12");

        assert_eq!(search_catalog(&conn, "mathematics", None).unwrap().len(), 2);
        assert_eq!(search_catalog(&conn, "MATHEMATICS w23", None).unwrap().len(), 1);
        assert_eq!(search_catalog(&conn, "biology", None).unwrap().len(), 1);
        // `a level` has to match the stored `a_level`, hence the replace() in HAY.
        assert_eq!(search_catalog(&conn, "a level", None).unwrap().len(), 2);
        assert_eq!(search_catalog(&conn, "igcse 2024", None).unwrap().len(), 1);
        assert_eq!(search_catalog(&conn, "mathematics biology", None).unwrap().len(), 0);
        assert!(search_catalog(&conn, "   ", None).unwrap().is_empty());
        assert_eq!(search_catalog(&conn, "mathematics", Some(1)).unwrap().len(), 1);

        assert_eq!(find_subject_id(&conn, "9709", None), Some(65));
        assert_eq!(find_subject_id(&conn, "9709", Some("IGCSE")), None);
        assert_eq!(find_subject_id(&conn, "0610", Some("IGCSE")), Some(70));

        std::fs::remove_dir_all(&dir).ok();
    }

    /// Test-only mirror of the `find_subject` command's query.
    fn find_subject_id(conn: &Connection, code: &str, level: Option<&str>) -> Option<i64> {
        let qualification = level.map(|l| paths::qualification_from_label(l).unwrap().to_string());
        conn.query_row(
            "SELECT id FROM catalog_subject
             WHERE code = ?1 AND (?2 IS NULL OR qualification = ?2) LIMIT 1",
            rusqlite::params![code, qualification],
            |r| r.get(0),
        )
        .optional()
        .unwrap()
    }

    #[test]
    fn only_downloaded_files_can_be_read() {
        let (dir, mut conn) = fixture("sandbox");
        let root = dir.join("library");
        let qp = place_pdf(&root, &conn, 9001, "qp");

        // Before the download is recorded the bytes are on disk but unreachable —
        // the row, not the file, is what authorises a read.
        assert!(read_downloaded(&conn, &qp.to_string_lossy()).is_err());

        downloads::repair_into(&mut conn, &root).unwrap();
        assert_eq!(read_downloaded(&conn, &qp.to_string_lossy()).unwrap(), b"%PDF-1.4\ntest\n");

        // A sibling in the same folder was never recorded, so it stays unreachable.
        let sibling = qp.parent().unwrap().join("readme.txt");
        std::fs::write(&sibling, b"secret").unwrap();
        let err = read_downloaded(&conn, &sibling.to_string_lossy()).unwrap_err();
        assert!(err.contains("not a downloaded paper"), "{err}");

        assert!(read_downloaded(&conn, r"C:\Windows\win.ini").is_err());
        assert!(read_downloaded(&conn, &dir.to_string_lossy()).is_err());

        std::fs::remove_dir_all(&dir).ok();
    }
}

