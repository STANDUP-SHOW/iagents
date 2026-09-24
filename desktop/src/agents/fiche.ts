export type JourSemaine =
  | 'lundi'
  | 'mardi'
  | 'mercredi'
  | 'jeudi'
  | 'vendredi'
  | 'samedi'
  | 'dimanche';

/** Au-delà du 28, une tâche mensuelle sauterait sans bruit les mois courts. */
export const QUANTIEME_MAX = 28;

export type Planification =
  | { type: 'quotidienne'; heure: string }
  | { type: 'hebdomadaire'; jour: JourSemaine; heure: string }
  | { type: 'mensuelle'; jour: number; heure: string }
  | { type: 'intervalle'; minutes: number }
  | {
      type: 'declencheur';
      evenement:
        | 'email.recu'
        | 'whatsapp.recu'
        | 'fichier.depose'
        | 'calendrier.evenement'
        | 'appel.recu';
    }
  | { type: 'a-la-demande' };

export type Connecteur =
  | 'email'
  | 'whatsapp'
  | 'voix'
  | 'conversation'
  | 'navigateur'
  | 'calendrier'
  | 'fichiers'
  | 'telephone';

export interface Sortie {
  dossier: string;
  format: string;
}

export interface Tache {
  id: string;
  nom: string;
  description: string;
  planification: Planification;
  /** « dossier:facturation/devis » ou un connecteur comme « calendrier ». */
  entrees: string[];
  sorties: Sortie[];
  logiciels: string[];
  validationHumaine: boolean;
  active: boolean;
}

const PREFIXE_DOSSIER = 'dossier:';

/**
 * Les dossiers nommés par une tâche sont logiques (« facturation/devis ») : le
 * client dit à l'installation où ils se trouvent vraiment sur sa machine.
 */
export function dossiersUtilises(taches: readonly Tache[]): string[] {
  const vus = new Set<string>();
  for (const tache of taches) {
    if (!tache.active) continue;
    for (const entree of tache.entrees) {
      if (entree.startsWith(PREFIXE_DOSSIER)) {
        vus.add(entree.slice(PREFIXE_DOSSIER.length));
      }
    }
    for (const sortie of tache.sorties) vus.add(sortie.dossier);
  }
  return [...vus].sort();
}

/**
 * Ce qu'il reste à demander au client. Le parcours de configuration ne lui pose
 * que ces questions-là : un agent ne doit pas réclamer des dossiers dont aucune
 * de ses tâches actives ne se sert.
 */
export function dossiersManquants(
  taches: readonly Tache[],
  dossiers: Readonly<Record<string, string>> = {}
): string[] {
  return dossiersUtilises(taches).filter((logique) => !dossiers[logique]);
}

export interface Connaissance {
  titre: string;
  resume: string;
}

export interface Expert {
  persona: string;
  consigne: string;
  connaissances: Connaissance[];
  regles: string[];
}

/** Un paquet agent tel que `contrat/paquet-agent.schema.json` le décrit. */
export interface Fiche {
  id: string;
  slug: string;
  nom: string;
  secteur: string;
  description: string;
  expert: Expert;
  taches: Tache[];
  connecteurs: Connecteur[];
  /** Portrait livré avec la fiche ; le client peut lui en substituer un autre. */
  photo?: string;
}

/** Ce que le client change au plan par défaut d'une tâche de la fiche. */
export interface Ajustement {
  tacheId: string;
  active?: boolean;
  planification?: Planification;
  /** false = mode auto, true = mode contrôle (l'agent attend l'accord). */
  validationHumaine?: boolean;
}

/** Une tâche que le client ajoute à son agent, absente de la fiche. */
export interface TacheAjoutee {
  id: string;
  nom: string;
  description: string;
  planification: Planification;
  entrees?: string[];
  sorties?: Sortie[];
  logiciels?: string[];
  validationHumaine?: boolean;
}

/**
 * Le planning appartient au client : la fiche ne porte qu'un plan par défaut, et
 * deux clients du même agent n'ont pas les mêmes tâches ni les mêmes horaires.
 */
export interface Planning {
  ajustements?: Ajustement[];
  ajoutees?: TacheAjoutee[];
}

export type Sexe = 'femme' | 'homme';

/**
 * Prénom, voix, photo et sexe n'appartiennent pas au métier : l'employeur les
 * choisit à l'installation, et deux clients peuvent habiller la même fiche
 * autrement. La fiche ne porte qu'une photo par défaut, remplaçable.
 */
