import { useRef } from 'react';
import { Bouton, LIENS } from '../composants.jsx';
import { BOX_PUBLIQUES, euros } from '../../data/tarifs.js';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';

// What each part of the iAgent Station does, placed on the three-finish picture
// (percent of its width and height). Labels sit beside the badges, never on them.
const REPERES = [
  { nom: 'Voice', detail: 'ils vous répondent par les haut-parleurs de la base', x: 77, y: 88 },
  { nom: 'Listen', detail: 'des micros qui vous entendent dans toute la pièce', x: 22, y: 69 },
  { nom: 'Touch', detail: 'un écran de 27 pouces, le Desktop Commander au doigt', x: 62, y: 14 },
  { nom: 'Tout-en-un', detail: 'ordinateur, audio, micros et écran en un appareil', x: 34, y: 93 },
];

/** Scene 12 — the team gets a place in the office: the real hardware, big. */
export default function IAgentBox() {
  const ref = useRef(null);

  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      gsap.timeline({ scrollTrigger: { trigger: q('.bx-photo')[0], start: 'top 85%', end: 'center 55%', scrub: 1 } })
        .from(q('.bx-photo img'), { scale: 1.12, opacity: 0.2, ease: 'power2.out' });
      gsap.from(q('.bx-repere'), { opacity: 0, scale: 0.8, stagger: 0.2, duration: 0.7, ease: 'back.out(1.6)', scrollTrigger: { trigger: q('.bx-photo')[0], start: 'top 45%' } });
    });
    ajouter(MOBILE, (q) => {
      q('.bx-photo, .bx-liste li').forEach((el) => gsap.from(el, { opacity: 0, y: 20, duration: 0.8, scrollTrigger: { trigger: el, start: 'top 92%' } }));
    });
  });

  return (
    <section ref={ref} id="box" className="scene overflow-hidden" aria-labelledby="titre-box">
      <div className="cadre text-center max-w-3xl mx-auto">
        <p className="surtitre justify-center">iAgent Box · la Station iAgent</p>
        <h2 id="titre-box" className="titre-display titre-grand mt-4">Donnez une place <span className="degrade">à votre équipe.</span></h2>
        <p className="chapeau mt-5 mx-auto">Un seul appareil posé dans vos bureaux, qui porte vos agents, leur voix et votre Desktop Commander. Vos données restent chez vous.</p>
      </div>

      <figure className="bx-photo relative mt-10 mx-auto w-full max-w-[1500px] px-0 md:px-6">
        <div className="relative overflow-hidden md:rounded-[28px]" style={{ boxShadow: '0 60px 140px -60px rgba(3,243,255,.55), 0 40px 120px -60px rgba(229,0,126,.5)' }}>
          <img src="/accueil/box-commander.webp" alt="La Station iAgent en trois finitions, Pearl White, Deep Navy et Brushed Aluminum : écran tactile 27 pouces sur bras articulé, base avec micros, haut-parleurs et anneau lumineux." width="1122" height="570" loading="lazy" decoding="async" className="w-full h-auto block" />
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(2,8,23,.35), transparent 25%, transparent 75%, rgba(2,8,23,.6))' }} />
          {REPERES.map((r) => (
            <span key={r.nom} className="bx-repere hidden md:flex absolute -translate-x-1/2 -translate-y-1/2 items-center gap-2" style={{ left: `${r.x}%`, top: `${r.y}%` }}>
              <span className="w-3 h-3 rounded-full bg-[var(--cyan)] pulse-lent" />
              <span className="neon !rounded-full px-3.5 py-1.5 text-[0.7rem] font-bold tracking-[0.22em] uppercase text-white">{r.nom}</span>
            </span>
          ))}
        </div>
      </figure>

      <div className="cadre">
        <ul className="bx-liste mt-10 grid grid-cols-2 md:grid-cols-4 gap-3">
          {REPERES.map((r) => (
            <li key={r.nom} className="neon neon-calme px-4 py-3.5">
              <p className="text-[0.68rem] font-bold tracking-[0.22em] uppercase text-[var(--cyan)]">{r.nom}</p>
              <p className="text-[0.85rem] text-[var(--texte-doux)] leading-snug mt-1">{r.detail}</p>
            </li>
          ))}
        </ul>

        <div className="mt-12 flex flex-col items-center text-center gap-5">
          <p className="titre-display titre-petit">
            Louée {BOX_PUBLIQUES.map((b) => `${euros(b.mensuel)} par mois sur ${b.engagementMois} mois`).join(' ou ')}.
            <span className="block text-[var(--texte-doux)] text-base font-medium mt-2 tracking-normal">Les agents et l'usage de l'IA restent chacun sur leur ligne.</span>
          </p>
          <Bouton href={LIENS.box} evenement="box_click" className="pulse-lent">Découvrir la Station iAgent</Bouton>
          <div className="mt-6 flex flex-col items-center gap-4">
            <p className="titre-display titre-petit">Remote Commander</p>
            <p className="note max-w-xl !mt-0">L'application pour suivre votre équipe depuis votre téléphone.</p>
            <p className="text-[0.7rem] font-bold tracking-[0.22em] uppercase text-[var(--cyan)]">Livrée avec votre Box, installée par iAgent</p>
          </div>
        </div>
      </div>
    </section>
  );
}
