/**
 * Le moteur d'équipe : une demande dite librement devient une équipe d'agents.
 *
 * Max, 04/10/2026 : « l'application devrait être capable de me générer un pack d'agents pour
 * cette tâche : trouver des financements et obtenir des rendez-vous » — business plan, analyse
 * des chiffres, analyse de marché, contacts des business angels, prise de contact par courriel,
 * présentation du projet, réponse vocale. Le moteur de composition (`composition.ts`) ne sait
 * faire qu'UN agent : sur cette phrase, il hésitait entre le Business plan analyst et un agent
 * de prise de rendez-vous médical, tiré par les mots « soins à domicile » de la présentation.
 *
 * Deux chemins, dans cet ordre :
 * - **une équipe type** (`catalogue/equipes.json`) quand la demande nomme son objectif
 *   (« trouver des financements ») : chaque rôle a ses mots de mission, et chaque morceau de la
 *   demande qui les emploie est cité comme la raison du rôle. Les rôles que la demande ne nomme
 *   pas restent proposés, dits comme tels : une levée a besoin d'un business plan même quand on
 *   oublie de le dire ;
 * - **sinon, morceau par morceau** : chaque mission dite (« création de… », « analyse de… »)
 *   passe par le classement de `composition.ts`. Un poste qui l'emporte nettement entre dans
 *   l'équipe ; deux qui se valent font une question, jamais un choix à la place du client.
 *
 * Ce qui n'est pas une mission ne compte pas : « ma start-up développe des sites de soins à
 * domicile » présente l'entreprise, elle ne demande pas d'infirmière. Une mission se dit par une
 * action (`ACTIONS`), et c'est cette règle qui écarte la présentation de la maison.
 *
 * Tout est pur, comme `composition.ts` : le banc (`check-equipe.ts`) le rejoue sur le vrai
 * catalogue et sur la demande de max mot pour mot.
 */

import { contientMot, normaliser, type Activite } from './entretien.ts';
import {
  activitesDansLaDemande,
  classerPostes,
  AVANCE_SUFFISANTE,
  CANDIDATS_PROPOSES,
  SCORE_MINIMAL,
  type Candidat,
  type Poste,
  type Referentiels,
} from './composition.ts';

// ---------------------------------------------------------------------------
// Le référentiel des équipes types
// ---------------------------------------------------------------------------

export interface RoleEquipe {
  role: string;
  agent: string;
  /** Le nom du poste quand la fiche vit au socle, hors des postes que lit le moteur. */
  nomPoste?: string;
  /** Mots de mission, normalisés : un morceau de la demande qui en contient un désigne ce rôle. */
  missions: string[];
  pourquoi: string;
}

export interface EquipeType {
  id: string;
  nom: string;
  objectif: string;
  declencheurs: string[];
  roles: RoleEquipe[];
  /** Ce que l'équipe ne fera pas, dit avant l'embauche plutôt que découvert après. */
  limites: string[];
}

export interface ReferentielEquipes {
  equipes: EquipeType[];
}

// ---------------------------------------------------------------------------
// La demande, découpée en besoins
// ---------------------------------------------------------------------------

/**
 * Les morceaux de la demande : on coupe aux points, puis aux virgules. Une demande dictée
 * énumère ses missions à la virgule (« création de business plan, analyse des chiffres,
 * analyse de marché… ») ; un morceau sans aucun mot plein ne dit rien.
 */
export function besoinsDeLaDemande(demande: string): string[] {
  return demande
    .split(/[.!?;\n]+/)
    .flatMap((phrase) => phrase.split(/\s*[,:]\s*/))
    .flatMap(couperAuxEt)
    .map(partieMission)
    .map((m) => m.trim())
    .filter((m) => normaliser(m).split(' ').filter((x) => x.length > 2).length >= 1);
}

/** « la comptabilité et le recrutement des serveurs » : deux missions, quand chaque côté en est une. */
function couperAuxEt(morceau: string): string[] {
  const parties = morceau.split(/\s+et\s+/);
  if (parties.length < 2 || !parties.every((p) => estUneMission(p))) return [morceau];
  return parties;
}

