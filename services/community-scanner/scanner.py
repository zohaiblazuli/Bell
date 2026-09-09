"""Bell's quarantined-PDF worker.

The worker is intentionally outside Supabase Edge Functions: it needs a real filesystem, antivirus
definitions, and enough memory/CPU to inspect a 200 MB document. It claims one queued job, downloads
the original into an isolated temporary directory, validates and sanitizes it, creates a thumbnail,
publishes only the sanitized copy, and records a machine-readable report.
"""

from __future__ import annotations

import hashlib
import json
import os
import socket
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any
import requests

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
POLL_SECONDS = max(2, int(os.environ.get("SCAN_POLL_SECONDS", "5")))
WORKER_ID = os.environ.get("SCAN_WORKER_ID", socket.gethostname())
MAX_BYTES = 200 * 1024 * 1024
HEADERS = {"apikey": SERVICE_KEY, "authorization": f"Bearer {SERVICE_KEY}"}
DRIVE_API = "https://www.googleapis.com/drive/v3"
DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3"
DRIVE_CLIENT_ID = os.environ["GOOGLE_DRIVE_CLIENT_ID"]
DRIVE_CLIENT_SECRET = os.environ["GOOGLE_DRIVE_CLIENT_SECRET"]
DRIVE_REFRESH_TOKEN = os.environ["GOOGLE_DRIVE_REFRESH_TOKEN"]
DRIVE_PUBLISHED_FOLDER_ID = os.environ["GOOGLE_DRIVE_PUBLISHED_FOLDER_ID"]
DRIVE_THUMBNAILS_FOLDER_ID = os.environ["GOOGLE_DRIVE_THUMBNAILS_FOLDER_ID"]
_drive_token: tuple[str, float] | None = None


def api(path: str) -> str:
    return f"{SUPABASE_URL}/rest/v1/{path}"


def request(method: str, url: str, **kwargs: Any) -> requests.Response:
    response = requests.request(method, url, timeout=(20, 300), **kwargs)
    response.raise_for_status()
    return response


def drive_headers() -> dict[str, str]:
    global _drive_token
    if not _drive_token or _drive_token[1] < time.time() + 60:
        response = request(
            "POST",
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": DRIVE_CLIENT_ID,
                "client_secret": DRIVE_CLIENT_SECRET,
                "refresh_token": DRIVE_REFRESH_TOKEN,
                "grant_type": "refresh_token",
            },
        ).json()
        _drive_token = (response["access_token"], time.time() + int(response.get("expires_in", 3600)))
    return {"authorization": f"Bearer {_drive_token[0]}"}


def claim_job() -> dict[str, Any] | None:
    # A single scanner is the supported first deployment. The conditional PATCH still stops an old
    # read from stealing work once a second worker is introduced.
    rows = request(
        "GET",
        api("community_scan_jobs?status=eq.pending&order=created_at.asc&limit=1"),
        headers=HEADERS,
    ).json()
    if not rows:
        return None
    job = rows[0]
    claimed = request(
        "PATCH",
        api(f"community_scan_jobs?id=eq.{job['id']}&status=eq.pending"),
        headers={**HEADERS, "content-type": "application/json", "prefer": "return=representation"},
        json={
            "status": "running",
            "attempts": int(job.get("attempts", 0)) + 1,
            "locked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "locked_by": WORKER_ID,
        },
    ).json()
    return claimed[0] if claimed else None


def version_row(job: dict[str, Any]) -> dict[str, Any]:
    rows = request(
        "GET",
        api(
            "community_resource_versions"
            f"?resource_id=eq.{job['resource_id']}&version=eq.{job['version']}&limit=1"
        ),
        headers=HEADERS,
    ).json()
    if not rows:
        raise RuntimeError("resource version is missing")
    return rows[0]


