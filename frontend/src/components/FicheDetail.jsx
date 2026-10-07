import '../fiche/fiche.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { devisAgent, euros, installationDe, ficheDe, LOCATION_BOX } from '../data/offres.js';
import { FINANCEMENT } from '../../../dimensionnement/offre-box.ts';
import { economieDe, tachesAReliretConseillees } from '../data/loader.js';
import { libelleSecteur, libelleFamille, nomDuLogiciel, portraitDe } from '../data/recherche.js';
import { PRIX_AGENT_MOIS, NOTE_ACHAT, prixAgentCourt } from '../data/prix.js';
import { TELECHARGEMENT } from '../accueil/composants.jsx';
import logicielsJson from '../../../catalogue/logiciels.json';

/**
 * The fiche's five sections, named once: the bench renders the fiche with each
 * of them as `ongletInitial`. Every section is always rendered (the page is one
 * long dossier); the id only says where the view opens.
 */
export const ONGLETS = ['profil', 'missions', 'competences', 'capacite', 'recrutement'];

const SECTIONS = {
  profil: { n: '01', libelle: 'Profil' },
  missions: { n: '02', libelle: 'Missions' },
  competences: { n: '03', libelle: 'Compétences & outils' },
  capacite: { n: '04', libelle: 'Capacité & autonomie' },
  recrutement: { n: '05', libelle: 'Recrutement' },
};

// The tab ids the fiche had before the redesign, still accepted so a caller
// (or the bench) asking for « economie » lands on the matching section.
const ANCIENS = { overview: 'profil', taches: 'missions', connecteurs: 'competences', economie: 'recrutement' };
const sectionDe = (id) => (SECTIONS[id] ? id : ANCIENS[id] ?? 'profil');

const CATEGORIE = new Map(logicielsJson.logiciels.map((l) => [l.id, l.categorie]));
const CATEGORIES = {
  erp: 'ERP', crm: 'CRM', sirh: 'SIRH', ats: 'Recrutement', bi: 'Analyse', cms: 'Site web',
  comptabilite: 'Comptabilité', paie: 'Paie', bureautique: 'Bureautique', facturation: 'Facturation',
  ecommerce: 'E-commerce', marketing: 'Marketing', publicite: 'Publicité', caisse: 'Caisse',
  'gestion-projet': 'Gestion de projet', 'support-client': 'Support client', ged: 'Documents',
  juridique: 'Juridique', achats: 'Achats', transport: 'Transport', prospection: 'Prospection',
};
const libelleCategorie = (id) => {
  const c = CATEGORIE.get(id);
  if (!c) return null;
  return CATEGORIES[c] ?? (c.charAt(0).toUpperCase() + c.slice(1)).replace(/-/g, ' ');
};

// The eight words a fiche uses for its needs (outils/capacites.ts). WhatsApp
// and the telephone have no code in the app yet: they are announced as coming,
// never as working.
const CANAUX = {
  voix: { libelle: 'Voix', detail: 'Vous lui parlez, il vous répond' },
  conversation: { libelle: 'Conversation', detail: 'Échanges écrits dans l\'application' },
  email: { libelle: 'E-mail', detail: 'Brouillons relus avant tout envoi' },
  whatsapp: { libelle: 'WhatsApp', detail: 'Arrive progressivement', bientot: true },
  calendrier: { libelle: 'Agenda', detail: 'Lit et prépare les rendez-vous' },
  fichiers: { libelle: 'Fichiers', detail: 'Dans les dossiers que vous lui ouvrez' },
  navigateur: { libelle: 'Navigateur', detail: 'Avec vos sessions, vous validez' },
  telephone: { libelle: 'Téléphone', detail: 'Arrive progressivement', bientot: true },
};

// Missions are grouped by rhythm: it is the one grouping every fiche carries
// (output folders are one per task, so they would make one group per task).
const RYTHMES = [
  { id: 'continu', types: ['intervalle', 'declencheur'], titre: 'Au fil de l\'eau', sous: 'Il surveille et traite dès que quelque chose arrive.' },
  { id: 'jour', types: ['quotidienne'], titre: 'Chaque jour', sous: 'Le travail de routine, sans que vous ayez à le demander.' },
  { id: 'semaine', types: ['hebdomadaire'], titre: 'Chaque semaine', sous: 'Les points et bilans qui reviennent à date fixe.' },
  { id: 'mois', types: ['mensuelle'], titre: 'Chaque mois', sous: 'Les clôtures, synthèses et échéances du mois.' },
  { id: 'demande', types: ['a-la-demande'], titre: 'À votre demande', sous: 'Ce que vous lui confiez de vive voix ou par écrit.' },
];
const rythmeDe = (t) => RYTHMES.find((r) => r.types.includes(t.planification?.type)) ?? RYTHMES[4];

