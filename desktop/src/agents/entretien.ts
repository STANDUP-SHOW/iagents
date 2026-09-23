/**
 * L'entretien d'embauche.
 *
 * Le client n'installe pas un agent : il l'embauche. Le premier jour, l'agent ouvre la
 * conversation et demande ce que tourne l'entreprise — « avec quel logiciel de paie
 * travaillez-vous ? » — puis reconnaît la réponse dans catalogue/logiciels.json et écrit sa
 * configuration. C'est la première impression du produit, et c'est aussi le seul moment où
 * l'on peut dire la vérité sans la vendre : savoir tenir un outil et y être branché sont deux
 * choses. Ce module ne branche rien. Il dit ce qui est possible, et nomme ce qui ne l'est pas.
 */

export type NiveauApi = 'officielle' | 'limitee' | 'partenaire' | 'aucune' | 'a-confirmer';
export type StatutMcp = 'officiel' | 'communautaire' | 'a-developper' | 'aucun';

export interface AccesLogiciel {
  api: NiveauApi;
  mcp: StatutMcp;
  navigateur: boolean;
  fichier: boolean;
}

export interface Logiciel {
  id: string;
  nom: string;
  editeur: string;
  categorie: string;
  domaines: string[];
  pays: string;
  marches: string[];
  deploiement: 'cloud' | 'serveur' | 'serveur-et-cloud';
  acces: AccesLogiciel;
  alias?: string[];
  note?: string;
}

export interface Referentiel {
  categories: string[];
  domaines: string[];
  logiciels: Logiciel[];
}

export interface Qualification {
  logiciel: string;
  usage: string;
  principal?: boolean;
}

export interface FicheQualifiee {
  nom: string;
  qualifications?: { logiciels: Qualification[] };
}

/** Comment l'agent atteint réellement l'outil une fois embauché. */
export type Portee = 'api' | 'api-partielle' | 'navigateur' | 'fichier' | 'aucune';

/**
 * Une question par famille d'outils, jamais une par produit : personne ne répond à six
 * questions d'affilée sur sa comptabilité.
 */
export interface Question {
  categorie: string;
  intitule: string;
  /** Ce que l'agent sait tenir dans cette famille, cité pour aider le client à répondre. */
  propositions: string[];
  /** Vrai quand le poste n'existe pas sans un outil de cette famille. */
  principale: boolean;
}

export interface Reponse {
  categorie: string;
  /** Ce que le client a dit, tel quel. */
  dit: string;
}

export type Reconnaissance =
  | { etat: 'reconnu'; logiciel: Logiciel }
  | { etat: 'ambigu'; candidats: Logiciel[] }
  /** Le client dit qu'il n'a pas d'outil pour cette famille : c'est une reponse, pas un echec. */
  | { etat: 'sans-outil'; dit: string }
  | { etat: 'inconnu'; dit: string };

export interface OutilRetenu {
  logiciel: Logiciel;
  qualification: Qualification;
  portee: Portee;
}

export interface Configuration {
  /** Les outils que l'agent sait tenir et que le client emploie. */
  retenus: OutilRetenu[];
  /** Reconnus au référentiel, mais que cette fiche n'a jamais déclaré savoir tenir. */
  horsMetier: Logiciel[];
  /** Ce que le client a nommé et que le référentiel ignore, conservé mot pour mot. */
  inconnus: string[];
  /** Familles pour lesquelles le client a dit n'avoir aucun outil. */
  sansOutil: { categorie: string; dit: string }[];
  /** Réponses qui désignent plusieurs produits : l'agent redemande au lieu de choisir. */
  aPreciser: { categorie: string; dit: string; candidats: Logiciel[] }[];
  /** Familles restées sans réponse, dont celles sans lesquelles le poste ne tient pas. */
  sansReponse: { categorie: string; principale: boolean }[];
}

