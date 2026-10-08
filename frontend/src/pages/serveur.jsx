// Server entry: renders the offer pages at build time (accueil/prerendre.mjs).
import { renderToString } from 'react-dom/server';
import Page from './Page.jsx';
export { PAGES } from './site.js';

export const rendrePage = (nom) => renderToString(<Page nom={nom} />);
