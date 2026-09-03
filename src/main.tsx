import React from 'react';
import ReactDOM from 'react-dom/client';
import { hydrate } from './lib/store';
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

// Study state is read synchronously all over the app, so it is loaded from disk before the
// first render rather than threaded through as a loading state.
void hydrate().then(() => {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
