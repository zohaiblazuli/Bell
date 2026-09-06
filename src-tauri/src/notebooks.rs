//! Notebooks: the shelf, one directory per notebook, and lazy per-page files.
//!
//! Deliberately not in `state.rs`. `state_load` slurps **every** `*.json` in the state dir into
//! memory before the first render — that is what keeps `store.ts`'s accessors synchronous — and one
//! measured ink file is already 66,673 bytes for a single page. `state_save` is text-only too, so
//! images would have to be base64 inside JSON. Notebooks therefore get their own directory, their
//! own commands, and pages that are read one spread at a time.
//!
//!     <app_data_dir>\notebooks\
//!       index.json            the shelf, cached — rebuildable, see `list`
//!       <id>\meta.json        the authored fields; THE SOURCE OF TRUTH
//!       <id>\history.json     the undo stack, so Ctrl+Z survives a relaunch
//!       <id>\pages\NNNN.json  written only once the page has content
//!       <id>\assets\<sha>.png content-addressed, so the same clip pasted twice stores once
//!
//! `src/lib/notebooks.ts` is the contract for every type, command name and argument name here, and
//! `page_count_from_max_index` is a port of its `pageCountFromMaxIndex` so the two halves cannot
//! drift on the one number both of them print.
//!
//! **The name the student types never reaches a path.** It lives inside `meta.json` only; every
//! path is addressed by an app-generated `^[a-z0-9]{16}$` id that `valid_id` checks on the way in.
//! That is the guarantee `state::key_path` gives the state dir, reached from the other direction —
//! restricting what a caller may *name* rather than escaping what it hands over.
//!
//! The `#[tauri::command]` wrappers at the foot of the file are thin on purpose: everything real
//! takes a `&Path` root the way `state::reset_into` does, so the tests need no Tauri app handle.

use std::fmt::Write as _;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::State;

use crate::catalog::now_ms;

pub struct NotebookDir(pub PathBuf);

const INDEX_FILE: &str = "index.json";

/// Pages are addressed by a four-digit stem (`pageStem` in the contract), so 9999 is the highest
/// index the format can express. A fifth digit would write a file the page scanner ignores, and a
/// page that does not count towards the total is a worse answer than a refused save.
const MAX_PAGE_INDEX: u32 = 9999;

/// A clip arrives as a JSON array of numbers — roughly four bytes of IPC per byte of image — so the
/// practical ceiling is felt long before this one. It is here to stop a single mis-aimed paste (a
/// screenshot of a 4K desktop is ~12 MB of PNG) from writing hundreds of megabytes into a notebook,
/// not to be a tight budget.
const MAX_ASSET_BYTES: usize = 24 * 1024 * 1024;

const PNG_MAGIC: [u8; 8] = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

/// Spec §6c's `paper` card. Validated on write only — see `read_meta`.
const PAPER_STYLES: [&str; 4] = ["blank", "ruled", "grid", "dotted"];

const ID_ALPHABET: &[u8; 36] = b"0123456789abcdefghijklmnopqrstuvwxyz";

// ─── The authored record ─────────────────────────────────────────────────────

/// The linked syllabus, e.g. `{ code: '9702', name: 'Physics' }`. Codes, not catalogue ids: a
/// resync replaces `catalog_*` wholesale and would orphan an id.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NbSubject {
    pub code: String,
    pub name: String,
}

/// What the student chose. Everything else about a notebook is derived or stamped here.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NbAuthored {
    pub name: String,
    /// A cover swatch, 1…8. Mode-invariant: a cover is an object, not chrome.
    pub cover: u8,
    /// A `Subject Icon` code, the literal `bell`, or none. Never an asset sha.
    pub sticker: Option<String>,
    pub paper: String,
    /// Spec §6c's `Margin rule` switch.
    pub margin: bool,
    pub subject: Option<NbSubject>,
}

/// The authored record plus the fields only this module stamps.
///
/// `authored` is flattened so `meta.json` is one flat object — which is what `NbMeta extends
/// NbAuthored` means on the TypeScript side, and what lets the shelf cache hold whole rows.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NbMeta {
    pub id: String,
    /// Epoch ms.
    pub created_at: i64,
    pub updated_at: i64,
    #[serde(flatten)]
    pub authored: NbAuthored,
}

/// A shelf row: the stored record plus the two fields only the filesystem can answer.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NbEntry {
    #[serde(flatten)]
    pub meta: NbMeta,
    /// Derived, never stored — see `page_count_from_max_index`.
    pub pages: u32,
    /// Bytes on disk, pages and assets together. Spec §6c prints this as "On this device".
    pub bytes: u64,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NbStat {
    pub pages: u32,
    pub bytes: u64,
    pub assets: u32,
}

// ─── Guards ──────────────────────────────────────────────────────────────────

/// `^[a-z0-9]{16}$`, the same guard `isNbId` applies in the contract.
///
/// Ids are generated here rather than typed, so the charset can be *closed* instead of escaped —
/// there is no separator, no dot and nothing Windows reserves inside it, which is what makes
/// `root.join(id)` safe to say once. Every command that takes an id reaches the filesystem through
/// `nb_dir`, so a crafted id is refused before a byte is read or written.
pub fn valid_id(id: &str) -> bool {
    id.len() == 16
        && id
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
}

/// `^[0-9a-f]{64}$`. An asset name is a sha256 this module wrote, so the same closed-charset
/// argument as `valid_id` applies: nothing else can name a file under `assets\`.
fn valid_sha(sha: &str) -> bool {
    sha.len() == 64 && sha.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

/// One path segment, on the charset `state::safe_segment` allows.
///
/// Duplicated rather than shared: that copy is private, `state.rs` is not this module's to edit, and
/// widening another module's API from outside to save six lines is the worse trade. The two guard
/// different directories but must keep allowing the same characters — change one, change both.
fn safe_segment(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 120
        && name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'-' || b == b'_')
        && !name.contains("..")
}

/// The one door into a notebook's directory. Nothing here builds a path any other way.
fn nb_dir(root: &Path, id: &str) -> Result<PathBuf, String> {
    if !valid_id(id) {
        return Err(format!("bad notebook id: {id}"));
    }
    Ok(root.join(id))
}

/// Sixteen characters of `[a-z0-9]`.
///
/// splitmix64 off the clock, the process id and a process-local counter — the same hand-rolled
/// generator `db::random_hex` uses, because an id is a path segment rather than a secret and the
/// crate graph is deliberately small. **The counter is the part that matters:** `SystemTime::now`
/// resolves to 100ns on Windows, so two notebooks created inside one tick would otherwise seed the
/// generator identically and be handed the same directory name.
fn fresh_id() -> String {
    static SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0);
    let seq = SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let mut state =
        nanos ^ seq.wrapping_mul(0x9E37_79B9_7F4A_7C15) ^ ((std::process::id() as u64) << 32);
    let mut out = String::with_capacity(16);
    for _ in 0..16 {
        state = state.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = state;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^= z >> 31;
        out.push(ID_ALPHABET[(z % 36) as usize] as char);
    }
    out
}

