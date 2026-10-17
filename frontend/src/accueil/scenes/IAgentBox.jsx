import { useRef } from 'react';
import { Bouton, LIENS } from '../composants.jsx';
import { BOX_PUBLIQUES, euros } from '../../data/tarifs.js';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';
import { COMING_SOON, PUBLICITE } from '../../pages/station.jsx';

// What each part of the iAgent Station does. The picture is max's own visual,
// shown whole and never wider than its pixels: nothing is drawn over it.
const REPERES = [
  { nom: 'Voice', detail: 'ils vous répondent par les haut-parleurs de la base' },
  { nom: 'Listen', detail: 'des micros qui vous entendent dans toute la pièce' },
  { nom: 'Touch', detail: 'un écran de 27 pouces, le Desktop Commander au doigt' },
  { nom: 'Tout-en-un', detail: 'ordinateur, audio, micros et écran en un appareil' },
];

/** Scene 12 — the team gets a place in the office: the real hardware, big. */
export default function IAgentBox() {
  const ref = useRef(null);

  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      gsap.timeline({ scrollTrigger: { trigger: q('.bx-photo')[0], start: 'top 85%', end: 'center 55%', scrub: 1 } })
        .from(q('.bx-photo img'), { y: 60, opacity: 0.2, ease: 'power2.out' });
    });
    ajouter(MOBILE, (q) => {
      q('.bx-photo, .bx-liste li').forEach((el) => gsap.from(el, { opacity: 0, y: 20, duration: 0.8, scrollTrigger: { trigger: el, start: 'top 92%' } }));
    });
  });

  return (
    <section ref={ref} id="box" className="scene overflow-hidden" aria-labelledby="titre-box">
      <div className="cadre text-center max-w-3xl mx-auto">
        <p className="inline-block rounded-full px-5 py-2 text-[0.85rem] font-bold tracking-[0.26em] uppercase text-white" style={{ background: 'linear-gradient(90deg, #e5007e, #7b2ff7 50%, #03b8d9)', boxShadow: '0 0 40px rgba(229,0,126,.45)' }}>{COMING_SOON}</p>
        <h2 id="titre-box" className="titre-display titre-grand mt-5"><span className="degrade">iAgent Station.</span></h2>
        <p className="titre-display titre-petit mt-4">Donnez une place à votre équipe.</p>
        <p className="chapeau mt-5 mx-auto">Un seul appareil posé dans vos bureaux, qui porte vos agents, leur voix et votre Desktop Commander. Vos données restent chez vous.</p>
      </div>

      <figure className="bx-photo relative mt-10 mx-auto w-full px-4 md:px-6 flex justify-center">
        <img src={PUBLICITE.src} alt={PUBLICITE.alt} width={PUBLICITE.largeur} height={PUBLICITE.hauteur} loading="lazy" decoding="async" className="block w-full h-auto rounded-[22px] md:rounded-[28px]" style={{ maxWidth: `${PUBLICITE.largeur}px`, boxShadow: '0 60px 140px -60px rgba(3,243,255,.55), 0 40px 120px -60px rgba(229,0,126,.5)' }} />
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
