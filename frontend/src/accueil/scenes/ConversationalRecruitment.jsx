import { useRef } from 'react';
import donnees from 'virtual:accueil';
import { Bouton } from '../composants.jsx';
import { useScene, BUREAU, MOBILE, gsap } from '../mouvement.js';

const CONVERSATION = [
  { qui: 'Julie', texte: 'Bonjour. Parlez-moi de votre entreprise et de ce que vous attendez de moi.' },
  { qui: 'Vous', texte: 'Tu qualifieras mes prospects, tu prendras les rendez-vous et tu travailleras avec HubSpot et WhatsApp.' },
  { qui: 'Julie', texte: 'Très bien. Quelles décisions puis-je prendre seule ?' },
];

/** Scene 05 — you don't program an agent, you meet her. */
export default function ConversationalRecruitment() {
  const ref = useRef(null);
  const julie = donnees.personnes.find((p) => p.prenom === 'Julie');
  const PROFIL = [
    ['Son nom', julie.prenom],
    ['Sa voix', 'Choisie avec vous, à l’entretien'],
    ['Sa personnalité', 'Précise, chaleureuse, discrète'],
    ['Ses outils', 'HubSpot CRM, WhatsApp, e-mail, agenda'],
    ['Ses missions', julie.missions.join(', ')],
    ['Son autonomie', 'Seule, sauf ce que vous mettez sous contrôle'],
  ];

  useScene(ref, (ajouter) => {
    ajouter(BUREAU, (q) => {
      gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        scrollTrigger: { trigger: q('.rc-scene')[0], start: 'top top', end: '+=260%', scrub: 1, pin: true, anticipatePin: 1 },
      })
        .from(q('.rc-titre-1'), { opacity: 0, y: 40, duration: 0.6 })
        .fromTo(q('.rc-rature'), { scaleX: 0 }, { scaleX: 1, duration: 0.5 })
        .to(q('.rc-programmez'), { opacity: 0.25, duration: 0.4 }, '<0.2')
        .from(q('.rc-rencontrez'), { opacity: 0, y: 30, filter: 'blur(8px)', duration: 0.7 })
        .from(q('.rc-julie'), { opacity: 0, x: -60, duration: 0.8 }, '<')
        .from(q('.rc-bulle'), { opacity: 0, y: 24, stagger: 0.55, duration: 0.5 })
        .from(q('.rc-trait'), { opacity: 0, x: 24, stagger: 0.18, duration: 0.4 })
        .from(q('.rc-conclusion'), { opacity: 0, y: 24, duration: 0.6 })
        .to({}, { duration: 0.4 });
    });
    ajouter(MOBILE, (q) => {
      q('.rc-bulle, .rc-trait, .rc-conclusion').forEach((el) => gsap.from(el, { opacity: 0, y: 20, duration: 0.7, scrollTrigger: { trigger: el, start: 'top 90%' } }));
    });
  });

  return (
    <section ref={ref} aria-labelledby="titre-recrutement">
      <div className="rc-scene scene epingle">
        <div className="cadre w-full">
          <h2 id="titre-recrutement" className="titre-display titre-moyen max-w-3xl">
            <span className="rc-titre-1 block">Ne <span className="relative inline-block"><span className="rc-programmez">programmez</span><span className="rc-rature absolute left-0 right-0 top-[54%] h-[3px] bg-[var(--corail)] origin-left" aria-hidden="true" /></span> pas votre agent.</span>
            <span className="rc-rencontrez block lumiere">Rencontrez-le.</span>
          </h2>

          <div className="mt-10 grid lg:grid-cols-[0.8fr_1.25fr_0.9fr] gap-5 items-stretch">
            <figure className="rc-julie verre overflow-hidden flex flex-col">
              <div className="portrait !rounded-none aspect-[4/4.2] lg:aspect-auto lg:flex-1 min-h-[260px]">
                <img src="/accueil/julie.webp" alt="Julie, assistante commerciale" width="206" height="256" loading="lazy" decoding="async" className="object-[50%_20%]" />
              </div>
              <figcaption className="p-5 -mt-16 relative z-10">
                <p className="font-[Montserrat] text-2xl font-semibold">Julie</p>
                <p className="text-sm text-[var(--cyan)]">{julie.titre}</p>
                <div className="mt-3 flex items-end gap-[3px] h-5" aria-hidden="true">
                  {[6, 12, 18, 9, 15, 20, 11, 7, 14, 19, 10, 5].map((h, i) => (
                    <span key={i} className="onde w-[3px] rounded-full bg-[var(--cyan)]" style={{ height: h, animationDelay: `${i * 90}ms` }} />
                  ))}
                </div>
              </figcaption>
            </figure>

            <div className="verre p-4 md:p-6 flex flex-col gap-4" aria-label="Extrait d'entretien d'embauche">
              <p className="note">Entretien d'embauche, à l'oral ou par écrit</p>
              {CONVERSATION.map((m, i) => (
                <div key={i} className={`rc-bulle bulle ${m.qui === 'Vous' ? 'bulle-humain' : 'bulle-agent'}`}>
                  <p className="bulle-qui">{m.qui}</p>
                  <p>{m.texte}</p>
                </div>
              ))}
            </div>

            <dl className="verre p-5 md:p-6 flex flex-col gap-3.5">
              {PROFIL.map(([cle, val]) => (
                <div key={cle} className="rc-trait flex gap-3">
                  <span className="mt-1.5 w-4 h-4 rounded-full border border-[var(--cyan)] flex-none flex items-center justify-center" aria-hidden="true"><span className="w-1.5 h-1.5 rounded-full bg-[var(--cyan)]" /></span>
                  <div>
                    <dt className="text-sm font-semibold text-white">{cle}</dt>
                    <dd className="text-[0.85rem] text-[var(--texte-doux)] leading-snug">{val}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          <div className="rc-conclusion mt-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <p className="titre-display titre-petit">Un entretien. Pas un paramétrage.<br /><span className="corail">Bienvenue dans l'équipe, Julie.</span></p>
            <Bouton href={julie.url} evenement="agent_recruitment_click">Découvrir le recrutement conversationnel</Bouton>
          </div>
          <p className="note mt-4">Julie tient la fiche « {julie.metier} » du catalogue. WhatsApp arrive avec le relais de messagerie en préparation ; HubSpot fait partie des connexions ouvertes.</p>
        </div>
      </div>
    </section>
  );
}
