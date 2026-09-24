/**
 * Ce que le client règle à l'entretien : combien l'agent travaille, et où il travaille.
 *
 * Max, 22/09/2026 : « light medium high correspond à l'intensité de travail demandé, 24h/24
 * avec beaucoup de recherches, beaucoup de token en gros. Vu que nos agents sont hybrides,
 * ils peuvent tourner tout local ou 80 % local ou 100 % API, ils consomment. »
 *
 * Deux réglages séparés, parce qu'ils ne coûtent pas la même chose :
 *   - l'intensité joue sur ce que l'agent fait (fréquence des tâches, profondeur de chaque
 *     exécution) et pèse donc à la fois sur la machine et sur la facture ;
 *   - la répartition dit quelle part passe par l'API, et ne pèse que sur la facture.
 * Aucun des deux ne change ce que l'agent a le droit de faire : un agent en mode élevé ne
 * gagne aucune autonomie, il travaille seulement plus.
 */

export type Intensite = 'light' | 'medium' | 'high';
export type Repartition = 'local' | 'hybride' | 'api';

export interface ReglageIntensite {
  libelle: string;
  /**
   * Multiplie le nombre d'exécutions par mois de chaque tâche planifiée. Le
   * planning de l'application (`planificateur.rs`) applique le même chiffre, et
   * un banc Rust relit ce fichier pour qu'ils ne se séparent pas.
   */
  frequence: number;
  /**
   * Multiplie le nombre de tours par exécution : recherches et vérifications en plus.
   * **Cible, pas encore appliquée** — voir `PROFONDEUR_APPLIQUEE`.
   */
  profondeur: number;
  /** Ce que l'agent en dit au client, en une phrase. */
  phrase: string;
}

export const INTENSITES: Record<Intensite, ReglageIntensite> = {
  light: {
    libelle: 'Léger',
    frequence: 0.5,
    profondeur: 1,
    phrase:
      "Je fais l'essentiel, deux fois moins souvent que ma fiche ne le prévoit, sans creuser au-delà de ce qu'il faut pour rendre le travail.",
  },
  medium: {
    libelle: 'Normal',
    frequence: 1,
    profondeur: 1,
    phrase:
      "Je tiens le poste tel qu'il est écrit sur ma fiche : mes tâches aux heures prévues, et je vérifie ce que je rends.",
  },
  high: {
    libelle: 'Soutenu',
    frequence: 2,
    profondeur: 1.5,
    // La phrase ne promet plus de « creuser chaque dossier » : constaté le
    // 24/09/2026, rien ne le fait. `executer_tache` fait UN appel au modèle,
    // écrit le fichier et s'arrête. Ce que « soutenu » change réellement, et
    // qui est appliqué par le planificateur, c'est la fréquence.
    phrase:
      "Je repasse plusieurs fois par jour, à chaque fois que la situation peut avoir bougé. C'est le réglage qui consomme le plus.",
  },
};

/**
 * La profondeur est-elle appliquée quelque part ? **Non, au 24/09/2026.**
 *
 * `executer_tache` (desktop/src-tauri/src/tache.rs) fait un seul appel au
 * modèle, écrit le fichier et s'arrête : il n'y a aucune boucle de tours à
 * multiplier par 1,5. La fréquence, elle, est bien appliquée — c'est le
 * planificateur qui la lit.
 *
 * Ce drapeau existe parce que le chiffre annoncé au client à l'entretien la
 * comptait : « Soutenu » était devisé **50 % plus cher** que ce que l'agent
 * allait réellement consommer, pour un travail qu'il ne fait pas. Devis trop
 * haut ou trop bas, c'est la même faute — le client choisit sur un nombre qui
 * ne décrit rien.
 *
 * `profondeur: 1.5` reste écrit : c'est la cible, et l'effacer obligerait
 * quelqu'un à la redécouvrir. Le jour où la boucle de tours existe, passer ce
 * drapeau à `true` suffit, et le banc de `economie.ts` le dira.
 */
export const PROFONDEUR_APPLIQUEE = false;

export interface ReglageRepartition {
  libelle: string;
  /** Part des exécutions qui passent par l'API et se paient au jeton. */
  partApi: number;
  phrase: string;
}

export const REPARTITIONS: Record<Repartition, ReglageRepartition> = {
  local: {
    libelle: 'Tout sur votre machine',
    partApi: 0,
    phrase:
      "Tout tourne chez vous, rien ne se paie au jeton et rien ne sort de vos murs. Ce que la machine ne sait pas tenir, je ne le fais pas en moins bien : la tâche s'arrête et je vous dis pourquoi.",
  },
  hybride: {
    libelle: 'Surtout local, une part par API',
    partApi: 0.2,
    phrase:
      "L'essentiel tourne chez vous ; ce qui dépasse la machine part par l'API avec votre clé. Vous payez une petite part au jeton.",
  },
  api: {
    libelle: 'Tout par API',
    partApi: 1,
    phrase:
      "Tout passe par l'API avec votre clé. Aucune machine à acheter, mais tout se paie au jeton et vos données sortent de vos murs.",
  },
};

export const INTENSITE_DEFAUT: Intensite = 'medium';
export const REPARTITION_DEFAUT: Repartition = 'hybride';

export function estIntensite(v: unknown): v is Intensite {
  return typeof v === 'string' && v in INTENSITES;
}

export function estRepartition(v: unknown): v is Repartition {
  return typeof v === 'string' && v in REPARTITIONS;
}
