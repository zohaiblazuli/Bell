//! Parsing the `G:\CambridgeDatabase` tree. Everything we need is in the path:
//!
//! ```text
//! <Level>\<Subject> (<code>)\<Year>\<Season> (<scode>)\<DocType>\<code>_<scode>_<type>[_<variant>].pdf
//! A Level\Accounting (9706)\2015\May-June (s15)\Grade Thresholds\9706_s15_gt.pdf
//! ```

/// Only these three roots are part of the library; anything else under `G:\` is ignored.
pub const LEVELS: [&str; 3] = ["A Level", "IGCSE", "O Level"];

/// Canonical casing for a level directory, so the index is stable regardless of disk casing.
pub fn canonical_level(dir: &str) -> Option<&'static str> {
    LEVELS.iter().copied().find(|l| l.eq_ignore_ascii_case(dir))
}

/// Split a `Name (suffix)` directory into its two halves.
fn split_parenthesised(dir: &str) -> Option<(&str, &str)> {
    let trimmed = dir.trim();
    let close = trimmed.strip_suffix(')')?;
    let open = close.rfind('(')?;
    let name = close[..open].trim();
    let inner = close[open + 1..].trim();
    if name.is_empty() || inner.is_empty() {
        return None;
    }
    Some((name, inner))
}

/// `Accounting (9706)` -> `("Accounting", "9706")`
pub fn parse_subject_dir(dir: &str) -> Option<(String, String)> {
    let (name, code) = split_parenthesised(dir)?;
    if !is_subject_code(code) {
        return None;
    }
    Some((name.to_string(), code.to_string()))
}

/// `May-June (s15)` -> `("May-June", "s15")`
pub fn parse_season_dir(dir: &str) -> Option<(String, String)> {
    let (season, scode) = split_parenthesised(dir)?;
    let scode = normalise_scode(scode)?;
    Some((season.to_string(), scode))
}

/// Subject codes are always four digits (9706, 0580, ...).
pub fn is_subject_code(s: &str) -> bool {
    s.len() == 4 && s.bytes().all(|b| b.is_ascii_digit())
}

/// `s`=May/June, `w`=Oct/Nov, `m`=Feb/March, followed by a two-digit year. Lowercased.
pub fn normalise_scode(s: &str) -> Option<String> {
    let s = s.trim();
    if s.len() != 3 {
        return None;
    }
    let mut it = s.chars();
    let season = it.next()?.to_ascii_lowercase();
    if !matches!(season, 's' | 'w' | 'm') {
        return None;
    }
    let rest: String = it.collect();
    if rest.len() != 2 || !rest.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    Some(format!("{season}{rest}"))
}

/// Full year for a session code: `s15` -> 2015, `w99` -> 1999.
pub fn scode_year(scode: &str) -> Option<i64> {
    let yy: i64 = scode.get(1..3)?.parse().ok()?;
    Some(if yy >= 80 { 1900 + yy } else { 2000 + yy })
}

#[derive(Debug, PartialEq, Eq)]
pub struct ParsedFile {
    pub code: String,
    pub scode: String,
    pub doc_type: String,
    pub variant: Option<String>,
}

/// `9709_s15_qp_12.pdf` -> code 9709, scode s15, type qp, variant 12.
/// Tolerant on purpose: an unexpected shape returns `None` and is counted as skipped rather
/// than guessed at.
pub fn parse_file_name(file_name: &str) -> Option<ParsedFile> {
    let stem = file_name
        .strip_suffix(".pdf")
        .or_else(|| file_name.strip_suffix(".PDF"))
        .or_else(|| {
            let lower = file_name.to_ascii_lowercase();
            lower.ends_with(".pdf").then(|| &file_name[..file_name.len() - 4])
        })?;

    let parts: Vec<&str> = stem.split('_').filter(|p| !p.is_empty()).collect();
    if parts.len() < 3 {
        return None;
    }
    let code = parts[0];
    if !is_subject_code(code) {
        return None;
    }
    let scode = normalise_scode(parts[1])?;

    // The doc type is the first purely-alphabetic segment after the session code; anything
    // after it is the paper/variant.
    let type_at = (2..parts.len()).find(|&i| parts[i].bytes().all(|b| b.is_ascii_alphabetic()))?;
    let doc_type = parts[type_at].to_ascii_lowercase();
    let tail: Vec<&str> = parts[type_at + 1..].to_vec();
    let variant = if tail.is_empty() { None } else { Some(tail.join("_")) };

    Some(ParsedFile { code: code.to_string(), scode, doc_type, variant })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_real_paths() {
        assert_eq!(
            parse_subject_dir("Accounting (9706)"),
            Some(("Accounting".into(), "9706".into()))
        );
        assert_eq!(
            parse_subject_dir("Mathematics - Further (9231)"),
            Some(("Mathematics - Further".into(), "9231".into()))
        );
        assert_eq!(parse_subject_dir("Grade Thresholds"), None);

        assert_eq!(parse_season_dir("May-June (s15)"), Some(("May-June".into(), "s15".into())));
        assert_eq!(parse_season_dir("Oct-Nov (w22)"), Some(("Oct-Nov".into(), "w22".into())));
        assert_eq!(parse_season_dir("Feb-March (m19)"), Some(("Feb-March".into(), "m19".into())));

        assert_eq!(scode_year("s15"), Some(2015));
        assert_eq!(scode_year("w99"), Some(1999));
    }

    #[test]
    fn parses_file_names() {
        let qp = parse_file_name("9709_s15_qp_12.pdf").unwrap();
        assert_eq!(qp.doc_type, "qp");
        assert_eq!(qp.variant.as_deref(), Some("12"));

        let gt = parse_file_name("9706_s15_gt.pdf").unwrap();
        assert_eq!(gt.doc_type, "gt");
        assert_eq!(gt.variant, None);

        let ms = parse_file_name("0580_w22_ms_42.PDF").unwrap();
        assert_eq!(ms.code, "0580");
        assert_eq!(ms.scode, "w22");
        assert_eq!(ms.doc_type, "ms");
        assert_eq!(ms.variant.as_deref(), Some("42"));

        assert!(parse_file_name("readme.txt").is_none());
        assert!(parse_file_name("9709_s15.pdf").is_none());
    }
}
