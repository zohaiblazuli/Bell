//! Community Resources: the hosted catalogue boundary and its local, offline-safe PDF cache.
//!
//! The webview never talks to Supabase. Public catalogue calls, anonymous vote identity, signed
//! downloads, the one administrator session, and resumable quarantine uploads all terminate here.
//! As with past papers, a local database row is what authorises `read_document`; a path supplied by
//! JavaScript is never enough by itself.

use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use reqwest::{Client, Method, Response, Url};
use rusqlite::{params, OptionalExtension};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, State};

use crate::catalog::USER_AGENT;
use crate::db::{install_id, Db};
use crate::downloads::{download_root, is_pdf_on_disk};

const MAX_RESOURCE_BYTES: u64 = 200 * 1024 * 1024;
// Google Drive resumable uploads require every non-final chunk to be a multiple of 256 KiB.
const DRIVE_CHUNK_BYTES: usize = 8 * 1024 * 1024;

#[derive(Default)]
pub struct CommunitySession(Mutex<Option<AdminSession>>);

/// In-memory thumbnail cache keyed by resource id. Avoids repeated two-hop
/// signed-URL-then-download round trips for the same thumbnail.
#[derive(Default)]
pub struct ThumbnailCache(Mutex<HashMap<String, Vec<u8>>>);