/// Claim a directory for a new notebook and return its id.
///
/// `create_dir` rather than `exists()` then `create_dir_all`: it fails when the name is already
/// taken, so the claim *is* the test instead of following one and hoping nothing happened in
/// between. Retried a few times because a clash is possible in principle, not because it is likely.
fn claim_id(root: &Path) -> Result<String, String> {
    std::fs::create_dir_all(root).map_err(|e| format!("{}: {e}", root.display()))?;
    for _ in 0..8 {
        let id = fresh_id();
        match std::fs::create_dir(root.join(&id)) {
            Ok(()) => return Ok(id),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(format!("{}: {e}", root.join(&id).display())),
        }
    }
    Err("could not find a free notebook id".to_string())
}

// ─── Files ───────────────────────────────────────────────────────────────────

/// Write via a temporary sibling and a rename, so a crash mid-write cannot truncate saved work —
/// the pattern `state::state_save` established. The `.tmp` suffix also keeps a half-written page out
/// of `page_indices`, which counts a four-digit `.json` stem and nothing else.
fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("{}: no parent directory", path.display()))?;
    std::fs::create_dir_all(parent).map_err(|e| format!("{}: {e}", parent.display()))?;
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| format!("{}: unusable file name", path.display()))?;
    let tmp = path.with_file_name(format!("{name}.tmp"));
    std::fs::write(&tmp, bytes).map_err(|e| format!("{}: {e}", tmp.display()))?;
    if let Err(e) = std::fs::rename(&tmp, path) {
        let _ = std::fs::remove_file(&tmp);
        return Err(format!("{}: {e}", path.display()));
    }
    Ok(())
}

/// `None` for a file that was never written, which is the normal case for a fresh spread rather
/// than a failure the caller has to tell apart from a real one.
fn read_optional(path: &Path) -> Result<Option<String>, String> {
    match std::fs::read_to_string(path) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("{}: {e}", path.display())),
    }
}

/// Files and bytes directly inside `dir`; a directory that is not there yet reads as empty.
fn dir_usage(dir: &Path) -> (u32, u64) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return (0, 0);
    };
    let mut files = 0;
    let mut bytes = 0;
    for entry in entries.flatten() {
        let Ok(meta) = entry.metadata() else { continue };
        if meta.is_file() {
            files += 1;
            bytes += meta.len();
        }
    }
    (files, bytes)
}

// ─── The page arithmetic ─────────────────────────────────────────────────────

/// A page index, but only from a stem that is exactly four ASCII digits.
///
/// Anything else in `pages\` is ignored rather than rejected. A `.tmp` from an interrupted write, an
/// editor's backup, a file a curious user dropped in the folder — none of those is the page count's
/// business, and refusing to open a notebook over one would be.
fn page_index_of(stem: &str) -> Option<u32> {
    if stem.len() != 4 || !stem.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    stem.parse().ok()
}

fn page_indices(pages: &Path) -> Vec<u32> {
    let Ok(entries) = std::fs::read_dir(pages) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let index = path
            .file_stem()
            .and_then(|s| s.to_str())
            .and_then(page_index_of);
        out.extend(index);
    }
    out
}

/// `pageCountFromMaxIndex` from `src/lib/notebooks.ts`, ported so both halves work from one
/// definition instead of two that drift.
///
/// `1 + max(stem)`, with the two corrections that fall out of the spread being the unit the student
/// sees: a notebook has a whole first leaf before anything is written, and an odd count would leave
/// the last spread half a leaf. `max_index` is -1 when no page file exists at all.
///
/// Clamped at the top because the four-digit stem is the format's own ceiling — a count above 10,000
/// could only come from a file this module cannot address.
pub fn page_count_from_max_index(max_index: i64) -> u32 {
    let written = max_index
        .saturating_add(1)
        .clamp(0, i64::from(MAX_PAGE_INDEX) + 1) as u32;
    let whole = written + written % 2;
    whole.max(2)
}

/// `(pages, bytes, assets)` for one notebook directory.
///
/// `bytes` counts the page files and the assets — the notebook's content. `meta.json` and
/// `history.json` are this module's own bookkeeping, so "On this device" does not bill them.
fn usage(nb: &Path) -> (u32, u64, u32) {
    let pages_dir = nb.join("pages");
    let (_, page_bytes) = dir_usage(&pages_dir);
    let (assets, asset_bytes) = dir_usage(&nb.join("assets"));
    let highest = page_indices(&pages_dir).into_iter().max();
    let pages = page_count_from_max_index(highest.map_or(-1, i64::from));
    (pages, page_bytes + asset_bytes, assets)
}

// ─── meta.json and the cached shelf ──────────────────────────────────────────

/// Read one notebook's authored record.
///
/// The id is taken from the directory, not from the file: a `meta.json` copied between directories
/// must not make a notebook claim to be another one, because the directory is what every path is
/// built from.
///
/// `paper` and `cover` are not re-validated here. They are checked on the way in, and a stored value
/// this module would now refuse must still open the notebook it belongs to — a source of truth that
/// can lock itself out is not one.
fn read_meta(root: &Path, id: &str) -> Result<NbMeta, String> {
    let path = nb_dir(root, id)?.join("meta.json");
    let text = std::fs::read_to_string(&path).map_err(|e| format!("{}: {e}", path.display()))?;
    let mut meta: NbMeta =
        serde_json::from_str(&text).map_err(|e| format!("{}: {e}", path.display()))?;
    meta.id = id.to_string();
    Ok(meta)
}

fn write_meta(root: &Path, meta: &NbMeta) -> Result<(), String> {
    let path = nb_dir(root, &meta.id)?.join("meta.json");
    let text = serde_json::to_string_pretty(meta).map_err(|e| e.to_string())?;
    write_atomic(&path, text.as_bytes())
}

