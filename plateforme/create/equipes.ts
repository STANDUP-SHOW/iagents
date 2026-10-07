// Which catalogue agents work each of the five phases (MASTER §9). The rule is
// deterministic and lives in `equipes-phases.json`: the phase's core roles, then
// the optional roles whose need the étude declared, in the FILE's order (never
// the engine's), each agent once. The engine never names an agent; it returns
// need labels from a closed list, and the metier shown comes from the catalogue.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

const DOSSIER_AGENTS = new URL('../../agents/', import.meta.url);
const profils = new Map(catalogueJson.profils.map((p) => [p.id, p]));
const duCatalogue = new Map(catalogueJson.agents.map((a) => [a.id, a]));
const fichiers = new Map<string, string>();
for (const f of readdirSync(DOSSIER_AGENTS)) {
  const m = /^(AG-\d{4})-.+\.json$/.exec(f);
  if (m) fichiers.set(m[1], f);
}

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
export function ficheDe(agentId: string): Record<string, unknown> {
  const f = fichiers.get(agentId);
  if (!f) throw new Error(`L'agent ${agentId} n'existe pas dans agents/.`);
  return JSON.parse(readFileSync(new URL(f, DOSSIER_AGENTS), 'utf8'));
}

/** Every reason the phase file cannot be used. Empty = usable. */
export function fautesDesPhases(phases: Phase[] = PHASES): string[] {
  const fautes: string[] = [];
  const numeros = phases.map((p) => p.numero).join(',');
  if (numeros !== '01,02,03,04,05') fautes.push(`les phases doivent être 01 à 05 dans l'ordre, trouvé ${numeros}`);
  for (const p of phases) {
    for (const r of [...p.socle, ...p.options]) {
      if (!duCatalogue.has(r.agent)) fautes.push(`phase ${p.numero} : ${r.agent} absent de catalogue/catalogue.json`);
      if (!fichiers.has(r.agent) || !existsSync(new URL(fichiers.get(r.agent)!, DOSSIER_AGENTS))) {
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

const FAUTES_AU_CHARGEMENT = fautesDesPhases();
if (FAUTES_AU_CHARGEMENT.length) {
  throw new Error(`iAgent Create ne démarre pas : equipes-phases.json est faux (${FAUTES_AU_CHARGEMENT.join(' ; ')}).`);
}

/** The team of one phase for the given needs. Same needs, in any order, give the same team. */
export function equipePour(phase: Phase, besoins: readonly string[]): MembreEquipe[] {
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
