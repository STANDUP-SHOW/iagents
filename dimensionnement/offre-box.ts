/**
 * L'offre machines d'iAgent (max, 25/09/2026) : le client choisit d'abord son installation,
 * et c'est elle qui dit, pour chaque agent, ce qu'il coûte en local contre ce qu'il coûte
 * en API.
 *
 * Six installations : sans machine, Box Commandeur seule (aucune puissance), Box Max (la
 * première puissance), et trois machines de puissance livrées chacune avec une Box
 * Commandeur. Toutes à l'achat ou en financement (durée et taux dans `offre-box.json`).
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
 * le devis le dit agent par agent. Prix et machines viennent du catalogue matériel de max
 * (25/09/2026).
 */
import offreJson from './offre-box.json' with { type: 'json' };
import tarifs from './tarifs-api.json' with { type: 'json' };
import { tientSur, type Machine } from './calculer.ts';
import { coutApiMensuel, type PaquetEco } from './economie.ts';
import { INTENSITE_DEFAUT, REPARTITIONS, REPARTITION_DEFAUT, type Intensite, type Repartition } from './intensite.ts';

export type RoleOffre = 'aucune' | 'commande' | 'puissance';
export interface OffreBox {
  id: string; nom: string; role: RoleOffre; phrase: string; specifications?: string;
  prixAchat: number; aConfirmer: boolean; source?: string; lueLe?: string;
  /** Catalogue columns copied as they are, for the shop: cost, price incl. VAT, lease and subscription per month. */
  catalogueId?: string; coutHT?: number; prixTTC?: number; leasingMensuelHT?: number; abonnementMensuel?: number;
  /** The machine agents are placed on. Kept out of machines.json, whose survey backs the 3x rule. */
  machine: Machine | null; avecCommandeur: boolean;
  /**
   * Share of an agent's work that stays on the machine even when its full model does not fit
   * (max, 16/10/2026: at least 40 % on the 64 Go Box). A commercial hypothesis, like
   * partApiResiduelle, to be replaced by measurement.
   */
  partLocaleMinimum?: { valeur: number; source: string; note?: string };
}

export const OFFRES: OffreBox[] = offreJson.offres as OffreBox[];
export const FINANCEMENT = offreJson.financement;
export const COMMANDEUR: OffreBox = OFFRES.find((o) => o.role === 'commande')!;

/** No machine is advised for up to this many agents (max, 16/10/2026: like the light Desktop Commander, 1 or 2 agents). */
export const AGENTS_SANS_MACHINE_MAX = 2;
/** One 64 Go Box holds about ten agents, four or five at work at once (max, 16/10/2026). */
export const AGENTS_PAR_BOX = 10;

/**
 * What part of an agent's API bill remains on this offer: the customer's split when the
 * machine holds the agent, the offer's floor when it holds only the routine work, all of
 * it without a machine. Choosing « tout par API » keeps everything by API.
 */
function partApiSur(o: OffreBox, m: Machine | undefined, tient: boolean, repartition: Repartition): number {
  const choisie = REPARTITIONS[repartition].partApi;
  if (!m) return 1;
  if (tient) return choisie;
  const plancher = o.partLocaleMinimum?.valeur ?? 0;
  return Math.max(choisie, 1 - plancher);
}
const JOURS = 30;

export function offre(id: string): OffreBox {
  const o = OFFRES.find((x) => x.id === id);
  if (!o) throw new Error(`Installation inconnue : ${id}`);
  return o;
}

/** The machine agents run on for this offer, or nothing for an offer without power. */
export function machineDe(o: OffreBox): Machine | undefined {
  return o.machine ?? undefined;
}

/** Mensualité d'un prix financé sur `FINANCEMENT.mois`, au taux annuel du fichier (annuité constante). */
export function mensualite(prix: number, tauxAnnuel: number = FINANCEMENT.tauxAnnuel, mois: number = FINANCEMENT.mois): number {
  const n = mois, t = tauxAnnuel / 12;
  return t === 0 ? prix / n : (prix * t) / (1 - Math.pow(1 + t, -n));
}

