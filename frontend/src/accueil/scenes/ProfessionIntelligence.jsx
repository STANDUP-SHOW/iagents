import { useRef } from 'react';
import donnees from 'virtual:accueil';
import { Bouton, Fleche, nombre, euros } from '../composants.jsx';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';
import { suivre } from '../analytique.js';

/**
 * Scene 06 — a job does not fit in a prompt. The same accountant in three
 * trades, each with the words and software of its activity pack; then the
 * formula, with the catalogue's own counts; then real fiches.
 */
export default function ProfessionIntelligence() {
  const ref = useRef(null);
  const { compteurs, metierDansTroisMondes: m, vitrine, prixAgent } = donnees;
  const FORMULE = [
    ['Métier', `${nombre(compteurs.fiches)} fiches`],
    ['Secteur', `${nombre(compteurs.secteurs)} secteurs · ${nombre(compteurs.activites)} activités`],
    ['Logiciels', `${nombre(compteurs.logiciels)} au référentiel`],
    ['Missions', `${nombre(compteurs.taches)} tâches décrites`],
    ['Entreprise', 'la vôtre, à l’entretien'],
  ];

  useScene(ref, (ajouter) => {
    const revele = (q, sel, dy = 40) => q(sel).forEach((el) => gsap.from(el, { opacity: 0, y: dy, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 86%' } }));
    ajouter(BUREAU, (q) => {
      gsap.from(q('.pi-monde'), { opacity: 0, y: 60, rotateX: -12, transformPerspective: 900, stagger: 0.18, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: q('.pi-mondes')[0], start: 'top 75%' } });
      gsap.from(q('.pi-terme'), { opacity: 0, x: -30, stagger: 0.12, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: q('.pi-formule')[0], start: 'top 80%' } });
      revele(q, '.pi-carte', 50);
    });
    ajouter(MOBILE, (q) => revele(q, '.pi-monde, .pi-terme, .pi-carte', 24));
  });

  return (
    <section ref={ref} className="scene" aria-labelledby="titre-metier">
      <div className="cadre">
        <h2 id="titre-metier" className="titre-display titre-moyen max-w-4xl">
          Un métier ne tient pas dans un prompt.<br />
          <span className="text-[var(--texte-doux)]">Chaque métier possède son </span><span className="lumiere">propre monde.</span>
        </h2>

        <div className="pi-mondes mt-14 grid md:grid-cols-3 gap-5">
          {m.activites.map((a) => (
            <a key={a.nom} href={a.url} className="pi-monde verre p-6 flex flex-col gap-4 group hover:border-[rgba(3,243,255,0.35)] transition-colors" onClick={() => suivre('catalog_click', { activite: a.nom })}>
              <p className="font-[Sora] text-lg leading-tight">
                <span className="text-white">{m.metier.metier}</span>
                <span className="text-[var(--texte-pale)]"> / </span>
                <span className="text-[var(--cyan)]">{a.nom}</span>
              </p>
              <p className="text-[0.9rem] text-[var(--texte-doux)] leading-relaxed">{a.trait}</p>
              <div>
                <p className="note mb-2">Ses mots</p>
                <ul className="flex flex-wrap gap-1.5">{a.vocabulaire.map((v) => <li key={v} className="puce">{v}</li>)}</ul>
              </div>
              <div>
                <p className="note mb-2">Ses logiciels</p>
                <ul className="flex flex-wrap gap-1.5">{a.logiciels.map((v) => <li key={v} className="puce puce-cyan">{v}</li>)}</ul>
              </div>
              <span className="mt-auto inline-flex items-center gap-2 text-sm text-[var(--cyan)] font-semibold">Voir ce poste <Fleche /></span>
            </a>
          ))}
        </div>

        <div className="pi-formule mt-20 md:mt-28 grid lg:grid-cols-[1fr_1.1fr] gap-12 items-center">
          <ol className="flex flex-col">
            {FORMULE.map(([terme, chiffre], i) => (
              <li key={terme} className="pi-terme flex items-baseline gap-5 py-3 border-b border-[var(--trait)]">
                <span className="font-[Sora] text-[clamp(1.8rem,4vw,3.4rem)] font-semibold tracking-tight leading-none">{terme}</span>
                {i < FORMULE.length - 1 && <span className="text-[var(--cyan)] text-2xl" aria-hidden="true">×</span>}
                <span className="ml-auto text-right text-sm text-[var(--texte-doux)]">{chiffre}</span>
              </li>
            ))}
          </ol>
          <div>
            <p className="chapeau">
              Chaque collaborateur part d'une fiche métier écrite comme celle d'un professionnel expérimenté : ses tâches, ses règles, ses documents, ses logiciels.
              Le secteur et l'activité y ajoutent leurs mots et leurs usages. Votre entreprise fait le reste, pendant l'entretien.
            </p>
            <Bouton href="/catalogue" evenement="catalog_click" className="mt-8">Explorer le catalogue</Bouton>
          </div>
        </div>

        <ul className="mt-20 grid sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Quelques collaborateurs du catalogue">
          {vitrine.map((f) => (
            <li key={f.id} className="pi-carte">
              <a href={f.url} className="verre p-5 flex flex-col gap-3 h-full hover:border-[rgba(3,243,255,0.35)] transition-colors" onClick={() => suivre('catalog_click', { fiche: f.id })}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="note">{f.id} · {f.secteur}</p>
                    <h3 className="font-[Sora] text-lg font-semibold leading-tight mt-1">{f.metier}</h3>
                  </div>
                  <span className="statut whitespace-nowrap">Disponible</span>
                </div>
                <p className="text-[0.9rem] text-[var(--texte-doux)] leading-relaxed line-clamp-3">{f.accroche}</p>
                <ul className="flex flex-wrap gap-1.5">{f.logiciels.map((l) => <li key={l} className="puce">{l}</li>)}</ul>
                <div className="mt-auto pt-3 border-t border-[var(--trait)] flex items-end justify-between">
                  <p className="text-sm"><span className="font-[Sora] text-lg text-white font-semibold">{euros(prixAgent.mensuel)}</span><span className="text-[var(--texte-doux)]"> / mois</span><br /><span className="note">ou {euros(prixAgent.achat)} à l'achat</span></p>
                  <span className="inline-flex items-center gap-2 text-sm text-[var(--cyan)] font-semibold">Voir le profil <Fleche /></span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
