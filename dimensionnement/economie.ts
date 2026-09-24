/**
 * Economic case per agent, derived from its package and the machine catalogue:
 *   - what the customer would pay in API tokens without us (reference and high-end models),
 *   - what they pay with Local-Agent: residual API share + hardware per month over one year,
 *   - the ratio between the two, against the commercial rule (at least 3x cheaper),
 *   - the same figures against a human employee.
 * Every assumption lives in tarifs-api.json. Nothing here is measured yet: replace the
 * assumptions with the averages logged by real agents as soon as they run.
 */
import tarifs from './tarifs-api.json' with { type: 'json' };
import { appelsParJour, machinesPourPack, agentsParMachine, materielPour, POSTES, BUNDLES, type AgentDimension, type Machine, type TachePlanifiee } from './calculer.ts';
import { INTENSITES, REPARTITIONS, INTENSITE_DEFAUT, REPARTITION_DEFAUT, PROFONDEUR_APPLIQUEE, type Intensite, type Repartition } from './intensite.ts';

export interface PaquetEco extends AgentDimension { taches: (TachePlanifiee & { logiciels?: string[]; sorties?: { format: string }[] })[]; commercial?: { prixMensuel?: { min: number } } }
export interface Economie {
  executionsParMois: number;
  toursParExecution: number;
  apiSeulReference: number; apiSeulHautDeGamme: number;
  apiResiduelle: number;
  materielSeul: number; materielPartage: number; materielFlotte: number; poste: number; electricite: number;
  localAgentSeul: number; localAgentPartage: number;
  ratioSeul: number; ratioPartage: number;
  abonnement: number; totalClientPartage: number;
  employe: number; smic: number;
  bundle?: Machine; agentsParBundle: number; capacitesHorsLocal: string[];
}

export const RATIO_MINIMUM = 3;
/** A bundle never serves more than ~20 different agents' fixed overhead: no agent pays less than 5 % of it. */
export const PART_MINIMALE = 0.05;
const JOURS = 30;

function toursPour(t: PaquetEco['taches'][number]): number {
  let n = tarifs.toursParExecution.base;
  if (t.logiciels?.includes('navigateur')) n += tarifs.toursParExecution.navigateur;
  if (t.sorties?.some((s) => ['docx', 'xlsx', 'pdf'].includes(s.format))) n += tarifs.toursParExecution.documentLourd;
  return n;
}

/** EUR cost of one model turn at a given price list. */
function coutTourEur(prix: { entree: number; entreeCache: number; sortie: number }): number {
  const { jetonsEntree, partCache, jetonsSortie } = tarifs.tour;
  const usd = (jetonsEntree * (1 - partCache) * prix.entree + jetonsEntree * partCache * prix.entreeCache + jetonsSortie * prix.sortie) / 1e6;
  return usd * tarifs.tauxUsdEur;
}

/**
 * Monthly API bill of an agent if every execution went through the API.
 * `intensite` is what the customer chose at the hiring interview: it stretches how often a
 * task runs, and — once there is a turn loop to stretch — how deep each run goes. Depth is
 * not applied yet (`PROFONDEUR_APPLIQUEE`), and the quote must not charge for it.
 */
export function coutApiMensuel(
  paquet: PaquetEco,
  prix = tarifs.modeles.reference,
  intensite: Intensite = INTENSITE_DEFAUT
): { total: number; executions: number; toursMoyens: number } {
  const reglage = INTENSITES[intensite];
  let total = 0, executions = 0, tours = 0;
  for (const t of paquet.taches) {
    if (!t.active) continue;
    const parMois = appelsParJour([t]) * JOURS * reglage.frequence;
    // La profondeur n'est comptée que si elle est appliquée quelque part. Elle
    // ne l'est pas : le devis annoncé au client à l'entretien ne doit pas
    // facturer des tours que l'agent ne fera pas.
    const n = toursPour(t) * (PROFONDEUR_APPLIQUEE ? reglage.profondeur : 1);
    let coutExec = n * coutTourEur(prix);
    if (t.sorties?.some((s) => ['png', 'jpg'].includes(s.format))) coutExec += tarifs.image.prixUnitaireUsd * tarifs.image.parExecution * tarifs.tauxUsdEur;
    if (t.sorties?.some((s) => s.format === 'mp4')) coutExec += tarifs.video.prixUnitaireUsd * tarifs.video.parExecution * tarifs.tauxUsdEur;
    total += parMois * coutExec; executions += parMois; tours += parMois * n;
  }
  return { total, executions, toursMoyens: executions ? tours / executions : 0 };
}

