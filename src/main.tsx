import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { hydrate } from './lib/store';
import './styles/index.css';

// Study state is read synchronously all over the app, so it is loaded from disk before the
// first render rather than threaded through as a loading state.
void hydrate().then(() => {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
