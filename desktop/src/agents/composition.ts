/**
 * Le moteur de composition : une demande dite librement devient un agent.
 *
 * Max, 25/09/2026 : « Voice, j'ai besoin d'un graphiste pour réception des fichiers clients,
 * montage de bons à tirer, Caldera, Photoshop, Illustrator… » — et l'IA locale configure la
 * fiche, va y chercher les logiciels, ce que l'agent demandera, les accès. « Elle doit savoir
 * faire le lien entre la demande, ou guider l'utilisateur en questions pour connaître le poste
 * précis : c'est le même concept que l'entretien d'embauche. »
 *
 * Le moteur ne fabrique pas une fiche à partir de rien. Il part du poste du catalogue le plus
 * proche, que 25 ans de métier ont déjà écrit, et de l'activité du client, puis il y ajoute ce
 * que la demande dit en plus. Tout ce qu'il retient se lit dans la demande ou dans les
 * référentiels ; rien n'est deviné :
 * - un logiciel n'est retenu que s'il est au référentiel ; un nom qu'il ne connaît pas se
 *   signale, il ne s'invente pas d'éditeur ;
 * - une mission que la fiche ne couvre pas est dite non couverte, pas maquillée en tâche ;
 * - brancher un logiciel dépend de ce qu'il ouvre (API, fichiers, navigateur) : le moteur le
 *   dit logiciel par logiciel, et n'écrit jamais « connecté ».
 *
 * Tout est pur : ni disque, ni modèle. Il tourne donc sur la machine du client sans rien
 * joindre, et le banc (`check-composition.ts`) le rejoue sur le vrai catalogue.
 */

import {
  contientMot,
  normaliser,
  phrasePortee,
  porteeReelle,
  reconnaitreActivite,
  type Activite,
  type Logiciel,
  type Portee,
  type Referentiel,
  type ReferentielActivites,
} from './entretien.ts';

/** Ce que le moteur lit d'une fiche : de quoi la reconnaître, rien de plus. */
export interface Poste {
  id: string;
  nom: string;
  secteur: string;
  accroche: string;
  resumeMetier: string;
  taches: { id: string; nom: string; description: string }[];
  logiciels: { logiciel: string; usage: string; principal?: boolean }[];
}

/** Une fiche telle que `agents/*.json` l'écrit, réduite à ce que le moteur lit. */
export interface FicheBrute {
  id: string;
  nom: string;
  secteur: string;
  accroche?: string;
  resume_metier?: string;
  taches?: { id: string; nom: string; description?: string }[];
  qualifications?: { logiciels?: { logiciel: string; usage: string; principal?: boolean }[] };
}

/** La même réduction que `fiches::lire_postes` côté Rust ; le banc vérifie qu'elles s'accordent. */
export function posteDepuisFiche(f: FicheBrute): Poste {
  return {
    id: f.id,
    nom: f.nom,
    secteur: f.secteur,
    accroche: f.accroche ?? '',
    resumeMetier: f.resume_metier ?? '',
    taches: (f.taches ?? []).map((t) => ({ id: t.id, nom: t.nom, description: t.description ?? '' })),
    logiciels: f.qualifications?.logiciels ?? [],
  };
}

// ---------------------------------------------------------------------------
// Les mots
// ---------------------------------------------------------------------------

/**
 * Les mots qui ne disent rien du poste. « Besoin », « logiciel » ou « machine » sont dans
 * presque chaque demande : les compter ferait gagner la fiche la plus bavarde.
 */
const VIDES = new Set(
  `a au aux avec ce ces cet cette dans de des du elle elles en et est etre il ils je j la le les
  leur leurs lui ma mais me mes moi mon ne nos notre nous on ou par pas pour qu que qui sa se ses
  son sur ta te tes toi ton tu un une vos votre vous y d l s c n m t qu donc aussi tout toute
  toutes tous tres plus bien fait faire avoir besoin veux voudrais faut doit dois peut pourra
  sera aura seront ont suis sommes etc ainsi alors comme dont via chez entre sans sous meme
  quelqu quelqu un quelqu une personne poste agent ia voice logiciel logiciels outil outils
  utilisation utiliser capable parfait propre integralite ensemble cela ca ceci premier essai
  connais connaisse connaisses connaitre sait savoir manier assurer genere generer demande
  demandera acces accede acceder branche branchee reseau reseaux machine machines`.split(/\s+/)
);

