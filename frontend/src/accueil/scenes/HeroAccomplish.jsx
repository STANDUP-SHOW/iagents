import { useRef } from 'react';
import donnees from 'virtual:accueil';
import { IntentInput, Bouton, Avatar, nombre } from '../composants.jsx';
import Globe from '../Globe.jsx';
import { useScene, BUREAU, gsap } from '../mouvement.js';

const VERBES = [
  { mot: 'Créer', x: '8%', y: '14%' },
  { mot: 'Développer', x: '62%', y: '6%' },
  { mot: 'Transformer', x: '2%', y: '58%' },
  { mot: 'Inventer', x: '64%', y: '46%' },
  { mot: 'Conquérir', x: '34%', y: '88%' },
];

const EXEMPLES = [
  'Je veux développer mon entreprise sur trois nouveaux marchés.',
  "J'ai besoin d'une assistante commerciale qui relance mes devis.",
  'Je veux ouvrir une boulangerie bio avec livraison en ville.',
  'Je dois trouver des financements pour mon projet.',
];

// Where the first agents appear around the globe, as the intention starts
// to become a team.
const ORBITE = [
  { i: 0, x: '18%', y: '30%' },
  { i: 2, x: '78%', y: '26%' },
  { i: 1, x: '84%', y: '74%' },
  { i: 4, x: '22%', y: '78%' },
];

export default function HeroAccomplish() {
  const ref = useRef(null);
  const { compteurs, personnes } = donnees;

  useScene(ref, (ajouter, q) => {
    window.__accueilPret = true;
    document.documentElement.classList.remove('anime');
    ajouter('(prefers-reduced-motion: no-preference)', () => {
      const entree = gsap.timeline({ defaults: { ease: 'power3.out' } });
      entree
        .from(q('.h-titre .ligne'), { yPercent: 105, duration: 1.4, stagger: 0.14 })
        .from(q('.h-accomplir'), { letterSpacing: '0.04em', opacity: 0.4, duration: 2.2, ease: 'power2.out' }, '<0.3')
        .from(q('[data-entree]'), { opacity: 0, y: 18, duration: 1.1, stagger: 0.12 }, '-=1.6')
        .from(q('.h-globe'), { opacity: 0, scale: 0.92, duration: 2.4, ease: 'power2.out' }, 0.2)
        .from(q('.h-verbe'), { opacity: 0, y: 14, filter: 'blur(6px)', duration: 1.6, stagger: 0.35 }, 0.9)
        .from(q('.h-agent'), { opacity: 0, scale: 0.6, duration: 1, stagger: 0.25, ease: 'back.out(1.4)' }, 1.8);
      // The words breathe slowly while the visitor reads.
      gsap.to(q('.h-verbe'), { y: '-=8', duration: 4, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: { each: 0.7, from: 'random' } });
    });
    ajouter(BUREAU, () => {
      // Scrolling away, the horizon comes closer and the words leave:
      // the intention is about to become a team.
      gsap.timeline({ scrollTrigger: { trigger: ref.current, start: 'top top', end: 'bottom top', scrub: 1 } })
        .to(q('.h-globe'), { scale: 1.25, yPercent: 12, opacity: 0.35, ease: 'none' }, 0)
        .to(q('.h-verbe'), { opacity: 0, y: -40, stagger: 0.04, ease: 'none' }, 0)
        .to(q('.h-agent'), { y: -30, opacity: 0, ease: 'none' }, 0.1)
        .to(q('.h-texte'), { y: -60, opacity: 0.2, ease: 'none' }, 0.2);
    });
  });

  return (
    <section ref={ref} className="scene scene-pleine !pt-28 md:!pt-32 overflow-hidden" aria-labelledby="titre-accueil">
      <div className="cadre grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-6 items-center">
        <div className="h-texte relative z-10">
          <h1 id="titre-accueil" className="h-titre titre-display titre-geant">
            <span className="block overflow-hidden pb-[0.06em]"><span className="ligne block">Que voulez-vous</span></span>
            <span className="block overflow-hidden pb-[0.12em]"><span className="ligne block h-accomplir lumiere">accomplir&nbsp;?</span></span>
          </h1>
          <p className="chapeau mt-7" data-entree>
            Vous n'avez plus besoin de savoir comment utiliser l'IA.<br className="hidden md:block" />
            {' '}Vous devez simplement savoir ce que vous voulez accomplir.
          </p>
          <div className="mt-9 max-w-[38rem]" data-entree>
            <p className="text-sm text-[var(--texte-doux)] mb-3">Dites-le simplement.</p>
            <IntentInput id="intention-hero" exemples={EXEMPLES} />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3" data-entree>
            <Bouton href="#comment" variante="contour" evenement="hero_start">Découvrir iAgent</Bouton>
            <span className="note ml-1">Commencer avec une idée, un besoin ou un objectif.</span>
          </div>
          <dl className="mt-12 grid grid-cols-3 gap-4 max-w-[34rem] border-t border-[var(--trait)] pt-6" data-entree>
            <div className="flex flex-col-reverse"><dt className="note">métiers prêts</dt><dd className="font-[Sora] text-2xl md:text-3xl font-semibold text-white">{nombre(compteurs.fiches)}</dd></div>
            <div className="flex flex-col-reverse"><dt className="note">secteurs</dt><dd className="font-[Sora] text-2xl md:text-3xl font-semibold text-white">{nombre(compteurs.secteurs)}</dd></div>
            <div className="flex flex-col-reverse"><dt className="note">logiciels connus</dt><dd className="font-[Sora] text-2xl md:text-3xl font-semibold text-white">{nombre(compteurs.logiciels)}</dd></div>
          </dl>
        </div>

        <div className="relative aspect-square w-full max-w-[640px] mx-auto lg:mr-[-6%]" aria-hidden="true">
          <Globe className="h-globe absolute inset-0 w-full h-full" />
          {VERBES.map((v) => (
            <span key={v.mot} className="h-verbe absolute verre !rounded-xl px-4 py-2 font-[Sora] text-[0.95rem] md:text-lg text-[var(--texte)]" style={{ left: v.x, top: v.y }}>
              {v.mot}
            </span>
          ))}
          {ORBITE.map(({ i, x, y }) => (
            <span key={i} className="h-agent absolute -translate-x-1/2 -translate-y-1/2" style={{ left: x, top: y }}>
              <Avatar personne={personnes[i]} taille={52} />
            </span>
          ))}
          <p className="hidden sm:block absolute right-2 bottom-2 text-right font-[Sora] text-sm text-[var(--texte-doux)] leading-snug">
            Human ambition.<br /><span className="text-[var(--cyan)]">Agentic execution.</span>
          </p>
        </div>
      </div>
    </section>
  );
}
