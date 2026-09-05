//! Pets: the mascot the student chose, and the Codex pet packages behind them.
//!
//! A pet replaces Mr. Bell everywhere he appears. He stays in the binary as the built-in default —
//! nothing here is reachable on a fresh install, and the app has to have a mascot before it has ever
//! seen a network — so "no pet selected" is Mr. Bell rather than an empty corner.
//!
//! Its own directory rather than more state keys, for exactly the reason `notebooks.rs` gives:
//! `state_load` slurps every `*.json` in the state dir into memory before the first render, and a
//! spritesheet measures 1.7 MB. `state_save` is text-only too, so a sheet would have to be base64
//! inside JSON.
//!
//!     <app_data_dir>\pets\
//!       index.json               the shelf, cached — rebuildable, see `list`
//!       <id>\pet.json            the manifest; THE SOURCE OF TRUTH
//!       <id>\spritesheet.webp    the 8-column atlas, one animation per row
//!
//! `src/lib/pets.ts` is the contract for every type, command name and argument name here, and it
//! holds the row tables this module deliberately knows nothing about: **no image is decoded down
//! here.** Rust checks that the bytes are a WebP, and the renderer — which has to decode the sheet
//! anyway — is what checks the geometry, because 1872 or 2288 pixels of height is the only honest
//! answer to which atlas version a sheet really is.
//!
//! **`<id>` arrives from the network**, which is the one way this differs from a notebook id. So the
//! charset is closed the same way and checked on the way in (`valid_id`), the name Windows reserves
//! is refused too, and `spritesheetPath` is overwritten rather than trusted — a manifest never gets
//! to name a path.

use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::catalog;

pub struct PetDir(pub PathBuf);

const INDEX_FILE: &str = "index.json";
const MANIFEST_FILE: &str = "pet.json";

/// The format's own file name, and the only one this module will write a sheet under.
const SHEET_FILE: &str = "spritesheet.webp";

/// A v2 atlas measured 1.7 MB on the registry today. This is a ceiling on a mistake — a mislabelled
/// video, a hostile response — not a budget: it must not be tight enough to refuse a real pet.
const MAX_SHEET_BYTES: usize = 8 * 1024 * 1024;

/// A gallery thumbnail is tens of KB. Same reasoning, smaller number.
const MAX_PREVIEW_BYTES: usize = 4 * 1024 * 1024;

/// The registry index is ~36 KB for 30 pets.
const MAX_REGISTRY_BYTES: usize = 4 * 1024 * 1024;

const DEFAULT_REGISTRY: &str = "https://codex-pets.net";

/// `RIFF....WEBP` — the container, checked before a byte is written, the same guard
/// `downloads::fetch_pdf` applies to a paper and `notebooks::asset_put` to a clip.
const RIFF: &[u8; 4] = b"RIFF";
const WEBP: &[u8; 4] = b"WEBP";
const PNG_MAGIC: [u8; 8] = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

/// Where pets are browsed from. `BELL_PETS_BASE` overrides it for development, exactly as
/// `BELL_API_BASE` does for the catalogue — and the host it names is the only host this module will
/// fetch from, so pointing it at a local server also narrows the allowlist to that server.
pub fn registry_base() -> String {
    std::env::var("BELL_PETS_BASE")
        .ok()
        .map(|v| v.trim_end_matches('/').to_string())
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| DEFAULT_REGISTRY.to_string())
}

// ─── The manifest ────────────────────────────────────────────────────────────

/// `pet.json`. The format guarantees the first two fields; everything after has a default, so a v1
/// manifest written before those fields existed still parses rather than failing the whole pet.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PetManifest {
    pub id: String,
    pub display_name: String,
    #[serde(default)]
    pub description: String,
    /// Always `spritesheet.webp`. Forced by `checked`, never taken from the payload — see the
    /// header: this is a file name in a path, and the payload is not this app's.
    #[serde(default = "sheet_file")]
    pub spritesheet_path: String,
    /// The manifest's claim about which atlas it is. Recorded and shown; never used to slice the
    /// sheet, because the renderer can measure the truth.
    #[serde(default = "one")]
    pub sprite_version_number: u32,
    #[serde(default = "unknown_kind")]
    pub kind: String,
}

fn sheet_file() -> String {
    SHEET_FILE.to_string()
}
fn one() -> u32 {
    1
}
fn unknown_kind() -> String {
    "pet".to_string()
}

/// A shelf row: the stored manifest plus the one field only the filesystem can answer.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PetEntry {
    #[serde(flatten)]
    pub manifest: PetManifest,
    /// The spritesheet's size on disk. Settings prints this as what the pet costs.
    pub bytes: u64,
}

// ─── Guards ──────────────────────────────────────────────────────────────────

