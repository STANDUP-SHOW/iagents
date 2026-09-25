/**
 * What the shop sells besides single agents: network agents, business packs,
 * the « Créez votre entreprise » journey and the iAgent Box. Everything here
 * points at fiches, packs and machines that already exist in the repository;
 * the bench (banc/rendu.jsx) refuses an id that no longer resolves.
 */
import agents from './loader.js';
import packsSecteurs from '../../../catalogue/reference/packs-secteurs.json';
import catalogue from '../../../catalogue/catalogue.json';
import activitesJson from '../../../catalogue/activites.json';
import {
  OFFRES,
  coutInstallation,
  devisParBox,
  conseillerBox,
} from '../../../dimensionnement/offre-box.ts';

const parId = new Map(agents.map((a) => [a.id, a]));
export const ficheDe = (id) => parId.get(id);

// Social-media agents, picked by hand from the catalogue (their famille field
// says « metier » for most of them), plus the one fiche whose famille says so.
const RESEAUX_CHOISIS = ['AG-0208', 'AG-0209', 'AG-0253', 'AG-0254', 'AG-0228', 'AG-0278', 'AG-0318', 'AG-0259'];
export const AGENTS_RESEAUX = [
  ...RESEAUX_CHOISIS,
  ...agents.filter((a) => a.famille === 'reseaux-sociaux' && !RESEAUX_CHOISIS.includes(a.id)).map((a) => a.id),
];

// The 43 sector packs of the V6 study (« AI Offices »), one per catalogue
// sector. The study names them by sector label; the catalogue gives the id.
const idDuSecteur = new Map(catalogue.secteurs.map((s) => [s.nom, s.id]));
export const PACKS_ENTREPRISE = packsSecteurs.entrees.map((e) => {
  const secteur = idDuSecteur.get(e.Secteur);
  return {
    id: e['Pack ID'],
    nom: e['Nom du pack'],
    secteur,
    libelle: e.Secteur,
    capacites: e['Capacités centrales'],
    connecteurs: e['Connecteurs prioritaires'],
    workflow: e['Workflow de référence'],
    agents: agents.filter((a) => a.secteur === secteur).map((a) => a.id),
  };
});

// « Créez votre entreprise », cycle 1: build the project. One step per thing
// max listed, each staffed by agents that already exist.
export const CYCLE_1 = [
  { etape: 'Business plan', agents: ['AG-0669'] },
  { etape: 'Étude de marché', agents: ['AG-1238', 'AG-1241', 'AG-0057', 'AG-1243'] },
  { etape: 'Concurrence', agents: ['AG-1249'] },
  { etape: 'Dossiers de financement', agents: ['AG-0070', 'AG-0109', 'AG-0938', 'AG-0937', 'AG-1187'] },
  { etape: 'Formalités juridiques', agents: ['AG-0021', 'AG-0426'] },
  { etape: 'Relances', agents: ['AG-0186'] },
  { etape: 'Prises de rendez-vous', agents: ['AG-0158'] },
];

// Cycle 2: the operating team once the business runs. A starting proposal the
// visitor edits, not a fixed bundle.
export const CYCLE_2 = ['AG-0003', 'AG-0026', 'AG-0028', 'AG-0189', 'AG-0253'];

// Recognise the visitor's idea among the 282 activities, on whole words of the
// name and aliases, the way the hiring interview does it in the app.
const mots = (texte) =>
  texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length > 3);

export const ACTIVITES = activitesJson.activites;

export function activitesPourIdee(idee, limite = 3) {
  const dits = new Set(mots(idee));
  if (!dits.size) return [];
  return ACTIVITES.map((a) => {
    const leurs = new Set([a.nom, ...(a.alias ?? [])].flatMap(mots));
    let score = 0;
    for (const m of leurs) if (dits.has(m)) score++;
    return { activite: a, score };
  })
    .filter((r) => r.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limite)
    .map((r) => r.activite);
}

// The machine offer (dimensionnement/offre-box.ts): six installations, each with
// its purchase price and its 24-month instalment. The shop reads, it never
// recomputes; every price stays marked provisional until max sets it.
export const INSTALLATIONS = OFFRES.map((o) => ({ ...o, cout: coutInstallation(o) }));
export const installationDe = (id) => INSTALLATIONS.find((o) => o.id === id);

/** A team -> the installation to advise, with every installation's quote beside it. */
export function conseilPour(ids) {
  const fiches = ids.map(ficheDe).filter(Boolean);
  if (!fiches.length) return null;
  const { conseil, devis } = conseillerBox(fiches);
  return { conseil, devis, fiches };
}

/** One line per installation for a single agent. */
export const devisAgent = (fiche) => devisParBox(fiche);

/** « 1 234 € », the way the shop writes money. */
export const euros = (x) =>
  `${Math.round(x).toLocaleString('fr-FR').replace(/\u202f/g, '\u00a0')}\u00a0€`;
