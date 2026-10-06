import donnees from 'virtual:accueil';
import { Logo, TELECHARGEMENT, LIENS } from '../composants.jsx';
import { suivre } from '../analytique.js';

/** Plain links a crawler can follow into the catalogue's static pages. */
export default function Footer() {
  const { activitesPopulaires, vitrine, compteurs } = donnees;
  const colonnes = [
    { titre: 'Produit', liens: [
      { nom: 'Desktop Commander', href: '#desktop-commander' },
      { nom: 'iAgent Box', href: '#box' },
      { nom: 'Sécurité et confiance', href: '#confiance' },
      { nom: 'Télécharger pour Windows', href: TELECHARGEMENT },
    ] },
    { titre: 'Agents', liens: [
      { nom: `Les ${compteurs.fiches.toLocaleString('fr-FR')} métiers`, href: LIENS.catalogue },
      ...vitrine.slice(0, 5).map((f) => ({ nom: f.metier, href: f.url })),
    ] },
    { titre: 'Par activité', liens: activitesPopulaires.map((a) => ({ nom: a.nom, href: a.url })) },
    { titre: 'Entreprise', liens: [
      { nom: 'Créer votre entreprise', href: LIENS.entreprise },
      { nom: 'Équiper votre entreprise', href: LIENS.box },
    ] },
  ];

  return (
    <footer className="border-t border-[var(--trait)] mt-10">
      <div className="px-[var(--gouttiere)]"><div className="cadre py-16 grid gap-12 lg:grid-cols-[1.2fr_repeat(4,1fr)]">
        <div>
          <Logo variante="blanc" className="h-7 w-auto" />
          <p className="mt-5 text-sm text-[var(--texte-doux)] max-w-xs">Des collaborateurs IA par métier, qui connaissent vos logiciels et travaillent chez vous ou dans le cloud.</p>
        </div>
        {colonnes.map((c) => (
          <nav key={c.titre} aria-label={c.titre}>
            <p className="font-[Orbitron] text-[0.7rem] tracking-[0.2em] uppercase text-[var(--texte-pale)]">{c.titre}</p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {c.liens.filter((l) => l.href).map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="text-sm text-[var(--texte-doux)] hover:text-[var(--cyan)] transition-colors" onClick={() => l.href.startsWith('/agents/') && suivre('catalog_click')}>{l.nom}</a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div></div>
      <div className="px-[var(--gouttiere)]"><div className="cadre pb-10 text-xs text-[var(--texte-pale)] flex flex-wrap gap-4 justify-between">
        <p>© {new Date().getFullYear()} iAgent · e-Agent Agency</p>
        <p>Human ambition. Agentic execution.</p>
      </div></div>
    </footer>
  );
}
