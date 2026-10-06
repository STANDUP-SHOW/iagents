import { useRef } from 'react';
import donnees from 'virtual:accueil';
import { nombre } from '../composants.jsx';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';

/**
 * Scene 07 — software is a skill. The families gather around the
 * collaborator: each with its count in the catalogue and three names.
 */
export default function SoftwareEcosystem() {
  const ref = useRef(null);
  const { famillesLogiciels: familles, personnes, compteurs } = donnees;
  const julie = personnes.find((p) => p.prenom === 'Julie');
  const n = familles.length;

  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      gsap.timeline({
        scrollTrigger: { trigger: q('.se-scene')[0], start: 'top top', end: '+=200%', scrub: 1, pin: true, anticipatePin: 1 },
      })
        .from(q('.se-centre'), { scale: 0.7, opacity: 0, duration: 0.6 })
        .from(q('.se-famille'), { opacity: 0, scale: 0.4, x: (i, el) => -parseFloat(el.dataset.dx), y: (i, el) => -parseFloat(el.dataset.dy), stagger: 0.08, duration: 0.8, ease: 'power3.out' }, '<0.2')
        .from(q('.se-rayon'), { opacity: 0, stagger: 0.05, duration: 0.4 }, '<0.3')
        .from(q('.se-bulle'), { opacity: 0, y: 20, stagger: 0.5, duration: 0.5 })
        .from(q('.se-conclusion'), { opacity: 0, y: 20, duration: 0.6 })
        .to({}, { duration: 0.4 });
      gsap.to(q('.se-orbite'), { rotate: 360, duration: 240, ease: 'none', repeat: -1 });
    });
    ajouter(MOBILE, (q) => {
      q('.se-famille, .se-bulle, .se-conclusion').forEach((el) => gsap.from(el, { opacity: 0, y: 20, duration: 0.7, scrollTrigger: { trigger: el, start: 'top 92%' } }));
    });
  });

  return (
    <section ref={ref} aria-labelledby="titre-logiciels">
      <div className="se-scene scene epingle flex-col justify-center overflow-hidden">
        <div className="cadre w-full grid lg:grid-cols-[0.85fr_1.15fr] gap-12 items-center">
          <div>
            <h2 id="titre-logiciels" className="titre-display titre-moyen">
              Vos collaborateurs connaissent déjà <span className="lumiere">votre environnement de travail.</span>
            </h2>
            <p className="chapeau mt-6">
              {nombre(compteurs.logiciels)} logiciels professionnels, d'Europe d'abord, rangés en {nombre(compteurs.categoriesLogiciels)} familles.
              Pour un collaborateur iAgent, un logiciel n'est pas une intégration : c'est une compétence.
            </p>
            <div className="mt-8 flex flex-col gap-3 max-w-md">
              <div className="se-bulle bulle bulle-humain">
                <p className="bulle-qui">Vous</p>
                <p>Chez nous, tu utiliseras Salesforce, Pennylane, WhatsApp Business et notre ERP métier.</p>
              </div>
              <div className="se-bulle bulle bulle-agent">
                <p className="bulle-qui">Julie</p>
                <p>Compris. J'adapte mon poste de travail.</p>
              </div>
            </div>
          </div>

          <div className="relative">
            {/* Wide screens: the families around Julie. */}
            <div className="hidden md:block relative aspect-square max-w-[620px] mx-auto">
              <svg className="se-orbite absolute inset-0 w-full h-full" viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="38" className="fil fil-doux" strokeDasharray="0.6 1.4" />
                <circle cx="50" cy="50" r="24" className="fil fil-doux" />
              </svg>
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" aria-hidden="true">
                {familles.map((f, i) => {
                  const a = (i / n) * Math.PI * 2 - Math.PI / 2;
                  return <line key={f.nom} className="se-rayon fil" x1={50 + Math.cos(a) * 10} y1={50 + Math.sin(a) * 10} x2={50 + Math.cos(a) * 33} y2={50 + Math.sin(a) * 33} />;
                })}
              </svg>
              <div className="se-centre absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <span className="avatar block mx-auto" style={{ width: 112, height: 112 }}><img src="/accueil/julie.webp" alt="Julie" width="206" height="256" loading="lazy" /></span>
                <p className="mt-2 font-[Sora] font-semibold">{julie.prenom}</p>
                <p className="text-xs text-[var(--cyan)]">{julie.titre}</p>
              </div>
              <ul>
                {familles.map((f, i) => {
                  const a = (i / n) * Math.PI * 2 - Math.PI / 2;
                  const x = Math.cos(a) * 40; const y = Math.sin(a) * 40;
                  return (
                    <li key={f.nom} className="se-famille absolute -translate-x-1/2 -translate-y-1/2 w-[30%] max-w-[180px]" style={{ left: `${50 + x}%`, top: `${50 + y}%` }} data-dx={x * 4} data-dy={y * 4}>
                      <div className="verre !rounded-xl px-3 py-2.5 text-center">
                        <p className="font-[Sora] font-semibold text-[0.95rem]">{f.nom} <span className="text-[var(--texte-pale)] font-normal text-xs">{f.nombre}</span></p>
                        <p className="text-[0.72rem] text-[var(--texte-doux)] leading-snug mt-0.5">{f.exemples.map((e) => e.nom).join(' · ')}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            {/* Small screens: the same families as a list. */}
            <ul className="md:hidden grid grid-cols-2 gap-2.5">
              {familles.map((f) => (
                <li key={f.nom} className="se-famille verre !rounded-xl px-3 py-2.5">
                  <p className="font-[Sora] font-semibold text-[0.95rem]">{f.nom} <span className="text-[var(--texte-pale)] font-normal text-xs">{f.nombre}</span></p>
                  <p className="text-[0.72rem] text-[var(--texte-doux)] leading-snug mt-0.5">{f.exemples.map((e) => e.nom).join(' · ')}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="se-conclusion cadre w-full mt-12 titre-display titre-petit text-center">
          Votre entreprise n'a pas à s'adapter à l'IA.<br /><span className="lumiere">L'IA s'adapte à votre entreprise.</span>
        </p>
      </div>
    </section>
  );
}
