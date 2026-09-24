# Owl-head symbol (Bell App v2 brand sheet, "2a Owl head")

The app icon and favicon. Rendered from the brand sheet's own markup (`Bell Wordmark.dc.html`,
Turn 3) on a transparent ground:

- `owl-16.png` is the sheet's separate 16px pixel-grid drawing, so the ears and pupils survive.
- `owl-20.png` to `owl-30.png` drop the beak, as the sheet's 24px drawing does.
- `owl-32.png` and up are the full symbol: ears, head, eyes, pupils, beak.

`npm run icon` regenerates every platform icon from `owl-1024.png`, then `scripts/pack-ico.mjs`
rebuilds `src-tauri/icons/icon.ico` from these exact per-size drawings.

On a dark ground the sheet turns the ears cream ("On ink"); the app's own lockup does that in Night.
An .ico cannot follow the taskbar theme, so the icon uses the default drawing.