def download_original(file_id: str, target: Path) -> tuple[int, str]:
    size = 0
    digest = hashlib.sha256()
    with request(
        "GET",
        f"{DRIVE_API}/files/{file_id}?alt=media&supportsAllDrives=true",
        headers=drive_headers(),
        stream=True,
    ) as response:
        with target.open("wb") as output:
            for chunk in response.iter_content(1024 * 1024):
                if not chunk:
                    continue
                size += len(chunk)
                if size > MAX_BYTES:
                    raise RuntimeError("PDF exceeds the 200 MB limit")
                digest.update(chunk)
                output.write(chunk)
    with target.open("rb") as uploaded:
        head = uploaded.read(5)
    if size < 5 or head != b"%PDF-":
        raise RuntimeError("uploaded object is not a PDF")
    return size, digest.hexdigest()


def run_checked(*args: str, timeout: int = 300) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=timeout)


def inspect_and_sanitize(source: Path, clean: Path, thumbnail: Path) -> dict[str, Any]:
    needles = {
        "javascript": (b"/JavaScript", b"/JS"),
        "launch_action": (b"/Launch",),
        "embedded_file": (b"/EmbeddedFile",),
        "open_action": (b"/OpenAction",),
    }
    blocked = {name: False for name in needles}
    carry = b""
    with source.open("rb") as uploaded:
        while chunk := uploaded.read(1024 * 1024):
            window = carry + chunk
            for name, patterns in needles.items():
                blocked[name] = blocked[name] or any(pattern in window for pattern in patterns)
            carry = window[-32:]
    if any(blocked.values()):
        names = ", ".join(name.replace("_", " ") for name, found in blocked.items() if found)
        raise RuntimeError(f"active or embedded PDF content detected: {names}")

    qpdf = run_checked("qpdf", "--check", str(source))
    antivirus = run_checked("clamscan", "--no-summary", str(source))
    # `mutool clean` rewrites object streams and xrefs into a canonical publication copy. Active
    # content was rejected above rather than trusted to survive a rewrite safely.
    run_checked("mutool", "clean", "-gggg", str(source), str(clean))
    run_checked("clamscan", "--no-summary", str(clean))
    info = run_checked("pdfinfo", str(clean))
    fields: dict[str, str] = {}
    for line in info.stdout.splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            fields[key.strip().lower()] = value.strip()
    if fields.get("encrypted", "no").lower() != "no":
        raise RuntimeError("encrypted PDFs cannot be published")
    pages = int(fields.get("pages", "0"))
    if pages < 1:
        raise RuntimeError("PDF has no readable pages")
    run_checked("pdftoppm", "-f", "1", "-singlefile", "-jpeg", "-scale-to", "640", str(clean), str(thumbnail.with_suffix("")))
    return {
        "pages": pages,
        "pdfVersion": fields.get("pdf version"),
        "pageSize": fields.get("page size"),
        "activeContent": blocked,
        "qpdf": qpdf.stderr[-2000:],
        "antivirus": antivirus.stdout[-2000:],
    }


def upload_drive_file(file: Path, name: str, content_type: str, folder_id: str, properties: dict[str, str]) -> str:
    size = file.stat().st_size
    session = request(
        "POST",
        f"{DRIVE_UPLOAD_API}/files?uploadType=resumable&supportsAllDrives=true",
        headers={
            **drive_headers(),
            "content-type": "application/json",
            "x-upload-content-type": content_type,
            "x-upload-content-length": str(size),
        },
        json={"name": name, "mimeType": content_type, "parents": [folder_id], "appProperties": properties},
    ).headers["location"]
    offset = 0
    result: dict[str, Any] | None = None
    with file.open("rb") as body:
        while chunk := body.read(8 * 1024 * 1024):
            end = offset + len(chunk) - 1
            response = requests.put(
                session,
                headers={
                    **drive_headers(),
                    "content-type": content_type,
                    "content-length": str(len(chunk)),
                    "content-range": f"bytes {offset}-{end}/{size}",
                },
                data=chunk,
                timeout=(20, 300),
            )
            if response.status_code == 308:
                offset = end + 1
                continue
            response.raise_for_status()
            result = response.json()
            offset = end + 1
    if not result or not result.get("id"):
        raise RuntimeError("Google Drive completed an upload without returning a file ID")
    return str(result["id"])


