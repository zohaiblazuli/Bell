"""One-time loopback OAuth helper for Bell Community Resources.

The client credential is submitted only to localhost. The resulting bundle is written to the
explicit output path supplied by the operator and the server exits after one successful callback.
"""

from __future__ import annotations

import argparse
import html
import json
import secrets
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
DRIVE_SCOPE = "https://www.googleapis.com/auth/drive"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=53682)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


ARGS = parse_args()
STATE = secrets.token_urlsafe(32)
CREDENTIAL: dict[str, str] = {}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, _format: str, *_args: object) -> None:
        return

    def send_html(self, status: int, body: str) -> None:
        payload = ("<!doctype html><meta charset=utf-8><title>Bell Drive setup</title>"
                   "<style>body{font:16px system-ui;max-width:680px;margin:64px auto;padding:24px}"
                   "input{display:block;width:100%;padding:10px;margin:8px 0 18px}button{padding:10px 18px}</style>"
                   + body).encode()
        self.send_response(status)
        self.send_header("content-type", "text/html; charset=utf-8")
        self.send_header("content-length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self) -> None:
        url = urllib.parse.urlsplit(self.path)
        if url.path == "/":
            self.send_html(200, """
                <h1>Connect Bell to Google Drive</h1>
                <p>The values stay on this computer and are exchanged directly with Google.</p>
                <form method="post" action="/start">
                  <label>OAuth client ID<input name="client_id" autocomplete="off" required></label>
                  <label>OAuth client secret<input name="client_secret" type="password" autocomplete="off" required></label>
                  <button type="submit">Continue to Google</button>
                </form>
            """)
            return
        if url.path != "/callback":
            self.send_html(404, "<h1>Not found</h1>")
            return
        query = urllib.parse.parse_qs(url.query)
        if query.get("state", [""])[0] != STATE or not query.get("code") or not CREDENTIAL:
            self.send_html(400, "<h1>Authorization could not be verified.</h1>")
            return
        form = urllib.parse.urlencode({
            "client_id": CREDENTIAL["client_id"],
            "client_secret": CREDENTIAL["client_secret"],
            "code": query["code"][0],
            "grant_type": "authorization_code",
            "redirect_uri": f"http://127.0.0.1:{ARGS.port}/callback",
        }).encode()
        try:
            with urllib.request.urlopen(urllib.request.Request(
                GOOGLE_TOKEN,
                data=form,
                headers={"content-type": "application/x-www-form-urlencoded"},
            ), timeout=30) as response:
                token = json.load(response)
        except urllib.error.HTTPError as error:
            detail = error.read().decode(errors="replace")[:1000]
            self.send_html(502, f"<h1>Google rejected the token exchange.</h1><pre>{html.escape(detail)}</pre>")
            return
        refresh_token = token.get("refresh_token")
        if not refresh_token:
            self.send_html(409, "<h1>No refresh token was returned.</h1><p>Revoke the prior grant and retry.</p>")
            return
        ARGS.output.write_text(json.dumps({
            "client_id": CREDENTIAL["client_id"],
            "client_secret": CREDENTIAL["client_secret"],
            "refresh_token": refresh_token,
        }), encoding="utf-8")
        self.send_html(200, "<h1>Bell is connected.</h1><p>You may return to Codex.</p>")
        self.server.shutdown_requested = True  # type: ignore[attr-defined]

    def do_POST(self) -> None:
        if self.path != "/start":
            self.send_html(404, "<h1>Not found</h1>")
            return
        length = min(int(self.headers.get("content-length", "0")), 16_384)
        form = urllib.parse.parse_qs(self.rfile.read(length).decode())
        client_id = form.get("client_id", [""])[0].strip()
        client_secret = form.get("client_secret", [""])[0].strip()
        if not client_id.endswith(".apps.googleusercontent.com") or not client_secret:
            self.send_html(400, "<h1>Enter the Google OAuth client values.</h1>")
            return
        CREDENTIAL.update(client_id=client_id, client_secret=client_secret)
        query = urllib.parse.urlencode({
            "client_id": client_id,
            "redirect_uri": f"http://127.0.0.1:{ARGS.port}/callback",
            "response_type": "code",
            "scope": DRIVE_SCOPE,
            "access_type": "offline",
            "prompt": "consent",
            "include_granted_scopes": "true",
            "state": STATE,
        })
        self.send_response(302)
        self.send_header("location", f"{GOOGLE_AUTH}?{query}")
        self.end_headers()


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", ARGS.port), Handler)
    server.shutdown_requested = False  # type: ignore[attr-defined]
    while not server.shutdown_requested:  # type: ignore[attr-defined]
        server.handle_request()


if __name__ == "__main__":
    main()
