// Server entry: renders the home page to HTML at build time
// (accueil/prerendre.mjs puts it into dist/index.html).
import { renderToString } from 'react-dom/server';
import Accueil from './Accueil.jsx';

export const rendre = () => renderToString(<Accueil />);
