import type { AgentInstalle, Tache } from './fiche';

/**
 * Le travail du jour : ce que l'agent peut faire maintenant, et ce qui l'en
 * empêche.
 *
 * Les fiches décrivent 9 233 tâches, chacune avec son dossier et son format.
 * L'écran ne doit proposer que celles qui aboutiront réellement : un bouton qui
 * échoue après coup apprend au client à ne plus cliquer. Les quatre raisons de
 * ne pas pouvoir sont les mêmes que celles tenues côté Rust dans `tache.rs`,
 * dites ici avant le clic plutôt qu'après.
 */

/**
 * Les formats que l'application sait écrire. Doit rester identique à
 * `FORMATS_ECRITS` de `desktop/src-tauri/src/tache.rs` : `check-travail.ts`
 * compare les deux fichiers, parce qu'une liste plus longue ici proposerait un
 * bouton que Rust refuserait.
 */
export const FORMATS_ECRITS = ['md', 'txt', 'csv', 'json', 'html', 'xlsx', 'eml', 'docx'] as const;

/** Pourquoi un format n'est pas écrit, dit au client et pas à nous. */
const CE_QUI_MANQUE: Record<string, string> = {
  pdf: "l'application ne sait pas encore écrire un PDF",
  png: "l'agent image ne tourne pas encore sur cette machine",
  jpg: "l'agent image ne tourne pas encore sur cette machine",
  mp4: "l'agent vidéo ne tourne pas encore sur cette machine",
  mp3: "l'agent son ne tourne pas encore sur cette machine",
  wav: "l'agent son ne tourne pas encore sur cette machine",
};

export interface TacheDuJour {
  tache: Tache;
  /**
   * Vrai quand rien ne dit où l'agent prend sa matière : la tâche part quand
   * même, mais il réclamera au lieu d'inventer. 8 398 tâches sur 9 233 sont
   * dans ce cas au 23/09/2026, le temps que les entrées des fiches nomment un
   * dossier plutôt qu'une idée.
   */
  sansMatiere: boolean;
  /**
   * Où le résultat ira, dit au client : le dossier qu'il a désigné, ou le
   * chemin chez l'agent. L'application le crée à la première écriture ; il n'a
   * rien à choisir pour démarrer. Le chemin complet revient avec le résultat.
   */
  ou: string | null;
  /** Ce qui empêche de la lancer, en clair ; null quand elle peut partir. */
  empechement: string | null;
  /** Vrai quand le résultat attendra un accord avant d'être utilisé. */
  validation: boolean;
}

/**
 * Ce que cet agent peut faire aujourd'hui.
 *
 * Les tâches éteintes ne sont pas listées : le client les a retirées, les
 * afficher grisées lui redemanderait une décision qu'il a déjà prise.
 */
export function travailDuJour(agent: AgentInstalle): TacheDuJour[] {
  return agent.planning.filter((t) => t.active).map((tache) => {
    const sources = tache.entrees
      .filter((e) => e.startsWith('dossier:'))
      .map((e) => e.slice('dossier:'.length))
      .filter((c) => c.length > 0);
    // Le client n'a rien à choisir : l'agent a son propre dossier de travail et
    // les dossiers logiques de la fiche en sont des sous-dossiers. Ce qu'il
    // désigne l'emporte, et lui seul fait sortir l'agent de chez lui.
    // Sans dossier d'entrée déclaré, rien ne dit où l'agent prend sa matière :
    // il réclamera au lieu d'inventer. 8 398 tâches sur 9 233 sont dans ce cas.
    const sansMatiere = sources.length === 0;
    const sortie = tache.sorties[0];
    if (!sortie) {
      return { tache, sansMatiere, ou: null, validation: tache.validationHumaine,
        empechement: "cette tâche ne dit pas où va son résultat" };
    }
    const ou = agent.dossiers[sortie.dossier] ?? `${agent.prenom} › ${sortie.dossier}`;
    if (!FORMATS_ECRITS.includes(sortie.format as (typeof FORMATS_ECRITS)[number])) {
      return { tache, sansMatiere, ou, validation: tache.validationHumaine,
        empechement: CE_QUI_MANQUE[sortie.format] ?? `le format « ${sortie.format} » n'est pas prévu` };
    }
    return { tache, sansMatiere, ou, validation: tache.validationHumaine, empechement: null };
  });
}

/** Ce que l'écran annonce en tête : combien partent, combien attendent quoi. */
export function resumeDuTravail(travail: readonly TacheDuJour[]): string {
  const prets = travail.filter((t) => !t.empechement).length;
  if (!travail.length) return "Aucune tâche n'est allumée pour cet agent.";
  if (prets === travail.length) {
    return prets === 1 ? 'Une tâche peut partir.' : `${prets} tâches peuvent partir.`;
  }
  const bloquees = travail.length - prets;
  const debut = prets === 0 ? 'Aucune tâche ne peut partir' :
    prets === 1 ? 'Une tâche peut partir' : `${prets} tâches peuvent partir`;
  return `${debut}, ${bloquees === 1 ? 'une attend' : `${bloquees} attendent`} quelque chose de vous.`;
}
