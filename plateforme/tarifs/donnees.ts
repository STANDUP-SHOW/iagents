// Loads the pricing files of the repository. They are imported as JSON, so they
// travel inside the code (Node and Cloudflare alike) and no file is read at run
// time. The engine itself (moteur.ts) imports nothing, so the sites can use it
// in a browser.
import plansJson from './plans.json' with { type: 'json' };
import fiscaliteJson from './fiscalite.json' with { type: 'json' };
import coutsJson from './couts-fournisseurs.json' with { type: 'json' };
import tarifsApiJson from '../../dimensionnement/tarifs-api.json' with { type: 'json' };
import offreBoxJson from '../../dimensionnement/offre-box.json' with { type: 'json' };
import type { Stockage } from '../stockage.ts';
import {
  avecPrix, fautesDuPlan, planALaDate, plansDeDepart,
  type CoutsFournisseurs, type FichierPlans, type Fiscalite, type PlanTarif, type TarifsApi,
} from './moteur.ts';

// A fresh copy at each load, as a file read gave: nothing downstream can alter the imported module.
const copie = <T>(v: unknown): T => structuredClone(v) as T;

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
  const fichier = copie<FichierPlans>(plansJson);
  const fiscalite = copie<Fiscalite>(fiscaliteJson);
  const depart = plansDeDepart(fichier, copie(offreBoxJson));
  const fautes = depart.flatMap((p) => fautesDuPlan(p, fiscalite).map((f) => `${p.plan_id} : ${f}`));
  if (fautes.length) throw new Error(`plans.json refusé :\n${fautes.join('\n')}`);
  return {
    fichier, depart, fiscalite,
    couts: copie<CoutsFournisseurs>(coutsJson),
    tarifsApi: copie<TarifsApi>(tarifsApiJson),
  };
}
