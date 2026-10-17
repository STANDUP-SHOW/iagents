// État voulu, état réel, connexion et cycle de vie des agents (ADMIN MASTER §4,
// §5.4, §8, P4 « Desired State »). Le cloud décrit ce qu'il attend d'une Box ; la
// Box remonte ce qu'elle a vraiment appliqué ; l'écart se calcule ici, une fois.
//
// The desired document is versioned: every change that alters its content bumps
// `version`, and a Box reports `version_appliquee`. A Box is converged when it
// applied the current version and reports no gap. The agents part is never
// written by hand: it is derived from entitlements and the agent lifecycle, so
// suspending an agent cannot forget the Box.

import { createHash } from 'node:crypto';
import type { Stockage } from '../stockage.ts';
import type { Box, Entitlement } from '../modele.ts';

// --- agent lifecycle (§5.4) ------------------------------------------------------

export const ETATS_AGENT = ['RECRUITMENT', 'CONFIGURATION', 'PROVISIONING', 'ACTIVE', 'PAUSED', 'PAYMENT_GRACE', 'RESTRICTED', 'SUSPENDED', 'TERMINATED', 'ARCHIVED'] as const;
export type EtatAgent = (typeof ETATS_AGENT)[number];

export const TRANSITIONS_AGENT: Record<EtatAgent, readonly EtatAgent[]> = {
  RECRUITMENT: ['CONFIGURATION', 'ARCHIVED'],
  CONFIGURATION: ['PROVISIONING', 'ARCHIVED'],
  PROVISIONING: ['ACTIVE', 'SUSPENDED'],
  ACTIVE: ['PAUSED', 'PAYMENT_GRACE', 'RESTRICTED', 'SUSPENDED', 'TERMINATED'],
  PAUSED: ['ACTIVE', 'SUSPENDED', 'TERMINATED'],
  PAYMENT_GRACE: ['ACTIVE', 'RESTRICTED', 'SUSPENDED'],
  RESTRICTED: ['ACTIVE', 'SUSPENDED'],
  SUSPENDED: ['ACTIVE', 'TERMINATED'],
  // Termination keeps the data under its retention policy: nothing is deleted here (anti-pattern §1.2).
  TERMINATED: ['ARCHIVED'],
  ARCHIVED: [],
};

/** The lifecycle record of one agent instance, keyed by its entitlement. */
export type CycleAgent = {
  id: string; // entitlement id
  tenant_id: string;
  device_id: string;
  etat: EtatAgent;
  depuis: string;
  historique: { quand: string; de: EtatAgent; vers: EtatAgent; motif: string; par: string; correlation_id: string }[];
};

const depuisEntitlement = (e: Entitlement): EtatAgent =>
  e.statut === 'active' ? 'ACTIVE' : e.statut === 'suspendue' ? 'SUSPENDED' : 'TERMINATED';

export function cycleDe(stockage: Stockage, e: Entitlement): CycleAgent {
  return stockage.lire<CycleAgent>('cycle_agents', e.id)
    ?? { id: e.id, tenant_id: e.tenant_id, device_id: e.device_id, etat: depuisEntitlement(e), depuis: e.debut, historique: [] };
}

/** The entitlement status that matches a lifecycle state: the Box's licence token follows it. */
const STATUT_DROIT: Partial<Record<EtatAgent, Entitlement['statut']>> = { ACTIVE: 'active', PAUSED: 'active', PAYMENT_GRACE: 'active', RESTRICTED: 'active', SUSPENDED: 'suspendue', TERMINATED: 'revoquee', ARCHIVED: 'revoquee' };

/** Moves one agent instance, keeps the entitlement in step, and refuses a move the lifecycle does not allow. */
export function changerEtatAgent(
  stockage: Stockage, e: Entitlement, vers: EtatAgent, motif: string, par: string, correlation_id: string, maintenant: Date,
): CycleAgent {
  const c = cycleDe(stockage, e);
  if (c.etat === vers) return c;
  if (!TRANSITIONS_AGENT[c.etat].includes(vers)) throw new Error(`Un agent ${c.etat} ne peut pas passer ${vers}.`);
  const quand = maintenant.toISOString();
  const suivant: CycleAgent = { ...c, etat: vers, depuis: quand, historique: [...c.historique, { quand, de: c.etat, vers, motif, par, correlation_id }] };
  stockage.poser('cycle_agents', e.id, suivant);
  const statut = STATUT_DROIT[vers];
  if (statut && statut !== e.statut) stockage.pourTenant(e.tenant_id).poser('entitlements', e.id, { ...e, statut });
  return suivant;
}

