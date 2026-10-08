// Reads the pricing files from the repository (Node only). The engine itself
// (moteur.ts) never touches a file, so the sites can import it in a browser.
import { readFileSync } from 'node:fs';
import type { Stockage } from '../stockage.ts';
import {
  avecPrix, fautesDuPlan, planALaDate, plansDeDepart,
  type CoutsFournisseurs, type FichierPlans, type Fiscalite, type PlanTarif, type TarifsApi,
} from './moteur.ts';

const lire = <T>(chemin: string): T => JSON.parse(readFileSync(new URL(chemin, import.meta.url), 'utf8')) as T;

export type Tarifs = {
  fichier: FichierPlans;
  depart: PlanTarif[];
  fiscalite: Fiscalite;
  couts: CoutsFournisseurs;
  tarifsApi: TarifsApi;
};

let cache: Tarifs | null = null;
/** The files, read once per process. */
export const tarifs = (): Tarifs => (cache ??= chargerTarifs());

/** Store collection holding the versions posted after the seed. */
export const COLLECTION_VERSIONS = 'tarifs_versions';

/** Every version known to this platform: the seed file plus what was posted since. */
export function toutesLesVersions(stockage: Stockage | null): PlanTarif[] {
  return [...tarifs().depart, ...(stockage ? stockage.lister<PlanTarif>(COLLECTION_VERSIONS) : [])];
}

/**
 * The plan in force at a date, with its price resolved (pack sums, prix_force)
 * and both HT and TTC amounts. For the other modules of the platform: pass
 * `ctx.stockage` so that versions posted since the seed count.
 */
export function prixDuPlan(stockage: Stockage | null, plan_id: string, date: string, region = 'FR') {
  const p = planALaDate(toutesLesVersions(stockage), plan_id, date, region);
  return p ? avecPrix(p, tarifs().fiscalite) : null;
}

/** Loads and checks every file; a seed plan that fails a rule stops the platform instead of being served. */
export function chargerTarifs(): Tarifs {
  const fichier = lire<FichierPlans>('./plans.json');
  const fiscalite = lire<Fiscalite>('./fiscalite.json');
  const depart = plansDeDepart(fichier, lire('../../dimensionnement/offre-box.json'));
  const fautes = depart.flatMap((p) => fautesDuPlan(p, fiscalite).map((f) => `${p.plan_id} : ${f}`));
  if (fautes.length) throw new Error(`plans.json refusé :\n${fautes.join('\n')}`);
  return {
    fichier, depart, fiscalite,
    couts: lire<CoutsFournisseurs>('./couts-fournisseurs.json'),
    tarifsApi: lire<TarifsApi>('../../dimensionnement/tarifs-api.json'),
  };
}
