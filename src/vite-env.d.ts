/// <reference types="vite/client" />

// Injected by `vite.config.ts` `define` (see the comment there). `__APP_VERSION__` mirrors
// `tauri.conf.json`; `__APP_BUILD__` is the matching public release label.
declare const __APP_VERSION__: string;
declare const __APP_BUILD__: string;
