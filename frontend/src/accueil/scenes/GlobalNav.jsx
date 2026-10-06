import { useEffect, useState } from 'react';
import { Logo, LIENS, TELECHARGEMENT } from '../composants.jsx';
import { suivre } from '../analytique.js';

const ENTREES = [
  { libelle: 'Produit', href: '#desktop-commander' },
  { libelle: 'Agents', href: LIENS.catalogue, evenement: 'catalog_click' },
  { libelle: 'Créer votre entreprise', href: LIENS.entreprise, evenement: 'create_company_click' },
  { libelle: 'iAgent Box', href: '#box', evenement: 'box_click' },
  { libelle: 'Entreprise', href: '#confiance', evenement: 'enterprise_click' },
];

/** Very light over the hero, more opaque once the reader has moved on. */
export default function GlobalNav() {
  const [opaque, setOpaque] = useState(false);
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    const maj = () => setOpaque(window.scrollY > 240);
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
        <a href="/" aria-label="iAgent, accueil" className="flex-none"><Logo className="h-[22px] md:h-6 w-auto" /></a>
        <nav className="entete-nav hidden lg:flex items-center gap-7 ml-6" aria-label="Navigation principale">
          {ENTREES.map((e) => (
            <a key={e.libelle} href={e.href} onClick={() => e.evenement && suivre(e.evenement)}>{e.libelle}</a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <a href="/catalogue" className="hidden md:inline-flex items-center justify-center w-11 h-11 rounded-xl text-[var(--texte-doux)] hover:text-white" aria-label="Rechercher un agent ou un métier" onClick={() => suivre('catalog_click', { depuis: 'recherche' })}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" fill="none" /><path d="M20 20l-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </a>
          <a href={TELECHARGEMENT} className="hidden md:inline-flex bouton bouton-contour !min-h-[40px] !px-4 !text-sm">Télécharger l'application</a>
          <a href="#commencer" className="bouton bouton-plein !min-h-[40px] !px-4 !text-sm" onClick={() => suivre('hero_start', { depuis: 'entete' })}>Commencer</a>
          <button type="button" className="lg:hidden w-11 h-11 inline-flex items-center justify-center rounded-xl border border-[var(--trait-fort)]" aria-expanded={ouvert} aria-controls="menu-mobile" aria-label={ouvert ? 'Fermer le menu' : 'Ouvrir le menu'} onClick={() => setOuvert(!ouvert)}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              {ouvert
                ? <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                : <path d="M4 8h16M4 16h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
            </svg>
          </button>
        </div>
      </div>
      {ouvert && (
        <nav id="menu-mobile" className="lg:hidden pb-8 pt-2" aria-label="Navigation principale">
          <ul className="flex flex-col">
            {ENTREES.map((e) => (
              <li key={e.libelle}>
                <a href={e.href} className="block py-4 text-2xl font-[Sora] font-semibold tracking-tight border-b border-[var(--trait)]" onClick={() => { setOuvert(false); e.evenement && suivre(e.evenement); }}>{e.libelle}</a>
              </li>
            ))}
          </ul>
          <a href={TELECHARGEMENT} className="bouton bouton-contour w-full mt-6">Télécharger l'application</a>
        </nav>
      )}
    </header>
  );
}
