// Which catalogue agents work each of the five phases (MASTER §9). The rule is
// deterministic and lives in `equipes-phases.json`: the phase's core roles, then
// the optional roles whose need the étude declared, in the FILE's order (never
// the engine's), each agent once. The engine never names an agent; it returns
// need labels from a closed list, and the metier shown comes from the catalogue.

import { depot, lireFiche } from '../depot.ts';
import type { MembreEquipe, NumeroPhase } from '../modele.ts';
import phasesJson from './equipes-phases.json' with { type: 'json' };
import catalogueJson from '../../catalogue/catalogue.json' with { type: 'json' };

type Role = { agent: string; role: string; pourquoi: string };
type Phase = {
  numero: NumeroPhase;
  nom: string;
  objectif: string;
  socle: Role[];
  options: (Role & { besoin: string })[];
  jalons: string[];
  responsabilites_humaines: string[];
};

export const PHASES = phasesJson.phases as Phase[];
export const BESOINS = Object.keys(phasesJson.besoins) as readonly string[];
export const DESCRIPTION_BESOINS = phasesJson.besoins as Record<string, string>;

const profils = new Map(catalogueJson.profils.map((p) => [p.id, p]));
const duCatalogue = new Map(catalogueJson.agents.map((a) => [a.id, a]));

/**
 * Licence tier of a catalogue agent, from its commercial profile (§5: Essential for
 * structured back-office work, Expert for regulated finance/legal work, Professional
 * otherwise). Assumption of this module, to confirm with max: nothing else in the
 * repository maps a profile to a licence yet.
 */
export function licencePour(agentId: string): MembreEquipe['licence'] {
  const a = duCatalogue.get(agentId);
  const p = a ? profils.get(a.profil) : undefined;
  if (!p) throw new Error(`L'agent ${agentId} n'a pas de profil commercial au catalogue.`);
  if (p.risqueReglementaire === 'Élevée') return 'expert';
  if (p.autonomie === 'Back-office automatisé') return 'essential';
  return 'professional';
}

/** The package of an agent, as written in agents/. */
export async function ficheDe(agentId: string): Promise<Record<string, unknown>> {
  return (await lireFiche(agentId)).fiche;
}

/** Every reason the phase file cannot be used. Empty = usable. */
export function fautesDesPhases(phases: Phase[] = PHASES): string[] {
  const fautes: string[] = [];
  const numeros = phases.map((p) => p.numero).join(',');
  if (numeros !== '01,02,03,04,05') fautes.push(`les phases doivent être 01 à 05 dans l'ordre, trouvé ${numeros}`);
  for (const p of phases) {
    for (const r of [...p.socle, ...p.options]) {
      if (!duCatalogue.has(r.agent)) fautes.push(`phase ${p.numero} : ${r.agent} absent de catalogue/catalogue.json`);
      if (!depot().fiches().has(r.agent)) {
        fautes.push(`phase ${p.numero} : ${r.agent} n'a pas de fiche dans agents/`);
      }
    }
    for (const o of p.options) if (!BESOINS.includes(o.besoin)) fautes.push(`phase ${p.numero} : besoin inconnu « ${o.besoin} »`);
    if (!p.socle.length) fautes.push(`phase ${p.numero} : aucun poste de socle`);
    if (!p.jalons.length || !p.responsabilites_humaines.length) fautes.push(`phase ${p.numero} : jalons ou responsabilités humaines manquants`);
  }
  for (let i = 1; i < phases.length; i++) {
    const a = phases[i - 1].socle.map((r) => r.agent).sort().join();
    const b = phases[i].socle.map((r) => r.agent).sort().join();
    if (a === b) fautes.push(`les phases ${phases[i - 1].numero} et ${phases[i].numero} ont la même équipe : l'équipe doit changer par phase`);
  }
  return fautes;
}

let phasesVerifiees = false;
/**
 * Refuses a wrong phase file. Called by each door at start-up (the platform does
 * not start with it) and before the first team; not at module load, because the
 * sheets are only known once the door has set its depot (Cloudflare has no disk).
 */
export function verifierPhases(): void {
  if (phasesVerifiees) return;
  const fautes = fautesDesPhases();
  if (fautes.length) throw new Error(`iAgent Create ne démarre pas : equipes-phases.json est faux (${fautes.join(' ; ')}).`);
  phasesVerifiees = true;
}

/** The team of one phase for the given needs. Same needs, in any order, give the same team. */
export function equipePour(phase: Phase, besoins: readonly string[]): MembreEquipe[] {
  verifierPhases();
  const voulus = new Set(besoins);
  const vus = new Set<string>();
  const equipe: MembreEquipe[] = [];
  for (const r of [...phase.socle, ...phase.options.filter((o) => voulus.has(o.besoin))]) {
    if (vus.has(r.agent)) continue;
    vus.add(r.agent);
    equipe.push({
      agent_id: r.agent,
      metier: duCatalogue.get(r.agent)!.metier,
      role: r.role,
      pourquoi: r.pourquoi,
      licence: licencePour(r.agent),
    });
  }
  return equipe;
}

export function agentsParPhase(besoins: readonly string[]): { phase: NumeroPhase; agents: MembreEquipe[] }[] {
  return PHASES.map((p) => ({ phase: p.numero, agents: equipePour(p, besoins) }));
}

export type { Phase };
