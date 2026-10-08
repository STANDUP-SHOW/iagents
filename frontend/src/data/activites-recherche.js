// Recognising the visitor's trade in what they type, and the jobs that serve
// it. A printer types « imprimerie », not « graphiste de production »: no
// fiche carries that word, but activity ACT-0021 does, in its name and
// aliases. Plain functions over the data they are given, so the library (in
// the browser), the search-engine pages and the bench (in node) share them.

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

// The heart of a trade, in the words its owner uses: who prices the job
// (every branch has an estimator), who plans the shop floor, who runs the
// production, who buys and who checks. No fiche title says « deviseur » or
// « chef d'atelier », so neither the title nor the software rings find them:
// a printer was offered graphic designers and no one to price his jobs.
// [role as the trade says it, fiche id]; a fiche missing from the catalogue
// is skipped, and the bench checks every id still exists.
const DEVIS = ['Deviseur', 'AG-0187'];
const COEUR_PAR_FAMILLE = {
  industrie: [['Deviseur', 'AG-1020'], ['Responsable de fabrication', 'AG-1025'], ["Chef d'atelier — planning de production", 'AG-1003'], ['Ordonnancement', 'AG-1004'], ['Assistant de production', 'AG-1001'], ['Approvisionnement matières', 'AG-1012'], ['Qualité', 'AG-1007']],
  batiment: [['Deviseur', 'AG-0703'], ['Métreur', 'AG-0704'], ['Conducteur de travaux', 'AG-0701'], ['Planning de chantier', 'AG-0706'], ['Achats chantier', 'AG-0707'], ['Appels d\'offres', 'AG-0705'], ['Qualité chantier', 'AG-0714']],
  artisanat: [['Deviseur', 'AG-0741'], ["Chef d'atelier — planning", 'AG-0742'], ['Assistant de production', 'AG-1001'], ['Approvisionnement', 'AG-1012'], ['Suivi des interventions', 'AG-0747']],
  'automobile-mobilite': [['Deviseur', 'AG-0805'], ['Chiffrage des réparations', 'AG-0822'], ["Chef d'atelier — planning", 'AG-0806'], ["Support de l'atelier", 'AG-0821'], ['Commande de pièces', 'AG-0807'], ['Suivi des réparations', 'AG-0808']],
  'environnement-energie': [['Deviseur', 'AG-0980'], ['Planification des interventions', 'AG-0981'], ['Maintenance', 'AG-0982'], ['Qualification des travaux', 'AG-0984']],
  'transport-logistique': [['Deviseur — cotation transport', 'AG-0542'], ['Planification des tournées', 'AG-0553'], ['Exploitation — dispatching', 'AG-0551'], ['Planning entrepôt', 'AG-0533'], ['Affrètement', 'AG-0571']],
  'negoce-gros': [DEVIS, ['Prise de commande', 'AG-1021'], ['Approvisionnement', 'AG-1012'], ['Prévision des stocks', 'AG-0534'], ['Livraisons', 'AG-0537']],
  'commerce-detail': [DEVIS, ['Approvisionnement', 'AG-1012'], ['Stocks', 'AG-0545'], ['Achats', 'AG-0505']],
  agriculture: [DEVIS, ['Planning de production', 'AG-1003'], ['Traçabilité', 'AG-1008'], ['Approvisionnement', 'AG-1012'], ['Qualité', 'AG-1007']],
  'hotellerie-tourisme': [['Devis groupes et séminaires', 'AG-0911'], ['Planning des équipes', 'AG-0609'], ['Achats', 'AG-0610'], ['Stocks', 'AG-0611']],
  'services-entreprises': [DEVIS, ['Propositions commerciales', 'AG-0187']],
  'sante-social': [['Planning des rendez-vous et des soins', 'AG-0695'], ['Devis et prises en charge', 'AG-0684']],
  'finance-immobilier': [['Conseiller de clientèle', 'AG-0101'], ['Montage des dossiers de crédit', 'AG-0109'], ['Analyse crédit', 'AG-0107'], ['Connaissance client (KYC)', 'AG-0103'], ['Conformité', 'AG-0110']],
  'public-associatif': [['Gestion du courrier', 'AG-0009'], ['Subventions', 'AG-0937'], ["Appels d'offres et marchés", 'AG-0705'], ['Gestion documentaire', 'AG-0006']],
  'numerique-audiovisuel': [DEVIS, ['Planning de production', 'AG-1003'], ['Assistant de production', 'AG-1001']],
};
// Within a family, some trades have their own heart: a restaurant is a
// kitchen before it is a hotel, a print shop is a factory, a plumber works
// on small jobs rather than building sites. [name pattern, table, family the
// pattern is limited to]: « peinture » is a painter in building, a body shop
// in automotive.
const COEUR_PAR_ACTIVITE = [
  [/patrimoine/i, [['Gestion de portefeuille', 'AG-0054'], ["Conseil en investissement", 'AG-0053'], ['Connaissance client (KYC)', 'AG-0103'], ['Conformité', 'AG-0110']], 'finance-immobilier'],
  [/financement|cr[ée]dit/i, [['Analyse crédit', 'AG-0052'], ['Montage des dossiers de financement', 'AG-0109'], ['Analyse de financement', 'AG-0070'], ['Recouvrement', 'AG-0112']], 'finance-immobilier'],
  [/association/i, [['Adhésions', 'AG-0927'], ['Dons', 'AG-0928'], ['Subventions', 'AG-0937'], ['Bénévoles', 'AG-0929'], ['Événements', 'AG-0930']], 'public-associatif'],
  [/fondation|m[ée]c[ée]nat/i, [['Dons et mécénat', 'AG-0928'], ['Recherche de financements', 'AG-0938'], ['Partenaires', 'AG-0948'], ["Rapport d'activité", 'AG-0939']], 'public-associatif'],
  [/syndica|organisation professionnelle/i, [['Adhésions et cotisations', 'AG-0927'], ['Relation adhérents', 'AG-0932'], ['Événements', 'AG-0930'], ['Support des membres', 'AG-0933']], 'public-associatif'],
  [/bailleur/i, [['Relation locataires', 'AG-0467'], ['Gestion locative', 'AG-0459'], ['Réclamations locataires', 'AG-0847'], ['Attribution — qualification des dossiers', 'AG-0832']], 'public-associatif'],
  [/enseignement sup/i, [['Inscriptions', 'AG-0644'], ['Vie étudiante', 'AG-0643'], ['Examens et certifications', 'AG-0642'], ['Conception des cours', 'AG-0627']], 'public-associatif'],
  [/enseignement|scolaire/i, [['Assistant pédagogique', 'AG-0626'], ['Préparation des cours', 'AG-0632'], ['Inscriptions', 'AG-0644'], ['Évaluations', 'AG-0641']], 'public-associatif'],
  [/sant[ée]/i, [['Admissions — dossier patient', 'AG-0681'], ['Planning des rendez-vous et des soins', 'AG-0695'], ['Facturation des soins', 'AG-0683'], ['Codage', 'AG-0685']], 'public-associatif'],
  [/plomb|chauff|[ée]lectric|peintur|carrel|couvert|couvreur|serrur|vitr|pl[aâ]tr|plaqu|climati|isolation|menuiserie de pose|fa[çc]ade|ramonage|cl[ôo]ture|piscine/i, [['Deviseur', 'AG-0741'], ['Métreur', 'AG-0704'], ['Planning des chantiers', 'AG-0742'], ['Suivi des interventions', 'AG-0747'], ['Achats chantier', 'AG-0707'], ['Service après-vente', 'AG-0743']], 'batiment'],
  [/boulang|p[âa]tiss|boucher|charcut|chocolat|confiser|fromag|glaci|biscuit/i, [['Devis commandes (événements, entreprises)', 'AG-0741'], ['Planning de production du laboratoire', 'AG-1003'], ['Assistant de production', 'AG-1001'], ['Approvisionnement matières', 'AG-1012'], ['Traçabilité et hygiène', 'AG-1008'], ['Stocks', 'AG-0545']]],
  [/diagnostic/i, [['Deviseur', 'AG-0741'], ['Planning des rendez-vous de diagnostic', 'AG-0742'], ['Suivi des interventions', 'AG-0747']], 'batiment'],
  [/immobili|syndic|lotissement|foncier|marchand de biens/i, [['Estimation — avis de valeur', 'AG-0464'], ['Gestion locative', 'AG-0458'], ['Syndic', 'AG-0460']], 'finance-immobilier'],
  [/assurance|mutuelle|pr[ée]voyance/i, [['Devis et tarification', 'AG-1150'], ['Souscription', 'AG-0081'], ["Appels d'offres", 'AG-1158']]],
  [/coiffure|barbier|esth[ée]ti|onglerie|tatou/i, [['Devis prestations (mariages, événements)', 'AG-0741'], ['Planning des rendez-vous', 'AG-0742'], ['Stocks de produits', 'AG-0545']]],
  [/restaura|traiteur|bar, caf|brasserie/i, [['Devis groupes et traiteur', 'AG-0622'], ['Chef de cuisine — menus et fiches techniques', 'AG-0612'], ['Planning de la brigade', 'AG-0609'], ['Achats cuisine', 'AG-0610'], ['Stocks et inventaire', 'AG-0611'], ['Commandes et vente à emporter', 'AG-0607']]],
  [/imprim|reprograph/i, [['Deviseur', 'AG-1020'], ['Responsable de fabrication', 'AG-1025'], ["Chef d'atelier — planning de production", 'AG-1003'], ['Ordonnancement des machines', 'AG-1004'], ['Assistant de production', 'AG-1001'], ['Achats papier et consommables', 'AG-1005'], ['Qualité', 'AG-1007']]],
  [/nettoyage|propret/i, [['Deviseur', 'AG-0777'], ['Planning des équipes', 'AG-0778'], ['Affectation des intervenants', 'AG-0780'], ['Contrôle qualité', 'AG-0789']]],
  [/paysag|jardin|espaces verts/i, [['Deviseur', 'AG-0753'], ['Planning des chantiers', 'AG-0754'], ['Suivi de chantier', 'AG-0756'], ['Calcul du matériel', 'AG-0762']]],
  [/voyage|r[ée]ceptif|touristi/i, [['Devis et cotation des voyages', 'AG-0593'], ['Conception des circuits', 'AG-0585'], ['Réservations', 'AG-0578'], ['Opérations voyage', 'AG-0599']], 'hotellerie-tourisme'],
  [/sport|fitness/i, [['Devis entreprises et comités', 'AG-0187'], ['Abonnements', 'AG-0865'], ['Planning des cours et des coachs', 'AG-0609'], ['Réservations', 'AG-0578']], 'hotellerie-tourisme'],
  [/communication|publicit|relations presse/i, [['Deviseur', 'AG-0187'], ['Propositions commerciales', 'AG-0188'], ['Chef de projet — planning de production', 'AG-0015'], ['Planning médias', 'AG-0249'], ['Trafic des campagnes', 'AG-0237']]],
  [/architect|g[ée]om[èe]tre|ing[ée]nierie/i, [["Devis d'honoraires", 'AG-0703'], ['Métreur', 'AG-0704'], ["Appels d'offres", 'AG-0705'], ['Planning des projets', 'AG-0706']]],
  [/comptab|commissariat aux comptes/i, [['Devis et lettres de mission', 'AG-0187'], ['Production — saisie', 'AG-0027'], ['Révision et clôture', 'AG-0035'], ['Paie des clients', 'AG-0037']]],
  [/formation/i, [['Devis de formation', 'AG-0187'], ['Conception des formations', 'AG-0627'], ['Planning des sessions', 'AG-0639'], ['Inscriptions', 'AG-0644']]],
  [/traduction/i, [['Deviseur', 'AG-0187'], ['Coordination des traductions', 'AG-0346'], ['Post-édition', 'AG-0338']]],
  [/[ée]v[ée]nement|salon|congr/i, [['Deviseur', 'AG-0911'], ['Planning événement', 'AG-0909'], ['Budget', 'AG-0910'], ['Fournisseurs', 'AG-0908']]],
];