export interface Installation {
  prenom: string;
  ficheId: string;
  voix: string;
  photo?: string;
  sexe?: Sexe;
  planning?: Planning;
  /** Dossier logique de la fiche → dossier réel sur le poste du client. */
  dossiers?: Record<string, string>;
  /**
   * Ce que l'employeur apprend à son agent en plus du métier : ses procédures,
   * son catalogue, sa façon de faire. S'ajoute aux connaissances de la fiche,
   * ne les remplace jamais.
   */
  competences?: Connaissance[];
}

export interface AgentInstalle {
  prenom: string;
  voix: string;
  photo: string;
  /** Absent tant que le client n'a rien choisi : on n'invente pas un genre. */
  sexe?: Sexe;
  fiche: Fiche;
  /** Le plan réellement exécuté : fiche par défaut + modifications du client. */
  planning: Tache[];
  dossiers: Record<string, string>;
  competences: Connaissance[];
}

export function planningDuClient(fiche: Fiche, planning: Planning = {}): Tache[] {
  const parId = new Map(fiche.taches.map((t) => [t.id, t]));

  for (const { tacheId } of planning.ajustements ?? []) {
    if (!parId.has(tacheId)) {
      throw new Error(
        `Planning de ${fiche.nom} : la tâche « ${tacheId} » n'existe pas dans la fiche ${fiche.id}.`
      );
    }
  }

  const ajuste = new Map(
    (planning.ajustements ?? []).map((a) => [a.tacheId, a])
  );

  // Règle de max : l'agent va seul, sauf si le client met une tâche sous
  // contrôle. On ne vend pas un employé dont il faut relire chaque geste.
  //
  // Le `validationHumaine` de la fiche n'est donc PAS appliqué ici : c'est une
  // proposition de l'expert, celle que l'agent énonce à l'entretien
  // (`questionsEntretien`, sujet « autonomie » : « il y en a N où j'attends
  // votre accord, je garde ça ou vous voulez en relâcher ? »). Ce que le client
  // répond devient un ajustement, et c'est l'ajustement qui décide. Les mêmes
  // trois lignes vivent dans `accord_attendu` côté Rust, qui les ignorait
  // jusqu'au 24/09/2026 : il appliquait la fiche pendant que cet écran
  // appliquait l'autonomie, et le client lisait l'un ou l'autre selon l'écran.
  // `check-travail.ts` rejoue les témoins de `temoins-planning.json` des deux
  // côtés pour qu'ils ne puissent plus se séparer.
  const taches = fiche.taches.map((tache) => {
    const a = ajuste.get(tache.id);
    if (!a) return { ...tache, validationHumaine: false };
    return {
      ...tache,
      active: a.active ?? tache.active,
      planification: a.planification ?? tache.planification,
      validationHumaine: a.validationHumaine ?? false,
    };
  });

  for (const ajoutee of planning.ajoutees ?? []) {
    if (parId.has(ajoutee.id)) {
      throw new Error(
        `Planning de ${fiche.nom} : la tâche ajoutée « ${ajoutee.id} » porte le même identifiant qu'une tâche de la fiche.`
      );
    }
    taches.push({
      ...ajoutee,
      entrees: ajoutee.entrees ?? [],
      sorties: ajoutee.sorties ?? [],
      logiciels: ajoutee.logiciels ?? [],
      // Même règle : le client qui ajoute une tâche lui-même n'a pas demandé à
      // la relire. S'il le veut, il le dit dans la tâche qu'il ajoute.
      validationHumaine: ajoutee.validationHumaine ?? false,
      active: true,
    });
  }

  return taches;
}

/** Un poste Windows fait tourner au plus dix agents à la fois. */
export const AGENTS_MAX_PAR_POSTE = 10;

export function installerAgents(
  fiches: readonly Fiche[],
  installations: readonly Installation[]
): AgentInstalle[] {
  if (installations.length > AGENTS_MAX_PAR_POSTE) {
    throw new Error(
      `${installations.length} agents installés : un poste en accepte ${AGENTS_MAX_PAR_POSTE} au maximum.`
    );
  }

  const parId = new Map(fiches.map((f) => [f.id, f]));
  const prenomsVus = new Set<string>();

  return installations.map(({ prenom, ficheId, voix, photo, sexe, planning, dossiers, competences }) => {
    const fiche = parId.get(ficheId);
    if (!fiche) {
      throw new Error(
        `Installation « ${prenom} » : fiche ${ficheId} introuvable dans le catalogue.`
      );
    }

    // Deux agents du même prénom sur un poste : on ne saurait pas lequel répond.
    const clef = prenom.toLowerCase();
    if (prenomsVus.has(clef)) {
      throw new Error(`Deux agents portent le prénom « ${prenom} » sur ce poste.`);
    }
    prenomsVus.add(clef);

    return {
      prenom,
      voix,
      photo: photo ?? fiche.photo ?? '',
      sexe,
      fiche,
      planning: planningDuClient(fiche, planning),
      dossiers: dossiers ?? {},
      competences: competences ?? [],
    };
  });
}

