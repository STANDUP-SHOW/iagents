import type { AgentInstalle, Planification, Tache } from './fiche.ts';
import { lireIntention } from './consigne-planning.ts';

/**
 * Le Team Holder : l'assistant personnel livré avec iAgent, qui tient les
 * autres agents pour le client (demande de Max, 24/09/2026).
 *
 * Sa fiche est `socle/AG-0000-team-holder.json`, hors boutique. Ce module fait
 * trois choses, toutes sans toucher au disque :
 *
 * 1. Dire l'équipe en mots : qui travaille, sur quoi, quand, en mode contrôle
 *    ou non (`etatEquipe`, `horaireEnMots`).
 * 2. Comprendre une demande de réglage dite à voix haute et la répéter au
 *    client avant qu'elle s'applique (`comprendreDemande`). L'application passe
 *    par `equipe_regler` côté Rust, qui refuse tout ce qui sort des trois
 *    réglages et inscrit chaque changement pour qu'il se défasse.
 * 3. Donner au Team Holder, pour la conversation, ce qu'il a lu des autres
 *    agents (`rassemblerContexte`, `contexteDuTeamHolder`) : il ne rapporte que
 *    ce qu'il a sous les yeux.
 */

export const FICHE_TEAM_HOLDER = 'AG-0000';

/**
 * Les trois réglages qu'il touche. Doit rester identique à `REGLAGES` de
 * `desktop/src-tauri/src/equipe.rs` : `check-team-holder.ts` compare.
 */
export const REGLAGES = ['planification', 'active', 'validationHumaine'] as const;
export type Reglage = (typeof REGLAGES)[number];

/** Un changement inscrit, avec les noms de champs de la structure Rust. */
export interface Changement {
  id: string;
  date: string;
  par: string;
  agent: string;
  tache_id: string;
  tache_nom: string;
  reglage: string;
  avant: unknown;
  apres: unknown;
  annule_le: string | null;
}

/** Un document déposé par un agent, avec les noms de champs de la structure Rust. */
export interface Production {
  fichier: string;
  nom: string;
  dossier: string;
  taches: string[];
  modifie_le: number;
  octets: number;
}

export function estTeamHolder(agent: Pick<AgentInstalle, 'fiche'>): boolean {
  return agent.fiche.id === FICHE_TEAM_HOLDER;
}

const EVENEMENTS_EN_MOTS: Record<string, string> = {
  'email.recu': 'à chaque courriel reçu',
  'whatsapp.recu': 'à chaque message WhatsApp reçu',
  'fichier.depose': 'à chaque fichier déposé',
  'calendrier.evenement': 'à chaque rendez-vous de l’agenda',
  'appel.recu': 'à chaque appel reçu',
};

export function horaireEnMots(p: Planification): string {
  switch (p.type) {
    case 'quotidienne':
      return `tous les jours à ${p.heure}`;
    case 'hebdomadaire':
      return `le ${p.jour} à ${p.heure}`;
    case 'mensuelle':
      return `le ${p.jour} du mois à ${p.heure}`;
    case 'intervalle':
      return p.minutes % 60 === 0
        ? `toutes les ${p.minutes / 60 === 1 ? 'heures' : `${p.minutes / 60} heures`}`
        : `toutes les ${p.minutes} minutes`;
    case 'declencheur':
      return EVENEMENTS_EN_MOTS[p.evenement] ?? `sur l’événement ${p.evenement}`;
    case 'a-la-demande':
      return 'à la demande';
  }
}

export function valeurEnMots(reglage: Reglage, valeur: unknown): string {
  if (reglage === 'planification') return horaireEnMots(valeur as Planification);
  if (reglage === 'active') return valeur ? 'allumée' : 'éteinte';
  return valeur ? 'en mode contrôle' : 'en mode autonome';
}

export interface TacheEnMots {
  id: string;
  nom: string;
  horaire: string;
  active: boolean;
  controle: boolean;
}

export interface MembreEnMots {
  prenom: string;
  metier: string;
  taches: TacheEnMots[];
}

/** L'équipe que tient le Team Holder : tous les agents du poste sauf lui. */
export function etatEquipe(agents: readonly AgentInstalle[]): MembreEnMots[] {
  return agents
    .filter((a) => !estTeamHolder(a))
    .map((a) => ({
      prenom: a.prenom,
      metier: a.fiche.nom,
      taches: a.planning.map((t) => ({
        id: t.id,
        nom: t.nom,
        horaire: horaireEnMots(t.planification),
        active: t.active,
        controle: t.validationHumaine,
      })),
    }));
}

