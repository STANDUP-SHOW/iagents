// Recognising the visitor's trade in what they type, and the jobs that serve
// it. A printer types « imprimerie », not « graphiste de production »: no
// fiche carries that word, but activity ACT-0021 does, in its name and
// aliases. Plain functions over the data they are given, plus the staff of
// each trade (catalogue/personnel.json), so the library (in the browser), the
// search-engine pages and the bench (in node) share them.
import personnel from '../../../catalogue/personnel.json' with { type: 'json' };

/**
 * Jobs every business has (office, accounting, HR, sales, purchasing,
 * marketing): each one receives the activity's pack, so each one serves any
 * activity. Jobs written for one trade ("assistant médical administratif")
 * are left out: in a print shop they would be nonsense.
 */
export const SECTEURS_TRANSVERSAUX = new Set(['administration', 'comptabilite', 'ressources-humaines', 'commercial', 'achats', 'marketing']);
const METIER_PROPRE = /immobilier|médical|juridique|cabinet de recrutement/i;
export const estTransversal = (f) => SECTEURS_TRANSVERSAUX.has(f.secteur) && !METIER_PROPRE.test(f.nom);

/** The fifteen families the 282 activities are sorted in, as a visitor reads them. */
export const FAMILLES_ACTIVITE = {
  industrie: 'Industrie', batiment: 'Bâtiment', artisanat: 'Artisanat et commerce de proximité', 'commerce-detail': 'Commerce de détail',
  'negoce-gros': 'Négoce et commerce de gros', 'transport-logistique': 'Transport et logistique', agriculture: 'Agriculture',
  'environnement-energie': 'Environnement et énergie', 'sante-social': 'Santé et social', 'hotellerie-tourisme': 'Hôtellerie, restauration et loisirs',
  'services-entreprises': 'Services aux entreprises', 'numerique-audiovisuel': 'Numérique et audiovisuel',
  'automobile-mobilite': 'Automobile et mobilité', 'finance-immobilier': 'Finance et immobilier', 'public-associatif': 'Public et associatif',
};