const watts = (gamme: string) => (tarifs.electricite.wattsParGamme as Record<string, number>)[gamme] ?? 100;
const electriciteMensuelle = (w: number) => (w * 24 * JOURS / 1000) * tarifs.electricite.prixKwhEur;

/** One priced item of an installation. Prices are always shown apart (max, 25/09/2026): the
 * commander delivered with a power machine is its own line, never folded into the machine's price. */
export interface LigneInstallation { id: string; nom: string; prixAchat: number; mensualite: number; abonnement: number }

/**
 * What the installation costs, without any agent: one line per box (machine, then the commander
 * delivered with it), each with its price, its monthly payment and its subscription, which comes
 * ON TOP of the agents' own price (max, 25/09/2026). The totals are what the comparison with the
 * API uses; the shop shows the lines. `mensualiteAConfirmer` is the financing rate, not the prices.
 */
export function coutInstallation(o: OffreBox) {
  const boxes = o.prixAchat > 0 ? [o, ...(o.avecCommandeur ? [COMMANDEUR] : [])] : [];
  const lignes: LigneInstallation[] = boxes.map((b) => ({
    id: b.id, nom: b.nom, prixAchat: b.prixAchat, mensualite: mensualite(b.prixAchat), abonnement: b.abonnementMensuel ?? 0,
  }));
  const somme = (k: 'prixAchat' | 'mensualite' | 'abonnement') => lignes.reduce((t, l) => t + l[k], 0);
  const m = machineDe(o);
  const w = (m ? watts(m.gamme) : 0) + (o.role === 'commande' || o.avecCommandeur ? watts('poste') : 0);
  return {
    lignes,
    prixAchat: somme('prixAchat'),
    mensualite: somme('mensualite'),
    abonnement: somme('abonnement'),
    electricite: electriciteMensuelle(w),
    aConfirmer: boxes.some((b) => b.aConfirmer),
    mensualiteAConfirmer: boxes.length > 0 && FINANCEMENT.aConfirmer,
  };
}

const r = (x: number) => Math.round(x * 100) / 100;

export interface LigneDevis {
  offre: string; nom: string; aConfirmer: boolean;
  enLocal: boolean;
  /** Vrai si la machine ne tient pas l'agent entier mais fait chez vous son travail courant (partLocaleMinimum). */
  enPartie: boolean;
  /** Part de sa consommation qui ne passe plus par l'API sur cette installation. */
  partLocale: number;
  /** Ce que l'agent se paie en jetons chaque mois sur cette installation. */
  coutAgent: number;
  apiSeule: number;
  economie: number;
  /** Mensualité (durée du financement), abonnement des boxes et électricité de l'installation entière. */
  mensualite: number; abonnement: number; electricite: number;
  /** Vrai si l'économie de cet agent seul couvre la mensualité, l'abonnement et l'électricité. */
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
    const partApi = partApiSur(o, m, enLocal, repartition);
    const enPartie = !enLocal && partApi < 1;
    const coutAgent = apiSeule * partApi;
    const economie = apiSeule - coutAgent;
    const fixe = inst.mensualite + inst.abonnement + inst.electricite;
    const pct = (x: number) => `${Math.round(x * 100)} %`;
    const motif = !m
      ? "Tout par API."
      : enLocal ? `Tourne sur ${o.nom} ; ${pct(partApi)} reste par API.`
      : enPartie ? `${o.nom} fait chez vous son travail courant (${pct(1 - partApi)} au moins) ; le raisonnement le plus lourd part par API.`
      : `${o.nom} ne le tient pas : il reste par API.`;
    return {
      offre: o.id, nom: o.nom, aConfirmer: inst.aConfirmer, enLocal, enPartie, partLocale: r(1 - partApi),
      coutAgent: r(coutAgent), apiSeule: r(apiSeule), economie: r(economie),
      mensualite: r(inst.mensualite), abonnement: r(inst.abonnement), electricite: r(inst.electricite),
      rembourseSeul: fixe > 0 && economie >= fixe,
      motif,
    };
  });
}

