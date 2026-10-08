import { useRef } from 'react';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';

const VERBES = ['Chercher.', 'Analyser.', 'Rédiger.', 'Contacter.', 'Téléphoner.', 'Publier.', 'Relancer.', 'Créer.', 'Contrôler.', 'Organiser.'];

const CANAUX = [
  ['E-mail', 'M4 6h16v12H4z M4 7l8 6 8-6'],
  ['Navigateur', 'M3 5h18v14H3z M3 9h18 M6 7h.01 M8.5 7h.01'],
  ['Téléphone', 'M7 3h4l1 5-2.5 1.5a11 11 0 005 5L16 12l5 1v4a2 2 0 01-2 2A16 16 0 015 5a2 2 0 012-2z'],
  ['WhatsApp', 'M4 20l1.3-3.9A8 8 0 1112 20a8 8 0 01-4.1-1.1z'],
  ['Réseaux sociaux', 'M7 12a2 2 0 100-.01 M17 6a2 2 0 100-.01 M17 18a2 2 0 100-.01 M8.7 11l6.6-4 M8.7 13l6.6 4'],
  ['CRM', 'M8 11a3 3 0 100-6 3 3 0 000 6z M3 20a5 5 0 0110 0 M16 8h5 M16 12h5 M16 16h3'],
  ['ERP', 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z'],
  ['Documents', 'M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6 M9 16h6'],
];

/** Scene 08 — not a chatbot: a colleague, whose verbs produce work. */
export default function AgentInAction() {
  const ref = useRef(null);
  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      gsap.timeline({ scrollTrigger: { trigger: q('.ac-scene')[0], start: 'top top', end: '+=220%', scrub: 1, pin: true, anticipatePin: 1 } })
        .from(q('.ac-chatbot'), { opacity: 0, y: 30, duration: 0.5 })
        .to(q('.ac-chatbot'), { scale: 0.45, opacity: 0.45, y: -30, duration: 0.8 }, '+=0.3')
        .from(q('.ac-collab'), { opacity: 0, scale: 1.15, filter: 'blur(10px)', duration: 0.9 }, '<0.2')
        .fromTo(q('.ac-rang-1'), { xPercent: 5 }, { xPercent: -35, ease: 'none', duration: 2.4 }, '<')
        .fromTo(q('.ac-rang-2'), { xPercent: -40 }, { xPercent: 0, ease: 'none', duration: 2.4 }, '<')
        .from(q('.ac-canal'), { opacity: 0, y: 24, stagger: 0.1, duration: 0.5 }, '-=1.4')
        .from(q('.ac-conclusion'), { opacity: 0, y: 24, duration: 0.6 })
        .to({}, { duration: 0.3 });
    });
    ajouter(MOBILE, (q) => {
      q('.ac-canal, .ac-conclusion').forEach((el) => gsap.from(el, { opacity: 0, y: 18, duration: 0.6, scrollTrigger: { trigger: el, start: 'top 94%' } }));
    });
  });

  return (
    <section ref={ref} aria-labelledby="titre-action">
      <div className="ac-scene scene epingle flex-col justify-center overflow-hidden">
        <div className="cadre w-full text-center">
          <p className="ac-chatbot titre-display titre-moyen text-[var(--texte-doux)]">Ce n'est pas un chatbot.</p>
          <h2 id="titre-action" className="ac-collab titre-display titre-grand mt-2 uppercase">C'est un <span className="lumiere">collaborateur.</span></h2>
        </div>
        <div className="w-full mt-12 md:mt-16 space-y-3 select-none" aria-hidden="true">
          <div className="ac-rang-1 marquee font-[Montserrat] font-light text-[clamp(1.6rem,4.4vw,4rem)] text-[rgba(234,242,255,0.18)]">
            {[...VERBES, ...VERBES].map((v, i) => <span key={i} className={i % 4 === 1 ? 'text-[var(--texte)]' : ''}>{v}</span>)}
          </div>
          <div className="ac-rang-2 marquee font-[Montserrat] font-light text-[clamp(1.6rem,4.4vw,4rem)] text-[rgba(234,242,255,0.18)]">
            {[...VERBES.slice(5), ...VERBES, ...VERBES.slice(0, 5)].map((v, i) => <span key={i} className={i % 5 === 2 ? 'lumiere' : ''}>{v}</span>)}
          </div>
        </div>
        <p className="sr-only">Il cherche, analyse, rédige, contacte, téléphone, publie, relance, crée, contrôle et organise.</p>
        <div className="cadre w-full mt-12 md:mt-16">
          <ul className="flex flex-wrap justify-center gap-3 md:gap-4" aria-label="Ses outils de travail">
            {CANAUX.map(([nom, d]) => (
              <li key={nom} className="ac-canal verre !rounded-2xl w-[96px] md:w-[110px] py-4 flex flex-col items-center gap-2">
                <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d={d} fill="none" stroke="var(--cyan)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span className="text-[0.75rem] text-[var(--texte-doux)] text-center leading-tight">{nom}</span>
              </li>
            ))}
          </ul>
          <p className="note text-center mt-4">Il travaille avec les accès que vous lui confiez. Le téléphone et WhatsApp arrivent progressivement.</p>
          <p className="ac-conclusion mt-12 titre-display titre-petit text-center">Confiez-lui une responsabilité.<br /><span className="text-[var(--texte-doux)]">Pas seulement une instruction.</span></p>
        </div>
      </div>
    </section>
  );
}
