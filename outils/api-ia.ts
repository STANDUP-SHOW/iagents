/**
 * Les API d'intelligence artificielle qu'un agent peut employer, lues dans
 * `catalogue/api-ia.json`.
 *
 * Une fiche ne recopie aucune API : elle porte déjà, sous `execution.api.capacites`,
 * la famille d'API qui remplace chacune de ses capacités (llm, image, video,
 * parole…). La liste d'un agent est la jointure des deux. Recopier 40 identifiants
 * dans 1 249 fiches, c'est se garantir qu'un fournisseur ajouté au catalogue manque
 * à la moitié d'entre elles.
 *
 * Aucune lecture de fichier : la boutique l'appelle aussi dans le navigateur.
 */
export type ApiIa = {
  id: string;
  nom: string;
  editeur: string;
  groupe: 'modeles' | 'creation';
  familles: string[];
  specialites: string[];
  priorite: string;
  branche: boolean;
};

/** Pour chaque famille dont la fiche a besoin, les API qui la servent, P0 d'abord. */
export function apisPourFiche(
  capacites: Record<string, string>,
  apis: readonly ApiIa[],
): Record<string, string[]> {
  const rendu: Record<string, string[]> = {};
  for (const famille of [...new Set(Object.values(capacites))]) {
    rendu[famille] = apis
      .filter((a) => a.familles.includes(famille))
      .sort((a, b) => a.priorite.localeCompare(b.priorite))
      .map((a) => a.id);
  }
  return rendu;
}

/** Les API d'une spécialité (publicite, avatar, traduction…), P0 d'abord. */
export function apisDeSpecialite(specialite: string, apis: readonly ApiIa[]): string[] {
  return apis
    .filter((a) => a.specialites.includes(specialite))
    .sort((a, b) => a.priorite.localeCompare(b.priorite))
    .map((a) => a.id);
}
