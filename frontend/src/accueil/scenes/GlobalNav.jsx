import { useEffect, useState } from 'react';
import { Logo, LIENS, RECRUTER } from '../composants.jsx';
import { suivre } from '../analytique.js';

// The Business navigation of max's global document (07/10, §3).
const ENTREES = [
  { libelle: 'Produit', href: '/workforce', page: 'workforce' },
  { libelle: 'Agents', href: LIENS.catalogue, page: 'catalogue', evenement: 'catalog_click' },
  { libelle: 'Activités', href: '/activites', page: 'activites' },
  { libelle: 'Secteurs', href: '/secteurs', page: 'secteurs' },
  { libelle: 'Créer votre entreprise', href: '/create', page: 'create', evenement: 'create_company_click' },
  { libelle: 'Voice', href: '/voice', page: 'voice' },
  { libelle: 'iAgent Box', href: '/box', page: 'box', evenement: 'box_click' },
  { libelle: 'Entreprise', href: '/enterprise', page: 'enterprise', evenement: 'enterprise_click' },
  { libelle: 'Ressources', href: '/how-it-works', page: 'how-it-works' },
];

const Loupe = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" fill="none" /><path d="M20 20l-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
);

/**
 * The site's header, as on max's mockups: logo, the five entries, a search
 * field that opens the catalogue on the words typed, and the way to recruit.
 */
export default function GlobalNav({ page = 'accueil', seuil = 24 }) {
  const [opaque, setOpaque] = useState(false);
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    const maj = () => setOpaque(window.scrollY > seuil);
    maj();
    window.addEventListener('scroll', maj, { passive: true });
    return () => window.removeEventListener('scroll', maj);
  }, []);

  useEffect(() => {
    document.body.style.overflow = ouvert ? 'hidden' : '';
    const echap = (e) => e.key === 'Escape' && setOuvert(false);
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [ouvert]);

  return (
    <header className={`entete ${opaque || ouvert ? 'entete-opaque' : ''}`}>
      <div className="entete-ligne">
        <a href="/" aria-label="iAgent, accueil" className="flex-none"><Logo className="h-[28px] md:h-[32px] w-auto" /></a>
        <nav className="entete-nav hidden xl:flex items-center gap-[18px] 2xl:gap-7 ml-6 2xl:ml-8" aria-label="Navigation principale">
          {ENTREES.map((e) => (
            <a key={e.libelle} href={e.href} aria-current={e.page && page === e.page ? 'page' : undefined} onClick={() => e.evenement && suivre(e.evenement)}>{e.libelle}</a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <form action="/catalogue" method="get" role="search" className="entete-recherche hidden lg:flex xl:hidden min-[1720px]:flex" onSubmit={() => suivre('catalog_click', { depuis: 'recherche' })}>
            <Loupe />
            <label htmlFor="recherche-entete" className="sr-only">Rechercher un agent, un métier</label>
            <input id="recherche-entete" name="q" type="search" placeholder="Rechercher un agent, un métier…" autoComplete="off" />
          </form>
          <a href="/catalogue" className="inline-flex lg:hidden 2xl:inline-flex min-[1720px]:hidden items-center justify-center w-11 h-11 rounded-xl text-[var(--texte-doux)] hover:text-white" aria-label="Rechercher un agent ou un métier"><Loupe /></a>
          <a href={RECRUTER} className="bouton bouton-braise !min-h-[40px] !px-4 !text-sm hidden sm:inline-flex">Recruter un agent</a>
          <button type="button" className="xl:hidden w-11 h-11 inline-flex items-center justify-center rounded-xl border border-[var(--trait-fort)]" aria-expanded={ouvert} aria-controls="menu-mobile" aria-label={ouvert ? 'Fermer le menu' : 'Ouvrir le menu'} onClick={() => setOuvert(!ouvert)}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              {ouvert
                ? <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                : <path d="M4 8h16M4 16h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
            </svg>
          </button>
        </div>
      </div>
      {ouvert && (
        <nav id="menu-mobile" className="xl:hidden pb-8 pt-2 max-w-[var(--largeur)] mx-auto" aria-label="Navigation principale">
          <form action="/catalogue" method="get" role="search" className="entete-recherche flex mb-4">
            <Loupe />
            <label htmlFor="recherche-menu" className="sr-only">Rechercher un agent, un métier</label>
            <input id="recherche-menu" name="q" type="search" placeholder="Rechercher un agent, un métier…" autoComplete="off" />
          </form>
          <ul className="flex flex-col">
            {ENTREES.map((e) => (
              <li key={e.libelle}>
                <a href={e.href} className="block py-4 text-xl font-[Montserrat] font-semibold tracking-wide border-b border-[var(--trait)]" onClick={() => { setOuvert(false); e.evenement && suivre(e.evenement); }}>{e.libelle}</a>
              </li>
            ))}
          </ul>
          <a href={RECRUTER} className="bouton bouton-braise w-full mt-6">Recruter un agent</a>
        </nav>
      )}
    </header>
  );
}
