import { useRef } from 'react';
import donnees from 'virtual:accueil';
import { IntentInput, nombre } from '../composants.jsx';
import { useScene, BUREAU, gsap } from '../mouvement.js';

const EXEMPLES = [
  'Je veux développer mon entreprise sur trois nouveaux marchés.',
  "J'ai besoin d'une assistante commerciale qui relance mes devis.",
  'Je veux ouvrir une boulangerie bio avec livraison en ville.',
  'Je dois trouver des financements pour mon projet.',
];

/** A full-bleed picture behind a scene, light first, big screens second. */
export function Decor({ nom, className = '', voile, priorite = false }) {
  return (
    <div className={`decor ${className}`} style={voile ? { '--voile': voile } : undefined} aria-hidden="true">
      <img
        src={`/accueil/decor-${nom}-1280.webp`}
        srcSet={`/accueil/decor-${nom}-1280.webp 1280w, /accueil/decor-${nom}.webp 2560w`}
        sizes="100vw" alt="" width="2560" height="1440"
        loading={priorite ? 'eager' : 'lazy'} fetchpriority={priorite ? 'high' : undefined} decoding="async"
      />
    </div>
  );
}

/**
 * Scene 01 — one question over the Earth seen from space (audit of 08/10):
 * the title, one sentence, the field, nothing else above the fold. The field
 * comes last; the counters wait below it.
 */
export default function HeroAccomplish() {
  const ref = useRef(null);
  const { compteurs } = donnees;

  useScene(ref, (ajouter, q) => {
    window.__accueilPret = true;
    document.documentElement.classList.remove('anime');
    ajouter('(prefers-reduced-motion: no-preference)', () => {
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from(q('.decor img'), { scale: 1.08, opacity: 0, duration: 2.6, ease: 'power2.out' }, 0)
        .from(q('.h-titre .ligne'), { yPercent: 105, duration: 1.3, stagger: 0.16 }, 0.35)
        .from(q('.h-sous'), { opacity: 0, y: 20, duration: 0.9 }, 1.1)
        .from(q('.h-champ'), { opacity: 0, y: 26, scale: 0.98, duration: 1 }, 1.45)
        .from(q('.h-bas'), { opacity: 0, duration: 1.2 }, 2);
    });
    ajouter(BUREAU, () => {
      // Parallax kept small (≈5 %): the Earth drifts, the words stay put.
      gsap.timeline({ scrollTrigger: { trigger: ref.current, start: 'top top', end: 'bottom top', scrub: 1 } })
        .to(q('.decor img'), { yPercent: 5, scale: 1.04, ease: 'none' }, 0)
        .to(q('.h-texte'), { y: -50, opacity: 0.15, ease: 'none' }, 0);
    });
  });

  return (
    <section ref={ref} className="relative min-h-[100svh] flex flex-col overflow-hidden" aria-labelledby="titre-accueil">
      <Decor nom="orbite" priorite voile="linear-gradient(180deg, rgba(2,8,23,.7) 0%, rgba(2,8,23,.25) 30%, rgba(2,8,23,.15) 60%, rgba(2,8,23,.85) 92%, var(--fond) 100%)" />
      <div className="h-texte au-dessus cadre flex-1 flex flex-col items-center justify-center text-center pt-28 pb-10">
        <p className="marge !border-0 !pl-0 mb-6" data-entree>Votre équipe d'experts · métier par métier</p>
        <h1 id="titre-accueil" className="h-titre titre-display titre-geant">
          <span className="block overflow-hidden pb-[0.06em]"><span className="ligne block">Que voulez-vous</span></span>
          <span className="block overflow-hidden pb-[0.14em]"><span className="ligne block degrade">accomplir&nbsp;?</span></span>
        </h1>
        <p className="h-sous chapeau mt-6 mx-auto max-w-[40rem]">
          Dites-le simplement. iAgent réunit les experts qu'il faut et ils se mettent au travail.
        </p>
        <div className="h-champ mt-9 w-full max-w-[44rem] intention-heros-cadre">
          <IntentInput id="intention-hero" exemples={EXEMPLES} grand />
        </div>
      </div>
      <dl className="h-bas au-dessus cadre w-full grid grid-cols-2 md:grid-cols-4 gap-4 pb-10 text-center">
        <div className="flex flex-col-reverse"><dt className="note">métiers prêts</dt><dd className="font-[Montserrat] text-2xl md:text-4xl font-bold text-white">{nombre(compteurs.fiches)}</dd></div>
        <div className="flex flex-col-reverse"><dt className="note">secteurs</dt><dd className="font-[Montserrat] text-2xl md:text-4xl font-bold text-white">{nombre(compteurs.secteurs)}</dd></div>
        <div className="flex flex-col-reverse"><dt className="note">activités reconnues</dt><dd className="font-[Montserrat] text-2xl md:text-4xl font-bold text-white">{nombre(compteurs.activites)}</dd></div>
        <div className="flex flex-col-reverse"><dt className="note">logiciels métier</dt><dd className="font-[Montserrat] text-2xl md:text-4xl font-bold text-white">{nombre(compteurs.logiciels)}</dd></div>
      </dl>
    </section>
  );
}
