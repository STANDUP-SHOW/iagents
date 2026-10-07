import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { creerClientTauri, creerClientWeb } from './api.js';
import './charte.css';

// Inside the desktop app, every call goes through Rust (token in the system
// keyring). In a plain browser (vite dev, captures), the web Client keeps the
// token in page memory only.
async function demarrer() {
  const client = globalThis.__TAURI_INTERNALS__
    ? creerClientTauri((await import('@tauri-apps/api/core')).invoke)
    : creerClientWeb({});
  createRoot(document.getElementById('racine')).render(<App client={client} />);
}
demarrer();