export const INTITULES: Record<string, string> = {
  erp: "Quel logiciel de gestion faites-vous tourner, votre ERP ?",
  crm: "Où sont vos clients et vos affaires en cours, quel CRM ?",
  comptabilite: "Avec quel logiciel tenez-vous votre comptabilité ?",
  'cabinet-comptable': "Votre cabinet comptable travaille sur quel outil ?",
  facturation: "Vos devis et vos factures, vous les faites où ?",
  paie: "Votre paie se fait sur quel logiciel ?",
  sirh: "Vos dossiers du personnel, congés et absences, c'est quel outil ?",
  ats: "Vos candidatures arrivent dans quel logiciel ?",
  tresorerie: "Votre trésorerie et vos comptes bancaires, c'est quel outil ?",
  'note-de-frais': "Les notes de frais passent par quoi ?",
  achats: "Vos commandes fournisseurs se passent dans quel outil ?",
  'conformite-fournisseurs': "Les attestations et le risque de vos fournisseurs sont contrôlés avec quoi ?",
  ecommerce: "Votre boutique en ligne tourne sur quelle plateforme ?",
  'avis-clients': "Vous recueillez les avis de vos clients avec quel service ?",
  'seo-referencement': "Votre référencement naturel est suivi avec quel outil ?",
  'sourcing-fournisseurs': "Vous trouvez vos produits et vos fournisseurs sur quelle plateforme ?",
  automatisation: "Vos échanges automatiques entre logiciels passent par quel outil ?",
  caisse: "Quelle caisse avez-vous en magasin ?",
  pim: "Vos fiches produits sont tenues dans quel outil ?",
  marketing: "Vos campagnes et vos envois partent de quel outil ?",
  'base-de-donnees': "Vos données applicatives sont dans quelle base ?",
  'data-plateforme': "Vos données sont regroupées dans quel entrepôt ou quelle plateforme ?",
  'gouvernance-donnees': "Vous tenez le catalogue et la qualité de vos données avec quel outil ?",
  'annotation-donnees': "Vos jeux de données sont annotés avec quel outil ?",
  'analytique-produit': "Vous suivez l'usage de votre produit ou de votre site avec quel outil ?",
  securite: "Vous protégez et vous surveillez votre informatique avec quels outils ?",
  'identite-acces': "Les comptes et les accès de vos équipes sont gérés avec quel outil ?",
  'itsm-inventaire': "Votre parc informatique et vos demandes internes sont suivis avec quel outil ?",
  traduction: "Vos traductions passent par quel outil ou quelle agence ?",
  developpement: "Vos développements sont suivis sur quel outil ?",
  'hebergement-infra': "Vos applications tournent chez quel hébergeur ?",
  publicite: "Vous achetez votre publicité en ligne sur quelles plateformes ?",
  cms: "Votre site internet est géré avec quel outil ?",
  'montage-video': "Vos vidéos sont montées avec quel logiciel ?",
  'audio-production': "Vous enregistrez et montez le son avec quoi ?",
  'transcription-sous-titres': "Vos transcriptions et vos sous-titres passent par quel outil ?",
  'veille-medias': "Vous suivez ce qui se dit de vous avec quel outil ?",
  'communication-interne': "Vos équipes reçoivent les informations internes par quel outil ?",
  affiliation: "Votre programme d'affiliation tourne sur quelle plateforme ?",
  'support-client': "Les demandes de vos clients arrivent où ?",
  bi: "Vos tableaux de bord sont faits avec quoi ?",
  ged: "Où sont rangés vos documents ?",
  signature: "Vos signatures électroniques passent par quel service ?",
  'gestion-projet': "Vous suivez vos projets dans quel outil ?",
  gpao: "Votre production est pilotée par quel logiciel ?",
  gmao: "Votre maintenance est suivie dans quel outil ?",
  qualite: "Votre démarche qualité est tenue dans quel logiciel ?",
  wms: "Votre entrepôt tourne sur quel logiciel ?",
  tms: "Vos transports sont organisés dans quel outil ?",
  expedition: "Vos expéditions partent avec quel transporteur ou quelle plateforme ?",
  btp: "Vos chantiers et vos devis sont gérés dans quel logiciel ?",
  'metre-estimation': "Vos métrés et vos chiffrages se font dans quel logiciel ?",
  'bim-maquette': "Vous travaillez la maquette numérique avec quel outil ?",
  'suivi-chantier-reserves': "Vos comptes rendus de chantier et vos réserves passent par quoi ?",
  'facility-management': "Votre patrimoine bâti et vos prestataires sont suivis où ?",
  immobilier: "Vos biens et vos mandats sont dans quel logiciel ?",
  'visite-etat-des-lieux': "Vos visites et vos états des lieux se font avec quel outil ?",
  sante: "Votre logiciel de cabinet ou de patientèle, c'est lequel ?",
  dentaire: "Vos fauteuils, vos devis et vos schémas dentaires sont tenus dans quoi ?",
  'laboratoire-analyses': "Vos demandes d'analyse et vos comptes rendus passent par quel logiciel ?",
  'facturation-sante': "Votre télétransmission et votre tiers payant passent par quoi ?",
  teleconsultation: "Vos consultations à distance se font sur quelle plateforme ?",
  'dictee-medicale': "Vos comptes rendus sont dictés avec quel outil ?",
  juridique: "Vos dossiers sont suivis dans quel logiciel de cabinet ?",
  'clm-contrats': "Vos contrats sont rédigés et suivis dans quel outil ?",
  'recherche-juridique': "Vous cherchez vos textes et votre jurisprudence sur quelle base ?",
  'conformite-rgpd': "Votre registre des traitements et vos consentements sont tenus avec quel outil ?",
  'propriete-intellectuelle': "Vos marques et vos brevets sont suivis dans quel outil ?",
  'banque-assurance': "Vos contrats sont gérés dans quel outil ?",
  hotellerie: "Votre logiciel de réservation, c'est lequel ?",
  restauration: "Vos réservations et vos commandes passent par quoi ?",
  tourisme: "Vos dossiers voyage sont montés dans quel outil ?",
  education: "Vos cours en ligne sont hébergés sur quelle plateforme ?",
  'gestion-organisme-formation': "Vos sessions, vos stagiaires et vos financements sont suivis dans quoi ?",
  'creation-elearning': "Vos modules de formation sont fabriqués avec quel outil ?",
  'animation-interactive': "Vous animez vos séances avec quel outil de votes et d'ateliers ?",
  'evaluation-certification': "Vos examens et vos certifications passent par quelle plateforme ?",
  'apprentissage-langues': "Vos formations en langues se suivent sur quelle plateforme ?",
  automobile: "Votre atelier et vos ventes tournent sur quel logiciel ?",
  agriculture: "Vos parcelles et vos interventions sont suivies dans quoi ?",
  'services-terrain': "Vos interventions et vos rendez-vous se planifient où ?",
  bureautique: "Vous travaillez sur Microsoft 365, Google Workspace, ou autre chose ?",
  telephonie: "Vos appels passent par quel système ?",
  association: "Vos adhérents et vos dons sont gérés dans quel outil ?",
  transport: "Vos tournées et vos véhicules sont suivis dans quoi ?",
  'gouvernante-hotel': "Le ménage des chambres et les demandes de dépannage passent par quoi ?",
  'gestion-restaurant': "Vos fiches techniques et votre coût matière sont tenus dans quel outil ?",
  'banquet-traiteur': "Vos séminaires, banquets et prestations traiteur se devisent dans quoi ?",
  'crm-hotelier': "Votre fichier client et vos relances après séjour sont tenus dans quel outil ?",
  'location-saisonniere': "Vos logements et vos calendriers de location sont gérés dans quoi ?",
  'revenue-management': "Vos prix de chambre ou de séjour sont pilotés avec quel outil ?",
  'voyage-affaires': "Les déplacements professionnels se réservent dans quel outil ?",
  'temps-de-conduite': "Les temps de conduite et de repos de vos conducteurs sont relevés avec quoi ?",
  'taxi-vtc': "Vos courses et vos chauffeurs sont affectés depuis quelle application ?",
  'carburant-peage': "Vos cartes carburant et vos badges de péage viennent de quel fournisseur ?",
  evenementiel: "Vos inscriptions et votre billetterie passent par quel outil ?",
  'mobilite-internationale': "Vos dossiers de visa et d'expatriation sont suivis dans quel outil ?",
  energie: "Vos consommations d'énergie sont relevées dans quel outil ?",
  'rse-carbone': "Votre bilan carbone et vos données RSE sont tenus dans quoi ?",
  'audit-grc': "Vos missions d'audit et le suivi des recommandations passent par quel outil ?",
  'design-creation': "Vos visuels, vous les faites avec quoi ?",
  'dam-marque': "Où sont rangés vos visuels et votre charte graphique ?",
  prospection: "Pour trouver de nouveaux clients, vous vous servez de quoi ?",
  'appels-offres': "Les appels d'offres, vous les suivez où ?",
  'donnees-marche': "Vos données de marché et vos cours, vous les prenez où ?",
  fiscalite: "Vos déclarations fiscales partent par quel outil ?",
  consolidation: "Votre consolidation et votre reporting groupe se font sur quoi ?",
};

