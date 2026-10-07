import { useEffect, useState } from 'react';
import { Logo, LIENS, TELECHARGEMENT } from '../composants.jsx';
import { suivre } from '../analytique.js';

const ENTREES = [
  { libelle: 'Produit', href: '/#desktop-commander' },
  { libelle: 'Agents', href: LIENS.catalogue, evenement: 'catalog_click' },
  { libelle: 'Créer votre entreprise', href: LIENS.entreprise, evenement: 'create_company_click' },
  { libelle: 'iAgent Box', href: '/#box', evenement: 'box_click' },
  { libelle: 'Entreprise', href: '/#confiance', evenement: 'enterprise_click' },
];

const Loupe = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" fill="none" /><path d="M20 20l-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
);

/**
 * The site's header, as on max's mockups: logo, the five entries, a search
 * field that opens the catalogue on the words typed, and the download.
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
        <a href="/" aria-label="iAgent, accueil" className="flex-none"><Logo className="h-[22px] md:h-[26px] w-auto" /></a>
        <nav className="entete-nav hidden xl:flex items-center gap-7 ml-8" aria-label="Navigation principale">
          {ENTREES.map((e) => (
            <a key={e.libelle} href={e.href} aria-current={page === 'catalogue' && e.href === LIENS.catalogue ? 'page' : undefined} onClick={() => e.evenement && suivre(e.evenement)}>{e.libelle}</a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <form action="/catalogue" method="get" role="search" className="entete-recherche hidden lg:flex" onSubmit={() => suivre('catalog_click', { depuis: 'recherche' })}>
            <Loupe />
            <label htmlFor="recherche-entete" className="sr-only">Rechercher un agent, un métier</label>
            <input id="recherche-entete" name="q" type="search" placeholder="Rechercher un agent, un métier…" autoComplete="off" />
          </form>
          <a href="/catalogue" className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-xl text-[var(--texte-doux)] hover:text-white" aria-label="Rechercher un agent ou un métier"><Loupe /></a>
          <a href={TELECHARGEMENT} className="bouton bouton-braise !min-h-[40px] !px-4 !text-sm hidden sm:inline-flex">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v11H3z M8 20h8 M12 16v4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" /></svg>
            Télécharger l'app
          </a>
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
          <a href={TELECHARGEMENT} className="bouton bouton-braise w-full mt-6">Télécharger l'app</a>
        </nav>
      )}
    </header>
  );
}
