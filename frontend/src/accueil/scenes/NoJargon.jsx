import { useRef } from 'react';
import { useScene, BUREAU, gsap } from '../mouvement.js';

const JARGON = ['API', 'LLM', 'MCP', 'prompt', 'workflow', 'tokens', 'RAG', 'fine-tuning', 'orchestration', 'embeddings', 'automation', 'agents autonomes'];

/**
 * Scene 03 — the technical words on the left blur and leave; on the right,
 * one sentence a manager would actually say.
 */
export default function NoJargon() {
  const ref = useRef(null);
  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      gsap.timeline({ scrollTrigger: { trigger: ref.current, start: 'top 75%', end: 'center 40%', scrub: 1 } })
        .fromTo(q('.jg-mot'), { opacity: 0.9, filter: 'blur(0px)' }, { opacity: 0.08, filter: 'blur(7px)', y: 12, stagger: { each: 0.06, from: 'random' }, ease: 'none' }, 0)
        .from(q('.jg-phrase'), { opacity: 0, x: 40, ease: 'none' }, 0.3)
        .from(q('.jg-conclusion'), { opacity: 0, y: 20, ease: 'none' }, 0.7);
    });
  });

  return (
    <section ref={ref} className="scene" aria-labelledby="titre-jargon">
      <div className="cadre">
        <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
          <div aria-hidden="true" className="flex flex-wrap gap-2.5 md:gap-3 md:justify-end">
            {JARGON.map((mot) => (
              <span key={mot} className="jg-mot font-mono text-[clamp(0.9rem,1.6vw,1.35rem)] text-[var(--texte-pale)] border border-[var(--trait)] rounded-lg px-3 py-1 bg-[rgba(8,18,36,0.6)] opacity-40 md:opacity-100">{mot}</span>
            ))}
          </div>
          <div className="jg-phrase">
            <p className="marge">Ce que vous dites</p>
            <p className="titre-display titre-grand mt-5">« Je veux prospecter <span className="degrade">l'Espagne.</span> »</p>
          </div>
        </div>
        <h2 id="titre-jargon" className="jg-conclusion mt-14 md:mt-20 text-center titre-display titre-petit">
          Parlez métier. <span className="text-[var(--texte-doux)]">iAgent traduit le besoin en force de travail.</span>
        </h2>
      </div>
    </section>
  );
}
