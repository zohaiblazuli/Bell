/**
 * The update seam — now wired to the Tauri updater.
 *
 * `UpdateFlow.tsx` draws the flow (the sidebar pill and the 420x280 dialog) and `useUpdates.ts`
 * owns the state machine; this module is the one place that talks to the release feed. It reaches
 * the network only from Rust — `tauri-plugin-updater` runs the HTTP itself — so the webview's CSP
 * stays closed, exactly as `catalog.rs` and `downloads.rs` do. Offline is still a hard requirement:
 * nothing here runs on mount unless the user opted into automatic checks (see `useUpdates.ts`).
 *
 * The feed and the key live in `plugins.updater` in `tauri.conf.json` — the `latest.json` endpoint
 * and the public key — while `TAURI_SIGNING_PRIVATE_KEY` (a GitHub Actions secret) signs each
 * release. `check()` fetches the manifest, compares its version to this build's by semver, and
 * verifies the bundle's signature against that public key before a single byte is installed.
 *
 * Why download and install are two calls rather than `downloadAndInstall`: the UI has a `ready`
 * phase — the bytes are fetched and the student presses "Restart now" when they choose. So `check`
 * keeps the `Update` in module scope, `downloadUpdate` stages it, and `installUpdate` applies it and
 * relaunches.
 */
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

/** What a check found. `not-configured` cannot arise now the feed exists, but the caller still handles it. */
export type UpdateCheck =
  | { status: 'not-configured' }
  | { status: 'current' }
  | { status: 'available'; version: string; notes: string | null };

/** Bytes so far. `total` is null when the server sends no content length — some do not. */
export interface DownloadProgress {
  downloaded: number;
  total: number | null;
}

/** True now that a signing key and a release feed exist. Settings reads it to explain itself. */
export const UPDATES_CONFIGURED = true;

/**
 * The pending update, held between `checkForUpdate` and `downloadUpdate`/`installUpdate`. The plugin
 * carries the downloaded bytes on this object, so the same instance must see all three steps.
 */
let pending: Awaited<ReturnType<typeof check>> = null;

/** Ask the feed whether a newer, correctly-signed build exists. */
export async function checkForUpdate(): Promise<UpdateCheck> {
  const update = await check();
  pending = update;
  if (!update) return { status: 'current' };
  return { status: 'available', version: update.version, notes: update.body ?? null };
}

/**
 * Download the pending update, reporting bytes as they arrive. Resolves once the bytes are staged;
 * it does NOT install — the `ready` phase waits for the student to confirm the restart.
 */
export async function downloadUpdate(
  onProgress: (p: DownloadProgress) => void,
): Promise<void> {
  if (!pending) throw new Error('No update is pending — check first.');
  let downloaded = 0;
  let total: number | null = null;
  await pending.download((event) => {
    switch (event.event) {
      case 'Started':
        total = event.data.contentLength ?? null;
        onProgress({ downloaded, total });
        break;
      case 'Progress':
        downloaded += event.data.chunkLength;
        onProgress({ downloaded, total });
        break;
      case 'Finished':
        break;
    }
  });
}

/** Install the staged update and restart into it. */
export async function installUpdate(): Promise<void> {
  if (!pending) throw new Error('No update is staged — download first.');
  await pending.install();
  await relaunch();
}