const EVENEMENTS = {
  'email.recu': 'à chaque e-mail reçu',
  'fichier.depose': 'à chaque fichier déposé',
  'appel.recu': 'à chaque appel reçu',
  'calendrier.evenement': 'à chaque événement d\'agenda',
  'whatsapp.recu': 'à chaque message WhatsApp',
};
function quand(p = {}) {
  switch (p.type) {
    case 'intervalle': return p.minutes >= 60 && p.minutes % 60 === 0 ? `toutes les ${p.minutes / 60} h` : `toutes les ${p.minutes} min`;
    case 'declencheur': return EVENEMENTS[p.evenement] ?? 'dès qu\'un élément arrive';
    case 'quotidienne': return p.heure ? `chaque jour à ${p.heure.replace(':', ' h ')}` : 'chaque jour';
    case 'hebdomadaire': return `le ${p.jour ?? 'lundi'}${p.heure ? ` à ${p.heure.replace(':', ' h ')}` : ''}`;
    case 'mensuelle': return `le ${p.jour === 1 ? '1er' : p.jour} du mois${p.heure ? ` à ${p.heure.replace(':', ' h ')}` : ''}`;
    default: return 'quand vous le demandez';
  }
}

const FORMATS = {
  xlsx: 'Classeurs Excel', md: 'Notes et comptes rendus', pdf: 'Documents PDF', docx: 'Documents Word',
  csv: 'Tableaux CSV', eml: 'Brouillons d\'e-mail', json: 'Données structurées', txt: 'Textes simples',
  html: 'Pages HTML', png: 'Images', jpg: 'Images', mp4: 'Vidéos', wav: 'Sons', mp3: 'Sons',
};

// « Secrétaire administratif » → « secrétaire administratif », but « UX designer » stays.
const enMinuscule = (nom) => (/^[A-ZÀ-Ý][a-zà-ÿ]/.test(nom) ? nom.charAt(0).toLowerCase() + nom.slice(1) : nom);
const nombre = (n) => Number(n).toLocaleString('fr-FR').replace(/\u202f/g, '\u00a0');

// « Matin : relève… Après-midi : … » becomes a small timeline; other sentences stay plain.
function journee(texte) {
  if (!texte) return [];
  return texte.split(/(?<=\.)\s+(?=[A-ZÀ-Ý])/).map((phrase) => {
    const m = phrase.match(/^([^:.]{2,28})\s:\s(.+)$/);
    return m ? { moment: m[1], texte: m[2] } : { moment: null, texte: phrase };
  });
}

// A two-letter monogram for a software badge, the same colour every time.
const monogramme = (nom) => {
  const mots = nom.replace(/[^A-Za-z0-9À-ÿ ]/g, ' ').split(/\s+/).filter(Boolean);
  return (mots.length > 1 ? mots[0][0] + mots[1][0] : nom.slice(0, 2)).toUpperCase();
};
const teinte = (nom) => [186, 200, 214, 228, 262][[...nom].reduce((s, c) => s + c.charCodeAt(0), 0) % 5];

/* ---- icons ----------------------------------------------------------- */

const Svg = ({ children, taille = 18 }) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="flex-none">{children}</svg>
);
const ICONES = {
  voix: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  conversation: <path d="M4 5h16v11H9l-5 4z" />,
  email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  whatsapp: <><path d="M4 20l1.4-4A8 8 0 1 1 8 18.6z" /><path d="M9 9.5c.5 2 2.5 4 4.5 4.5l1-1 2 1" /></>,
  calendrier: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  fichiers: <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  navigateur: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" /></>,
  telephone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  nom: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  personnalite: <><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01" /></>,
  logiciels: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  missions: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></>,
  objectifs: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  autonomie: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  canaux: <><path d="M4 12h3l3-7 4 14 3-7h3" /></>,
  bouclier: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 9l6 6M15 9l-6 6" /></>,
  fleche: <path d="M5 12h14M13 6l6 6-6 6" />,
  fermer: <path d="M6 6l12 12M18 6L6 18" />,
  coche: <path d="M5 12l5 5 9-10" />,
};
const Icone = ({ nom, taille }) => <Svg taille={taille}>{ICONES[nom] ?? ICONES.coche}</Svg>;

const PERSONNALISATION = [
  ['nom', 'Nom', 'Vous lui donnez son prénom.'],
  ['voix', 'Voix', 'Vous choisissez la voix qui vous parle.'],
  ['personnalite', 'Personnalité', 'Plus direct, plus formel : vous le dites.'],
  ['logiciels', 'Logiciels', 'Il vous demande ce que tourne l\'entreprise.'],
  ['missions', 'Missions', 'Vous gardez, éteignez ou ajoutez des tâches.'],
  ['objectifs', 'Objectifs', 'Horaires, intensité, priorités.'],
  ['autonomie', 'Autonomie', 'Vous choisissez ce qui passe par vous.'],
  ['canaux', 'Canaux', 'Les comptes et dossiers que vous lui ouvrez.'],
];

