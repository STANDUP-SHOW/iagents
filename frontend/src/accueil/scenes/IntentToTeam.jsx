import { useRef } from 'react';
import donnees from 'virtual:accueil';
import { AgentCard, Bouton } from '../composants.jsx';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';

const PHRASE = 'Je veux développer mon entreprise sur trois nouveaux marchés.';
const ORDRE = ['Marché', 'Finance', 'Juridique', 'Commercial', 'Marketing', 'Opérations'];

/** Scene 02 — the sentence breaks into skills, the skills become people. */
export default function IntentToTeam() {
  const ref = useRef(null);
  const equipe = ORDRE.map((d) => donnees.personnes.find((p) => p.domaine === d));

  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      gsap.set(q('.it-fil'), { strokeDasharray: 1, strokeDashoffset: 1 });
      gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        scrollTrigger: { trigger: q('.it-scene')[0], start: 'top top', end: '+=260%', scrub: 1, pin: true, anticipatePin: 1 },
      })
        .from(q('.it-phrase'), { scale: 1.45, y: 170, duration: 1.2 })
        .from(q('.it-titre-1 .ligne'), { yPercent: 105, stagger: 0.12, duration: 0.8 }, 0.5)
        .from(q('.it-domaine'), { opacity: 0, y: -120, scale: 0.6, stagger: 0.07, duration: 0.9 }, 1.0)
        .to(q('.it-fil'), { strokeDashoffset: 0, stagger: 0.05, duration: 0.9 }, 1.2)
        .from(q('.it-carte'), { opacity: 0, y: 60, stagger: 0.08, duration: 0.9 }, 1.8)
        .from(q('.it-titre-2'), { opacity: 0, y: 30, duration: 0.7 }, 2.6)
        .to({}, { duration: 0.6 });
    });
    ajouter(MOBILE, (q) => {
      q('.it-carte, .it-domaine, .it-titre-2').forEach((el) => {
        gsap.from(el, { opacity: 0, y: 30, duration: 0.9, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
      });
    });
  });

  return (
    <section ref={ref} id="comment" aria-labelledby="titre-equipe">
      <div className="it-scene scene epingle fond-halo">
        <div className="cadre w-full">
          <div className="text-center max-w-4xl mx-auto">
            <h2 id="titre-equipe" className="it-titre-1 titre-display titre-moyen">
              <span className="block overflow-hidden"><span className="ligne block">Votre ambition</span></span>
              <span className="block overflow-hidden pb-[0.1em]"><span className="ligne block lumiere">devient une équipe.</span></span>
            </h2>
          </div>

          <div className="relative mt-10 md:mt-14">
            <div className="flex justify-center">
              <p className="it-phrase verre verre-actif rounded-full px-5 md:px-7 py-3 text-center text-[0.95rem] md:text-lg text-white max-w-full">
                « {PHRASE} »
              </p>
            </div>
            <svg className="hidden md:block w-full h-16 lg:h-20 mt-1" viewBox="0 0 1200 100" preserveAspectRatio="none" aria-hidden="true">
              {ORDRE.map((_, i) => {
                const x = 100 + i * 200;
                return <path key={i} className="it-fil fil" pathLength="1" d={`M600 0 C 600 55, ${x} 45, ${x} 100`} />;
              })}
            </svg>
            <ol className="grid grid-cols-2 md:grid-cols-6 gap-3 lg:gap-4 mt-6 md:mt-0" aria-label="L'équipe proposée">
              {equipe.map((p) => (
                <li key={p.prenom} className="flex flex-col items-stretch gap-3">
                  <p className="it-domaine text-center">
                    <span className="puce puce-cyan">{p.domaine}</span>
                  </p>
                  <AgentCard personne={p} compact className="it-carte" />
                </li>
              ))}
            </ol>
          </div>

          <div className="it-titre-2 mt-12 md:mt-14 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <p className="titre-display titre-petit max-w-xl">
              Vous apportez l'ambition.<br /><span className="text-[var(--texte-doux)]">iAgent construit les moyens.</span>
            </p>
            <div className="flex flex-col gap-2 md:items-end">
              <p className="chapeau !text-[0.95rem] md:text-right">iAgent identifie les compétences nécessaires, réunit les collaborateurs et organise le passage de l'idée à l'exécution.</p>
              <Bouton href="/catalogue" variante="lien" evenement="catalog_click" className="bouton-lien">Voir tous les métiers</Bouton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