/**
 * The jobs at the heart of a trade, each under the name the trade gives the
 * role: [{ role, fiche }]. Every trade that sells a job gets its estimator.
 */
export function coeurDeLActivite(activite, fiches) {
  const parId = new Map(fiches.map((f) => [f.id, f]));
  const table = COEUR_PAR_ACTIVITE.find(([motif, , famille]) => motif.test(activite.nom) && (!famille || famille === activite.famille))?.[1] ?? COEUR_PAR_FAMILLE[activite.famille] ?? [];
  const vus = new Set();
  return table.flatMap(([role, id]) => (parId.has(id) && !vus.has(id) && vus.add(id) ? [{ role, fiche: parId.get(id) }] : []));
}
/** Every id the tables name, for the bench. */
export const IDS_DU_COEUR = [...new Set([...Object.values(COEUR_PAR_FAMILLE), ...COEUR_PAR_ACTIVITE.map(([, t]) => t)].flat().map(([, id]) => id))];

/**
 * The jobs that serve an activity, in four rings: those whose title shares a
 * root with the trade's own words (« Graphiste de production » for « arts
 * graphiques »), the heart of the trade (estimator, workshop, production),
 * those qualified on the activity's software, and the jobs every business
 * has. The last ring is never empty: there is always someone to recruit.
 */
export function cerclesDeLActivite(activite, fiches) {
  const sesRacines = racines(activite.alias ?? []);
  const communs = logicielsCommuns(fiches);
  const sesLogiciels = new Set((activite.pack?.logiciels ?? []).filter((id) => !communs.has(id)));
  const touches = (f) => mots(f.nom).filter((m) => sesRacines.has(racineDe(m))).length;
  const proches = fiches.filter((f) => touches(f) > 0).sort((x, y) => touches(y) - touches(x));
  const coeur = coeurDeLActivite(activite, fiches).map((c) => c.fiche).filter((f) => !proches.includes(f));
  const outilles = fiches.filter((f) => !proches.includes(f) && !coeur.includes(f) && (f.qualifications?.logiciels ?? []).some((q) => sesLogiciels.has(q.logiciel)));
  const pris = new Set([...proches, ...coeur, ...outilles]);
  return { proches, coeur, outilles, transversaux: fiches.filter((f) => !pris.has(f) && estTransversal(f)) };
}

/** The same rings as one list, closest first. */
export const metiersPourActivite = (activite, fiches) => {
  const c = cerclesDeLActivite(activite, fiches);
  return [...c.proches, ...c.coeur, ...c.outilles, ...c.transversaux];
};