// « gros œuvre »: the ligatures do not decompose, so they are spelt out.
const normaliser = (texte) => String(texte ?? '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '');
const mots = (texte) => normaliser(texte).split(/[^a-z0-9]+/).filter(Boolean);

// Words too common to say which trade someone is in: « commerce » is in thirty
// activity names, « services » in twenty.
const VIDES = new Set(['commerce', 'services', 'service', 'numerique', 'conseil', 'gestion', 'vente', 'location', 'production',
  'centre', 'activite', 'agence', 'entreprise', 'travaux', 'general', 'generale', 'detail', 'industrie', 'industriel', 'magasin',
  'saison', 'saisonnier', 'produits', 'transport', 'cabinet', 'societe', 'maison', 'atelier', 'boutique', 'reseau', 'materiel',
  // …and the words of job titles, which say the role and not the trade:
  // « assistant » must not read as « assistante maternelle », a nursery.
  'assistant', 'agent', 'responsable', 'gestionnaire', 'charge', 'technicien', 'conseiller', 'operateur', 'operations',
  'analyste', 'manager', 'specialiste', 'coordinateur', 'directeur', 'relation', 'client', 'clients', 'accueil', 'planning']);

// A word's root: « imprimerie », « imprimeur » and « imprimeurs » all start
// with « imprim ». Six letters is long enough not to join unrelated words.
const RACINE = 6;
const racineDe = (m) => m.slice(0, RACINE);
// Compared by root, so « activités » and « industrielle » are as empty as
// « activité » and « industrie ».
const RACINES_VIDES = new Set([...VIDES].map(racineDe));
const racines = (textes) => new Set(textes.flatMap(mots).filter((m) => m.length >= 5).map(racineDe).filter((r) => !RACINES_VIDES.has(r)));

/**
 * The activities the query names, best first. A whole alias in the query
 * (« arts graphiques ») counts most; otherwise a significant word sharing its
 * root with the activity's name or an alias (« imprimeur », « imprimerie »).
 */
export function activitesReconnues(requete, activites, limite = 3) {
  // Whole words only: the alias « PAC » is in « PAC air-eau », not in « espace ».
  const q = ` ${mots(requete).join(' ')} `;
  const leurs = racines([requete]);
  if (!q.trim()) return [];
  return activites
    .map((a) => {
      const noms = [a.nom, ...(a.alias ?? [])];
      let score = 0;
      for (const n of noms) if (q.includes(` ${mots(n).join(' ')} `)) score += 3;
      for (const r of racines(noms)) if (leurs.has(r)) score += 1;
      // « agriculteur » names no activity but its family, agriculture.
      for (const r of racines([a.famille ?? ''])) if (leurs.has(r)) score += 0.5;
      return { a, score };
    })
    .filter((r) => r.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limite)
    .map((r) => r.a);
}

// Software a twentieth of the catalogue is qualified on (a spreadsheet, an
// office suite) says nothing about a trade: a process analyst works in it too.
const communsPar = new WeakMap();
function logicielsCommuns(fiches) {
  if (!communsPar.has(fiches)) {
    const n = new Map();
    for (const f of fiches) for (const q of f.qualifications?.logiciels ?? []) n.set(q.logiciel, (n.get(q.logiciel) ?? 0) + 1);
    communsPar.set(fiches, new Set([...n].filter(([, k]) => k > fiches.length / 20).map(([id]) => id)));
  }
  return communsPar.get(fiches);
}

// The staff of a real company of the trade, service by service, under the
// titles the trade gives its jobs (catalogue/personnel.json, sourced from the
// France Travail ROME fiches). max, 08/10, testing his own trade: Google lists
// a print shop's whole staff, down to the prépresse operator who checks the
// resolution and lays out the imposition, the CTP technician who drives the
// RIP and the proofreader; we showed a web designer and no one to price a job.
// A physical job (offset press operator, mason) is not an agent: it is listed
// under `terrain` with the fiche that prepares its work. outils/verifier-personnel.ts
// refuses an activity whose staff is incomplete.
const ORDRE = ['commercial', 'production', 'direction', 'gestion'];
const organigrammeDe = (activite) => personnel.organigrammes[personnel.activites[activite?.id]];

/**
 * The staff of an activity's company: { nom, sources, services: [{ id,
 * libelle, postes: [{ role, fiche }] }], terrain: [{ metier, fiche }] }, or
 * null for an activity the file does not know. A fiche missing from `fiches`
 * is skipped.
 */
export function personnelDeLActivite(activite, fiches) {
  const o = organigrammeDe(activite);
  if (!o) return null;
  const parId = new Map(fiches.map((f) => [f.id, f]));
  const libelle = (id) => (id === 'production' && o.libelleProduction) || (id === 'commercial' && o.libelleCommercial) || personnel.services[id];
  return {
    nom: o.nom,
    sources: o.sources,
    // Why a trade has no estimator (prices set by the health insurance), when it has none.
    sansDevis: o.sansDevis ?? null,
    services: ORDRE.map((id) => ({
      id,
      libelle: libelle(id),
      postes: (o[id] ?? []).filter(([, f]) => parId.has(f)).map(([role, f]) => ({ role, fiche: parId.get(f) })),
    })),
    terrain: (o.terrain ?? []).filter(([, f]) => parId.has(f)).map(([metier, f]) => ({ metier, fiche: parId.get(f) })),
  };
}

/**
 * The jobs that make the trade: who prices the job, who makes it, who runs
 * the company and who keeps its books, in that order: [{ role, fiche, service }].
 */
export function coeurDeLActivite(activite, fiches) {
  const p = personnelDeLActivite(activite, fiches);
  if (!p) return [];
  const vus = new Set();
  return p.services.flatMap((s) => s.postes.filter((x) => !vus.has(x.fiche.id) && vus.add(x.fiche.id)).map((x) => ({ ...x, service: s.libelle })));
}
/** Every id the organigrams name, for the bench. */
export const IDS_DU_COEUR = [...new Set(Object.values(personnel.organigrammes).flatMap((o) => ORDRE.flatMap((s) => (o[s] ?? []).map(([, id]) => id))))];

/**
 * The jobs that serve an activity, in four rings: those whose title shares a
 * root with the trade's own words, only for a trade whose staff is not known,
 * the staff of the trade (estimator, workshop, production, office),
 * those qualified on the activity's software, and the jobs every business
 * has. The last ring is never empty: there is always someone to recruit.
 */
export function cerclesDeLActivite(activite, fiches) {
  const sesRacines = racines(activite.alias ?? []);
  const communs = logicielsCommuns(fiches);
  const sesLogiciels = new Set((activite.pack?.logiciels ?? []).filter((id) => !communs.has(id)));
  const touches = (f) => mots(f.nom).filter((m) => sesRacines.has(racineDe(m))).length;
  // When the trade's real staff is known, a title that merely shares a root
  // with its words is not one of its jobs: « arts graphiques » brought the web
  // designer to a print shop. The staff comes first, and the other rings keep
  // only the branches that staff is drawn from.
  const coeur = coeurDeLActivite(activite, fiches).map((c) => c.fiche);
  const branches = coeur.length ? new Set(coeur.map((f) => f.secteur)) : null;
  const deSaBranche = (f) => !branches || branches.has(f.secteur);
  const proches = branches ? [] : fiches.filter((f) => touches(f) > 0).sort((x, y) => touches(y) - touches(x));
  const outilles = fiches.filter((f) => !coeur.includes(f) && deSaBranche(f) && (f.qualifications?.logiciels ?? []).some((q) => sesLogiciels.has(q.logiciel)));
  const pris = new Set([...proches, ...coeur, ...outilles]);
  return { proches, coeur, outilles, transversaux: fiches.filter((f) => !pris.has(f) && estTransversal(f)) };
}

/** The same rings as one list, closest first. */
export const metiersPourActivite = (activite, fiches) => {
  const c = cerclesDeLActivite(activite, fiches);
  return [...c.proches, ...c.coeur, ...c.outilles, ...c.transversaux];
};