// --- desired / actual state (§8.1, §9.2) ---------------------------------------------

/** What an agent instance should be doing on the Box: RUN runs, HOLD keeps state and stops, STOP stops for good. */
export type ConsigneAgent = { agent_template_id: string; etat: EtatAgent; consigne: 'RUN' | 'HOLD' | 'STOP' };
export type ContenuEtat = { versions: Record<string, string>; agents: Record<string, ConsigneAgent>; politiques: Record<string, string | number | boolean> };

export type EtatVoulu = {
  device_id: string;
  tenant_id: string | null;
  version: number;
  empreinte: string;
  voulu: ContenuEtat;
  mis_a_jour_le: string;
  par: string;
  correlation_id: string;
};
export type EtatReel = { device_id: string; tenant_id: string | null; version_appliquee: number; reel: ContenuEtat; recu_le: string };

const CONSIGNE: Record<EtatAgent, ConsigneAgent['consigne']> = {
  RECRUITMENT: 'HOLD', CONFIGURATION: 'HOLD', PROVISIONING: 'HOLD', ACTIVE: 'RUN', PAUSED: 'HOLD', PAYMENT_GRACE: 'RUN', RESTRICTED: 'RUN',
  SUSPENDED: 'HOLD', TERMINATED: 'STOP', ARCHIVED: 'STOP',
};