/**
 * « On n'a rien », « à la main », « sur papier » : une famille sans outil est une réponse
 * pleine, pas une incompréhension. La confondre avec un logiciel inconnu ferait redemander
 * sans fin une chose qui n'existe pas.
 */
const SANS_OUTIL = [
  /\brien\b/, /\baucun\b/, /\baucune\b/, /\bpas d[eu]\b/, /\bon n en a pas\b/,
  /\bon n a pas\b/, /\bpapier\b/, /\ba la main\b/, /\bmanuel/, /\bnon\b/,
  /\bpas encore\b/, /\bje ne sais pas\b/, /\bon fait sans\b/,
];

/** Les accents et la ponctuation ne comptent pas : le client parle, il n'épelle pas. */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function appellations(l: Logiciel): string[] {
  return [l.nom, ...(l.alias ?? [])];
}

/**
 * Vrai quand `mot` apparaît dans `phrase` en mots entiers : « SAP » est dans « on est sur
 * SAP », pas dans « sapin ». Le client parle, il ne découpe pas ses phrases pour nous.
 */
export function contientMot(phrase: string, mot: string): boolean {
  if (!mot) return false;
  for (let i = phrase.indexOf(mot); i !== -1; i = phrase.indexOf(mot, i + 1)) {
    const avant = i === 0 || phrase[i - 1] === ' ';
    const apres = i + mot.length === phrase.length || phrase[i + mot.length] === ' ';
    if (avant && apres) return true;
  }
  return false;
}

