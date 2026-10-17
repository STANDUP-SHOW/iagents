import { useRef } from 'react';
import donnees from 'virtual:accueil';
import { Bouton } from '../composants.jsx';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';

const CONVERSATION = [
  { qui: 'Julie', texte: 'Bonjour. Parlez-moi de votre entreprise et de ce que vous attendez de moi.' },
  { qui: 'Vous', texte: 'Tu qualifieras mes prospects, tu prendras les rendez-vous et tu travailleras dans HubSpot.' },
  { qui: 'Julie', texte: 'Très bien. Quelles décisions puis-je prendre seule ?' },
];

const ONDE = [6, 12, 18, 9, 15, 22, 11, 7, 14, 20, 10, 5, 13, 18, 8, 16, 21, 9, 6, 12];

/** Scene 04 — you don't program an agent, you meet her. */
export default function ConversationalRecruitment() {
  const ref = useRef(null);
  const julie = donnees.personnes.find((p) => p.prenom === 'Julie');
  // Placed around the portrait on a large screen, listed under it on a phone.
  const TRAITS = [
    ['Sa voix', 'choisie à l’entretien', 'left-[-6%] top-[12%]'],
    ['Sa personnalité', 'précise, chaleureuse', 'right-[-4%] top-[20%]'],
    ['Ses outils', 'HubSpot CRM, e-mail, agenda', 'left-[-10%] top-[52%]'],
    ['Ses missions', julie.missions[0], 'right-[-8%] top-[58%]'],
    ['Son autonomie', 'seule, sauf ce que vous contrôlez', 'left-[4%] bottom-[6%]'],
  ];

  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      gsap.timeline({ defaults: { ease: 'power3.out' }, scrollTrigger: { trigger: ref.current, start: 'top 60%' } })
        .from(q('.rc-portrait'), { opacity: 0, x: 60, duration: 1.2 })
        .from(q('.rc-titre .ligne'), { yPercent: 105, stagger: 0.14, duration: 0.9 }, 0.1)
        .from(q('.rc-replique'), { opacity: 0, y: 18, stagger: 0.5, duration: 0.6 }, 0.7)
        .from(q('.rc-trait'), { opacity: 0, scale: 0.9, stagger: 0.2, duration: 0.6 }, 1.2)
        .from(q('.rc-conclusion'), { opacity: 0, y: 20, duration: 0.7 }, '-=0.2');
    });
    ajouter(MOBILE, (q) => {
      q('.rc-replique, .rc-trait, .rc-conclusion').forEach((el) => gsap.from(el, { opacity: 0, y: 20, duration: 0.7, scrollTrigger: { trigger: el, start: 'top 90%' } }));
    });
  });

  return (
    <section ref={ref} className="scene overflow-hidden" aria-labelledby="titre-recrutement">
      <div className="cadre grid lg:grid-cols-[1fr_1.05fr] gap-10 lg:gap-6 items-center">
        <div className="relative z-10">
          <p className="surtitre">Recrutement conversationnel</p>
          <h2 id="titre-recrutement" className="rc-titre titre-display mt-4 text-[clamp(2.2rem,4.6vw,4.6rem)]">
            <span className="block overflow-hidden"><span className="ligne block">Ne programmez pas</span></span>
            <span className="block overflow-hidden"><span className="ligne block">votre agent.</span></span>
            <span className="block overflow-hidden pb-[0.12em]"><span className="ligne block degrade">Rencontrez-le.</span></span>
          </h2>

          <div className="mt-8 neon p-5 md:p-6 flex flex-col gap-3.5 max-w-xl" aria-label="Extrait d'entretien d'embauche">
            <div className="flex items-center justify-between gap-3">
              <p className="marge !border-0 !pl-0 !text-[0.6rem]">Entretien d'embauche · à l'oral</p>
              <div className="flex items-end gap-[3px] h-5" aria-hidden="true">
                {ONDE.map((h, i) => <span key={i} className="onde w-[3px] rounded-full bg-[var(--cyan)]" style={{ height: h, animationDelay: `${i * 80}ms` }} />)}
              </div>
            </div>
            {CONVERSATION.map((m, i) => (
              <div key={i} className={`rc-replique bulle ${m.qui === 'Vous' ? 'bulle-humain' : 'bulle-agent'}`}>
                <p className="bulle-qui">{m.qui}</p>
                <p>{m.texte}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <figure className="rc-portrait incarne relative mx-auto aspect-[4/4.6] w-full max-w-[560px]">
            <img src="/accueil/julie-grand.webp" alt={`Julie, ${julie.titre}`} width="640" height="640" loading="lazy" decoding="async" className="object-[50%_25%]" />
            <figcaption className="absolute inset-x-0 bottom-[14%] text-center">
              <span className="block font-[Montserrat] font-extrabold text-3xl text-white">Julie</span>
              <span className="block text-sm text-[var(--cyan)]">{julie.titre}</span>
            </figcaption>
          </figure>
          <dl className="mt-6 lg:mt-0 grid grid-cols-2 gap-2.5 lg:block">
            {TRAITS.map(([cle, val, place]) => (
              <div key={cle} className={`rc-trait neon neon-calme respire px-3.5 py-2.5 lg:absolute lg:max-w-[14rem] ${place}`}>
                <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[var(--cyan)]">{cle}</dt>
                <dd className="text-[0.84rem] text-white leading-snug mt-0.5">{val}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="rc-conclusion cadre mt-14 flex flex-col items-center text-center gap-6">
        <p className="titre-display titre-moyen">Un entretien. Pas un paramétrage.<br /><span className="degrade">Bienvenue dans l'équipe, Julie.</span></p>
        <Bouton href={julie.url} evenement="agent_recruitment_click">Rencontrer Julie</Bouton>
      </div>
    </section>
  );
}
