import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import '../accueil/accueil.css';
import './pages.css';
import Page from './Page.jsx';

const racine = document.getElementById('page');
const page = <StrictMode><Page nom={racine.dataset.page} /></StrictMode>;
// The build prerenders each page into #page; the browser takes over the same markup.
if (racine.firstElementChild) hydrateRoot(racine, page);
else createRoot(racine).render(page);