/**
 * Ce que l'agent peut réellement faire dans l'outil. Une API officielle reste une promesse à
 * ouvrir sur le compte du client ; c'est pourquoi la phrase ne dit jamais « je suis connecté ».
 */
export function porteeReelle(l: Logiciel): Portee {
  if (l.acces.api === 'officielle') return 'api';
  if (l.acces.api === 'limitee' || l.acces.api === 'partenaire') return 'api-partielle';
  if (l.acces.navigateur) return 'navigateur';
  if (l.acces.fichier) return 'fichier';
  return 'aucune';
}

export function phrasePortee(l: Logiciel): string {
  switch (porteeReelle(l)) {
    case 'api':
      return `${l.nom} a une interface officielle : je peux y lire et y écrire une fois l'accès ouvert sur votre compte.`;
    case 'api-partielle':
      return `${l.nom} n'ouvre qu'une partie de ses données : je ferai ce qui passe par là, et le reste dans votre navigateur.`;
    case 'navigateur':
      return `${l.nom} n'a pas d'interface pour moi : je travaillerai dans votre navigateur, avec vos sessions à vous, et vous validerez avant tout envoi.`;
    case 'fichier':
      return `${l.nom} ne me laisse que les imports et les exports de fichiers : je préparerai les fichiers, vous les chargerez.`;
    default:
      return `${l.nom} ne m'est pas accessible aujourd'hui. Je vous dirai ce qui bloque plutôt que de faire semblant.`;
  }
}

