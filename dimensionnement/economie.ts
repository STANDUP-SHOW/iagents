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

export interface PaquetEco extends AgentDimension { taches: (TachePlanifiee & { logiciels?: string[]; sorties?: { format: string }[] })[]; commercial?: { prixMensuel?: { min: number } } }
export interface Economie {
  executionsParMois: number;
  toursParExecution: number;
  apiSeulReference: number; apiSeulHautDeGamme: number;
  apiResiduelle: number;
  materielSeul: number; materielPartage: number; poste: number; electricite: number;
  localAgentSeul: number; localAgentPartage: number;
  ratioSeul: number; ratioPartage: number;
  abonnement: number; totalClientPartage: number;
  employe: number; smic: number;
  bundle?: Machine; agentsParBundle: number; capacitesHorsLocal: string[];
}

export const RATIO_MINIMUM = 3;
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

/** Monthly API bill of an agent if every execution went through the API. */
export function coutApiMensuel(paquet: PaquetEco, prix = tarifs.modeles.reference): { total: number; executions: number; toursMoyens: number } {
  let total = 0, executions = 0, tours = 0;
  for (const t of paquet.taches) {
    if (!t.active) continue;
    const parMois = appelsParJour([t]) * JOURS;
    const n = toursPour(t);
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
export function economiePour(paquet: PaquetEco, { avecPoste = false, catalogue = BUNDLES }: { avecPoste?: boolean; catalogue?: Machine[] } = {}): Economie {
  const ref = coutApiMensuel(paquet);
  const haut = coutApiMensuel(paquet, tarifs.modeles.hautDeGamme);
  const place = machinesPourPack([paquet], catalogue);
  const bundle = place.machines[0]?.machine;
  const capacitesHorsLocal: string[] = [];
  const mat = materielPour(paquet.modeles);
  if (!bundle) capacitesHorsLocal.push(...Object.keys(paquet.modeles).filter((k) => k !== 'activite'));
  // Residual API: the commercial share on what runs locally, 100 % on what cannot.
  const partApi = bundle ? tarifs.partApiResiduelle : 1;
  const apiResiduelle = ref.total * partApi;
  const agentsParBundle = bundle ? Math.max(1, agentsParMachine(bundle, paquet)) : 0;
  const watts = bundle ? (tarifs.electricite.wattsParGamme as Record<string, number>)[bundle.gamme] ?? 100 : 0;
  const elecBundle = (watts * 24 * JOURS / 1000) * tarifs.electricite.prixKwhEur;
  const materielSeul = bundle ? bundle.prixIndicatif / tarifs.amortissementMois + elecBundle : 0;
  const materielPartage = bundle ? (bundle.prixIndicatif / tarifs.amortissementMois + elecBundle) / agentsParBundle : 0;
  const poste = avecPoste ? POSTES[0].prixIndicatif / tarifs.amortissementMois + (tarifs.electricite.wattsParGamme.poste * 24 * JOURS / 1000) * tarifs.electricite.prixKwhEur : 0;
  const localAgentSeul = apiResiduelle + materielSeul + poste;
  const localAgentPartage = apiResiduelle + materielPartage + poste;
  const abonnement = paquet.commercial?.prixMensuel?.min ?? 0;
  return {
    executionsParMois: Math.round(ref.executions), toursParExecution: r(ref.toursMoyens),
    apiSeulReference: r(ref.total), apiSeulHautDeGamme: r(haut.total),
    apiResiduelle: r(apiResiduelle),
    materielSeul: r(materielSeul), materielPartage: r(materielPartage), poste: r(poste), electricite: r(elecBundle / Math.max(1, agentsParBundle)),
    localAgentSeul: r(localAgentSeul), localAgentPartage: r(localAgentPartage),
    ratioSeul: r(ref.total / Math.max(0.01, localAgentSeul)), ratioPartage: r(ref.total / Math.max(0.01, localAgentPartage)),
    abonnement, totalClientPartage: r(localAgentPartage + abonnement),
    employe: tarifs.employe.coutEmployeurMensuelEur, smic: tarifs.employe.smicChargeMensuelEur,
    bundle, agentsParBundle, capacitesHorsLocal, ...(mat && {}),
  };
}