#[derive(Clone)]
struct AdminSession {
    access_token: String,
    refresh_token: String,
    user_id: String,
    username: String,
    factor_id: String,
    #[allow(dead_code)]
    mfa_enrollment: Option<String>,
    mfa_verified: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunityStatus {
    configured: bool,
    message: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunityResource {
    id: String,
    title: String,
    description: String,
    qualification: String,
    level: String,
    subject_code: String,
    subject_name: String,
    resource_type: String,
    author_name: String,
    uploader_name: String,
    contributor_credit: Option<String>,
    source_url: Option<String>,
    rights_confirmed: bool,
    page_count: Option<i64>,
    size_bytes: u64,
    sha256: Option<String>,
    version: i64,
    upvotes: i64,
    downloads: i64,
    opens: i64,
    popularity_score: f64,
    published_at: Option<String>,
    created_at: String,
    updated_at: String,
    status: String,
    scan_status: Option<String>,
    has_voted: bool,
    local_path: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunityListResponse {
    items: Vec<CommunityResource>,
    total: i64,
    next_cursor: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunityQuery {
    query: Option<String>,
    qualification: Option<String>,
    subject_code: Option<String>,
    resource_type: Option<String>,
    sort: Option<String>,
    cursor: Option<String>,
    limit: Option<u32>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunityVoteResult {
    has_voted: bool,
    upvotes: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunityDownloadResult {
    resource_id: String,
    version: i64,
    path: String,
    size: u64,
    cached: bool,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunityAdminIdentity {
    user_id: String,
    username: String,
    requires_mfa: bool,
    factor_id: Option<String>,
    mfa_enrollment: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunityAdminStats {
    published: i64,
    drafts: i64,
    quarantined: i64,
    storage_bytes: u64,
    opens30d: i64,
    downloads30d: i64,
    upvotes30d: i64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunityCreateInput {
    title: String,
    description: String,
    qualification: String,
    subject_code: String,
    subject_name: String,
    resource_type: String,
    author_name: String,
    uploader_name: String,
    contributor_credit: Option<String>,
    source_url: Option<String>,
    rights_confirmed: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunityUpdateInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub qualification: Option<String>,
    pub subject_code: Option<String>,
    pub subject_name: Option<String>,
    pub resource_type: Option<String>,
    pub author_name: Option<String>,
    pub uploader_name: Option<String>,
    pub contributor_credit: Option<String>,
    pub source_url: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct SignedFile {
    url: String,
    sha256: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DriveUploadSession {
    upload_url: String,
}

#[derive(Deserialize)]
struct DriveUploadResult {
    id: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommunityUploadProgress {
    resource_id: String,
    uploaded: u64,
    total: u64,
    phase: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunityAdminInspection {
    security_events: Vec<CommunitySecurityEvent>,
    audit_trail: Vec<CommunityAuditEvent>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommunitySecurityEvent {
    action: String,
    ip: String,
    created_at: String,
    expires_at: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommunityAuditEvent {
    action: String,
    detail: serde_json::Value,
    created_at: String,
}

fn community_api_base() -> Option<String> {
    std::env::var("BELL_COMMUNITY_API_BASE")
        .ok()
        .or_else(|| option_env!("BELL_COMMUNITY_API_BASE").map(str::to_string))
        .map(|value| value.trim_end_matches('/').to_string())
        .filter(|value| !value.is_empty())
}

fn supabase_url() -> Option<String> {
    std::env::var("BELL_SUPABASE_URL")
        .ok()
        .or_else(|| option_env!("BELL_SUPABASE_URL").map(str::to_string))
        .map(|value| value.trim_end_matches('/').to_string())
        .filter(|value| !value.is_empty())
}

fn publishable_key() -> Option<String> {
    std::env::var("BELL_SUPABASE_PUBLISHABLE_KEY")
        .ok()
        .or_else(|| option_env!("BELL_SUPABASE_PUBLISHABLE_KEY").map(str::to_string))
        .filter(|value| !value.is_empty())
}

fn public_url(route: &str) -> Result<String, String> {
    community_api_base()
        .map(|base| format!("{base}/community-public{}", with_slash(route)))
        .ok_or_else(|| "Community Resources has not been connected yet.".to_string())
}

fn admin_url(route: &str) -> Result<String, String> {
    community_api_base()
        .map(|base| format!("{base}/community-admin{}", with_slash(route)))
        .ok_or_else(|| {
            "The Community Resources administrator service is not configured.".to_string()
        })
}

fn with_slash(route: &str) -> String {
    if route.starts_with('/') {
        route.to_string()
    } else {
        format!("/{route}")
    }
}

fn client() -> Result<Client, String> {
    static CLIENT: OnceLock<Result<Client, String>> = OnceLock::new();
    match CLIENT.get_or_init(|| {
        Client::builder()
            .user_agent(USER_AGENT)
            .redirect(reqwest::redirect::Policy::limited(5))
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(60))
            .build()
            .map_err(|error| error.to_string())
    }) {
        Ok(client) => Ok(client.clone()),
        Err(error) => Err(error.clone()),
    }
}

async fn json_response<T: DeserializeOwned>(response: Response) -> Result<T, String> {
    let status = response.status();
    let text = response.text().await.map_err(|error| error.to_string())?;
    if !status.is_success() {
        let parsed: serde_json::Value = serde_json::from_str(&text).unwrap_or_default();
        let message = parsed
            .get("error")
            .or_else(|| parsed.get("message"))
            .and_then(|value| value.as_str())
            .unwrap_or(&text);
        return Err(if message.is_empty() {
            format!("the community service answered HTTP {}", status.as_u16())
        } else {
            message.to_string()
        });
    }
    serde_json::from_str(&text).map_err(|error| format!("invalid community response: {error}"))
}

fn public_request(request: reqwest::RequestBuilder, install: &str) -> reqwest::RequestBuilder {
    request.header("x-bell-install-id", install)
}

#[tauri::command]
pub fn community_status() -> CommunityStatus {
    let configured = community_api_base().is_some();
    CommunityStatus {
        configured,
        message: (!configured).then(|| {
            "Connect a Supabase project at build time to publish the community catalogue."
                .to_string()
        }),
    }
}

#[tauri::command]
pub async fn community_list(
    db: State<'_, Db>,
    query: CommunityQuery,
) -> Result<CommunityListResponse, String> {
    let install = {
        let connection = db.0.lock().map_err(|error| error.to_string())?;
        install_id(&connection)
    };
    let mut url = Url::parse(&public_url("/resources")?).map_err(|error| error.to_string())?;
    {
        let mut pairs = url.query_pairs_mut();
        if let Some(value) = query.query.filter(|value| !value.trim().is_empty()) {
            pairs.append_pair("q", value.trim());
        }
        if let Some(value) = query.qualification {
            pairs.append_pair("qualification", &value);
        }
        if let Some(value) = query.subject_code {
            pairs.append_pair("subject", &value);
        }
        if let Some(value) = query.resource_type {
            pairs.append_pair("type", &value);
        }
        if let Some(value) = query.sort {
            pairs.append_pair("sort", &value);
        }
        if let Some(value) = query.cursor {
            pairs.append_pair("cursor", &value);
        }
        pairs.append_pair("limit", &query.limit.unwrap_or(30).min(60).to_string());
    }
    let response = public_request(client()?.get(url), &install)
        .send()
        .await
        .map_err(|error| format!("Community Resources could not connect: {error}"))?;
    let mut list: CommunityListResponse = json_response(response).await?;
    let connection = db.0.lock().map_err(|error| error.to_string())?;
    for resource in &mut list.items {
        resource.local_path = local_path(&connection, &resource.id, resource.version);
    }
    Ok(list)
}

#[tauri::command]
pub async fn community_get(
    db: State<'_, Db>,
    resource_id: String,
) -> Result<CommunityResource, String> {
    checked_resource_id(&resource_id)?;
    let install = {
        let connection = db.0.lock().map_err(|error| error.to_string())?;
        install_id(&connection)
    };
    let response = public_request(
        client()?.get(public_url(&format!("/resources/{resource_id}"))?),
        &install,
    )
    .send()
    .await
    .map_err(|error| error.to_string())?;
    let mut resource: CommunityResource = json_response(response).await?;
    let connection = db.0.lock().map_err(|error| error.to_string())?;
    resource.local_path = local_path(&connection, &resource.id, resource.version);
    Ok(resource)
}

#[tauri::command]
pub async fn community_thumbnail(
    db: State<'_, Db>,
    cache: State<'_, ThumbnailCache>,
    resource_id: String,
) -> Result<tauri::ipc::Response, String> {
    checked_resource_id(&resource_id)?;

    // Return cached thumbnail if available.
    {
        let store = cache.0.lock().map_err(|error| error.to_string())?;
        if let Some(bytes) = store.get(&resource_id) {
            return Ok(tauri::ipc::Response::new(bytes.clone()));
        }
    }

    let install = {
        let connection = db.0.lock().map_err(|error| error.to_string())?;
        install_id(&connection)
    };
    let signed = public_request(
        client()?.get(public_url(&format!("/resources/{resource_id}/thumbnail"))?),
        &install,
    )
    .send()
    .await
    .map_err(|error| error.to_string())?;
    let file: SignedFile = json_response(signed).await?;
    let response = client()?
        .get(file.url)
        .send()
        .await
        .map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err("The resource preview could not be loaded.".to_string());
    }
    let bytes = response.bytes().await.map_err(|error| error.to_string())?;
    if bytes.len() > 5 * 1024 * 1024 {
        return Err("The resource preview was unexpectedly large.".to_string());
    }
    let data = bytes.to_vec();

    // Cache for subsequent requests.
    {
        let mut store = cache.0.lock().map_err(|error| error.to_string())?;
        if store.len() >= 48 {
            if let Some(oldest) = store.keys().next().cloned() {
                store.remove(&oldest);
            }
        }
        store.insert(resource_id, data.clone());
    }

    Ok(tauri::ipc::Response::new(data))
}

#[tauri::command]
pub async fn community_vote(
    db: State<'_, Db>,
    resource_id: String,
    desired: bool,
) -> Result<CommunityVoteResult, String> {
    checked_resource_id(&resource_id)?;
    let install = {
        let connection = db.0.lock().map_err(|error| error.to_string())?;
        install_id(&connection)
    };
    let response = public_request(
        client()?
            .put(public_url(&format!("/resources/{resource_id}/vote"))?)
            .json(&serde_json::json!({ "desired": desired })),
        &install,
    )
    .send()
    .await
    .map_err(|error| error.to_string())?;
    json_response(response).await
}

async fn record_event(db: &Db, resource_id: &str, event_type: &str) -> Result<(), String> {
    let install = {
        let connection = db.0.lock().map_err(|error| error.to_string())?;
        install_id(&connection)
    };
    let response = public_request(
        client()?
            .post(public_url(&format!("/resources/{resource_id}/event"))?)
            .json(&serde_json::json!({ "type": event_type })),
        &install,
    )
    .send()
    .await
    .map_err(|error| error.to_string())?;
    if response.status().is_success() {
        Ok(())
    } else {
        Err("The resource activity could not be recorded.".to_string())
    }
}

#[tauri::command]
pub async fn community_record_open(db: State<'_, Db>, resource_id: String) -> Result<(), String> {
    checked_resource_id(&resource_id)?;
    record_event(&db, &resource_id, "open").await
}

fn local_path(
    connection: &rusqlite::Connection,
    resource_id: &str,
    version: i64,
) -> Option<String> {
    let result: Option<String> = connection
        .query_row(
            "SELECT path FROM community_download WHERE resource_id=?1 AND version=?2",
            params![resource_id, version],
            |row| row.get(0),
        )
        .optional()
        .ok()
        .flatten();
    result.filter(|path| is_pdf_on_disk(Path::new(path)))
}

fn safe_segment(value: &str, fallback: &str) -> String {
    let mut out = String::with_capacity(value.len().min(80));
    for character in value.chars().take(80) {
        if character.is_ascii_alphanumeric() || matches!(character, ' ' | '-' | '_' | '(' | ')') {
            out.push(character);
        }
    }
    let clean = out.trim().trim_end_matches('.').trim().to_string();
    if clean.is_empty() {
        fallback.to_string()
    } else {
        clean
    }
}

fn checked_resource_id(value: &str) -> Result<(), String> {
    let valid = value.len() >= 16
        && value.len() <= 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() || byte == b'-');
    if valid {
        Ok(())
    } else {
        Err("invalid community resource id".to_string())
    }
}

fn resource_target(app: &AppHandle, resource: &CommunityResource) -> Result<PathBuf, String> {
    checked_resource_id(&resource.id)?;
    let level = safe_segment(&resource.level, "Other");
    let subject = safe_segment(
        &format!("{} ({})", resource.subject_name, resource.subject_code),
        "Subject",
    );
    let short_id: String = resource
        .id
        .chars()
        .filter(|c| c.is_ascii_hexdigit())
        .take(8)
        .collect();
    let title = safe_segment(&resource.title, "Community resource");
    Ok(download_root(app)?
        .join("Community Resources")
        .join(level)
        .join(subject)
        .join(format!("{title} ({short_id}).pdf")))
}

async fn download_signed(
    app: &AppHandle,
    db: &Db,
    resource: &CommunityResource,
    signed: SignedFile,
) -> Result<CommunityDownloadResult, String> {
    let target = resource_target(app, resource)?;
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    if is_pdf_on_disk(&target) {
        let size = std::fs::metadata(&target)
            .map(|meta| meta.len())
            .unwrap_or(0);
        let connection = db.0.lock().map_err(|error| error.to_string())?;
        record_download(
            &connection,
            resource,
            &target,
            size,
            resource.sha256.as_deref(),
        )?;
        return Ok(CommunityDownloadResult {
            resource_id: resource.id.clone(),
            version: resource.version,
            path: target.to_string_lossy().into_owned(),
            size,
            cached: true,
        });
    }

    let part = target.with_extension("pdf.part");
    let result = async {
        let mut response = client()?
            .get(&signed.url)
            .send()
            .await
            .map_err(|error| format!("The PDF download was interrupted: {error}"))?;
        if !response.status().is_success() {
            return Err("The PDF could not be downloaded.".to_string());
        }
        if response
            .content_length()
            .is_some_and(|size| size > MAX_RESOURCE_BYTES)
        {
            return Err("That PDF exceeds Bell's 200 MB limit.".to_string());
        }
        let content_length = response
            .content_length()
            .filter(|&size| size > 0);
        let mut total = content_length.unwrap_or(resource.size_bytes);
        let mut output = File::create(&part).map_err(|error| error.to_string())?;
        let mut digest = Sha256::new();
        let mut downloaded = 0u64;
        while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
            downloaded += chunk.len() as u64;
            if downloaded > MAX_RESOURCE_BYTES {
                return Err("That PDF exceeds Bell's 200 MB limit.".to_string());
            }
            if total > 0 && downloaded > total {
                total = downloaded;
            }
            digest.update(&chunk);
            output
                .write_all(&chunk)
                .map_err(|error| error.to_string())?;
            let _ = app.emit(
                "community:download-progress",
                CommunityUploadProgress {
                    resource_id: resource.id.clone(),
                    uploaded: downloaded,
                    total,
                    phase: Some("downloading".to_string()),
                },
            );
        }
        let _ = app.emit(
            "community:download-progress",
            CommunityUploadProgress {
                resource_id: resource.id.clone(),
                uploaded: downloaded,
                total: if total == 0 { downloaded } else { total },
                phase: Some("verifying".to_string()),
            },
        );
        output.flush().map_err(|error| error.to_string())?;
        if !is_pdf_on_disk(&part) {
            return Err("The downloaded file was not a PDF.".to_string());
        }
        let actual = format!("{:x}", digest.finalize());
        let expected = signed.sha256.as_deref().or(resource.sha256.as_deref());
        if expected.is_some_and(|hash| !hash.eq_ignore_ascii_case(&actual)) {
            return Err("The downloaded PDF did not match its published checksum.".to_string());
        }
        std::fs::rename(&part, &target).map_err(|error| error.to_string())?;
        let connection = db.0.lock().map_err(|error| error.to_string())?;
        record_download(&connection, resource, &target, downloaded, Some(&actual))?;
        Ok(CommunityDownloadResult {
            resource_id: resource.id.clone(),
            version: resource.version,
            path: target.to_string_lossy().into_owned(),
            size: downloaded,
            cached: false,
        })
    }
    .await;
    if result.is_err() {
        let _ = std::fs::remove_file(part);
    }
    result
}

fn record_download(
    connection: &rusqlite::Connection,
    resource: &CommunityResource,
    path: &Path,
    size: u64,
    sha256: Option<&str>,
) -> Result<(), String> {
    connection.execute(
        "INSERT INTO community_download(resource_id,version,path,size,sha256,downloaded_at)
         VALUES(?1,?2,?3,?4,?5,datetime('now'))
         ON CONFLICT(resource_id,version) DO UPDATE SET path=excluded.path,size=excluded.size,sha256=excluded.sha256,downloaded_at=excluded.downloaded_at",
        params![resource.id, resource.version, path.to_string_lossy(), size as i64, sha256],
    ).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn community_download(
    app: AppHandle,
    db: State<'_, Db>,
    resource: CommunityResource,
) -> Result<CommunityDownloadResult, String> {
    if resource.status != "published" {
        return Err("Only published resources can be downloaded.".to_string());
    }
    let install = {
        let connection = db.0.lock().map_err(|error| error.to_string())?;
        install_id(&connection)
    };
    let response = public_request(
        client()?.get(public_url(&format!("/resources/{}/download", resource.id))?),
        &install,
    )
    .send()
    .await
    .map_err(|error| error.to_string())?;
    let signed: SignedFile = json_response(response).await?;
    let result = download_signed(&app, &db, &resource, signed).await?;
    let _ = record_event(&db, &resource.id, "download").await;
    Ok(result)
}

#[tauri::command]
pub fn community_read_document(
    db: State<'_, Db>,
    path: String,
) -> Result<tauri::ipc::Response, String> {
    let connection = db.0.lock().map_err(|error| error.to_string())?;
    let row: Option<(String, i64)> = connection
        .query_row(
            "SELECT resource_id,version FROM community_download WHERE path=?1",
            [&path],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    let Some((resource_id, version)) = row else {
        return Err("that path is not a Bell community download".to_string());
    };
    match std::fs::read(&path) {
        Ok(bytes) if bytes.starts_with(b"%PDF-") => Ok(tauri::ipc::Response::new(bytes)),
        Ok(_) => Err("the recorded community file is no longer a PDF".to_string()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            let _ = connection.execute(
                "DELETE FROM community_download WHERE resource_id=?1 AND version=?2",
                params![resource_id, version],
            );
            Err("that community PDF is no longer on this machine".to_string())
        }
        Err(error) => Err(error.to_string()),
    }
}

#[derive(Deserialize)]
struct AuthFactor {
    id: String,
    status: Option<String>,
    factor_type: Option<String>,
}
#[derive(Deserialize)]
struct AuthUser {
    id: String,
    factors: Option<Vec<AuthFactor>>,
}
#[derive(Deserialize)]
struct AuthResponse {
    access_token: String,
    refresh_token: String,
    user: AuthUser,
}
#[derive(Deserialize)]
struct ChallengeResponse {
    id: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AdminMe {
    user_id: String,
    username: String,
}
#[derive(Deserialize)]
struct MfaTotp {
    qr_code: String,
}
#[derive(Deserialize)]
struct MfaEnrollment {
    id: String,
    totp: MfaTotp,
}

fn auth_headers(request: reqwest::RequestBuilder, key: &str) -> reqwest::RequestBuilder {
    request.header("apikey", key)
}

async fn confirm_admin(access_token: &str, route: &str) -> Result<AdminMe, String> {
    let response = client()?
        .get(admin_url(route)?)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|error| error.to_string())?;
    json_response(response).await
}

fn admin_login_email(username: &str) -> Result<(String, String), String> {
    let username = username.trim().to_ascii_lowercase();
    let valid = (3..=64).contains(&username.len())
        && username.chars().enumerate().all(|(index, value)| {
            value.is_ascii_lowercase()
                || value.is_ascii_digit()
                || (index > 0 && matches!(value, '_' | '-'))
        });
    if !valid {
        return Err("Enter a valid administrator username.".to_string());
    }
    Ok((username.clone(), format!("{username}@auth.bell.invalid")))
}

#[derive(Clone, Serialize, Deserialize)]
struct PersistedAdminSession {
    access_token: String,
    refresh_token: String,
    user_id: String,
    username: String,
    factor_id: String,
}

fn load_persisted_session(db: &Db) -> Option<PersistedAdminSession> {
    let conn = db.0.lock().ok()?;
    let json_str = crate::db::get_meta(&conn, "community_admin_session")?;
    serde_json::from_str(&json_str).ok()
}

fn save_persisted_session(db: &Db, session: &PersistedAdminSession) {
    if let Ok(conn) = db.0.lock() {
        if let Ok(json_str) = serde_json::to_string(session) {
            let _ = crate::db::set_meta(&conn, "community_admin_session", &json_str);
            let _ = crate::db::set_meta(&conn, "community_admin_last_username", &session.username);
        }
    }
}

fn clear_persisted_session(db: &Db) {
    if let Ok(conn) = db.0.lock() {
        let _ = conn.execute("DELETE FROM meta WHERE k = 'community_admin_session'", []);
    }
}

fn get_last_admin_username(db: &Db) -> Option<String> {
    let conn = db.0.lock().ok()?;
    crate::db::get_meta(&conn, "community_admin_last_username")
}

async fn refresh_admin_token(
    base: &str,
    key: &str,
    refresh_token: &str,
) -> Result<AuthResponse, String> {
    let response = auth_headers(
        client()?
            .post(format!("{base}/auth/v1/token?grant_type=refresh_token"))
            .json(&serde_json::json!({ "refresh_token": refresh_token })),
        key,
    )
    .send()
    .await
    .map_err(|error| error.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Refresh failed ({status}): {text}"));
    }

    json_response(response).await
}

async fn refresh_admin_token_session(
    db: &Db,
    session: &CommunitySession,
) -> Result<String, String> {
    let base =
        supabase_url().ok_or_else(|| "Supabase authentication is not configured.".to_string())?;
    let key = publishable_key()
        .ok_or_else(|| "The Supabase publishable key is not configured.".to_string())?;

    let (refresh_token, factor_id): (String, String) = {
        let guard = session.0.lock().map_err(|e| e.to_string())?;
        if let Some(ref current) = *guard {
            (current.refresh_token.clone(), current.factor_id.clone())
        } else if let Some(persisted) = load_persisted_session(db) {
            (persisted.refresh_token, persisted.factor_id)
        } else {
            return Err("Administrator sign-in required.".to_string());
        }
    };

    let auth = refresh_admin_token(&base, &key, &refresh_token).await?;
    let approved = confirm_admin(&auth.access_token, "/identity").await?;

    let new_persisted = PersistedAdminSession {
        access_token: auth.access_token.clone(),
        refresh_token: auth.refresh_token.clone(),
        user_id: auth.user.id.clone(),
        username: approved.username.clone(),
        factor_id: factor_id.clone(),
    };
    save_persisted_session(db, &new_persisted);

    let mut guard = session.0.lock().map_err(|e| e.to_string())?;
    *guard = Some(AdminSession {
        access_token: auth.access_token.clone(),
        refresh_token: auth.refresh_token,
        user_id: new_persisted.user_id,
        username: approved.username,
        factor_id,
        mfa_enrollment: None,
        mfa_verified: true,
    });

    Ok(auth.access_token)
}

#[tauri::command]
pub fn community_admin_saved_username(db: State<'_, Db>) -> Option<String> {
    get_last_admin_username(&db)
}

#[tauri::command]
pub async fn community_admin_status(
    db: State<'_, Db>,
    session: State<'_, CommunitySession>,
) -> Result<Option<CommunityAdminIdentity>, String> {
    if let Ok(guard) = session.0.lock() {
        if let Some(ref current) = *guard {
            if current.mfa_verified {
                return Ok(Some(CommunityAdminIdentity {
                    user_id: current.user_id.clone(),
                    username: current.username.clone(),
                    requires_mfa: false,
                    factor_id: Some(current.factor_id.clone()),
                    mfa_enrollment: None,
                }));
            }
        }
    }

    let Some(persisted) = load_persisted_session(&db) else {
        return Ok(None);
    };

    if let Ok(approved) = confirm_admin(&persisted.access_token, "/identity").await {
        let admin_session = AdminSession {
            access_token: persisted.access_token.clone(),
            refresh_token: persisted.refresh_token.clone(),
            user_id: persisted.user_id.clone(),
            username: approved.username.clone(),
            factor_id: persisted.factor_id.clone(),
            mfa_enrollment: None,
            mfa_verified: true,
        };
        if let Ok(mut guard) = session.0.lock() {
            *guard = Some(admin_session);
        }
        return Ok(Some(CommunityAdminIdentity {
            user_id: persisted.user_id,
            username: approved.username,
            requires_mfa: false,
            factor_id: Some(persisted.factor_id),
            mfa_enrollment: None,
        }));
    }

    match refresh_admin_token_session(&db, &session).await {
        Ok(_) => {
            let guard = session.0.lock().map_err(|e| e.to_string())?;
            if let Some(ref current) = *guard {
                Ok(Some(CommunityAdminIdentity {
                    user_id: current.user_id.clone(),
                    username: current.username.clone(),
                    requires_mfa: false,
                    factor_id: Some(current.factor_id.clone()),
                    mfa_enrollment: None,
                }))
            } else {
                Ok(None)
            }
        }
        Err(_) => {
            clear_persisted_session(&db);
            Ok(None)
        }
    }
}

#[tauri::command]
pub async fn community_admin_sign_in(
    db: State<'_, Db>,
    session: State<'_, CommunitySession>,
    username: String,
    password: String,
) -> Result<CommunityAdminIdentity, String> {
    let base =
        supabase_url().ok_or_else(|| "Supabase authentication is not configured.".to_string())?;
    let key = publishable_key()
        .ok_or_else(|| "The Supabase publishable key is not configured.".to_string())?;
    let (_requested_username, internal_email) = admin_login_email(&username)?;
    let response = auth_headers(
        client()?
            .post(format!("{base}/auth/v1/token?grant_type=password"))
            .json(&serde_json::json!({ "email": internal_email, "password": password })),
        &key,
    )
    .send()
    .await
    .map_err(|error| error.to_string())?;
    let auth: AuthResponse = json_response(response).await?;
    let approved = confirm_admin(&auth.access_token, "/identity").await?;
    let verified_factor = auth
        .user
        .factors
        .as_deref()
        .unwrap_or_default()
        .iter()
        .find(|factor| {
            factor.status.as_deref() == Some("verified")
                && factor.factor_type.as_deref() == Some("totp")
        });
    let (factor_id, mfa_enrollment) = if let Some(factor) = verified_factor {
        (factor.id.clone(), None)
    } else {
        let response = auth_headers(
            client()?
                .post(format!("{base}/auth/v1/factors"))
                .bearer_auth(&auth.access_token)
                .json(&serde_json::json!({
                    "factor_type": "totp",
                    "friendly_name": "Bell administrator"
                })),
            &key,
        )
        .send()
        .await
        .map_err(|error| error.to_string())?;
        let enrollment: MfaEnrollment = json_response(response).await?;
        (enrollment.id, Some(enrollment.totp.qr_code))
    };
    let identity = CommunityAdminIdentity {
        user_id: auth.user.id.clone(),
        username: approved.username,
        requires_mfa: true,
        factor_id: Some(factor_id.clone()),
        mfa_enrollment: mfa_enrollment.clone(),
    };
    if let Ok(conn) = db.0.lock() {
        let _ = crate::db::set_meta(&conn, "community_admin_last_username", &identity.username);
    }
    let mut guard = session.0.lock().map_err(|error| error.to_string())?;
    *guard = Some(AdminSession {
        access_token: auth.access_token,
        refresh_token: auth.refresh_token,
        user_id: identity.user_id.clone(),
        username: identity.username.clone(),
        factor_id,
        mfa_enrollment,
        mfa_verified: false,
    });
    Ok(identity)
}

#[tauri::command]
pub async fn community_admin_verify_mfa(
    db: State<'_, Db>,
    session: State<'_, CommunitySession>,
    code: String,
) -> Result<CommunityAdminIdentity, String> {
    let base =
        supabase_url().ok_or_else(|| "Supabase authentication is not configured.".to_string())?;
    let key = publishable_key()
        .ok_or_else(|| "The Supabase publishable key is not configured.".to_string())?;
    let current = session
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .ok_or_else(|| "Sign in with the administrator password first.".to_string())?;
    let challenge_response = auth_headers(
        client()?
            .post(format!(
                "{base}/auth/v1/factors/{}/challenge",
                current.factor_id
            ))
            .bearer_auth(&current.access_token)
            .json(&serde_json::json!({})),
        &key,
    )
    .send()
    .await
    .map_err(|error| error.to_string())?;
    let challenge: ChallengeResponse = json_response(challenge_response).await?;
    let verify_response = auth_headers(
        client()?
            .post(format!(
                "{base}/auth/v1/factors/{}/verify",
                current.factor_id
            ))
            .bearer_auth(&current.access_token)
            .json(&serde_json::json!({ "challenge_id": challenge.id, "code": code.trim() })),
        &key,
    )
    .send()
    .await
    .map_err(|error| error.to_string())?;
    let verified: AuthResponse = json_response(verify_response).await?;
    let me = confirm_admin(&verified.access_token, "/me").await?;
    let identity = CommunityAdminIdentity {
        user_id: me.user_id,
        username: me.username,
        requires_mfa: false,
        factor_id: Some(current.factor_id.clone()),
        mfa_enrollment: None,
    };
    save_persisted_session(&db, &PersistedAdminSession {
        access_token: verified.access_token.clone(),
        refresh_token: verified.refresh_token.clone(),
        user_id: identity.user_id.clone(),
        username: identity.username.clone(),
        factor_id: current.factor_id.clone(),
    });
    let mut guard = session.0.lock().map_err(|error| error.to_string())?;
    *guard = Some(AdminSession {
        access_token: verified.access_token,
        refresh_token: verified.refresh_token,
        user_id: identity.user_id.clone(),
        username: identity.username.clone(),
        factor_id: current.factor_id,
        mfa_enrollment: None,
        mfa_verified: true,
    });
    Ok(identity)
}

#[tauri::command]
pub fn community_admin_sign_out(
    db: State<'_, Db>,
    session: State<'_, CommunitySession>,
) -> Result<(), String> {
    *session.0.lock().map_err(|error| error.to_string())? = None;
    clear_persisted_session(&db);
    Ok(())
}

fn admin_token(session: &CommunitySession) -> Result<String, String> {
    let guard = session.0.lock().map_err(|error| error.to_string())?;
    let value = guard
        .as_ref()
        .ok_or_else(|| "Administrator sign-in required.".to_string())?;
    if !value.mfa_verified {
        return Err("Two-step verification is required.".to_string());
    }
    Ok(value.access_token.clone())
}

async fn admin_json<T: DeserializeOwned>(
    db: &Db,
    session: &CommunitySession,
    method: Method,
    route: &str,
    body: Option<serde_json::Value>,
) -> Result<T, String> {
    let mut token = admin_token(session);
    if token.is_err() {
        if let Ok(fresh) = refresh_admin_token_session(db, session).await {
            token = Ok(fresh);
        }
    }
    let token = token?;
    let mut request = client()?
        .request(method.clone(), admin_url(route)?)
        .bearer_auth(&token);
    if let Some(ref value) = body {
        request = request.json(value);
    }
    let response = request.send().await.map_err(|error| error.to_string())?;
    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        if let Ok(new_token) = refresh_admin_token_session(db, session).await {
            let mut retry_request = client()?
                .request(method, admin_url(route)?)
                .bearer_auth(new_token);
            if let Some(value) = body {
                retry_request = retry_request.json(&value);
            }
            let retry_response = retry_request.send().await.map_err(|error| error.to_string())?;
            return json_response(retry_response).await;
        }
    }
    json_response(response).await
}

#[tauri::command]
pub async fn community_admin_list(
    db: State<'_, Db>,
    session: State<'_, CommunitySession>,
) -> Result<Vec<CommunityResource>, String> {
    admin_json(&db, &session, Method::GET, "/resources", None).await
}

#[tauri::command]
pub async fn community_admin_stats(
    db: State<'_, Db>,
    session: State<'_, CommunitySession>,
) -> Result<CommunityAdminStats, String> {
    admin_json(&db, &session, Method::GET, "/stats", None).await
}

#[tauri::command]
pub async fn community_admin_inspection(
    db: State<'_, Db>,
    session: State<'_, CommunitySession>,
    resource_id: String,
) -> Result<CommunityAdminInspection, String> {
    checked_resource_id(&resource_id)?;
    admin_json(
        &db,
        &session,
        Method::GET,
        &format!("/resources/{resource_id}/inspection"),
        None,
    )
    .await
}

#[tauri::command]
pub async fn community_admin_create(
    db: State<'_, Db>,
    session: State<'_, CommunitySession>,
    input: CommunityCreateInput,
) -> Result<CommunityResource, String> {
    let body = serde_json::to_value(input).map_err(|error| error.to_string())?;
    admin_json(&db, &session, Method::POST, "/resources", Some(body)).await
}

#[tauri::command]
pub async fn community_admin_set_status(
    db: State<'_, Db>,
    session: State<'_, CommunitySession>,
    resource_id: String,
    status: String,
) -> Result<CommunityResource, String> {
    checked_resource_id(&resource_id)?;
    admin_json(
        &db,
        &session,
        Method::POST,
        &format!("/resources/{resource_id}/status"),
        Some(serde_json::json!({ "status": status })),
    )
    .await
}

#[tauri::command]
pub async fn community_admin_delete(
    db: State<'_, Db>,
    session: State<'_, CommunitySession>,
    cache: State<'_, ThumbnailCache>,
    resource_id: String,
) -> Result<(), String> {
    checked_resource_id(&resource_id)?;
    let _: serde_json::Value = admin_json(
        &db,
        &session,
        Method::DELETE,
        &format!("/resources/{resource_id}"),
        None,
    )
    .await?;

    if let Ok(connection) = db.0.lock() {
        let _ = connection.execute(
            "DELETE FROM community_download WHERE resource_id = ?1",
            params![resource_id],
        );
    }

    if let Ok(mut store) = cache.0.lock() {
        store.remove(&resource_id);
    }

    Ok(())
}

#[tauri::command]
pub async fn community_admin_update(
    db: State<'_, Db>,
    session: State<'_, CommunitySession>,
    resource_id: String,
    input: CommunityUpdateInput,
) -> Result<CommunityResource, String> {
    checked_resource_id(&resource_id)?;
    let body = serde_json::to_value(input).map_err(|error| error.to_string())?;
    admin_json(
        &db,
        &session,
        Method::PATCH,
        &format!("/resources/{resource_id}"),
        Some(body),
    )
    .await
}

#[tauri::command]
pub async fn community_admin_upload_thumbnail(
    db: State<'_, Db>,
    session: State<'_, CommunitySession>,
    cache: State<'_, ThumbnailCache>,
    resource_id: String,
    file_path: String,
) -> Result<(), String> {
    checked_resource_id(&resource_id)?;
    let path = PathBuf::from(&file_path);
    let metadata = std::fs::metadata(&path)
        .map_err(|error| format!("The thumbnail file could not be read: {error}"))?;
    if !metadata.is_file() || metadata.len() < 10 {
        return Err("Choose an image file.".to_string());
    }
    if metadata.len() > 5 * 1024 * 1024 {
        return Err("Thumbnail must be smaller than 5 MB.".to_string());
    }
    let bytes = std::fs::read(&path)
        .map_err(|error| format!("Failed to read thumbnail file: {error}"))?;

    let mime = if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        "image/png"
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        "image/jpeg"
    } else if bytes.len() >= 12
        && &bytes[0..4] == b"RIFF"
        && &bytes[8..12] == b"WEBP"
    {
        "image/webp"
    } else {
        return Err("The selected file is not a supported image (PNG, JPEG, WebP).".to_string());
    };

    let mut token = admin_token(&session);
    if token.is_err() {
        if let Ok(fresh) = refresh_admin_token_session(&db, &session).await {
            token = Ok(fresh);
        }
    }
    let token = token?;
    let response = client()?
        .post(admin_url(&format!("/resources/{resource_id}/thumbnail"))?)
        .bearer_auth(&token)
        .header(reqwest::header::CONTENT_TYPE, mime)
        .body(bytes.clone())
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        if let Ok(new_token) = refresh_admin_token_session(&db, &session).await {
            let retry = client()?
                .post(admin_url(&format!("/resources/{resource_id}/thumbnail"))?)
                .bearer_auth(new_token)
                .header(reqwest::header::CONTENT_TYPE, mime)
                .body(bytes.clone())
                .send()
                .await
                .map_err(|error| error.to_string())?;
            let _: serde_json::Value = json_response(retry).await?;
            if let Ok(mut store) = cache.0.lock() {
                store.insert(resource_id, bytes);
            }
            return Ok(());
        }
    }

    let _: serde_json::Value = json_response(response).await?;
    if let Ok(mut store) = cache.0.lock() {
        store.insert(resource_id, bytes);
    }
    Ok(())
}

#[tauri::command]
pub fn community_invalidate_thumbnail(
    cache: State<'_, ThumbnailCache>,
    resource_id: Option<String>,
) -> Result<(), String> {
    if let Ok(mut store) = cache.0.lock() {
        if let Some(id) = resource_id {
            store.remove(&id);
        } else {
            store.clear();
        }
    }
    Ok(())
}

fn file_head_is_pdf(path: &Path) -> bool {
    let Ok(mut file) = File::open(path) else {
        return false;
    };
    let mut head = [0u8; 5];
    file.read_exact(&mut head).is_ok() && &head == b"%PDF-"
}

#[tauri::command]
pub async fn community_admin_upload(
    app: AppHandle,
    db: State<'_, Db>,
    session: State<'_, CommunitySession>,
    resource: CommunityResource,
    file_path: String,
) -> Result<(), String> {
    checked_resource_id(&resource.id)?;
    let resource_id = resource.id;
    let source = PathBuf::from(&file_path);
    let metadata = std::fs::metadata(&source)
        .map_err(|error| format!("That PDF could not be read: {error}"))?;
    if !metadata.is_file() || metadata.len() < 5 {
        return Err("Choose a PDF file.".to_string());
    }
    if metadata.len() > MAX_RESOURCE_BYTES {
        return Err("PDFs can be no larger than 200 MB.".to_string());
    }
    if !file_head_is_pdf(&source) {
        return Err("The selected file is not a PDF.".to_string());
    }

    let current = session
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
        .ok_or_else(|| "Administrator sign-in required.".to_string())?;
    if !current.mfa_verified {
        return Err("Two-step verification is required.".to_string());
    }
    let filename = source
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("resource.pdf");
    let upload: DriveUploadSession = admin_json(
        &db,
        &session,
        Method::POST,
        &format!("/resources/{resource_id}/upload-session"),
        Some(serde_json::json!({ "filename": filename, "sizeBytes": metadata.len() })),
    )
    .await?;
    let upload_url = Url::parse(&upload.upload_url)
        .map_err(|_| "The Drive upload service returned an invalid location.".to_string())?;
    let mut file = File::open(&source).map_err(|error| error.to_string())?;
    let mut offset = 0u64;
    let mut buffer = vec![0u8; DRIVE_CHUNK_BYTES];
    let mut drive_file_id = None;
    while offset < metadata.len() {
        file.seek(SeekFrom::Start(offset))
            .map_err(|error| error.to_string())?;
        let wanted = usize::try_from((metadata.len() - offset).min(DRIVE_CHUNK_BYTES as u64))
            .unwrap_or(DRIVE_CHUNK_BYTES);
        let read = file
            .read(&mut buffer[..wanted])
            .map_err(|error| error.to_string())?;
        if read == 0 {
            return Err("The selected PDF ended before its reported size.".to_string());
        }
        let chunk = buffer[..read].to_vec();
        let mut last_error = String::new();
        let mut advanced = None;
        for _ in 0..3 {
            let end = offset + read as u64 - 1;
            match client()?
                .put(upload_url.clone())
                .header(reqwest::header::CONTENT_TYPE, "application/pdf")
                .header(reqwest::header::CONTENT_LENGTH, read)
                .header(
                    "content-range",
                    format!("bytes {offset}-{end}/{}", metadata.len()),
                )
                .body(chunk.clone())
                .send()
                .await
            {
                Ok(response) if response.status().as_u16() == 308 => {
                    advanced = response
                        .headers()
                        .get("range")
                        .and_then(|value| value.to_str().ok())
                        .and_then(|value| value.rsplit('-').next())
                        .and_then(|value| value.parse::<u64>().ok())
                        .map(|last| last + 1)
                        .or(Some(offset + read as u64));
                    break;
                }
                Ok(response) if response.status().is_success() => {
                    let completed: DriveUploadResult = json_response(response).await?;
                    drive_file_id = Some(completed.id);
                    advanced = Some(metadata.len());
                    break;
                }
                Ok(response) => {
                    last_error = format!("Drive answered HTTP {}", response.status().as_u16())
                }
                Err(error) => last_error = error.to_string(),
            }
        }
        offset = advanced.ok_or_else(|| format!("The upload was interrupted: {last_error}"))?;
        let _ = app.emit(
            "community:upload-progress",
            CommunityUploadProgress {
                resource_id: resource_id.clone(),
                uploaded: offset,
                total: metadata.len(),
                phase: Some("uploading".to_string()),
            },
        );
    }

    let drive_file_id = drive_file_id.ok_or_else(|| {
        "Drive completed the upload without returning a file identifier.".to_string()
    })?;
    let _: serde_json::Value = admin_json(
        &db,
        &session,
        Method::POST,
        &format!("/resources/{resource_id}/uploaded"),
        Some(serde_json::json!({ "filename": filename, "sizeBytes": metadata.len(), "driveFileId": drive_file_id })),
    ).await?;
    Ok(())
}

#[tauri::command]
pub async fn community_admin_preview(
    app: AppHandle,
    db: State<'_, Db>,
    session: State<'_, CommunitySession>,
    resource: CommunityResource,
) -> Result<CommunityDownloadResult, String> {
    let signed: SignedFile = admin_json(
        &db,
        &session,
        Method::GET,
        &format!("/resources/{}/preview", resource.id),
        None,
    )
    .await?;
    download_signed(&app, &db, &resource, signed).await
}

#[tauri::command]
pub fn community_admin_read_local_file(path: String) -> Result<tauri::ipc::Response, String> {
    let source = PathBuf::from(&path);
    if !source.is_file() {
        return Err("The specified file does not exist.".to_string());
    }
    let metadata = std::fs::metadata(&source).map_err(|error| error.to_string())?;
    if metadata.len() > MAX_RESOURCE_BYTES {
        return Err("The file exceeds 200 MB.".to_string());
    }
    let bytes = std::fs::read(&source).map_err(|error| error.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
pub fn community_admin_save_temp_thumbnail(bytes: Vec<u8>) -> Result<String, String> {
    if bytes.len() > 5 * 1024 * 1024 {
        return Err("Thumbnail must be smaller than 5 MB.".to_string());
    }
    let temp_dir = std::env::temp_dir();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let temp_path = temp_dir.join(format!("bell-thumb-{now}.png"));
    std::fs::write(&temp_path, &bytes).map_err(|error| error.to_string())?;
    Ok(temp_path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_and_path_segments_are_closed() {
        assert!(checked_resource_id("e90d23b5-6b70-45db-8819-d4ed1f85fbee").is_ok());
        assert!(checked_resource_id("../../windows/system32").is_err());
        assert_eq!(safe_segment("Forces: notes?", "fallback"), "Forces notes");
        assert_eq!(safe_segment("..", "fallback"), "fallback");
    }

    #[test]
    fn configuration_never_exposes_secret_values() {
        let status = community_status();
        if !status.configured {
            assert!(status.message.is_some());
        }
    }

    #[test]
    fn admin_usernames_map_to_internal_auth_identities() {
        let (username, email) = admin_login_email(" ZK_bell_net1-hyper ").unwrap();
        assert_eq!(username, "zk_bell_net1-hyper");
        assert_eq!(email, "zk_bell_net1-hyper@auth.bell.invalid");
        assert!(admin_login_email("no spaces").is_err());
        assert!(admin_login_email("-cannot-start-here").is_err());
    }

    #[test]
    fn community_update_input_serializes_with_camel_case() {
        let update = CommunityUpdateInput {
            title: Some("Biology A Level Textbook".to_string()),
            description: None,
            qualification: Some("a_level".to_string()),
            subject_code: Some("9700".to_string()),
            subject_name: Some("Biology".to_string()),
            resource_type: Some("book".to_string()),
            author_name: Some("Cambridge".to_string()),
            uploader_name: Some("Bell Admin".to_string()),
            contributor_credit: None,
            source_url: None,
        };
        let value = serde_json::to_value(&update).unwrap();
        assert_eq!(value["title"], "Biology A Level Textbook");
        assert_eq!(value["uploaderName"], "Bell Admin");
        assert_eq!(value["subjectCode"], "9700");
        assert_eq!(value["subjectName"], "Biology");
        assert_eq!(value["resourceType"], "book");
    }
}
