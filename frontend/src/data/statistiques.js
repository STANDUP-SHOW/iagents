// The public catalogue's numbers, computed once, here, from the catalogue
// files (max, 10/10: « 0 compteur codé en dur + 1 seule source de vérité »).
// The home page, the catalogue, the generated pages, the footer, the SEO
// report and the sitemaps all read this; a total written anywhere else is a
// fault of the SEO report. The number of jobs is the catalogue's list, which
// `verifier-paquets` and the bench keep equal to the fiches of agents/.
import catalogue from '../../../catalogue/catalogue.json' with { type: 'json' };
import activitesJson from '../../../catalogue/activites.json' with { type: 'json' };
import logicielsJson from '../../../catalogue/logiciels.json' with { type: 'json' };

/**
 * @param {Array<{taches?: unknown[]}>} [fiches] the loaded fiches, when the
 *   caller has them: adds the number of tasks and refuses a count that
 *   differs from the catalogue's, so two readers can never show two totals.
 */
export function statistiquesCatalogue(fiches = null) {
  const metiers = catalogue.agents.length;
  if (fiches && fiches.length !== metiers) {
    throw new Error(`${fiches.length} fiches chargées pour ${metiers} métiers au catalogue : les deux doivent être égaux`);
  }
  return {
    metiers,
    secteurs: catalogue.secteurs.length,
    activites: activitesJson.activites.length,
    logiciels: logicielsJson.logiciels.length,
    taches: fiches ? fiches.reduce((n, f) => n + (f.taches?.length ?? 0), 0) : null,
  };
}