/** Stable JSON (sorted keys) so the same content always hashes the same. */
export function jsonStable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(jsonStable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${jsonStable((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
const empreinte = (c: ContenuEtat) => createHash('sha256').update(jsonStable(c)).digest('hex');

function agentsVoulus(stockage: Stockage, box: Box): Record<string, ConsigneAgent> {
  if (!box.tenant_id) return {};
  const agents: Record<string, ConsigneAgent> = {};
  for (const e of stockage.pourTenant(box.tenant_id).lister<Entitlement>('entitlements', (x) => x.device_id === box.device_id)) {
    const c = cycleDe(stockage, e);
    if (c.etat === 'ARCHIVED') continue;
    agents[e.id] = { agent_template_id: e.agent_template_id, etat: c.etat, consigne: CONSIGNE[c.etat] };
  }
  return agents;
}

export function etatVouluDe(stockage: Stockage, deviceId: string): EtatVoulu | null {
  return stockage.lire<EtatVoulu>('etats_voulus', deviceId);
}

/**
 * Recomputes the desired document of a Box: stored versions and policies (patched
 * if asked), agents derived from entitlements. Bumps the version only when the
 * content changed, so a no-op never makes a Box reconcile for nothing.
 */
export function recalculerEtatVoulu(
  stockage: Stockage, box: Box, maintenant: Date, par: string, correlation_id: string,
  patch: { versions?: Record<string, string>; politiques?: Record<string, string | number | boolean> } = {},
): { etat: EtatVoulu; change: boolean } {
  const avant = etatVouluDe(stockage, box.device_id);
  const voulu: ContenuEtat = {
    versions: patch.versions ?? avant?.voulu.versions ?? {},
    politiques: patch.politiques ?? avant?.voulu.politiques ?? {},
    agents: agentsVoulus(stockage, box),
  };
  const e = empreinte(voulu);
  if (avant && avant.empreinte === e && avant.tenant_id === box.tenant_id) return { etat: avant, change: false };
  const etat: EtatVoulu = {
    device_id: box.device_id, tenant_id: box.tenant_id, version: (avant?.version ?? 0) + 1, empreinte: e, voulu,
    mis_a_jour_le: maintenant.toISOString(), par, correlation_id,
  };
  stockage.poser('etats_voulus', box.device_id, etat);
  return { etat, change: true };
}

export type Ecart = { domaine: 'versions' | 'agents' | 'politiques'; cle: string; voulu: unknown; reel: unknown };

/** Every difference between what the cloud wants and what the Box says it runs. */
export function ecarts(voulu: ContenuEtat, reel: ContenuEtat | null): Ecart[] {
  const sortie: Ecart[] = [];
  const r: ContenuEtat = reel ?? { versions: {}, agents: {}, politiques: {} };
  for (const k of new Set([...Object.keys(voulu.versions), ...Object.keys(r.versions)])) {
    if (voulu.versions[k] !== undefined && voulu.versions[k] !== r.versions[k]) sortie.push({ domaine: 'versions', cle: k, voulu: voulu.versions[k], reel: r.versions[k] ?? null });
  }
  for (const k of new Set([...Object.keys(voulu.agents), ...Object.keys(r.agents)])) {
    // An agent absent on either side counts as stopped: a terminated agent the Box never ran is not a gap.
    const v = voulu.agents[k]?.consigne ?? 'STOP';
    const a = r.agents[k]?.consigne ?? 'STOP';
    if (v !== a) sortie.push({ domaine: 'agents', cle: k, voulu: v, reel: a });
  }
  for (const k of Object.keys(voulu.politiques)) {
    if (voulu.politiques[k] !== r.politiques[k]) sortie.push({ domaine: 'politiques', cle: k, voulu: voulu.politiques[k], reel: r.politiques[k] ?? null });
  }
  return sortie;
}

export function convergence(stockage: Stockage, deviceId: string): { version_voulue: number | null; version_appliquee: number | null; ecarts: Ecart[]; convergee: boolean } {
  const v = etatVouluDe(stockage, deviceId);
  const r = stockage.lire<EtatReel>('etats_reels', deviceId);
  if (!v) return { version_voulue: null, version_appliquee: r?.version_appliquee ?? null, ecarts: [], convergee: !!r };
  const e = ecarts(v.voulu, r?.reel ?? null);
  return { version_voulue: v.version, version_appliquee: r?.version_appliquee ?? null, ecarts: e, convergee: !!r && r.version_appliquee === v.version && e.length === 0 };
}

// --- connection (§9.1) ------------------------------------------------------------

/** Heartbeat period the Box is told to keep, and how many missed ones make it offline (computed here, never by the Box). */
export const PERIODE_BATTEMENT_S = 60;
export const BATTEMENTS_MANQUES_HORS_LIGNE = 3;

export type Battement = { device_id: string; tenant_id: string | null; vu_le: string; uptime_s: number; sequence: number };
export type Connexion = 'jamais_vue' | 'en_ligne' | 'degradee' | 'hors_ligne';

/** Last sign of life: a heartbeat or the older telemetry route, whichever is newer. */
export function dernierSigne(box: Box, b: Battement | null): number | null {
  const t = [b?.vu_le, box.sante?.vu_le].filter((x): x is string => !!x).map(Date.parse).filter(Number.isFinite);
  return t.length ? Math.max(...t) : null;
}

export function connexionDe(box: Box, b: Battement | null, maintenant: Date): Connexion {
  const vu = dernierSigne(box, b);
  if (vu === null) return 'jamais_vue';
  if (maintenant.getTime() - vu > PERIODE_BATTEMENT_S * BATTEMENTS_MANQUES_HORS_LIGNE * 1000) return 'hors_ligne';
  const s = box.sante;
  if (s && ((s.temperature ?? 0) >= 90 || (s.disque ?? 0) >= 95 || (s.memoire ?? 0) >= 97)) return 'degradee';
  return 'en_ligne';
}

/** A health score out of 100, for the fleet list: connection first, then the measures the Box sends. */
export function scoreSante(box: Box, c: Connexion): number | null {
  if (c === 'jamais_vue') return null;
  if (c === 'hors_ligne') return 0;
  const s = box.sante ?? { vu_le: '' };
  let score = 100;
  if ((s.temperature ?? 0) >= 80) score -= 25;
  if ((s.disque ?? 0) >= 85) score -= 25;
  if ((s.memoire ?? 0) >= 90) score -= 15;
  if ((s.cpu ?? 0) >= 95) score -= 10;
  return Math.max(c === 'degradee' ? 1 : 0, Math.min(score, c === 'degradee' ? 60 : 100));
}
