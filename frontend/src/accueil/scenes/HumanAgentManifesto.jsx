import { useRef } from 'react';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';

const HUMAINS = ['Imaginer', 'Décider', 'Créer du lien'];
const AGENTS = ['Rechercher', 'Exécuter', 'Livrer'];

/** Scene 16 — human ambition on one side, agentic execution on the other. */
export default function HumanAgentManifesto() {
  const ref = useRef(null);

  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      gsap.timeline({ scrollTrigger: { trigger: ref.current, start: 'top 70%', end: 'center 50%', scrub: 1 } })
        .from(q('.mf-h'), { opacity: 0, x: -40, stagger: 0.12 }, 0)
        .from(q('.mf-a'), { opacity: 0, x: 40, stagger: 0.12 }, 0)
        .from(q('.mf-axe'), { scaleY: 0, transformOrigin: 'top' }, 0);
    });
    ajouter(MOBILE, (q) => {
      gsap.from(q('.mf-h, .mf-a'), { opacity: 0, y: 16, stagger: 0.06, duration: 0.6, scrollTrigger: { trigger: ref.current, start: 'top 80%' } });
    });
  });

  return (
    <section ref={ref} className="scene" aria-labelledby="titre-manifeste">
      <div className="cadre grid grid-cols-[1fr_auto_1fr] gap-5 md:gap-14 items-center">
        <div className="text-right">
          <h2 id="titre-manifeste" className="titre-display titre-moyen">Human<br />ambition.</h2>
          <ul className="mt-6 flex flex-col gap-1.5">
            {HUMAINS.map((m) => <li key={m} className="mf-h text-[var(--texte-doux)] text-base md:text-xl">{m}</li>)}
          </ul>
        </div>
        <div className="mf-axe w-px self-stretch" style={{ background: 'linear-gradient(180deg, transparent, #03f3ff, #e5007e, transparent)' }} aria-hidden="true" />
        <div>
          <p className="titre-display titre-moyen degrade-froid">Agentic<br />execution.</p>
          <ul className="mt-6 flex flex-col gap-1.5">
            {AGENTS.map((m) => <li key={m} className="mf-a text-[var(--texte-doux)] text-base md:text-xl">{m}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
