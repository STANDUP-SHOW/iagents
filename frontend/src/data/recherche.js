// What the library needs on top of the fiches: readable labels, a search
// index, the filters' counts and the portrait of each profile. Everything is
// derived from the fiches and the catalogue; nothing here is written by hand
// except the portrait bank and the words that name the families.
import agents from './loader.js';
import catalogue from '../../../catalogue/catalogue.json';
import logicielsJson from '../../../catalogue/logiciels.json';
import activitesJson from '../../../catalogue/activites.json';
import { activitesReconnues, cerclesDeLActivite } from './activites-recherche.js';
import { slugifier } from '../../seo/slug.mjs';

const LOGICIELS = logicielsJson.logiciels;
const nomLogiciel = new Map(LOGICIELS.map((l) => [l.id, l.nom]));
const nomSecteur = new Map(catalogue.secteurs.map((s) => [s.id, s.nom]));

/** « commerce-detail » → « Commerce de détail », as the catalogue names it. */
export const libelleSecteur = (id) => nomSecteur.get(id) ?? String(id).charAt(0).toUpperCase() + String(id).slice(1);

// The fiche's `famille` says what kind of collaborator it is.
const FAMILLES = {
  metier: 'Métier',
  fonction: 'Fonction transverse',
  configurable: 'Configurable',
  'reseaux-sociaux': 'Réseaux sociaux',
};
export const libelleFamille = (id) => FAMILLES[id] ?? id;

/** A software id of the catalogue → its name. */
export const nomDuLogiciel = (id) => nomLogiciel.get(id);

/** The software a fiche is qualified on, main one first, by name. */
export const logicielsDe = (agent) =>
  [...(agent.qualifications?.logiciels ?? [])]
    .sort((a, b) => Number(Boolean(b.principal)) - Number(Boolean(a.principal)))
    .map((q) => nomLogiciel.get(q.logiciel))
    .filter(Boolean);

/** Accents and case do not matter when someone types « comptabilite ». */
export const normaliser = (texte) =>
  String(texte ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export { NOMBRE_DE_PORTRAITS, PORTRAITS, portraitDe } from './portraits.js';

// One string per fiche holding every field the search looks into: the id, the
// job, the sector, the family, the hook, the software, the tasks and what the
// expert knows.
const champs = (a) => [
  a.id, a.nom, a.accroche, libelleSecteur(a.secteur), libelleFamille(a.famille),
  ...logicielsDe(a),
  ...(a.taches ?? []).map((t) => t.nom),
  ...(a.expert?.connaissances ?? []).map((k) => k.titre),
];
const index = new Map(agents.map((a) => [a.id, { tout: normaliser(champs(a).join(' \n ')), nom: normaliser(a.nom), logiciels: logicielsDe(a).map(normaliser) }]));
const indexDe = (a) => index.get(a.id) ?? { tout: normaliser(champs(a).join(' \n ')), nom: normaliser(a.nom), logiciels: logicielsDe(a).map(normaliser) };

/**
 * How well a fiche answers the query: every word must be found somewhere;
 * a word in the job title counts more than one in a task. 0 = no match.
 */
export function pertinence(agent, requete) {
  const mots = normaliser(requete).split(/\s+/).filter(Boolean);
  if (!mots.length) return 1;
  const i = indexDe(agent);
  let score = 0;
  for (const m of mots) {
    if (!i.tout.includes(m)) return 0;
    score += 1;
    if (i.nom.includes(m)) score += 4;
    if (i.logiciels.some((l) => l.includes(m))) score += 3;
  }
  return score;
}

export const ACTIVITES = activitesJson.activites;

/** The activity pages the search-engine pages publish, one per activity. */
export const urlActivite = (activite) => `/activites/${slugifier(activite.nom)}`;

/** The trades the query names (« imprimerie » → Imprimerie offset et numérique). */
export const activitesDeLaRecherche = (requete) => activitesReconnues(requete, ACTIVITES);

// When the query names a trade, the jobs that serve it join the results even
// if no word of the query is in their fiche: a printer who types « imprimerie »
// must find someone to recruit. Closest jobs come before any word match, the
// software-qualified ones after, the jobs every business has last.
function rangsParActivite(requete) {
  const rangs = new Map();
  for (const activite of activitesDeLaRecherche(requete)) {
    const { proches, outilles, transversaux } = cerclesDeLActivite(activite, agents);
    const poser = (fiches, base) => fiches.forEach((f, i) => { if (!rangs.has(f.id)) rangs.set(f.id, base - i / 10000); });
    poser(proches, 2000);
    poser(outilles, 300);
    poser(transversaux, 100);
  }
  return rangs;
}

/** The filters the library offers, each one a set of chosen values. */
export const FILTRES_VIDES = { secteurs: [], familles: [], logiciels: [], ou: [] };

/**
 * `ou` is where the agent works on the visitor's installation: « chez-vous »
 * or « api ». It needs the installation's quote, passed as a function.
 */
export function filtrer(liste, { requete = '', secteurs = [], familles = [], logiciels = [], ou = [] } = {}, ouTravaille) {
  const parActivite = rangsParActivite(requete);
  return liste
    .map((a) => ({ a, score: (pertinence(a, requete) && 500 + pertinence(a, requete)) + (parActivite.get(a.id) ?? 0) }))
    .filter(({ a, score }) =>
      score > 0 &&
      (!secteurs.length || secteurs.includes(a.secteur)) &&
      (!familles.length || familles.includes(a.famille)) &&
      (!logiciels.length || logicielsDe(a).some((l) => logiciels.includes(l))) &&
      (!ou.length || !ouTravaille || ou.includes(ouTravaille(a))))
    .sort((x, y) => y.score - x.score)
    .map(({ a }) => a);
}

/** How many fiches carry each value of a field, most frequent first. */
export function decompte(liste, valeurs) {
  const n = new Map();
  for (const a of liste) for (const v of new Set(valeurs(a))) n.set(v, (n.get(v) ?? 0) + 1);
  return [...n.entries()].sort((x, y) => y[1] - x[1] || String(x[0]).localeCompare(String(y[0]), 'fr'));
}

/** Suggestions while typing: jobs, software and sectors that start or contain the words. */
export function suggestions(requete, limite = 6) {
  const q = normaliser(requete).trim();
  if (q.length < 2) return [];
  const vus = new Set();
  const sortie = [];
  const ajouter = (texte, type) => {
    const cle = normaliser(texte);
    if (vus.has(cle) || !cle.includes(q)) return;
    vus.add(cle);
    sortie.push({ texte, type, debut: cle.startsWith(q) });
  };
  for (const a of ACTIVITES) if ([a.nom, ...(a.alias ?? [])].some((n) => normaliser(n).includes(q))) { vus.add(normaliser(a.nom)); sortie.push({ texte: a.nom, type: 'Activité', debut: true }); }
  for (const s of catalogue.secteurs) ajouter(s.nom, 'Secteur');
  for (const a of agents) ajouter(a.nom, 'Métier');
  for (const l of new Set(agents.flatMap(logicielsDe))) ajouter(l, 'Logiciel');
  return sortie.sort((x, y) => Number(y.debut) - Number(x.debut) || x.texte.length - y.texte.length).slice(0, limite);
}

export const COMPTEURS = {
  agents: agents.length,
  // The catalogue's sector list, the number the home page shows too.
  secteurs: catalogue.secteurs.length,
  activites: activitesJson.activites.length,
  logiciels: LOGICIELS.length,
  taches: agents.reduce((n, a) => n + (a.taches?.length ?? 0), 0),
};