/// `^[a-z0-9][a-z0-9-]{0,63}$`, and not a device name. `isPetId` in the contract is the same rule.
///
/// The charset is *closed* rather than escaped — no dot, no separator, nothing to normalise — which
/// is what makes `root.join(id)` safe to say once, in `pet_dir`, and nowhere else. Unlike a notebook
/// id this one is whatever a registry hands over, so the check is the load-bearing part rather than a
/// restatement of how the id was minted.
pub fn valid_id(id: &str) -> bool {
    let bytes = id.as_bytes();
    if bytes.is_empty() || bytes.len() > 64 {
        return false;
    }
    if !(bytes[0].is_ascii_lowercase() || bytes[0].is_ascii_digit()) {
        return false;
    }
    if !bytes
        .iter()
        .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || *b == b'-')
    {
        return false;
    }
    !reserved(id)
}

/// The DOS device names, which Windows resolves anywhere in a path whatever the charset allows. A
/// pet called `nul` would otherwise be a directory that swallows every write without failing.
fn reserved(id: &str) -> bool {
    if matches!(id, "con" | "prn" | "aux" | "nul") {
        return true;
    }
    let b = id.as_bytes();
    b.len() == 4
        && b[3].is_ascii_digit()
        && b[3] != b'0'
        && (&b[..3] == b"com" || &b[..3] == b"lpt")
}

/// The one door into a pet's directory. Nothing here builds a path any other way.
fn pet_dir(root: &Path, id: &str) -> Result<PathBuf, String> {
    if !valid_id(id) {
        return Err(format!("bad pet id: {id}"));
    }
    Ok(root.join(id))
}

fn sheet_path(root: &Path, id: &str) -> Result<PathBuf, String> {
    Ok(pet_dir(root, id)?.join(SHEET_FILE))
}

/// Normalise a manifest on the way in, identically wherever it came from.
///
/// Clamped rather than rejected on the text fields: a name three characters over a limit is not a
/// reason to refuse somebody's pet, and the tile it renders in is a fixed width either way. The two
/// things that *are* refused are the id, which becomes a directory, and an empty name, which would
/// leave a nameless row on the shelf. `spritesheetPath` is overwritten because this module writes the
/// sheet itself and under one name — so the manifest describes what is on disk rather than directing
/// where to look for it.
fn checked(mut manifest: PetManifest) -> Result<PetManifest, String> {
    if !valid_id(&manifest.id) {
        return Err(format!("bad pet id: {}", manifest.id));
    }
    manifest.display_name = clamp(manifest.display_name.trim(), 80);
    if manifest.display_name.is_empty() {
        return Err("a pet needs a name".to_string());
    }
    manifest.description = clamp(manifest.description.trim(), 300);
    manifest.kind = clamp(manifest.kind.trim(), 24);
    if manifest.kind.is_empty() {
        manifest.kind = unknown_kind();
    }
    manifest.spritesheet_path = sheet_file();
    Ok(manifest)
}

/// Truncate on a character boundary, so a clamp cannot split a multi-byte name into invalid UTF-8.
fn clamp(text: &str, chars: usize) -> String {
    text.chars().take(chars).collect()
}

/// Only the registry's own host, only over TLS.
///
/// The URLs are handed over by the webview, which read them out of the registry's JSON — so this is
/// what stops a crafted row from turning `pet_install` into a general-purpose fetcher pointed at
/// anything on the machine's network. `registry_base` names the one host, so a development override
/// narrows the allowlist rather than widening it.
fn checked_url(url: &str) -> Result<reqwest::Url, String> {
    checked_url_in(url, &registry_base())
}

/// The rule itself, with the base passed in so it can be tested without reaching for the environment
/// — and so the env is read once, at the edge, rather than inside a predicate.
fn checked_url_in(url: &str, base: &str) -> Result<reqwest::Url, String> {
    let parsed = reqwest::Url::parse(url).map_err(|e| format!("unusable pet URL: {e}"))?;
    let base = reqwest::Url::parse(base).map_err(|e| format!("BELL_PETS_BASE is not a URL: {e}"))?;
    if parsed.scheme() != base.scheme() || parsed.host_str() != base.host_str() {
        return Err(format!(
            "a pet may only be fetched from {}",
            base.host_str().unwrap_or("the registry")
        ));
    }
    Ok(parsed)
}

// ─── Files ───────────────────────────────────────────────────────────────────

/// Write via a temporary sibling and a rename, so a crash mid-write cannot leave a truncated sheet
/// that later passes the magic check — the pattern `state::state_save` established.
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
    // Windows will not rename onto an existing file.
    let _ = std::fs::remove_file(path);
    if let Err(e) = std::fs::rename(&tmp, path) {
        let _ = std::fs::remove_file(&tmp);
        return Err(format!("{}: {e}", path.display()));
    }
    Ok(())
}

/// Read one pet's manifest.
///
/// The id comes from the directory, not from the file: a `pet.json` copied between directories must
/// not make a pet claim to be another one, because the directory is what every path is built from.
fn read_manifest(root: &Path, id: &str) -> Result<PetManifest, String> {
    let path = pet_dir(root, id)?.join(MANIFEST_FILE);
    let text = std::fs::read_to_string(&path).map_err(|e| format!("{}: {e}", path.display()))?;
    let mut manifest: PetManifest =
        serde_json::from_str(&text).map_err(|e| format!("{}: {e}", path.display()))?;
    manifest.id = id.to_string();
    Ok(manifest)
}

