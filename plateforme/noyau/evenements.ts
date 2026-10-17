// Le bus d'événements du noyau (ADMIN MASTER §11, Control Plane MASTER §12) et le
// centre des opérations qu'il alimente (§7). Un événement est écrit avant d'être
// distribué ; chaque consommateur le traite au plus une fois (idempotence par
// consommateur), et un traitement qui échoue part en lettres mortes, rejouées avec
// un délai qui double.
//
// Delivery is at-least-once by design: today the bus is the platform's own store
// (an outbox), the same on Node and on Cloudflare. Moving to NATS later is a new
// transport behind `publier`, not a change of the events or of their consumers.

import { randomUUID } from 'node:crypto';
import type { Stockage } from '../stockage.ts';

/** Every event type the core knows (§11). An unknown type is refused at publication, not discovered by a consumer. */
export const TYPES_EVENEMENT = [
  'device.offline', 'device.back_online', 'device.disk_critical', 'device.update_failed', 'device.desired_changed', 'device.converged',
  'device.command_queued', 'device.command_succeeded', 'device.command_failed', 'device.command_expired',
  'agent.state_changed', 'agent.provisioning_failed',
  'action.executed', 'action.denied', 'action.approval_requested', 'approval.decided',
  'security.policy_denied', 'actor.created', 'actor.suspended',
  'billing.credit_recorded', 'billing.refund_recorded', 'sales.discount_recorded', 'support.rma_created',
  'incident.opened', 'incident.changed',
  'connector.auth_expiring', 'payment.failed', 'subscription.cancel_requested', 'lead.created', 'ticket.created', 'call.received',
  'skill.candidate_created', 'skill.revoked',
] as const;
export type TypeEvenement = (typeof TYPES_EVENEMENT)[number];

export type Evenement = {
  id: string;
  /** Global order, for cursor pagination and replay. */
  seq: number;
  type: TypeEvenement;
  /** Schema version of `donnees` for this type. */
  version: 1;
  quand: string;
  tenant_id: string | null;
  correlation_id: string;
  source: string;
  donnees: Record<string, unknown>;
};

type Consommateur = { nom: string; traiter: (stockage: Stockage, e: Evenement, maintenant: Date) => void };
const CONSOMMATEURS: Partial<Record<TypeEvenement, Consommateur[]>> = {};

export function abonner(type: TypeEvenement, c: Consommateur): void {
  (CONSOMMATEURS[type] ??= []).push(c);
}

function prochainSeq(stockage: Stockage): number {
  const c = stockage.lire<{ valeur: number }>('compteurs', 'evenements') ?? { valeur: 0 };
  stockage.poser('compteurs', 'evenements', { valeur: c.valeur + 1 });
  return c.valeur + 1;
}

type Trace = { id: string; quand: string };
type LettreMorte = { id: string; consommateur: string; evenement_id: string; essais: number; derniere_erreur: string; prochain_essai: string };

function livrer(stockage: Stockage, c: Consommateur, e: Evenement, maintenant: Date): boolean {
  const cle = `${c.nom}:${e.id}`;
  if (stockage.lire<Trace>('evenements_traites', cle)) return true;
  try {
    c.traiter(stockage, e, maintenant);
    stockage.poser('evenements_traites', cle, { id: cle, quand: maintenant.toISOString() });
    stockage.retirer('evenements_lettres_mortes', cle);
    return true;
  } catch (err) {
    const avant = stockage.lire<LettreMorte>('evenements_lettres_mortes', cle);
    const essais = (avant?.essais ?? 0) + 1;
    stockage.poser('evenements_lettres_mortes', cle, {
      id: cle, consommateur: c.nom, evenement_id: e.id, essais, derniere_erreur: err instanceof Error ? err.message.slice(0, 300) : 'erreur',
      prochain_essai: new Date(maintenant.getTime() + Math.min(2 ** essais, 1440) * 60_000).toISOString(),
    });
    return false;
  }
}

/** Writes the event, then hands it to every consumer of its type. Returns the stored event. */
export function publier(
  stockage: Stockage, maintenant: Date,
  d: { type: TypeEvenement; tenant_id: string | null; correlation_id: string; source: string; donnees: Record<string, unknown> },
): Evenement {
  if (!(TYPES_EVENEMENT as readonly string[]).includes(d.type)) throw new Error(`Type d'événement inconnu : ${d.type}.`);
  const e: Evenement = { id: randomUUID(), seq: prochainSeq(stockage), version: 1, quand: maintenant.toISOString(), ...d };
  stockage.poser('evenements', e.id, e);
  for (const c of CONSOMMATEURS[d.type] ?? []) livrer(stockage, c, e, maintenant);
  return e;
}

/** Retries dead letters whose delay has passed. Returns how many went through. */
export function rejouerLettresMortes(stockage: Stockage, maintenant: Date): number {
  let passes = 0;
  for (const l of stockage.lister<LettreMorte>('evenements_lettres_mortes', (x) => Date.parse(x.prochain_essai) <= maintenant.getTime())) {
    const e = stockage.lire<Evenement>('evenements', l.evenement_id);
    const c = e ? (CONSOMMATEURS[e.type] ?? []).find((x) => x.nom === l.consommateur) : null;
    if (!e || !c) { stockage.retirer('evenements_lettres_mortes', l.id); continue; }
    if (livrer(stockage, c, e, maintenant)) passes++;
  }
  return passes;
}

