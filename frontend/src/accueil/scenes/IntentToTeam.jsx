import { useRef } from 'react';
import donnees from 'virtual:accueil';
import { Bouton } from '../composants.jsx';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';

const PHRASE = 'Développer mon entreprise sur trois nouveaux marchés';
const ORDRE = ['Marché', 'Finance', 'Juridique', 'Commercial', 'Marketing', 'Opérations'];
// Where each card's line meets it, in the SVG's 0-100 box (desktop only).
const ANCRES = [[17, 30], [50, 30], [83, 30], [17, 70], [50, 70], [83, 70]];

/** A member of the team as the brochures show one: big portrait, role, status. */
export function CarteEquipe({ personne, className = '' }) {
  return (
    <article className={`neon neon-survol overflow-hidden flex flex-col ${className}`}>
      <div className="relative aspect-[4/3.6] overflow-hidden rounded-t-[20px]">
        <img src={`/accueil/${personne.portrait}-grand.webp`} alt={`Portrait de ${personne.prenom}, ${personne.titre}`} width="640" height="640" loading="lazy" decoding="async" className="w-full h-full object-cover object-[50%_30%]" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[rgba(6,12,32,0.95)] to-transparent" />
        <span className="absolute top-3 left-3 puce puce-cyan !text-[0.68rem] !py-1 backdrop-blur">{personne.domaine}</span>
      </div>
      <div className="px-4 pb-4 -mt-6 relative">
        <h3 className="font-[Montserrat] font-bold text-lg text-white leading-tight">{personne.prenom}</h3>
        <p className="text-[0.85rem] text-[var(--cyan)] leading-snug">{personne.titre}</p>
        <p className="text-[0.74rem] text-[var(--texte-pale)] mt-1 leading-snug line-clamp-2">{personne.metier}</p>
        <p className="mt-3 flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.18em] text-[var(--texte-doux)]">
          <span className="inline-block w-2 h-2 rounded-full bg-[var(--cyan)] pulse-lent" /> Disponible
        </p>
      </div>
    </article>
  );
}

/**
 * Scene 02 — the goal sits in the middle; six experts arrive around it one
 * after the other and a line ties each to the project.
 */
export default function IntentToTeam() {
  const ref = useRef(null);
  const equipe = ORDRE.map((d) => donnees.personnes.find((p) => p.domaine === d));

  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      gsap.timeline({ defaults: { ease: 'power3.out' }, scrollTrigger: { trigger: q('.it-plateau')[0], start: 'top 70%' } })
        .from(q('.it-objectif'), { opacity: 0, scale: 0.85, duration: 0.7 })
        .from(q('.it-fil'), { opacity: 0, duration: 0.6, stagger: 0.18, ease: 'power2.inOut' }, 0.4)
        .from(q('.it-carte'), { opacity: 0, y: 28, scale: 0.96, duration: 0.6, stagger: 0.18 }, 0.55)
        .from(q('.it-fin'), { opacity: 0, y: 24, duration: 0.7 }, '-=0.1');
    });
    ajouter(MOBILE, (q) => {
      q('.it-carte, .it-fin').forEach((el) => {
        gsap.from(el, { opacity: 0, y: 24, duration: 0.6, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
      });
    });
  });

  return (
    <section ref={ref} id="comment" className="scene fond-halo" aria-labelledby="titre-equipe">
      <div className="cadre">
        <div className="text-center max-w-3xl mx-auto">
          <p className="surtitre justify-center">Une phrase suffit</p>
          <h2 id="titre-equipe" className="titre-display titre-grand mt-4">
            Votre ambition <span className="degrade-froid">devient une équipe.</span>
          </h2>
        </div>

        <div className="it-plateau relative mt-12 md:mt-16">
          <svg className="hidden md:block absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {ANCRES.map(([x, y], i) => (
              <path key={i} className={`it-fil trace ${i % 2 ? 'trace-rose' : ''}`} pathLength="1" d={`M50 50 C 50 ${y < 50 ? 42 : 58}, ${x} ${y < 50 ? 44 : 56}, ${x} ${y}`} />
            ))}
          </svg>
          <ol className="grid grid-cols-2 md:grid-cols-3 gap-4 lg:gap-x-16 lg:gap-y-6 md:[grid-template-rows:auto_auto_auto]" aria-label="L'équipe proposée">
            {equipe.map((p, i) => (
              <li key={p.prenom} className={`it-carte relative ${i >= 3 ? 'md:row-start-3' : 'md:row-start-1'} ${i === 1 || i === 4 ? 'md:max-w-[19rem] md:mx-auto md:w-full' : 'md:max-w-[19rem] md:w-full ' + (i % 3 === 0 ? 'md:mr-auto' : 'md:ml-auto')}`}>
                <CarteEquipe personne={p} className="h-full" />
              </li>
            ))}
            <li className="col-span-2 md:col-span-3 md:row-start-2 flex justify-center order-first md:order-none py-2 md:py-8" aria-hidden="true">
              <p className="it-objectif neon px-6 md:px-9 py-4 md:py-5 text-center max-w-xl">
                <span className="block marge !border-0 !pl-0 !text-[0.62rem] text-[var(--cyan)]">Objectif</span>
                <span className="block font-[Montserrat] font-bold text-white text-lg md:text-2xl leading-tight mt-1">{PHRASE}</span>
              </p>
            </li>
          </ol>
        </div>

        <div className="it-fin mt-14 md:mt-20 text-center">
          <p className="titre-display titre-moyen">
            Vous apportez l'ambition.<br /><span className="degrade">iAgent construit les moyens.</span>
          </p>
          <div className="mt-8 flex justify-center">
            <Bouton href="/catalogue" variante="contour" evenement="catalog_click">Voir tous les métiers</Bouton>
          </div>
        </div>
      </div>
    </section>
  );
}
