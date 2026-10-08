import { useRef } from 'react';
import { Icone } from '../composants.jsx';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';

const VERBES = [
  ['Cherche', 'dans vos dossiers et sur le web'],
  ['Agit', 'dans vos logiciels, avec vos accès'],
  ['Parle', 'à vous, à voix haute'],
  ['Livre', 'des fichiers prêts dans votre dossier'],
];

// The channels it works through. Telephone and WhatsApp are coming, said so.
const CANAUX = [['email', 'E-mail'], ['web', 'Navigateur'], ['crm', 'CRM'], ['erp', 'ERP'], ['doc', 'Documents'], ['agenda', 'Agenda'], ['tel', 'Téléphone · bientôt'], ['bulle', 'WhatsApp · bientôt']];

/** Scene 08 — the manifesto: not a chatbot, a colleague; four verbs. */
export default function AgentInAction() {
  const ref = useRef(null);
  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      gsap.timeline({ defaults: { ease: 'power3.out' }, scrollTrigger: { trigger: ref.current, start: 'top 60%' } })
        .from(q('.ac-chatbot'), { opacity: 0, y: 20, duration: 0.7 })
        .from(q('.ac-collab'), { opacity: 0, scale: 1.08, filter: 'blur(10px)', duration: 1 }, '+=0.2')
        .from(q('.ac-verbe'), { opacity: 0, y: 30, stagger: 0.18, duration: 0.7 }, '-=0.3')
        .from(q('.ac-canal'), { opacity: 0, stagger: 0.06, duration: 0.5 }, '-=0.2');
    });
    ajouter(MOBILE, (q) => q('.ac-verbe').forEach((el) => gsap.from(el, { opacity: 0, y: 18, duration: 0.6, scrollTrigger: { trigger: el, start: 'top 94%' } })));
  });

  return (
    <section ref={ref} className="scene" aria-labelledby="titre-action">
      <div className="cadre text-center">
        <p className="ac-chatbot titre-display titre-moyen text-[var(--texte-doux)]">Ce n'est pas un chatbot.</p>
        <h2 id="titre-action" className="ac-collab titre-display titre-grand mt-2">C'est un <span className="degrade">collaborateur.</span></h2>

        <ul className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {VERBES.map(([verbe, detail]) => (
            <li key={verbe} className="ac-verbe neon p-6 md:p-8">
              <p className="font-[Montserrat] font-extrabold uppercase tracking-[0.12em] text-2xl md:text-4xl text-white">{verbe}</p>
              <p className="mt-2 text-[0.85rem] text-[var(--texte-doux)]">{detail}</p>
            </li>
          ))}
        </ul>

        <ul className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-3" aria-label="Ses canaux de travail">
          {CANAUX.map(([icone, nom]) => (
            <li key={nom} className="ac-canal flex items-center gap-2 text-[0.78rem] text-[var(--texte-pale)]"><Icone nom={icone} taille={16} className="text-[var(--cyan)]" />{nom}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
