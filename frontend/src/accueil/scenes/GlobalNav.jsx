import { useEffect, useState } from 'react';
import { Logo, LIENS } from '../composants.jsx';
import { suivre } from '../analytique.js';
import { lireListe, ecouterListe, nombreDAgents, PAGE_LISTE } from '../../data/liste.js';

// The navigation of max's art-direction audit (08/10, §18): five entries,
// four of them opening a drawer, and one way in, the demo. Resources moved
// to the footer.
const ENTREES = [
  { libelle: 'Produit', href: '/workforce', page: 'workforce', tiroir: [
    ['Workforce', '/workforce', 'vos experts, métier par métier'],
    ['Desktop Commander', '/#desktop-commander', 'toute l’équipe sur un écran'],
    ['Box Commander', '/box', 'le poste posé dans vos bureaux'],
    ['Voice', '/voice', 'parlez à vos agents'],
    ['Standard téléphonique', '/standard-telephonique', 'bientôt'],
    ['Support Center', '/support-center', 'le service client'],
    ['Sales Center', '/sales-center', 'la force commerciale'],
  ] },
  { libelle: 'Agents', href: LIENS.catalogue, page: 'catalogue', evenement: 'catalog_click', tiroir: [
    ['Catalogue', LIENS.catalogue, 'tous les métiers'],
    ['Activités', '/activites', 'entrez par votre branche'],
    ['Secteurs', '/secteurs', 'les familles de métiers'],
    ['Évolution des agents', '/skills', 'compétences et packs'],
  ] },
  { libelle: 'Créer', href: '/create', page: 'create', evenement: 'create_company_click', tiroir: [
    ['Créer votre entreprise', '/create', 'de l’idée à l’équipe'],
    ['Opportunités', '/opportunities', 'les idées qui marchent'],
    ['Business plan et financement', LIENS.entreprise, 'avec vos experts'],
  ] },
  { libelle: 'Entreprise', href: '/enterprise', page: 'enterprise', evenement: 'enterprise_click', tiroir: [
    ['iAgent Enterprise', '/enterprise', 'pour les grands groupes'],
    ['Local, hybride ou cloud', '/local-ai', 'où tournent vos agents'],
    ['Sécurité et contrôle', '/security', 'vos données, vos règles'],
    ['iAgent inside iAgent', '/iagent-inside-iagent', 'notre propre équipe'],
  ] },
  { libelle: 'Tarifs', href: '/pricing', page: 'pricing' },
];

const DEMO = '/contact';

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
  // The recruitment list, shown once it holds something (read after mount:
  // the prerendered page knows nothing of this browser).
  const [liste, setListe] = useState(0);
  useEffect(() => {
    const compter = (l) => setListe(nombreDAgents(l) + (l.box ? 1 : 0));
    compter(lireListe());
    return ecouterListe(compter);
  }, []);

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
        <nav className="entete-nav hidden lg:flex items-center gap-6 2xl:gap-9 ml-8 2xl:ml-12" aria-label="Navigation principale">
          {ENTREES.map((e) => (
            <div key={e.libelle} className="menu-entree relative">
              <a href={e.href} aria-current={e.page && page === e.page ? 'page' : undefined} onClick={() => e.evenement && suivre(e.evenement)}>{e.libelle}</a>
              {e.tiroir && (
                <div className="menu-tiroir neon">
                  {e.tiroir.map(([nom, href, detail]) => <a key={nom} href={href}>{nom}<span>{detail}</span></a>)}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <form action="/catalogue" method="get" role="search" className="entete-recherche hidden min-[1720px]:flex" onSubmit={() => suivre('catalog_click', { depuis: 'recherche' })}>
            <Loupe />
            <label htmlFor="recherche-entete" className="sr-only">Rechercher un agent, un métier</label>
            <input id="recherche-entete" name="q" type="search" placeholder="Rechercher un agent, un métier…" autoComplete="off" />
          </form>
          <a href="/catalogue" className="inline-flex min-[1720px]:hidden items-center justify-center w-11 h-11 rounded-xl text-[var(--texte-doux)] hover:text-white" aria-label="Rechercher un agent ou un métier"><Loupe /></a>
          {liste > 0 && (
            <a href={PAGE_LISTE} className="inline-flex items-center gap-2 h-11 px-3 rounded-xl border border-[var(--trait-fort)] text-sm text-white hover:border-[var(--cyan)]" aria-label={`Ma liste de recrutement, ${liste} élément${liste > 1 ? 's' : ''}`}>
              <span className="hidden sm:inline">Ma liste</span>
              <span className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-[var(--cyan)] text-[#020817] text-xs font-bold">{liste}</span>
            </a>
          )}
          <a href={DEMO} className="bouton bouton-plein !min-h-[40px] !px-4 !text-sm hidden sm:inline-flex" onClick={() => suivre('demo_click')}>Demander une démo</a>
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
        <nav id="menu-mobile" className="lg:hidden pb-8 pt-2 max-w-[var(--largeur)] mx-auto" aria-label="Navigation principale">
          <form action="/catalogue" method="get" role="search" className="entete-recherche flex mb-4">
            <Loupe />
            <label htmlFor="recherche-menu" className="sr-only">Rechercher un agent, un métier</label>
            <input id="recherche-menu" name="q" type="search" placeholder="Rechercher un agent, un métier…" autoComplete="off" />
          </form>
          <ul className="flex flex-col">
            {ENTREES.map((e) => (
              <li key={e.libelle} className="border-b border-[var(--trait)] py-3">
                <a href={e.href} className="block py-1 text-xl font-[Montserrat] font-bold tracking-wide" onClick={() => { setOuvert(false); e.evenement && suivre(e.evenement); }}>{e.libelle}</a>
                {e.tiroir && (
                  <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    {e.tiroir.map(([nom, href]) => <li key={nom}><a href={href} className="text-sm text-[var(--texte-doux)]" onClick={() => setOuvert(false)}>{nom}</a></li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <a href={DEMO} className="bouton bouton-plein w-full mt-6">Demander une démo</a>
        </nav>
      )}
    </header>
  );
}
