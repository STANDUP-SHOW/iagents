import { useEffect, useState } from 'react';
import GlobalNav from '../accueil/scenes/GlobalNav.jsx';
import Footer from '../accueil/scenes/Footer.jsx';
import { suivre } from '../accueil/analytique.js';
import { COMPOSANTS } from './Pages.jsx';

// The events a page view counts as (plan, §19).
const VUES = { pricing: 'pricing_view', 'inside-iagent': 'inside_iagent_view' };

/** One offer page in the site's frame: header, the page, footer. */
export default function Page({ nom }) {
  const Contenu = COMPOSANTS[nom];
  const [pret, setPret] = useState(false);
  useEffect(() => { setPret(true); if (VUES[nom]) suivre(VUES[nom]); }, [nom]);
  return (
    <div className={`mq pg ${pret ? 'mq-pret' : ''}`}>
      <a href="#contenu" className="saut">Aller au contenu</a>
      <GlobalNav page={nom} />
      <main id="contenu"><Contenu /></main>
      <Footer />
    </div>
  );
}