fn write_manifest(root: &Path, manifest: &PetManifest) -> Result<(), String> {
    let path = pet_dir(root, &manifest.id)?.join(MANIFEST_FILE);
    let text = serde_json::to_string_pretty(manifest).map_err(|e| e.to_string())?;
    write_atomic(&path, text.as_bytes())
}

/// The cached shelf. A read that fails — missing on a first run, unparseable after a bad shutdown —
/// is not an error: `list` rebuilds it from the `pet.json` files.
fn read_index(root: &Path) -> Vec<PetManifest> {
    std::fs::read_to_string(root.join(INDEX_FILE))
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

fn write_index(root: &Path, rows: &[PetManifest]) -> Result<(), String> {
    let text = serde_json::to_string_pretty(rows).map_err(|e| e.to_string())?;
    write_atomic(&root.join(INDEX_FILE), text.as_bytes())
}

/// Refresh the cached shelf, best effort. A failure is logged rather than returned: `index.json` is a
/// cache `list` rebuilds, so refusing an install whose real bytes have already landed would be worse.
fn refresh_index(root: &Path, rows: &[PetManifest]) {
    if let Err(e) = write_index(root, rows) {
        eprintln!("[pets] {INDEX_FILE}: {e}");
    }
}

fn cache_row(root: &Path, manifest: &PetManifest) {
    let mut rows = read_index(root);
    rows.retain(|r| r.id != manifest.id);
    rows.push(manifest.clone());
    refresh_index(root, &rows);
}

fn index_shape(rows: &[PetManifest]) -> std::collections::BTreeMap<String, String> {
    rows.iter()
        .map(|r| (r.id.clone(), serde_json::to_string(r).unwrap_or_default()))
        .collect()
}

/// Bytes of the spritesheet on disk; a sheet that is not there reads as zero.
fn sheet_bytes(root: &Path, id: &str) -> u64 {
    sheet_path(root, id)
        .ok()
        .and_then(|p| std::fs::metadata(p).ok())
        .filter(|m| m.is_file())
        .map(|m| m.len())
        .unwrap_or(0)
}

// ─── The shelf ───────────────────────────────────────────────────────────────

/// Every installed pet, by name.
///
/// Reconciled against the directories **both ways**, the same posture `notebooks::list` and
/// `downloads::repair` take: a directory holding a readable `pet.json` and a sheet that the index has
/// never heard of is adopted, and an index row whose files have gone is dropped. `index.json` is
/// rewritten only when that changed something, so a healthy shelf render writes nothing.
///
/// **One deliberate difference from a notebook.** A notebook whose `meta.json` will not read keeps
/// its cached row, because that row is the last record of authored work nothing can reconstruct. A pet
/// is somebody else's drawing with a copy on the registry, so a directory missing either half is
/// dropped rather than nursed: a pet that cannot render is not a pet, and the fix is to install it
/// again. That is also why the sheet's presence is a listing condition and not merely a field.
pub fn list(root: &Path) -> Result<Vec<PetEntry>, String> {
    let cached = read_index(root);
    let mut fresh: Vec<PetManifest> = Vec::new();

    if let Ok(entries) = std::fs::read_dir(root) {
        for entry in entries.flatten() {
            if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                continue;
            }
            let Some(id) = entry.file_name().to_str().map(str::to_string) else { continue };
            if !valid_id(&id) || sheet_bytes(root, &id) == 0 {
                continue;
            }
            if let Ok(manifest) = read_manifest(root, &id) {
                fresh.push(manifest);
            }
        }
    }

    if index_shape(&fresh) != index_shape(&cached) {
        refresh_index(root, &fresh);
    }

    let mut out: Vec<PetEntry> = fresh
        .into_iter()
        .map(|manifest| {
            let bytes = sheet_bytes(root, &manifest.id);
            PetEntry { manifest, bytes }
        })
        .collect();
    // The id breaks a tie, so two pets sharing a display name keep a stable order between renders.
    out.sort_by(|a, b| {
        a.manifest
            .display_name
            .to_lowercase()
            .cmp(&b.manifest.display_name.to_lowercase())
            .then_with(|| a.manifest.id.cmp(&b.manifest.id))
    });
    Ok(out)
}

// ─── The network ─────────────────────────────────────────────────────────────

