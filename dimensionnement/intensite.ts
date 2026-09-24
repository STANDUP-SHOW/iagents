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
  /** Multiplie le nombre de tours par exécution : recherches et vérifications en plus. */
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
    phrase:
      "Je surveille en continu, je repasse plusieurs fois par jour et je creuse chaque dossier avant de vous le rendre. C'est le réglage qui consomme le plus.",
  },
};

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
