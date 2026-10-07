import { useEffect, useRef, useState } from 'react';
import donnees from 'virtual:accueil';
import { IntentInput, Bouton, Fleche, Icone, nombre, euros, LIENS, TELECHARGEMENT } from './composants.jsx';
import { suivre } from './analytique.js';
import { useScene, gsap } from './mouvement.js';
import Terre from './Terre.jsx';
import GlobalNav from './scenes/GlobalNav.jsx';
import Footer from './scenes/Footer.jsx';
import { euros as eurosTarif, BOX_DES, prixAgentEnUneLigne } from '../data/tarifs.js';

const EXEMPLES = [
  'Ouvrir une boulangerie bio avec livraison en ville',
  'Développer mon entreprise sur trois nouveaux marchés',
  "Trouver une assistante commerciale qui relance mes devis",
  'Trouver des financements pour mon projet',
];

// The team the idea becomes, on the right of the hero: real fiches of the
// catalogue, the ones « Créez votre entreprise » staffs a project with.
const EQUIPE_HERO = [
  { phase: 0, i: 0, icone: 'graphe' },
  { phase: 4, i: 2, icone: 'agenda' },
  { phase: 1, i: 0, icone: 'pieces' },
  { phase: 2, i: 0, icone: 'bouclier' },
  { phase: 3, i: 2, icone: 'equipe' },
];

/* ------------------------------------------------------------------------ */