/** Les familles d'outils dont l'agent a besoin, les indispensables d'abord. */
export function questionsEntretien(fiche: FicheQualifiee, ref: Referentiel): Question[] {
  const parId = new Map(ref.logiciels.map((l) => [l.id, l]));
  const familles = new Map<string, { noms: string[]; principale: boolean }>();
  for (const q of fiche.qualifications?.logiciels ?? []) {
    const l = parId.get(q.logiciel);
    if (!l) continue;
    const f = familles.get(l.categorie) ?? { noms: [], principale: false };
    f.noms.push(l.nom);
    if (q.principal) f.principale = true;
    familles.set(l.categorie, f);
  }
  const ordre = [...familles.entries()].sort((a, b) => {
    if (a[1].principale !== b[1].principale) return a[1].principale ? -1 : 1;
    return ref.categories.indexOf(a[0]) - ref.categories.indexOf(b[0]);
  });
  return ordre.map(([categorie, f]) => ({
    categorie,
    intitule: INTITULES[categorie] ?? `Quel outil utilisez-vous pour ${categorie.replace(/-/g, ' ')} ?`,
    propositions: f.noms,
    principale: f.principale,
  }));
}

/**
 * Reconnaît ce que le client vient de dire. « Sage » seul désigne huit produits : l'agent
 * redemande plutôt que de choisir à sa place, parce qu'un mauvais choix ici se découvre
 * trois semaines plus tard.
 */
export function reconnaitre(dit: string, ref: Referentiel, categorie?: string): Reconnaissance {
  const d = normaliser(dit);
  if (!d) return { etat: 'inconnu', dit };
  const candidats = categorie ? ref.logiciels.filter((l) => l.categorie === categorie) : ref.logiciels;
  const pool = candidats.length ? candidats : ref.logiciels;

  const exacts = pool.filter((l) => appellations(l).some((a) => normaliser(a) === d));
  if (exacts.length === 1) return { etat: 'reconnu', logiciel: exacts[0] };
  if (exacts.length > 1) return { etat: 'ambigu', candidats: exacts };

  // Le client dit « on est sur Pennylane » ou « Sage » : on cherche dans les deux sens,
  // mais sur des mots entiers. Sans cette borne, « tout est sur papier » tombe sur PAP,
  // « Pipedrive » sur Drive et « Lexoffice » sur Office : l'agent demande alors au client
  // de choisir entre l'outil qu'il vient de nommer et un autre qu'il n'a jamais cité.
  const partiels = pool.filter((l) =>
    appellations(l).some((a) => {
      const n = normaliser(a);
      return contientMot(d, n) || contientMot(n, d);
    })
  );
  if (partiels.length === 1) return { etat: 'reconnu', logiciel: partiels[0] };
  if (partiels.length > 1) return { etat: 'ambigu', candidats: partiels };

  // Hors de la famille attendue : le client répond parfois à côté, et il a souvent raison.
  if (categorie) {
    const ailleurs = reconnaitre(dit, ref);
    if (ailleurs.etat !== 'inconnu') return ailleurs;
  }
  // Aucun produit nommé : reste à savoir si le client dit qu'il n'en a pas.
  if (SANS_OUTIL.some((r) => r.test(d))) return { etat: 'sans-outil', dit };
  return { etat: 'inconnu', dit };
}

/**
 * Écrit la configuration issue de l'entretien. Rien n'y est branché : un outil retenu dit
 * seulement que l'agent sait le tenir et que le client l'emploie.
 */