/**
 * « il me faut des agents pour la gestion des réservations » : la mission commence à l'action
 * qui suit « pour ». Le reste du morceau présente la demande, il ne la fait pas.
 */
function partieMission(morceau: string): string {
  if (estUneMission(morceau)) return morceau;
  const m = /\bpour\s+(.+)$/i.exec(morceau);
  return m && estUneMission(m[1]) ? m[1] : morceau;
}

/**
 * Les mots qui ouvrent une mission. « Création », « analyse », « recueil », « prise de contact »,
 * « trouver », « obtenir » : c'est ce qu'on demande à quelqu'un de faire. Ce qui n'en commence
 * pas par un présente la maison ou commente la demande.
 */
const ACTIONS = new Set(
  `creation creer cree analyse analyser analyses recueil recueillir collecte collecter prise prendre
  presentation presenter reponse repondre suivi suivre gestion gerer redaction rediger
  preparation preparer envoi envoyer relance relancer obtenir trouver chercher recherche
  rechercher organiser organisation tenir tenue monter montage construire construction etablir
  faire veille surveiller contacter contact prospecter prospection traduire traduction
  comptabilite facturation facturer saisie saisir paie planifier planification controle
  controler verifier verification negocier negociation qualifier qualification ecrire
  reception receptionner calculer calcul chiffrer lancer lancement publication publier
  recrutement recruter reservation reservations accueil accueillir`.split(/\s+/)
);

/** Les petits mots qu'une énumération laisse devant l'action : « de trouver », « et d'obtenir ». */
const AMORCES = new Set(['de', 'd', 'du', 'des', 'et', 'pour', 'a', 'la', 'le', 'les', 'l', 'puis', 'ainsi', 'que', 'aussi']);

export function estUneMission(besoin: string): boolean {
  const mots = normaliser(besoin).split(' ');
  const premier = mots.find((m) => !AMORCES.has(m));
  return premier !== undefined && ACTIONS.has(premier);
}

/** Les mots qui disent qu'on veut plusieurs agents, pas un seul. */
const MOTS_EQUIPE = ['equipe', 'pack', 'agents', 'plusieurs agents', 'collaborateurs'];

function parleDEquipe(demande: string): boolean {
  const d = normaliser(demande);
  return MOTS_EQUIPE.some((m) => contientMot(d, m));
}

// ---------------------------------------------------------------------------
// La lecture
// ---------------------------------------------------------------------------

export interface Membre {
  role: string;
  posteId: string;
  posteNom: string;
  /** Les morceaux de la demande qui ont fait venir ce poste, dans les mots du client. */
  entendu: string[];
  /**
   * `demande` : la demande l'a nommé ; `equipe` : l'équipe type le prévoit sans que la demande
   * le dise ; `choisi` : le client l'a choisi parmi plusieurs.
   */
  origine: 'demande' | 'equipe' | 'choisi';
  pourquoi: string;
}

export interface BesoinAChoisir {
  besoin: string;
  candidats: Candidat[];
}

export interface LectureEquipe {
  demande: string;
  type: EquipeType | null;
  membres: Membre[];
  /** Missions où deux postes se valent : le client tranche. */
  aChoisir: BesoinAChoisir[];
  /** Missions dites pour lesquelles le catalogue n'a aucun poste : dites, pas maquillées. */
  sansAgent: string[];
  activite: Activite | null;
  activitesPossibles: Activite[];
  limites: string[];
}

export const PERSONNE_POUR_CA = 'personne';

/** Le meilleur type d'équipe pour cette demande : celui dont l'objectif est le plus cité. */
function typeReconnu(demande: string, equipes: ReferentielEquipes): EquipeType | null {
  const d = normaliser(demande);
  let meilleur: { type: EquipeType; n: number } | null = null;
  for (const type of equipes.equipes) {
    const n = type.declencheurs.filter((m) => contientMot(d, m)).length;
    if (n > 0 && n > (meilleur?.n ?? 0)) meilleur = { type, n };
  }
  return meilleur?.type ?? null;
}