/// The cached shelf. A read that fails — missing on a first run, unparseable after a bad shutdown —
/// is not an error: `list` rebuilds it from the `meta.json` files.
fn read_index(root: &Path) -> Vec<NbMeta> {
    std::fs::read_to_string(root.join(INDEX_FILE))
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

fn write_index(root: &Path, rows: &[NbMeta]) -> Result<(), String> {
    let text = serde_json::to_string_pretty(rows).map_err(|e| e.to_string())?;
    write_atomic(&root.join(INDEX_FILE), text.as_bytes())
}

/// Refresh the cached shelf, best effort.
///
/// A failure is logged rather than returned. `index.json` is a cache `list` can rebuild from the
/// `meta.json` files, so refusing a save whose real bytes have already landed — or a shelf render
/// whose notebooks are all perfectly readable — would be the worse answer.
fn refresh_index(root: &Path, rows: &[NbMeta]) {
    if let Err(e) = write_index(root, rows) {
        eprintln!("[notebooks] {INDEX_FILE}: {e}");
    }
}

/// Put one row in the cache, replacing any earlier copy of it.
fn cache_row(root: &Path, meta: &NbMeta) {
    let mut rows = read_index(root);
    rows.retain(|r| r.id != meta.id);
    rows.push(meta.clone());
    refresh_index(root, &rows);
}

/// The cache keyed by id, for deciding whether a reconciliation actually changed anything.
fn index_shape(rows: &[NbMeta]) -> std::collections::BTreeMap<String, String> {
    rows.iter()
        .map(|r| (r.id.clone(), serde_json::to_string(r).unwrap_or_default()))
        .collect()
}

// ─── The shelf ───────────────────────────────────────────────────────────────

/// Every notebook, most recently edited first.
///
/// The cache is reconciled against the directories **both ways**: a directory holding a readable
/// `meta.json` that the index has never heard of is adopted, and an index entry whose directory has
/// gone is dropped. `index.json` is rewritten only when that changed something, so a healthy shelf
/// render writes nothing.
///
/// This is `downloads::repair`'s argument applied to files instead of rows. `meta.json` is the source
/// of truth and can be reconstructed from nothing else; `index.json` is a cache of it, so losing the
/// cache costs one directory walk rather than a notebook. Which is exactly why the walk is allowed to
/// overrule the cache and never the other way round — and why a `nb_list` that finds a hand-copied
/// notebook directory adopts it instead of ignoring it.
///
/// One asymmetry, and it is deliberate: a directory that *exists* but whose `meta.json` cannot be
/// read keeps its cached row rather than vanishing. Its pages are still on disk and the cache is the
/// only remaining record of what the notebook was called, so dropping the row would strand real work
/// where the student cannot reach it. The cache is not promoted to the truth, though — `meta.json` is
/// not rewritten from it, because inventing a source of truth during a read is how a half-deleted
/// notebook comes back.
pub fn list(root: &Path) -> Result<Vec<NbEntry>, String> {
    let cached = read_index(root);
    let mut fresh: Vec<NbMeta> = Vec::new();

    if let Ok(entries) = std::fs::read_dir(root) {
        for entry in entries.flatten() {
            if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                continue;
            }
            let Some(id) = entry.file_name().to_str().map(str::to_string) else {
                continue;
            };
            if !valid_id(&id) {
                continue;
            }
            match read_meta(root, &id) {
                Ok(meta) => fresh.push(meta),
                Err(_) => fresh.extend(cached.iter().find(|r| r.id == id).cloned()),
            }
        }
    }

    if index_shape(&fresh) != index_shape(&cached) {
        refresh_index(root, &fresh);
    }

    let mut out: Vec<NbEntry> = fresh
        .into_iter()
        .map(|meta| entry_for(root, meta))
        .collect();
    // The id breaks a tie so the order is stable: two notebooks can share a millisecond, and a shelf
    // that reshuffles between renders would read as a bug.
    out.sort_by(|a, b| {
        b.meta
            .updated_at
            .cmp(&a.meta.updated_at)
            .then_with(|| a.meta.id.cmp(&b.meta.id))
    });
    Ok(out)
}

fn entry_for(root: &Path, meta: NbMeta) -> NbEntry {
    let (pages, bytes, _) = usage(&root.join(&meta.id));
    NbEntry { meta, pages, bytes }
}

/// Validate the authored fields, identically for a create and a rename.
///
/// The trimmed name is what gets stored: a shelf tile rendering " Mechanics " with spaces nobody
/// meant to type is a papercut, and normalising at the point of storage means every later reader
/// inherits it. A rename runs the same check as a create, or the dialog's limits would only apply the
/// first time.
fn checked(mut authored: NbAuthored) -> Result<NbAuthored, String> {
    authored.name = authored.name.trim().to_string();
    let length = authored.name.chars().count();
    if !(1..=80).contains(&length) {
        return Err("a notebook needs a name of 1 to 80 characters".to_string());
    }
    if !(1..=8).contains(&authored.cover) {
        return Err(format!("cover must be 1 to 8, not {}", authored.cover));
    }
    if !PAPER_STYLES.contains(&authored.paper.as_str()) {
        return Err(format!("unknown paper style: {}", authored.paper));
    }
    Ok(authored)
}

/// A new notebook: an id, a directory, `meta.json`, and a row in the cached shelf.
///
/// Validated before the id is claimed, so a rejected create leaves nothing on disk. Both timestamps
/// come from one read of the clock, so a notebook nobody has opened reports `createdAt == updatedAt`
/// exactly rather than a millisecond apart.
pub fn create(root: &Path, authored: NbAuthored) -> Result<NbEntry, String> {
    let authored = checked(authored)?;
    let id = claim_id(root)?;
    let now = now_ms();
    let meta = NbMeta {
        id,
        created_at: now,
        updated_at: now,
        authored,
    };
    write_meta(root, &meta)?;
    cache_row(root, &meta);
    Ok(entry_for(root, meta))
}

/// Replace the authored fields of an existing notebook.
///
/// `id` and `createdAt` cannot be spoofed by the payload: the argument type is the *authored* record,
/// so serde drops them on the way in, and `createdAt` is read back from what is stored. `updatedAt`
/// is stamped here — the frontend never sets a time.
pub fn meta_save(root: &Path, id: &str, authored: NbAuthored) -> Result<NbEntry, String> {
    let authored = checked(authored)?;
    let stored = read_meta(root, id)?;
    let meta = NbMeta {
        id: stored.id,
        created_at: stored.created_at,
        updated_at: now_ms(),
        authored,
    };
    write_meta(root, &meta)?;
    cache_row(root, &meta);
    Ok(entry_for(root, meta))
}

/// The notebook, its pages, its history and its assets. Irreversible.
///
/// The directory goes before the index entry. If the cache write then fails, the next `list` drops the
/// stale row by itself; the other order would leave a directory `list` re-adopts, resurrecting a
/// notebook the student deleted.
pub fn delete(root: &Path, id: &str) -> Result<(), String> {
    let dir = nb_dir(root, id)?;
    match std::fs::remove_dir_all(&dir) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(format!("{}: {e}", dir.display())),
    }
    let mut rows = read_index(root);
    rows.retain(|r| r.id != id);
    refresh_index(root, &rows);
    Ok(())
}

/// Stamp `updatedAt` after a change to a notebook's contents.
///
/// The shelf sorts on this field and the contract calls that order "most recently edited", so ink has
/// to count — otherwise the order would only ever change when a notebook is renamed. Failures are
/// swallowed on purpose: losing a timestamp reorders a shelf, whereas returning an error once the page
/// bytes have already landed would tell the caller its drawing was lost.
fn touch(root: &Path, id: &str) {
    let Ok(mut meta) = read_meta(root, id) else {
        return;
    };
    meta.updated_at = now_ms();
    if write_meta(root, &meta).is_ok() {
        cache_row(root, &meta);
    }
}

// ─── Pages, history, assets ──────────────────────────────────────────────────

