import React from 'react';
import ReactDOM from 'react-dom/client';
import App, { PAGES } from './App';
import './index.css';

// The home page sends visitors here with what they asked for:
// /catalogue?page=entreprise&idee=…, /catalogue?page=box, /catalogue?q=…
const params = new URLSearchParams(window.location.search);
const page = PAGES.some((p) => p.id === params.get('page')) ? params.get('page') : 'catalogue';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App pageInitiale={page} rechercheInitiale={params.get('q') ?? ''} ideeInitiale={params.get('idee') ?? ''} />
  </React.StrictMode>
);
