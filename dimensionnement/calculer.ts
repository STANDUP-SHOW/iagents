/**
 * Sizing engine: agent packages -> hardware, packs -> machines, machine -> agents.
 *
 * Everything here derives from two data files (paliers-modeles.json and
 * machines.json) and from the `modeles` block of each agent package. Nothing
 * is hard-coded per agent: change the tier table and every figure follows.
 *
 * The rule that changes everything: agents that use the same model tier SHARE
 * the weights (one copy in memory) but not the compute load. VRAM is counted
 * once per distinct tier on a machine; load is summed per agent.
 */
import paliersJson from './paliers-modeles.json' with { type: 'json' };
import machinesJson from './machines.json' with { type: 'json' };

export type PalierId = keyof typeof paliersJson.paliers;
export interface Palier { ram: number; vram: number; disque: number; chargeUnitaire: number; exemples: string[]; usage: string }
export interface Modeles { texte: PalierId; vision?: PalierId; image?: PalierId; video?: PalierId; audio?: PalierId; musique?: PalierId; embeddings?: PalierId; activite: number }
export interface ClasseGpu { classe: string; libelle: string; capacite: number; vram: number }
export interface Materiel { ram: number; vram: number; cpuCoeurs: number; disque: number; chargeContinue: number; gpu: { classe: string; libelle: string } }

/**
 * GPU classes a customer can buy, from the integrated GPU of a mini-PC to a
 * creation workstation. `capacite` is relative to the reference card (RTX 4070
 * = 1.0), `vram` the memory available to models. The integrated class uses the
 * machine RAM, so its vram is an upper bound reached with 64 Go of RAM.
 */
export const CLASSES_GPU: ClasseGpu[] = [
  { classe: 'integre',        libelle: 'GPU intégré récent (classe Radeon 780M / Apple M), mémoire partagée avec la RAM', capacite: 0.20, vram: 58 },
  { classe: 'dediee-entree',  libelle: 'carte graphique dédiée d entrée de gamme, 8 Go (classe RTX 4060)',              capacite: 0.50, vram: 8 },
  { classe: 'dediee-milieu',  libelle: 'carte graphique dédiée milieu de gamme, 12 Go (classe RTX 4070)',               capacite: 1.00, vram: 12 },
  { classe: 'dediee-16',      libelle: 'carte graphique dédiée 16 Go (classe RTX 4070 Ti Super / 4080)',                capacite: 1.30, vram: 16 },
  { classe: 'dediee-haut',    libelle: 'carte graphique dédiée haut de gamme, 24 Go (classe RTX 4090)',                 capacite: 2.00, vram: 24 },
  { classe: 'serveur',        libelle: 'plusieurs cartes ou serveur GPU (au-delà de 24 Go ou de la charge d une RTX 4090)', capacite: 99, vram: 999 },
];

/** Tiers kept loaded at all times (they answer the voice and the mail) vs tiers loaded on demand, one at a time. */
const PALIERS_RESIDENTS = new Set<string>(['texte-leger', 'texte-standard', 'texte-avance', 'texte-expert', 'audio-parole', 'embeddings']);

/** Model memory for a set of distinct tiers: resident tiers add up, on-demand tiers count once for the largest. */
function memoireModeles(paliers: PalierId[]): number {
  let residents = 0, aLaDemande = 0;
  for (const id of paliers) {
    const p = PALIERS[id];
    const m = p.vram + (p.vram > 0 ? MEMOIRE_TRAVAIL_PAR_PALIER : 0);
    if (PALIERS_RESIDENTS.has(id)) residents += m; else aLaDemande = Math.max(aLaDemande, m);
  }
  return Math.ceil(residents + aLaDemande);
}

/** Smallest GPU class that carries a given continuous load and model memory. */
export function classeGpuPour(chargeContinue: number, vram: number): ClasseGpu {
  return CLASSES_GPU.find((c) => c.capacite >= chargeContinue && c.vram >= vram) ?? CLASSES_GPU[CLASSES_GPU.length - 1];
}
export interface Machine { id: string; nom: string; ram: number; vram: number; memoireUnifiee: boolean; cpuCoeurs: number; disque: number; capaciteGpu: number; prixIndicatif: number; note?: string; modele?: string; cpu?: string; gpu?: string }
export interface AgentDimension { id: string; modeles: Modeles }

const PALIERS = paliersJson.paliers as Record<PalierId, Palier>;
const SYSTEME = paliersJson.systeme;
export const MACHINES: Machine[] = machinesJson.machines as Machine[];

/** Working memory (KV cache, activations) per LOADED TIER, in GB, on top of the weights. Agents queue on one loaded model, so it is counted per tier, not per agent. */
export const MEMOIRE_TRAVAIL_PAR_PALIER = 0.5;