fn page_path(root: &Path, id: &str, page: u32) -> Result<PathBuf, String> {
    if page > MAX_PAGE_INDEX {
        return Err(format!(
            "page {page} is past the end of the four-digit page format"
        ));
    }
    Ok(nb_dir(root, id)?
        .join("pages")
        .join(format!("{page:04}.json")))
}

/// Refuse to write into a notebook that is not there.
///
/// **`write_atomic` creates its parent directory**, so any write arriving after a `delete` — a flush
/// still in flight when the student confirmed, say — would rebuild `<id>\` with no `meta.json` beside it.
/// `list` skips a directory it cannot read a meta from, so those bytes would be real, on disk, and
/// unreachable for ever. `meta.json` is the source of truth; this is what makes it a precondition too.
fn require_notebook(root: &Path, id: &str) -> Result<(), String> {
    if nb_dir(root, id)?.join("meta.json").exists() {
        return Ok(());
    }
    Err(format!("there is no notebook {id}"))
}

pub fn page_load(root: &Path, id: &str, page: u32) -> Result<Option<String>, String> {
    read_optional(&page_path(root, id, page)?)
}

/// Write one page, verbatim.
///
/// The JSON is the frontend's `NbPage` and is never parsed here, which is what leaves the stroke
/// format free to gain a tool or a field without a Rust release.
///
/// A page cannot exist without the notebook it belongs to — see `require_notebook`. The frontend drops
/// its pending writes before deleting; this is the half that cannot be forgotten.
pub fn page_save(root: &Path, id: &str, page: u32, json: &str) -> Result<(), String> {
    let path = page_path(root, id, page)?;
    require_notebook(root, id)?;
    write_atomic(&path, json.as_bytes())?;
    touch(root, id);
    Ok(())
}

/// Remove a page, so a page that has been erased back to nothing stops counting towards the total.
pub fn page_delete(root: &Path, id: &str, page: u32) -> Result<(), String> {
    let path = page_path(root, id, page)?;
    match std::fs::remove_file(&path) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(format!("{}: {e}", path.display())),
    }
    touch(root, id);
    Ok(())
}

/// The persisted undo stack, opaque JSON.
///
/// The command stack's shape belongs to `src/lib/ink.ts`; a Rust type mirroring it would have to be
/// revised every time a tool is added, for no gain — nothing here needs to know what an undo is.
pub fn history_load(root: &Path, id: &str) -> Result<Option<String>, String> {
    read_optional(&nb_dir(root, id)?.join("history.json"))
}

/// Does not stamp `updatedAt`: history is saved alongside the page edit that produced it, and that
/// edit has already said the notebook changed. Guarded like `page_save`, and for the same reason.
pub fn history_save(root: &Path, id: &str, json: &str) -> Result<(), String> {
    require_notebook(root, id)?;
    write_atomic(&nb_dir(root, id)?.join("history.json"), json.as_bytes())
}

/// Lowercase hex — both the value the contract returns and the file stem.
fn sha256_hex(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(64);
    for byte in Sha256::digest(bytes) {
        let _ = write!(out, "{byte:02x}");
    }
    out
}

/// Store an image under its own sha256 and return that hex.
///
/// **Nothing is written until the bytes are known to be a PNG**, the same guard `downloads::fetch_pdf`
/// applies to a paper: a blob stored under a `.png` name that no decoder accepts becomes a page
/// carrying an image that will never render, and by then the notebook is the only copy of it.
///
/// Content-addressed, so the same clip pasted onto two pages stores once — and an sha already on disk
/// is left exactly as it is rather than rewritten, because identical content is the one case where a
/// write can only lose.
pub fn asset_put(root: &Path, id: &str, bytes: &[u8]) -> Result<String, String> {
    let dir = nb_dir(root, id)?.join("assets");
    require_notebook(root, id)?;
    if bytes.len() > MAX_ASSET_BYTES {
        return Err(format!(
            "that image is {} MB and the limit is {} MB",
            bytes.len() / (1024 * 1024),
            MAX_ASSET_BYTES / (1024 * 1024)
        ));
    }
    if !bytes.starts_with(&PNG_MAGIC) {
        return Err("that is not a PNG".to_string());
    }
    let sha = sha256_hex(bytes);
    let path = dir.join(format!("{sha}.png"));
    if !path.exists() {
        write_atomic(&path, bytes)?;
        touch(root, id);
    }
    Ok(sha)
}

pub fn asset_load(root: &Path, id: &str, sha: &str) -> Result<Vec<u8>, String> {
    if !valid_sha(sha) {
        return Err(format!("bad asset name: {sha}"));
    }
    let path = nb_dir(root, id)?.join("assets").join(format!("{sha}.png"));
    std::fs::read(&path).map_err(|e| format!("{}: {e}", path.display()))
}

/// What the Notebook tab prints. A notebook whose directory is not there reads as an empty one —
/// the derived numbers are defined for that case, since a notebook always has one spread.
pub fn stat(root: &Path, id: &str) -> Result<NbStat, String> {
    let (pages, bytes, assets) = usage(&nb_dir(root, id)?);
    Ok(NbStat {
        pages,
        bytes,
        assets,
    })
}

// ─── Export ──────────────────────────────────────────────────────────────────

/// Copy one notebook to `<app data>\exports\<name>` and return where it landed.
///
/// **This is a directory copy, not a PDF.** It writes `meta.json`, `pages\` and `assets\` — the
/// notebook's own on-disk format, which this module can read straight back — and nothing anywhere in
/// here renders a page. "Export to PDF" would be a second, different command, and anyone reaching for
/// this one expecting a document will get a folder.
///
/// `history.json` is left behind: an export is the work, not the undo stack that produced it.
///
/// `name` is validated as one path segment, so it cannot climb out of `exports\`. As with
/// `state_export`, the frontend words the name and Rust owns the location.
pub fn export(root: &Path, id: &str, name: &str) -> Result<PathBuf, String> {
    let source = nb_dir(root, id)?;
    if !safe_segment(name) {
        return Err(format!("bad export name: {name}"));
    }
    let meta = source.join("meta.json");
    if !meta.exists() {
        return Err(format!("there is no notebook {id} to export"));
    }
    let target = root
        .parent()
        .ok_or_else(|| "notebook dir has no parent".to_string())?
        .join("exports")
        .join(name);
    std::fs::create_dir_all(&target).map_err(|e| format!("{}: {e}", target.display()))?;
    std::fs::copy(&meta, target.join("meta.json"))
        .map_err(|e| format!("{}: {e}", meta.display()))?;
    for folder in ["pages", "assets"] {
        copy_flat(&source.join(folder), &target.join(folder))?;
    }
    Ok(target)
}

