import { useRef } from 'react';
import donnees from 'virtual:accueil';
import { Bouton, Fleche, nombre } from '../composants.jsx';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';
import { suivre } from '../analytique.js';

/**
 * Scene 06 — the way in for whoever knows their trade: one big search, six
 * activities, three experts as a foretaste, then the catalogue.
 */
export default function EntrerParActivite() {
  const ref = useRef(null);
  const { compteurs, activitesPopulaires, vitrine } = donnees;

  useScene(ref, (ajouter) => {
    const revele = (q) => q('.ea-bloc').forEach((el) => gsap.from(el, { opacity: 0, y: 30, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } }));
    ajouter(BUREAU, revele);
    ajouter(MOBILE, revele);
  });

  return (
    <section ref={ref} id="activites" className="scene" aria-labelledby="titre-activite">
      <div className="cadre">
        <div className="ea-bloc text-center max-w-3xl mx-auto">
          <p className="surtitre justify-center">Entrez par votre activité</p>
          <h2 id="titre-activite" className="titre-display titre-grand mt-4">Commencez par <span className="degrade">ce que vous faites.</span></h2>
        </div>

        <form action="/catalogue" method="get" role="search" className="ea-bloc intention-heros-cadre mt-10 max-w-2xl mx-auto" onSubmit={() => suivre('catalog_click', { depuis: 'activite' })}>
          <div className="intention">
            <label htmlFor="recherche-activite" className="sr-only">Votre activité</label>
            <input id="recherche-activite" name="q" type="search" placeholder="Imprimerie, boulangerie, garage, cabinet dentaire…" autoComplete="off" />
            <button type="submit" className="bouton bouton-plein !min-h-[44px] !px-4 md:!px-5"><span className="hidden sm:inline">Trouver mes experts</span><span className="sm:hidden">Trouver</span></button>
          </div>
        </form>

        <ul className="ea-bloc flex flex-wrap justify-center gap-2 mt-6" aria-label="Activités les plus demandées">
          {activitesPopulaires.map((a) => <li key={a.url}><a href={a.url} className="puce puce-lien">{a.nom}</a></li>)}
        </ul>

        <ul className="mt-14 grid md:grid-cols-3 gap-4" aria-label="Quelques experts du catalogue">
          {vitrine.slice(0, 3).map((f) => (
            <li key={f.id} className="ea-bloc">
              <a href={f.url} className="neon neon-survol p-5 flex flex-col gap-3 h-full" onClick={() => suivre('catalog_click', { fiche: f.id })}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="note">{f.secteur}</p>
                    <h3 className="font-[Montserrat] text-lg font-bold text-white leading-tight mt-1">{f.metier}</h3>
                  </div>
                  <span className="statut whitespace-nowrap">Disponible</span>
                </div>
                <p className="text-[0.88rem] text-[var(--texte-doux)] leading-relaxed line-clamp-3">{f.accroche}</p>
                <ul className="flex flex-wrap gap-1.5 mt-auto">{f.logiciels.map((l) => <li key={l} className="puce !text-[0.72rem]">{l}</li>)}</ul>
                <span className="inline-flex items-center gap-2 text-sm text-[var(--cyan)] font-semibold">Voir le profil <Fleche /></span>
              </a>
            </li>
          ))}
        </ul>

        <div className="ea-bloc mt-12 flex flex-wrap justify-center gap-3">
          <Bouton href="/catalogue" evenement="catalog_click">Voir les {nombre(compteurs.fiches)} métiers</Bouton>
          <Bouton href="/activites" variante="contour" evenement="catalog_click">Les {nombre(compteurs.activites)} activités</Bouton>
        </div>
      </div>
    </section>
  );
}
