import { useRef } from 'react';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';

const ETAPES = [
  ['Recherche', 'Sources et fichiers que vous avez autorisés'],
  ['Qualification', 'Critères de votre cible, appliqués un par un'],
  ['Enrichissement', 'Coordonnées, taille, décideur'],
  ['Contact', 'Premiers messages, préparés pour vous'],
  ['Relance', 'Au bon moment, sans oubli'],
  ['Rendez-vous', 'Posés dans votre agenda'],
];

/** Scene 09 — you set the result, the agent works the path. */
export default function Proactivity() {
  const ref = useRef(null);
  useScene(ref, (ajouter) => {
    ajouter('(prefers-reduced-motion: no-preference)', (q) => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: q('.pa-mission')[0], start: 'top 75%', end: 'bottom 35%', scrub: 1 } });
      tl.fromTo(q('.pa-barre'), { scaleX: 0 }, { scaleX: 1, ease: 'none', duration: ETAPES.length });
      q('.pa-etape').forEach((el, i) => {
        tl.fromTo(el.querySelector('.pa-coche'), { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3 }, i + 0.6)
          .fromTo(el, { opacity: 0.35 }, { opacity: 1, duration: 0.3 }, i + 0.4);
      });
    });
    ajouter(BUREAU, (q) => {
      gsap.from(q('.pa-phrase'), { opacity: 0, x: -30, stagger: 0.3, duration: 1, scrollTrigger: { trigger: q('.pa-phrases')[0], start: 'top 80%' } });
    });
    ajouter(MOBILE, (q) => {
      gsap.from(q('.pa-phrase'), { opacity: 0, y: 20, stagger: 0.2, duration: 0.8, scrollTrigger: { trigger: q('.pa-phrases')[0], start: 'top 90%' } });
    });
  });

  return (
    <section ref={ref} className="scene" aria-labelledby="titre-mission">
      <div className="cadre grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-20 items-center">
        <div className="pa-phrases">
          <h2 id="titre-mission" className="titre-display titre-moyen">
            <span className="pa-phrase block">Vous définissez le résultat.</span>
            <span className="pa-phrase block lumiere">Il travaille sur le chemin.</span>
          </h2>
          <p className="chapeau mt-6">
            Une mission a un but, pas une liste de clics. Le collaborateur avance étape par étape, vous montre où il en est,
            et revient vers vous quand une décision vous appartient.
          </p>
        </div>
        <div className="pa-mission verre p-6 md:p-8">
          <div className="flex items-baseline justify-between gap-4">
            <p className="font-[Sora] font-semibold tracking-wide uppercase text-[0.95rem]">Trouver 50 prospects qualifiés</p>
            <span className="statut">En cours</span>
          </div>
          <div className="mt-4 h-[3px] rounded-full bg-[rgba(140,190,255,0.12)] overflow-hidden">
            <div className="pa-barre h-full bg-[var(--cyan)] origin-left shadow-[0_0_12px_var(--cyan)]" />
          </div>
          <ol className="mt-6 flex flex-col">
            {ETAPES.map(([nom, detail], i) => (
              <li key={nom} className="pa-etape flex items-center gap-4 py-3 border-b border-[var(--trait)] last:border-0">
                <span className="relative w-6 h-6 rounded-full border border-[rgba(3,243,255,0.4)] flex-none flex items-center justify-center">
                  <svg className="pa-coche" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10" stroke="var(--cyan)" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <div className="flex-1">
                  <p className="text-[0.98rem] text-white">{nom}</p>
                  <p className="text-[0.8rem] text-[var(--texte-pale)]">{detail}</p>
                </div>
                <span className="note">{String(i + 1).padStart(2, '0')}</span>
              </li>
            ))}
          </ol>
          <p className="note mt-4">Exemple de mission. Ce qui engage l'entreprise attend votre accord.</p>
        </div>
      </div>
    </section>
  );
}
