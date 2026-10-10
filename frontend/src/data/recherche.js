// What the library needs on top of the fiches: readable labels, a search
// index, the filters' counts and the portrait of each profile. Everything is
// derived from the fiches and the catalogue; nothing here is written by hand
// except the portrait bank and the words that name the families.
import agents from './loader.js';
import catalogue from '../../../catalogue/catalogue.json';
import logicielsJson from '../../../catalogue/logiciels.json';
import activitesJson from '../../../catalogue/activites.json';
import { activitesReconnues, cerclesDeLActivite, coeurDeLActivite, estTransversal, personnelDeLActivite, SECTEURS_TRANSVERSAUX } from './activites-recherche.js';
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
// The dedicated page of a job and of a sector, as seo/generer.mjs writes them:
// a click in the catalogue shows this address, the sitemap lists it.
export const urlFiche = (agent) => `/agents/${agent.slug}`;
export const urlSecteur = (id) => `/secteurs/${slugifier(libelleSecteur(id))}`;

/** The trades the query names (« imprimerie » → Imprimerie offset et numérique). */
export const activitesDeLaRecherche = (requete) => activitesReconnues(requete, ACTIVITES);

const LOGICIEL_PAR_ID = new Map(LOGICIELS.map((l) => [l.id, l]));
/** The trade's own software, in the pack's order: management and quotes first, then the shop floor. */
export const logicielsDeLActivite = (activite) => (activite?.pack?.logiciels ?? []).map((id) => LOGICIEL_PAR_ID.get(id)).filter(Boolean);
/** The software of every activity the request names, each once. */
export function logicielsPourDemande(idee, limite = 12) {
  const vus = new Set();
  return activitesDeLaRecherche(idee).flatMap(logicielsDeLActivite).filter((l) => !vus.has(l.id) && vus.add(l.id)).slice(0, limite);
}

// When the query names a trade, the jobs that serve it join the results even
// if no word of the query is in their fiche: a printer who types « imprimerie »
// must find someone to recruit. Closest jobs come before any word match, the
// software-qualified ones after, the jobs every business has last.
function rangsParActivite(requete) {
  const rangs = new Map();
  for (const activite of activitesDeLaRecherche(requete)) {
    const { proches, coeur, outilles, transversaux } = cerclesDeLActivite(activite, agents);
    const poser = (fiches, base) => fiches.forEach((f, i) => { if (!rangs.has(f.id)) rangs.set(f.id, base - i / 10000); });
    poser(proches, 2000);
    poser(coeur, 1000);
    poser(outilles, 300);
    poser(transversaux, 100);
  }
  return rangs;
}

// What a visitor asks for in plain words (« trouver plus de clients ») and
// the roots of the job titles that do it. Only the intentions a business
// owner states first; everything else is matched on the words themselves.
const INTENTIONS = [
  [/client|vendre|vente|chiffre|prospect|commande|marche/, ['prospe', 'commer', 'acquis', 'vente', 'ventes']],
  [/factur|impaye|relanc|paiement|tresor/, ['factur', 'recouv', 'tresor']],
  [/compta|bilan|tva|depense/, ['compta']],
  [/recrut|embauch|candidat|personnel|salari/, ['recrut', 'ressou', 'paie']],
  [/reseau|instagram|facebook|linkedin|tiktok|visibil|notoriet|publicit/, ['commun', 'market', 'social', 'conten']],
  [/devis/, ['devis']],
  [/rendez|agenda|planning|reservation/, ['rendez', 'planni', 'reserv']],
  [/mail|courrier|telephone|appel|accueil|secretar/, ['secret', 'assist', 'accuei']],
  [/stock|fournisseur|achat|approvision/, ['achats', 'stock', 'fourni', 'approv']],
  [/livraison|transport|tournee|logistique/, ['logist', 'transp', 'livrai']],
  [/site|internet|web|referencement/, ['web', 'refere']],
  [/\bavis\b|reputation|google/, ['commun', 'reputa', 'relati']],
  [/developp|croissance|grandir|export/, ['prospe', 'commer', 'strate', 'busine', 'export']],
  [/financ|subvention|levee|investiss|banque|pret/, ['financ', 'subven', 'invest']],
];
const MOTS_CREUX = new Set(['trouver', 'veux', 'voudrais', 'aimerais', 'faire', 'avoir', 'plus', 'entreprise', 'societe', 'besoin', 'aider', 'gerer', 'mieux', 'notre', 'votre',
  'developper', 'internet', 'ouvrir', 'lancer', 'creer', 'temps', 'perds', 'croule', 'trois', 'quatre', 'plusieurs', 'beaucoup']);