/**
 * Le passage de la demande à citer pour un rôle : un morceau dicté d'une traite (« je dois
 * donc monter une équipe qui va consister à faire ces démarches création de business plan »)
 * se cite à partir de l'action qui précède le mot de mission, pas en entier.
 */
export function citation(besoin: string, mission: string): string {
  const jetons = [...besoin.matchAll(/[\p{L}\p{N}]+/gu)].map((j) => ({ index: j.index ?? 0, n: normaliser(j[0]) }));
  const cherches = mission.split(' ');
  const debut = jetons.findIndex((_, i) => cherches.every((c, k) => jetons[i + k]?.n === c));
  if (debut < 0 || jetons.length <= 8) return besoin;
  for (let i = debut; i >= Math.max(0, debut - 4); i--) {
    if (ACTIONS.has(jetons[i].n)) return besoin.slice(jetons[i].index).trim();
  }
  return besoin;
}

function rolesDuBesoin(besoin: string, type: EquipeType): RoleEquipe[] {
  const b = normaliser(besoin);
  return type.roles.filter((r) => r.missions.some((m) => contientMot(b, m)));
}

/** Le poste qui l'emporte nettement pour une mission, ou les candidats qui se valent. */
function trancher(besoin: string, refs: Referentiels, exclus: ReadonlySet<string>):
  | { etat: 'reconnu'; candidat: Candidat }
  | { etat: 'a-choisir'; candidats: Candidat[] }
  | { etat: 'aucun' } {
  const classes = classerPostes(besoin, refs.postes, [], exclus);
  const [premier, second] = classes;
  if (!premier) return { etat: 'aucun' };
  // Un morceau de quelques mots pèse peu : « la comptabilité » fait monter l'agent comptable
  // d'association sur le seul mot de son nom. On ne retient seul qu'un poste nettement devant ET
  // dont le score vaut le double du minimum d'un agent seul ; sinon le client choisit.
  if (
    premier.score >= 2 * SCORE_MINIMAL &&
    (!second || premier.score >= AVANCE_SUFFISANTE * second.score)
  ) {
    return { etat: 'reconnu', candidat: premier };
  }
  return { etat: 'a-choisir', candidats: classes.slice(0, CANDIDATS_PROPOSES) };
}

/**
 * Lit la demande comme une demande d'équipe. `null` : ce n'est pas une équipe (un seul poste
 * demandé, ou rien de reconnu), et l'embauche repart sur le moteur d'un seul agent.
 *
 * Avec une équipe type, une mission qui ne désigne aucun de ses rôles n'est pas classée seule
 * quand elle redit l'objectif (« de trouver des financements ») ; sinon elle passe au classement.
 */
