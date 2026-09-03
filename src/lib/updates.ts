/**
 * The update seam.
 *
 * `UpdateFlow.tsx` draws the whole flow — the sidebar pill in its three states and the 420x280
 * dialog — and `App` owns the state machine. This module is the one place that would talk to a
 * server, and today it deliberately does not: **the updater plugin is not installed**, and it
 * cannot be until two things exist that are not ours to invent.
 *
 *   1. A signing key pair. `tauri-plugin-updater` verifies every downloaded bundle against a public
 *      key baked into `tauri.conf.json`; the private half is a secret Zohaib generates once with
 *      `npm run tauri signer generate` and never commits.
 *   2. A release feed to point `endpoints` at — a `latest.json` on a host, or GitHub Releases.
 *
 * Adding the dependency before both exist buys a plugin that fails at init, so instead this returns
 * an honest `not-configured` and every caller renders that rather than a spinner that resolves to
 * nothing. Offline is a hard requirement in `CLAUDE.md`, and this is what keeps it true by
 * construction: there is no code path here that reaches the network at all.
 *
 * ## Wiring it up later
 * `npm i @tauri-apps/plugin-updater`, `cargo add tauri-plugin-updater`, register it in `lib.rs`,
 * put the pubkey and endpoints in `tauri.conf.json`, then replace the body of `checkForUpdate`
 * with `check()` from the plugin and `downloadAndInstall` with its `downloadAndInstall(onEvent)`.
 * Nothing outside this file changes: the shapes below are already what the plugin reports.
 */

/** What a check found. `not-configured` is a real answer, not an error — see the header. */
export type UpdateCheck =
  | { status: 'not-configured' }
  | { status: 'current' }
  | { status: 'available'; version: string; notes: string | null };

/** Bytes so far. `total` is null when the server sends no content length — some do not. */
export interface DownloadProgress {
  downloaded: number;
  total: number | null;
}

/** True once a signing key and a release feed exist. Settings reads it to explain itself. */
export const UPDATES_CONFIGURED = false;

/**
 * Ask whether a newer build exists. Reaches the network only once the plugin is wired; until then
 * it answers immediately and touches nothing.
 */
export async function checkForUpdate(): Promise<UpdateCheck> {
  return { status: 'not-configured' };
}

/**
 * Download the pending update, reporting progress, then stage it for install.
 *
 * Throws while unconfigured rather than resolving, because a silent success here would leave the
 * pill sitting in `ready` with nothing behind it — and the next press would claim to restart into a
 * build that was never fetched.
 */
export async function downloadUpdate(
  _onProgress: (p: DownloadProgress) => void,
): Promise<void> {
  throw new Error('Updates are not configured for this build.');
}

/** Restart into the staged update. Same reasoning as `downloadUpdate`. */
export async function installUpdate(): Promise<void> {
  throw new Error('Updates are not configured for this build.');
}