const racinesDe = (texte) => normaliser(texte).split(/[^a-z0-9]+/).filter((m) => m.length >= 5 && !MOTS_CREUX.has(m)).map((m) => m.slice(0, 6));
const racinesDesNoms = new Map(agents.map((a) => [a.id, new Set(racinesDe(a.nom))]));
const sansPluriel = (m) => m.replace(/s$/, '');
const motsDesNoms = new Map(agents.map((a) => [a.id, new Set(normaliser(a.nom).split(/[^a-z0-9]+/).map(sansPluriel))]));
// Every trade's own words: a « jardinage » or « restaurant » job is no answer
// for a print shop, however well « clients » matches its title.
const racinesDesMetiers = new Set(ACTIVITES.flatMap((a) => racinesDe([a.nom, ...(a.alias ?? [])].join(' '))));

/**
 * The agents a request in plain words calls for (« J'ai une imprimerie et je
 * veux trouver plus de clients »): the jobs its intentions name, the jobs of
 * the trade it names, and both first. What the home page's « Commencer »
 * proposes, before any ready-made cycle.
 */
/**
 * The staff of the trades a request names (estimator, production, management,
 * office), each job under the name the trade gives its role and with its
 * service, the first trade first. A print shop's staff alone is sixteen jobs.
 */
export function coeurPourDemande(idee, limite = 24) {
  // Two recognized activities both bring an estimator: keep the first one,
  // the role is what the visitor reads.
  const vus = new Set();
  const roles = new Set();
  const cle = (role) => role.split(/ [—-] /)[0].toLowerCase();
  return activitesDeLaRecherche(idee)
    .flatMap((a) => coeurDeLActivite(a, agents))
    .filter(({ fiche, role }) => !vus.has(fiche.id) && !roles.has(cle(role)) && vus.add(fiche.id) && roles.add(cle(role)))
    .slice(0, limite);
}

/** The hands-on jobs of the first trade a request names, which stay people: [{ metier, fiche }]. */
export function terrainPourDemande(idee) {
  const [activite] = activitesDeLaRecherche(idee);
  return activite ? personnelDeLActivite(activite, agents)?.terrain ?? [] : [];
}

export function agentsPourDemande(idee, limite = 8) {
  const texte = normaliser(idee);
  const voulu = new Set(INTENTIONS.filter(([motif]) => motif.test(texte)).flatMap(([, r]) => r));
  for (const r of racinesDe(idee)) voulu.add(r);
  const dits = new Set(normaliser(idee).split(/[^a-z0-9]+/).filter((m) => m.length >= 5).map(sansPluriel));
  const activites = activitesDeLaRecherche(idee);
  const sesRacines = new Set(activites.flatMap((a) => racinesDe([a.nom, ...(a.alias ?? [])].join(' '))));
  const proches = [];
  const metier = new Map();
  for (const activite of activites) {
    const c = cerclesDeLActivite(activite, agents);
    proches.push(...c.proches);
    [...c.proches, ...c.coeur, ...c.outilles].forEach((f, i) => { if (!metier.has(f.id)) metier.set(f.id, 2 - i / 1000); });
  }
  const classes = agents
    .map((a) => {
      const noms = racinesDesNoms.get(a.id);
      const intention = [...voulu].filter((r) => [...noms].some((n) => n.startsWith(r))).length;
      const exact = [...motsDesNoms.get(a.id)].filter((m) => dits.has(m)).length;
      const ailleurs = [...noms].some((n) => racinesDesMetiers.has(n) && !sesRacines.has(n) && ![...voulu].some((r) => n.startsWith(r)));
      // A job written for another trade answers a request only when no trade
      // was named: « facturation artisan » is not for an accounting firm.
      const autreMetier = activites.length > 0 && !metier.has(a.id) && !estTransversal(a);
      return { a, score: intention * 3 + exact * 2 + (metier.get(a.id) ?? 0) + (intention && metier.has(a.id) ? 4 : 0) - (ailleurs ? 6 : 0) - (autreMetier ? 4 : 0) };
    })
    .filter((x) => x.score >= 2)
    .sort((x, y) => y.score - x.score);
  // The trade's own closest jobs always make the team, then the best answers
  // to the request, never more than three of one sector.
  const choisis = [...new Set(proches.slice(0, 3).map((f) => f.id))];
  const parSecteur = new Map();
  for (const { a } of classes) {
    if (choisis.length >= limite) break;
    if (choisis.includes(a.id) || (parSecteur.get(a.secteur) ?? 0) >= 3) continue;
    parSecteur.set(a.secteur, (parSecteur.get(a.secteur) ?? 0) + 1);
    choisis.push(a.id);
  }
  return choisis;
}

