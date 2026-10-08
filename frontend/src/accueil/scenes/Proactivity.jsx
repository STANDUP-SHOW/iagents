import { useRef } from 'react';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';

// Done steps are cyan, the running one pulses, the one waiting for a person
// is magenta (audit of 08/10).
const ETAPES = [
  ['Recherche', 'fait'],
  ['Qualification', 'fait'],
  ['Enrichissement', 'fait'],
  ['Contact', 'en-cours'],
  ['Relance', 'accord'],
  ['Rendez-vous', 'a-venir'],
];

const COULEUR = { fait: 'var(--cyan)', 'en-cours': 'var(--cyan)', accord: '#e5007e', 'a-venir': 'rgba(140,190,255,.35)' };

/** Scene 09 — you set the result, the agent works the path, live. */
export default function Proactivity() {
  const ref = useRef(null);
  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      gsap.timeline({ defaults: { ease: 'power3.out' }, scrollTrigger: { trigger: q('.pa-frise')[0], start: 'top 72%' } })
        .from(q('.pa-carte'), { opacity: 0, x: -30, duration: 0.8 })
        .from(q('.pa-barre'), { scaleX: 0, transformOrigin: 'left', duration: 1.6, ease: 'power2.inOut' }, 0.3)
        .from(q('.pa-etape'), { opacity: 0, y: 16, stagger: 0.2, duration: 0.5 }, 0.4)
        .from(q('.pa-droite'), { opacity: 0, x: 30, duration: 0.8 }, 1.4);
    });
    ajouter(MOBILE, (q) => q('.pa-carte, .pa-etape, .pa-droite').forEach((el) => gsap.from(el, { opacity: 0, y: 18, duration: 0.6, scrollTrigger: { trigger: el, start: 'top 92%' } })));
  });

  return (
    <section ref={ref} className="scene" aria-labelledby="titre-mission">
      <div className="cadre">
        <div className="text-center max-w-3xl mx-auto">
          <h2 id="titre-mission" className="titre-display titre-grand">Vous définissez le résultat. <span className="degrade-froid">Il travaille sur le chemin.</span></h2>
        </div>

        <div className="pa-frise mt-14 grid lg:grid-cols-[0.8fr_2.2fr_0.9fr] gap-5 items-stretch">
          <div className="pa-carte neon p-5 flex flex-col">
            <p className="marge !text-[0.6rem]">Mission</p>
            <p className="font-[Montserrat] font-extrabold text-white text-xl leading-tight mt-3">Trouver 50 prospects qualifiés en Espagne</p>
            <div className="mt-auto pt-5 flex items-center gap-3">
              <img src="/accueil/julie.webp" alt="" width="44" height="44" className="w-11 h-11 rounded-full object-cover ring-2 ring-[var(--cyan)]" />
              <span><span className="block text-sm text-white">Julie</span><span className="flex items-center gap-1.5 text-[0.72rem] text-[var(--cyan)]"><span className="w-1.5 h-1.5 rounded-full bg-[var(--cyan)] pulse-lent" />en cours</span></span>
            </div>
          </div>

          <div className="neon neon-calme p-5 md:p-7 flex flex-col justify-center">
            <div className="relative">
              <div className="hidden md:block absolute left-[8%] right-[8%] top-[13px] h-[2px] bg-[rgba(140,190,255,.15)]" aria-hidden="true">
                <div className="pa-barre h-full w-[62%]" style={{ background: 'linear-gradient(90deg, #03f3ff, #b98cff, #e5007e)', boxShadow: '0 0 12px rgba(3,243,255,.6)' }} />
              </div>
              <ol className="relative grid grid-cols-3 md:grid-cols-6 gap-y-6">
                {ETAPES.map(([nom, etat]) => (
                  <li key={nom} className="pa-etape flex flex-col items-center text-center gap-2">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center ${etat === 'en-cours' ? 'pulse-lent' : ''}`} style={{ border: `1.5px solid ${COULEUR[etat]}`, background: etat === 'fait' ? 'rgba(3,243,255,.18)' : etat === 'accord' ? 'rgba(229,0,126,.18)' : 'var(--fond)', boxShadow: etat === 'a-venir' ? 'none' : `0 0 14px ${COULEUR[etat]}` }}>
                      {etat === 'fait' && <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10" stroke="#03f3ff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      {etat === 'en-cours' && <span className="w-2 h-2 rounded-full bg-[var(--cyan)]" />}
                      {etat === 'accord' && <span className="text-[0.7rem] font-bold text-[#ff6fb5]">!</span>}
                    </span>
                    <span className="text-[0.82rem] text-white">{nom}</span>
                    <span className="text-[0.66rem] uppercase tracking-[0.14em]" style={{ color: COULEUR[etat] }}>{{ fait: 'fait', 'en-cours': 'en cours', accord: 'votre accord', 'a-venir': 'à venir' }[etat]}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="pa-droite flex flex-col gap-3">
            <div className="neon p-4" style={{ boxShadow: '0 0 0 1px rgba(229,0,126,.35), 0 20px 60px -30px rgba(229,0,126,.6)' }}>
              <p className="text-[0.62rem] uppercase tracking-[0.22em] text-[#ff6fb5]">Attend votre accord</p>
              <p className="text-[0.88rem] text-white mt-1.5 leading-snug">Relancer 12 prospects avec cette offre ?</p>
            </div>
            <div className="neon neon-calme p-4 flex-1">
              <p className="text-[0.62rem] uppercase tracking-[0.22em] text-[var(--cyan)]">Déjà livré</p>
              <ul className="mt-2 space-y-1 text-[0.82rem] text-[var(--texte-doux)]">
                <li>prospects-espagne.xlsx</li>
                <li>38 contacts qualifiés</li>
              </ul>
            </div>
          </div>
        </div>
        <p className="note mt-4 text-center">Exemple de mission. Ce qui engage l'entreprise attend votre accord.</p>
      </div>
    </section>
  );
}
