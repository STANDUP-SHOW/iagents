import { useRef } from 'react';
import { IntentInput, Bouton, LIENS } from '../composants.jsx';
import { Decor } from './HeroAccomplish.jsx';
import { useScene, BUREAU, gsap } from '../mouvement.js';

/** Scene 17 — the film ends where it started, on the question, at sunrise. */
export default function FinalAccomplishCTA() {
  const ref = useRef(null);

  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      gsap.timeline({ defaults: { ease: 'power3.out' }, scrollTrigger: { trigger: ref.current, start: 'top 60%' } })
        .from(q('.decor img'), { scale: 1.06, opacity: 0.3, duration: 2.2, ease: 'power2.out' }, 0)
        .from(q('.fn-alors'), { opacity: 0, y: 20, duration: 0.8 }, 0.2)
        .from(q('.fn-question'), { opacity: 0, y: 40, duration: 1 }, 0.5)
        .from(q('.fn-champ'), { opacity: 0, y: 20, duration: 0.8 }, 1.1)
        .from(q('.fn-suite'), { opacity: 0, y: 12, stagger: 0.12, duration: 0.5 }, 1.5);
    });
  });

  return (
    <section ref={ref} id="commencer" className="relative overflow-hidden min-h-[100svh] flex items-center" aria-labelledby="titre-final">
      <Decor nom="lever" voile="linear-gradient(180deg, var(--fond) 0%, rgba(2,8,23,.2) 22%, rgba(2,8,23,.1) 55%, rgba(2,8,23,.75) 90%, var(--fond) 100%)" />
      <div className="au-dessus cadre w-full text-center flex flex-col items-center py-28">
        <p className="fn-alors font-[Montserrat] font-medium text-2xl md:text-3xl text-[var(--texte-doux)]">Alors…</p>
        <h2 id="titre-final" className="fn-question titre-display titre-geant mt-3">Que voulez-vous <span className="degrade">accomplir&nbsp;?</span></h2>
        <div className="fn-champ intention-heros-cadre w-full max-w-3xl mt-12 text-left">
          <IntentInput id="intention-finale" grand evenement="final_cta_click" exemples={['Décrivez votre idée, votre besoin ou votre objectif…', 'Je veux répondre plus vite à mes clients.', 'Je veux trouver des financements pour mon projet.']} />
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3">
          <Bouton className="fn-suite" href={LIENS.catalogue} variante="lien" evenement="catalog_click">Explorer les métiers</Bouton>
          <Bouton className="fn-suite" href="/pricing" variante="lien" evenement="pricing_click">Voir les tarifs</Bouton>
          <Bouton className="fn-suite" href="/contact" variante="lien" evenement="demo_click">Demander une démo</Bouton>
        </div>
      </div>
    </section>
  );
}
