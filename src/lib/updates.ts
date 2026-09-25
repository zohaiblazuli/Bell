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
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

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

/** How long the feed gets to answer before the check gives up. */
const CHECK_TIMEOUT_MS = 15_000;

/**
 * The pending update, held between `checkForUpdate` and `downloadUpdate`/`installUpdate`. The plugin
 * carries the downloaded bytes on this object, so the same instance must see all three steps.
 */
let pending: Awaited<ReturnType<typeof check>> = null;

/** Ask the feed whether a newer, correctly-signed build exists. */
export async function checkForUpdate(): Promise<UpdateCheck> {
  // Bounded, so an offline launch fails the check instead of leaving it `checking` indefinitely.
  const update = await check({ timeout: CHECK_TIMEOUT_MS });
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

/**
 * Tell Windows an update is waiting — one toast in the Action Center, for the launch check only.
 *
 * Best effort by design: a toast that cannot be shown (permission refused, notifications off, a dev
 * build with no installed app identity to post as) must never turn a successful check into an error,
 * so every failure is swallowed here. The in-app pill still carries the news either way.
 */
export async function notifyUpdateAvailable(version: string): Promise<void> {
  try {
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === 'granted';
    if (!granted) return;
    sendNotification({
      title: `Bell ${version} is available`,
      body: 'Open Bell to update — it takes a minute.',
    });
  } catch {
    // See above: no toast is an acceptable outcome.
  }
}