/**
 * Une racine grossière : « tirage » et « tirer », « découpe » et « découper », « fichiers » et
 * « fichier » se rejoignent. Les terminaisons ôtées sont celles qui changent la forme sans
 * changer la chose ; on coupe ensuite à six lettres.
 */
function racine(mot: string): string {
  const sans = mot.replace(/(ements|ement|ations|ation|ages|age|euses|euse|eurs|eur|ees|ee|er|es|s|x|e)$/, '');
  return (sans.length >= 3 ? sans : mot).slice(0, 6);
}

/** Le mot sans sa marque de pluriel : « supports » est « support », « formats » n'est pas « formation ». */
function singulier(mot: string): string {
  return mot.length > 4 ? mot.replace(/(s|x)$/, '') : mot;
}

function mots(texte: string): string[] {
  return normaliser(texte)
    .split(' ')
    .filter((m) => m.length > 2 && !VIDES.has(m));
}

/** Les mots qui portent le sens, ramenés à leur racine : pour recouper deux descriptions. */
export function motsPleins(texte: string): string[] {
  return mots(texte).map(racine);
}

/** Les mots entiers, au singulier : pour reconnaître un nom de poste, où la racine confondrait. */
export function motsEntiers(texte: string): string[] {
  return mots(texte).map(singulier);
}

// ---------------------------------------------------------------------------
// Les logiciels nommés
// ---------------------------------------------------------------------------

export interface LogicielsNommes {
  /** Nommés et reconnus au référentiel, chacun une fois. */
  reconnus: Logiciel[];
  /** Un même nom qui désigne plusieurs produits : on redemande, on ne choisit pas. */
  ambigus: { dit: string; candidats: Logiciel[] }[];
}

/**
 * Les appellations trop courtes ou trop communes pour être cherchées dans une phrase libre :
 * dans une question sur un seul outil elles valent réponse, au milieu d'une demande elles
 * tombent sur « drive » ou « office » dits en passant.
 */
const APPELLATION_MINIMALE = 4;

/**
 * Des produits du référentiel qui portent le nom d'un mot de tous les jours : « un tableau
 * Excel » n'est pas le logiciel Tableau, « la première version » n'est pas Premiere. Dans une
 * demande libre ils ne comptent que écrits avec une majuscule ailleurs qu'en début de phrase ;
 * dictés en minuscules, c'est l'entretien, question par question, qui les reconnaîtra.
 */
export const MOTS_COURANTS = new Set(
  `tableau board close front make drive office word sheets faire epic place ghost interact
  mention sunday therefore resolve notion nomination premiere audition copilote optimo
  retriever combo blink bolt spark presto harvest orchestra julie elise sami patricia tomas
  maximilien charlemagne titan unity sublime cordial shine folk soda vend clipper octopus
  majors leeway delphi crypto helios synapse lighthouse navigator kairos prodigy equus rhino
  heap elastic precisely phrase pigment otter base affinity authentic zoom slack toast
  descartes planning trello julie sasha elnet effy melba marosa`.split(/\s+/)
);

