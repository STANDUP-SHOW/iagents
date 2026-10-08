import { useRef } from 'react';
import { Bouton } from '../composants.jsx';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';

// The eight menus of the application's centre, as they are named there.
const MENUS = [
  ['Vos agents', 'qui travaille pour vous, et sur quoi'],
  ['Le travail du jour', 'fait, en cours, en attente de votre accord'],
  ['Embaucher', 'un nouveau collaborateur, en une conversation'],
  ['Courrier', 'ce qui est parti, ce qui attend votre relecture'],
  ['Vos connexions', 'les outils que vous avez ouverts'],
  ['Vos comptes', 'les comptes que vos agents utilisent'],
  ['Votre voix', 'parlez-leur, ils vous répondent'],
  ['Votre machine', 'ce qu’elle porte, ce qu’elle peut encore porter'],
];

/** Scene 11 — less marketing: the real product takes the stage. */
export default function DesktopCommanderReveal() {
  const ref = useRef(null);
  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: q('.dc-scene')[0], start: 'top top', end: '+=240%', scrub: 1, pin: true, anticipatePin: 1 } });
      tl.from(q('.dc-ecran'), { y: 120, rotateX: 14, scale: 0.9, transformPerspective: 1400, opacity: 0.2, duration: 1, ease: 'power2.out' })
        .fromTo(q('.dc-capture'), { scale: 1 }, { scale: 1.16, transformOrigin: '50% 45%', duration: 4 }, '<0.6');
      q('.dc-menu').forEach((el, i) => tl.fromTo(el, { opacity: 0.3, x: 0 }, { opacity: 1, x: 6, duration: 0.3 }, 1 + i * 0.4).to(el, { x: 0, duration: 0.3 }, '>'));
      tl.from(q('.dc-conclusion'), { opacity: 0, y: 30, duration: 0.6, ease: 'power2.out' });
    });
    ajouter(MOBILE, (q) => {
      gsap.from(q('.dc-ecran'), { opacity: 0, y: 40, duration: 1, scrollTrigger: { trigger: q('.dc-ecran')[0], start: 'top 85%' } });
    });
  });

  return (
    <section ref={ref} id="desktop-commander" aria-labelledby="titre-desktop">
      <div className="dc-scene scene epingle flex-col justify-center">
        <div className="cadre w-full grid lg:grid-cols-[0.75fr_1.6fr] gap-10 lg:gap-14 items-center">
          <div>
            <p className="surtitre">iAgent Desktop Commander</p>
            <h2 id="titre-desktop" className="titre-display titre-moyen mt-4">Toute votre organisation.<br /><span className="lumiere">Sous vos yeux.</span></h2>
            <ul className="mt-8 flex flex-col">
              {MENUS.map(([nom, detail]) => (
                <li key={nom} className="dc-menu py-2.5 border-b border-[var(--trait)]">
                  <p className="text-[0.98rem] text-white leading-tight">{nom}</p>
                  <p className="text-[0.8rem] text-[var(--texte-pale)]">{detail}</p>
                </li>
              ))}
            </ul>
          </div>
          <figure>
            <div className="dc-ecran ecran">
              <div className="ecran-barre" aria-hidden="true"><i /><i /><i /><span className="ml-3 text-[0.7rem] text-[var(--texte-pale)]">iAgent Desktop Commander</span></div>
              <div className="overflow-hidden">
                <img className="dc-capture block w-full h-auto" src="/accueil/desktop-centre.webp" alt="Le centre de l'application iAgent : huit menus en orbite autour de l'agent, avec le nombre d'agents, le travail du jour, le courrier, les connexions, les comptes, la voix et l'état de la machine." width="1440" height="900" loading="lazy" decoding="async" />
              </div>
            </div>
            <figcaption className="note mt-3">Capture de l'application, avec des données d'exemple.</figcaption>
          </figure>
        </div>
        <div className="dc-conclusion cadre w-full mt-12 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <p className="titre-display titre-petit">Voyez. Parlez. <span className="corail">Décidez.</span></p>
          <Bouton href="/workforce" evenement="desktop_commander_click">Découvrir Desktop Commander</Bouton>
        </div>
      </div>
    </section>
  );
}
