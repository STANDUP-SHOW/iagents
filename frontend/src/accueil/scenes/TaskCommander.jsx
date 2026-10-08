import { useRef } from 'react';
import donnees from 'virtual:accueil';
import { Avatar } from '../composants.jsx';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';

const L = 800; const H = 520; const C = [400, 260];
// Deterministic « random » so the prerender and the browser draw the same thing.
const alea = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
const NOEUDS = Array.from({ length: 20 }, (_, i) => {
  const a = (i / 20) * Math.PI * 2 - Math.PI / 2;
  return {
    chaos: [60 + alea(i + 1) * 680, 40 + alea(i + 101) * 440],
    ordre: [C[0] + Math.cos(a) * 300, C[1] + Math.sin(a) * 190],
  };
});
const LIENS_CHAOS = Array.from({ length: 34 }, (_, k) => [Math.floor(alea(k + 7) * 20), Math.floor(alea(k + 57) * 20)]).filter(([a, b]) => a !== b);
const PORTRAITS = { 0: 'julie', 3: 'thomas', 6: 'samir', 10: 'lea', 13: 'marco', 16: 'elise' };

/** Scene 10 — thirty agents is too many to manage: talk to your right hand. */
export default function TaskCommander() {
  const ref = useRef(null);
  const victor = donnees.personnes.find((p) => p.prenom === 'Victor');

  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      const n = q('.tc-n');
      const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' }, scrollTrigger: { trigger: q('.tc-scene')[0], start: 'top top', end: '+=320%', scrub: 1, pin: true, anticipatePin: 1 } });
      tl.addLabel('reorg', 2.6);
      n.forEach((el, i) => tl.fromTo(el, { attr: { transform: `translate(${NOEUDS[i].chaos})` } }, { attr: { transform: `translate(${NOEUDS[i].ordre})` }, duration: 1.2 }, 'reorg'));
      tl.fromTo(q('.tc-c1'), { opacity: 1 }, { opacity: 0, duration: 0.2 }, 0.6)
        .fromTo(q('.tc-c5'), { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.6)
        .fromTo(q('.tc-c5'), { opacity: 1 }, { opacity: 0, duration: 0.2 }, 1.4)
        .fromTo(q('.tc-c20'), { opacity: 0 }, { opacity: 1, duration: 0.2 }, 1.4)
        .from(n.slice(0, 1), { opacity: 0, duration: 0.4 }, 0)
        .from(n.slice(1, 5), { opacity: 0, duration: 0.4, stagger: 0.08 }, 0.6)
        .from(n.slice(5), { opacity: 0, duration: 0.4, stagger: 0.03 }, 1.4)
        .fromTo(q('.tc-chaos'), { opacity: 0 }, { opacity: 1, duration: 0.6, stagger: 0.01 }, 1.5)
        .to(q('.tc-chaos'), { opacity: 0, duration: 0.6 }, 'reorg')
        .to(q('.tc-compteur'), { opacity: 0, duration: 0.4 }, 'reorg')
        .from(q('.tc-victor'), { opacity: 0, scale: 0.5, transformOrigin: '400px 260px', duration: 0.8 }, 'reorg+=0.8')
        .from(q('.tc-rayon'), { opacity: 0, duration: 0.5, stagger: 0.02 }, 'reorg+=1')
        .from(q('.tc-titre'), { opacity: 0, y: 30, duration: 0.6 }, 'reorg+=1.2')
        .from(q('.tc-bulle-1'), { opacity: 0, y: 20, duration: 0.5 })
        // Victor hands out the work, the agents send their results back.
        .addLabel('envoi')
        .fromTo(q('.tc-tache'), { opacity: 0 }, { opacity: 1, duration: 0.1 }, 'envoi');
      q('.tc-tache').forEach((el, i) => {
        tl.fromTo(el, { attr: { cx: C[0], cy: C[1] } }, { attr: { cx: NOEUDS[i].ordre[0], cy: NOEUDS[i].ordre[1] }, duration: 0.9 }, 'envoi')
          .to(el, { attr: { cx: C[0], cy: C[1] }, fill: '#e65090', duration: 0.9 }, 'envoi+=1.3');
      });
      tl.to(q('.tc-tache'), { opacity: 0, duration: 0.1 })
        .from(q('.tc-bulle-2'), { opacity: 0, y: 20, duration: 0.5 })
        .from(q('.tc-scenario'), { opacity: 0, y: 14, stagger: 0.15, duration: 0.4 })
        .from(q('.tc-conclusion'), { opacity: 0, y: 30, duration: 0.7 })
        .to({}, { duration: 0.4 });
    });
    ajouter(MOBILE, (q) => {
      q('.tc-bulle-1, .tc-bulle-2, .tc-conclusion').forEach((el) => gsap.from(el, { opacity: 0, y: 20, duration: 0.7, scrollTrigger: { trigger: el, start: 'top 92%' } }));
    });
  });

  return (
    <section ref={ref} aria-labelledby="titre-commander">
      <div className="tc-scene scene epingle flex-col justify-center overflow-hidden">
        <div className="cadre w-full grid lg:grid-cols-[1.2fr_0.8fr] gap-10 items-center">
          <div className="relative">
            <div className="tc-compteur absolute left-0 top-0 font-[Montserrat] text-xl md:text-2xl font-semibold" aria-hidden="true">
              <span className="tc-c1 absolute whitespace-nowrap opacity-0">1 expert</span>
              <span className="tc-c5 absolute whitespace-nowrap opacity-0">5 experts</span>
              <span className="tc-c20 absolute whitespace-nowrap opacity-0">20 experts</span>
            </div>
            <svg viewBox={`0 0 ${L} ${H}`} className="w-full h-auto" role="img" aria-label="Vingt experts reliés à Victor, qui coordonne l'équipe">
              <defs>
                <clipPath id="tc-clip"><circle cx={C[0]} cy={C[1]} r="46" /></clipPath>
                <radialGradient id="tc-halo"><stop offset="0" stopColor="rgba(3,243,255,0.25)" /><stop offset="1" stopColor="rgba(3,243,255,0)" /></radialGradient>
              </defs>
              {LIENS_CHAOS.map(([a, b], k) => (
                <line key={k} className="tc-chaos" x1={NOEUDS[a].chaos[0]} y1={NOEUDS[a].chaos[1]} x2={NOEUDS[b].chaos[0]} y2={NOEUDS[b].chaos[1]} stroke="rgba(230,80,144,0.28)" strokeWidth="1" opacity="0" />
              ))}
              {NOEUDS.map((p, i) => (
                <line key={i} className="tc-rayon fil" x1={C[0]} y1={C[1]} x2={p.ordre[0]} y2={p.ordre[1]} />
              ))}
              <circle cx={C[0]} cy={C[1]} r="120" fill="url(#tc-halo)" />
              {NOEUDS.map((p, i) => (
                <g key={i} className="tc-n" transform={`translate(${p.ordre})`}>
                  {PORTRAITS[i] ? (
                    <>
                      <clipPath id={`tc-p${i}`}><circle r="17" /></clipPath>
                      <image href={`/accueil/${PORTRAITS[i]}.webp`} x="-17" y="-17" width="34" height="34" clipPath={`url(#tc-p${i})`} preserveAspectRatio="xMidYMid slice" />
                      <circle r="17" fill="none" stroke="rgba(3,243,255,0.55)" />
                    </>
                  ) : (
                    <>
                      <circle r="9" fill="#061226" stroke="rgba(3,243,255,0.55)" />
                      <circle r="3" fill="#03f3ff" />
                    </>
                  )}
                </g>
              ))}
              {NOEUDS.map((_, i) => <circle key={i} className="tc-tache" cx={C[0]} cy={C[1]} r="3.5" fill="#03f3ff" opacity="0" />)}
              <g className="tc-victor">
                <circle cx={C[0]} cy={C[1]} r="52" fill="#020817" stroke="#03f3ff" strokeWidth="1.5" />
                <image href="/accueil/victor-grand.webp" x={C[0] - 46} y={C[1] - 46} width="92" height="92" clipPath="url(#tc-clip)" preserveAspectRatio="xMidYMid slice" />
                <text x={C[0]} y={C[1] + 76} textAnchor="middle" fill="#eaf2ff" style={{ font: '700 16px Montserrat, sans-serif' }}>VICTOR</text>
                <text x={C[0]} y={C[1] + 94} textAnchor="middle" fill="#03f3ff" style={{ font: '600 10px Montserrat, sans-serif', letterSpacing: '0.2em' }}>TASK COMMANDER</text>
              </g>
            </svg>
          </div>

          <div>
            <h2 id="titre-commander" className="tc-titre titre-display titre-moyen">
              Vous n'avez pas besoin de manager trente collaborateurs.<br />
              <span className="degrade">Parlez à votre bras droit.</span>
            </h2>
            <div className="mt-8 flex flex-col gap-3">
              <div className="tc-bulle-1 bulle bulle-humain">
                <p className="bulle-qui">Vous</p>
                <p>Victor, étudiez cette nouvelle activité avec le marketing, les finances et le commercial. Je veux une recommandation vendredi.</p>
              </div>
              <div className="tc-bulle-2 bulle bulle-agent">
                <p className="bulle-qui flex items-center gap-2"><Avatar personne={victor} taille={20} /> Victor</p>
                <p>L'équipe a terminé. Voici les trois scénarios recommandés.</p>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {['Prudent : un marché test', 'Équilibré : deux marchés, un recrutement', 'Offensif : lancement national'].map((s, i) => (
                    <li key={s} className="tc-scenario flex items-center gap-2 text-[0.88rem]"><span className="puce puce-cyan !py-0.5 !px-2">{i + 1}</span>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="note mt-4">
              Aujourd'hui, votre bras droit fait le point de l'équipe, relève ce qui attend votre accord et règle le travail des autres à votre demande.
              La répartition d'une mission entre plusieurs agents arrive progressivement.
            </p>
          </div>
        </div>
        <p className="tc-conclusion cadre w-full mt-14 titre-display titre-grand text-center">
          Une conversation.<br /><span className="degrade">Toute une organisation se met en mouvement.</span>
        </p>
      </div>
    </section>
  );
}
