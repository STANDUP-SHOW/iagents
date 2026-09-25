/**
 * Les logiciels qu'un agent demande sur le poste, dérivés de ses tâches.
 *
 * Une fiche nomme des familles (`acces.logiciels`, lui-même dérivé des tâches) ;
 * `usine/logiciels.json` dit quel logiciel libre sert quelle famille. La liste
 * d'un agent est l'intersection des deux, dans l'ordre de `logiciels.json`.
 * Elle s'écrit dans la fiche (`acces.logicielsPoste`) par
 * `npm run verifier -- --corriger`, jamais à la main : c'est ce que le script
 * d'usine installe pour les agents embauchés.
 */
export type LogicielUsine = { id: string; familles?: string[] };

export function logicielsPoste(
  familles: readonly string[],
  logiciels: readonly LogicielUsine[],
): string[] {
  const demandees = new Set(familles);
  return logiciels
    .filter((l) => (l.familles ?? []).some((f) => demandees.has(f)))
    .map((l) => l.id);
}
