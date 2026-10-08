import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './accueil.css';
import Accueil from './Accueil.jsx';
import { rafraichirApresChargement } from './mouvement.js';

const racine = document.getElementById('accueil');
const page = <StrictMode><Accueil /></StrictMode>;
// The build prerenders the page into #accueil so it reads without script;
// the browser then takes over the same markup.
if (racine.firstElementChild) hydrateRoot(racine, page);
else createRoot(racine).render(page);
rafraichirApresChargement();