export function lireDemandeEquipe(
  demande: string,
  refs: Referentiels,
  equipes: ReferentielEquipes
): LectureEquipe | null {
  const besoins = besoinsDeLaDemande(demande);
  const type = typeReconnu(demande, equipes);
  const nomDe = (id: string, role?: RoleEquipe) =>
    refs.postes.find((p) => p.id === id)?.nom ?? role?.nomPoste ?? id;

  const membres = new Map<string, Membre>();
  const aChoisir: BesoinAChoisir[] = [];
  const sansAgent: string[] = [];
  const rolesNommes = new Set<string>();

  for (const besoin of besoins) {
    const roles = type ? rolesDuBesoin(besoin, type) : [];
    for (const r of roles) {
      rolesNommes.add(r.agent);
      const b = normaliser(besoin);
      const dit = citation(besoin, r.missions.find((x) => contientMot(b, x)) ?? '');
      const m = membres.get(r.agent);
      if (m) {
        if (!m.entendu.includes(dit)) m.entendu.push(dit);
      } else {
        membres.set(r.agent, {
          role: r.role,
          posteId: r.agent,
          posteNom: nomDe(r.agent, r),
          entendu: [dit],
          origine: 'demande',
          pourquoi: r.pourquoi,
        });
      }
    }
    if (roles.length || !estUneMission(besoin)) continue;
    // « trouver des financements » redit l'objectif de l'équipe type : c'est le but de toute
    // l'équipe, pas un poste de plus.
    if (type && type.declencheurs.some((d) => contientMot(normaliser(besoin), d))) continue;

    // Une mission que l'équipe type ne prévoit pas, ou toute mission quand aucune équipe type
    // ne répond : le classement d'un seul agent, morceau par morceau.
    const verdict = trancher(besoin, refs, new Set());
    if (verdict.etat === 'reconnu') {
      const p = verdict.candidat.poste;
      const m = membres.get(p.id);
      if (m) m.entendu.push(besoin);
      else
        membres.set(p.id, {
          role: besoin,
          posteId: p.id,
          posteNom: p.nom,
          entendu: [besoin],
          origine: 'demande',
          pourquoi: p.accroche,
        });
    } else if (verdict.etat === 'a-choisir') {
      aChoisir.push({ besoin, candidats: verdict.candidats });
    } else {
      sansAgent.push(besoin);
    }
  }

  // Une équipe type ne se déclenche pas sur un mot : « un analyste financement » dit
  // « financement » et demande un seul poste. Il faut que la demande parle d'équipe ou nomme
  // au moins deux rôles.
  const typeRetenu = type && (parleDEquipe(demande) || rolesNommes.size >= 2) ? type : null;
  if (!typeRetenu && type) {
    for (const id of rolesNommes) membres.delete(id);
  }
  if (typeRetenu) {
    for (const r of typeRetenu.roles) {
      if (membres.has(r.agent)) continue;
      membres.set(r.agent, {
        role: r.role,
        posteId: r.agent,
        posteNom: nomDe(r.agent, r),
        entendu: [],
        origine: 'equipe',
        pourquoi: r.pourquoi,
      });
    }
  }

  // Sans équipe type, plusieurs missions ne font pas une équipe : « un graphiste pour la
  // réception des fichiers, le montage des bons à tirer… » décrit UN poste. Il faut que le client
  // parle d'équipe ou d'agents au pluriel.
  const total = membres.size + aChoisir.length;
  if (!typeRetenu && !(parleDEquipe(demande) && total >= 1)) return null;

  // L'ordre de l'équipe type d'abord, chef d'équipe en tête ; puis ce que la demande a ajouté.
  const ordre = new Map((typeRetenu?.roles ?? []).map((r, i) => [r.agent, i]));
  const tries = [...membres.values()].sort(
    (a, b) => (ordre.get(a.posteId) ?? 99) - (ordre.get(b.posteId) ?? 99)
  );

  // Seules les branches nommées en entier : le repli de `activitesDansLaDemande` sur un premier
  // mot (« fournisseurs » → « fournisseur d'énergie ») convient à une question posée, pas à une
  // fiche écrite d'office pour toute une équipe.
  const d = normaliser(demande);
  const activitesPossibles = activitesDansLaDemande(demande, refs.activites).filter((a) =>
    [a.nom, ...(a.alias ?? [])].some((m) => contientMot(d, normaliser(m)))
  );
  return {
    demande,
    type: typeRetenu,
    membres: tries,
    aChoisir,
    sansAgent,
    activite: activitesPossibles.length === 1 ? activitesPossibles[0] : null,
    activitesPossibles,
    limites: typeRetenu?.limites ?? [],
  };
}

/** Le client tranche une mission où deux postes se valaient. */
export function choisirPour(l: LectureEquipe, besoin: string, posteId: string, refs: Referentiels): LectureEquipe {
  const question = l.aChoisir.find((q) => q.besoin === besoin);
  if (!question) return l;
  const aChoisir = l.aChoisir.filter((q) => q.besoin !== besoin);
  if (posteId === PERSONNE_POUR_CA) return { ...l, aChoisir, sansAgent: [...l.sansAgent, besoin] };
  const poste = refs.postes.find((p) => p.id === posteId);
  if (!poste) return l;
  const deja = l.membres.find((m) => m.posteId === poste.id);
  const membres = deja
    ? l.membres.map((m) => (m === deja ? { ...m, entendu: [...m.entendu, besoin] } : m))
    : [
        ...l.membres,
        { role: besoin, posteId: poste.id, posteNom: poste.nom, entendu: [besoin], origine: 'choisi' as const, pourquoi: poste.accroche },
      ];
  return { ...l, membres, aChoisir };
}

