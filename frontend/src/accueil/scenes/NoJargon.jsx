import { useRef } from 'react';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';

const JARGON = [
  ['API', '8%', '18%'], ['LLM', '78%', '12%'], ['MCP', '22%', '72%'], ['workflow', '64%', '78%'],
  ['prompt', '4%', '46%'], ['automation', '70%', '42%'], ['orchestration', '30%', '10%'],
  ['token', '86%', '64%'], ['model', '48%', '88%'], ['fine-tuning', '40%', '28%'], ['RAG', '14%', '88%'],
];

const PHRASES = [
  "J'ai besoin d'une assistante commerciale.",
  'Je veux prospecter l’Espagne.',
  'Je dois trouver des financements.',
  'Je veux lancer une nouvelle activité.',
];

/** Scene 04 — the jargon crowds the screen, then is swept away: talk business. */
export default function NoJargon() {
  const ref = useRef(null);
  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      // The jargon only exists to be swept away: without motion it is not shown.
      ref.current.classList.add('jg-anime');
      gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        scrollTrigger: { trigger: q('.jg-scene')[0], start: 'top top', end: '+=240%', scrub: 1, pin: true, anticipatePin: 1 },
      })
        .from(q('.jg-mot'), { opacity: 0, scale: 0.4, stagger: { each: 0.08, from: 'random' }, duration: 0.8 })
        .to({}, { duration: 0.3 })
        .to(q('.jg-mot'), { left: '50%', top: '50%', xPercent: -50, yPercent: -50, scale: 0, opacity: 0, stagger: { each: 0.03, from: 'random' }, duration: 1 })
        .to(q('.jg-intro'), { opacity: 0, y: -30, duration: 0.6 }, '<')
        .from(q('.jg-parlez'), { opacity: 0, scale: 0.9, duration: 0.7 })
        .from(q('.jg-phrase'), { opacity: 0, y: 24, stagger: 0.35, duration: 0.6 })
        .from(q('.jg-conclusion'), { opacity: 0, y: 24, duration: 0.6 });
      return () => ref.current?.classList.remove('jg-anime');
    });
    ajouter(MOBILE, (q) => {
      q('.jg-phrase, .jg-conclusion').forEach((el) => gsap.from(el, { opacity: 0, y: 24, duration: 0.8, scrollTrigger: { trigger: el, start: 'top 90%' } }));
    });
  });

  return (
    <section ref={ref} aria-labelledby="titre-jargon">
      <div className="jg-scene scene epingle overflow-hidden">
        <div className="cadre w-full relative min-h-[60svh] md:min-h-[78svh]">
          <div className="jg-nuage absolute inset-0" aria-hidden="true">
            {JARGON.map(([mot, x, y]) => (
              <span key={mot} className="jg-mot absolute font-mono text-[clamp(1rem,2.2vw,2rem)] text-[var(--texte-pale)] border border-[var(--trait)] rounded-lg px-3 py-1 bg-[rgba(8,18,36,0.6)]" style={{ left: x, top: y }}>
                {mot}
              </span>
            ))}
          </div>
          <p className="jg-intro relative md:absolute md:inset-x-0 md:top-[2%] text-center titre-display titre-petit text-[var(--texte-doux)]">
            Votre métier est déjà assez compliqué.
          </p>
          <div className="relative md:absolute md:inset-0 flex flex-col items-center justify-center text-center mt-10 md:mt-0">
            <h2 id="titre-jargon" className="jg-parlez titre-display titre-grand">Parlez <span className="lumiere">métier.</span></h2>
            <ul className="mt-8 space-y-3">
              {PHRASES.map((p) => (
                <li key={p} className="jg-phrase text-lg md:text-2xl font-[Sora] font-light text-[var(--texte)]">« {p} »</li>
              ))}
            </ul>
            <p className="jg-conclusion mt-10 chapeau !max-w-none">iAgent traduit le besoin en force de travail.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