/** Vrai quand le texte écrit ce mot avec une majuscule, hors début de phrase. */
function ecritCommeUnNom(original: string, mot: string): boolean {
  const motif = new RegExp(`(^|[^.!?\\s]\\s+)${mot[0].toUpperCase()}${mot.slice(1)}\\b`, 'u');
  return motif.test(original.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
}

export function logicielsNommes(demande: string, ref: Referentiel): LogicielsNommes {
  const d = normaliser(demande);
  const parAppellation = new Map<string, Logiciel[]>();
  for (const l of ref.logiciels) {
    for (const a of [l.nom, ...(l.alias ?? [])]) {
      const n = normaliser(a);
      if (n.length < APPELLATION_MINIMALE || !contientMot(d, n)) continue;
      if (MOTS_COURANTS.has(n) && !ecritCommeUnNom(demande, n)) continue;
      const liste = parAppellation.get(n) ?? [];
      if (!liste.some((x) => x.id === l.id)) liste.push(l);
      parAppellation.set(n, liste);
    }
  }
  // « Adobe Photoshop » contient « Photoshop » : l'appellation la plus longue l'emporte, et
  // une plus courte qui y est incluse ne compte pas une seconde fois.
  const trouvees = [...parAppellation.keys()].sort((a, b) => b.length - a.length);
  const retenues = trouvees.filter(
    (a) => !trouvees.some((b) => b !== a && b.length > a.length && contientMot(b, a))
  );
  const reconnus: Logiciel[] = [];
  const ambigus: LogicielsNommes['ambigus'] = [];
  for (const a of retenues) {
    const c = parAppellation.get(a)!;
    if (c.length === 1) {
      if (!reconnus.some((l) => l.id === c[0].id)) reconnus.push(c[0]);
    } else {
      ambigus.push({ dit: a, candidats: c });
    }
  }
  return { reconnus, ambigus };
}

// ---------------------------------------------------------------------------
// Ce que la demande dit en plus du poste
// ---------------------------------------------------------------------------

export interface CeQueDitLaDemande {
  /** Ce que le client veut voir fait, dans ses mots : « réception des fichiers clients ». */
  missions: string[];
  /** Ce que l'agent devra réclamer ou apprendre du client : « un tableau Excel des fournitures ». */
  pieces: string[];
  /** Ce à quoi l'agent devra accéder : « le RIP Caldera sur le réseau ». */
  acces: string[];
}

/** Les tournures qui annoncent une pièce que l'agent réclamera ou un savoir qu'il apprendra. */
const VERS_PIECE =
  /\b(?:qui\s+)?(?:demandera|demande|reclamera|reclame|voudra|aura besoin d[eu']?|besoin que tu connaisses|que tu connaisses|connaisse|connaitra|doit connaitre|devra connaitre)\s+(.+)/;
/** Les tournures qui annoncent un accès. */
const VERS_ACCES =
  /\b(?:qui\s+)?(?:aura acces|a acces|ayant acces|pourra acceder|accedera|pourra se connecter|sera branche[e]?)\s+(.+)/;
/** Ce qui ouvre une liste de missions : « un graphiste pour … », « chargé de … ». */
const VERS_MISSIONS = /\b(?:pour|charge[e]? de|qui s occupe de|qui s occupera de|qui fera)\s+(.+)/;

/**
 * Découpe la demande en propositions. On coupe aux points, puis devant chaque « qui » : dans
 * une phrase dictée, c'est lui qui enchaîne les attentes (« qui demandera…, qui aura accès… »).
 */
function propositions(demande: string): string[] {
  return demande
    .split(/[.!?;\n]+/)
    .flatMap((phrase) => phrase.split(/,?\s+(?:et\s+)?(?=qui\s)/i))
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Relit dans le texte d'origine, accents compris, le passage que le motif a trouvé dans le
 * texte normalisé. Les deux ont les mêmes mots dans le même ordre : on compte les mots.
 */
function passageOriginal(original: string, normalise: string, debutNormalise: number): string {
  let avant = normalise.slice(0, debutNormalise).split(' ').filter(Boolean).length;
  // « d'un » fait deux mots une fois normalisé, « cœur » aussi : on compte, jeton par jeton
  // de l'original, combien de mots normalisés il donne.
  for (const jeton of original.matchAll(/[\p{L}\p{N}]+/gu)) {
    if (avant <= 0) return original.slice(jeton.index).replace(/[,:;\s]+$/g, '').trim();
    avant -= normaliser(jeton[0]).split(' ').filter(Boolean).length;
  }
  return '';
}

function extraire(p: string, motif: RegExp): string | null {
  const n = normaliser(p);
  const m = motif.exec(n);
  if (!m) return null;
  const texte = passageOriginal(p, n, m.index + m[0].length - m[1].length);
  return texte.length > 2 ? texte : null;
}

export function ceQueDitLaDemande(demande: string, nommes: readonly Logiciel[] = []): CeQueDitLaDemande {
  const appellations = new Set(nommes.flatMap((l) => [l.nom, ...(l.alias ?? [])].map(normaliser)));
  const dit: CeQueDitLaDemande = { missions: [], pieces: [], acces: [] };
  for (const p of propositions(demande)) {
    const acces = extraire(p, VERS_ACCES);
    if (acces) {
      dit.acces.push(acces);
      continue;
    }
    const piece = extraire(p, VERS_PIECE);
    if (piece) {
      dit.pieces.push(piece);
      continue;
    }
    const missions = extraire(p, VERS_MISSIONS);
    if (missions) {
      // « réception des fichiers clients, montage de bons à tirer, utilisation des
      // logiciels … » : une mission par virgule, sans les listes de logiciels, qui sont
      // lues à part et contre le référentiel.
      for (const m of missions.split(/\s*,\s*/)) {
        const t = m.replace(/^(?:et|ainsi que|pour)\s+/i, '').trim();
        const n = normaliser(t);
        if (appellations.has(n)) continue;
        if (t.length > 3 && !/^(?:de l |l )?utilisation\b/.test(n)) {
          dit.missions.push(t);
        }
      }
    }
  }
  return dit;
}

// ---------------------------------------------------------------------------
// Le poste le plus proche
// ---------------------------------------------------------------------------

export interface Candidat {
  poste: Poste;
  score: number;
  /** Pourquoi ce poste, en clair : c'est ce que l'écran montre à côté de la question. */
  raisons: string[];
}

/** Les mots de chaque poste, et combien de postes emploient chacun : calculé une fois par catalogue. */
interface Index {
  nom: Map<string, string[]>;
  corps: Map<string, Set<string>>;
  /** Poids d'un mot : rare dans le catalogue, il désigne ; partout, il ne dit rien. */
  poidsNom: (m: string) => number;
  poidsCorps: (m: string) => number;
  poidsLogiciel: (id: string) => number;
}

const INDEX = new WeakMap<readonly Poste[], Index>();

function indexer(postes: readonly Poste[]): Index {
  const deja = INDEX.get(postes);
  if (deja) return deja;
  const nom = new Map<string, string[]>();
  const corps = new Map<string, Set<string>>();
  const dfNom = new Map<string, number>();
  const dfCorps = new Map<string, number>();
  const dfLog = new Map<string, number>();
  const compter = (df: Map<string, number>, cles: Iterable<string>) => {
    for (const c of cles) df.set(c, (df.get(c) ?? 0) + 1);
  };
  for (const p of postes) {
    const n = [...new Set(motsEntiers(p.nom))];
    const c = new Set(
      motsPleins([p.accroche, p.resumeMetier, ...p.taches.map((t) => `${t.nom} ${t.description}`)].join(' '))
    );
    nom.set(p.id, n);
    corps.set(p.id, c);
    compter(dfNom, n);
    compter(dfCorps, c);
    compter(dfLog, new Set(p.logiciels.map((q) => q.logiciel)));
  }
  const N = postes.length || 1;
  const idf = (df: Map<string, number>) => (k: string) => Math.log((N + 1) / ((df.get(k) ?? 0) + 1));
  const index: Index = {
    nom,
    corps,
    poidsNom: idf(dfNom),
    poidsCorps: idf(dfCorps),
    poidsLogiciel: idf(dfLog),
  };
  INDEX.set(postes, index);
  return index;
}

/**
 * Note chaque poste contre la demande. Le nom du poste pèse le plus : quand le client dit
 * « graphiste », il dit le poste. Les logiciels que la fiche sait déjà tenir viennent ensuite :
 * « Caldera, Photoshop, Illustrator » désigne un prépresse mieux que n'importe quel mot. Le
 * reste de la fiche (accroche, tâches) départage.
 *
 * Chaque mot pèse selon sa rareté dans le catalogue : « graphiste » ne nomme que deux postes,
 * « support » en nomme des dizaines, et « mes supports d'impression » ne doit pas faire monter
 * l'agent de support RH. Même chose pour les logiciels : Microsoft 365, que presque tous les
 * postes tiennent, ne désigne personne.
 */
export function classerPostes(
  demande: string,
  postes: readonly Poste[],
  nommes: readonly Logiciel[],
  exclus: ReadonlySet<string> = new Set()
): Candidat[] {
  const index = indexer(postes);
  const motsDemande = new Set(motsPleins(demande));
  const entiersDemande = new Set(motsEntiers(demande));
  const idsNommes = new Set(nommes.map((l) => l.id));
  const candidats: Candidat[] = [];
  for (const poste of postes) {
    if (exclus.has(poste.id)) continue;
    const raisons: string[] = [];
    let score = 0;

    const motsNom = index.nom.get(poste.id) ?? [];
    const nomTrouves = motsNom.filter((m) => entiersDemande.has(m));
    if (nomTrouves.length) {
      score += 2 * nomTrouves.reduce((t, m) => t + index.poidsNom(m), 0);
      if (nomTrouves.length === motsNom.length) score += 4;
      raisons.push(`vous avez dit « ${nomTrouves.join(' ')} »`);
    }

    const tenus = poste.logiciels.filter((q) => idsNommes.has(q.logiciel));
    if (tenus.length) {
      score += tenus.reduce((t, q) => t + index.poidsLogiciel(q.logiciel), 0);
      raisons.push(`il tient déjà ${tenus.length} des logiciels que vous citez`);
    }

    const corps = index.corps.get(poste.id) ?? new Set<string>();
    const communs = [...motsDemande].filter((m) => corps.has(m));
    score += Math.min(
      communs.reduce((t, m) => t + index.poidsCorps(m), 0) / 1.5,
      20
    );
    if (communs.length >= 4) raisons.push(`son travail recoupe ${communs.length} mots de votre demande`);

    if (score > 0) candidats.push({ poste, score: Math.round(score * 10) / 10, raisons });
  }
  return candidats.sort((a, b) => b.score - a.score || a.poste.id.localeCompare(b.poste.id));
}

/**
 * Le premier ne l'emporte seul que s'il devance nettement le deuxième. En dessous, choisir à
 * la place du client, c'est lui livrer un graphiste web quand il voulait un prépresse.
 */
export const AVANCE_SUFFISANTE = 1.3;
export const SCORE_MINIMAL = 12;
export const CANDIDATS_PROPOSES = 4;

// ---------------------------------------------------------------------------
// La lecture, et la question suivante
// ---------------------------------------------------------------------------

export type EtatPoste =
  | { etat: 'reconnu'; poste: Poste; raisons: string[] }
  | { etat: 'a-choisir'; candidats: Candidat[] }
  | { etat: 'inconnu' };

export interface Lecture {
  /** Toute la demande, réponses aux questions comprises, dans les mots du client. */
  demande: string;
  poste: EtatPoste;
  activite: Activite | null;
  activitesPossibles: Activite[];
  logiciels: LogicielsNommes;
  dit: CeQueDitLaDemande;
  /** Les postes que le client a écartés : ils ne reviennent pas dans la question suivante. */
  ecartes: string[];
}

export interface Referentiels {
  postes: readonly Poste[];
  logiciels: Referentiel;
  activites: ReferentielActivites;
}

/**
 * L'activité se cherche mot à mot : dans une phrase entière, `reconnaitreActivite` ne trouve
 * rien, puisqu'il compare la réponse entière. Ici on cherche chaque nom et alias de branche
 * dans la demande, en mots entiers.
 */
export function activitesDansLaDemande(demande: string, ref: ReferentielActivites): Activite[] {
  const d = normaliser(demande);
  const exact = reconnaitreActivite(demande, ref);
  if (exact.etat === 'reconnu') return [exact.activite];
  const entieres = ref.activites.filter((a) =>
    [a.nom, ...(a.alias ?? [])].some((m) => {
      const n = normaliser(m);
      return n.length > 3 && contientMot(d, n);
    })
  );
  if (entieres.length) return entieres;
  // « ma menuiserie » ne nomme aucune des trois menuiseries du référentiel en entier, mais
  // leur premier mot : on les propose toutes et le client choisit.
  const mots = new Set(motsEntiers(demande).filter((m) => m.length >= 6));
  return ref.activites.filter((a) =>
    [a.nom, ...(a.alias ?? [])].some((m) => mots.has(singulier(normaliser(m).split(' ')[0] ?? '')))
  );
}

export function lireDemande(
  demande: string,
  refs: Referentiels,
  ecartes: readonly string[] = [],
  activiteChoisie: Activite | null = null
): Lecture {
  const logiciels = logicielsNommes(demande, refs.logiciels);
  const classes = classerPostes(demande, refs.postes, logiciels.reconnus, new Set(ecartes));
  let poste: EtatPoste;
  const [premier, second] = classes;
  if (!premier || premier.score < SCORE_MINIMAL) {
    poste = classes.length ? { etat: 'a-choisir', candidats: classes.slice(0, CANDIDATS_PROPOSES) } : { etat: 'inconnu' };
  } else if (!second || premier.score >= AVANCE_SUFFISANTE * second.score) {
    poste = { etat: 'reconnu', poste: premier.poste, raisons: premier.raisons };
  } else {
    poste = { etat: 'a-choisir', candidats: classes.slice(0, CANDIDATS_PROPOSES) };
  }
  const activitesPossibles = activiteChoisie ? [activiteChoisie] : activitesDansLaDemande(demande, refs.activites);
  return {
    demande,
    poste,
    activite: activitesPossibles.length === 1 ? activitesPossibles[0] : null,
    activitesPossibles,
    logiciels,
    dit: ceQueDitLaDemande(demande, logiciels.reconnus),
    ecartes: [...ecartes],
  };
}

export type QuestionComposition =
  | { sujet: 'poste'; intitule: string; options: { id: string; libelle: string; detail: string }[] }
  | { sujet: 'decrire'; intitule: string }
  | { sujet: 'activite'; intitule: string; options: { id: string; libelle: string }[] }
  | { sujet: 'logiciel'; intitule: string; dit: string; options: { id: string; libelle: string }[] };

export const AUCUN_DE_CEUX_LA = 'aucun';

/**
 * La question suivante, une seule à la fois, comme à l'entretien. Le poste d'abord : sans
 * lui, rien d'autre n'a de sens. Puis la branche, puis un nom de logiciel qui en désigne
 * plusieurs. `null` : le moteur a de quoi composer.
 */
export function questionSuivante(l: Lecture): QuestionComposition | null {
  if (l.poste.etat === 'inconnu') {
    return {
      sujet: 'decrire',
      intitule:
        "Je ne reconnais pas encore le poste. Dites-moi ce que cette personne fait dans une journée : ce qu'elle reçoit, ce qu'elle produit, avec quels logiciels.",
    };
  }
  if (l.poste.etat === 'a-choisir') {
    return {
      sujet: 'poste',
      intitule: 'Plusieurs postes de mon catalogue vous ressemblent. Lequel est le plus proche de ce que vous cherchez ?',
      options: [
        ...l.poste.candidats.map((c) => ({ id: c.poste.id, libelle: c.poste.nom, detail: c.poste.accroche })),
        { id: AUCUN_DE_CEUX_LA, libelle: 'Aucun de ceux-là', detail: 'Je vous poserai une autre question.' },
      ],
    };
  }
  if (!l.activite && l.activitesPossibles.length > 1) {
    return {
      sujet: 'activite',
      intitule: 'Votre maison, c’est plutôt laquelle de ces activités ?',
      options: l.activitesPossibles.slice(0, 6).map((a) => ({ id: a.id, libelle: a.nom })),
    };
  }
  if (!l.activite) {
    return {
      sujet: 'activite',
      intitule: 'Et votre maison, que fait-elle ? Dites-le comme à un nouvel employé : « une imprimerie », « un garage »…',
      options: [],
    };
  }
  const [ambigu] = l.logiciels.ambigus;
  if (ambigu) {
    return {
      sujet: 'logiciel',
      intitule: `« ${ambigu.dit} » désigne plusieurs produits. Lequel est le vôtre ?`,
      dit: ambigu.dit,
      options: ambigu.candidats.map((c) => ({ id: c.id, libelle: `${c.nom} (${c.editeur})` })),
    };
  }
  return null;
}

/**
 * La réponse du client à une question. Choisir un poste le fixe ; « aucun de ceux-là » écarte
 * les candidats et redemande une description, qui s'ajoute à la demande : le moteur relit
 * alors le tout, sans oublier ce qui était déjà dit.
 */
export function repondre(
  l: Lecture,
  q: QuestionComposition,
  reponse: string,
  refs: Referentiels,
  choixLogiciels: Map<string, string> = new Map()
): { lecture: Lecture; choixLogiciels: Map<string, string> } {
  if (q.sujet === 'poste') {
    if (reponse === AUCUN_DE_CEUX_LA) {
      const ecartes = [...l.ecartes, ...q.options.map((o) => o.id).filter((id) => id !== AUCUN_DE_CEUX_LA)];
      const suivante = lireDemande(l.demande, refs, ecartes, l.activite);
      // Écartés tous, on ne repropose pas les suivants au hasard : on demande de décrire.
      return { lecture: { ...suivante, poste: { etat: 'inconnu' } }, choixLogiciels };
    }
    const poste = refs.postes.find((p) => p.id === reponse);
    if (!poste) return { lecture: l, choixLogiciels };
    return { lecture: { ...l, poste: { etat: 'reconnu', poste, raisons: ['vous l’avez choisi'] } }, choixLogiciels };
  }
  if (q.sujet === 'decrire') {
    return { lecture: lireDemande(`${l.demande}. ${reponse}`, refs, l.ecartes, l.activite), choixLogiciels };
  }
  if (q.sujet === 'activite') {
    const choisie =
      refs.activites.activites.find((a) => a.id === reponse) ??
      (() => {
        const v = reconnaitreActivite(reponse, refs.activites);
        return v.etat === 'reconnu' ? v.activite : null;
      })();
    if (!choisie) return { lecture: { ...l, activitesPossibles: activitesDansLaDemande(reponse, refs.activites) }, choixLogiciels };
    return { lecture: { ...l, activite: choisie, activitesPossibles: [choisie] }, choixLogiciels };
  }
  // Un logiciel ambigu : le choix du client lève l'ambiguïté, sans rien deviner d'autre.
  const choisi = refs.logiciels.logiciels.find((x) => x.id === reponse);
  const ambigus = l.logiciels.ambigus.filter((a) => a.dit !== q.dit);
  const reconnus = choisi && !l.logiciels.reconnus.some((x) => x.id === choisi.id)
    ? [...l.logiciels.reconnus, choisi]
    : l.logiciels.reconnus;
  const choix = new Map(choixLogiciels);
  if (choisi) choix.set(q.dit, choisi.id);
  return { lecture: { ...l, logiciels: { reconnus, ambigus } }, choixLogiciels: choix };
}

// ---------------------------------------------------------------------------
// La composition
// ---------------------------------------------------------------------------

/** Comment l'agent atteindra le logiciel, dit sans promettre : aucun n'est branché ici. */
export interface Branchement {
  logiciel: Logiciel;
  portee: Portee;
  /** Vrai quand la fiche du poste sait déjà le tenir ; sinon c'est la demande qui l'ajoute. */
  deLaFiche: boolean;
  usage: string;
  /** Ce qu'il faudra faire chez le client pour que l'agent l'atteigne. */
  aPreparer: string;
}

export interface Composition {
  posteId: string;
  posteNom: string;
  activiteId: string | null;
  activiteNom: string | null;
  branchements: Branchement[];
  /** Missions de la demande qu'une tâche de la fiche couvre déjà, avec cette tâche. */
  missionsCouvertes: { mission: string; tache: string }[];
  /** Missions qu'aucune tâche de la fiche ne couvre : l'agent les connaît, il ne les a pas. */
  missionsNonCouvertes: string[];
  pieces: string[];
  acces: string[];
  /** Mots de la branche entendus dans la demande : l'agent les emploiera comme le client. */
  vocabulaire: string[];
}

/**
 * Ce que le client devra préparer pour que l'agent atteigne l'outil. Écrit depuis ce que le
 * référentiel dit de ses accès, jamais depuis ce qu'on espère : Caldera n'ouvre ni API ni
 * page, seulement des fichiers, et c'est ce qu'on dit.
 */
export function aPreparer(l: Logiciel): string {
  switch (porteeReelle(l)) {
    case 'api':
      return `ouvrir l'accès de ${l.nom} sur votre compte, depuis « Vos connexions »`;
    case 'api-partielle':
      return `ouvrir l'accès partiel de ${l.nom} et me laisser votre navigateur pour le reste`;
    case 'navigateur':
      return `vous connecter une fois à ${l.nom} dans le navigateur de l'application`;
    case 'fichier':
      return `me désigner le dossier partagé sur le réseau où ${l.nom} prend et dépose ses fichiers`;
    default:
      return `rien pour l'instant : ${l.nom} ne m'est pas accessible, je vous dirai ce qui bloque`;
  }
}

/** La tâche de la fiche qui couvre une mission, si les deux partagent assez de mots. */
function tacheQuiCouvre(mission: string, poste: Poste): string | null {
  const mots = new Set(motsPleins(mission));
  if (!mots.size) return null;
  let meilleure: { nom: string; communs: number } | null = null;
  for (const t of poste.taches) {
    const communs = motsPleins(`${t.nom} ${t.description}`).filter((m) => mots.has(m));
    const n = new Set(communs).size;
    if (n > (meilleure?.communs ?? 0)) meilleure = { nom: t.nom, communs: n };
  }
  // Deux mots en commun, ou tous les mots d'une mission courte : en dessous c'est le hasard.
  if (meilleure && (meilleure.communs >= 2 || meilleure.communs === mots.size)) return meilleure.nom;
  return null;
}

export function composer(l: Lecture): Composition | null {
  if (l.poste.etat !== 'reconnu') return null;
  const poste = l.poste.poste;
  const qualifs = new Map(poste.logiciels.map((q) => [q.logiciel, q]));
  const branchements: Branchement[] = l.logiciels.reconnus.map((logiciel) => {
    const q = qualifs.get(logiciel.id);
    return {
      logiciel,
      portee: porteeReelle(logiciel),
      deLaFiche: Boolean(q),
      usage: q?.usage ?? `Vous m'avez demandé de travailler sur ${logiciel.nom}. ${phrasePortee(logiciel)}`,
      aPreparer: aPreparer(logiciel),
    };
  });

  const missionsCouvertes: Composition['missionsCouvertes'] = [];
  const missionsNonCouvertes: string[] = [];
  for (const m of l.dit.missions) {
    const t = tacheQuiCouvre(m, poste);
    if (t) missionsCouvertes.push({ mission: m, tache: t });
    else missionsNonCouvertes.push(m);
  }

  const d = normaliser(l.demande);
  const vocabulaire = (l.activite?.pack?.vocabulaire ?? [])
    .map((v) => v.terme)
    .filter((t) => contientMot(d, normaliser(t)));

  return {
    posteId: poste.id,
    posteNom: poste.nom,
    activiteId: l.activite?.id ?? null,
    activiteNom: l.activite?.nom ?? null,
    branchements,
    missionsCouvertes,
    missionsNonCouvertes,
    pieces: l.dit.pieces,
    acces: l.dit.acces,
    vocabulaire,
  };
}

/** Ce que l'agent dit à voix haute une fois composé. Une ligne par chose vraie. */
export function resumeComposition(c: Composition): string[] {
  const lignes: string[] = [];
  lignes.push(
    `Je prends le poste ${/^[aeiouyh]/i.test(normaliser(c.posteNom)) ? "d'" : 'de '}${c.posteNom.toLowerCase()}${c.activiteNom ? `, pour une maison d'${c.activiteNom.toLowerCase()}` : ''}.`
  );
  for (const b of c.branchements) {
    lignes.push(
      b.deLaFiche
        ? `${b.usage} Pour m'y brancher, il faudra ${b.aPreparer}.`
        : `${b.logiciel.nom} n'était pas dans mon poste : je l'ajoute parce que vous le demandez. Pour m'y brancher, il faudra ${b.aPreparer}.`
    );
  }
  if (c.missionsNonCouvertes.length) {
    lignes.push(
      `Mon poste ne couvre pas encore : ${c.missionsNonCouvertes.join(' ; ')}. Je le note tel que vous l'avez dit, et je vous dirai ce qu'il me faut plutôt que de faire semblant.`
    );
  }
  for (const p of c.pieces) lignes.push(`Je vous demanderai ${p}.`);
  for (const a of c.acces) lignes.push(`Il me faudra un accès ${/^(?:à|au|aux|via)\b/i.test(a) ? '' : 'à '}${a} : vous me l'ouvrirez, je ne le prendrai pas seul.`);
  return lignes;
}

/**
 * Ce que l'embauche écrit dans `installation.json` sous `competences` : c'est déjà ce que la
 * conversation et `tache.rs` lisent. La demande entre ainsi dans la consigne de l'agent sans
 * nouveau champ à faire relire côté Rust.
 */
export function competencesDepuisComposition(c: Composition, demande: string): { titre: string; resume: string }[] {
  const out: { titre: string; resume: string }[] = [
    { titre: "Le poste tel que l'employeur l'a demandé", resume: demande.trim() },
  ];
  const ajoutes = c.branchements.filter((b) => !b.deLaFiche);
  if (ajoutes.length) {
    out.push({
      titre: "Logiciels que l'employeur m'a demandé de tenir en plus de mon poste",
      resume: ajoutes.map((b) => `${b.logiciel.nom} : ${phrasePortee(b.logiciel)}`).join(' '),
    });
  }
  if (c.missionsNonCouvertes.length) {
    out.push({
      titre: "Missions demandées que mon poste ne couvre pas encore",
      resume: `${c.missionsNonCouvertes.join(' ; ')}. Je dis ce qu'il me faut pour les faire, je ne les improvise pas.`,
    });
  }
  if (c.pieces.length) {
    out.push({ titre: "Ce que je dois demander à l'employeur", resume: c.pieces.join(' ; ') });
  }
  if (c.acces.length) {
    out.push({
      titre: "Accès que l'employeur doit m'ouvrir",
      resume: `${c.acces.join(' ; ')}. Tant qu'il ne l'a pas fait, je travaille sans et je le lui rappelle.`,
    });
  }
  return out;
}