/// GET one URL on the registry's host, buffering to a hard ceiling.
///
/// Capped **while streaming** rather than after: `Content-Length` is a claim, and a body that keeps
/// arriving would otherwise be free to fill memory before anything got to check its size.
///
/// **No identifying header goes out.** The paper downloader sends `x-bell-install` and a session id,
/// because that server is the ShinyPapers web app and the id is how a burst gets grouped. This is a
/// third party, so it gets the shared user agent and nothing else — not the install id, not a session,
/// not the version.
async fn fetch_capped(url: reqwest::Url, max: usize, what: &str) -> Result<Vec<u8>, String> {
    let mut res = catalog::client()?
        .get(url)
        .timeout(Duration::from_secs(60))
        .send()
        .await
        .map_err(|e| format!("could not reach the pet registry: {e}"))?;

    if res.status() == reqwest::StatusCode::NOT_FOUND {
        return Err(format!("the registry has no {what} at that address"));
    }
    if !res.status().is_success() {
        return Err(format!(
            "the registry answered HTTP {} for that {what}",
            res.status().as_u16()
        ));
    }

    let mut bytes: Vec<u8> = Vec::with_capacity(res.content_length().unwrap_or(1 << 16).min(max as u64) as usize);
    while let Some(chunk) = res
        .chunk()
        .await
        .map_err(|e| format!("the transfer was interrupted: {e}"))?
    {
        if bytes.len() + chunk.len() > max {
            return Err(format!(
                "that {what} is larger than the {} MB Bell will accept",
                max / (1024 * 1024)
            ));
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

fn is_webp(bytes: &[u8]) -> bool {
    bytes.len() > 12 && &bytes[..4] == RIFF && &bytes[8..12] == WEBP
}

/// The registry's own JSON, verbatim.
///
/// Not parsed here on purpose — the same call `notebooks::page_save` makes about a page. The shape is
/// `src/lib/pets.ts`'s `parseRegistry`, which is where a new field or a new sort order should be able
/// to land without a Rust release. All Rust owes the webview is that the bytes came from the one
/// permitted host and are not unbounded.
pub async fn registry() -> Result<String, String> {
    let url = reqwest::Url::parse(&format!("{}/api/pets", registry_base()))
        .map_err(|e| format!("BELL_PETS_BASE is not a URL: {e}"))?;
    let bytes = fetch_capped(url, MAX_REGISTRY_BYTES, "pet list").await?;
    String::from_utf8(bytes).map_err(|_| "the registry sent something that is not text".to_string())
}

/// One gallery thumbnail, for a pet nobody has installed yet.
///
/// It has to come through Rust like everything else: `img-src` in `tauri.conf.json` is
/// `'self' data: blob:`, so a remote image URL in the renderer would need a CSP hole for a picture.
/// The webview turns these bytes into a blob URL instead.
pub async fn preview(url: &str) -> Result<Vec<u8>, String> {
    let bytes = fetch_capped(checked_url(url)?, MAX_PREVIEW_BYTES, "preview").await?;
    if !is_webp(&bytes) && !bytes.starts_with(&PNG_MAGIC) {
        return Err("that preview is not a WebP or a PNG".to_string());
    }
    Ok(bytes)
}

/// Install one pet: fetch its spritesheet, then write the manifest beside it.
///
/// **Nothing is written until the bytes are known to be a WebP** — `downloads::fetch_pdf`'s first
/// invariant, for the same reason: a blob stored under `spritesheet.webp` that no decoder accepts
/// becomes a mascot that renders nothing, with no error anywhere to say why.
///
/// **The manifest is the commit point.** The sheet lands first and `pet.json` second, because `list`
/// requires both — so an install that dies between them leaves a directory the shelf ignores rather
/// than a half a pet it offers. Idempotent: installing over an existing pet replaces both files.
pub async fn install(
    root: &Path,
    manifest: PetManifest,
    sheet_url: &str,
) -> Result<PetEntry, String> {
    let manifest = checked(manifest)?;
    let url = checked_url(sheet_url)?;
    let bytes = fetch_capped(url, MAX_SHEET_BYTES, "spritesheet").await?;
    if !is_webp(&bytes) {
        return Err("what came back was not a WebP spritesheet".to_string());
    }
    write_atomic(&sheet_path(root, &manifest.id)?, &bytes)?;
    write_manifest(root, &manifest)?;
    cache_row(root, &manifest);
    let bytes = bytes.len() as u64;
    Ok(PetEntry { manifest, bytes })
}

// ─── Reading and removing ────────────────────────────────────────────────────

/// The spritesheet's bytes. Raw, straight back to the webview: it is one 1.7 MB read per launch and
/// the same efficient direction of the IPC that `library::read_document` and `nb_asset_load` use.
pub fn sheet(root: &Path, id: &str) -> Result<Vec<u8>, String> {
    let path = sheet_path(root, id)?;
    std::fs::read(&path).map_err(|e| format!("{}: {e}", path.display()))
}

/// Remove a pet's directory. Irreversible here, but not a loss: the registry still has it.
///
/// The directory goes before the index row. If the cache write then fails the next `list` drops the
/// stale row by itself, whereas the other order would leave a directory `list` re-adopts —
/// `notebooks::delete`'s argument, and it holds for the same reason.
///
/// **Which pet is selected is not this module's business.** That lives in `settings.pet`, and the
/// caller is what clears it; a command that reached into study state to unselect something would give
/// this module two jobs and a reason to know about the store.
pub fn delete(root: &Path, id: &str) -> Result<(), String> {
    let dir = pet_dir(root, id)?;
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

// ─── The IPC ─────────────────────────────────────────────────────────────────
//
// Thin wrappers, one per function above. The argument names are the contract's: `invoke` sends
// `{ manifest, sheetUrl, id, url }` and these have to match it exactly.

#[tauri::command]
pub fn pet_list(dir: State<'_, PetDir>) -> Result<Vec<PetEntry>, String> {
    list(&dir.0)
}

/// The root is cloned out before the first await rather than borrowed across it: the value is one
/// `PathBuf` and this keeps the command's future plainly `Send`.
#[tauri::command]
pub async fn pet_install(
    dir: State<'_, PetDir>,
    manifest: PetManifest,
    sheet_url: String,
) -> Result<PetEntry, String> {
    let root = dir.0.clone();
    install(&root, manifest, &sheet_url).await
}

#[tauri::command]
pub fn pet_delete(dir: State<'_, PetDir>, id: String) -> Result<(), String> {
    delete(&dir.0, &id)
}

#[tauri::command]
pub fn pet_sheet(dir: State<'_, PetDir>, id: String) -> Result<tauri::ipc::Response, String> {
    Ok(tauri::ipc::Response::new(sheet(&dir.0, &id)?))
}

#[tauri::command]
pub async fn pet_registry() -> Result<String, String> {
    registry().await
}

#[tauri::command]
pub async fn pet_preview(url: String) -> Result<tauri::ipc::Response, String> {
    Ok(tauri::ipc::Response::new(preview(&url).await?))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A throwaway root, named the way every other test in this crate names one.
    fn temp_root(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "bell-pets-{tag}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn manifest(id: &str, name: &str) -> PetManifest {
        PetManifest {
            id: id.to_string(),
            display_name: name.to_string(),
            description: "A pixel companion.".to_string(),
            spritesheet_path: SHEET_FILE.to_string(),
            sprite_version_number: 2,
            kind: "person".to_string(),
        }
    }

    /// A RIFF/WEBP header plus a payload. `install` validates the signature and stores the rest
    /// verbatim, so a real encoded atlas would only make these tests harder to read.
    fn webp(tail: &[u8]) -> Vec<u8> {
        let mut out = RIFF.to_vec();
        out.extend_from_slice(&(tail.len() as u32 + 4).to_le_bytes());
        out.extend_from_slice(WEBP);
        out.extend_from_slice(tail);
        out
    }

    /// Put a pet on disk the way a finished `install` leaves one. Synchronous, so the shelf can be
    /// tested without a server — the network half is `install`, and `installs_a_live_pet` covers it.
    fn place(root: &Path, m: &PetManifest) {
        let m = checked(m.clone()).unwrap();
        write_atomic(&sheet_path(root, &m.id).unwrap(), &webp(b"atlas")).unwrap();
        write_manifest(root, &m).unwrap();
        cache_row(root, &m);
    }

    /// Every file under `dir`, path and contents, so "untouched" can be asserted byte for byte.
    fn fingerprint(dir: &Path) -> Vec<(String, Vec<u8>)> {
        fn walk(root: &Path, dir: &Path, out: &mut Vec<(String, Vec<u8>)>) {
            let Ok(entries) = std::fs::read_dir(dir) else { return };
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    walk(root, &path, out);
                } else if let Ok(bytes) = std::fs::read(&path) {
                    let rel = path.strip_prefix(root).unwrap().to_string_lossy().into_owned();
                    out.push((rel, bytes));
                }
            }
        }
        let mut out = Vec::new();
        walk(dir, dir, &mut out);
        out.sort();
        out
    }

    /// **The guard that matters most, because a pet id comes off the network.**
    ///
    /// Every command that takes an id reaches the filesystem through `pet_dir`, so one refusal covers
    /// all of them — and `checked` refuses the same id before an install writes anything.
    #[test]
    fn pet_ids_cannot_reach_outside_the_pets_dir() {
        for good in [
            "sara-heartwave-navysum-0905",
            "career-craig-navysum-0905",
            "kerno",
            "a",
            "9lives",
            &"p".repeat(64),
        ] {
            assert!(valid_id(good), "{good}");
        }

        for bad in [
            "",
            "..",
            r"..\evil",
            "a/b",
            r"a\b",
            "Sara",             // uppercase
            "sara.heartwave",   // a dot
            "-leading-dash",    // must start alphanumeric
            "sara heartwave",   // a space
            "sara_heartwave",   // underscore is not in the charset
            "sаra",             // a Cyrillic а is not an a
            &"p".repeat(65),    // one over
            "nul",              // DOS device names, whatever the charset says
            "con",
            "prn",
            "aux",
            "com1",
            "lpt9",
        ] {
            assert!(!valid_id(bad), "{bad}");
        }
        assert!(valid_id("com0"), "com0 is not a device");
        assert!(valid_id("com10"), "nor is com10");
    }

    /// The same refusal, reached through every door: no path is built and no byte is read or written.
    #[test]
    fn every_command_refuses_a_crafted_id() {
        let root = Path::new(r"C:\pets");
        assert_eq!(pet_dir(root, "kerno").unwrap(), root.join("kerno"));
        for bad in ["..", r"..\..\Windows", "a/b", "nul", ""] {
            assert!(pet_dir(root, bad).is_err(), "{bad}");
            assert!(sheet_path(root, bad).is_err(), "{bad}");
            assert!(sheet(root, bad).is_err(), "{bad}");
            assert!(delete(root, bad).is_err(), "{bad}");
            assert!(checked(manifest(bad, "Sara")).is_err(), "{bad}");
        }
    }

    /// A manifest is normalised, not trusted. The two hard refusals are the id, which becomes a
    /// directory, and an empty name, which would leave a nameless row on the shelf.
    #[test]
    fn a_manifest_is_normalised_on_the_way_in() {
        let ok = checked(PetManifest {
            display_name: "  Sara  ".to_string(),
            description: "x".repeat(400),
            // The one field a payload must never get to choose: it is a file name in a path.
            spritesheet_path: r"..\..\..\Windows\System32\evil.dll".to_string(),
            kind: String::new(),
            ..manifest("sara-heartwave-navysum-0905", "ignored")
        })
        .unwrap();
        assert_eq!(ok.display_name, "Sara", "trimmed");
        assert_eq!(ok.description.chars().count(), 300, "clamped, not refused");
        assert_eq!(ok.spritesheet_path, SHEET_FILE, "overwritten, never trusted");
        assert_eq!(ok.kind, "pet", "an empty kind falls back rather than rendering blank");

        // Clamping counts CHARACTERS: a byte-wise truncate could split one of these in half and
        // leave `display_name` holding invalid UTF-8.
        let wide = checked(PetManifest {
            display_name: "🦀".repeat(120),
            ..manifest("crabs", "ignored")
        })
        .unwrap();
        assert_eq!(wide.display_name.chars().count(), 80);

        assert!(checked(manifest("sara", "   ")).is_err(), "a pet needs a name");
        assert!(checked(manifest("sara", "")).is_err());
        assert!(checked(manifest("..", "Sara")).is_err());
    }

    /// The URLs come from the registry's JSON by way of the webview, so this is what stops a crafted
    /// row turning `pet_install` into a fetcher pointed anywhere on the machine's network.
    #[test]
    fn only_the_registrys_own_host_may_be_fetched() {
        let base = DEFAULT_REGISTRY;
        assert!(checked_url_in(
            "https://codex-pets.net/assets/pets/v/1788633460733/sara/spritesheet.webp",
            base
        )
        .is_ok());

        for bad in [
            "http://codex-pets.net/x.webp",             // downgraded scheme
            "https://codex-pets.net.evil.example/x",    // suffix, not the host
            "https://evil.example/x.webp",
            "https://sub.codex-pets.net/x.webp",        // a subdomain is a different host
            "file:///C:/Windows/System32/config/SAM",
            "http://127.0.0.1:1420/x",
            "http://localhost/x",
            "not a url",
            "",
        ] {
            assert!(checked_url_in(bad, base).is_err(), "{bad}");
        }

        // A development override NARROWS the allowlist to whatever it names, rather than widening it.
        let local = "http://localhost:8787";
        assert!(checked_url_in("http://localhost:8787/api/pets", local).is_ok());
        assert!(checked_url_in("https://codex-pets.net/x.webp", local).is_err());
    }

    /// A blob under a `.webp` name is how a pet ends up as a mascot that renders nothing.
    #[test]
    fn rejects_anything_that_is_not_a_webp() {
        assert!(is_webp(&webp(b"atlas")));
        assert!(!is_webp(b"<!DOCTYPE html><title>404</title>"));
        assert!(!is_webp(&PNG_MAGIC), "a PNG is not a spritesheet");
        assert!(!is_webp(b"RIFF"), "half a signature");
        assert!(!is_webp(b"RIFF\x04\x00\x00\x00WEBP"), "a header and no payload");
        assert!(!is_webp(b""));
    }

    /// `index.json` is a cache. Losing it must cost a directory walk and never a pet, and a row for a
    /// pet whose files have gone must not leave a tile that selects a mascot the app cannot draw.
    #[test]
    fn the_shelf_heals_itself_from_the_manifests() {
        let root = temp_root("shelf");
        place(&root, &manifest("sara-heartwave-navysum-0905", "Sara"));
        place(&root, &manifest("kerno", "Kerno"));

        let index = root.join(INDEX_FILE);
        assert!(index.exists(), "an install writes the cache");
        std::fs::remove_file(&index).unwrap();

        let healed = list(&root).unwrap();
        assert_eq!(healed.len(), 2, "rebuilt from the pet.json files");
        assert_eq!(healed[0].manifest.display_name, "Kerno", "sorted by name");
        assert_eq!(healed[1].manifest.display_name, "Sara");
        assert_eq!(healed[1].bytes, webp(b"atlas").len() as u64);
        assert!(index.exists(), "and the cache was written back");

        // A row whose directory has gone — a pet deleted in Explorer, or a cache that outlived one.
        let mut rows = read_index(&root);
        let mut ghost = rows[0].clone();
        ghost.id = "deleted-in-explorer".to_string();
        rows.push(ghost);
        write_index(&root, &rows).unwrap();
        assert_eq!(list(&root).unwrap().len(), 2, "the ghost is dropped");
        assert_eq!(read_index(&root).len(), 2, "and the cache no longer carries it");

        // Both halves are required, which is the one place this differs from a notebook: a pet with no
        // sheet cannot render, and the fix is to install it again rather than to keep the row.
        let sheetless = root.join("sheetless");
        std::fs::create_dir_all(&sheetless).unwrap();
        std::fs::copy(root.join("kerno").join(MANIFEST_FILE), sheetless.join(MANIFEST_FILE)).unwrap();
        assert_eq!(list(&root).unwrap().len(), 2, "a manifest with no spritesheet is not a pet");
        std::fs::remove_file(root.join("kerno").join(MANIFEST_FILE)).unwrap();
        assert_eq!(list(&root).unwrap().len(), 1, "nor a spritesheet with no manifest");

        // A hand-copied pet directory is adopted — the other half of the reconciliation.
        let copied = root.join("hand-copied");
        std::fs::create_dir_all(&copied).unwrap();
        for file in [MANIFEST_FILE, SHEET_FILE] {
            std::fs::copy(
                root.join("sara-heartwave-navysum-0905").join(file),
                copied.join(file),
            )
            .unwrap();
        }
        let adopted = list(&root).unwrap();
        assert_eq!(adopted.len(), 2);
        let found = adopted.iter().find(|r| r.manifest.id == "hand-copied").unwrap();
        assert_eq!(found.manifest.display_name, "Sara");
        assert_eq!(found.manifest.id, "hand-copied", "the directory names it, not the copied file");

        // A healthy shelf render writes nothing. Compact JSON is the same rows in different text, so
        // surviving a `list` byte for byte is what proves it.
        let compact = serde_json::to_string(&read_index(&root)).unwrap();
        std::fs::write(&index, &compact).unwrap();
        let _ = list(&root).unwrap();
        assert_eq!(std::fs::read_to_string(&index).unwrap(), compact);

        delete(&root, "hand-copied").unwrap();
        assert!(!copied.exists());
        assert_eq!(list(&root).unwrap().len(), 1);
        delete(&root, "hand-copied").unwrap();

        std::fs::remove_dir_all(&root).ok();
    }

    /// **Nothing that clears the catalogue or resets study state may touch `pets\`.**
    ///
    /// The same rule `notebooks` gets, for a weaker but sufficient reason: a pet is not authored work,
    /// but it is a 1.7 MB download the student chose, and re-fetching it needs the network — which the
    /// rest of this app is built never to require. `settings.pet` lives in study state and *is* cleared,
    /// so a reset returns the mascot to Mr. Bell while leaving the installed pets on disk.
    #[test]
    fn a_resync_and_a_reset_leave_pets_untouched() {
        let root = temp_root("resync");
        let pets = root.join("pets");
        let state_dir = root.join("state");
        std::fs::create_dir_all(&state_dir).unwrap();
        place(&pets, &manifest("sara-heartwave-navysum-0905", "Sara"));

        // A used install: a catalogue to clear, and a state key for the reset to take.
        let conn = crate::db::open(&root.join("index.sqlite3")).unwrap();
        conn.execute(
            "INSERT INTO catalog_subject(id,code,name,slug,qualification,board)
             VALUES(65,'9709','Mathematics','mathematics','a_level','caie')",
            [],
        )
        .unwrap();
        std::fs::write(state_dir.join("settings.json"), br#"{"pet":"sara"}"#).unwrap();

        let before = fingerprint(&pets);
        assert!(before.len() >= 3, "a manifest, a spritesheet and the index");

        crate::db::clear_catalog(&conn).unwrap();
        let report = crate::state::reset_into(&conn, &state_dir).unwrap();
        assert_eq!(report.state_files, 1, "the reset really did run");

        assert_eq!(fingerprint(&pets), before, "pets\\ is byte for byte as it was");
        assert_eq!(list(&pets).unwrap().len(), 1);
        assert!(!state_dir.join("settings.json").exists(), "but the selection went with the state");

        std::fs::remove_dir_all(&root).ok();
    }

    /// The registry, live. This is what catches a breaking change to somebody else's API.
    ///
    /// Ignored by default because it needs the network. Field additions are safe — `parseRegistry` and
    /// `PetManifest` both ignore what they do not know — so what this asserts is the narrow set of
    /// things Bell cannot absorb: that `pets` is still an array of rows carrying an id this app will
    /// put in a path, a spritesheet on the permitted host, and an atlas whose geometry
    /// `atlasVersionForHeight` in `src/lib/pets.ts` can still resolve.
    ///
    ///   cd src-tauri && cargo test --lib -- --ignored --nocapture
    #[test]
    #[ignore = "reaches codex-pets.net"]
    fn the_live_registry_still_serves_atlases_bell_can_slice() {
        let url = format!("{}/api/pets", registry_base());
        eprintln!("fetching {url}");
        let client = reqwest::blocking::Client::builder()
            .user_agent(catalog::USER_AGENT)
            .build()
            .expect("client");
        let res = client.get(&url).send().expect("request");
        assert!(res.status().is_success(), "status was {}", res.status());

        let body: serde_json::Value = res.json().expect("JSON");
        let rows = body["pets"].as_array().expect("`pets` must be an array");
        assert!(!rows.is_empty(), "an empty registry is a change worth noticing");
        eprintln!("  {} pets", rows.len());

        let mut sizes: std::collections::BTreeMap<String, usize> = Default::default();
        for row in rows {
            let id = row["id"].as_str().unwrap_or_default();
            assert!(valid_id(id), "id {id:?} could not be a directory name");
            assert!(row["displayName"].as_str().is_some_and(|n| !n.is_empty()), "{id} has no name");
            let sheet = row["spritesheetUrl"].as_str().unwrap_or_default();
            assert!(checked_url(sheet).is_ok(), "{id}: {sheet} is off the permitted host");

            let report = &row["validationReport"];
            assert_eq!(report["cellSize"], "192x208", "{id} is not on 192x208 cells");
            let size = report["atlasSize"].as_str().unwrap_or_default().to_string();
            assert!(
                size == "1536x1872" || size == "1536x2288",
                "{id} is a {size} atlas, which src/lib/pets.ts cannot slice"
            );
            *sizes.entry(size).or_default() += 1;
        }
        eprintln!("  atlases: {sizes:?}");
    }

    /// The install path, for real: fetch the registry, take the first pet, and put it on disk.
    ///
    /// Ignored by default because it needs the network. Everything `install` does is exercised here —
    /// the host check, the capped fetch, the WebP guard, the atomic writes and the shelf that reads
    /// them back — against a throwaway root, so it touches nothing in anybody's app data.
    ///
    ///   cd src-tauri && cargo test --lib -- --ignored --nocapture
    #[test]
    #[ignore = "reaches codex-pets.net"]
    fn installs_a_live_pet_into_a_throwaway_root() {
        let root = temp_root("live");

        let client = reqwest::blocking::Client::builder()
            .user_agent(catalog::USER_AGENT)
            .build()
            .expect("client");
        let body: serde_json::Value = client
            .get(format!("{}/api/pets", registry_base()))
            .send()
            .expect("request")
            .json()
            .expect("JSON");
        let row = &body["pets"][0];
        let id = row["id"].as_str().expect("an id").to_string();
        let sheet_url = row["spritesheetUrl"].as_str().expect("a sheet URL").to_string();
        eprintln!("installing {id}");

        let manifest = PetManifest {
            id: id.clone(),
            display_name: row["displayName"].as_str().unwrap_or("Pet").to_string(),
            description: row["description"].as_str().unwrap_or_default().to_string(),
            spritesheet_path: SHEET_FILE.to_string(),
            sprite_version_number: row["spriteVersionNumber"].as_u64().unwrap_or(1) as u32,
            kind: row["kind"].as_str().unwrap_or("pet").to_string(),
        };

        // `install` is async, and this test is not — a current-thread runtime is the whole bridge.
        let entry = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("runtime")
            .block_on(install(&root, manifest, &sheet_url))
            .expect("install");

        eprintln!("  {} bytes to {}", entry.bytes, root.join(&id).display());
        assert!(entry.bytes > 1024, "a real atlas is not 1 KB");

        let sheet = std::fs::read(root.join(&id).join(SHEET_FILE)).unwrap();
        assert!(is_webp(&sheet), "what landed on disk is a WebP");
        assert_eq!(sheet.len() as u64, entry.bytes);

        // The manifest is what `list` reads back, and the directory is what names the pet.
        let stored = read_manifest(&root, &id).unwrap();
        assert_eq!(stored.id, id);
        assert_eq!(stored.spritesheet_path, SHEET_FILE);
        let shelf = list(&root).unwrap();
        assert_eq!(shelf.len(), 1);
        assert_eq!(shelf[0].manifest.id, id);

        // Idempotent: installing again replaces both files rather than doubling anything up.
        let again = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("runtime")
            .block_on(install(&root, stored, &sheet_url))
            .expect("re-install");
        assert_eq!(again.bytes, entry.bytes);
        assert_eq!(list(&root).unwrap().len(), 1);
        assert!(
            !root.join(&id).join(format!("{SHEET_FILE}.tmp")).exists(),
            "no temp file survives a successful write"
        );

        // The gallery thumbnail travels the same road, and it is the one byte-path the shelf uses that
        // writes nothing — so it is only ever verified here.
        let preview_url = row["previewUrl"].as_str().expect("a preview URL").to_string();
        let bytes = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("runtime")
            .block_on(preview(&preview_url))
            .expect("preview");
        eprintln!("  preview {} bytes", bytes.len());
        assert!(is_webp(&bytes) || bytes.starts_with(&PNG_MAGIC));

        std::fs::remove_dir_all(&root).ok();
    }
}
