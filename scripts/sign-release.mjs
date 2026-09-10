#!/usr/bin/env node
/**
 * Signs release bundles and generates latest.json + SHA256SUMS.txt.
 *
 * Usage:
 *   node scripts/sign-release.mjs [--upload]
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';

const root = fileURLToPath(new URL('../', import.meta.url));
const configPath = join(root, 'src-tauri', 'tauri.conf.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const version = config.version;

console.log(`Signing Bell v${version}...`);

const defaultKeyPath = join(homedir(), '.tauri', 'bell.key');
const keyPath = process.env.TAURI_SIGNING_PRIVATE_KEY_PATH || (existsSync(defaultKeyPath) ? defaultKeyPath : null);
const password = process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD || 'A5t/uepD4YyWRwGs6zinvQQyUIrVlBMq';

if (!keyPath || !existsSync(keyPath)) {
  console.error(`Error: Private key not found at ${keyPath || defaultKeyPath}`);
  process.exit(1);
}

const nsisPath = join(root, 'src-tauri', 'target', 'release', 'bundle', 'nsis', `Bell_${version}_x64-setup.exe`);
const msiPath = join(root, 'src-tauri', 'target', 'release', 'bundle', 'msi', `Bell_${version}_x64_en-US.msi`);

const targets = [
  { kind: 'nsis', path: nsisPath },
  { kind: 'msi', path: msiPath },
].filter(t => existsSync(t.path));

if (targets.length === 0) {
  console.error(`Error: No release bundles found for version ${version}. Run "npm run tauri build" first.`);
  process.exit(1);
}

for (const target of targets) {
  console.log(`Signing ${target.path}...`);
  execSync(`npx tauri signer sign -f "${keyPath}" -p "${password}" "${target.path}"`, {
    stdio: 'inherit',
  });
}

// Run verify-release.py to generate latest.json and SHA256SUMS.txt
const releaseDir = join(root, 'work', `release-v${version}`);
const verifyScript = join(releaseDir, 'verify-release.py');
if (existsSync(verifyScript)) {
  console.log(`Running ${verifyScript}...`);
  execSync(`python "${verifyScript}"`, { stdio: 'inherit' });
}

if (process.argv.includes('--upload')) {
  console.log(`Uploading release assets to GitHub tag v${version}...`);
  const uploadFiles = [];
  for (const target of targets) {
    uploadFiles.push(`"${target.path}"`);
    uploadFiles.push(`"${target.path}.sig"`);
  }
  const latestJson = join(releaseDir, 'latest.json');
  const sums = join(releaseDir, 'SHA256SUMS.txt');
  if (existsSync(latestJson)) uploadFiles.push(`"${latestJson}"`);
  if (existsSync(sums)) uploadFiles.push(`"${sums}"`);

  execSync(`gh release upload "v${version}" ${uploadFiles.join(' ')} --clobber`, {
    stdio: 'inherit',
  });
  console.log(`Upload complete!`);
}
