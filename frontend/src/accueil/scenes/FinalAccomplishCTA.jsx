import { useRef } from 'react';
import { IntentInput, Bouton, LIENS } from '../composants.jsx';
import { useScene, BUREAU, gsap } from '../mouvement.js';

/** Scene 16 — the film ends where it started, on the question. */
export default function FinalAccomplishCTA() {
  const ref = useRef(null);

  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: q('.fn-scene')[0], start: 'top 70%' } });
      tl.from(q('.fn-alors'), { opacity: 0, y: 20, duration: 0.8 })
        .from(q('.fn-titre'), { opacity: 0, y: 40, duration: 1, ease: 'power3.out' }, '-=0.3')
        .from(q('.fn-champ'), { opacity: 0, y: 20, duration: 0.7 }, '-=0.4')
        .from(q('.fn-suite'), { opacity: 0, y: 14, stagger: 0.1, duration: 0.5 }, '-=0.3');
    });
  });

  return (
    <section ref={ref} id="commencer" aria-labelledby="titre-final">
      <div className="fn-scene scene scene-pleine relative overflow-hidden">
        <div className="fond-halo" aria-hidden="true" />
        <div className="cadre text-center flex flex-col items-center">
          <p className="fn-alors font-[Montserrat] font-light text-2xl md:text-3xl text-[var(--texte-doux)]">Alors…</p>
          <h2 id="titre-final" className="fn-titre titre-display titre-geant mt-4">Que voulez-vous <span className="lumiere">accomplir&nbsp;?</span></h2>
          <div className="fn-champ w-full max-w-3xl mt-12 text-left">
            <IntentInput id="intention-finale" grand evenement="final_cta_click" exemples={['Décrivez votre idée, votre besoin ou votre objectif…', 'Je veux répondre plus vite à mes clients.', 'Je veux trouver des financements pour mon projet.']} />
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Bouton className="fn-suite" href={LIENS.catalogue} variante="contour" evenement="catalog_click">Explorer les métiers</Bouton>
            <Bouton className="fn-suite" href={LIENS.entreprise} variante="contour" evenement="create_company_click">Créer une entreprise</Bouton>
            <Bouton className="fn-suite" href="#desktop-commander" variante="contour" evenement="desktop_commander_click">Découvrir Desktop Commander</Bouton>
          </div>
          <p className="fn-suite mt-16 titre-display titre-petit text-[var(--texte-doux)]">
            Vous n'avez pas besoin de connaître l'IA.<br />
            <span className="text-white">Vous avez seulement besoin de savoir ce que vous voulez accomplir.</span>
          </p>
        </div>
      </div>
    </section>
  );
}
