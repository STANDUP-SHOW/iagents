import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App.jsx';

const racine = document.getElementById('racine');
const app = <App chemin={window.location.pathname} />;
// Built pages arrive prerendered (outils/prerendre.mjs); the dev server does not.
if (racine.firstElementChild) hydrateRoot(racine, app);
else createRoot(racine).render(app);
