// What the library needs on top of the fiches: readable labels, a search
// index, the filters' counts and the portrait of each profile. Everything is
// derived from the fiches and the catalogue; nothing here is written by hand
// except the portrait bank and the words that name the families.
import agents from './loader.js';
import catalogue from '../../../catalogue/catalogue.json';
import logicielsJson from '../../../catalogue/logiciels.json';

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

// Portraits: max's bank of AI-generated professional portraits, cut from his
// sheets (428 faces, public/portraits/agents). The same one for a fiche every
// time (its number picks it), so a profile keeps its face from one visit to the
// next. The first name is not shown: the client gives it at the hiring
// interview. The home page's named agents have their own portraits.
export const NOMBRE_DE_PORTRAITS = 428;
export const PORTRAITS = Array.from({ length: NOMBRE_DE_PORTRAITS }, (_, i) => `/portraits/agents/a${String(i + 1).padStart(3, '0')}.webp`);
export const portraitDe = (agent) => {
  const n = parseInt(String(agent?.id ?? '').slice(3), 10) || 0;
  // A stride prime to the bank's size (428 = 4 x 107) spreads neighbours apart.
  return PORTRAITS[(n * 37) % PORTRAITS.length];
};

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

/** The filters the library offers, each one a set of chosen values. */
export const FILTRES_VIDES = { secteurs: [], familles: [], logiciels: [], ou: [] };

/**
 * `ou` is where the agent works on the visitor's installation: « chez-vous »
 * or « api ». It needs the installation's quote, passed as a function.
 */
export function filtrer(liste, { requete = '', secteurs = [], familles = [], logiciels = [], ou = [] } = {}, ouTravaille) {
  return liste
    .map((a) => ({ a, score: pertinence(a, requete) }))
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
  for (const s of catalogue.secteurs) ajouter(s.nom, 'Secteur');
  for (const a of agents) ajouter(a.nom, 'Métier');
  for (const l of new Set(agents.flatMap(logicielsDe))) ajouter(l, 'Logiciel');
  return sortie.sort((x, y) => Number(y.debut) - Number(x.debut) || x.texte.length - y.texte.length).slice(0, limite);
}

export const COMPTEURS = {
  agents: agents.length,
  // The catalogue's sector list, the number the home page shows too.
  secteurs: catalogue.secteurs.length,
  logiciels: LOGICIELS.length,
  taches: agents.reduce((n, a) => n + (a.taches?.length ?? 0), 0),
};