function Hero() {
  const ref = useRef(null);
  const { compteurs, phases } = donnees;
  const equipe = EQUIPE_HERO.map((e) => ({ ...phases[e.phase].fiches[e.i], icone: e.icone }));

  useScene(ref, (ajouter, q) => {
    window.__accueilPret = true;
    document.documentElement.classList.remove('anime');
    ajouter('(prefers-reduced-motion: no-preference)', () => {
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from(q('.hx-titre .ligne'), { yPercent: 110, duration: 1.1, stagger: 0.12 })
        .from(q('[data-entree]'), { opacity: 0, y: 16, duration: 0.9, stagger: 0.08 }, '-=0.7')
        .from(q('.hx-terre'), { opacity: 0, duration: 2 }, 0)
        .from(q('.hx-idee'), { opacity: 0, x: -20, duration: 0.8 }, 0.5)
        .from(q('.hx-fil'), { strokeDashoffset: 300, duration: 1.2, stagger: 0.08, ease: 'power2.inOut' }, 0.9)
        .from(q('.hx-agent'), { opacity: 0, x: 16, duration: 0.7, stagger: 0.09 }, 1.1)
        .from(q('.hx-promesse'), { opacity: 0, y: 12, duration: 0.9 }, 1.5);
    });
  });

  return (
    <section ref={ref} id="commencer" className="hx" aria-labelledby="hx-titre">
      <Terre className="hx-terre" cx={0.5} cy={0.98} r={0.64} />
      <div className="hx-voile" aria-hidden="true" />
      <div className="mq-cadre hx-grille">
        <div className="hx-texte">
          <p className="mq-surtitre" data-entree>Vos idées. Une équipe d'agents. Des résultats réels.</p>
          <h1 id="hx-titre" className="hx-titre mq-display">
            <span className="block overflow-hidden"><span className="ligne block">Que voulez-vous</span></span>
            <span className="block overflow-hidden"><span className="ligne block mq-cyan">accomplir&nbsp;?</span></span>
          </h1>
          <p className="hx-chapeau" data-entree>Vous n'avez plus besoin de savoir comment utiliser l'IA.<br className="hidden md:block" /> Vous devez simplement savoir ce que vous voulez accomplir.</p>
          <div className="flex flex-wrap gap-3 mt-6" data-entree>
            <Bouton href="#idee" evenement="hero_start">Commencer maintenant</Bouton>
            <a href="#recrutement" className="bouton bouton-contour" onClick={() => suivre('hero_start', { depuis: 'demo' })}>
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z" fill="currentColor" /></svg>
              Voir comment ça marche
            </a>
          </div>
          {/* « 180 000+ » rounds down the 182 490 métier × activité postes that
              `npm run postes` counts (06/10/2026, PR #35); recount there, not here. */}
          <dl className="hx-chiffres" data-entree>
            <div><dt className="sr-only">Métiers</dt><dd><b>{nombre(compteurs.fiches)}</b><span>métiers</span></dd></div>
            <div><dt className="sr-only">Familles de métiers</dt><dd><b>{compteurs.secteurs}</b><span>familles de métiers</span></dd></div>
            <div><dt className="sr-only">Activités</dt><dd><b>{nombre(compteurs.activites)}</b><span>activités</span></dd></div>
            <div><dt className="sr-only">Postes possibles</dt><dd><b>180 000+</b><span>postes possibles</span></dd></div>
          </dl>
        </div>

        <div className="hx-schema" id="idee">
          <div className="hx-idee">
            <p className="hx-idee-titre">Dites-le simplement</p>
            <IntentInput id="idee-hero" exemples={EXEMPLES} cta="Lancer" />
          </div>
          <svg className="hx-fils" viewBox="0 0 200 400" preserveAspectRatio="none" aria-hidden="true">
            {[40, 120, 200, 280, 360].map((y, k) => (
              <path key={k} className="hx-fil" d={`M0 200 C 90 200, 90 ${y}, 200 ${y}`} strokeDasharray="300" />
            ))}
          </svg>
          <ul className="hx-equipe" aria-label="L'équipe que votre idée appelle">
            {equipe.map((a) => (
              <li key={a.id} className="hx-agent">
                <a href={a.url ?? LIENS.catalogue} onClick={() => suivre('catalog_click', { fiche: a.id })}>
                  <span className="hx-agent-icone"><Icone nom={a.icone} /></span>
                  <span className="min-w-0">
                    <b>{a.metier}</b>
                    <small>{a.secteur}</small>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="hx-promesse" aria-hidden="true">
          <p>Une idée<br />La bonne équipe<br />Des résultats.</p>
          <i />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

function JulieEtCatalogue() {
  const { personnes, vitrine, compteurs, prixAgent } = donnees;
  const julie = personnes[0];
  const rail = useRef(null);
  const defiler = (sens) => rail.current?.scrollBy({ left: sens * 260, behavior: 'smooth' });

  return (
    <section className="mq-bande mq-deux" aria-label="Rencontrez vos agents">
      <article className="jl">
        <div className="jl-portrait">
          <img src="/accueil/julie.webp" alt="Portrait de Julie, assistante commerciale" width="206" height="256" loading="lazy" />
        </div>
        <div className="jl-corps">
          <p className="mq-surtitre !mb-2">› Agent IA</p>
          <h2 className="jl-nom">Julie</h2>
          <p className="jl-poste">{julie.titre}</p>
          <ul className="jl-tags" aria-label="Ses missions">
            {julie.missions.slice(0, 2).map((m) => <li key={m} className="mq-tag">{m}</li>)}
            {julie.logiciels.slice(0, 3).map((l) => <li key={l} className="mq-tag">{l}</li>)}
          </ul>
          <p className="mq-statut">Disponible maintenant</p>
        </div>
        <div className="jl-droite">
          <blockquote className="jl-citation">
            <span aria-hidden="true">“</span>
            {julie.accroche}
            <svg className="jl-onde" width="40" height="16" viewBox="0 0 40 16" aria-hidden="true">
              {[3, 8, 13, 18, 23, 28, 33].map((x, i) => <rect key={x} className="onde" style={{ animationDelay: `${i * 0.12}s` }} x={x} y={2} width="2" height="12" rx="1" fill="currentColor" />)}
            </svg>
          </blockquote>
          <a href={julie.url ?? LIENS.catalogue} className="bouton bouton-braise mt-auto self-start" onClick={() => suivre('agent_recruitment_click', { fiche: julie.id })}>Recruter Julie <Fleche /></a>
        </div>
      </article>

      <div className="ct">
        <div className="ct-texte">
          <p className="mq-surtitre">{nombre(compteurs.fiches)} métiers, plus de 180 000 postes</p>
          <h2 className="mq-titre">Un métier,<br />votre expert</h2>
          <p className="mq-texte">Chaque métier se règle sur votre secteur et votre activité. Une assistante commerciale peut travailler dans le commerce international maritime, pour une imprimerie en Espagne ou pour une compagnie aérienne à Paris : vous ne prenez pas un agent tout fait, vous composez votre expert.</p>
          <Bouton href={LIENS.catalogue} variante="contour-cyan" evenement="catalog_click">Explorer le catalogue</Bouton>
        </div>
        <div className="ct-rail-cadre">
          <button type="button" className="ct-fleche ct-fleche-g" onClick={() => defiler(-1)} aria-label="Agents précédents">‹</button>
          <ul className="ct-rail" ref={rail}>
            {vitrine.map((f, i) => (
              <li key={f.id} className={`ct-carte ${i === 0 ? 'ct-carte-active' : ''}`}>
                <a href={f.url} onClick={() => suivre('catalog_click', { fiche: f.id })}>
                  <b>{f.metier}</b>
                  <span className="mq-tag mq-tag-petit">{f.secteur}</span>
                  <p>{f.accroche}</p>
                  <strong>{prixAgent ?? 'Sur devis'}{prixAgent && <small>/mois</small>}</strong>
                  <small>{f.taches} missions décrites</small>
                </a>
              </li>
            ))}
          </ul>
          <button type="button" className="ct-fleche ct-fleche-d" onClick={() => defiler(1)} aria-label="Agents suivants">›</button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

const ENTRETIEN = [
  { qui: 'Julie', texte: 'Bonjour. Parlez-moi de votre entreprise et de ce que vous attendez de moi.' },
  { qui: 'Vous', texte: 'Tu qualifieras mes prospects, tu prendras les rendez-vous et tu travailleras avec HubSpot.' },
  { qui: 'Julie', texte: 'Très bien. Quelles décisions puis-je prendre seule ?' },
];
const REGLAGES = [['visage', 'Son nom'], ['voix', 'Sa voix'], ['bulle', 'Sa personnalité'], ['outils', 'Ses outils'], ['cible', 'Ses missions'], ['cle', 'Son autonomie']];

const CANAUX = [
  ['email', 'E-mail'], ['web', 'Navigateur'], ['tel', 'Téléphone', true], ['bulle', 'WhatsApp', true],
  ['crm', 'CRM'], ['erp', 'ERP'], ['doc', 'Documents'], ['reseau', 'Réseaux sociaux'],
];
const ETAPES_MISSION = ['Recherche', 'Qualification', 'Enrichissement', 'Prise de contact', 'Relance', 'Rendez-vous'];

function RecrutementEtCollaborateur() {
  return (
    <section className="mq-bande mq-deux" id="recrutement" aria-label="Recruter un agent">
      <div className="rc">
        <div className="rc-texte">
          <h2 className="mq-titre">Ne programmez pas votre agent.<br /><span className="mq-cyan">Rencontrez-le.</span></h2>
          <p className="mq-texte">Un entretien. Pas un paramétrage. Discutez avec votre futur collaborateur, définissez ses missions, ses outils et son autonomie.</p>
          <a href={TELECHARGEMENT} className="bouton bouton-blanc" onClick={() => suivre('agent_recruitment_click', { depuis: 'entretien' })}>
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z" fill="currentColor" /></svg>
            Découvrir le recrutement
          </a>
        </div>
        <div className="rc-ecran">
          <div className="rc-julie">
            <img src="/accueil/julie.webp" alt="" width="206" height="256" loading="lazy" />
            <p><b>Julie</b><span>Assistante commerciale</span></p>
          </div>
          <div className="rc-chat">
            {ENTRETIEN.map((m, i) => (
              <div key={i} className={`rc-bulle ${m.qui === 'Vous' ? 'rc-bulle-vous' : ''}`}>
                <small>{m.qui}</small>{m.texte}
              </div>
            ))}
            <div className="rc-saisie" aria-hidden="true"><span>Écrivez votre réponse…</span><i>➤</i></div>
          </div>
        </div>
        <ul className="rc-reglages" aria-label="Ce que vous réglez à l'entretien">
          {REGLAGES.map(([icone, t]) => <li key={t}><Icone nom={icone} taille={18} />{t}</li>)}
        </ul>
      </div>

      <div className="cb">
        <div className="cb-texte">
          <h2 className="mq-titre">Ce n'est pas un chatbot.<br /><span className="mq-cyan">C'est un collaborateur.</span></h2>
          <p className="mq-texte">Il travaille dans son environnement numérique, avec les outils et les accès que vous lui confiez.</p>
          <ul className="cb-canaux" aria-label="Ses outils de travail">
            {CANAUX.map(([icone, t, bientot]) => (
              <li key={t} className={bientot ? 'cb-bientot' : ''}>
                <Icone nom={icone} taille={20} />
                <span>{t}</span>
                {bientot && <small>bientôt</small>}
              </li>
            ))}
          </ul>
        </div>
        <div className="cb-mission" role="img" aria-label="Exemple de mission en cours : trouver 50 prospects qualifiés, 78 %">
          <p className="cb-mission-titre">Trouver 50 prospects qualifiés</p>
          <div className="cb-barre"><i style={{ width: '78%' }} /><span>78 %</span></div>
          <ul>
            {ETAPES_MISSION.map((e, i) => <li key={e} className={i < 4 ? 'fait' : ''}><Icone nom="coche" taille={14} />{e}</li>)}
          </ul>
          <p className="cb-note">Exemple de mission. Ce qui engage l'entreprise attend votre accord.</p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

const POLES = [
  { nom: 'Stratégie', sous: 'Business plan', x: 50, y: 10 },
  { nom: 'Commercial', sous: 'Prospection', x: 82, y: 26 },
  { nom: 'Finance', sous: 'Levée de fonds', x: 86, y: 66 },
  { nom: 'Admin', sous: 'Conformité', x: 50, y: 88 },
  { nom: 'Marketing', sous: 'Lancement', x: 16, y: 70 },
  { nom: 'Analyse', sous: 'Marché', x: 18, y: 28 },
];

function DesktopCommander() {
  const { personnes } = donnees;
  const activite = personnes.slice(0, 5).map((p, i) => ({ ...p, quand: `il y a ${[2, 8, 12, 18, 25][i]} min`, quoi: ['Nouveau prospect qualifié', 'Rapport généré', 'Documents préparés', 'Campagne en cours', 'Vérification en cours'][i] }));
  return (
    <section className="mq-bande dc" id="desktop-commander" aria-labelledby="dc-titre">
      <div className="dc-texte">
        <p className="mq-surtitre dc-surtitre"><img src="/accueil/icone-desktop-commander.svg" alt="" width="40" height="40" className="dc-icone" />iAgent Desktop Commander</p>
        <h2 id="dc-titre" className="mq-titre">Orchestrez votre<br />équipe d'agents</h2>
        <p className="mq-texte">Une interface pour piloter vos agents, suivre leurs activités, collaborer et obtenir des résultats. Votre centre de commande, sur votre poste.</p>
        <a href={TELECHARGEMENT} className="bouton bouton-contour-cyan" onClick={() => suivre('desktop_commander_click')}>Découvrir Desktop Commander <Fleche /></a>
      </div>
      <div className="dc-app" role="img" aria-label="L'équipe autour de son chef d'équipe, et le fil de son activité">
        <div className="dc-menu" aria-hidden="true">
          <p className="dc-logo">iAgent</p>
          {['Centre', 'Mes agents', 'Tâches', 'Conversations', 'Documents', 'Résultats'].map((m, i) => <p key={m} className={i === 0 ? 'actif' : ''}>{m}</p>)}
        </div>
        <div className="dc-cercle" aria-hidden="true">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <circle cx="50" cy="50" r="38" className="dc-orbite" />
            {POLES.map((p) => <line key={p.nom} x1="50" y1="50" x2={p.x} y2={p.y} className="dc-rayon" />)}
          </svg>
          <div className="dc-centre"><small>Équipe</small><b>Victor</b></div>
          {POLES.map((p) => (
            <div key={p.nom} className="dc-pole" style={{ left: `${p.x}%`, top: `${p.y}%` }}><b>{p.nom}</b><small>{p.sous}</small></div>
          ))}
        </div>
        <div className="dc-fil" aria-hidden="true">
          <p className="dc-fil-titre">Activité en temps réel</p>
          {activite.map((a) => (
            <div key={a.prenom} className="dc-ligne">
              <img src={`/accueil/${a.portrait}.webp`} alt="" width="28" height="28" loading="lazy" />
              <p><b>{a.prenom}</b><small>{a.quoi}</small></p>
              <time>{a.quand}</time>
            </div>
          ))}
        </div>
      </div>
      <div className="dc-photo">
        <img src="/accueil/desktop-centre.webp" alt="Capture de l'application iAgent, avec des données d'exemple" width="1440" height="900" loading="lazy" />
        <p>Vos objectifs.<br />Une équipe.<br />Une exécution sans limites.</p>
        <i />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

const ATOUTS_BOX = [['cadenas', 'Exécution locale et sécurisée'], ['eclair', 'Haute performance'], ['bouclier', 'Confidentialité de vos données'], ['ecran', "Prête à l'emploi"]];
const ETAPES_ENTREPRISE = [
  ['ampoule', 'Votre idée', 'Décrivez votre projet en langage naturel'],
  ['equipe', "L'équipe", 'Nous sélectionnons les bons agents'],
  ['rouage', 'La configuration', 'Vos agents se mettent en place'],
  ['fusee', 'Le lancement', 'Votre entreprise prend vie'],
];

function BoxEtEntreprise() {
  return (
    <section className="mq-bande mq-deux" aria-label="iAgent Box et Créez votre entreprise">
      <div className="bx" id="box">
        <div className="bx-texte">
          <p className="mq-surtitre">iAgent Box</p>
          <h2 className="mq-titre">Votre équipe IA,<br />installée chez vous</h2>
          <p className="mq-texte">Un poste tactile préparé pour vos agents, avec la voix et Desktop Commander. Le matériel est mis à disposition sous abonnement, à partir de {eurosTarif(BOX_DES.mensuel)} par mois.</p>
          <a href="/box" className="bouton bouton-contour-cyan" onClick={() => suivre('box_click')}>Découvrir iAgent Box <Fleche /></a>
        </div>
        <ul className="bx-atouts">
          {ATOUTS_BOX.map(([i, t]) => <li key={t}><span><Icone nom={i} taille={16} /></span>{t}</li>)}
        </ul>
        <div className="bx-objet" aria-hidden="true">
          <svg viewBox="0 0 320 200">
            <defs>
              <linearGradient id="bx-dessus" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1a2236" /><stop offset="1" stopColor="#070b14" /></linearGradient>
              <linearGradient id="bx-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0c1220" /><stop offset="1" stopColor="#03060c" /></linearGradient>
              <filter id="bx-flou"><feGaussianBlur stdDeviation="6" /></filter>
            </defs>
            <ellipse cx="160" cy="176" rx="130" ry="14" fill="#03f3ff" opacity="0.18" filter="url(#bx-flou)" />
            <path d="M40 92 L160 52 L290 92 L170 136 Z" fill="url(#bx-dessus)" stroke="#2a3a55" />
            <path d="M40 92 L170 136 L170 172 L40 128 Z" fill="url(#bx-face)" stroke="#1d2a40" />
            <path d="M170 136 L290 92 L290 128 L170 172 Z" fill="#05080f" stroke="#1d2a40" />
            <path d="M40 128 L170 172 L290 128" stroke="#03f3ff" strokeWidth="1.6" fill="none" opacity="0.9" />
            <path d="M40 92 L170 136 L290 92" stroke="#03f3ff" strokeWidth="1" fill="none" opacity="0.35" />
          </svg>
        </div>
      </div>

      <div className="ce">
        <p className="mq-surtitre">Créez votre entreprise</p>
        <h2 className="mq-titre">De l'idée au marché,<br />avec votre équipe d'agents</h2>
        <p className="mq-texte">Décrivez votre projet : iAgent construit l'équipe, configure les agents et vous accompagne de la première étape au lancement.</p>
        <ol className="ce-etapes">
          {ETAPES_ENTREPRISE.map(([i, t, s], k) => (
            <li key={t} className={k === 3 ? 'ce-final' : ''}><span><Icone nom={i} taille={24} /></span><b>{t}</b><small>{s}</small></li>
          ))}
        </ol>
        <Bouton href={LIENS.entreprise} variante="contour-cyan" evenement="create_company_click">Créer mon entreprise</Bouton>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

function MetiersEtLogiciels() {
  const { famillesLogiciels, compteurs, metierDansTroisMondes: m } = donnees;
  return (
    <section className="mq-bande mq-deux" aria-label="Votre métier et vos logiciels">
      <div className="ml">
        <p className="mq-surtitre">Il connaît votre métier</p>
        <h2 className="mq-titre">Un même métier,<br />{m.activites.length} mondes différents</h2>
        <p className="mq-texte">Le {m.metier.metier.toLowerCase()} ne parle pas de la même façon dans chaque activité. Chaque pack ajoute le vocabulaire et les logiciels de la branche.</p>
        <ul className="ml-mondes">
          {m.activites.map((a) => (
            <li key={a.nom}>
              <a href={a.url}>
                <b>{a.nom}</b>
                <span>{a.vocabulaire.join(' · ')}</span>
                <small>{a.logiciels.join(', ')}</small>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="lg">
        <p className="mq-surtitre">Il connaît vos logiciels</p>
        <h2 className="mq-titre">{nombre(compteurs.logiciels)} logiciels,<br />{compteurs.categoriesLogiciels} familles</h2>
        <ul className="lg-familles">
          {famillesLogiciels.map((f) => (
            <li key={f.nom}>
              <p><b>{f.nom}</b><small>{f.nombre}</small></p>
              <span>{f.exemples.map((e, i) => <a key={e.nom} href={e.url}>{e.nom}{i < f.exemples.length - 1 ? ', ' : ''}</a>)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

const MODES = [
  ['serveur', 'Local', 'Vos agents travaillent sur votre machine. Rien ne quitte vos bureaux, aucun jeton facturé.'],
  ['hybride', 'Hybride', "Le quotidien en local, l'API seulement pour ce que la machine ne porte pas. Vous êtes prévenu avant."],
  ['nuage', 'Cloud', "Sans matériel : vos agents passent par l'API, avec votre propre clé, rangée sur votre poste."],
];
const GARDE_FOUS = ['Chaque agent n’ouvre que ce que vous lui confiez.', 'Vous décidez des tâches qui attendent votre accord.', 'Rien ne part par courriel sans que le texte exact ait été relu.', 'Chaque action et chaque envoi sont consignés.'];

function Confiance() {
  return (
    <section className="mq-bande mq-deux" id="confiance" aria-label="Confiance et infrastructure">
      <div className="cf">
        <p className="mq-surtitre">Confiance &amp; infrastructure</p>
        <h2 className="mq-titre">Vos données.<br />Vos règles.</h2>
        <ul className="cf-modes">
          {MODES.map(([i, t, s]) => <li key={t}><span><Icone nom={i} taille={26} /></span><b>{t}</b><small>{s}</small></li>)}
        </ul>
      </div>
      <div className="cf2">
        <p className="mq-surtitre">Autonome ne signifie pas incontrôlé</p>
        <ul className="cf-garde">
          {GARDE_FOUS.map((g) => <li key={g}><Icone nom="coche" taille={16} />{g}</li>)}
        </ul>
        <div className="cf-prix">
          <p><b>{prixAgentEnUneLigne()}</b><small>l'abonnement d'un agent</small></p>
          <p><b>{eurosTarif(BOX_DES.mensuel)} / mois</b><small>la Box, à part</small></p>
          <p><b>Au réel</b><small>la consommation d'IA, à part</small></p>
        </div>
        <a href="/pricing" className="bouton bouton-lien">Voir les tarifs <Fleche /></a>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

// max's site plan (07/10, §4): after the demonstration, the model in one line.
const MODELE = [
  ['equipe', 'Un collaborateur', 'Un métier, réglé sur votre secteur et votre activité.', LIENS.catalogue],
  ['ecran', 'Un poste de travail', 'La Box, installée chez vous : écran tactile, voix, micro.', '/box'],
  ['graphe', 'Un Commander', 'Pour diriger l’équipe, autoriser et suivre son travail.', '#desktop-commander'],
];

function Modele() {
  return (
    <section className="mq-bande md" aria-labelledby="md-titre">
      <p className="mq-surtitre">iAgent Workforce</p>
      <h2 id="md-titre" className="mq-titre">Un collaborateur, son poste de travail, et de quoi le diriger</h2>
      <ul className="md-pieces">
        {MODELE.map(([i, t, s, h]) => <li key={t}><a href={h}><span><Icone nom={i} taille={22} /></span><b>{t}</b><small>{s}</small></a></li>)}
      </ul>
      <a href="/workforce" className="bouton bouton-lien">Comprendre l'offre complète <Fleche /></a>
    </section>
  );
}

function EvolutionEtPreuve() {
  return (
    <section className="mq-bande mq-deux" aria-label="Des agents qui évoluent, et notre propre entreprise">
      <div>
        <p className="mq-surtitre">Des agents qui évoluent</p>
        <h2 className="mq-titre">Vous ne louez pas un logiciel figé</h2>
        <p className="mq-texte">Vous employez une compétence qui continue d'évoluer : maintenance, mises à jour, nouvelles méthodes et nouveaux connecteurs sont compris dans l'abonnement.</p>
        <a href="/skills" className="bouton bouton-lien">Comment les agents évoluent <Fleche /></a>
      </div>
      <div>
        <p className="mq-surtitre">iAgent inside iAgent</p>
        <h2 className="mq-titre">La première entreprise que nous faisons fonctionner avec iAgent est la nôtre</h2>
        <p className="mq-texte">Une direction humaine, un chef d'équipe et nos pôles tenus par des agents.</p>
        <a href="/iagent-inside-iagent" className="bouton bouton-lien">Voir notre organisation <Fleche /></a>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

function Final() {
  return (
    <section className="fn" aria-labelledby="fn-titre">
      <Terre className="fn-terre" cx={0.5} cy={2.1} r={1.5} />
      <div className="mq-cadre fn-ligne">
        <div>
          <p className="mq-surtitre">Des idées aujourd'hui. Des entreprises demain.</p>
          <h2 id="fn-titre" className="mq-display fn-titre">Alors, que voulez-vous <span className="mq-cyan">accomplir&nbsp;?</span></h2>
          <p className="mq-texte !mb-0">Rejoignez une nouvelle génération d'entreprises augmentées par des équipes d'agents IA.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Bouton href={LIENS.catalogue} evenement="final_cta_click">Explorer les agents</Bouton>
          <Bouton href={LIENS.entreprise} variante="contour-cyan" evenement="create_company_click">Composer mon équipe</Bouton>
          <Bouton href="/box" variante="contour-cyan" evenement="box_click">Découvrir la Box</Bouton>
          <a href="/enterprise" className="bouton bouton-contour" onClick={() => suivre('enterprise_click')}>Parler à iAgent Enterprise</a>
        </div>
      </div>
    </section>
  );
}

/** The home page, laid out as max's mockup: dense bands, one idea each. */
export default function Accueil() {
  const [pret, setPret] = useState(false);
  useEffect(() => setPret(true), []);
  return (
    <div className={`mq ${pret ? 'mq-pret' : ''}`}>
      <a href="#contenu" className="saut">Aller au contenu</a>
      <GlobalNav />
      <main id="contenu">
        <Hero />
        <JulieEtCatalogue />
        <RecrutementEtCollaborateur />
        <Modele />
        <DesktopCommander />
        <BoxEtEntreprise />
        <MetiersEtLogiciels />
        <Confiance />
        <EvolutionEtPreuve />
        <Final />
      </main>
      <Footer />
    </div>
  );
}
