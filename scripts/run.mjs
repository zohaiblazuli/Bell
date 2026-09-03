/**
 * Runs one of the verification scripts in `scripts/`.
 *
 * They import the app's own modules (so the thing being verified is the thing that ships), and
 * those use extensionless imports that only a bundler resolves. esbuild handles that here:
 *
 *   node scripts/run.mjs verify-thresholds.ts 9709 40
 *   node scripts/run.mjs verify-difficulty.ts 9702
 */

import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [entry, ...args] = process.argv.slice(2);
if (!entry) {
  console.error('usage: node scripts/run.mjs <script.ts> [args…]');
  process.exit(2);
}

// Inside the project, so the externalised node_modules still resolve.
const dir = join(import.meta.dirname, '..', 'node_modules', '.cache', 'bell-verify');
mkdirSync(dir, { recursive: true });
const out = join(dir, `${entry.replace(/\W+/g, '-')}.mjs`);
await build({
  entryPoints: [join(import.meta.dirname, entry)],
  outfile: out,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // node_modules stay external; only the app's own TypeScript is bundled.
  packages: 'external',
  logLevel: 'warning',
});

process.argv = [process.argv[0], out, ...args];
await import(pathToFileURL(out).href);
