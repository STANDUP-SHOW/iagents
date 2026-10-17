// Le registre des permissions et des rôles du noyau iAgent (ADMIN MASTER §3,
// annexe 24.1). C'est le SEUL endroit où une permission se déclare : les trois
// consoles, les agents internes et la passerelle d'actions lisent celui-ci. Une
// permission écrite dans un écran sans exister ici n'autorise rien.
//
// RBAC here, ABAC in politique.ts: a role grants permissions inside a scope
// (GLOBAL, REGION, TENANT, SITE, DEVICE, AGENT_INSTANCE, DEPARTMENT); the policy
// engine then weighs risk, amounts, autonomy and approvals.

export const PERMISSIONS = [
  // Fleet (technical console)
  'fleet.device.read',
  'fleet.device.command.restart',
  'fleet.device.command.shutdown',
  'fleet.device.diagnostic.run',
  'fleet.device.update',
  'fleet.device.desired.update',
  'fleet.device.reset.factory',
  'fleet.device.remote.screen',
  'fleet.device.shell',
  'fleet.release.create',
  'fleet.rollout.create',
  'fleet.support.open',
  // Platform (business console)
  'platform.customer.read',
  'platform.customer.update',
  'platform.agent.read',
  'platform.agent.create',
  'platform.agent.pause',
  'platform.agent.suspend',
  'platform.agent.terminate',
  'platform.pricing.update',
  // Money
  'billing.credit.create',
  'billing.refund.create',
  // Connectors and skills
  'connector.connection.manage',
  'skill.publish',
  'skill.revoke',
  // Support, sales, marketing, voice
  'support.ticket.update',
  'support.rma.create',
  'sales.quote.create',
  'sales.discount.apply',
  'marketing.content.publish',
  'voice.call.outbound',
  'voice.number.manage',
  // Security and the core itself
  'security.certificate.rotate',
  'security.audit.read',
  'core.actor.manage',
  'core.approval.decide',
  'core.event.read',
  'core.incident.manage',
  'core.sweep.run',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const SCOPES = ['GLOBAL', 'REGION', 'TENANT', 'SITE', 'DEVICE', 'AGENT_INSTANCE', 'DEPARTMENT'] as const;
export type TypeScope = (typeof SCOPES)[number];
/** A scope: GLOBAL carries no id, every other scope names what it covers. */
export type Scope = { type: TypeScope; id: string | null };

/** What a request touches, as far as scopes go. Missing parts are simply not matched. */
export type Ressource = { tenant_id?: string | null; device_id?: string | null; region?: string | null; site_id?: string | null; agent_instance_id?: string | null; departement?: string | null };

const FLEET_LECTURE: Permission[] = ['fleet.device.read', 'core.event.read'];

/**
 * Roles shipped with the core. A role is a bag of permissions; it becomes a
 * right only once bound to an actor in a scope (`actor_roles`).
 */
export const ROLES: Record<string, { libelle: string; permissions: readonly Permission[] }> = {
  FONDATEUR: { libelle: 'Fondateur (super-admin)', permissions: PERMISSIONS },
  FLEET_ADMIN: {
    libelle: 'Administrateur de flotte',
    permissions: [...FLEET_LECTURE, 'fleet.device.command.restart', 'fleet.device.command.shutdown', 'fleet.device.diagnostic.run', 'fleet.device.update',
      'fleet.device.desired.update', 'fleet.device.reset.factory', 'fleet.device.remote.screen', 'fleet.release.create', 'fleet.rollout.create', 'fleet.support.open',
      'core.approval.decide', 'core.incident.manage', 'platform.customer.read'],
  },
  FLEET_L1: { libelle: 'Technicien flotte niveau 1', permissions: [...FLEET_LECTURE, 'fleet.device.command.restart', 'fleet.device.diagnostic.run', 'core.incident.manage'] },
  SECURITE: {
    libelle: 'Sécurité',
    permissions: [...FLEET_LECTURE, 'security.certificate.rotate', 'security.audit.read', 'fleet.device.shell', 'fleet.device.remote.screen', 'core.approval.decide', 'core.incident.manage'],
  },
  PLATEFORME_OPS: {
    libelle: 'Opérations plateforme',
    permissions: ['platform.customer.read', 'platform.customer.update', 'platform.agent.read', 'platform.agent.create', 'platform.agent.pause', 'platform.agent.suspend',
      'platform.agent.terminate', 'connector.connection.manage', 'skill.publish', 'skill.revoke', 'core.approval.decide', 'fleet.device.read'],
  },
  FINANCE: { libelle: 'Finance', permissions: ['platform.customer.read', 'billing.credit.create', 'billing.refund.create', 'platform.pricing.update', 'core.approval.decide'] },
  VENTES: { libelle: 'Ventes', permissions: ['platform.customer.read', 'sales.quote.create', 'sales.discount.apply', 'voice.call.outbound'] },
  SUPPORT_L1: {
    libelle: 'Support niveau 1',
    permissions: ['platform.customer.read', 'platform.agent.read', 'fleet.device.read', 'fleet.device.diagnostic.run', 'fleet.device.command.restart', 'support.ticket.update',
      'billing.credit.create', 'support.rma.create'],
  },
  SUPPORT_L2: {
    libelle: 'Support niveau 2',
    permissions: ['platform.customer.read', 'platform.agent.read', 'fleet.device.read', 'fleet.device.diagnostic.run', 'fleet.device.command.restart', 'fleet.device.update',
      'support.ticket.update', 'billing.credit.create', 'support.rma.create', 'fleet.support.open', 'platform.agent.pause', 'core.approval.decide'],
  },
  MARKETING: { libelle: 'Marketing', permissions: ['marketing.content.publish', 'platform.customer.read'] },
  AUDITEUR: { libelle: 'Auditeur', permissions: ['security.audit.read', 'fleet.device.read', 'platform.customer.read', 'platform.agent.read', 'core.event.read'] },
  SERVICE_BALAYAGE: { libelle: 'Service : balayage de la flotte', permissions: ['core.sweep.run', 'fleet.device.read'] },
};

export const estPermission = (p: unknown): p is Permission => typeof p === 'string' && (PERMISSIONS as readonly string[]).includes(p);
export const estScope = (t: unknown): t is TypeScope => typeof t === 'string' && (SCOPES as readonly string[]).includes(t);

/** Does this scope cover that resource? GLOBAL covers everything; other scopes need their id on the resource. */
export function scopeCouvre(scope: Scope, r: Ressource): boolean {
  switch (scope.type) {
    case 'GLOBAL': return true;
    case 'TENANT': return !!r.tenant_id && r.tenant_id === scope.id;
    case 'DEVICE': return !!r.device_id && r.device_id === scope.id;
    case 'REGION': return !!r.region && r.region === scope.id;
    case 'SITE': return !!r.site_id && r.site_id === scope.id;
    case 'AGENT_INSTANCE': return !!r.agent_instance_id && r.agent_instance_id === scope.id;
    case 'DEPARTMENT': return !!r.departement && r.departement === scope.id;
  }
}

export type LienRole = { role: string; scope: Scope };

/** RBAC alone: does one of these role bindings grant `permission` on `ressource`? An unknown role grants nothing. */
export function aLaPermission(liens: readonly LienRole[], permission: Permission, ressource: Ressource = {}): boolean {
  return liens.some((l) => (ROLES[l.role]?.permissions.includes(permission) ?? false) && scopeCouvre(l.scope, ressource));
}

/** Same question without a resource: granted somewhere (any scope). Used to open a route before the handler narrows it. */
export function aLaPermissionQuelquePart(liens: readonly LienRole[], permission: Permission): boolean {
  return liens.some((l) => ROLES[l.role]?.permissions.includes(permission) ?? false);
}
