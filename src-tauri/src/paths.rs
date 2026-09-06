//! Path and identifier helpers.
//!
//! With the local folder walk gone, this file has two jobs: build the tree that
//! downloads land in, and parse a filename back out of it so `downloads::repair` can
//! rebuild the download table if the database is ever lost or its schema bumped.
//!
//! ```text
//! <Level>\<Subject> (<code>)\<Year>\<Season> (<scode>)\<code>_<scode>_<kind>_<component>.pdf
//! A Level\Mathematics (9709)\2016\Feb-Mar (m16)\9709_m16_qp_62.pdf
//! ```
//!
//! Filenames are byte-identical to the upstream basename, which is what makes the
//! round-trip lossless. Unlike the old scheme there is no per-kind subfolder: the
//! name already says `qp` or `ms`, and splitting them separated two files a reader
//! always wants side by side.

/// Display labels for the three qualifications, in the order the UI lists them.
pub const LEVELS: [&str; 3] = ["A Level", "IGCSE", "O Level"];

/// `a_level` -> `A Level`. The catalogue stores the enum; screens show the label.
pub fn level_label(qualification: &str) -> &'static str {
    match qualification {
        "igcse" => "IGCSE",
        "o_level" => "O Level",
        _ => "A Level",
    }
}

/// `A Level` -> `a_level`. Accepts either form so a caller can pass the label the
/// filter chips already use, or the enum, without caring which it holds.
pub fn qualification_from_label(level: &str) -> Option<&'static str> {
    match level.trim().to_ascii_lowercase().as_str() {
        "a level" | "a_level" => Some("a_level"),
        "igcse" => Some("igcse"),
        "o level" | "o_level" => Some("o_level"),
        _ => None,
    }
}

/// Folder-safe season name. `/` cannot appear in a path, so disk uses a hyphen
/// where the UI shows a slash: `May/June` on screen, `May-June` on disk.
pub fn season_folder(season: &str) -> Option<&'static str> {
    match season {
        "may_june" => Some("May-June"),
        "oct_nov" => Some("Oct-Nov"),
        "feb_mar" => Some("Feb-Mar"),
        _ => None,
    }
}

/// Subject codes are always four digits (9709, 0580, ...).
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

/// Strip anything Windows refuses in a path segment, and the trailing dots and
/// spaces it silently drops. Subject names from the catalogue are already clean;
/// this is here so a new one can never produce an unopenable path.
pub fn safe_segment(value: &str) -> String {
    let mut out: String = value
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '-',
            c if (c as u32) < 0x20 => '-',
            c => c,
        })
        .collect();
    while out.ends_with('.') || out.ends_with(' ') {
        out.pop();
    }
    if out.is_empty() {
        out.push('-');
    }
    out
}

/// `9709_m16_qp_62.pdf` — identical to the upstream basename.
pub fn paper_file_name(code: &str, scode: &str, kind: &str, component: &str) -> String {
    format!("{code}_{scode}_{kind}_{component}.pdf")
}

/// The directory a paper's files live in, relative to the download root.
pub fn paper_dir(
    qualification: &str,
    subject_name: &str,
    subject_code: &str,
    year: i64,
    season: &str,
    scode: &str,
) -> std::path::PathBuf {
    let season_dir = season_folder(season).unwrap_or("Other");
    std::path::PathBuf::new()
        .join(safe_segment(level_label(qualification)))
        .join(safe_segment(&format!("{subject_name} ({subject_code})")))
        .join(year.to_string())
        .join(safe_segment(&format!("{season_dir} ({scode})")))
}

#[derive(Debug, PartialEq, Eq)]
pub struct ParsedFile {
    pub code: String,
    pub scode: String,
    pub doc_type: String,
    pub component: Option<String>,
}

/// `9709_s15_qp_12.pdf` -> code 9709, scode s15, type qp, component 12.
///
/// Tolerant on purpose: an unexpected shape returns `None` and is counted as skipped
/// rather than guessed at. Used only by `downloads::repair`, which has to be able to
/// ignore whatever else a user has dropped into the folder.
pub fn parse_file_name(file_name: &str) -> Option<ParsedFile> {
    let stem = file_name
        .strip_suffix(".pdf")
        .or_else(|| file_name.strip_suffix(".PDF"))
        .or_else(|| {
            let lower = file_name.to_ascii_lowercase();
            lower
                .ends_with(".pdf")
                .then(|| &file_name[..file_name.len() - 4])
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

    // The doc type is the first purely-alphabetic segment after the session code;
    // anything after it is the component.
    let type_at = (2..parts.len()).find(|&i| parts[i].bytes().all(|b| b.is_ascii_alphabetic()))?;
    let doc_type = parts[type_at].to_ascii_lowercase();
    let tail: Vec<&str> = parts[type_at + 1..].to_vec();
    let component = if tail.is_empty() {
        None
    } else {
        Some(tail.join("_"))
    };

    Some(ParsedFile {
        code: code.to_string(),
        scode,
        doc_type,
        component,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_qualifications_both_ways() {
        assert_eq!(level_label("a_level"), "A Level");
        assert_eq!(level_label("o_level"), "O Level");
        assert_eq!(level_label("igcse"), "IGCSE");
        for label in LEVELS {
            let qual = qualification_from_label(label).expect("every label maps back");
            assert_eq!(level_label(qual), label, "round trip for {label}");
        }
        assert_eq!(qualification_from_label("a level"), Some("a_level"));
        assert_eq!(qualification_from_label("nonsense"), None);
    }

    #[test]
    fn builds_the_download_tree() {
        let dir = paper_dir("a_level", "Mathematics", "9709", 2016, "feb_mar", "m16");
        let shown = dir.to_string_lossy().replace('/', "\\");
        assert_eq!(shown, r"A Level\Mathematics (9709)\2016\Feb-Mar (m16)");
        assert_eq!(
            paper_file_name("9709", "m16", "qp", "62"),
            "9709_m16_qp_62.pdf"
        );
        assert_eq!(season_folder("may_june"), Some("May-June"));
        assert_eq!(season_folder("nonsense"), None);
    }

    #[test]
    fn keeps_path_segments_legal() {
        assert_eq!(safe_segment("Urdu A"), "Urdu A");
        assert_eq!(safe_segment("Maths/Further"), "Maths-Further");
        assert_eq!(safe_segment("trailing. "), "trailing");
        assert_eq!(safe_segment("..."), "-");
    }

    #[test]
    fn round_trips_a_downloaded_file_name() {
        for (kind, component) in [("qp", "62"), ("ms", "01")] {
            let name = paper_file_name("9709", "m16", kind, component);
            let parsed = parse_file_name(&name).expect("a name we generated must parse");
            assert_eq!(parsed.code, "9709");
            assert_eq!(parsed.scode, "m16");
            assert_eq!(parsed.doc_type, kind);
            assert_eq!(parsed.component.as_deref(), Some(component));
        }

        let ms = parse_file_name("0580_w22_ms_42.PDF").unwrap();
        assert_eq!(ms.doc_type, "ms");
        assert_eq!(ms.component.as_deref(), Some("42"));

        // A grade-threshold PDF has no component and is not a paper we download.
        assert_eq!(parse_file_name("9706_s15_gt.pdf").unwrap().component, None);

        assert!(parse_file_name("readme.txt").is_none());
        assert!(parse_file_name("9709_s15.pdf").is_none());
        assert_eq!(scode_year("s15"), Some(2015));
        assert_eq!(scode_year("w99"), Some(1999));
    }
}