/** Events after a cursor, oldest first. */
export function lireEvenements(stockage: Stockage, apres: number, limite: number, filtre?: { type?: string; tenant_id?: string; correlation_id?: string }): Evenement[] {
  return stockage.lister<Evenement>('evenements', (e) =>
    e.seq > apres && (!filtre?.type || e.type === filtre.type) && (!filtre?.tenant_id || e.tenant_id === filtre.tenant_id)
    && (!filtre?.correlation_id || e.correlation_id === filtre.correlation_id))
    .sort((a, b) => a.seq - b.seq).slice(0, limite);
}

// --- Operations Center: incidents (§7) ---------------------------------------------

export const ETATS_INCIDENT = ['DETECTED', 'TRIAGED', 'INVESTIGATING', 'MITIGATING', 'MONITORING', 'RESOLVED', 'POSTMORTEM'] as const;
export type EtatIncident = (typeof ETATS_INCIDENT)[number];
export const TRANSITIONS_INCIDENT: Record<EtatIncident, readonly EtatIncident[]> = {
  // A fault that clears by itself (a Box back online) goes straight to watch.
  DETECTED: ['TRIAGED', 'INVESTIGATING', 'MONITORING', 'RESOLVED'],
  TRIAGED: ['INVESTIGATING', 'MITIGATING', 'MONITORING', 'RESOLVED'],
  INVESTIGATING: ['MITIGATING', 'MONITORING', 'RESOLVED'],
  MITIGATING: ['MONITORING', 'RESOLVED'],
  MONITORING: ['RESOLVED', 'INVESTIGATING'],
  RESOLVED: ['POSTMORTEM', 'INVESTIGATING'],
  POSTMORTEM: [],
};
export type Incident = {
  id: string;
  domaine: 'fleet' | 'providers' | 'business' | 'support' | 'security' | 'factory';
  severite: 'mineure' | 'majeure' | 'critique';
  etat: EtatIncident;
  titre: string;
  ressource: string;
  tenant_id: string | null;
  responsable: string | null;
  ouvert_le: string;
  correlation_id: string;
  historique: { quand: string; etat: EtatIncident; par: string; note: string }[];
};

const ouvertSur = (stockage: Stockage, ressource: string, domaine: Incident['domaine']) =>
  stockage.lister<Incident>('incidents', (i) => i.ressource === ressource && i.domaine === domaine && i.etat !== 'RESOLVED' && i.etat !== 'POSTMORTEM')[0] ?? null;

export function ouvrirIncident(
  stockage: Stockage, maintenant: Date,
  d: Pick<Incident, 'domaine' | 'severite' | 'titre' | 'ressource' | 'tenant_id' | 'correlation_id'>, par: string,
): Incident {
  const deja = ouvertSur(stockage, d.ressource, d.domaine);
  if (deja) return deja;
  const quand = maintenant.toISOString();
  const i: Incident = { id: `INC-${randomUUID().slice(0, 8).toUpperCase()}`, etat: 'DETECTED', responsable: null, ouvert_le: quand, historique: [{ quand, etat: 'DETECTED', par, note: d.titre }], ...d };
  stockage.poser('incidents', i.id, i);
  publier(stockage, maintenant, { type: 'incident.opened', tenant_id: i.tenant_id, correlation_id: i.correlation_id, source: par, donnees: { incident_id: i.id, domaine: i.domaine, severite: i.severite } });
  return i;
}

export function changerIncident(stockage: Stockage, maintenant: Date, id: string, etat: EtatIncident, par: string, note: string, responsable?: string | null): Incident {
  const i = stockage.lire<Incident>('incidents', id);
  if (!i) throw new Error("Cet incident n'existe pas.");
  if (i.etat !== etat && !TRANSITIONS_INCIDENT[i.etat].includes(etat)) throw new Error(`Un incident ${i.etat} ne passe pas ${etat}.`);
  const suivant: Incident = {
    ...i, etat, responsable: responsable === undefined ? i.responsable : responsable,
    historique: [...i.historique, { quand: maintenant.toISOString(), etat, par, note }],
  };
  stockage.poser('incidents', id, suivant);
  publier(stockage, maintenant, { type: 'incident.changed', tenant_id: i.tenant_id, correlation_id: i.correlation_id, source: par, donnees: { incident_id: id, etat } });
  return suivant;
}

// Workflows wired today (§11): event → condition → owner → action.
abonner('device.offline', {
  nom: 'operations.incident-hors-ligne',
  traiter: (s, e, m) => {
    ouvrirIncident(s, m, {
      domaine: 'fleet', severite: 'majeure', titre: `Box ${String(e.donnees.device_id)} hors ligne`, ressource: String(e.donnees.device_id),
      tenant_id: e.tenant_id, correlation_id: e.correlation_id,
    }, 'workflow:device.offline');
  },
});
abonner('device.back_online', {
  nom: 'operations.incident-retour',
  traiter: (s, e, m) => {
    const i = ouvertSur(s, String(e.donnees.device_id), 'fleet');
    if (i && TRANSITIONS_INCIDENT[i.etat].includes('MONITORING')) changerIncident(s, m, i.id, 'MONITORING', 'workflow:device.back_online', 'La Box donne de nouveau signe de vie.');
  },
});
abonner('device.command_failed', {
  nom: 'operations.incident-commande',
  traiter: (s, e, m) => {
    if (e.donnees.type !== 'update' && e.donnees.type !== 'rollback') return;
    ouvrirIncident(s, m, {
      domaine: 'fleet', severite: 'majeure', titre: `Mise à jour échouée sur ${String(e.donnees.device_id)}`, ressource: `${String(e.donnees.device_id)}#maj`,
      tenant_id: e.tenant_id, correlation_id: e.correlation_id,
    }, 'workflow:device.command_failed');
  },
});