export function paliersDe(modeles: Modeles): PalierId[] {
  const { activite: _a, ...caps } = modeles;
  return [...new Set(Object.values(caps).filter((p): p is PalierId => typeof p === 'string'))];
}

/** Hardware one agent needs on a machine of its own, 24/7. */
export function materielPour(modeles: Modeles): Materiel {
  const ps = paliersDe(modeles).map((id) => {
    const p = PALIERS[id];
    if (!p) throw new Error(`Palier inconnu : ${id}`);
    return p;
  });
  const surCpu = ps.some((p) => p.vram === 0 && p.chargeUnitaire >= 0.1);
  const charge = ps.reduce((s, p) => s + p.chargeUnitaire, 0) * modeles.activite;
  const chargeContinue = Math.min(1, Math.round(charge * 100) / 100);
  const vram = memoireModeles(paliersDe(modeles));
  const gpu = classeGpuPour(chargeContinue, vram);
  return {
    ram: Math.max(...ps.map((p) => p.ram)) + SYSTEME.ram,
    vram,
    cpuCoeurs: SYSTEME.cpuCoeurs + (surCpu ? 4 : 0),
    disque: ps.reduce((s, p) => s + p.disque, 0) + SYSTEME.disque,
    chargeContinue,
    gpu: { classe: gpu.classe, libelle: gpu.libelle },
  };
}

interface Occupation { machine: Machine; agents: AgentDimension[] }

function besoinsGroupe(agents: AgentDimension[]) {
  const distincts = new Set<PalierId>();
  let charge = 0, ram = 0, disque = 0;
  for (const a of agents) {
    for (const id of paliersDe(a.modeles)) distincts.add(id);
    charge += materielPour(a.modeles).chargeContinue;
    ram = Math.max(ram, materielPour(a.modeles).ram);
  }
  for (const id of distincts) disque += PALIERS[id].disque;
  return { vram: memoireModeles([...distincts]), charge, ram: ram + agents.length, disque: disque + SYSTEME.disque, cpuCoeurs: SYSTEME.cpuCoeurs };
}

export function tientSur(machine: Machine, agents: AgentDimension[]): boolean {
  const b = besoinsGroupe(agents);
  // Unified memory (iGPU): `vram` is already the RAM left for models, so the separate RAM check would double-count the weights.
  const ramOk = machine.memoireUnifiee ? true : b.ram <= machine.ram;
  return b.vram <= machine.vram && b.charge <= machine.capaciteGpu && ramOk && b.disque <= machine.disque && b.cpuCoeurs <= machine.cpuCoeurs;
}

/**
 * Pack -> machines. First-fit decreasing on load: heaviest agents first, each
 * placed on the first open machine that still holds it, else on a new machine:
 * the cheapest per copy while agents remain, the cheapest outright for the last
 * one. Agents no machine can hold alone are reported, never silently dropped.
 */
export function machinesPourPack(agents: AgentDimension[], catalogue: Machine[] = MACHINES) {
  const tri = [...agents].sort((a, b) => materielPour(b.modeles).chargeContinue - materielPour(a.modeles).chargeContinue);
  const parPrix = [...catalogue].sort((a, b) => a.prixIndicatif - b.prixIndicatif);
  const ouvertes: Occupation[] = [];
  const impossibles: string[] = [];
  tri.forEach((agent, index) => {
    const place = ouvertes.find((o) => tientSur(o.machine, [...o.agents, agent]));
    if (place) { place.agents.push(agent); return; }
    const candidates = parPrix.filter((m) => tientSur(m, [agent]));
    if (!candidates.length) { impossibles.push(agent.id); return; }
    // Last agent to place: cheapest machine. Otherwise: cheapest per copy of this agent, so a pack
    // of similar agents lands on the machine that holds the most of them per euro.
    const restants = tri.length - index - 1;
    const neuve = restants === 0 ? candidates[0]
      : candidates.reduce((best, m) => (m.prixIndicatif / agentsParMachine(m, agent) < best.prixIndicatif / agentsParMachine(best, agent) ? m : best));
    ouvertes.push({ machine: neuve, agents: [agent] });
  });
  return {
    machines: ouvertes.map((o) => ({ machine: o.machine, agents: o.agents.map((a) => a.id), besoins: besoinsGroupe(o.agents) })),
    prixTotal: ouvertes.reduce((s, o) => s + o.machine.prixIndicatif, 0),
    impossibles,
  };
}

/** Machine -> how many copies of a given agent it runs 24/7 (the reverse question). */
export function agentsParMachine(machine: Machine, agent: AgentDimension): number {
  let n = 0;
  while (n < 200 && tientSur(machine, Array.from({ length: n + 1 }, (_, i) => ({ ...agent, id: `${agent.id}#${i}` })))) n++;
  return n;
}

