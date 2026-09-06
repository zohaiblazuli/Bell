/**
 * Regenerates all platform icon sizes from Bell's approved Azure artwork.
 *
 * Usage: `npm run icon`
 */
import { execFileSync } from 'node:child_process';

execFileSync('npx', ['tauri', 'icon', 'design/brand/azure-bell-logo-final.png'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