export interface DevisPack {
  offre: string; nom: string; aConfirmer: boolean;
  /** Boxes the team needs on this installation (0 without a machine). */
  nombreBox: number;
  enLocal: string[]; enApi: string[];
  mensualite: number; abonnement: number; electricite: number; api: number;
  /** Total par mois pendant le financement, puis une fois la machine payée. */
  totalPendant: number; totalApres: number;
  /** Ce que coûterait la même équipe tout par API. */
  toutApi: number;
  /** Mois pour que les économies cumulées paient la machine achetée comptant (Infinity si jamais). */
  moisPourRembourser: number;
}

/** How many boxes of this offer a team of `n` agents needs: one per ten for the 64 Go Box, one otherwise. */
export function nombreDeBox(o: OffreBox, n: number): number {
  if (o.prixAchat === 0) return 0;
  return o.role === 'commande' ? Math.max(1, Math.ceil(n / AGENTS_PAR_BOX)) : 1;
}

/**
 * Ce que coûte une équipe sur une installation. Les agents se placent par économie
 * décroissante tant que la machine les tient (poids partagés entre agents du même
 * palier, comme partout ailleurs) ; les autres font chez vous la part minimale de
 * l'offre (partLocaleMinimum) et le reste par API. La Box 64 Go se compte une par
 * dizaine d'agents (max, 16/10/2026).
 */
export function devisPack(
  paquets: PaquetEco[],
  id: string,
  { intensite = INTENSITE_DEFAUT, repartition = REPARTITION_DEFAUT }: { intensite?: Intensite; repartition?: Repartition } = {}
): DevisPack {
  const o = offre(id);
  const inst = coutInstallation(o);
  const m = machineDe(o);
  const nBox = nombreDeBox(o, paquets.length);
  const partApi = REPARTITIONS[repartition].partApi;
  const couts = paquets.map((p) => ({ p, api: coutApiMensuel(p, undefined, intensite).total }))
    .sort((a, b) => b.api - a.api);
  const boxes: PaquetEco[][] = Array.from({ length: Math.max(1, nBox) }, () => []);
  let api = 0, toutApi = 0;
  const enLocal: string[] = [], enApi: string[] = [];
  for (const { p, api: c } of couts) {
    toutApi += c;
    const box = m ? boxes.find((b) => (o.role !== 'commande' || b.length < AGENTS_PAR_BOX) && tientSur(m, [...b, p])) : undefined;
    if (box) { box.push(p); enLocal.push(p.id); api += c * partApi; }
    else { enApi.push(p.id); api += c * partApiSur(o, m, false, repartition); }
  }
  const fois = Math.max(1, nBox);
  const mens = inst.mensualite * fois, abo = inst.abonnement * fois, elec = inst.electricite * fois;
  const economieMensuelle = toutApi - api - elec - abo;
  return {
    offre: o.id, nom: o.nom, aConfirmer: inst.aConfirmer, nombreBox: nBox, enLocal, enApi,
    mensualite: r(mens), abonnement: r(abo), electricite: r(elec), api: r(api),
    totalPendant: r(mens + abo + elec + api),
    totalApres: r(abo + elec + api),
    toutApi: r(toutApi),
    moisPourRembourser: inst.prixAchat === 0 ? 0 : economieMensuelle > 0 ? Math.ceil((inst.prixAchat * fois) / economieMensuelle) : Infinity,
  };
}

/**
 * L'installation à conseiller pour une équipe (max, 16/10/2026). Un ordinateur de bureau
 * ne fait pas travailler une équipe : « sans machine » ne se conseille que pour 1 ou 2
 * agents, comme le Desktop Commander light. Au-delà, la Box 64 Go, une par dizaine
 * d'agents. Avant le 16/10, le conseil prenait l'installation la moins chère sur le
 * papier ; la seule Box publiée n'ayant alors aucune puissance, elle ne coûtait que
 * son prix et « sans machine » gagnait pour toutes les équipes, 42 agents compris.
 */
export function conseillerBox(paquets: PaquetEco[], reglages: { intensite?: Intensite; repartition?: Repartition } = {}) {
  const devis = OFFRES.map((o) => devisPack(paquets, o.id, reglages));
  const id = paquets.length <= AGENTS_SANS_MACHINE_MAX ? 'aucune' : COMMANDEUR.id;
  const conseil = devis.find((d) => d.offre === id)!;
  return { conseil, devis };
}