export function configurer(
  fiche: FicheQualifiee,
  ref: Referentiel,
  reponses: readonly Reponse[]
): Configuration {
  const parId = new Map(ref.logiciels.map((l) => [l.id, l]));
  const qualifiees = new Map<string, Qualification>();
  for (const q of fiche.qualifications?.logiciels ?? []) qualifiees.set(q.logiciel, q);

  const config: Configuration = {
    retenus: [],
    horsMetier: [],
    inconnus: [],
    sansOutil: [],
    aPreciser: [],
    sansReponse: [],
  };
  const repondues = new Set<string>();

  for (const r of reponses) {
    if (!r.dit.trim()) continue;
    repondues.add(r.categorie);
    const v = reconnaitre(r.dit, ref, r.categorie);
    if (v.etat === 'ambigu') {
      config.aPreciser.push({ categorie: r.categorie, dit: r.dit, candidats: v.candidats });
      continue;
    }
    if (v.etat === 'sans-outil') {
      config.sansOutil.push({ categorie: r.categorie, dit: r.dit.trim() });
      continue;
    }
    if (v.etat === 'inconnu') {
      config.inconnus.push(r.dit.trim());
      continue;
    }
    const q = qualifiees.get(v.logiciel.id);
    if (!q) {
      // Reconnu, mais cette fiche n'a jamais dit savoir le tenir. On ne l'invente pas.
      if (!config.horsMetier.some((l) => l.id === v.logiciel.id)) config.horsMetier.push(v.logiciel);
      continue;
    }
    if (config.retenus.some((o) => o.logiciel.id === v.logiciel.id)) continue;
    config.retenus.push({ logiciel: v.logiciel, qualification: q, portee: porteeReelle(v.logiciel) });
  }

  for (const question of questionsEntretien(fiche, ref)) {
    if (!repondues.has(question.categorie)) {
      config.sansReponse.push({ categorie: question.categorie, principale: question.principale });
    }
  }
  return config;
}

/** Ce que l'agent dit à voix haute en fin d'entretien. Une ligne par chose vraie. */
export function resumeParle(config: Configuration): string[] {
  const lignes: string[] = [];
  for (const o of config.retenus) {
    lignes.push(`${o.qualification.usage} ${phrasePortee(o.logiciel)}`);
  }
  for (const p of config.aPreciser) {
    lignes.push(
      `Vous m'avez dit « ${p.dit} », et cela désigne plusieurs produits : ${p.candidats
        .map((c) => c.nom)
        .join(', ')}. Lequel est le vôtre ?`
    );
  }
  for (const l of config.horsMetier) {
    lignes.push(
      `Je connais ${l.nom}, mais ce n'est pas un outil de mon métier : je n'y toucherai pas sans que vous me montriez d'abord ce que vous attendez.`
    );
  }
  for (const s of config.sansOutil) {
    lignes.push(
      `Vous n'avez pas d'outil pour ${s.categorie.replace(/-/g, ' ')}. Je travaillerai depuis vos fichiers et vos dossiers, et je vous dirai le jour où cela nous coûte du temps.`
    );
  }
  for (const dit of config.inconnus) {
    lignes.push(
      `Je ne connais pas « ${dit} ». Je le note tel quel, et tant que personne ne me l'a montré, je ne prétendrai pas savoir m'en servir.`
    );
  }
  const manquants = config.sansReponse.filter((s) => s.principale);
  if (manquants.length) {
    lignes.push(
      `Il me manque l'essentiel : ${manquants
        .map((m) => m.categorie.replace(/-/g, ' '))
        .join(', ')}. Sans cela je peux commencer, mais pas faire mon travail en entier.`
    );
  }
  return lignes;
}

// ---------------------------------------------------------------------------
// Le reste de l'entretien : l'activité du client, ses horaires, l'intensité, la
// répartition local/API, l'autonomie et les dossiers.
//
// Max, 22/09/2026 : « il ne faut pas qu'il ait l'impression de devoir paramétrer comme les
// agents du marché, il doit sentir qu'il a affaire à un professionnel de son métier ».
// Un professionnel qui arrive dans une entreprise ne fait pas remplir un formulaire : il dit
// ce qu'il compte faire et demande si ça convient. Chaque question porte donc une proposition
// tirée de la fiche ; le client confirme ou corrige, il ne saisit rien.
// ---------------------------------------------------------------------------

export interface Activite {
  id: string;
  nom: string;
  famille: string;
  alias: string[];
  trait: string;
}

