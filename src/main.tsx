import React from 'react';
import ReactDOM from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { hydrate, loadSettings } from './lib/store';
// Type-only inside, so this pulls in no stylesheet and cannot disturb the order below.
import { loadPet } from './state/usePet';
// Stylesheet order is explicit, and each file is a real module so Vite invalidates it on change.
// Tailwind + @theme first, then the generated foundations, then the hand-written layers, then the
// component layer — which must come last so a primitive's rules win over the app.css block it
// supersedes while the port is in flight.
import './styles/index.css';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/type.css';
import './styles/background.css';
import './styles/chrome.css';
import './styles/app.css';
import './ui/styles';
// App comes AFTER the sheets above, and that is load-bearing rather than tidy: each view imports
// its own stylesheet, and ES modules evaluate in import order — so importing App first would put
// every view's CSS at the head of the bundle, where app.css would then override it.
import App from './App';

/**
 * Swallow every drop the app does not handle itself.
 *
 * `dragDropEnabled` is false in `tauri.conf.json` so the notebook's own `drop` handler can see the file
 * — but that hands the OS drop to the DOM everywhere, and the webview's default for an unhandled one is
 * to navigate to it. A PDF dropped on the sidebar would replace the running app with a file:// view of
 * itself, taking the 400ms save window with it. `dragover` has to be defaulted too, or `drop` never
 * fires at all. Both are registered on the window, so anything that handles a drop for real — the
 * notebook stage — has already run by the time these do.
 */
for (const type of ['dragover', 'drop'] as const) {
  window.addEventListener(type, (e) => e.preventDefault());
}

// Study state is read synchronously all over the app, so it is loaded from disk before the
// first render rather than threaded through as a loading state.
void hydrate().then(async () => {
  // The mascot's spritesheet is read before the first frame too, and for a reason the splash makes
  // sharp: it hides the sidebar's mascot slot and travels its own crab into it, so if the pet arrived
  // one render later the handoff would land on a different animal than it started with. A failure here
  // is not one — `usePet` falls back to Mr. Bell, exactly as it does when no pet is selected.
  const { pet } = loadSettings();
  if (pet) await loadPet(pet).catch(() => {});

  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  // The window starts hidden (`visible: false` in tauri.conf.json) so Windows never flashes its
  // opaque white default before the transparent webview has painted. Reveal it only once the first
  // frame — the splash over the see-through window — is on screen. Two rAFs: the first runs before
  // that paint is committed, the second after it.
  requestAnimationFrame(() => requestAnimationFrame(() => void getCurrentWindow().show()));
});