def publish_drive_file(file_id: str) -> None:
    request(
        "POST",
        f"{DRIVE_API}/files/{file_id}/permissions?supportsAllDrives=true&sendNotificationEmail=false",
        headers={**drive_headers(), "content-type": "application/json"},
        json={"type": "anyone", "role": "reader", "allowFileDiscovery": False},
    )


def patch(path: str, body: dict[str, Any]) -> None:
    request(
        "PATCH",
        api(path),
        headers={**HEADERS, "content-type": "application/json", "prefer": "return=minimal"},
        json=body,
    )


def complete(job: dict[str, Any], version: dict[str, Any], size: int, sha256: str, findings: dict[str, Any], clean: Path, thumb: Path) -> None:
    resource_id = job["resource_id"]
    number = int(job["version"])
    properties = {"bellResourceId": resource_id, "bellVersion": str(number), "bellSha256": sha256}
    published_id = upload_drive_file(
        clean,
        f"{resource_id}-v{number}-{sha256}.pdf",
        "application/pdf",
        DRIVE_PUBLISHED_FOLDER_ID,
        {**properties, "bellKind": "published"},
    )
    thumbnail_id = upload_drive_file(
        thumb,
        f"{resource_id}-v{number}-{sha256}.jpg",
        "image/jpeg",
        DRIVE_THUMBNAILS_FOLDER_ID,
        {**properties, "bellKind": "thumbnail"},
    )
    publish_drive_file(published_id)
    publish_drive_file(thumbnail_id)
    patch(
        f"community_resource_versions?resource_id=eq.{resource_id}&version=eq.{number}",
        {
            "drive_published_file_id": published_id,
            "drive_thumbnail_file_id": thumbnail_id,
            "size_bytes": size,
            "sha256": sha256,
            "page_count": findings["pages"],
        },
    )
    patch(
        f"community_resources?id=eq.{resource_id}",
        {
            "status": "ready_for_review",
            "scan_status": "passed",
            "size_bytes": size,
            "sha256": sha256,
            "page_count": findings["pages"],
        },
    )
    request(
        "POST",
        api("community_scan_reports"),
        headers={**HEADERS, "content-type": "application/json", "prefer": "resolution=merge-duplicates"},
        json={
            "resource_id": resource_id,
            "version": number,
            "status": "passed",
            "scanner_version": "bell-scanner/1 qpdf+clamav+mutool",
            "findings": findings,
        },
    )
    patch(f"community_scan_jobs?id=eq.{job['id']}", {"status": "passed", "last_error": None})


def fail_job(job: dict[str, Any], message: str) -> None:
    resource_id = job["resource_id"]
    number = int(job["version"])
    patch(f"community_resources?id=eq.{resource_id}", {"status": "quarantined", "scan_status": "failed"})
    request(
        "POST",
        api("community_scan_reports"),
        headers={**HEADERS, "content-type": "application/json", "prefer": "resolution=merge-duplicates"},
        json={
            "resource_id": resource_id,
            "version": number,
            "status": "failed",
            "scanner_version": "bell-scanner/1 qpdf+clamav+mutool",
            "findings": {"error": message[:4000]},
        },
    )
    patch(f"community_scan_jobs?id=eq.{job['id']}", {"status": "failed", "last_error": message[:4000]})


def process(job: dict[str, Any]) -> None:
    version = version_row(job)
    with tempfile.TemporaryDirectory(prefix="bell-scan-") as directory:
        root = Path(directory)
        source = root / "source.pdf"
        clean = root / "published.pdf"
        thumbnail = root / "preview.jpg"
        size, sha256 = download_original(version["drive_quarantine_file_id"], source)
        findings = inspect_and_sanitize(source, clean, thumbnail)
        complete(job, version, size, sha256, findings, clean, thumbnail)


def main() -> None:
    while True:
        job = None
        try:
            job = claim_job()
            if job:
                process(job)
            else:
                time.sleep(POLL_SECONDS)
        except Exception as error:  # the report is the recovery path; the worker stays alive
            print(json.dumps({"worker": WORKER_ID, "error": str(error), "job": job}), flush=True)
            if job:
                try:
                    fail_job(job, str(error))
                except Exception as report_error:
                    print(json.dumps({"reportError": str(report_error)}), flush=True)
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