/* ---- the fiche --------------------------------------------------------- */

// Declared outside the fiche so a scroll (which changes the active section)
// never remounts the sections.
function Section({ id, agentId, inscrire, titre, chapeau, children }) {
  return (
    <section id={`fd-${id}`} data-section={id} ref={(n) => inscrire(id, n)} className="fd-section" aria-labelledby={`fd-${id}-titre`}>
      <p className="fd-section-num"><span>{SECTIONS[id].n}</span>{SECTIONS[id].libelle} · {agentId}</p>
      <h2 id={`fd-${id}-titre`} className="fd-h2">{titre}</h2>
      {chapeau && <p className="fd-chapeau">{chapeau}</p>}
      {children}
    </section>
  );
}

// `ongletInitial` says which section the view opens on. The bench renders the
// fiche once per section; every section is in the HTML whatever the value.
export default function FicheDetail({ agent, onClose, ongletInitial = 'profil', installation = null }) {
  const depart = sectionDe(ongletInitial);
  const [actif, setActif] = useState(depart);
  const defile = useRef(null);
  const fermer = useRef(null);
  const sections = useRef({});
  const inscrire = useCallback((id, n) => { sections.current[id] = n; }, []);

  const aller = useCallback((id, doux = true) => {
    const zone = defile.current;
    const cible = sections.current[id];
    if (!zone || !cible) return;
    const calme = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const nav = zone.querySelector('.fd-nav');
    const haut = cible.getBoundingClientRect().top - zone.getBoundingClientRect().top + zone.scrollTop - (nav?.offsetHeight ?? 0) - 12;
    zone.scrollTo({ top: Math.max(0, haut), behavior: doux && !calme ? 'smooth' : 'auto' });
    setActif(id);
  }, []);

  // Open on the asked section, take the focus, lock the page behind, close on Escape.
  useEffect(() => {
    if (!agent) return undefined;
    fermer.current?.focus({ preventScroll: true });
    if (depart !== 'profil') aller(depart, false);
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const echap = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', echap);
    return () => { window.removeEventListener('keydown', echap); document.body.style.overflow = avant; };
  }, [agent?.id]);

  // The section in view lights its tab and the matching part of the poster.
  useEffect(() => {
    const zone = defile.current;
    if (!zone || typeof IntersectionObserver === 'undefined') return undefined;
    const vus = new Map();
    const obs = new IntersectionObserver((entrees) => {
      for (const e of entrees) vus.set(e.target.dataset.section, e.isIntersecting ? e.intersectionRatio : 0);
      const premier = ONGLETS.find((id) => (vus.get(id) ?? 0) > 0);
      if (premier) setActif(premier);
    }, { root: zone, rootMargin: '-120px 0px -55% 0px', threshold: [0, 0.01, 0.2] });
    Object.values(sections.current).forEach((s) => s && obs.observe(s));
    return () => obs.disconnect();
  }, [agent?.id]);

  if (!agent) return null;

  const eco = economieDe(agent);
  const devis = devisAgent(agent);
  const taches = agent.taches ?? [];
  const actives = taches.filter((t) => t.active !== false);
  const conseillees = tachesAReliretConseillees(agent);
  const appels = agent.execution?.appelsParJourEstimes ?? 0;
  const qualifs = (agent.qualifications?.logiciels ?? []).filter((q) => nomDuLogiciel(q.logiciel))
    .sort((a, b) => Number(Boolean(b.principal)) - Number(Boolean(a.principal)));
  const canaux = (agent.connecteurs ?? []).filter((c) => CANAUX[c]);
  const regles = agent.expert?.regles ?? [];
  const connaissances = agent.expert?.connaissances ?? [];
  const groupes = RYTHMES.map((r) => ({ ...r, taches: taches.filter((t) => rythmeDe(t) === r) })).filter((g) => g.taches.length);
  const formats = Object.entries(taches.flatMap((t) => (t.sorties ?? []).map((s) => FORMATS[s.format] ?? s.format))
    .reduce((n, f) => ({ ...n, [f]: (n[f] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const totalSorties = formats.reduce((s, [, n]) => s + n, 0);
  const maxRythme = Math.max(1, ...groupes.map((g) => g.taches.length));
  const local = agent.execution?.defaut === 'local';
  const modes = agent.execution?.modes ?? [];
  const ligne = installation ? devis.find((d) => d.offre === installation) : null;
  const inst = installation ? installationDe(installation) : null;
  const relais = agent.relais ?? {};
  const posteDe = (r) => (r.agent && ficheDe(r.agent)?.nom) || r.poste;
  const titreId = `fd-titre-${agent.id}`;
  const secteur = libelleSecteur(agent.secteur);
  const famille = libelleFamille(agent.famille);
  const portrait = portraitDe(agent);

  return (
    <div className="fd-voile" role="dialog" aria-modal="true" aria-labelledby={titreId} ref={defile} data-actif={actif}>
      <div className="fd-fond" aria-hidden="true" />

      {/* ---- sticky section nav ---- */}
      <nav className="fd-nav" aria-label="Sections de la fiche">
        <div className="fd-nav-ligne">
          <div className="fd-nav-qui" aria-hidden="true">
            <img src={portrait} alt="" width="32" height="32" />
            <span>{agent.nom}</span>
          </div>
          <ol className="fd-nav-liens">
            {ONGLETS.map((id) => (
              <li key={id}>
                <a
                  href={`#fd-${id}`}
                  aria-current={actif === id ? 'true' : undefined}
                  onClick={(e) => { e.preventDefault(); aller(id); }}
                >
                  <span className="fd-nav-n">{SECTIONS[id].n}</span>{SECTIONS[id].libelle}
                </a>
              </li>
            ))}
          </ol>
          <button ref={fermer} type="button" className="fd-fermer" onClick={onClose} aria-label="Fermer la fiche et revenir au catalogue">
            <Icone nom="fermer" taille={18} />
          </button>
        </div>
      </nav>

      <div className="fd-cadre">
        {/* ---- premium header (the poster on a phone) ---- */}
        <header className="fd-tete">
          <div className="fd-tete-portrait">
            <img src={portrait} alt={`Portrait provisoire du profil ${agent.nom}`} width="206" height="256" decoding="async" />
          </div>
          <div className="fd-tete-texte">
            <p className="fd-ref">{agent.id} · {famille}</p>
            <h1 id={titreId} className="fd-h1">{agent.nom}</h1>
            <p className="fd-tete-secteur">{secteur}</p>
            <div className="fd-tete-statuts">
              <span className="fd-dispo"><span aria-hidden="true" />Disponible maintenant</span>
              <span className="fd-puce">{local ? 'Travaille chez vous' : 'Travaille par API'}</span>
              <span className="fd-puce">{taches.length} missions</span>
            </div>
            <p className="fd-tete-accroche">{agent.accroche}</p>
            <p className="fd-note">Ce métier se règle sur votre secteur et votre activité ; son prénom, vous le choisissez à l'entretien d'embauche. Portrait provisoire.</p>
          </div>
          <div className="fd-tete-mobile">
            <p className="fd-prix">{PRIX_AGENT_MOIS ?? 'Sur devis'}{PRIX_AGENT_MOIS && <span> / mois</span>}</p>
            <p className="fd-note">{NOTE_ACHAT ? `${NOTE_ACHAT} · ` : ''}la Box et la consommation à part</p>
            <a href={TELECHARGEMENT} className="bouton bouton-plein w-full">Recruter cet agent <Icone nom="fleche" taille={16} /></a>
            <button type="button" className="bouton bouton-contour w-full" onClick={() => aller('recrutement')}>Personnaliser</button>
          </div>
        </header>

        <div className="fd-grille">
          <div className="fd-principal">
            {/* ---- 01 PROFIL ---- */}
            <Section agentId={agent.id} inscrire={inscrire} id="profil" titre={`Voici votre ${enMinuscule(agent.nom)}.`} chapeau={agent.description}>
              {agent.expert?.persona && (
                <figure className="fd-bloc fd-persona">
                  <p className="fd-etiquette">Son parcours</p>
                  <blockquote>{agent.expert.persona}</blockquote>
                  <figcaption>Le parcours de l'expert dont il tient son métier.</figcaption>
                </figure>
              )}

              <div className="fd-cartes-contexte">
                <div className="fd-bloc"><p className="fd-etiquette">Secteur</p><p className="fd-valeur">{secteur}</p></div>
                <div className="fd-bloc"><p className="fd-etiquette">Type de poste</p><p className="fd-valeur">{famille}</p></div>
                <div className="fd-bloc"><p className="fd-etiquette">Où il travaille</p><p className="fd-valeur">{local ? 'Chez vous par défaut' : 'Par API'}{modes.includes('api') && local ? ', API à votre choix' : ''}</p></div>
              </div>

              {agent.resume_metier && (
                <div className="fd-bloc">
                  <p className="fd-etiquette">Sa journée type</p>
                  <ol className="fd-journee">
                    {journee(agent.resume_metier).map((j, i) => (
                      <li key={i}>
                        {j.moment && <span className="fd-moment">{j.moment}</span>}
                        <span>{j.texte}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {((relais.recoitDe?.length ?? 0) + (relais.transmetA?.length ?? 0)) > 0 && (
                <div className="fd-relais">
                  {[['recoitDe', 'Il reçoit de'], ['transmetA', 'Il transmet à']].map(([cle, titre]) => (relais[cle]?.length ? (
                    <div key={cle} className="fd-bloc">
                      <p className="fd-etiquette">{titre}</p>
                      <ul>
                        {relais[cle].map((r, i) => (
                          <li key={i}><strong>{posteDe(r)}</strong>{r.agent && <span className="fd-ref-mini">{r.agent}</span>}<span>{r.quoi}</span></li>
                        ))}
                      </ul>
                    </div>
                  ) : null))}
                </div>
              )}
            </Section>

            {/* ---- 02 MISSIONS ---- */}
            <Section agentId={agent.id} inscrire={inscrire} id="missions" titre="Ce qu'il fait pour vous." chapeau={`${taches.length} missions décrites par l'expert, regroupées selon leur rythme. Vous les gardez, les éteignez ou en ajoutez à l'entretien.`}>
              <div className="fd-groupes">
                {groupes.map((g) => (
                  <div key={g.id} className="fd-bloc fd-groupe">
                    <div className="fd-groupe-tete">
                      <h3>{g.titre}</h3>
                      <span className="fd-compte">{g.taches.length}</span>
                    </div>
                    <p className="fd-groupe-sous">{g.sous}</p>
                    <ul className="fd-coches">
                      {g.taches.map((t) => (
                        <li key={t.id}>
                          <span className="fd-case" aria-hidden="true"><Icone nom="coche" taille={13} /></span>
                          <div>
                            <p className="fd-tache-nom">{t.nom}</p>
                            {t.description && <p className="fd-tache-desc">{t.description}</p>}
                            <p className="fd-tache-meta">
                              <span>{quand(t.planification)}</span>
                              {[...new Set((t.sorties ?? []).map((s) => s.format))].map((f) => <span key={f} className="fd-format">.{f}</span>)}
                              {t.validationHumaine && <span className="fd-conseil">relecture conseillée, à votre choix</span>}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>

            {/* ---- 03 COMPÉTENCES & OUTILS ---- */}
            <Section agentId={agent.id} inscrire={inscrire} id="competences" titre="Ce qu'il sait, ce qu'il manie." chapeau="Ses connaissances d'expert, les logiciels sur lesquels il est qualifié et les canaux par lesquels il travaille.">
              {connaissances.length > 0 && (
                <div className="fd-bloc">
                  <p className="fd-etiquette">Compétences clés</p>
                  <ul className="fd-competences">
                    {connaissances.map((k) => (
                      <li key={k.titre}>
                        <span className="fd-case fd-case-pleine" aria-hidden="true"><Icone nom="coche" taille={13} /></span>
                        <div><p className="fd-tache-nom">{k.titre}</p>{k.resume && <p className="fd-tache-desc">{k.resume}</p>}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {qualifs.length > 0 && (
                <div className="fd-bloc">
                  <p className="fd-etiquette">Outils maîtrisés</p>
                  <ul className="fd-logiciels">
                    {qualifs.map((q) => {
                      const nom = nomDuLogiciel(q.logiciel);
                      return (
                        <li key={q.logiciel} className="fd-logiciel">
                          <span className="fd-mono" style={{ '--h': teinte(nom) }} aria-hidden="true">{monogramme(nom)}</span>
                          <div>
                            <p className="fd-logiciel-nom">{nom}{q.principal && <span className="fd-badge-principal">principal</span>}</p>
                            {libelleCategorie(q.logiciel) && <p className="fd-logiciel-cat">{libelleCategorie(q.logiciel)}</p>}
                            {q.usage && <p className="fd-tache-desc">{q.usage}</p>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="fd-note mt-3">Il sait se servir de ces logiciels ; il les rejoint avec les accès que vous lui confiez à l'embauche.</p>
                </div>
              )}

              {canaux.length > 0 && (
                <div className="fd-bloc">
                  <p className="fd-etiquette">Canaux</p>
                  <ul className="fd-canaux">
                    {canaux.map((c) => (
                      <li key={c} className={CANAUX[c].bientot ? 'fd-canal fd-canal-bientot' : 'fd-canal'}>
                        <span className="fd-canal-icone"><Icone nom={c} taille={18} /></span>
                        <div>
                          <p className="fd-logiciel-nom">{CANAUX[c].libelle}{CANAUX[c].bientot && <span className="fd-bientot">bientôt</span>}</p>
                          <p className="fd-logiciel-cat">{CANAUX[c].detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="fd-ajout">
                <div>
                  <p className="fd-ajout-titre">Votre logiciel n'est pas présent ?</p>
                  <p className="fd-tache-desc">Vous l'ajoutez lors de l'entretien d'embauche : l'agent vous demande ce que tourne l'entreprise et règle sa propre configuration.</p>
                </div>
                <a href={TELECHARGEMENT} className="bouton bouton-contour">Ajouter un outil lors de l'entretien</a>
              </div>
            </Section>

            {/* ---- 04 CAPACITÉ & AUTONOMIE ---- */}
            <Section agentId={agent.id} inscrire={inscrire} id="capacite" titre="Ce qu'il abat, et jusqu'où il va seul." chapeau="Des estimations tirées de sa fiche, à confirmer sur votre poste une fois l'agent au travail.">
              <dl className="fd-metriques">
                <div className="fd-bloc fd-metrique"><dt>échanges par jour (estimation)</dt><dd>{nombre(appels)}</dd></div>
                {eco && <div className="fd-bloc fd-metrique"><dt>échanges par mois (estimation)</dt><dd>{nombre(eco.executionsParMois)}</dd></div>}
                <div className="fd-bloc fd-metrique"><dt>missions décrites</dt><dd>{actives.length}</dd></div>
                <div className="fd-bloc fd-metrique"><dt>types de documents produits</dt><dd>{formats.length}</dd></div>
              </dl>

              <div className="fd-deux">
                <div className="fd-bloc">
                  <p className="fd-etiquette">Rythme de travail</p>
                  <ul className="fd-barres">
                    {groupes.map((g) => (
                      <li key={g.id}>
                        <span className="fd-barre-lib">{g.titre}</span>
                        <span className="fd-barre"><span style={{ width: `${(g.taches.length / maxRythme) * 100}%` }} /></span>
                        <span className="fd-barre-n">{g.taches.length}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="fd-bloc">
                  <p className="fd-etiquette">Ce qu'il produit</p>
                  <ul className="fd-barres">
                    {formats.map(([f, n]) => (
                      <li key={f}>
                        <span className="fd-barre-lib">{f}</span>
                        <span className="fd-barre fd-barre-bleue"><span style={{ width: `${(n / totalSorties) * 100}%` }} /></span>
                        <span className="fd-barre-n">{n}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="fd-note mt-3">Chaque document est posé dans son dossier de travail, sur votre poste.</p>
                </div>
              </div>

              {agent.materiel?.gpu?.libelle && (
                <div className="fd-bloc fd-machine">
                  <p className="fd-etiquette">Machine conseillée pour le faire tourner chez vous</p>
                  <p className="fd-valeur">{agent.materiel.gpu.libelle}</p>
                  <p className="fd-note">{agent.materiel.ram ? `${agent.materiel.ram} Go de mémoire · ` : ''}{local ? 'local par défaut' : 'par API'}{modes.includes('api') ? ', bascule par API à votre choix' : ''}.</p>
                </div>
              )}

              <div className="fd-bloc fd-autonomie">
                <p className="fd-etiquette">Autonomie</p>
                <p className="fd-autonomie-phrase">Il travaille seul, sauf sur les tâches que vous mettez sous contrôle.</p>
                <table className="fd-autorite">
                  <caption className="sr-only">Niveaux d'autorité de l'agent</caption>
                  <tbody>
                    <tr><th scope="row">Lire</th><td><span className="fd-niveau fd-niveau-ok">Seul</span></td><td>Dans les dossiers et comptes que vous lui ouvrez, rien d'autre.</td></tr>
                    <tr><th scope="row">Préparer</th><td><span className="fd-niveau fd-niveau-ok">Seul</span></td><td>Documents, tableaux et brouillons, posés dans son dossier de travail.</td></tr>
                    <tr><th scope="row">Envoyer un e-mail</th><td><span className="fd-niveau fd-niveau-regle">Après relecture</span></td><td>Rien ne part sans que vous ayez relu le texte exact.</td></tr>
                    <tr><th scope="row">Signer, engager une dépense</th><td><span className="fd-niveau fd-niveau-non">Jamais</span></td><td>Rien ne se signe ni ne se paie depuis l'application.</td></tr>
                  </tbody>
                </table>
                <div className="fd-releture">
                  <div className="fd-releture-tete">
                    <span>L'expert conseille de relire</span>
                    <strong>{conseillees} tâche{conseillees > 1 ? 's' : ''} sur {taches.length}</strong>
                  </div>
                  <span className="fd-barre fd-barre-corail" aria-hidden="true"><span style={{ width: `${taches.length ? (conseillees / taches.length) * 100 : 0}%` }} /></span>
                  <p className="fd-note">{conseillees > 0 ? 'Relecture conseillée, à votre choix : à l\'entretien, vous gardez ce contrôle ou vous le relâchez.' : 'Aucune tâche à relire selon l\'expert ; vous pouvez en mettre sous contrôle à l\'entretien.'}</p>
                </div>
              </div>

              {regles.length > 0 && (
                <div className="fd-bloc fd-jamais">
                  <p className="fd-etiquette">Ce qu'il ne fera jamais</p>
                  <ul>
                    {regles.map((r, i) => <li key={i}><span className="fd-jamais-icone"><Icone nom="bouclier" taille={16} /></span><span>{r}</span></li>)}
                  </ul>
                </div>
              )}
            </Section>

            {/* ---- 05 RECRUTEMENT ---- */}
            <Section agentId={agent.id} inscrire={inscrire} id="recrutement" titre="Le recruter." chapeau="Le prix de l'agent, ce qu'il coûte à faire tourner selon votre installation, et ce que vous réglez avec lui à l'entretien.">
              <dl className="fd-resume">
                <div className="fd-bloc fd-resume-prix">
                  <dt>Prix de l'agent</dt>
                  <dd><span className="fd-prix">{PRIX_AGENT_MOIS ?? 'Sur devis'}{PRIX_AGENT_MOIS && <span> / mois</span>}</span>{NOTE_ACHAT && <span className="fd-note">{NOTE_ACHAT}</span>}</dd>
                </div>
                <div className="fd-bloc"><dt>Votre installation</dt><dd>{inst ? inst.nom : 'À choisir dans le catalogue'}</dd></div>
                <div className="fd-bloc"><dt>Fonctionnement</dt><dd>{modes.length > 1 ? 'Local ou API, au choix' : local ? 'Local' : 'API'}</dd></div>
                <div className="fd-bloc"><dt>Capacité</dt><dd>~{nombre(appels)} échanges / jour</dd></div>
              </dl>
              <p className="fd-note">La machine iAgent Box et son abonnement se comptent toujours à part, sur leur propre ligne.</p>

              <div className="fd-bloc fd-devis">
                <p className="fd-etiquette">Ce que cet agent vous coûte selon votre installation</p>
                <table className="fd-table">
                  <thead>
                    <tr><th scope="col">Installation</th><th scope="col">Où il travaille</th><th scope="col">Coût de l'agent</th><th scope="col">Par API seule</th><th scope="col">Économie</th></tr>
                  </thead>
                  <tbody>
                    {devis.map((l) => (
                      <tr key={l.offre} className={l.offre === installation ? 'fd-ligne-votre' : undefined}>
                        <th scope="row" data-label="Installation">{l.nom}{l.offre === installation && <span className="fd-votre"> (la vôtre)</span>}</th>
                        <td data-label="Où il travaille" title={l.motif}><span className={l.enLocal ? 'fd-niveau fd-niveau-ok' : 'fd-niveau'}>{l.enLocal ? 'chez vous' : 'par API'}</span></td>
                        <td data-label="Coût de l'agent">{euros(l.coutAgent)}/mois</td>
                        <td data-label="Par API seule" className="fd-attenue">{euros(l.apiSeule)}/mois</td>
                        <td data-label="Économie" className={l.economie > 0 ? 'fd-gain' : 'fd-attenue'}>{l.economie > 0 ? `${euros(l.economie)}/mois` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="fd-note mt-3">Coût de fonctionnement estimé de l'agent (part d'API comprise), en plus de son abonnement ({prixAgentCourt()}) ; la Box à part.</p>
                {ligne && inst ? (
                  <div className="fd-explications">
                    <p>{ligne.motif}</p>
                    {inst.cout.lignes.map((b) => (
                      <p key={b.id}>{b.nom} : {b.id === LOCATION_BOX.id ? `${LOCATION_BOX.phrase}.` : `${euros(b.mensualite)} HT par mois sur ${FINANCEMENT.mois} mois, plus son abonnement de ${euros(b.abonnement)} par mois.`}</p>
                    ))}
                    {inst.cout.lignes.length > 0 && <p>{ligne.rembourseSeul ? 'Cet agent rembourse à lui seul la machine, son abonnement et son électricité.' : 'Cet agent seul ne rembourse pas la machine : elle se rentabilise avec plusieurs agents.'}</p>}
                    {inst.cout.mensualiteAConfirmer && <p className="fd-a-confirmer">Taux du financement à confirmer</p>}
                  </div>
                ) : (
                  <p className="fd-note mt-2">Choisissez votre installation dans le catalogue pour voir votre ligne en détail.</p>
                )}
                {devis.some((d) => d.aConfirmer) && <p className="fd-a-confirmer mt-2">Certains prix de machines restent à confirmer.</p>}
              </div>

              <div className="fd-bloc fd-perso" id="fd-personnaliser">
                <p className="fd-etiquette">Personnalisez votre collaborateur</p>
                <p className="fd-tache-desc">Tout se règle à l'oral, pendant l'entretien d'embauche dans l'application iAgent : l'agent vous pose les questions et propose ce que sa fiche conseille.</p>
                <ul className="fd-perso-grille">
                  {PERSONNALISATION.map(([icone, titre, detail]) => (
                    <li key={titre}><span className="fd-canal-icone"><Icone nom={icone} taille={18} /></span><div><p className="fd-logiciel-nom">{titre}</p><p className="fd-logiciel-cat">{detail}</p></div></li>
                  ))}
                </ul>
              </div>

              <div className="fd-final">
                <div>
                  <p className="fd-ajout-titre">Prêt à le rencontrer ?</p>
                  <p className="fd-tache-desc">L'embauche se fait dans l'application iAgent : vous la téléchargez, puis l'agent vous fait passer l'entretien.</p>
                </div>
                <a href={TELECHARGEMENT} className="bouton bouton-plein">Faire passer l'entretien <Icone nom="fleche" taille={16} /></a>
              </div>
            </Section>
          </div>

          {/* ---- the poster, sticky on a desktop ---- */}
          <aside className="fd-affiche" aria-label={`Affiche du profil ${agent.nom}`}>
            <div className="fd-a-portrait">
              <img className="fd-a-flou" src={portrait} alt="" aria-hidden="true" />
              <img className="fd-a-photo" src={portrait} alt="" width="206" height="256" decoding="async" />
              <div className="fd-a-voile" />
              <span className="fd-dispo fd-a-dispo"><span aria-hidden="true" />Disponible maintenant</span>
            </div>
            <div className="fd-a-corps">
              <p className="fd-ref">{agent.id}</p>
              <p className="fd-a-nom">{agent.nom}</p>
              <p className="fd-tete-secteur">{secteur} · {famille}</p>
              <p className="fd-a-accroche">{agent.accroche}</p>

              <div className="fd-a-bloc fd-a-missions">
                <p className="fd-etiquette">Missions</p>
                <ul className="fd-a-liste">
                  {actives.slice(0, 3).map((t) => <li key={t.id}>{t.nom}</li>)}
                </ul>
                {actives.length > 3 && <p className="fd-note">et {actives.length - 3} autres missions</p>}
              </div>

              {(qualifs.length > 0 || canaux.length > 0) && (
                <div className="fd-a-bloc fd-a-outils">
                  <p className="fd-etiquette">Outils</p>
                  <ul className="fd-a-badges">
                    {qualifs.slice(0, 5).map((q) => <li key={q.logiciel} className="fd-a-badge">{nomDuLogiciel(q.logiciel)}</li>)}
                    {canaux.map((c) => <li key={c} className={`fd-a-badge fd-a-canal${CANAUX[c].bientot ? ' fd-a-canal-bientot' : ''}`} title={CANAUX[c].bientot ? `${CANAUX[c].libelle} : bientôt` : CANAUX[c].libelle}><Icone nom={c} taille={13} /><span className="sr-only">{CANAUX[c].libelle}{CANAUX[c].bientot ? ' (bientôt)' : ''}</span></li>)}
                  </ul>
                </div>
              )}

              <div className="fd-a-bloc fd-a-prix">
                <div>
                  <p className="fd-prix">{PRIX_AGENT_MOIS ?? 'Sur devis'}{PRIX_AGENT_MOIS && <span> / mois</span>}</p>
                  {NOTE_ACHAT && <p className="fd-note">{NOTE_ACHAT}</p>}
                </div>
                <div className="fd-a-capacite">
                  <p className="fd-a-capacite-n">~{nombre(appels)}</p>
                  <p className="fd-note">échanges / jour</p>
                </div>
              </div>

              <a href={TELECHARGEMENT} className="bouton bouton-plein w-full">Recruter cet agent <Icone nom="fleche" taille={16} /></a>
              <div className="fd-a-actions">
                <button type="button" className="bouton bouton-contour" onClick={() => aller('recrutement')}>Personnaliser</button>
                <button type="button" className="bouton bouton-contour" onClick={() => aller('recrutement')}>Comparer les coûts</button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ---- sticky hire button on a phone ---- */}
      <div className="fd-collant">
        <div>
          <p className="fd-collant-nom">{agent.nom}</p>
          <p className="fd-note">{prixAgentCourt()}</p>
        </div>
        <a href={TELECHARGEMENT} className="bouton bouton-plein">Recruter</a>
      </div>
    </div>
  );
}
