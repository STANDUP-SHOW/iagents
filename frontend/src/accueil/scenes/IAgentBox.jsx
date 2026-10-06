import { useRef } from 'react';
import donnees from 'virtual:accueil';
import { Bouton, LIENS } from '../composants.jsx';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';

const ATOUTS = [
  ['Calcul dédié', 'vos agents tournent chez vous'],
  ['Écran tactile', 'le Desktop Commander au doigt'],
  ['Micro longue portée', 'parlez-leur depuis votre bureau'],
  ['Audio', 'ils vous répondent à voix haute'],
  ['Signature', 'validez un document sur place'],
  ['Desktop Commander', 'installé et prêt à l’ouverture'],
];

/** The box, drawn: a dark slab with the chip of the logo and a line of light. */
function Boitier() {
  return (
    <svg viewBox="0 0 520 300" className="w-full h-auto" role="img" aria-label="L'iAgent Box, un boîtier sombre avec une ligne de lumière cyan">
      <defs>
        <linearGradient id="bx-dessus" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#13233f" /><stop offset="1" stopColor="#060e1f" /></linearGradient>
        <linearGradient id="bx-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0a1529" /><stop offset="1" stopColor="#030812" /></linearGradient>
        <radialGradient id="bx-sol"><stop offset="0" stopColor="rgba(3,243,255,0.35)" /><stop offset="1" stopColor="rgba(3,243,255,0)" /></radialGradient>
      </defs>
      <ellipse cx="260" cy="262" rx="230" ry="26" fill="url(#bx-sol)" />
      <path d="M60 120 L260 60 L460 120 L260 180 Z" fill="url(#bx-dessus)" stroke="rgba(140,190,255,0.18)" />
      <path d="M60 120 L260 180 L260 240 L60 180 Z" fill="url(#bx-face)" stroke="rgba(140,190,255,0.12)" />
      <path d="M460 120 L260 180 L260 240 L460 180 Z" fill="#050b18" stroke="rgba(140,190,255,0.12)" />
      <path className="bx-lumiere" d="M72 172 L260 228 L448 172" fill="none" stroke="#03f3ff" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 6px #03f3ff)' }} />
      <image href="/accueil/icone-iagent.png" x="-34" y="-34" width="68" height="68" transform="matrix(1 0.3 -1 0.3 260 120)" opacity="0.9" />
    </svg>
  );
}

/** Scene 12 — the digital team gets a place in the office. */
export default function IAgentBox() {
  const ref = useRef(null);
  const { gamme } = donnees;

  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      gsap.timeline({ scrollTrigger: { trigger: q('.bx-scene')[0], start: 'top 70%', end: 'center center', scrub: 1 } })
        .from(q('.bx-objet'), { y: 140, scale: 0.85, opacity: 0, ease: 'power2.out' })
        .fromTo(q('.bx-lumiere'), { strokeDasharray: 600, strokeDashoffset: 600 }, { strokeDashoffset: 0, ease: 'none' }, '<0.3');
      gsap.from(q('.bx-atout'), { opacity: 0, y: 20, stagger: 0.08, duration: 0.8, scrollTrigger: { trigger: q('.bx-atouts')[0], start: 'top 80%' } });
      const sig = gsap.timeline({ scrollTrigger: { trigger: q('.bx-signature')[0], start: 'top 75%', end: 'bottom 45%', scrub: 1 } });
      sig.from(q('.bx-s-1'), { opacity: 0, y: 16 })
        .from(q('.bx-s-2'), { opacity: 0, y: 16 })
        .from(q('.bx-doc'), { opacity: 0, y: 24, scale: 0.96 })
        .fromTo(q('.bx-trace'), { strokeDasharray: 400, strokeDashoffset: 400 }, { strokeDashoffset: 0, ease: 'none', duration: 1.5 })
        .from(q('.bx-s-3'), { opacity: 0, y: 16 });
    });
    ajouter(MOBILE, (q) => {
      q('.bx-objet, .bx-atout, .bx-doc').forEach((el) => gsap.from(el, { opacity: 0, y: 20, duration: 0.8, scrollTrigger: { trigger: el, start: 'top 92%' } }));
    });
  });

  return (
    <section ref={ref} id="box" className="scene" aria-labelledby="titre-box">
      <div className="bx-scene cadre">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 items-center">
          <div>
            <p className="surtitre">iAgent Box</p>
            <h2 id="titre-box" className="titre-display titre-moyen mt-4">Donnez une place<br /><span className="lumiere">à votre équipe numérique.</span></h2>
            <p className="chapeau mt-6">Un poste dédié, posé dans vos bureaux, qui porte vos agents, leur voix et votre Desktop Commander. Vos données restent chez vous.</p>
            <ul className="bx-atouts mt-8 grid grid-cols-2 gap-3">
              {ATOUTS.map(([nom, detail]) => (
                <li key={nom} className="bx-atout verre !rounded-xl px-4 py-3">
                  <p className="text-[0.95rem] text-white">{nom}</p>
                  <p className="text-[0.78rem] text-[var(--texte-pale)] leading-snug">{detail}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="bx-objet relative">
            <Boitier />
            <p className="note text-center -mt-2">La gamme : {gamme.map((g) => g.nom.replace('iAgent ', '')).join(' · ')}</p>
          </div>
        </div>

        <div className="bx-signature mt-20 grid lg:grid-cols-[1fr_1fr] gap-8 items-center">
          <div className="flex flex-col gap-3 max-w-md">
            <div className="bx-s-1 bulle bulle-agent"><p className="bulle-qui">Julie</p><p>J'ai besoin de votre signature sur le bon de commande.</p></div>
            <div className="bx-s-2 bulle bulle-humain"><p className="bulle-qui">Vous</p><p>Affiche-le.</p></div>
            <div className="bx-s-3 bulle bulle-agent"><p className="bulle-qui">Julie</p><p>Merci. Je poursuis.</p></div>
          </div>
          <div className="bx-doc verre p-6 max-w-md lg:ml-auto w-full">
            <div className="flex items-center justify-between"><p className="font-[Sora] font-semibold">Bon de commande</p><span className="puce puce-corail">Votre signature</span></div>
            <div className="mt-4 space-y-2" aria-hidden="true">
              {[92, 78, 85, 60].map((w, i) => <div key={i} className="h-2 rounded bg-[rgba(140,190,255,0.12)]" style={{ width: `${w}%` }} />)}
            </div>
            <div className="mt-6 border-t border-dashed border-[var(--trait-fort)] pt-3">
              <svg viewBox="0 0 300 70" className="w-full h-16" aria-label="Signature">
                <path className="bx-trace" d="M10 50 C 30 10, 45 10, 50 40 S 70 65, 85 30 S 110 10, 120 45 C 128 60, 140 55, 150 35 S 175 15, 190 40 L 205 30 C 220 25, 240 45, 290 30" fill="none" stroke="#e65090" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        <div className="mt-16 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <p className="titre-display titre-petit">La technologie disparaît.<br /><span className="text-[var(--texte-doux)]">Il reste le travail.</span></p>
          <Bouton href={LIENS.box} evenement="box_click">Découvrir iAgent Box</Bouton>
        </div>
        <p className="note mt-4">Écran, micro et tablette de signature selon la configuration choisie ; la signature sur tablette arrive dans une prochaine version de l'application.</p>
      </div>
    </section>
  );
}
