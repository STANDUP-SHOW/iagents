import { useRef } from 'react';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';

const HUMAINS = ['Imaginer', 'Choisir', 'Décider', 'Créer du lien'];
const AGENTS = ['Rechercher', 'Exécuter', 'Coordonner', 'Accélérer'];

/** Scene 15 — who does what: people keep the ambition, agents carry the execution. */
export default function HumanAgentManifesto() {
  const ref = useRef(null);

  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: q('.mf-scene')[0], start: 'top 70%', end: 'bottom 60%', scrub: 1 } });
      tl.from(q('.mf-h'), { opacity: 0, x: -40, stagger: 0.12, duration: 0.5 }, 0)
        .from(q('.mf-a'), { opacity: 0, x: 40, stagger: 0.12, duration: 0.5 }, 0)
        .from(q('.mf-axe'), { scaleY: 0, transformOrigin: 'top', duration: 1 }, 0)
        .from(q('.mf-devise'), { opacity: 0, y: 30, duration: 0.6 }, 0.8);
    });
    ajouter(MOBILE, (q) => {
      gsap.from(q('.mf-h, .mf-a'), { opacity: 0, y: 16, stagger: 0.06, duration: 0.6, scrollTrigger: { trigger: q('.mf-scene')[0], start: 'top 80%' } });
    });
  });

  return (
    <section ref={ref} aria-labelledby="titre-manifeste">
      <div className="mf-scene scene">
        <div className="cadre">
          <h2 id="titre-manifeste" className="sr-only">Ce que font les humains, ce que font les agents</h2>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-6 md:gap-14 items-center">
            <div className="text-right">
              <p className="surtitre justify-end">Les humains</p>
              <ul className="mt-6 flex flex-col gap-2 md:gap-3">
                {HUMAINS.map((m) => <li key={m} className="mf-h titre-display titre-moyen">{m}</li>)}
              </ul>
            </div>
            <div className="mf-axe w-px self-stretch bg-gradient-to-b from-transparent via-[var(--cyan)] to-transparent" aria-hidden="true" />
            <div>
              <p className="surtitre">Les agents</p>
              <ul className="mt-6 flex flex-col gap-2 md:gap-3">
                {AGENTS.map((m) => <li key={m} className="mf-a titre-display titre-moyen lumiere">{m}</li>)}
              </ul>
            </div>
          </div>
          <div className="mf-devise mt-20 md:mt-28 text-center">
            <p className="titre-display titre-grand">Human ambition.<br /><span className="lumiere">Agentic execution.</span></p>
            <p className="mt-6 font-[Orbitron] text-[0.78rem] tracking-[0.3em] uppercase text-[var(--texte-doux)]">iAgent — The AI Workforce Platform</p>
          </div>
        </div>
      </div>
    </section>
  );
}