const r = (x: number) => Math.round(x * 100) / 100;

/**
 * The full case. `avecPoste`: the customer buys a poste per agent (else uses their own PC).
 * `catalogue`: bundles considered (default: all brains).
 */
export function economiePour(
  paquet: PaquetEco,
  { avecPoste = false, catalogue = BUNDLES, intensite = INTENSITE_DEFAUT, repartition = REPARTITION_DEFAUT }:
    { avecPoste?: boolean; catalogue?: Machine[]; intensite?: Intensite; repartition?: Repartition } = {}
): Economie {
  const ref = coutApiMensuel(paquet, tarifs.modeles.reference, intensite);
  const haut = coutApiMensuel(paquet, tarifs.modeles.hautDeGamme, intensite);
  const place = machinesPourPack([paquet], catalogue);
  const bundle = place.machines[0]?.machine;
  const capacitesHorsLocal: string[] = [];
  const mat = materielPour(paquet.modeles);
  if (!bundle) capacitesHorsLocal.push(...Object.keys(paquet.modeles).filter((k) => k !== 'activite'));
  // Residual API: the commercial share on what runs locally, 100 % on what cannot.
  // Sans bundle, tout passe forcément par l'API ; avec, c'est le client qui a choisi sa part.
  const partApi = bundle ? REPARTITIONS[repartition].partApi : 1;
  const apiResiduelle = ref.total * partApi;
  const agentsParBundle = bundle ? Math.max(1, agentsParMachine(bundle, paquet)) : 0;
  const coutMensuel = (m: Machine) => m.prixIndicatif / tarifs.amortissementMois + ((tarifs.electricite.wattsParGamme as Record<string, number>)[m.gamme] ?? 100) * 24 * JOURS / 1000 * tarifs.electricite.prixKwhEur;
  const elecBundle = bundle ? ((tarifs.electricite.wattsParGamme as Record<string, number>)[bundle.gamme] ?? 100) * 24 * JOURS / 1000 * tarifs.electricite.prixKwhEur : 0;
  // Shared: a customer's bundle carries a MIX of agents; this one pays its share of the load (floor PART_MINIMALE).
  const part = (m: Machine) => Math.max(PART_MINIMALE, mat.chargeContinue / m.capaciteGpu);
  const materielSeul = bundle ? coutMensuel(bundle) : 0;
  const materielPartage = bundle ? coutMensuel(bundle) * part(bundle) : 0;
  // Fleet: the bundle with the best price per unit of capacity among those that hold the agent.
  const flotte = catalogue.filter((m) => machinesPourPack([paquet], [m]).impossibles.length === 0)
    .reduce<Machine | undefined>((best, m) => (!best || coutMensuel(m) / m.capaciteGpu < coutMensuel(best) / best.capaciteGpu ? m : best), undefined);
  const materielFlotte = flotte ? coutMensuel(flotte) * part(flotte) : 0;
  const poste = avecPoste ? POSTES[0].prixIndicatif / tarifs.amortissementMois + (tarifs.electricite.wattsParGamme.poste * 24 * JOURS / 1000) * tarifs.electricite.prixKwhEur : 0;
  const localAgentSeul = apiResiduelle + materielSeul + poste;
  const localAgentPartage = apiResiduelle + materielPartage + poste;
  const abonnement = paquet.commercial?.prixMensuel?.min ?? 0;
  return {
    executionsParMois: Math.round(ref.executions), toursParExecution: r(ref.toursMoyens),
    apiSeulReference: r(ref.total), apiSeulHautDeGamme: r(haut.total),
    apiResiduelle: r(apiResiduelle),
    materielSeul: r(materielSeul), materielPartage: r(materielPartage), materielFlotte: r(materielFlotte), poste: r(poste), electricite: r(elecBundle * (bundle ? part(bundle) : 0)),
    localAgentSeul: r(localAgentSeul), localAgentPartage: r(localAgentPartage),
    ratioSeul: r(ref.total / Math.max(0.01, localAgentSeul)), ratioPartage: r(ref.total / Math.max(0.01, localAgentPartage)),
    abonnement, totalClientPartage: r(localAgentPartage + abonnement),
    employe: tarifs.employe.coutEmployeurMensuelEur, smic: tarifs.employe.smicChargeMensuelEur,
    bundle, agentsParBundle, capacitesHorsLocal,
  };
}
