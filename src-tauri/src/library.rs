//! Read queries over the index, plus the write-back seams used by the
//! threshold parser and the difficulty engine (both of which live in the webview,
//! so the existing TypeScript can be reused as-is).

use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{get_meta, Db};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryStats {
    pub root: Option<String>,
    pub subjects: i64,
    pub sessions: i64,
    pub docs: i64,
    pub thresholds: i64,
    pub levels: Vec<LevelCount>,
    pub doc_types: Vec<TypeCount>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LevelCount {
    pub level: String,
    pub subjects: i64,
    pub docs: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TypeCount {
    pub doc_type: String,
    pub docs: i64,
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
                "SELECT s.level, COUNT(DISTINCT s.id), COUNT(d.id)
                 FROM subject s
                 LEFT JOIN session se ON se.subject_id = s.id
                 LEFT JOIN doc d      ON d.session_id  = se.id
                 GROUP BY s.level ORDER BY s.level",
            )
            .map_err(|e| e.to_string())?;
        let rows = st
            .query_map([], |r| {
                Ok(LevelCount { level: r.get(0)?, subjects: r.get(1)?, docs: r.get(2)? })
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            levels.push(row.map_err(|e| e.to_string())?);
        }
    }

    let mut doc_types = Vec::new();
    {
        let mut st = conn
            .prepare("SELECT doc_type, COUNT(*) FROM doc GROUP BY doc_type ORDER BY 2 DESC")
            .map_err(|e| e.to_string())?;
        let rows = st
            .query_map([], |r| Ok(TypeCount { doc_type: r.get(0)?, docs: r.get(1)? }))
            .map_err(|e| e.to_string())?;
        for row in rows {
            doc_types.push(row.map_err(|e| e.to_string())?);
        }
    }

    Ok(LibraryStats {
        root: get_meta(&conn, "library_root"),
        subjects: one("SELECT COUNT(*) FROM subject")?,
        sessions: one("SELECT COUNT(*) FROM session")?,
        docs: one("SELECT COUNT(*) FROM doc")?,
        thresholds: one("SELECT COUNT(*) FROM threshold")?,
        levels,
        doc_types,
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Subject {
    pub id: i64,
    pub level: String,
    pub code: String,
    pub name: String,
    pub sessions: i64,
    pub papers: i64,
    pub first_year: Option<i64>,
    pub last_year: Option<i64>,
}

#[tauri::command]
pub fn list_subjects(db: State<'_, Db>, level: Option<String>) -> Result<Vec<Subject>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    query_subjects(&conn, level)
}

pub fn query_subjects(conn: &Connection, level: Option<String>) -> Result<Vec<Subject>, String> {
    let mut st = conn
        .prepare(
            "SELECT s.id, s.level, s.code, s.name,
                    COUNT(DISTINCT se.id),
                    COUNT(DISTINCT CASE WHEN d.doc_type='qp' THEN se.scode||'/'||COALESCE(d.variant,'-') END),
                    MIN(se.year), MAX(se.year)
             FROM subject s
             LEFT JOIN session se ON se.subject_id = s.id
             LEFT JOIN doc d      ON d.session_id  = se.id
             WHERE (?1 IS NULL OR s.level = ?1)
             GROUP BY s.id ORDER BY s.level, s.name",
        )
        .map_err(|e| e.to_string())?;
    let rows = st
        .query_map([level], |r| {
            Ok(Subject {
                id: r.get(0)?,
                level: r.get(1)?,
                code: r.get(2)?,
                name: r.get(3)?,
                sessions: r.get(4)?,
                papers: r.get(5)?,
                first_year: r.get(6)?,
                last_year: r.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaperRow {
    pub subject_id: i64,
    pub subject_code: String,
    pub subject_name: String,
    pub level: String,
    pub year: i64,
    pub scode: String,
    pub season: String,
    pub variant: Option<String>,
    pub qp_path: Option<String>,
    pub ms_path: Option<String>,
    pub er_path: Option<String>,
    pub difficulty: Option<f64>,
    pub band: Option<String>,
}

/// One row per question paper (subject + session + variant), newest first.
#[tauri::command]
pub fn list_papers(
    db: State<'_, Db>,
    subject_id: Option<i64>,
    level: Option<String>,
    scode: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<PaperRow>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    query_papers(&conn, subject_id, level, scode, limit)
}

pub fn query_papers(
    conn: &Connection,
    subject_id: Option<i64>,
    level: Option<String>,
    scode: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<PaperRow>, String> {
    let mut st = conn
        .prepare(
            "SELECT su.id, su.code, su.name, su.level, se.year, se.scode, se.season, d.variant,
                    MAX(CASE WHEN d.doc_type='qp' THEN d.path END),
                    MAX(CASE WHEN d.doc_type='ms' THEN d.path END),
                    MAX(CASE WHEN d.doc_type='er' THEN d.path END),
                    di.score, di.band
             FROM doc d
             JOIN session se ON se.id = d.session_id
             JOIN subject su ON su.id = se.subject_id
             LEFT JOIN difficulty di
                    ON di.subject_id = su.id AND di.scode = se.scode
                   AND di.component = COALESCE(d.variant,'')
             WHERE d.doc_type IN ('qp','ms','er')
               AND (?1 IS NULL OR su.id    = ?1)
               AND (?2 IS NULL OR su.level = ?2)
               AND (?3 IS NULL OR se.scode = ?3)
             GROUP BY su.id, se.scode, d.variant
             HAVING MAX(CASE WHEN d.doc_type='qp' THEN 1 ELSE 0 END) = 1
             ORDER BY se.year DESC, se.scode DESC, su.name, d.variant
             LIMIT ?4",
        )
        .map_err(|e| e.to_string())?;
    let rows = st
        .query_map(
            rusqlite::params![subject_id, level, scode, limit.unwrap_or(500)],
            |r| {
                Ok(PaperRow {
                    subject_id: r.get(0)?,
                    subject_code: r.get(1)?,
                    subject_name: r.get(2)?,
                    level: r.get(3)?,
                    year: r.get(4)?,
                    scode: r.get(5)?,
                    season: r.get(6)?,
                    variant: r.get(7)?,
                    qp_path: r.get(8)?,
                    ms_path: r.get(9)?,
                    er_path: r.get(10)?,
                    difficulty: r.get(11)?,
                    band: r.get(12)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Threshold + difficulty seams. The `gt` PDFs are parsed in the webview with
// pdf.js (reusing scambridge's parser), then written back here.
// ---------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GtDoc {
    pub subject_id: i64,
    pub subject_code: String,
    pub level: String,
    pub scode: String,
    pub path: String,
}

/// Every grade-threshold PDF in the index, optionally only those not yet parsed.
#[tauri::command]
pub fn list_threshold_docs(
    db: State<'_, Db>,
    unparsed_only: Option<bool>,
    limit: Option<i64>,
) -> Result<Vec<GtDoc>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    query_threshold_docs(&conn, unparsed_only, limit)
}

pub fn query_threshold_docs(
    conn: &Connection,
    unparsed_only: Option<bool>,
    limit: Option<i64>,
) -> Result<Vec<GtDoc>, String> {
    let mut st = conn
        .prepare(
            "SELECT su.id, su.code, su.level, se.scode, d.path
             FROM doc d
             JOIN session se ON se.id = d.session_id
             JOIN subject su ON su.id = se.subject_id
             WHERE d.doc_type = 'gt'
               AND (?1 = 0 OR NOT EXISTS (
                     SELECT 1 FROM threshold t
                      WHERE t.subject_id = su.id AND t.scode = se.scode))
             ORDER BY se.year DESC, su.code
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;
    let rows = st
        .query_map(
            rusqlite::params![
                if unparsed_only.unwrap_or(false) { 1 } else { 0 },
                limit.unwrap_or(100_000)
            ],
            |r| {
                Ok(GtDoc {
                    subject_id: r.get(0)?,
                    subject_code: r.get(1)?,
                    level: r.get(2)?,
                    scode: r.get(3)?,
                    path: r.get(4)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThresholdRow {
    pub subject_id: i64,
    pub scode: String,
    pub component: String,
    pub max_mark: Option<i64>,
    pub grade: String,
    pub mark: i64,
}

#[tauri::command]
pub fn save_thresholds(db: State<'_, Db>, rows: Vec<ThresholdRow>) -> Result<usize, String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    insert_thresholds(&mut conn, &rows)
}

pub fn insert_thresholds(conn: &mut Connection, rows: &[ThresholdRow]) -> Result<usize, String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut n = 0usize;
    {
        let mut st = tx
            .prepare(
                "INSERT INTO threshold(subject_id,scode,component,max_mark,grade,mark)
                 VALUES(?1,?2,?3,?4,?5,?6)
                 ON CONFLICT(subject_id,scode,component,grade)
                 DO UPDATE SET mark=excluded.mark, max_mark=excluded.max_mark",
            )
            .map_err(|e| e.to_string())?;
        for r in rows {
            st.execute((r.subject_id, &r.scode, &r.component, r.max_mark, &r.grade, r.mark))
                .map_err(|e| e.to_string())?;
            n += 1;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(n)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThresholdOut {
    pub component: String,
    pub max_mark: Option<i64>,
    pub grade: String,
    pub mark: i64,
    pub scode: String,
}

#[tauri::command]
pub fn get_thresholds(
    db: State<'_, Db>,
    subject_id: i64,
    scode: Option<String>,
) -> Result<Vec<ThresholdOut>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    query_thresholds(&conn, subject_id, scode)
}

pub fn query_thresholds(
    conn: &Connection,
    subject_id: i64,
    scode: Option<String>,
) -> Result<Vec<ThresholdOut>, String> {
    let mut st = conn
        .prepare(
            "SELECT component, max_mark, grade, mark, scode FROM threshold
             WHERE subject_id = ?1 AND (?2 IS NULL OR scode = ?2)
             ORDER BY scode, component, grade",
        )
        .map_err(|e| e.to_string())?;
    let rows = st
        .query_map(rusqlite::params![subject_id, scode], |r| {
            Ok(ThresholdOut {
                component: r.get(0)?,
                max_mark: r.get(1)?,
                grade: r.get(2)?,
                mark: r.get(3)?,
                scode: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DifficultyRow {
    pub subject_id: i64,
    pub scode: String,
    pub component: String,
    pub score: f64,
    pub band: String,
    pub sample: i64,
}

#[tauri::command]
pub fn save_difficulty(db: State<'_, Db>, rows: Vec<DifficultyRow>) -> Result<usize, String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    insert_difficulty(&mut conn, &rows)
}

pub fn insert_difficulty(conn: &mut Connection, rows: &[DifficultyRow]) -> Result<usize, String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut n = 0usize;
    {
        let mut st = tx
            .prepare(
                "INSERT INTO difficulty(subject_id,scode,component,score,band,sample)
                 VALUES(?1,?2,?3,?4,?5,?6)
                 ON CONFLICT(subject_id,scode,component)
                 DO UPDATE SET score=excluded.score, band=excluded.band, sample=excluded.sample",
            )
            .map_err(|e| e.to_string())?;
        for r in rows {
            st.execute((r.subject_id, &r.scode, &r.component, r.score, &r.band, r.sample))
                .map_err(|e| e.to_string())?;
            n += 1;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(n)
}

/// Resolve `level` + subject `code` to the indexed subject id.
#[tauri::command]
pub fn find_subject(
    db: State<'_, Db>,
    code: String,
    level: Option<String>,
) -> Result<Option<i64>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id FROM subject WHERE code = ?1 AND (?2 IS NULL OR level = ?2) LIMIT 1",
        rusqlite::params![code, level],
        |r| r.get(0),
    )
    .optional()
    .map_err(|e| e.to_string())
}

/// Read one PDF's bytes for the webview (pdf.js, and later the paper viewer).
///
/// The path must already be in the index, which only ever holds files found under the three
/// level directories of the configured library root. That check *is* the sandbox: there is no
/// path glob to get subtly wrong, and nothing outside the library is reachable. Read-only —
/// the library is never written to.
#[tauri::command]
pub fn read_document(db: State<'_, Db>, path: String) -> Result<tauri::ipc::Response, String> {
    let bytes = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        read_indexed(&conn, &path)?
    };
    Ok(tauri::ipc::Response::new(bytes))
}

pub fn read_indexed(conn: &Connection, path: &str) -> Result<Vec<u8>, String> {
    let known: i64 = conn
        .query_row("SELECT COUNT(*) FROM doc WHERE path = ?1", [path], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if known == 0 {
        return Err(format!("not in the library index: {path}"));
    }
    std::fs::read(path).map_err(|e| format!("{path}: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{db, ingest};
    use std::path::{Path, PathBuf};

    /// A miniature copy of the real tree's shape, including two directories that must be ignored.
    fn fixture() -> (PathBuf, Connection) {
        let root = std::env::temp_dir().join(format!(
            "foolscap-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let files = [
            r"A Level\Mathematics (9709)\2024\May-June (s24)\Question Papers\9709_s24_qp_12.pdf",
            r"A Level\Mathematics (9709)\2024\May-June (s24)\Mark Schemes\9709_s24_ms_12.pdf",
            r"A Level\Mathematics (9709)\2024\May-June (s24)\Grade Thresholds\9709_s24_gt.pdf",
            r"A Level\Mathematics (9709)\2023\Oct-Nov (w23)\Question Papers\9709_w23_qp_12.pdf",
            r"IGCSE\Biology (0610)\2024\May-June (s24)\Question Papers\0610_s24_qp_42.pdf",
            // ignored: not one of the three levels
            r"caie\scraped\9709_s24_qp_99.pdf",
            // ignored: not a PDF
            r"A Level\Mathematics (9709)\2024\May-June (s24)\Question Papers\readme.txt",
        ];
        for rel in files {
            let path = root.join(rel);
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(&path, b"%PDF-1.4\n").unwrap();
        }
        let conn = db::open(&root.join("index.sqlite3")).unwrap();
        (root, conn)
    }

    fn walk(root: &Path, conn: &mut Connection) -> ingest::IngestReport {
        ingest::walk_into(conn, root, |_| {}).unwrap()
    }

    #[test]
    fn indexes_only_the_three_levels() {
        let (root, mut conn) = fixture();
        let report = walk(&root, &mut conn);

        assert_eq!(report.docs, 5, "the caie/ and .txt entries must not be indexed");
        assert_eq!(report.subjects, 2);
        assert_eq!(report.sessions, 3);
        assert_eq!(report.skipped, 0);

        let subjects = query_subjects(&conn, None).unwrap();
        assert_eq!(subjects.len(), 2);
        let maths = subjects.iter().find(|s| s.code == "9709").unwrap();
        assert_eq!(maths.name, "Mathematics");
        assert_eq!(maths.level, "A Level");
        assert_eq!(maths.papers, 2, "two question papers across two sittings");
        assert_eq!(maths.first_year, Some(2023));
        assert_eq!(maths.last_year, Some(2024));

        assert_eq!(query_subjects(&conn, Some("IGCSE".into())).unwrap().len(), 1);
        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn lists_question_papers_newest_first_with_siblings() {
        let (root, mut conn) = fixture();
        walk(&root, &mut conn);

        let papers = query_papers(&conn, None, None, None, None).unwrap();
        assert_eq!(papers.len(), 3, "one row per qp; the ms and gt fold into their row");
        assert_eq!(papers[0].year, 2024, "newest sitting first");

        let s24 = papers
            .iter()
            .find(|p| p.subject_code == "9709" && p.scode == "s24")
            .expect("9709 s24 must be listed");
        assert_eq!(s24.variant.as_deref(), Some("12"));
        assert_eq!(s24.season, "May-June");
        assert!(s24.qp_path.as_ref().unwrap().ends_with("9709_s24_qp_12.pdf"));
        assert!(s24.ms_path.as_ref().unwrap().ends_with("9709_s24_ms_12.pdf"));
        assert!(s24.er_path.is_none());
        assert!(s24.difficulty.is_none(), "unscored until thresholds are parsed");

        // A grade-threshold PDF is not a paper and must never appear as one.
        assert!(!papers.iter().any(|p| p.qp_path.as_deref().unwrap_or("").contains("_gt")));

        let igcse = query_papers(&conn, None, Some("IGCSE".into()), None, None).unwrap();
        assert_eq!(igcse.len(), 1);
        assert_eq!(igcse[0].subject_code, "0610");

        let by_session = query_papers(&conn, None, None, Some("w23".into()), None).unwrap();
        assert_eq!(by_session.len(), 1);
        assert_eq!(by_session[0].year, 2023);
        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn thresholds_and_difficulty_reach_the_paper_row() {
        let (root, mut conn) = fixture();
        walk(&root, &mut conn);

        let gts = query_threshold_docs(&conn, Some(true), None).unwrap();
        assert_eq!(gts.len(), 1, "only 9709 s24 has a gt PDF in the fixture");
        let gt = &gts[0];
        assert_eq!(gt.scode, "s24");

        insert_thresholds(
            &mut conn,
            &[
                ThresholdRow {
                    subject_id: gt.subject_id,
                    scode: "s24".into(),
                    component: "12".into(),
                    max_mark: Some(75),
                    grade: "A".into(),
                    mark: 62,
                },
                ThresholdRow {
                    subject_id: gt.subject_id,
                    scode: "s24".into(),
                    component: "12".into(),
                    max_mark: Some(75),
                    grade: "B".into(),
                    mark: 53,
                },
            ],
        )
        .unwrap();

        assert!(
            query_threshold_docs(&conn, Some(true), None).unwrap().is_empty(),
            "a parsed session must drop out of the unparsed queue"
        );
        assert_eq!(query_thresholds(&conn, gt.subject_id, None).unwrap().len(), 2);

        insert_difficulty(
            &mut conn,
            &[DifficultyRow {
                subject_id: gt.subject_id,
                scode: "s24".into(),
                component: "12".into(),
                score: 71.0,
                band: "hard".into(),
                sample: 9,
            }],
        )
        .unwrap();

        // The join is doc.variant -> difficulty.component; this is what makes the meter light up.
        let papers = query_papers(&conn, Some(gt.subject_id), None, Some("s24".into()), None).unwrap();
        assert_eq!(papers.len(), 1);
        assert_eq!(papers[0].difficulty, Some(71.0));
        assert_eq!(papers[0].band.as_deref(), Some("hard"));

        // Re-walking rebuilds the index from scratch, so derived data goes with it: a reindex
        // must always be followed by a recompute. Pinning that here so it can't drift silently.
        let again = walk(&root, &mut conn);
        assert_eq!(again.docs, 5);
        let after = query_papers(&conn, None, None, None, None).unwrap();
        assert_eq!(after.len(), 3, "no duplicate rows after a second walk");
        assert!(after.iter().all(|p| p.difficulty.is_none()));
        assert!(query_thresholds(&conn, gt.subject_id, None).unwrap().is_empty());
        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn only_indexed_files_can_be_read() {
        let (root, mut conn) = fixture();
        walk(&root, &mut conn);

        let papers = query_papers(&conn, None, None, None, None).unwrap();
        let qp = papers[0].qp_path.clone().unwrap();
        assert_eq!(read_indexed(&conn, &qp).unwrap(), b"%PDF-1.4\n");

        // The .txt and the caie/ file were never indexed, so they are unreachable even though
        // they sit right next to indexed files on disk.
        let sibling = Path::new(&qp).parent().unwrap().join("readme.txt");
        let err = read_indexed(&conn, &sibling.to_string_lossy()).unwrap_err();
        assert!(err.contains("not in the library index"), "{err}");

        let outside = root.join(r"caie\scraped\9709_s24_qp_99.pdf");
        assert!(read_indexed(&conn, &outside.to_string_lossy()).is_err());
        assert!(read_indexed(&conn, r"C:\Windows\win.ini").is_err());
        std::fs::remove_dir_all(&root).ok();
    }
}
