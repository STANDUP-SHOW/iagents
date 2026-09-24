/**
 * La jauge de la machine, telle que Rust la rend (`jauge_etat`).
 *
 * Aucun calcul ici : la règle vit dans `desktop/src-tauri/src/jauge.rs`, sur les
 * mêmes chiffres que `dimensionnement/calculer.ts`. Recalculer la jauge à
 * l'écran donnerait une troisième règle, donc une troisième réponse.
 */

/**
 * `memoire-seule` n'est pas un `confortable` prudent : la mémoire passe, mais la
 * carte n'a pas été identifiée, donc la charge n'a pas été jugée. Les deux ne
 * doivent jamais s'afficher pareil.
 */
export type NiveauJauge =
  | 'confortable'
  | 'chargee'
  | 'saturee'
  | 'impossible'
  | 'memoire-seule';

export interface MachineJaugee {
  nom: string;
  /** RAM totale, en Go. */
  ram: number;
  /** Mémoire laissée aux modèles, en Go. */
  memoireModeles: number;
  memoireUnifiee: boolean;
  /** Part d'une carte de référence ; `null` quand la carte n'est pas identifiée. */
  capaciteGpu: number | null;
  /** D'où viennent ces chiffres, en clair. */
  origine: string;
}

export interface Jauge {
  niveau: NiveauJauge;
  /** Mémoire demandée par les agents installés, en Go. */
  memoireModeles: number;
  /** Part de la machine consommée ; `null` quand la charge n'a pas été jugée. */
  charge: number | null;
  /** La phrase affichée au client, qui dit toujours quoi faire. */
  message: string;
  machine: MachineJaugee;
}
