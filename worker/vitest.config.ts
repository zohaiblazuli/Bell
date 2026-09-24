import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';
import path from 'node:path';

// Reads worker/migrations and hands them to the test worker as a binding; the
// setup file applies them to the isolated local D1 before each suite.
export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, 'migrations'));
  return {
    test: {
      setupFiles: ['./test/apply-migrations.ts'],
      poolOptions: {
        workers: {
          singleWorker: true,
          main: './src/index.ts',
          miniflare: {
            compatibilityDate: '2024-12-18',
            compatibilityFlags: ['nodejs_compat'],
            d1Databases: ['DB'],
            bindings: {
              TEST_MIGRATIONS: migrations,
              AUTH_JWT_SECRET: 'test-jwt-secret',
              VOTER_HMAC_SECRET: 'test-voter-secret',
              IP_ENCRYPTION_KEY: 'test-ip-encryption-key',
              GOOGLE_DRIVE_CLIENT_ID: 'test',
              GOOGLE_DRIVE_CLIENT_SECRET: 'test',
              GOOGLE_DRIVE_REFRESH_TOKEN: 'test',
              GOOGLE_DRIVE_QUARANTINE_FOLDER_ID: 'test',
              GOOGLE_DRIVE_PUBLISHED_FOLDER_ID: 'test',
              GOOGLE_DRIVE_THUMBNAILS_FOLDER_ID: 'test',
            },
          },
        },
      },
    },
  };
});
