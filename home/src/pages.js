// Every address of the site, with what search engines and link previews read.
// The prerender, the sitemap and the bench all walk this one list.
import Accueil from './pages/Accueil.jsx';
import { CeQuIlFait, PageBoxHome, Tarifs, Securite, Aide, Introuvable } from './pages/Autres.jsx';

export const PAGES = [
  {
    chemin: '/', fichier: 'index.html', composant: Accueil,
    titre: 'iAgent Home — votre Home Agent gère ce qui encombre votre vie',
    description: 'Courriers, factures, rendez-vous, école, assurances, démarches : votre Home Agent lit, range, prépare et vous rappelle. Vous gardez la main sur ce qui compte.',
  },
  {
    chemin: '/ce-qu-il-fait', fichier: 'ce-qu-il-fait.html', composant: CeQuIlFait,
    titre: 'Ce que fait votre Home Agent — iAgent Home',
    description: 'Onze domaines de l’administratif du foyer pris en charge, et une règle claire pour chaque action : autonome, confirmation ou confirmation forte.',
  },
  {
    chemin: '/box-home', fichier: 'box-home.html', composant: PageBoxHome,
    titre: 'La Box Home, blanche, louée et entretenue — iAgent Home',
    description: 'Une Box blanche installée chez vous, qui porte votre Home Agent et sa voix. Louée, entretenue et mise à jour par iAgent.',
  },
  {
    chemin: '/tarifs', fichier: 'tarifs.html', composant: Tarifs,
    titre: 'Tarifs iAgent Home — quatre offres TTC par mois',
    description: 'Home Digital, Home Agent, Home Box et Home Family : les offres iAgent Home, prix toutes taxes comprises par mois, avec ou sans Box.',
  },
  {
    chemin: '/securite', fichier: 'securite.html', composant: Securite,
    titre: 'Sécurité : ce que l’agent fait seul, ce qu’il vous demande — iAgent Home',
    description: 'Payer, résilier, envoyer un courrier important : rien ne se fait sans votre accord. La politique d’action de votre Home Agent, action par action.',
  },
  {
    chemin: '/aide', fichier: 'aide.html', composant: Aide,
    titre: 'Aide et questions fréquentes — iAgent Home',
    description: 'Les réponses aux questions fréquentes sur iAgent Home : le Home Agent, la Box Home louée, les confirmations et les prix TTC.',
  },
];

/** Not in the sitemap: served by Vercel for unknown addresses. */
export const PAGE_404 = {
  chemin: '/404', fichier: '404.html', composant: Introuvable, horsPlan: true,
  titre: 'Page introuvable — iAgent Home',
  description: 'Cette page d’iAgent Home n’existe pas ou plus. Retrouvez le Home Agent, la Box Home, les offres et l’aide depuis l’accueil.',
};

export const pageDe = (chemin) => {
  const propre = chemin.replace(/\/+$/, '').replace(/\.html$/, '') || '/';
  return PAGES.find((p) => p.chemin === propre) ?? PAGE_404;
};
