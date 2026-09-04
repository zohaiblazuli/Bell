/**
 * The unit-test runner. Zero new dependencies — Node's own `node:test` plus the esbuild that
 * `scripts/run.mjs` already leans on to bundle the app's TypeScript.
 *
 *   node scripts/test.mjs                 (or: npm test)
 *   node scripts/test.mjs ink             only tests whose file name contains "ink"
 *
 * Why this exists at all: `npm run build` is a typecheck, not a test, and two pieces of Phase 6
 * are pure functions worth pinning — the stroke engine in `src/lib/ink.ts` (smoothing, hit-testing,
 * the command stack) and the page-count derivation in `src/lib/notebooks.ts`, which is what makes
 * "infinite pages, never ask the student" true. Neither can be verified by tsc, and both are
 * exactly the shape a test suits: input in, value out, no DOM.
 *
 * Why not vitest or jest: the offline guarantee is the app's, not the toolchain's, but a test
 * runner is still ~200 transitive packages to review, and `node:test` has been stable since Node 20.
 * Tests are written in TypeScript against the real modules (extensionless imports and the `@/`
 * alias included), bundled here, then handed to `node --test`.
 */
import { build } from 'esbuild';
import { mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = join(import.meta.dirname, '..');
const testDir = join(root, 'tests');
const filter = process.argv[2] ?? '';

if (!existsSync(testDir)) {
  console.error('no tests/ directory');
  process.exit(2);
}

const entries = readdirSync(testDir)
  .filter((n) => n.endsWith('.test.ts'))
  .filter((n) => n.includes(filter))
  .map((n) => join(testDir, n))
  .sort();

if (entries.length === 0) {
  console.error(`no tests matched ${filter ? `"${filter}"` : 'tests/*.test.ts'}`);
  process.exit(2);
}

// Inside the project, so externalised node_modules still resolve from the output.
const outdir = join(root, 'node_modules', '.cache', 'bell-tests');
mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: entries,
  outdir,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: 'inline',
  // node_modules and node: builtins stay external; only the app's own TypeScript is bundled in.
  packages: 'external',
  // The same two aliases `tsconfig.json` and `vite.config.ts` declare, so a test imports what the
  // app imports rather than a relative path that only works from tests/.
  alias: { '@': join(root, 'src'), '@ui': join(root, 'src', 'ui') },
  logLevel: 'warning',
  outExtension: { '.js': '.mjs' },
});

const bundled = entries.map((e) => join(outdir, basename(e).replace(/\.ts$/, '.mjs')));
console.log(`running ${bundled.length} test file(s): ${entries.map((e) => relative(root, e)).join(' ')}\n`);

const run = spawnSync(process.execPath, ['--test', ...bundled], { stdio: 'inherit' });
process.exit(run.status ?? 1);