function sansAccents(phrase: string): string {
  return phrase
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[’']/g, ' ');
}

function mots(phrase: string): string[] {
  return sansAccents(phrase).split(/[^a-z0-9]+/).filter(Boolean);
}

/** Les mots d'un nom de tâche qui la distinguent : ni articles ni prépositions. */
const MOTS_VIDES = new Set([
  'les', 'des', 'une', 'pour', 'dans', 'avec', 'sans', 'chaque', 'votre', 'vos',
  'leur', 'leurs', 'sur', 'par', 'du', 'de', 'la', 'le', 'et', 'en', 'au', 'aux',
]);

function racines(phrase: string): string[] {
  // Les cinq premières lettres suffisent à rapprocher « relances » de
  // « relancer » ou « facture » de « facturation » sans dictionnaire.
  return mots(phrase)
    .filter((m) => m.length >= 4 && !MOTS_VIDES.has(m))
    .map((m) => m.slice(0, 5));
}

/** Ce que le client veut changer, répété avant d'être appliqué. */
export interface Proposition {
  agent: string;
  tacheId: string;
  tacheNom: string;
  reglage: Reglage;
  valeur: Planification | boolean;
  /** La phrase à dire au client : il répond oui ou non. */
  phrase: string;
}

export type Comprehension =
  | { proposition: Proposition }
  | { question: string }
  | { deja: string };

const CONTROLE = /\b(mode controle|sous controle|en controle|mon accord|mon feu vert|que je valide|je veux relire|avant de l envoyer|me demander)\b/;
const AUTONOME = /\b(mode autonome|autonome|tout seul|toute seule|sans me demander|sans mon accord|sans validation)\b/;

function liste(noms: readonly string[]): string {
  if (noms.length <= 1) return noms.join('');
  return `${noms.slice(0, -1).join(', ')} ou ${noms[noms.length - 1]}`;
}

/**
 * Lit une demande dite au Team Holder et en tire un réglage précis.
 *
 * Rend une seule question dès qu'il manque quelque chose — l'agent, la tâche
 * ou ce qu'il faut changer — plutôt que de deviner : un réglage appliqué au
 * mauvais agent est pire qu'une question de plus.
 */
export function comprendreDemande(phrase: string, agents: readonly AgentInstalle[]): Comprehension {
  const equipe = agents.filter((a) => !estTeamHolder(a));
  if (!equipe.length) return { question: "Aucun autre agent n'est embauché sur ce poste." };

  const dits = new Set(mots(phrase));
  const nommes = equipe.filter((a) => mots(a.prenom).every((m) => dits.has(m)));
  if (nommes.length !== 1) {
    return { question: `De quel agent parlez-vous : ${liste(equipe.map((a) => a.prenom))} ?` };
  }
  const agent = nommes[0];

  const cherche = new Set(racines(phrase));
  const scores = agent.planning.map((t) => ({
    t,
    score: racines(t.nom).filter((r) => cherche.has(r)).length,
  }));
  const meilleur = Math.max(0, ...scores.map((s) => s.score));
  const candidates = scores.filter((s) => s.score === meilleur && meilleur > 0).map((s) => s.t);
  if (candidates.length !== 1) {
    const offertes = (candidates.length ? candidates : agent.planning).map((t) => `« ${t.nom} »`);
    return { question: `Quelle tâche de ${agent.prenom} : ${liste(offertes)} ?` };
  }
  const tache = candidates[0];

  const texte = sansAccents(phrase);
  let reglage: Reglage;
  let valeur: Planification | boolean;
  if (CONTROLE.test(texte)) {
    reglage = 'validationHumaine';
    valeur = true;
  } else if (AUTONOME.test(texte)) {
    reglage = 'validationHumaine';
    valeur = false;
  } else {
    const intention = lireIntention(phrase);
    if (!intention) {
      return {
        question: `Que voulez-vous changer à « ${tache.nom} » de ${agent.prenom} : l'horaire, l'allumer ou l'éteindre, ou le mode contrôle ?`,
      };
    }
    if (intention.verbe === 'planifier') {
      reglage = 'planification';
      valeur = intention.planification;
    } else {
      reglage = 'active';
      valeur = intention.verbe === 'activer';
    }
  }

  const avant = valeurActuelle(tache, reglage);
  if (JSON.stringify(avant) === JSON.stringify(valeur)) {
    return { deja: `« ${tache.nom} » de ${agent.prenom} est déjà ${valeurEnMots(reglage, valeur)}.` };
  }
  return {
    proposition: {
      agent: agent.prenom,
      tacheId: tache.id,
      tacheNom: tache.nom,
      reglage,
      valeur,
      phrase: phraseDeConfirmation(agent.prenom, tache.nom, reglage, avant, valeur),
    },
  };
}

function valeurActuelle(tache: Tache, reglage: Reglage): unknown {
  return tache[reglage];
}

export function phraseDeConfirmation(
  prenom: string,
  tacheNom: string,
  reglage: Reglage,
  avant: unknown,
  apres: unknown
): string {
  if (reglage === 'active') {
    return `${prenom} : « ${tacheNom} » sera ${valeurEnMots(reglage, apres)}. Je le fais ?`;
  }
  return `${prenom} : « ${tacheNom} » passera de ${valeurEnMots(reglage, avant)} à ${valeurEnMots(reglage, apres)}. Je le fais ?`;
}

/** Une ligne de l'historique, lisible par le client. */
export function changementEnMots(ch: Changement): string {
  const reglage = (REGLAGES as readonly string[]).includes(ch.reglage) ? (ch.reglage as Reglage) : null;
  const apres = reglage ? valeurEnMots(reglage, ch.apres) : String(ch.apres);
  const avant = ch.avant === null || ch.avant === undefined
    ? 'le réglage de la fiche'
    : reglage ? valeurEnMots(reglage, ch.avant) : String(ch.avant);
  const annule = ch.annule_le ? ` Annulé le ${ch.annule_le}.` : '';
  return `${ch.date}, ${ch.agent} : « ${ch.tache_nom} » ${apres} (avant : ${avant}), demandé à ${ch.par}.${annule}`;
}

/** Ce que le Team Holder a lu, agent par agent. */
export interface Lecture {
  prenom: string;
  productions: Production[];
  /** Les derniers documents ouverts, avec leur texte ou la raison du refus. */
  lus: { nom: string; texte: string }[];
  /** Ce que le client a reproché à l'agent (`journal_lire`). */
  retours: { date: string; tache: string; raison: string }[];
}

/** Au plus ce nombre de documents ouverts par agent pour une conversation. */
export const DOCUMENTS_LUS_PAR_AGENT = 2;

type Invoquer = <T>(commande: string, args?: Record<string, unknown>) => Promise<T>;

/**
 * Va lire, par l'application, ce que chaque agent a déposé.
 *
 * `invoquer` est l'`invoke` de Tauri, passé en paramètre pour qu'un banc
 * puisse l'éprouver sans application. Un agent dont rien ne se lit n'arrête
 * pas les autres : sa raison est gardée et dite au Team Holder.
 */
export async function rassemblerContexte(
  invoquer: Invoquer,
  agents: readonly AgentInstalle[]
): Promise<{ lectures: Lecture[]; changements: Changement[] }> {
  const lectures: Lecture[] = [];
  for (const a of agents.filter((x) => !estTeamHolder(x))) {
    const productions = await invoquer<Production[]>('equipe_productions', { prenom: a.prenom }).catch(() => []);
    const lus: Lecture['lus'] = [];
    for (const p of productions.slice(0, DOCUMENTS_LUS_PAR_AGENT)) {
      const texte = await invoquer<string>('equipe_lire_production', { prenom: a.prenom, fichier: p.fichier })
        .catch((e) => `(non lu : ${String(e)})`);
      lus.push({ nom: p.nom, texte });
    }
    const retours = await invoquer<Lecture['retours']>('journal_lire', { prenom: a.prenom }).catch(() => []);
    lectures.push({ prenom: a.prenom, productions, lus, retours });
  }
  const changements = await invoquer<Changement[]>('equipe_changements').catch(() => []);
  return { lectures, changements };
}

function dateCourte(secondes: number): string {
  return new Date(secondes * 1000).toISOString().slice(0, 16).replace('T', ' ');
}

/**
 * Ce qui s'ajoute à la consigne du Team Holder pour une conversation : son
 * équipe, ce qu'elle a déposé, ce qu'il a lu, et les changements déjà faits.
 *
 * Tout y est daté et nommé, pour qu'il cite le fichier plutôt que de résumer
 * de mémoire ; ce qui n'a pas été lu est dit tel quel.
 */
export function contexteDuTeamHolder(
  agents: readonly AgentInstalle[],
  lectures: readonly Lecture[],
  changements: readonly Changement[]
): string {
  const equipe = etatEquipe(agents);
  if (!equipe.length) {
    return "\nTon équipe : aucun autre agent n'est embauché sur ce poste pour l'instant.\n";
  }
  const parPrenom = new Map(lectures.map((l) => [l.prenom, l]));
  const blocs = equipe.map((m) => {
    const taches = m.taches
      .map((t) => `  - « ${t.nom} » : ${t.active ? t.horaire : 'éteinte'}${t.active && t.controle ? ', en mode contrôle (attend l’accord de l’employeur)' : ''}`)
      .join('\n');
    const l = parPrenom.get(m.prenom);
    const deposes = !l || l.productions.length === 0
      ? '  Aucun document déposé trouvé.'
      : l.productions.slice(0, 10).map((p) => `  - ${p.nom} (${p.dossier}, ${dateCourte(p.modifie_le)})`).join('\n');
    const lus = (l?.lus ?? []).map((d) => `  --- ${d.nom} ---\n${d.texte}`).join('\n');
    const retours = (l?.retours ?? []).slice(-5).map((r) => `  - ${r.date}, ${r.tache} : ${r.raison}`).join('\n');
    return [
      `${m.prenom}, ${m.metier}.`,
      `Ses tâches :\n${taches}`,
      `Ses derniers documents :\n${deposes}`,
      lus ? `Ce que tu as lu :\n${lus}` : '',
      retours ? `Ce que l'employeur lui a reproché :\n${retours}` : '',
    ].filter(Boolean).join('\n');
  });
  const faits = changements.slice(-10).map((c) => `- ${c.id} : ${changementEnMots(c)}`).join('\n');
  return [
    '',
    'Ton équipe sur ce poste, telle que tu la lis maintenant :',
    '',
    blocs.join('\n\n'),
    faits ? `\nLes derniers changements que tu as faits :\n${faits}` : '',
    '',
  ].join('\n');
}