/// Copy the regular files directly inside `from` into `to`. Both notebook subdirectories are flat, so
/// there is nothing to recurse into and no depth cap to get wrong.
fn copy_flat(from: &Path, to: &Path) -> Result<(), String> {
    let entries = match std::fs::read_dir(from) {
        Ok(e) => e,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(format!("{}: {e}", from.display())),
    };
    std::fs::create_dir_all(to).map_err(|e| format!("{}: {e}", to.display()))?;
    for entry in entries.flatten() {
        if !entry.metadata().map(|m| m.is_file()).unwrap_or(false) {
            continue;
        }
        let path = entry.path();
        let Some(file) = path.file_name() else {
            continue;
        };
        std::fs::copy(&path, to.join(file)).map_err(|e| format!("{}: {e}", path.display()))?;
    }
    Ok(())
}

// ─── The IPC ─────────────────────────────────────────────────────────────────
//
// Thin wrappers, one per function above. The argument names are the contract's: `invoke` sends
// `{ id, page, json, bytes, sha, name, meta }` and these have to match it exactly.

#[tauri::command]
pub fn nb_list(dir: State<'_, NotebookDir>) -> Result<Vec<NbEntry>, String> {
    list(&dir.0)
}

#[tauri::command]
pub fn nb_create(dir: State<'_, NotebookDir>, meta: NbAuthored) -> Result<NbEntry, String> {
    create(&dir.0, meta)
}

#[tauri::command]
pub fn nb_meta_save(
    dir: State<'_, NotebookDir>,
    id: String,
    meta: NbAuthored,
) -> Result<NbEntry, String> {
    meta_save(&dir.0, &id, meta)
}

#[tauri::command]
pub fn nb_delete(dir: State<'_, NotebookDir>, id: String) -> Result<(), String> {
    delete(&dir.0, &id)
}

#[tauri::command]
pub fn nb_page_load(
    dir: State<'_, NotebookDir>,
    id: String,
    page: u32,
) -> Result<Option<String>, String> {
    page_load(&dir.0, &id, page)
}

#[tauri::command]
pub fn nb_page_save(
    dir: State<'_, NotebookDir>,
    id: String,
    page: u32,
    json: String,
) -> Result<(), String> {
    page_save(&dir.0, &id, page, &json)
}

#[tauri::command]
pub fn nb_page_delete(dir: State<'_, NotebookDir>, id: String, page: u32) -> Result<(), String> {
    page_delete(&dir.0, &id, page)
}

#[tauri::command]
pub fn nb_history_load(dir: State<'_, NotebookDir>, id: String) -> Result<Option<String>, String> {
    history_load(&dir.0, &id)
}

#[tauri::command]
pub fn nb_history_save(
    dir: State<'_, NotebookDir>,
    id: String,
    json: String,
) -> Result<(), String> {
    history_save(&dir.0, &id, &json)
}

/// Bytes arrive as a JSON number array — the slow direction of the IPC, chosen knowingly, because a
/// paste is a one-off gesture at a few hundred KB and the alternative is an exotic call shape.
#[tauri::command]
pub fn nb_asset_put(
    dir: State<'_, NotebookDir>,
    id: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    asset_put(&dir.0, &id, &bytes)
}

/// Raw bytes back to the webview, the same shape as `library::read_document` — the efficient
/// direction, and the one that matters, because a page with six clips reads them all on every open.
#[tauri::command]
pub fn nb_asset_load(
    dir: State<'_, NotebookDir>,
    id: String,
    sha: String,
) -> Result<tauri::ipc::Response, String> {
    Ok(tauri::ipc::Response::new(asset_load(&dir.0, &id, &sha)?))
}

#[tauri::command]
pub fn nb_stat(dir: State<'_, NotebookDir>, id: String) -> Result<NbStat, String> {
    stat(&dir.0, &id)
}

