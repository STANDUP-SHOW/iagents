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
export interface Materiel { ram: number; vram: number; cpuCoeurs: number; disque: number; chargeContinue: number }
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
  return {
    ram: Math.max(...ps.map((p) => p.ram)) + SYSTEME.ram,
    vram: Math.ceil(ps.reduce((s, p) => s + p.vram + (p.vram > 0 ? MEMOIRE_TRAVAIL_PAR_PALIER : 0), 0)),
    cpuCoeurs: SYSTEME.cpuCoeurs + (surCpu ? 4 : 0),
    disque: ps.reduce((s, p) => s + p.disque, 0) + SYSTEME.disque,
    chargeContinue: Math.min(1, Math.round(charge * 100) / 100),
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
  let vram = 0;
  for (const id of distincts) { const p = PALIERS[id]; vram += p.vram + (p.vram > 0 ? MEMOIRE_TRAVAIL_PAR_PALIER : 0); disque += p.disque; }
  return { vram, charge, ram: ram + agents.length, disque: disque + SYSTEME.disque, cpuCoeurs: SYSTEME.cpuCoeurs };
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
