import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// The version the app SHOWS is read from the one place the shipped exe is stamped from —
// `tauri.conf.json` — so the Settings string can never drift from the real build the way the
// hand-typed literal in `App.tsx` could. The build stamp is `git describe` plus `-public`, so a bug
// report names the exact public commit without exposing an internal `-dirty` marker. Both bake in at
// frontend-build time — which `tauri build` re-runs on every build — and surface as the globals
// declared in `src/vite-env.d.ts`: no IPC, no capability, no async, still passed synchronously.
const appVersion = JSON.parse(
  readFileSync(fileURLToPath(new URL('./src-tauri/tauri.conf.json', import.meta.url)), 'utf8'),
).version as string;

let appBuild = 'dev';
try {
  appBuild = `${execSync('git describe --always --tags', { encoding: 'utf8' }).trim()}-public`;
} catch {
  // No git in the build environment — the honest fallback, the same string the literal used to be.
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_BUILD__: JSON.stringify(appBuild),
  },

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },
}));