#[tauri::command]
pub fn nb_export(dir: State<'_, NotebookDir>, id: String, name: String) -> Result<String, String> {
    export(&dir.0, &id, &name).map(|path| path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A throwaway root, named the way every other test in this crate names one.
    fn temp_root(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "bell-nb-{tag}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn authored(name: &str) -> NbAuthored {
        NbAuthored {
            name: name.to_string(),
            cover: 3,
            sticker: Some("physics".to_string()),
            paper: "ruled".to_string(),
            margin: true,
            subject: Some(NbSubject {
                code: "9702".to_string(),
                name: "Physics".to_string(),
            }),
        }
    }

    /// PNG magic plus a payload. `asset_put` validates the signature and stores the rest verbatim, so
    /// a real encoded image would only make these tests harder to read.
    fn png(tail: &[u8]) -> Vec<u8> {
        let mut out = PNG_MAGIC.to_vec();
        out.extend_from_slice(tail);
        out
    }

    /// Set `updatedAt` by hand, so the shelf order can be asserted without sleeping.
    fn restamp(root: &Path, id: &str, at: i64) {
        let mut meta = read_meta(root, id).unwrap();
        meta.updated_at = at;
        write_meta(root, &meta).unwrap();
        cache_row(root, &meta);
    }

    /// Every file under `dir`, path and contents, so "untouched" can be asserted byte for byte rather
    /// than by existence alone.
    fn fingerprint(dir: &Path) -> Vec<(String, Vec<u8>)> {
        fn walk(root: &Path, dir: &Path, out: &mut Vec<(String, Vec<u8>)>) {
            let Ok(entries) = std::fs::read_dir(dir) else {
                return;
            };
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    walk(root, &path, out);
                } else if let Ok(bytes) = std::fs::read(&path) {
                    let rel = path
                        .strip_prefix(root)
                        .unwrap()
                        .to_string_lossy()
                        .into_owned();
                    out.push((rel, bytes));
                }
            }
        }
        let mut out = Vec::new();
        walk(dir, dir, &mut out);
        out.sort();
        out
    }

    /// Ids are the whole reason a notebook has one: the name the student types stays inside
    /// `meta.json`, and every path is built from sixteen characters this module generated.
    #[test]
    fn notebook_ids_cannot_reach_outside_the_notebooks_dir() {
        let id = fresh_id();
        assert_eq!(id.len(), 16, "{id}");
        assert!(valid_id(&id), "{id}");
        assert!(
            id.bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit()),
            "{id} must satisfy ^[a-z0-9]{{16}}$"
        );
        assert_ne!(
            fresh_id(),
            fresh_id(),
            "two ids minted in one session must differ"
        );

        assert!(!valid_id(""));
        assert!(!valid_id("abcdefghijklmno"), "fifteen");
        assert!(!valid_id("abcdefghijklmnopq"), "seventeen");
        assert!(!valid_id("ABCDEFGHIJKLMNOP"), "uppercase");
        assert!(!valid_id(".."));
        assert!(!valid_id("a/b"));
        assert!(!valid_id(r"..\x"));
        // Sixteen characters long, so it is the charset doing the work here and not the length.
        assert!(!valid_id("abcdefgh/jklmnop"));
        assert!(!valid_id(r"..\evil123456789"));
        assert!(!valid_id(".bcdefghijklmnop"), "a leading dot");
        assert!(!valid_id("аbcdefghijklmnop"), "a Cyrillic а is not an a");

        let root = Path::new(r"C:\notebooks");
        assert_eq!(nb_dir(root, &id).unwrap(), root.join(&id));
        assert!(nb_dir(root, "..").is_err());
        assert!(nb_dir(root, r"..\..\Windows").is_err());

        // Every command that takes an id reaches the filesystem through `nb_dir`, so one refusal
        // covers all of them. None of these touches the disk — the root does not exist.
        assert!(meta_save(root, "..", authored("Mechanics")).is_err());
        assert!(delete(root, "..").is_err());
        assert!(page_load(root, "..", 0).is_err());
        assert!(page_save(root, "..", 0, "{}").is_err());
        assert!(page_delete(root, "..", 0).is_err());
        assert!(history_load(root, "..").is_err());
        assert!(history_save(root, "..", "[]").is_err());
        assert!(asset_put(root, "..", &png(b"x")).is_err());
        assert!(asset_load(root, "..", &"a".repeat(64)).is_err());
        assert!(stat(root, "..").is_err());
        assert!(export(root, "..", "export").is_err());

        // The four-digit stem is the format, so a page beyond it is refused rather than written
        // somewhere `page_indices` would never see it.
        assert!(page_save(root, &id, MAX_PAGE_INDEX + 1, "{}").is_err());
    }

    /// A page cannot be written to a notebook that is not there.
    ///
    /// `write_atomic` creates its parent, so a save arriving after a delete — a flush still in flight
    /// when the student confirmed — would rebuild `<id>\pages\` with no `meta.json`, and `list` skips a
    /// directory it cannot read a meta from. That page would be real, on disk, and unreachable for ever.
    #[test]
    fn a_page_cannot_resurrect_a_deleted_notebook() {
        let root = temp_root("orphan");
        let id = create(&root, authored("Mechanics")).unwrap().meta.id;
        page_save(&root, &id, 0, r#"{"v":1}"#).unwrap();

        delete(&root, &id).unwrap();
        assert!(!root.join(&id).exists());

        assert!(
            page_save(&root, &id, 0, r#"{"v":1}"#).is_err(),
            "a page write must not recreate the directory"
        );
        assert!(
            history_save(&root, &id, "[]").is_err(),
            "nor a history write"
        );
        assert!(
            asset_put(&root, &id, &png(b"clip")).is_err(),
            "nor an asset"
        );
        assert!(
            !root.join(&id).exists(),
            "and must leave nothing behind on the way out"
        );
        assert!(
            list(&root).unwrap().is_empty(),
            "so nothing is stranded where the shelf cannot look"
        );

        // The same guard cannot lock out a notebook that DOES exist — that is the whole difference.
        let live = create(&root, authored("Waves")).unwrap().meta.id;
        page_save(&root, &live, 3, r#"{"v":1}"#).unwrap();
        history_save(&root, &live, "[]").unwrap();
        asset_put(&root, &live, &png(b"clip")).unwrap();
        assert_eq!(stat(&root, &live).unwrap().pages, 4);

        std::fs::remove_dir_all(&root).ok();
    }

    /// The page count is derived, never stored. Pinned against `pageCountFromMaxIndex` in
    /// `src/lib/notebooks.ts`: two definitions of this number is how a shelf tile and a spread nav
    /// start disagreeing about the same notebook.
    #[test]
    fn the_page_count_is_derived_from_the_highest_page_file() {
        assert_eq!(
            page_count_from_max_index(-1),
            2,
            "nothing written is still one spread"
        );
        assert_eq!(page_count_from_max_index(0), 2);
        assert_eq!(page_count_from_max_index(1), 2);
        assert_eq!(page_count_from_max_index(2), 4);
        assert_eq!(page_count_from_max_index(3), 4);
        assert_eq!(page_count_from_max_index(47), 48);
        assert_eq!(page_count_from_max_index(i64::from(MAX_PAGE_INDEX)), 10_000);

        let nb = temp_root("pages");
        let pages = nb.join("pages");
        std::fs::create_dir_all(&pages).unwrap();
        assert_eq!(usage(&nb).0, 2, "an empty notebook has one spread");

        // Sparse is the normal case: a spread reaches disk on its first stroke, so 0, 3 and 47 with
        // nothing in between is what a real notebook looks like.
        for stem in ["0000", "0003", "0047"] {
            std::fs::write(pages.join(format!("{stem}.json")), b"{}").unwrap();
        }
        assert_eq!(usage(&nb).0, 48);

        // None of these is a page. Ignored rather than refused — a stray file in a folder is not a
        // reason to fail to open a notebook.
        for name in [
            "047.json",
            "00470.json",
            "abcd.json",
            "0100.txt",
            "notes.txt",
            "0099.json.tmp",
        ] {
            std::fs::write(pages.join(name), b"{}").unwrap();
        }
        assert_eq!(usage(&nb).0, 48, "only a four-digit .json stem is a page");
        assert_eq!(page_index_of("0047"), Some(47));
        assert_eq!(page_index_of("47"), None);
        assert_eq!(page_index_of("00470"), None);
        assert_eq!(page_index_of("004a"), None);

        std::fs::remove_dir_all(&nb).ok();
    }

    /// **The invariant that matters most: nothing that clears the catalogue or resets study state may
    /// touch `notebooks\`.**
    ///
    /// A notebook is authored work with no remote copy — closer to a downloaded PDF than to a
    /// bookmark, and unlike either it cannot be re-fetched or re-derived from anything at all.
    /// `library::tests::a_resync_keeps_downloads` pins that rule for the `download` rows; this pins it
    /// for the files. Both destructive paths are exercised, because `clear_catalog` is the one a sync
    /// takes and `reset_into` is the one the Settings dialog takes.
    #[test]
    fn a_resync_and_a_reset_leave_notebooks_untouched() {
        let root = temp_root("resync");
        let notebooks = root.join("notebooks");
        let state_dir = root.join("state");
        std::fs::create_dir_all(&state_dir).unwrap();

        let id = create(&notebooks, authored("Mechanics")).unwrap().meta.id;
        page_save(&notebooks, &id, 0, r#"{"v":1,"strokes":[],"objects":[]}"#).unwrap();
        page_save(&notebooks, &id, 1, r#"{"v":1,"strokes":[],"objects":[]}"#).unwrap();
        history_save(&notebooks, &id, r#"{"done":[],"undone":[]}"#).unwrap();
        let sha = asset_put(&notebooks, &id, &png(b"a clip of a question")).unwrap();

        // A used install: a catalogue to clear, and a state key for the reset to take.
        let conn = crate::db::open(&root.join("index.sqlite3")).unwrap();
        conn.execute(
            "INSERT INTO catalog_subject(id,code,name,slug,qualification,board)
             VALUES(65,'9709','Mathematics','mathematics','a_level','caie')",
            [],
        )
        .unwrap();
        std::fs::write(state_dir.join("bookmarks.json"), b"[]").unwrap();

        let before = fingerprint(&notebooks);
        assert!(
            before.len() >= 5,
            "meta, index, two pages, history and an asset"
        );

        crate::db::clear_catalog(&conn).unwrap();
        let report = crate::state::reset_into(&conn, &state_dir).unwrap();
        assert_eq!(report.state_files, 1, "the reset really did run");
        let subjects: i64 = conn
            .query_row("SELECT COUNT(*) FROM catalog_subject", [], |r| r.get(0))
            .unwrap();
        assert_eq!(subjects, 0, "and the catalogue really did go");

        assert_eq!(
            fingerprint(&notebooks),
            before,
            "notebooks\\ is byte for byte as it was"
        );
        let nb = notebooks.join(&id);
        assert!(nb.join("meta.json").exists());
        assert!(nb.join("pages").join("0000.json").exists());
        assert!(nb.join("pages").join("0001.json").exists());
        assert!(nb.join("history.json").exists());
        assert!(nb.join("assets").join(format!("{sha}.png")).exists());

        let shelf = list(&notebooks).unwrap();
        assert_eq!(shelf.len(), 1);
        assert_eq!(shelf[0].meta.authored.name, "Mechanics");
        assert_eq!(shelf[0].pages, 2);

        std::fs::remove_dir_all(&root).ok();
    }

    /// Create, write to it, read it all back. Every field the shelf renders, including the two only the
    /// filesystem can answer.
    #[test]
    fn a_notebook_round_trips_through_the_filesystem() {
        let root = temp_root("round");

        let created = create(&root, authored("  Mechanics  ")).unwrap();
        let id = created.meta.id.clone();
        assert!(valid_id(&id), "{id}");
        assert_eq!(
            created.meta.authored.name, "Mechanics",
            "the stored name is trimmed"
        );
        assert_eq!(
            created.meta.created_at, created.meta.updated_at,
            "never edited"
        );
        assert_eq!(created.pages, 2, "one spread before anything is written");
        assert_eq!(created.bytes, 0);

        // The wire shape is the contract's: one flat camelCase object, `id` and the two timestamps
        // beside the authored fields. `useNotebooks` sorts on `entry.updatedAt` at the top level, so a
        // nested `meta` here would break the shelf without breaking a single Rust test.
        let wire = serde_json::to_value(&created).unwrap();
        let object = wire.as_object().unwrap();
        let mut keys: Vec<&str> = object.keys().map(String::as_str).collect();
        keys.sort_unstable();
        assert_eq!(
            keys,
            [
                "bytes",
                "cover",
                "createdAt",
                "id",
                "margin",
                "name",
                "pages",
                "paper",
                "sticker",
                "subject",
                "updatedAt",
            ]
        );
        assert!(object["createdAt"].is_i64());
        assert_eq!(object["cover"], 3);
        assert_eq!(object["subject"]["code"], "9702");

        let page = r##"{"v":1,"strokes":[{"id":"s1","t":"pen","c":"#1b1b1f","w":0.004,"p":[0.1,0.2,0.5]}],"objects":[]}"##;
        page_save(&root, &id, 0, page).unwrap();
        history_save(&root, &id, r#"{"done":[],"undone":[]}"#).unwrap();
        let image = png(b"a clip of a question");
        let sha = asset_put(&root, &id, &image).unwrap();
        assert!(valid_sha(&sha), "{sha}");

        // Content-addressed and idempotent. A sentinel proves the second put did not rewrite the file,
        // which a modification time cannot on a machine this fast.
        let asset = root.join(&id).join("assets").join(format!("{sha}.png"));
        std::fs::write(&asset, png(b"sentinel")).unwrap();
        assert_eq!(
            asset_put(&root, &id, &image).unwrap(),
            sha,
            "the same bytes, the same name"
        );
        assert_eq!(
            std::fs::read(&asset).unwrap(),
            png(b"sentinel"),
            "left exactly as it was"
        );
        std::fs::write(&asset, &image).unwrap();

        let stats = stat(&root, &id).unwrap();
        assert_eq!(stats.pages, 2);
        assert_eq!(stats.assets, 1);
        assert_eq!(
            stats.bytes,
            (page.len() + image.len()) as u64,
            "pages and assets, not meta.json or history.json"
        );

        let shelf = list(&root).unwrap();
        assert_eq!(shelf.len(), 1);
        let row = &shelf[0];
        assert_eq!(row.meta.id, id);
        assert_eq!(row.meta.created_at, created.meta.created_at);
        assert_eq!(row.meta.authored.name, "Mechanics");
        assert_eq!(row.meta.authored.cover, 3);
        assert_eq!(row.meta.authored.paper, "ruled");
        assert!(row.meta.authored.margin);
        assert_eq!(row.meta.authored.sticker.as_deref(), Some("physics"));
        assert_eq!(row.meta.authored.subject.as_ref().unwrap().code, "9702");
        assert_eq!(row.pages, stats.pages);
        assert_eq!(row.bytes, stats.bytes);

        assert_eq!(page_load(&root, &id, 0).unwrap().as_deref(), Some(page));
        assert!(
            page_load(&root, &id, 1).unwrap().is_none(),
            "a page nobody has drawn on is null, not an error"
        );
        assert!(history_load(&root, &id).unwrap().is_some());
        assert_eq!(asset_load(&root, &id, &sha).unwrap(), image);
        assert!(asset_load(&root, &id, "nope").is_err(), "not a sha");
        assert!(
            asset_load(&root, &id, &"f".repeat(64)).is_err(),
            "a sha for a file that is not there"
        );

        // A rename keeps the stored createdAt and stamps updatedAt.
        let renamed = meta_save(
            &root,
            &id,
            NbAuthored {
                name: "Waves".to_string(),
                cover: 8,
                ..authored("ignored")
            },
        )
        .unwrap();
        assert_eq!(renamed.meta.id, id);
        assert_eq!(renamed.meta.created_at, created.meta.created_at);
        assert!(renamed.meta.updated_at >= created.meta.updated_at);
        assert_eq!(renamed.meta.authored.name, "Waves");
        assert_eq!(renamed.meta.authored.cover, 8);
        assert_eq!(renamed.pages, 2);

        // Pages are derived, so writing the second spread moves the count and emptying it moves it back.
        page_save(&root, &id, 3, page).unwrap();
        assert_eq!(stat(&root, &id).unwrap().pages, 4);
        page_delete(&root, &id, 3).unwrap();
        assert_eq!(stat(&root, &id).unwrap().pages, 2);
        page_delete(&root, &id, 3).unwrap();

        // What the New Notebook dialog must not be able to store. A rejected create claims no id, so
        // none of these leaves a directory behind.
        assert!(create(
            &root,
            NbAuthored {
                name: "   ".to_string(),
                ..authored("x")
            }
        )
        .is_err());
        assert!(create(
            &root,
            NbAuthored {
                name: "x".repeat(81),
                ..authored("x")
            }
        )
        .is_err());
        assert!(create(
            &root,
            NbAuthored {
                cover: 0,
                ..authored("Mechanics")
            }
        )
        .is_err());
        assert!(create(
            &root,
            NbAuthored {
                cover: 9,
                ..authored("Mechanics")
            }
        )
        .is_err());
        assert!(create(
            &root,
            NbAuthored {
                paper: "squared".to_string(),
                ..authored("M")
            }
        )
        .is_err());
        assert!(meta_save(
            &root,
            &id,
            NbAuthored {
                name: String::new(),
                ..authored("x")
            }
        )
        .is_err());
        let survivor = create(
            &root,
            NbAuthored {
                name: "x".repeat(80),
                ..authored("x")
            },
        )
        .unwrap();

        // An unchecked blob under a .png name is how a page ends up with an image nothing can decode.
        assert!(asset_put(&root, &id, b"<!DOCTYPE html><title>404</title>").is_err());
        assert!(
            asset_put(&root, &id, b"\x89PNG").is_err(),
            "half a signature"
        );
        assert!(asset_put(&root, &id, &[]).is_err());
        assert!(
            asset_put(&root, &id, &vec![0u8; MAX_ASSET_BYTES + 1]).is_err(),
            "over the cap"
        );

        delete(&root, &id).unwrap();
        assert!(!root.join(&id).exists());
        assert!(page_load(&root, &id, 0).unwrap().is_none());
        assert!(
            read_index(&root).iter().all(|r| r.id != id),
            "the index entry went with it"
        );
        let left = list(&root).unwrap();
        assert_eq!(
            left.len(),
            1,
            "only the notebook the rejected creates did not make"
        );
        assert_eq!(left[0].meta.id, survivor.meta.id);

        std::fs::remove_dir_all(&root).ok();
    }

    /// `index.json` is a cache. Losing it must cost a directory walk and never a notebook, and a row
    /// for a directory that has gone must not leave a tile on the shelf that opens nothing.
    #[test]
    fn the_index_heals_itself_from_the_meta_files() {
        let root = temp_root("index");
        let older = create(&root, authored("Mechanics")).unwrap().meta.id;
        let newer = create(&root, authored("Waves")).unwrap().meta.id;
        // Two creates can land in the same millisecond, and the order is what is under test.
        restamp(&root, &older, 1_700_000_000_000);
        restamp(&root, &newer, 1_800_000_000_000);

        let index = root.join(INDEX_FILE);
        assert!(index.exists(), "a create writes the cache");
        std::fs::remove_file(&index).unwrap();

        let healed = list(&root).unwrap();
        assert_eq!(healed.len(), 2, "rebuilt from the meta.json files");
        assert_eq!(healed[0].meta.id, newer, "most recently edited first");
        assert_eq!(healed[1].meta.id, older);
        assert_eq!(healed[0].meta.authored.name, "Waves");
        assert!(index.exists(), "and the cache was written back");
        assert_eq!(read_index(&root).len(), 2);

        // A row whose directory has gone — a notebook deleted outside the app, or a cache that outlived
        // one — must be dropped rather than rendered.
        let mut rows = read_index(&root);
        let mut ghost = rows[0].clone();
        ghost.id = "0000000000000000".to_string();
        ghost.authored.name = "Deleted in Explorer".to_string();
        rows.push(ghost);
        write_index(&root, &rows).unwrap();
        assert_eq!(read_index(&root).len(), 3);

        let pruned = list(&root).unwrap();
        assert_eq!(pruned.len(), 2, "the ghost is dropped");
        assert!(pruned.iter().all(|r| r.meta.id != "0000000000000000"));
        assert_eq!(
            read_index(&root).len(),
            2,
            "and the cache no longer carries it"
        );

        // Adoption needs a readable meta.json, and a list is a read: it deletes nothing.
        let orphan = root.join("aaaaaaaaaaaaaaaa");
        std::fs::create_dir_all(orphan.join("pages")).unwrap();
        assert_eq!(list(&root).unwrap().len(), 2);
        assert!(orphan.exists());

        // A hand-copied notebook directory is adopted, which is the other half of the reconciliation.
        let copied = root.join("bbbbbbbbbbbbbbbb");
        std::fs::create_dir_all(&copied).unwrap();
        std::fs::copy(
            root.join(&older).join("meta.json"),
            copied.join("meta.json"),
        )
        .unwrap();
        let adopted = list(&root).unwrap();
        assert_eq!(adopted.len(), 3);
        let found = adopted
            .iter()
            .find(|r| r.meta.id == "bbbbbbbbbbbbbbbb")
            .unwrap();
        assert_eq!(found.meta.authored.name, "Mechanics");
        assert_eq!(
            found.meta.id, "bbbbbbbbbbbbbbbb",
            "the directory names it, not the copied file"
        );
        assert_eq!(read_index(&root).len(), 3);

        // A healthy shelf render writes nothing. Compact JSON is the same rows in different text, so
        // surviving a `list` byte for byte is what proves it.
        let compact = serde_json::to_string(&read_index(&root)).unwrap();
        std::fs::write(&index, &compact).unwrap();
        let _ = list(&root).unwrap();
        assert_eq!(std::fs::read_to_string(&index).unwrap(), compact);

        std::fs::remove_dir_all(&root).ok();
    }

    /// An export is a copy of the notebook's own format into one named folder — not a PDF, and not a
    /// move. The name is validated on the same charset `state::safe_segment` allows, so it cannot climb
    /// out of `exports\`.
    #[test]
    fn an_export_copies_the_notebook_into_one_named_folder() {
        let root = temp_root("export");
        let notebooks = root.join("notebooks");
        let id = create(&notebooks, authored("Mechanics")).unwrap().meta.id;
        page_save(&notebooks, &id, 0, r#"{"v":1}"#).unwrap();
        history_save(&notebooks, &id, "[]").unwrap();
        let sha = asset_put(&notebooks, &id, &png(b"clip")).unwrap();

        let target = export(&notebooks, &id, "bell-notebook-2026-09-05").unwrap();
        assert_eq!(
            target,
            root.join("exports").join("bell-notebook-2026-09-05")
        );
        assert!(target.join("meta.json").exists());
        assert_eq!(
            std::fs::read_to_string(target.join("pages").join("0000.json")).unwrap(),
            r#"{"v":1}"#
        );
        assert!(target.join("assets").join(format!("{sha}.png")).exists());
        assert!(
            !target.join("history.json").exists(),
            "an export is the work, not the undo stack that produced it"
        );
        assert!(
            notebooks.join(&id).join("meta.json").exists(),
            "a copy, so the notebook stays put"
        );

        for bad in ["../elsewhere", r"..\elsewhere", "nested/name", "C:evil", ""] {
            assert!(export(&notebooks, &id, bad).is_err(), "{bad}");
        }
        assert!(
            export(&notebooks, "aaaaaaaaaaaaaaaa", "nothing").is_err(),
            "an export that copies nothing must not report success"
        );

        std::fs::remove_dir_all(&root).ok();
    }
}
