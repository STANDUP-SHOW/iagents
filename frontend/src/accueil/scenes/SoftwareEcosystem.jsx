import { useRef } from 'react';
import donnees from 'virtual:accueil';
import { nombre } from '../composants.jsx';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';

/**
 * Scene 07 — software is a skill: Julie at the centre of a constellation of
 * six families, each opening on three real products of the catalogue.
 */
export default function SoftwareEcosystem() {
  const ref = useRef(null);
  const { famillesLogiciels, personnes, compteurs } = donnees;
  const familles = famillesLogiciels.slice(0, 6);
  const julie = personnes.find((p) => p.prenom === 'Julie');
  const place = (i) => {
    const a = (i / familles.length) * Math.PI * 2 - Math.PI / 2;
    return [50 + Math.cos(a) * 39, 50 + Math.sin(a) * 39];
  };

  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      gsap.timeline({ defaults: { ease: 'power3.out' }, scrollTrigger: { trigger: q('.se-constellation')[0], start: 'top 70%' } })
        .from(q('.se-centre'), { scale: 0.7, opacity: 0, duration: 0.9 })
        .from(q('.se-rayon'), { opacity: 0, stagger: 0.15, duration: 0.6, ease: 'power2.inOut' }, 0.4)
        .from(q('.se-famille'), { opacity: 0, scale: 0.6, stagger: 0.15, duration: 0.6, ease: 'back.out(1.5)' }, 0.6);
    });
    ajouter(MOBILE, (q) => q('.se-famille').forEach((el) => gsap.from(el, { opacity: 0, y: 20, duration: 0.7, scrollTrigger: { trigger: el, start: 'top 92%' } })));
  });

  const Tiroir = ({ f, className = '' }) => (
    <details className={`se-tiroir neon neon-calme !rounded-2xl ${className}`}>
      <summary className="list-none cursor-pointer px-4 py-3 text-center">
        <span className="block font-[Montserrat] font-bold text-white">{f.nom}</span>
        <span className="block text-[0.7rem] text-[var(--cyan)]">{nombre(f.nombre)} logiciels</span>
      </summary>
      <ul className="px-4 pb-3 flex flex-col gap-1 text-center">
        {f.exemples.map((e) => <li key={e.nom}><a href={e.url} className="text-[0.8rem] text-[var(--texte-doux)] hover:text-[var(--cyan)]">{e.nom}</a></li>)}
      </ul>
    </details>
  );

  return (
    <section ref={ref} className="scene overflow-hidden" aria-labelledby="titre-logiciels">
      <div className="cadre">
        <div className="text-center max-w-3xl mx-auto">
          <p className="surtitre justify-center">Vos logiciels</p>
          <h2 id="titre-logiciels" className="titre-display titre-grand mt-4">Un logiciel n'est pas une intégration. <span className="degrade-froid">C'est une compétence.</span></h2>
          <p className="mt-6 font-[Montserrat] font-extrabold text-3xl md:text-4xl text-white">{nombre(compteurs.logiciels)} <span className="text-base md:text-lg font-medium text-[var(--texte-doux)]">logiciels au référentiel, d'Europe d'abord</span></p>
        </div>

        <div className="se-constellation hidden md:block relative aspect-square max-w-[640px] mx-auto mt-10 orbite-pause">
          <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" aria-hidden="true">
            <g className="tourne-lent"><circle cx="50" cy="50" r="39" fill="none" stroke="rgba(3,243,255,.25)" strokeWidth=".25" strokeDasharray="0.6 1.4" /></g>
            <g className="tourne-lent-inverse"><circle cx="50" cy="50" r="26" fill="none" stroke="rgba(229,0,126,.3)" strokeWidth=".25" strokeDasharray="0.4 1.6" /></g>
            {familles.map((f, i) => {
              const [x, y] = place(i);
              return <line key={f.nom} className={`se-rayon trace ${i % 2 ? 'trace-rose' : ''}`} pathLength="1" x1="50" y1="50" x2={x} y2={y} />;
            })}
          </svg>
          <div className="se-centre absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center w-[34%]">
            <div className="incarne aspect-square"><img src="/accueil/julie-grand.webp" alt={`Julie, ${julie.titre}`} width="640" height="640" loading="lazy" decoding="async" /></div>
            <p className="-mt-4 relative font-[Montserrat] font-bold text-white">Julie</p>
          </div>
          {familles.map((f, i) => {
            const [x, y] = place(i);
            return (
              <div key={f.nom} className="se-famille absolute -translate-x-1/2 -translate-y-1/2 w-[30%] max-w-[190px] z-10" style={{ left: `${x}%`, top: `${y}%` }}>
                <Tiroir f={f} />
              </div>
            );
          })}
        </div>
        <ul className="md:hidden mt-8 grid grid-cols-2 gap-2.5">
          {familles.map((f) => <li key={f.nom} className="se-famille"><Tiroir f={f} /></li>)}
        </ul>

        <p className="mt-12 titre-display titre-petit text-center">
          Votre entreprise n'a pas à s'adapter à l'IA. <span className="degrade">L'IA s'adapte à votre entreprise.</span>
        </p>
      </div>
    </section>
  );
}
