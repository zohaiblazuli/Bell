#!/usr/bin/env node
// Generate the single Bell administrator row for the D1 database. Produces a
// PBKDF2-HMAC-SHA256 hash whose format matches worker/src/auth/password.ts, then
// prints the INSERT (and the wrangler command to run it).
//
//   node scripts/seed-admin.mjs --username admin --password "…" [--display "Bell Admin"] [--user-id <uuid>]
import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';

const ITERATIONS = 210_000; // must match password.ts

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      out[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const username = String(args.username || '').toLowerCase();
const password = args.password;
const display = args.display || 'Bell Administrator';
const userId = args['user-id'] || randomUUID();

if (!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(username) || !password || password === 'true') {
  console.error('Usage: node scripts/seed-admin.mjs --username <name> --password "<password>" [--display "…"] [--user-id <uuid>]');
  process.exit(1);
}

const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
const stored = `pbkdf2$${ITERATIONS}$${salt.toString('base64')}$${hash.toString('base64')}`;
const esc = (value) => String(value).replace(/'/g, "''");

const sql =
  `INSERT INTO admin_users (user_id, display_name, username, password_hash) ` +
  `VALUES ('${userId}', '${esc(display)}', '${username}', '${stored}');`;

console.log(sql);
console.error(`\n# user_id = ${userId}`);
console.error('# Apply with:');
console.error(`#   wrangler d1 execute bell-community --remote --command "${sql.replace(/"/g, '\\"')}"`);
console.error('# Then sign in from Bell and complete TOTP enrollment on first login.');
