import { applyD1Migrations, env } from 'cloudflare:test';

// Apply the real worker/migrations to the isolated local D1 once per worker.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
