/**
 * Les logiciels de création qui tournent sur le poste du client (Photoshop, Final Cut,
 * AutoCAD, Blender, GIMP…), et ceux qu'un agent peut employer.
 *
 * Aucun champ du référentiel ne le dit à part : un logiciel de création local est une
 * entrée de `catalogue/logiciels.json` dont la famille est une famille de création et
 * qui n'est pas uniquement en ligne. La règle vit ici seulement. Ce qu'un agent peut
 * employer se lit dans les familles que ses tâches ouvrent (`acces.logiciels`), et
 * s'écrit dans la fiche sous `acces.logicielsCreation` par
 * `npm run verifier -- --corriger`, jamais à la main.
 *
 * Aucune lecture de fichier : la boutique l'appelle aussi dans le navigateur.
 */
export const FAMILLES_CREATION = [
  'design-creation',
  'montage-video',
  'audio-production',
  'cao-dao',
  'bim-maquette',
  'cao-fao-usinage',
  'conception-cuisine-bain',
  'prepresse-impression',
  'creation-elearning',
  'jeu-video',
  'transcription-sous-titres',
] as const;

export type LogicielReferentiel = { id: string; categorie: string; deploiement: string };

export function estCreationLocale(l: LogicielReferentiel): boolean {
  return (FAMILLES_CREATION as readonly string[]).includes(l.categorie) && l.deploiement !== 'cloud';
}

export function logicielsCreation(
  familles: readonly string[],
  logiciels: readonly LogicielReferentiel[],
): string[] {
  const ouvertes = new Set(familles);
  return logiciels.filter((l) => ouvertes.has(l.categorie) && estCreationLocale(l)).map((l) => l.id);
}