/** Ce que le chef d'équipe dit une fois l'équipe lue. Une ligne par chose vraie. */
export function resumeEquipe(l: LectureEquipe): string[] {
  const lignes: string[] = [];
  lignes.push(
    l.type
      ? `Pour « ${l.type.objectif.replace(/\.$/, '').toLowerCase()} », je vous propose une équipe de ${l.membres.length}.`
      : `Je vous propose une équipe de ${l.membres.length}${l.aChoisir.length ? `, et ${l.aChoisir.length} poste(s) à choisir avec vous` : ''}.`
  );
  const ajoutes = l.membres.filter((m) => m.origine === 'equipe');
  if (ajoutes.length) {
    lignes.push(
      `Vous n'avez pas nommé ${ajoutes.map((m) => m.role.toLowerCase()).join(', ')} : je les ajoute parce que l'équipe en a besoin, vous pouvez les retirer.`
    );
  }
  if (l.sansAgent.length) {
    lignes.push(`Personne dans mon catalogue ne fait encore : ${l.sansAgent.join(' ; ')}. Je le note tel que vous l'avez dit.`);
  }
  for (const limite of l.limites) lignes.push(limite);
  return lignes;
}

// ---------------------------------------------------------------------------
// L'embauche de l'équipe
// ---------------------------------------------------------------------------

/** Ce que l'embauche lit d'une fiche pour relier les membres entre eux. */
export interface FicheDeMembre {
  id: string;
  nom: string;
  taches?: { entrees?: string[]; sorties?: { dossier: string }[] }[];
  relais?: {
    recoitDe?: { poste: string; agent?: string; quoi: string }[];
    transmetA?: { poste: string; agent?: string; quoi: string }[];
  };
}

export interface MembreEmbauche {
  prenom: string;
  /** L'identifiant du poste dans l'équipe (la fiche du catalogue, pas la fiche fille). */
  posteId: string;
  fiche: FicheDeMembre;
  /** Le dossier de travail de l'agent sur ce poste, tel que `dossier_de_travail` le rend. */
  racine?: string;
}

export interface Passage {
  de: string;
  vers: string;
  dossier: string;
}

function joindre(racine: string, logique: string): string {
  const sep = racine.includes('\\') ? '\\' : '/';
  return [racine.replace(/[\\/]+$/, ''), ...logique.split('/')].join(sep);
}

function dossiersLus(f: FicheDeMembre): string[] {
  return [
    ...new Set(
      (f.taches ?? []).flatMap((t) => (t.entrees ?? []).filter((e) => e.startsWith('dossier:')).map((e) => e.slice(8)))
    ),
  ];
}

function dossiersEcrits(f: FicheDeMembre): Set<string> {
  return new Set((f.taches ?? []).flatMap((t) => (t.sorties ?? []).map((s) => s.dossier)));
}

/**
 * Les agents de l'équipe se passent le travail par leurs dossiers. Un agent qui lit un dossier
 * qu'il n'écrit pas lui-même, et qu'UN seul autre membre écrit, lit désormais chez ce membre :
 * le chargé de levée lit le besoin de financement là où le business plan le dépose. Deux
 * membres qui écrivent le même dossier, c'est une ambiguïté : on ne relie pas, on ne devine pas.
 *
 * Rend, par prénom, les dossiers à écrire sous `dossiers` dans `installation.json` (des
 * chemins complets : `tache::dossier_reel` refuse le reste), et la liste des passages pour
 * l'écran.
 */
