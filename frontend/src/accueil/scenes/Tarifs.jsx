import { useRef } from 'react';
import { Bouton } from '../composants.jsx';
import tarifs, { BOX_PUBLIQUES, euros } from '../../data/tarifs.js';
import { useScene, MOBILE, BUREAU, gsap } from '../mouvement.js';

// What each level of agent is for, in one line.
const PHRASES = {
  essential: 'Un expert pour les tâches courantes de son métier.',
  professional: 'Plus de missions, plus de logiciels, plus d’autonomie.',
  expert: 'Le niveau le plus avancé, pour les postes qui engagent.',
};

/** Scene 14 — the prices, read from tarifs.json: three agents, one Box. */
export default function Tarifs() {
  const ref = useRef(null);
  const { paliers } = tarifs.agents;
  useScene(ref, (ajouter) => {
    const entree = (q) => gsap.from(q('.px-carte'), { opacity: 0, y: 30, stagger: 0.15, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: q('.px-grille')[0], start: 'top 80%' } });
    ajouter(BUREAU, entree);
    ajouter(MOBILE, entree);
  });

  return (
    <section ref={ref} id="tarifs" className="scene" aria-labelledby="titre-tarifs">
      <div className="cadre">
        <div className="text-center max-w-3xl mx-auto">
          <p className="surtitre justify-center">Tarifs</p>
          <h2 id="titre-tarifs" className="titre-display titre-grand mt-4">Des prix lisibles, <span className="degrade">toujours séparés.</span></h2>
        </div>

        <ul className="px-grille mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {paliers.map((p, i) => (
            <li key={p.id} className={`px-carte neon ${i === 1 ? '' : 'neon-calme'} p-6 flex flex-col`}>
              <p className="text-[0.66rem] uppercase tracking-[0.24em] text-[var(--cyan)]">Agent</p>
              <p className="font-[Montserrat] font-extrabold text-2xl text-white mt-1">{p.nom}</p>
              <p className="mt-5"><span className="font-[Montserrat] font-extrabold text-4xl text-white">{euros(p.mensuel)}</span><span className="text-sm text-[var(--texte-doux)]"> HT / mois</span></p>
              <p className="mt-3 text-[0.86rem] text-[var(--texte-doux)] leading-snug">{PHRASES[p.id]}</p>
            </li>
          ))}
          <li className="px-carte neon p-6 flex flex-col" style={{ boxShadow: '0 0 0 1px rgba(229,0,126,.35), 0 30px 80px -40px rgba(229,0,126,.6)' }}>
            <p className="text-[0.66rem] uppercase tracking-[0.24em] text-[#ff6fb5]">Matériel</p>
            <p className="font-[Montserrat] font-extrabold text-2xl text-white mt-1">Box Commander</p>
            <ul className="mt-5 space-y-2">
              {BOX_PUBLIQUES.map((b) => (
                <li key={b.id}><span className="font-[Montserrat] font-extrabold text-3xl text-white">{euros(b.mensuel)}</span><span className="text-sm text-[var(--texte-doux)]"> / mois sur {b.engagementMois} mois</span></li>
              ))}
            </ul>
            <p className="mt-3 text-[0.86rem] text-[var(--texte-doux)] leading-snug">Louée, livrée prête. L'usage de l'IA est compté à part, au réel.</p>
          </li>
        </ul>
        <p className="note mt-4 text-center">Tarifs pilotes, hors taxes. Chaque agent, la Box et l'usage de l'IA restent chacun sur leur ligne.</p>

        <div className="mt-10 flex justify-center">
          <Bouton href="/pricing" evenement="pricing_click">Voir les tarifs</Bouton>
        </div>
      </div>
    </section>
  );
}