/** The filters the library offers, each one a set of chosen values. */
export const FILTRES_VIDES = { secteurs: [], activites: [], familles: [], logiciels: [], ou: [] };

/**
 * Who works in each activity, in the order the search ranks them (its own
 * staff, the jobs on its software, then the jobs every business has), and the
 * sectors its own staff comes from. Computed once, on first use (~0.2 s).
 */
let membres = null;
export function membresDesActivites() {
  if (!membres) {
    membres = new Map(ACTIVITES.map((activite) => {
      const { proches, coeur, outilles, transversaux } = cerclesDeLActivite(activite, agents);
      const propres = [...proches, ...coeur, ...outilles];
      return [activite.id, {
        rang: new Map([...propres, ...transversaux].map((f, i) => [f.id, i])),
        secteurs: new Set(propres.map((f) => f.secteur).filter((s) => !SECTEURS_TRANSVERSAUX.has(s))),
      }];
    }));
  }
  return membres;
}
const ACTIVITE_PAR_ID = new Map(ACTIVITES.map((a) => [a.id, a]));
export const activiteDe = (id) => ACTIVITE_PAR_ID.get(id);

/**
 * The activities the filter offers, with how many of `liste` serve each. A
 * trade's own sector narrows them; the sectors every business has (office,
 * accounting…) serve every trade, so they narrow nothing.
 */
export function optionsActivites(liste, secteurs = []) {
  const m = membresDesActivites();
  const propres = secteurs.filter((s) => !SECTEURS_TRANSVERSAUX.has(s));
  const ids = liste.map((a) => a.id);
  return ACTIVITES
    .filter((a) => !propres.length || propres.some((s) => m.get(a.id).secteurs.has(s)))
    .map((a) => [a.id, ids.filter((id) => m.get(a.id).rang.has(id)).length])
    .filter(([, n]) => n > 0)
    .sort((x, y) => activiteDe(x[0]).nom.localeCompare(activiteDe(y[0]).nom, 'fr'));
}

/**
 * `ou` is where the agent works on the visitor's installation: « chez-vous »
 * or « api ». It needs the installation's quote, passed as a function.
 */
export function filtrer(liste, { requete = '', secteurs = [], activites = [], familles = [], logiciels = [], ou = [] } = {}, ouTravaille) {
  const parActivite = rangsParActivite(requete);
  const choisies = activites.map((id) => membresDesActivites().get(id)).filter(Boolean);
  // In a chosen activity, its own staff comes first, as on its page.
  const rangChoisi = (a) => Math.max(0, ...choisies.map((c) => (c.rang.has(a.id) ? 3000 - c.rang.get(a.id) : 0)));
  return liste
    .map((a) => ({ a, score: (pertinence(a, requete) && 500 + pertinence(a, requete)) + (parActivite.get(a.id) ?? 0) + rangChoisi(a) }))
    .filter(({ a, score }) =>
      score > 0 &&
      (!secteurs.length || secteurs.includes(a.secteur)) &&
      (!choisies.length || choisies.some((c) => c.rang.has(a.id))) &&
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
