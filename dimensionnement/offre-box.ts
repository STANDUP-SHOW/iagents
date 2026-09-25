/**
 * L'offre machines d'iAgent (max, 25/09/2026) : le client choisit d'abord son installation,
 * et c'est elle qui dit, pour chaque agent, ce qu'il coûte en local contre ce qu'il coûte
 * en API.
 *
 * Six installations : sans machine, Box Commandeur seule (aucune puissance), Box Max (la
 * première puissance), et trois machines de puissance livrées chacune avec une Box
 * Commandeur. Toutes à l'achat ou en financement sur 24 mois.
 *
 * Deux calculs, parce qu'ils ne répondent pas à la même question :
 *   - `devisParBox(fiche)` : sur la fiche d'un agent, une ligne par installation — tient-il
 *     en local dessus, ce qu'il coûte alors par mois, ce qu'il coûte en API seule, et si
 *     cet agent seul rembourse la mensualité de la machine ;
 *   - `devisPack(fiches, offre)` et `conseillerBox(fiches)` : pour une équipe, ce que coûte
 *     chaque installation tout compris (mensualité, électricité, API résiduelle des agents
 *     placés, API complète des autres), et laquelle conseiller.
 *
 * Aucune machine n'est supposée infinie : les agents se placent sur la machine par ordre
 * d'économie décroissante, tant que `tientSur` le permet, et les autres restent en API —
 * le devis le dit agent par agent. Tous les prix de `offre-box.json` sont provisoires tant
 * que max ne les a pas donnés.
 */
import offreJson from './offre-box.json' with { type: 'json' };
import tarifs from './tarifs-api.json' with { type: 'json' };
import { MACHINES, tientSur, type Machine } from './calculer.ts';
import { coutApiMensuel, type PaquetEco } from './economie.ts';
import { INTENSITE_DEFAUT, REPARTITIONS, REPARTITION_DEFAUT, type Intensite, type Repartition } from './intensite.ts';

export type RoleOffre = 'aucune' | 'commande' | 'puissance';
export interface OffreBox {
  id: string; nom: string; role: RoleOffre; phrase: string; specifications?: string;
  prixAchat: number; aConfirmer: boolean; source?: string; lueLe?: string;
  capaciteDe: string | null; posteDe?: string; avecCommandeur: boolean;
}

export const OFFRES: OffreBox[] = offreJson.offres as OffreBox[];
export const FINANCEMENT = offreJson.financement;
export const COMMANDEUR: OffreBox = OFFRES.find((o) => o.role === 'commande')!;
const JOURS = 30;

export function offre(id: string): OffreBox {
  const o = OFFRES.find((x) => x.id === id);
  if (!o) throw new Error(`Installation inconnue : ${id}`);
  return o;
}

/** La machine du relevé dont l'offre emprunte la capacité, ou rien pour une offre sans puissance. */
export function machineDe(o: OffreBox): Machine | undefined {
  if (!o.capaciteDe) return undefined;
  const m = MACHINES.find((x) => x.id === o.capaciteDe);
  if (!m) throw new Error(`${o.id} emprunte la capacité de ${o.capaciteDe}, absent de machines.json`);
  return m;
}

/** Mensualité d'un prix financé sur `FINANCEMENT.mois`, au taux annuel du fichier (annuité constante). */
export function mensualite(prix: number, tauxAnnuel: number = FINANCEMENT.tauxAnnuel, mois: number = FINANCEMENT.mois): number {
  const n = mois, t = tauxAnnuel / 12;
  return t === 0 ? prix / n : (prix * t) / (1 - Math.pow(1 + t, -n));
}

const watts = (gamme: string) => (tarifs.electricite.wattsParGamme as Record<string, number>)[gamme] ?? 100;
const electriciteMensuelle = (w: number) => (w * 24 * JOURS / 1000) * tarifs.electricite.prixKwhEur;

/** Ce que l'installation coûte par mois, sans aucun agent : prix d'achat (commandeur compris) et électricité. */
export function coutInstallation(o: OffreBox) {
  const prixAchat = o.prixAchat + (o.avecCommandeur ? COMMANDEUR.prixAchat : 0);
  const m = machineDe(o);
  const w = (m ? watts(m.gamme) : 0) + (o.role === 'commande' || o.avecCommandeur ? watts('poste') : 0);
  return {
    prixAchat,
    mensualite: mensualite(prixAchat),
    electricite: electriciteMensuelle(w),
    aConfirmer: o.aConfirmer || (o.avecCommandeur && COMMANDEUR.aConfirmer) || (prixAchat > 0 && FINANCEMENT.aConfirmer),
  };
}

const r = (x: number) => Math.round(x * 100) / 100;

