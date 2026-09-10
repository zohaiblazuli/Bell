//! GitHub Star Gate verification.
//!
//! Checks whether a user has starred the Bell repository (zohaiblazuli/Bell)
//! using GitHub's public API. All networking stays in Rust to keep the
//! webview's CSP locked down.

use serde::Deserialize;
use std::time::Duration;

#[derive(Deserialize, Debug)]
struct StarredRepo {
    full_name: Option<String>,
}

const TARGET_REPO: &str = "zohaiblazuli/bell";

#[tauri::command]
pub async fn check_github_star(username: String) -> Result<bool, String> {
    let clean_user = username.trim();
    if clean_user.is_empty() {
        return Err("Please enter your GitHub username.".to_string());
    }

    // Validate GitHub username format (alphanumeric or single hyphens, 1..39 chars)
    if clean_user.len() > 39
        || !clean_user
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-')
    {
        return Err("Invalid GitHub username format.".to_string());
    }

    let url = format!(
        "https://api.github.com/users/{}/starred?per_page=100",
        clean_user
    );

    let client = reqwest::Client::builder()
        .user_agent("Bell-Desktop-App")
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|e| format!("Failed to initialize HTTP client: {e}"))?;

    let resp = client
        .get(&url)
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("Network error connecting to GitHub: {e}"))?;

    let status = resp.status();
    if status == reqwest::StatusCode::NOT_FOUND {
        return Err(format!("GitHub user '{clean_user}' not found."));
    }

    if status == reqwest::StatusCode::FORBIDDEN || status == reqwest::StatusCode::TOO_MANY_REQUESTS {
        return Err("GitHub rate limit reached. Please wait a few moments and try again.".to_string());
    }

    if !status.is_success() {
        return Err(format!("GitHub API returned status {status}."));
    }

    let repos: Vec<StarredRepo> = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub response: {e}"))?;

    for repo in repos {
        if let Some(name) = repo.full_name {
            if name.trim().to_ascii_lowercase() == TARGET_REPO {
                return Ok(true);
            }
        }
    }

    Ok(false)
}
