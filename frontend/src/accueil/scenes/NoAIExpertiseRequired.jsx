import { useRef } from 'react';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';

/**
 * Scene 03 — the promise, in type alone. The first sentence leaves, the
 * second arrives, and ACCOMPLIR grows until it fills the screen and opens
 * onto the next scene.
 */
export default function NoAIExpertiseRequired() {
  const ref = useRef(null);
  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      // Without motion the two sentences read one under the other; animated,
      // they share the same place and the second replaces the first.
      const cadre = q('.pr-cadre')[0];
      cadre.classList.add('superpose');
      gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        scrollTrigger: { trigger: q('.pr-scene')[0], start: 'top top', end: '+=220%', scrub: 1.2, pin: true, anticipatePin: 1 },
      })
        .from(q('.pr-1 .ligne'), { yPercent: 105, stagger: 0.15, duration: 0.8 })
        .to({}, { duration: 0.5 })
        .to(q('.pr-1'), { opacity: 0, filter: 'blur(12px)', y: -60, duration: 0.9 })
        .fromTo(q('.pr-2'), { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.9 }, '<0.3')
        .to({}, { duration: 0.4 })
        .to(q('.pr-reste'), { opacity: 0, duration: 0.6 })
        .to(q('.pr-mot'), { scale: 5.5, duration: 1.6, ease: 'power2.in' }, '<')
        .to(q('.pr-mot'), { opacity: 0, duration: 0.5 }, '-=0.4');
      return () => cadre.classList.remove('superpose');
    });
    ajouter(MOBILE, (q) => {
      gsap.from(q('.pr-2'), { opacity: 0, y: 40, duration: 1, ease: 'power2.out', scrollTrigger: { trigger: q('.pr-2')[0], start: 'top 85%' } });
    });
  });

  return (
    <section ref={ref} aria-labelledby="titre-promesse">
      <div className="pr-scene scene epingle overflow-hidden">
        <div className="pr-cadre cadre w-full relative md:min-h-[70svh] flex flex-col items-center justify-center text-center">
          <h2 id="titre-promesse" className="pr-1 titre-display titre-grand">
            <span className="block overflow-hidden"><span className="ligne block">Vous n'avez plus besoin</span></span>
            <span className="block overflow-hidden pb-[0.1em]"><span className="ligne block text-[var(--texte-doux)]">de savoir comment utiliser l'IA.</span></span>
          </h2>
          <p className="pr-2 titre-display titre-grand mt-16">
            <span className="pr-reste block">Vous devez simplement savoir</span>
            <span className="block">
              <span className="pr-reste">ce que vous voulez </span>
              <span className="pr-mot inline-block lumiere uppercase tracking-tight">accomplir</span>
              <span className="pr-reste">.</span>
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
