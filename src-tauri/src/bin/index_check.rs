//! Verifies the library walk against the real tree without launching the app.
//!
//!   cargo run --bin index_check -- "G:\CambridgeDatabase"
//!
//! Writes to a throwaway database in the temp dir. The source tree is only ever read.

use std::path::Path;

use bell_lib::{db, ingest};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let root = std::env::args().nth(1).unwrap_or_else(|| ingest::DEFAULT_ROOT.to_string());
    let out = std::env::temp_dir().join("bell-index-check.sqlite3");
    let _ = std::fs::remove_file(&out);
    let _ = std::fs::remove_file(out.with_extension("sqlite3-wal"));

    println!("walking {root}");
    let mut conn = db::open(&out)?;
    let report = ingest::walk_into(&mut conn, Path::new(&root), |p| {
        if p.subjects % 25 == 0 {
            println!("  {:>4} subjects … {}", p.subjects, p.current);
        }
    })
    .map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;

    println!(
        "\n{} subjects · {} sessions · {} documents · {} skipped · {:.1}s",
        report.subjects,
        report.sessions,
        report.docs,
        report.skipped,
        report.elapsed_ms as f64 / 1000.0
    );
    if !report.skipped_samples.is_empty() {
        println!("skipped samples: {:?}", report.skipped_samples);
    }

    println!("\nby level");
    let mut st = conn.prepare(
        "SELECT su.level, COUNT(DISTINCT su.id), COUNT(d.id)
         FROM subject su
         LEFT JOIN session se ON se.subject_id = su.id
         LEFT JOIN doc d      ON d.session_id  = se.id
         GROUP BY su.level ORDER BY su.level",
    )?;
    for row in st.query_map([], |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?, r.get::<_, i64>(2)?))
    })? {
        let (level, subjects, docs) = row?;
        println!("  {level:<9} {subjects:>4} subjects  {docs:>7} docs");
    }
    drop(st);

    println!("\nby document type");
    let mut st = conn.prepare(
        "SELECT doc_type, COUNT(*) FROM doc GROUP BY doc_type ORDER BY 2 DESC LIMIT 12",
    )?;
    for row in st.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))? {
        let (t, n) = row?;
        println!("  {t:<5} {n:>7}");
    }
    drop(st);

    // 9709 A-Level Maths is the reference subject for the difficulty work.
    println!("\n9709 sample (newest question papers)");
    let mut st = conn.prepare(
        "SELECT se.year, se.scode, d.variant, d.file_name
         FROM doc d JOIN session se ON se.id = d.session_id
         JOIN subject su ON su.id = se.subject_id
         WHERE su.code='9709' AND d.doc_type='qp'
         ORDER BY se.year DESC, se.scode DESC, d.variant LIMIT 8",
    )?;
    for row in st.query_map([], |r| {
        Ok((
            r.get::<_, i64>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, Option<String>>(2)?,
            r.get::<_, String>(3)?,
        ))
    })? {
        let (year, scode, variant, name) = row?;
        println!("  {year} {scode} /{}  {name}", variant.unwrap_or_else(|| "-".into()));
    }
    drop(st);

    let gt: i64 = conn.query_row("SELECT COUNT(*) FROM doc WHERE doc_type='gt'", [], |r| r.get(0))?;
    let stray: i64 = conn.query_row(
        "SELECT COUNT(*) FROM doc WHERE path NOT LIKE ?1 || '%'",
        [&root],
        |r| r.get(0),
    )?;
    println!("\ngrade-threshold PDFs: {gt}");
    println!("documents outside the root: {stray} (must be 0)");

    // Difficulty is joined on doc.variant = threshold.component, and components in the `gt`
    // PDFs are always two digits. Anything else here would silently read as "Unrated".
    println!("\nquestion-paper variant shapes (must be 2 digits to join difficulty)");
    let mut st = conn.prepare(
        "SELECT CASE WHEN variant IS NULL THEN 'null' ELSE 'len ' || LENGTH(variant) END AS shape,
                COUNT(*)
         FROM doc WHERE doc_type='qp' GROUP BY shape ORDER BY 2 DESC",
    )?;
    for row in st.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))? {
        let (shape, n) = row?;
        println!("  {shape:<8} {n:>7}");
    }
    drop(st);

    println!("\nthrowaway index at {}", out.display());
    Ok(())
}
