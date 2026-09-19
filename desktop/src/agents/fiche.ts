export type Planification =
  | { type: 'quotidienne'; heure: string }
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

export interface Tache {
  id: string;
  nom: string;
  description: string;
  planification: Planification;
  logiciels: string[];
  validationHumaine: boolean;
  active: boolean;
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
}

/** Une tâche que le client ajoute à son agent, absente de la fiche. */
export interface TacheAjoutee {
  id: string;
  nom: string;
  description: string;
  planification: Planification;
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

  const taches = fiche.taches.map((tache) => {
    const a = ajuste.get(tache.id);
    if (!a) return tache;
    return {
      ...tache,
      active: a.active ?? tache.active,
      planification: a.planification ?? tache.planification,
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
      logiciels: ajoutee.logiciels ?? [],
      validationHumaine: ajoutee.validationHumaine ?? true,
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

  return installations.map(({ prenom, ficheId, voix, photo, sexe, planning }) => {
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
    };
  });
}

/** Les tâches que l'agent doit lancer à une heure fixe, « tous les soirs à 19h ». */
export function tachesQuotidiennes(taches: readonly Tache[], heure: string): Tache[] {
  return taches.filter(
    (t) => t.active && t.planification.type === 'quotidienne' && t.planification.heure === heure
  );
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