export function relierEquipe(membres: readonly MembreEmbauche[]): {
  dossiers: Record<string, Record<string, string>>;
  passages: Passage[];
} {
  const dossiers: Record<string, Record<string, string>> = {};
  const passages: Passage[] = [];
  for (const lecteur of membres) {
    const siens = dossiersEcrits(lecteur.fiche);
    for (const logique of dossiersLus(lecteur.fiche)) {
      if (siens.has(logique)) continue;
      const auteurs = membres.filter((m) => m !== lecteur && dossiersEcrits(m.fiche).has(logique));
      if (auteurs.length !== 1 || !auteurs[0].racine) continue;
      (dossiers[lecteur.prenom] ??= {})[logique] = joindre(auteurs[0].racine, logique);
      passages.push({ de: auteurs[0].prenom, vers: lecteur.prenom, dossier: logique });
    }
  }
  return { dossiers, passages };
}

/**
 * Ce que chaque membre sait de son équipe, écrit sous `competences` comme le reste de
 * l'embauche : la conversation et `tache.rs` le lisent déjà. Le bloc `relais` des fiches dit de
 * qui un poste reçoit et à qui il transmet ; jusqu'ici aucun code ne le lisait.
 */
export function competencesDuMembre(
  membre: MembreEmbauche,
  equipe: readonly MembreEmbauche[],
  l: Pick<LectureEquipe, 'demande' | 'type' | 'membres'>,
  passages: readonly Passage[] = []
): { titre: string; resume: string }[] {
  const role = l.membres.find((m) => m.posteId === membre.posteId);
  const autres = equipe.filter((m) => m !== membre);
  const prenomDe = (agent?: string) => autres.find((m) => m.posteId === agent)?.prenom;
  const out: { titre: string; resume: string }[] = [
    { titre: "La mission de l'équipe telle que l'employeur l'a dite", resume: l.demande.trim() },
  ];
  if (role) {
    out.push({
      titre: "Mon rôle dans l'équipe",
      resume: `${role.role}${role.entendu.length ? ` : « ${role.entendu.join(' », « ')} »` : ''}. ${role.pourquoi}`,
    });
  }
  out.push({
    titre: 'Mon équipe',
    resume: autres
      .map((m) => {
        const r = l.membres.find((x) => x.posteId === m.posteId);
        return `${m.prenom}, ${m.fiche.nom}${r ? ` (${r.role.toLowerCase()})` : ''}`;
      })
      .join(' ; ') + '.',
  });
  const recoit = (membre.fiche.relais?.recoitDe ?? [])
    .filter((r) => prenomDe(r.agent))
    .map((r) => `de ${prenomDe(r.agent)}, ${r.quoi}`);
  const transmet = (membre.fiche.relais?.transmetA ?? [])
    .filter((r) => prenomDe(r.agent))
    .map((r) => `à ${prenomDe(r.agent)}, ${r.quoi}`);
  const lus = passages.filter((p) => p.vers === membre.prenom).map((p) => `${p.dossier} chez ${p.de}`);
  if (recoit.length || transmet.length || lus.length) {
    out.push({
      titre: 'Ce que je reçois et ce que je transmets dans cette équipe',
      resume: [
        recoit.length ? `Je reçois ${recoit.join(' ; ')}.` : '',
        transmet.length ? `Je transmets ${transmet.join(' ; ')}.` : '',
        lus.length ? `Je lis directement : ${lus.join(' ; ')}.` : '',
      ]
        .filter(Boolean)
        .join(' '),
    });
  }
  return out;
}

/** Les prénoms proposés, un par membre, que le client change à sa guise. */
export const PRENOMS_PROPOSES = [
  'Victor', 'Léa', 'Hugo', 'Camille', 'Nora', 'Paul', 'Inès', 'Louis', 'Jeanne', 'Malik', 'Clara', 'Adam',
];

export function prenomsPourEquipe(n: number, dejaPris: readonly string[] = []): string[] {
  const pris = new Set(dejaPris.map((p) => normaliser(p)));
  const libres = PRENOMS_PROPOSES.filter((p) => !pris.has(normaliser(p)));
  return Array.from({ length: n }, (_, i) => libres[i] ?? `Agent ${i + 1}`);
}

export type { Poste };
