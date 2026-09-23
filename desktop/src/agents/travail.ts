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
export const FORMATS_ECRITS = ['md', 'txt', 'csv', 'json', 'html'] as const;

/** Pourquoi un format n'est pas écrit, dit au client et pas à nous. */
const CE_QUI_MANQUE: Record<string, string> = {
  xlsx: "l'application ne sait pas encore écrire un tableur",
  docx: "l'application ne sait pas encore écrire un document",
  pdf: "l'application ne sait pas encore écrire un PDF",
  eml: "l'application envoie des courriels mais n'en écrit pas le brouillon sur le disque",
  png: "l'agent image ne tourne pas encore sur cette machine",
  jpg: "l'agent image ne tourne pas encore sur cette machine",
  mp4: "l'agent vidéo ne tourne pas encore sur cette machine",
  mp3: "l'agent son ne tourne pas encore sur cette machine",
  wav: "l'agent son ne tourne pas encore sur cette machine",
};

export interface TacheDuJour {
  tache: Tache;
  /** Le dossier réel où le résultat sera posé, quand il est choisi. */
  dossier: string | null;
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
    const sortie = tache.sorties[0];
    if (!sortie) {
      return { tache, dossier: null, validation: tache.validationHumaine,
        empechement: "cette tâche ne dit pas où va son résultat" };
    }
    const dossier = agent.dossiers[sortie.dossier] ?? null;
    if (!FORMATS_ECRITS.includes(sortie.format as (typeof FORMATS_ECRITS)[number])) {
      return { tache, dossier, validation: tache.validationHumaine,
        empechement: CE_QUI_MANQUE[sortie.format] ?? `le format « ${sortie.format} » n'est pas prévu` };
    }
    if (!dossier) {
      return { tache, dossier: null, validation: tache.validationHumaine,
        empechement: `choisissez d'abord le dossier « ${sortie.dossier} »` };
    }
    return { tache, dossier, validation: tache.validationHumaine, empechement: null };
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