/**
 * Estimated calls per day, derived from task scheduling. Feeds the API-mode
 * cost warning in the desktop app. Triggered and on-demand tasks get a flat
 * allowance; the app replaces the estimate with the measured figure after a week.
 */
export interface TachePlanifiee { planification: { type: 'quotidienne' | 'intervalle' | 'declencheur' | 'a-la-demande'; minutes?: number }; active: boolean }
export const APPELS_DECLENCHEUR_PAR_JOUR = 20;
export const APPELS_A_LA_DEMANDE_PAR_JOUR = 5;
export function appelsParJour(taches: TachePlanifiee[]): number {
  let total = 0;
  for (const t of taches) {
    if (!t.active) continue;
    const p = t.planification;
    if (p.type === 'quotidienne') total += 1;
    else if (p.type === 'intervalle') total += Math.ceil(1440 / (p.minutes ?? 1440));
    else if (p.type === 'declencheur') total += APPELS_DECLENCHEUR_PAR_JOUR;
    else total += APPELS_A_LA_DEMANDE_PAR_JOUR;
  }
  return Math.max(1, total);
}

/** Load gauge for the desktop app: how full a machine is with a set of agents running locally. */
export type Jauge = 'confortable' | 'chargee' | 'saturee' | 'impossible';
export function jaugeMachine(machine: Machine, agents: AgentDimension[]): { jauge: Jauge; charge: number; vram: number; message: string } {
  const b = besoinsGroupe(agents);
  const charge = Math.round((b.charge / machine.capaciteGpu) * 100) / 100;
  if (b.vram > machine.vram || (!machine.memoireUnifiee && b.ram > machine.ram)) return { jauge: 'impossible', charge, vram: b.vram, message: `Mémoire insuffisante : ${b.vram} Go demandés pour les modèles, ${machine.vram} disponibles. Passez un agent en mode API ou retirez-en un.` };
  if (charge > 1) return { jauge: 'saturee', charge, vram: b.vram, message: `Charge ${Math.round(charge * 100)} % : les tâches prendront du retard. Passez les agents les plus lourds en mode API.` };
  if (charge > 0.8) return { jauge: 'chargee', charge, vram: b.vram, message: `Charge ${Math.round(charge * 100)} % : encore de la place pour un agent léger, pas pour un agent image ou vidéo.` };
  return { jauge: 'confortable', charge, vram: b.vram, message: `Charge ${Math.round(charge * 100)} % : la machine tient ce pack 24h/24.` };
}

/**
 * Why an agent does or does not run locally on a machine catalogue, resource
 * by resource, and the configuration it would need. Written for the product
 * page and the desktop app: a customer must never read "impossible" without
 * the reason and the machine that would do.
 */
export interface DiagnosticLocal { possible: boolean; machine?: Machine; raisons: string[]; configurationNecessaire: string }
export function diagnosticLocal(agent: AgentDimension, catalogue: Machine[] = MACHINES): DiagnosticLocal {
  const m = materielPour(agent.modeles);
  const configurationNecessaire = `${m.gpu.libelle} ; ${m.vram} Go de mémoire pour les modèles ; ${m.ram} Go de RAM ; ${m.disque} Go de disque ; charge continue ${Math.round(m.chargeContinue * 100)} % d une carte de référence`;
  const place = machinesPourPack([agent], catalogue);
  if (!place.impossibles.length) return { possible: true, machine: place.machines[0].machine, raisons: [], configurationNecessaire };
  const raisons: string[] = [];
  const b = besoinsGroupe([agent]);
  const maxVram = Math.max(...catalogue.map((c) => c.vram));
  const maxCap = Math.max(...catalogue.map((c) => c.capaciteGpu));
  const maxDisque = Math.max(...catalogue.map((c) => c.disque));
  if (b.vram > maxVram) raisons.push(`mémoire des modèles : ${b.vram} Go nécessaires, ${maxVram} Go disponibles au mieux sur ces machines`);
  if (b.charge > maxCap) raisons.push(`puissance : charge continue ${Math.round(b.charge * 100)} % d une carte de référence, ${Math.round(maxCap * 100)} % au mieux sur ces machines (GPU intégré) — il faut ${m.gpu.libelle}`);
  if (b.disque > maxDisque) raisons.push(`disque : ${b.disque} Go nécessaires, ${maxDisque} Go au mieux`);
  if (!raisons.length) raisons.push('aucune machine ne réunit à la fois la mémoire et la puissance nécessaires');
  return { possible: false, raisons, configurationNecessaire };
}
