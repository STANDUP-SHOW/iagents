import { useRef } from 'react';
import { Bouton, LIENS } from '../composants.jsx';
import { BOX_PUBLIQUES, euros } from '../../data/tarifs.js';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';

// What each part of max's Box Commander picture does, placed on the picture
// (percent of its width and height).
const REPERES = [
  { nom: 'Voice', detail: 'ils vous répondent à voix haute', x: 15, y: 70 },
  { nom: 'Listen', detail: 'un micro qui vous entend du bureau', x: 35, y: 50 },
  { nom: 'Touch', detail: 'le Desktop Commander au doigt', x: 64, y: 22 },
  // Beside the box, not on it: centred on the box, the label hid its logo (max, 10/10).
  { nom: 'Box autonome', detail: 'vos agents tournent chez vous', x: 57, y: 93 },
];

// The app is not published yet and the site offers no download (max): the
// badges say where it will be, and link nowhere until it is there.
// Marks from simple-icons 13.21.0 (CC0).
const BOUTIQUES = [
  { nom: 'Google Play', haut: 'Bientôt sur', d: 'M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z' },
  { nom: 'App Store', haut: "Bientôt dans l'", d: 'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701' },
];

function Boutique({ nom, haut, d }) {
  return (
    <span className="inline-flex items-center gap-2.5 h-12 pl-3.5 pr-5 rounded-[10px] bg-black border border-[#a6a6a6] text-white" aria-label={`${nom}, bientôt disponible`}>
      <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d={d} /></svg>
      <span className="flex flex-col items-start leading-none text-left" aria-hidden="true">
        <span className="text-[0.62rem] tracking-wide">{haut}</span>
        <span className="text-[1.15rem] font-semibold mt-0.5">{nom}</span>
      </span>
    </span>
  );
}

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
        <p className="surtitre justify-center">iAgent Box Commander</p>
        <h2 id="titre-box" className="titre-display titre-grand mt-4">Donnez une place <span className="degrade">à votre équipe.</span></h2>
        <p className="chapeau mt-5 mx-auto">Un poste posé dans vos bureaux, qui porte vos agents, leur voix et votre Desktop Commander. Vos données restent chez vous.</p>
      </div>

      <figure className="bx-photo relative mt-10 mx-auto w-full max-w-[1500px] px-0 md:px-6">
        <div className="relative overflow-hidden md:rounded-[28px]" style={{ boxShadow: '0 60px 140px -60px rgba(3,243,255,.55), 0 40px 120px -60px rgba(229,0,126,.5)' }}>
          <img src="/accueil/box-commander.webp" alt="La Box Commander iAgent posée sur un bureau : l'écran tactile avec le Desktop Commander, le boîtier blanc iAgent, un micro et deux enceintes." width="1122" height="570" loading="lazy" decoding="async" className="w-full h-auto block" />
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
          <Bouton href={LIENS.box} evenement="box_click" className="pulse-lent">Découvrir la Box Commander</Bouton>
          <div className="mt-6 flex flex-col items-center gap-4">
            <p className="titre-display titre-petit">Remote Commander</p>
            <p className="note max-w-xl !mt-0">L'application pour suivre votre équipe depuis votre téléphone.</p>
            <ul className="flex flex-wrap justify-center gap-3" aria-label="Boutiques d'applications">
              {BOUTIQUES.map((b) => <li key={b.nom}><Boutique {...b} /></li>)}
            </ul>
            <p className="text-[0.7rem] font-bold tracking-[0.22em] uppercase text-[var(--cyan)]">Bientôt disponible</p>
          </div>
        </div>
      </div>
    </section>
  );
}