export interface LigneDevis {
  offre: string; nom: string; aConfirmer: boolean;
  enLocal: boolean;
  /** Ce que l'agent se paie en jetons chaque mois sur cette installation. */
  coutAgent: number;
  apiSeule: number;
  economie: number;
  /** Mensualité (24 mois) et électricité de l'installation entière. */
  mensualite: number; electricite: number;
  /** Vrai si l'économie de cet agent seul couvre la mensualité et l'électricité. */
  rembourseSeul: boolean;
  motif: string;
}

/** Une ligne par installation, pour la fiche d'un agent. */
export function devisParBox(
  paquet: PaquetEco,
  { intensite = INTENSITE_DEFAUT, repartition = REPARTITION_DEFAUT }: { intensite?: Intensite; repartition?: Repartition } = {}
): LigneDevis[] {
  const apiSeule = coutApiMensuel(paquet, undefined, intensite).total;
  return OFFRES.map((o) => {
    const inst = coutInstallation(o);
    const m = machineDe(o);
    const enLocal = !!m && tientSur(m, [paquet]);
    const coutAgent = enLocal ? apiSeule * REPARTITIONS[repartition].partApi : apiSeule;
    const economie = apiSeule - coutAgent;
    const fixe = inst.mensualite + inst.electricite;
    const motif = !m
      ? o.role === 'aucune' ? "Tout par API." : "La Box Commandeur ne fait pas tourner d'agent : celui-ci travaille par API."
      : enLocal ? `Tourne sur ${o.nom} ; ${Math.round(REPARTITIONS[repartition].partApi * 100)} % reste par API.`
      : `${o.nom} ne le tient pas : il reste par API.`;
    return {
      offre: o.id, nom: o.nom, aConfirmer: inst.aConfirmer, enLocal,
      coutAgent: r(coutAgent), apiSeule: r(apiSeule), economie: r(economie),
      mensualite: r(inst.mensualite), electricite: r(inst.electricite),
      rembourseSeul: fixe > 0 && economie >= fixe,
      motif,
    };
  });
}

export interface DevisPack {
  offre: string; nom: string; aConfirmer: boolean;
  enLocal: string[]; enApi: string[];
  mensualite: number; electricite: number; api: number;
  /** Total par mois pendant le financement, puis une fois la machine payée. */
  totalPendant: number; totalApres: number;
  /** Ce que coûterait la même équipe tout par API. */
  toutApi: number;
  /** Mois pour que les économies cumulées paient la machine achetée comptant (Infinity si jamais). */
  moisPourRembourser: number;
}

/**
 * Ce que coûte une équipe sur une installation. Les agents se placent par économie
 * décroissante tant que la machine les tient (poids partagés entre agents du même
 * palier, comme partout ailleurs) ; les autres restent en API.
 */
export function devisPack(
  paquets: PaquetEco[],
  id: string,
  { intensite = INTENSITE_DEFAUT, repartition = REPARTITION_DEFAUT }: { intensite?: Intensite; repartition?: Repartition } = {}
): DevisPack {
  const o = offre(id);
  const inst = coutInstallation(o);
  const m = machineDe(o);
  const partApi = REPARTITIONS[repartition].partApi;
  const couts = paquets.map((p) => ({ p, api: coutApiMensuel(p, undefined, intensite).total }))
    .sort((a, b) => b.api - a.api);
  const places: PaquetEco[] = [];
  let api = 0, toutApi = 0;
  const enLocal: string[] = [], enApi: string[] = [];
  for (const { p, api: c } of couts) {
    toutApi += c;
    if (m && tientSur(m, [...places, p])) { places.push(p); enLocal.push(p.id); api += c * partApi; }
    else { enApi.push(p.id); api += c; }
  }
  const economieMensuelle = toutApi - api - inst.electricite;
  return {
    offre: o.id, nom: o.nom, aConfirmer: inst.aConfirmer, enLocal, enApi,
    mensualite: r(inst.mensualite), electricite: r(inst.electricite), api: r(api),
    totalPendant: r(inst.mensualite + inst.electricite + api),
    totalApres: r(inst.electricite + api),
    toutApi: r(toutApi),
    moisPourRembourser: inst.prixAchat === 0 ? 0 : economieMensuelle > 0 ? Math.ceil(inst.prixAchat / economieMensuelle) : Infinity,
  };
}

/**
 * L'installation à conseiller pour une équipe : la moins chère sur toute la durée du
 * financement puis autant après (48 mois), parce qu'une machine se garde au-delà de ses
 * mensualités. À coût égal, la plus petite. « Sans machine » est une réponse possible, et
 * c'est la bonne pour une équipe peu sollicitée (règle de max du 24/09).
 */
export function conseillerBox(paquets: PaquetEco[], reglages: { intensite?: Intensite; repartition?: Repartition } = {}) {
  const devis = OFFRES.map((o) => devisPack(paquets, o.id, reglages));
  const horizon = (d: DevisPack) => d.totalPendant * FINANCEMENT.mois + d.totalApres * FINANCEMENT.mois;
  const conseil = devis.reduce((best, d) => (horizon(d) < horizon(best) - 0.005 ? d : best));
  return { conseil, devis };
}