/** Les tâches que l'agent doit lancer à une heure fixe, « tous les soirs à 19h ». */
export function tachesQuotidiennes(taches: readonly Tache[], heure: string): Tache[] {
  return taches.filter(
    (t) => t.active && t.planification.type === 'quotidienne' && t.planification.heure === heure
  );
}

/**
 * Bloquer sans dire pourquoi n'apprend rien à l'agent. La raison peut être
 * dictée à la voix ; elle lui revient comme un compte rendu, et c'est ainsi
 * qu'il s'ajuste au fil du temps.
 */
export type Decision =
  | { verbe: 'lancer' }
  | { verbe: 'bloquer'; raison: string };

/**
 * Une tâche que le client a mise sous contrôle. Elle fait son travail jusqu'au
 * bout et dépose son résultat, mais n'agit pas : elle attend que l'employeur
 * lance ou bloque. C'est lui qui l'a mise là — par défaut l'agent va seul.
 */
export interface Controle {
  tacheId: string;
  nom: string;
  /** Où le client trouvera ce qu'il doit relire avant de trancher. */
  dossiers: string[];
  decision?: Decision;
}

/**
 * Ce qui attend une décision. Sert à prévenir l'employeur : une tâche sous
 * contrôle qui n'avertit personne bloque sans que quiconque le sache.
 */
export function enAttenteDeControle(taches: readonly Tache[]): Controle[] {
  return taches
    .filter((t) => t.active && t.validationHumaine)
    .map((t) => ({
      tacheId: t.id,
      nom: t.nom,
      dossiers: t.sorties.map((s) => s.dossier),
    }));
}

/**
 * Enregistre ce que l'employeur a tranché. Une décision déjà prise n'est pas
 * reprise en silence : relancer une tâche bloquée doit être un geste explicite,
 * pas un effet de bord.
 */
export function decider(
  attentes: readonly Controle[],
  tacheId: string,
  decision: Decision
): Controle[] {
  const connue = attentes.some((c) => c.tacheId === tacheId);
  if (!connue) {
    throw new Error(`Aucune tâche « ${tacheId} » n'attend de décision.`);
  }

  if (decision.verbe === 'bloquer' && decision.raison.trim() === '') {
    throw new Error(
      `Blocage de « ${tacheId} » sans raison : l'agent ne saurait pas quoi corriger.`
    );
  }

  return attentes.map((c) =>
    c.tacheId === tacheId && c.decision === undefined ? { ...c, decision } : c
  );
}

/** Ce que l'agent reçoit en retour : pourquoi son travail a été refusé. */
export function retoursPourAgent(attentes: readonly Controle[]): string[] {
  return attentes.flatMap((c) =>
    c.decision?.verbe === 'bloquer' ? [`${c.nom} : ${c.decision.raison}`] : []
  );
}

/** Ce que l'agent peut exécuter : le lancé par décision, et le reste en auto. */
export function aExecuter(taches: readonly Tache[], attentes: readonly Controle[]): Tache[] {
  const lancees = new Set(
    attentes.filter((c) => c.decision?.verbe === 'lancer').map((c) => c.tacheId)
  );
  return taches.filter(
    (t) => t.active && (!t.validationHumaine || lancees.has(t.id))
  );
}

/** Les tâches qui s'exécutent seules, et celles qui attendent l'accord du client. */
export function repartitionAutonomie(taches: readonly Tache[]): {
  auto: Tache[];
  controle: Tache[];
} {
  const actives = taches.filter((t) => t.active);
  return {
    auto: actives.filter((t) => !t.validationHumaine),
    controle: actives.filter((t) => t.validationHumaine),
  };
}

/** Les logiciels métier (CRM, ERP…) que les tâches actives font manipuler. */
export function logicielsMetier(taches: readonly Tache[]): string[] {
  const vus = new Set<string>();
  for (const tache of taches) {
    if (!tache.active) continue;
    for (const logiciel of tache.logiciels) vus.add(logiciel);
  }
  return [...vus].sort();
}