export interface ReferentielActivites {
  familles: string[];
  activites: Activite[];
}

export type SujetCadre = 'activite' | 'horaires' | 'intensite' | 'repartition' | 'autonomie' | 'dossiers';

export interface QuestionCadre {
  sujet: SujetCadre;
  /** La phrase telle qu'elle se prononce : une proposition, pas un champ à remplir. */
  intitule: string;
  /** Ce que l'agent propose, en clair. Le client n'a qu'à confirmer. */
  defaut: string;
  /** Les autres choix possibles, quand il y en a. */
  options?: string[];
}

export interface TacheFiche {
  nom: string;
  planification:
    | { type: 'quotidienne'; heure: string }
    | { type: 'hebdomadaire'; jour: string; heure: string }
    | { type: 'mensuelle'; jour: number; heure: string }
    | { type: 'intervalle'; minutes: number }
    | { type: 'declencheur'; evenement: string }
    | { type: 'a-la-demande' };
  entrees?: string[];
  sorties?: { dossier: string; format: string }[];
  validationHumaine?: boolean;
  active?: boolean;
}

export interface FicheCompelete extends FicheQualifiee {
  taches?: TacheFiche[];
}

/** Reconnaît l'activité que le client nomme, avec les mêmes règles que pour un logiciel. */
export function reconnaitreActivite(
  dit: string,
  ref: ReferentielActivites
): { etat: 'reconnu'; activite: Activite } | { etat: 'ambigu'; candidats: Activite[] } | { etat: 'inconnu'; dit: string } {
  const d = normaliser(dit);
  if (!d) return { etat: 'inconnu', dit };
  const mots = (a: Activite) => [a.nom, ...(a.alias ?? [])];
  const exacts = ref.activites.filter((a) => mots(a).some((m) => normaliser(m) === d));
  if (exacts.length === 1) return { etat: 'reconnu', activite: exacts[0] };
  if (exacts.length > 1) return { etat: 'ambigu', candidats: exacts };
  const partiels = ref.activites.filter((a) =>
    mots(a).some((m) => {
      const n = normaliser(m);
      return n.length > 3 && (d.includes(n) || n.includes(d));
    })
  );
  if (partiels.length === 1) return { etat: 'reconnu', activite: partiels[0] };
  if (partiels.length > 1) return { etat: 'ambigu', candidats: partiels.slice(0, 6) };
  return { etat: 'inconnu', dit };
}

/** Les heures que la fiche prévoit déjà : la première et la dernière de la journée. */
export function horairesDeLaFiche(taches: readonly TacheFiche[]): { debut: string; fin: string } | null {
  const heures = taches
    .filter((t) => t.active !== false)
    .map((t) => ('heure' in t.planification ? t.planification.heure : null))
    .filter((h): h is string => typeof h === 'string')
    .sort();
  if (!heures.length) return null;
  return { debut: heures[0], fin: heures[heures.length - 1] };
}

function enClair(heure: string): string {
  const [h, m] = heure.split(':');
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

const PREFIXE_DOSSIER = 'dossier:';

/** Les dossiers où l'agent écrira, pour qu'il les annonce avant d'y toucher. */
export function dossiersDeLaFiche(taches: readonly TacheFiche[]): string[] {
  const vus = new Set<string>();
  for (const t of taches) {
    if (t.active === false) continue;
    for (const s of t.sorties ?? []) vus.add(s.dossier);
    for (const e of t.entrees ?? []) if (e.startsWith(PREFIXE_DOSSIER)) vus.add(e.slice(PREFIXE_DOSSIER.length));
  }
  return [...vus].sort();
}

export interface CoutsParIntensite {
  light: number;
  medium: number;
  high: number;
}

/**
 * Les six questions de cadrage, dans l'ordre où elles se posent. Chacune porte déjà sa
 * réponse : le client confirme d'un mot. `couts` est la facture d'API mensuelle estimée par
 * intensité, pour que le choix se fasse sur un chiffre et non sur un adjectif.
 */
export function questionsCadre(
  fiche: FicheCompelete,
  couts?: CoutsParIntensite
): QuestionCadre[] {
  const taches = (fiche.taches ?? []).filter((t) => t.active !== false);
  const questions: QuestionCadre[] = [];

  questions.push({
    sujet: 'activite',
    intitule:
      "Et vous, vous faites quoi exactement ? Je connais mon métier, mais pas encore le vôtre : dites-le avec vos mots.",
    defaut: '',
  });

  const h = horairesDeLaFiche(taches);
  if (h) {
    // Une fiche dont les tâches tiennent dans la même heure n'a pas d'amplitude de journée :
    // annoncer « je commence à 9h et je finis à 10h » serait exact et ridicule.
    const reactives = taches.filter(
      (t) => t.planification.type === 'declencheur' || t.planification.type === 'intervalle'
    ).length;
    const surveille = reactives
      ? " À côté de ça je réagis aux événements dès qu'ils arrivent, sans attendre l'heure."
      : '';
    const plage =
      h.debut === h.fin
        ? `Je passe une fois par jour, à ${enClair(h.debut)}, du lundi au vendredi.${surveille} Ça vous va ?`
        : `Mes tâches tournent entre ${enClair(h.debut)} et ${enClair(h.fin)}, du lundi au vendredi.${surveille} Ça vous va, ou vos journées commencent plus tôt ?`;
    questions.push({
      sujet: 'horaires',
      intitule: plage,
      defaut:
        h.debut === h.fin
          ? `une fois par jour à ${enClair(h.debut)}, du lundi au vendredi`
          : `${enClair(h.debut)} – ${enClair(h.fin)}, du lundi au vendredi`,
    });
  }

  const chiffre = (n: number) => `environ ${Math.round(n)} € d'API par mois`;
  questions.push({
    sujet: 'intensite',
    intitule: couts
      ? `À quel rythme voulez-vous que je travaille ? Normal, c'est mon poste tel qu'il est écrit — ${chiffre(couts.medium)}. Léger, je fais l'essentiel — ${chiffre(couts.light)}. Soutenu, je surveille en continu et je creuse — ${chiffre(couts.high)}.`
      : "À quel rythme voulez-vous que je travaille : léger, normal, ou soutenu ?",
    defaut: 'Normal',
    options: ['Léger', 'Normal', 'Soutenu'],
  });

  questions.push({
    sujet: 'repartition',
    intitule:
      "Je peux tout faire tourner sur votre machine, sans rien payer au jeton — mais ce qu'elle ne tient pas, je ne le ferai pas. Ou bien j'envoie la part qui dépasse à l'API avec votre clé. Vous préférez quoi ?",
    defaut: 'Surtout local, une part par API',
    options: ['Tout sur votre machine', 'Surtout local, une part par API', 'Tout par API'],
  });

  const aValider = taches.filter((t) => t.validationHumaine);
  if (taches.length) {
    questions.push({
      sujet: 'autonomie',
      intitule: aValider.length
        ? `Sur mes ${taches.length} tâches, il y en a ${aValider.length} où j'attends votre accord avant d'agir — tout ce qui part à l'extérieur en fait partie. Je garde ça, ou vous voulez en relâcher ?`
        : `Mes ${taches.length} tâches tournent seules et je vous rends compte. Rien ne part à l'extérieur sans vous. Ça vous convient ?`,
      defaut: `${aValider.length} tâche(s) sur ${taches.length} attendent votre accord`,
    });
  }

  const dossiers = dossiersDeLaFiche(taches);
  if (dossiers.length) {
    questions.push({
      sujet: 'dossiers',
      intitule: `J'écrirai dans ${dossiers.length} dossier${dossiers.length > 1 ? 's' : ''} : ${dossiers.slice(0, 4).join(', ')}${dossiers.length > 4 ? ` et ${dossiers.length - 4} autre${dossiers.length - 4 > 1 ? 's' : ''}` : ''}. Dites-moi où ils se trouvent chez vous, ou je les crée.`,
      defaut: dossiers.join(', '),
    });
  }

  return questions;
}
