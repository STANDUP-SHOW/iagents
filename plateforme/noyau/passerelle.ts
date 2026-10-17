// La passerelle d'actions (Action Gateway, ADMIN MASTER §10) et la boîte des
// approbations (§10.1). Toute action à effet réel — d'un agent interne, d'un
// service ou d'un humain dans une console — entre ici : lecture des paramètres,
// périmètre, décision du moteur de règles, exécution ou mise en attente, audit et
// événement. Le catalogue ci-dessous est la liste complète de ce qui s'exécute :
// une action absente n'existe pas, et chaque action présente a son exécuteur.
//
// Money actions record a decision; they move no money. No payment provider is
// wired to them yet, so their result says so (`versement: "non_effectue"`), in
// line with the repo rule against code that reports what it did not do.

import { randomUUID } from 'node:crypto';
import type { Stockage } from '../stockage.ts';
import type { Box, Entitlement, MiseAJour, Tenant } from '../modele.ts';
import { auditer } from '../controle/audit.ts';
import { comparerVersions, estSemver } from '../controle/regles.ts';
import { ACTEUR_FONDATEUR, type Acteur, type Appelant } from './acteurs.ts';
import { aLaPermission, type Permission, type Ressource } from './permissions.ts';
import { decider, type Decision, type ProfilAction, type Risque } from './politique.ts';
import { enfiler, verifierService, type Commande, type TypeCommande } from './commandes.ts';
import { changerEtatAgent, recalculerEtatVoulu, type EtatAgent } from './etat.ts';
import { publier } from './evenements.ts';

// --- parameter readers ---------------------------------------------------------------

type P = Record<string, unknown>;
function texte(p: P, champ: string, max = 300): string {
  const v = p[champ];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Le paramètre « ${champ} » est obligatoire.`);
  if (v.length > max) throw new Error(`Le paramètre « ${champ} » est trop long.`);
  return v.trim();
}
function montant(p: P, champ: string, min: number, max: number): number {
  const v = p[champ];
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new Error(`Le paramètre « ${champ} » doit être un nombre entre ${min} et ${max}.`);
  return Math.round(v * 100) / 100;
}
function cartes(p: P, champ: string): Record<string, string | number | boolean> | undefined {
  const v = p[champ];
  if (v === undefined) return undefined;
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`Le paramètre « ${champ} » doit être un objet.`);
  for (const [k, x] of Object.entries(v)) {
    if (!/^[a-z][a-z0-9_.-]{0,40}$/.test(k)) throw new Error(`« ${champ}.${k} » : nom en minuscules, chiffres, point, tiret.`);
    if (!['string', 'number', 'boolean'].includes(typeof x)) throw new Error(`« ${champ}.${k} » doit être un texte, un nombre ou vrai/faux.`);
  }
  return v as Record<string, string | number | boolean>;
}

// --- the catalogue ---------------------------------------------------------------------

type Cible = { box?: Box; droit?: Entitlement; tenant?: Tenant };
type CtxExec = { stockage: Stockage; maintenant: Date; appelant: Appelant; action: Action; cible: Cible };
type DefAction = ProfilAction & {
  libelle: string;
  /** Validated parameters; throws in plain French. */
  lire: (p: P) => P;
  /** Which object the action touches; resolved before the policy so scopes apply to the real tenant and device. */
  cible: 'box' | 'droit' | 'tenant';
  /** Describes the blast radius on the approval card (§10.1: impact and scope shown). */
  impact: (p: P, c: Cible) => string;
  executer: (ctx: CtxExec) => Record<string, unknown>;
};

const fixe = (r: Risque) => () => r;
const idBox = (p: P) => ({ device_id: texte(p, 'device_id', 80) });
const idDroit = (p: P) => ({ entitlement_id: texte(p, 'entitlement_id', 80), motif: texte(p, 'motif', 500) });

function commande(type: TypeCommande, parametres: (p: P) => Commande['parametres'] = () => ({})) {
  return ({ stockage, maintenant, appelant, action, cible }: CtxExec) => {
    const c = enfiler(stockage, maintenant, { box: cible.box!, type, parametres: parametres(action.parametres), action_id: action.id, demandeur: appelant.acteur.id, correlation_id: action.correlation_id });
    publier(stockage, maintenant, { type: 'device.command_queued', tenant_id: c.tenant_id, correlation_id: c.correlation_id, source: appelant.acteur.id, donnees: { commande_id: c.id, device_id: c.device_id, type } });
    return { commande_id: c.id, statut: c.statut, expire_le: c.expire_le, note: 'Commande en file : la Box la relève à sa prochaine connexion et rend son résultat.' };
  };
}

function cycle(vers: EtatAgent) {
  return ({ stockage, maintenant, appelant, action, cible }: CtxExec) => {
    const c = changerEtatAgent(stockage, cible.droit!, vers, String(action.parametres.motif ?? ''), appelant.acteur.id, action.correlation_id, maintenant);
    publier(stockage, maintenant, { type: 'agent.state_changed', tenant_id: c.tenant_id, correlation_id: action.correlation_id, source: appelant.acteur.id, donnees: { entitlement_id: c.id, etat: c.etat } });
    const box = stockage.lire<Box>('boxes', c.device_id);
    const v = box ? recalculerEtatVoulu(stockage, box, maintenant, appelant.acteur.id, action.correlation_id) : null;
    if (v?.change) publier(stockage, maintenant, { type: 'device.desired_changed', tenant_id: c.tenant_id, correlation_id: action.correlation_id, source: appelant.acteur.id, donnees: { device_id: c.device_id, version: v.etat.version } });
    return { entitlement_id: c.id, etat: c.etat, etat_voulu_version: v?.etat.version ?? null };
  };
}

function miseAJourPubliee(stockage: Stockage, composant: string, version: string): MiseAJour {
  const m = stockage.lister<MiseAJour>('mises_a_jour', (u) => u.composant === composant && u.version === version)[0];
  if (!m) throw new Error(`Aucune version ${version} signée n'est publiée pour ${composant} : une Box ne reçoit qu'un paquet signé.`);
  return m;
}
const lireVersion = (p: P) => {
  const composant = texte(p, 'composant', 20);
  if (!['desktop', 'os', 'skills', 'device'].includes(composant)) throw new Error('« composant » : desktop, os, skills ou device.');
  const version = texte(p, 'version', 64);
  if (!estSemver(version)) throw new Error('« version » doit être une version semver.');
  return { ...idBox(p), composant, version };
};
function poserVersion(ctx: CtxExec, type: 'update' | 'rollback') {
  const { stockage, maintenant, appelant, action, cible } = ctx;
  const { composant, version } = action.parametres as { composant: string; version: string };
  const m = miseAJourPubliee(stockage, composant, version);
  if (type === 'rollback') {
    const actuelle = cible.box!.versions?.[composant] ?? (composant === 'desktop' ? cible.box!.version_desktop : null);
    if (actuelle && comparerVersions(version, actuelle) >= 0) throw new Error(`Un retour arrière vise une version plus ancienne que ${actuelle}.`);
  }
  const voulu = recalculerEtatVoulu(stockage, cible.box!, maintenant, appelant.acteur.id, action.correlation_id, {
    versions: { ...(stockage.lire<{ voulu: { versions: Record<string, string> } }>('etats_voulus', cible.box!.device_id)?.voulu.versions ?? {}), [composant]: version },
  });
  if (voulu.change) publier(stockage, maintenant, { type: 'device.desired_changed', tenant_id: cible.box!.tenant_id, correlation_id: action.correlation_id, source: appelant.acteur.id, donnees: { device_id: cible.box!.device_id, version: voulu.etat.version } });
  return { ...commande(type, () => ({ composant, version, url: m.url, empreinte: m.empreinte, signature: m.signature }))(ctx), etat_voulu_version: voulu.etat.version };
}

function enregistrer(collection: string, evenement: 'billing.credit_recorded' | 'billing.refund_recorded' | 'sales.discount_recorded' | 'support.rma_created') {
  return ({ stockage, maintenant, appelant, action, cible }: CtxExec) => {
    const id = `${collection.toUpperCase().slice(0, 3)}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const tenant_id = cible.tenant?.tenant_id ?? cible.box?.tenant_id ?? null;
    const enregistrement = {
      id, tenant_id, ...action.parametres, action_id: action.id, enregistre_par: appelant.acteur.id, enregistre_le: maintenant.toISOString(),
      ...(collection === 'rma' ? { statut: 'RMA_REQUESTED' } : { versement: 'non_effectue' }),
    };
    stockage.poser(collection, id, enregistrement);
    publier(stockage, maintenant, { type: evenement, tenant_id, correlation_id: action.correlation_id, source: appelant.acteur.id, donnees: { id } });
    return collection === 'rma'
      ? { id, statut: 'RMA_REQUESTED' }
      : { id, versement: 'non_effectue', note: "Décision enregistrée. Aucun paiement n'est relié : rien n'a été versé ni prélevé." };
  };
}

export const CATALOGUE: Record<string, DefAction> = {
  'fleet.service.restart': {
    verbe: 'fleet.service.restart', libelle: 'Redémarrer un service de la Box', permission: 'fleet.device.command.restart', risque: fixe('R1'), cible: 'box',
    lire: (p) => ({ ...idBox(p), service: verifierService(texte(p, 'service', 60)) }),
    impact: (p) => `Redémarre ${String(p.service)} sur ${String(p.device_id)} ; les agents de ce service s'interrompent quelques secondes.`,
    executer: commande('restart_service', (p) => ({ service: String(p.service) })),
  },
  'fleet.device.diagnostic': {
    verbe: 'fleet.device.diagnostic', libelle: 'Lancer un diagnostic', permission: 'fleet.device.diagnostic.run', risque: fixe('R1'), cible: 'box',
    lire: idBox, impact: (p) => `Collecte un diagnostic caviardé de ${String(p.device_id)} ; rien ne change sur la Box.`, executer: commande('diagnostic'),
  },
  'fleet.device.restart': {
    verbe: 'fleet.device.restart', libelle: 'Redémarrer la Box', permission: 'fleet.device.command.restart', risque: fixe('R3'), cible: 'box',
    lire: idBox, impact: (p) => `Redémarre ${String(p.device_id)} : tous ses agents s'arrêtent pendant le redémarrage.`, executer: commande('restart_box'),
  },
  'fleet.device.shutdown': {
    verbe: 'fleet.device.shutdown', libelle: 'Éteindre la Box', permission: 'fleet.device.command.shutdown', risque: fixe('R3'), cible: 'box',
    lire: (p) => ({ ...idBox(p), motif: texte(p, 'motif', 500) }), impact: (p) => `Éteint ${String(p.device_id)} : elle ne repart qu'avec quelqu'un sur place.`, executer: commande('shutdown'),
  },
  'fleet.device.update': {
    verbe: 'fleet.device.update', libelle: 'Mettre à jour un composant', permission: 'fleet.device.update', risque: fixe('R2'), cible: 'box',
    lire: lireVersion, impact: (p) => `Pose ${String(p.composant)} ${String(p.version)} (paquet signé) sur ${String(p.device_id)}.`, executer: (ctx) => poserVersion(ctx, 'update'),
  },
  'fleet.device.rollback': {
    verbe: 'fleet.device.rollback', libelle: 'Revenir à une version connue', permission: 'fleet.device.update', risque: fixe('R2'), cible: 'box',
    lire: lireVersion, impact: (p) => `Ramène ${String(p.composant)} à ${String(p.version)} sur ${String(p.device_id)}.`, executer: (ctx) => poserVersion(ctx, 'rollback'),
  },
  'fleet.device.desired.update': {
    verbe: 'fleet.device.desired.update', libelle: "Changer l'état voulu", permission: 'fleet.device.desired.update', risque: fixe('R2'), cible: 'box',
    lire: (p) => {
      const versions = cartes(p, 'versions');
      const politiques = cartes(p, 'politiques');
      if (!versions && !politiques) throw new Error('Donnez « versions » ou « politiques ».');
      if (versions) for (const [k, v] of Object.entries(versions)) if (typeof v !== 'string' || !estSemver(v)) throw new Error(`« versions.${k} » doit être une version semver.`);
      return { ...idBox(p), ...(versions ? { versions } : {}), ...(politiques ? { politiques } : {}) };
    },
    impact: (p) => `Change ce que ${String(p.device_id)} doit faire tourner ; la Box s'aligne à sa prochaine réconciliation.`,
    executer: ({ stockage, maintenant, appelant, action, cible }) => {
      const p = action.parametres as { versions?: Record<string, string>; politiques?: Record<string, string | number | boolean> };
      const v = recalculerEtatVoulu(stockage, cible.box!, maintenant, appelant.acteur.id, action.correlation_id, p);
      if (v.change) publier(stockage, maintenant, { type: 'device.desired_changed', tenant_id: cible.box!.tenant_id, correlation_id: action.correlation_id, source: appelant.acteur.id, donnees: { device_id: cible.box!.device_id, version: v.etat.version } });
      return { version: v.etat.version, change: v.change };
    },
  },
  'fleet.device.certificate.rotate': {
    verbe: 'fleet.device.certificate.rotate', libelle: "Renouveler l'identité de la Box", permission: 'security.certificate.rotate', risque: fixe('R3'), cible: 'box',
    lire: idBox, impact: (p) => `${String(p.device_id)} génère une nouvelle clé ; l'ancienne cesse d'être reconnue une fois la nouvelle enregistrée.`, executer: commande('rotate_certificate'),
  },
  'fleet.device.reset.factory': {
    verbe: 'fleet.device.reset.factory', libelle: "Remettre la Box en sortie d'usine", permission: 'fleet.device.reset.factory', risque: fixe('R4'), cible: 'box',
    lire: (p) => ({ ...idBox(p), motif: texte(p, 'motif', 500) }),
    impact: (p) => `Efface ${String(p.device_id)} et la ramène à l'état d'usine : agents, comptes et fichiers locaux du client partent (la sauvegarde chiffrée reste).`,
    executer: commande('factory_reset'),
  },
  'fleet.device.remote.screen': {
    verbe: 'fleet.device.remote.screen', libelle: "Voir l'écran à distance", permission: 'fleet.device.remote.screen', risque: fixe('R3'), cible: 'box',
    lire: (p) => ({ ...idBox(p), duree_min: montant(p, 'duree_min', 1, 60), motif: texte(p, 'motif', 500) }),
    impact: (p) => `Ouvre la vue de l'écran de ${String(p.device_id)} pendant ${String(p.duree_min)} min, tracée.`, executer: commande('remote_screen', (p) => ({ duree_min: Number(p.duree_min) })),
  },
  'fleet.device.shell': {
    verbe: 'fleet.device.shell', libelle: 'Ouvrir un terminal contrôlé', permission: 'fleet.device.shell', risque: fixe('R4'), cible: 'box',
    lire: (p) => ({ ...idBox(p), duree_min: montant(p, 'duree_min', 1, 30), motif: texte(p, 'motif', 500) }),
    impact: (p) => `Accès terminal temporaire à ${String(p.device_id)} pendant ${String(p.duree_min)} min, chaque commande tracée.`,
    executer: commande('controlled_shell', (p) => ({ duree_min: Number(p.duree_min) })),
  },
  'platform.agent.pause': {
    verbe: 'platform.agent.pause', libelle: "Mettre l'agent en pause", permission: 'platform.agent.pause', risque: fixe('R2'), cible: 'droit',
    lire: idDroit, impact: () => "L'agent s'arrête et garde tout ; il reprend où il en était.", executer: cycle('PAUSED'),
  },
  'platform.agent.resume': {
    verbe: 'platform.agent.resume', libelle: "Relancer l'agent", permission: 'platform.agent.pause', risque: fixe('R2'), cible: 'droit',
    lire: idDroit, impact: () => "L'agent reprend son travail.", executer: cycle('ACTIVE'),
  },
  'platform.agent.suspend': {
    verbe: 'platform.agent.suspend', libelle: "Suspendre l'agent", permission: 'platform.agent.suspend', risque: fixe('R3'), cible: 'droit',
    lire: idDroit, impact: () => "Le droit d'exécuter l'agent est suspendu ; la Box l'arrête, ses données restent.", executer: cycle('SUSPENDED'),
  },
  'platform.agent.terminate': {
    verbe: 'platform.agent.terminate', libelle: "Mettre fin au contrat de l'agent", permission: 'platform.agent.terminate', risque: fixe('R3'), cible: 'droit',
    lire: idDroit, impact: () => "Le droit est révoqué et l'agent s'arrête ; ses données suivent la politique de conservation, rien n'est effacé tout de suite.", executer: cycle('TERMINATED'),
  },
  'platform.tenant.agents.suspend': {
    verbe: 'platform.tenant.agents.suspend', libelle: "Suspendre tous les agents d'un client", permission: 'platform.agent.suspend', risque: fixe('R4'), cible: 'tenant',
    lire: (p) => ({ tenant_id: texte(p, 'tenant_id', 80), motif: texte(p, 'motif', 500) }),
    impact: (_p, c) => `Suspend tous les agents actifs de ${c.tenant?.nom ?? 'ce client'}.`,
    executer: (ctx) => {
      const { stockage, cible } = ctx;
      const droits = stockage.pourTenant(cible.tenant!.tenant_id).lister<Entitlement>('entitlements', (e) => e.statut === 'active');
      const faits = droits.map((d) => cycle('SUSPENDED')({ ...ctx, cible: { droit: d } }));
      return { suspendus: faits.length };
    },
  },
  'billing.credit.create': {
    verbe: 'billing.credit.create', libelle: 'Accorder un avoir', permission: 'billing.credit.create', risque: fixe('R2'), cible: 'tenant',
    plafond: { budget: 'credit_max_eur', valeur: (p) => Number(p.montant_eur) },
    lire: (p) => ({ tenant_id: texte(p, 'tenant_id', 80), montant_eur: montant(p, 'montant_eur', 0.01, 1_000_000), motif: texte(p, 'motif', 500) }),
    impact: (p, c) => `Avoir de ${String(p.montant_eur)} € à ${c.tenant?.nom ?? 'ce client'}.`, executer: enregistrer('avoirs', 'billing.credit_recorded'),
  },
  'billing.refund.create': {
    verbe: 'billing.refund.create', libelle: 'Rembourser', permission: 'billing.refund.create', cible: 'tenant',
    risque: (p) => (Number(p.montant_eur) >= 10_000 ? 'R4' : Number(p.montant_eur) > 100 ? 'R3' : 'R2'),
    plafond: { budget: 'remboursement_max_eur', valeur: (p) => Number(p.montant_eur) },
    lire: (p) => ({ tenant_id: texte(p, 'tenant_id', 80), montant_eur: montant(p, 'montant_eur', 0.01, 10_000_000), motif: texte(p, 'motif', 500) }),
    impact: (p, c) => `Remboursement de ${String(p.montant_eur)} € à ${c.tenant?.nom ?? 'ce client'}.`, executer: enregistrer('remboursements', 'billing.refund_recorded'),
  },
  'sales.discount.apply': {
    verbe: 'sales.discount.apply', libelle: 'Accorder une remise', permission: 'sales.discount.apply', risque: fixe('R2'), cible: 'tenant',
    plafond: { budget: 'remise_max_pct', valeur: (p) => Number(p.pourcentage) },
    lire: (p) => ({ tenant_id: texte(p, 'tenant_id', 80), pourcentage: montant(p, 'pourcentage', 0.1, 100), motif: texte(p, 'motif', 500) }),
    impact: (p, c) => `Remise de ${String(p.pourcentage)} % à ${c.tenant?.nom ?? 'ce client'}.`, executer: enregistrer('remises', 'sales.discount_recorded'),
  },
  'support.rma.create': {
    verbe: 'support.rma.create', libelle: 'Ouvrir un retour matériel (RMA)', permission: 'support.rma.create', risque: fixe('R2'), cible: 'box',
    lire: (p) => ({ ...idBox(p), motif: texte(p, 'motif', 500) }), impact: (p) => `Ouvre un retour pour ${String(p.device_id)} ; la Box de remplacement aura sa propre identité.`,
    executer: enregistrer('rma', 'support.rma_created'),
  },
};

// --- actions and approvals ----------------------------------------------------------------

export type StatutAction = 'executee' | 'refusee' | 'en_attente' | 'echouee' | 'expiree';
export type Action = {
  id: string;
  verbe: string;
  acteur_id: string;
  acteur_type: Appelant['acteur']['type'];
  parametres: P;
  ressource: Ressource;
  motif: string;
  decision: Decision;
  statut: StatutAction;
  idempotence: string;
  correlation_id: string;
  cree_le: string;
  approbation_id: string | null;
  resultat: Record<string, unknown> | null;
  erreur: string | null;
};

export type DecisionApprobateur = { par: string; nom: string; decision: 'approuve' | 'refuse' | 'clarification'; note: string; quand: string };
export type Approbation = {
  id: string;
  action_id: string;
  verbe: string;
  libelle: string;
  demandeur: string;
  demandeur_type: Appelant['acteur']['type'];
  tenant_id: string | null;
  risque: Risque;
  requises: 1 | 2;
  impact: string;
  motif: string;
  statut: 'en_attente' | 'approuvee' | 'refusee' | 'expiree';
  decisions: DecisionApprobateur[];
  cree_le: string;
  expire_le: string;
};

export const DUREE_APPROBATION_MS = 24 * 3600_000;

function resoudre(stockage: Stockage, def: DefAction, p: P): { cible: Cible; ressource: Ressource } {
  if (def.cible === 'box') {
    const box = stockage.lire<Box>('boxes', String(p.device_id));
    if (!box) throw new Error("Cette Box n'existe pas.");
    return { cible: { box }, ressource: { device_id: box.device_id, tenant_id: box.tenant_id } };
  }
  if (def.cible === 'droit') {
    const droit = stockage.lister<Entitlement>('entitlements', (e) => e.id === String(p.entitlement_id))[0];
    if (!droit) throw new Error("Cet agent (droit d'exécution) n'existe pas.");
    return { cible: { droit }, ressource: { tenant_id: droit.tenant_id, device_id: droit.device_id, agent_instance_id: droit.id } };
  }
  const tenant = stockage.lire<Tenant>('tenants', String(p.tenant_id));
  if (!tenant) throw new Error("Ce client n'existe pas.");
  return { cible: { tenant }, ressource: { tenant_id: tenant.tenant_id, region: tenant.pays } };
}

function tracer(stockage: Stockage, maintenant: Date, a: Action, appelant: Appelant, resultat: 'SUCCESS' | 'FAILURE' | 'PENDING' | 'DENIED', detail: string) {
  auditer(stockage, maintenant, {
    tenant_id: a.ressource.tenant_id ?? null, acteur: appelant.acteur.id + (appelant.secours ? ' (clé de secours)' : ''), acteur_type: appelant.acteur.type, action: a.verbe,
    cible: String(a.ressource.device_id ?? a.ressource.agent_instance_id ?? a.ressource.tenant_id ?? ''), detail: detail.slice(0, 500),
    politique: a.decision.verdict, risque: a.decision.risque, approbation: a.approbation_id, resultat, correlation_id: a.correlation_id,
  });
}

function executer(stockage: Stockage, maintenant: Date, a: Action, appelant: Appelant, cible: Cible): Action {
  const def = CATALOGUE[a.verbe];
  try {
    const resultat = def.executer({ stockage, maintenant, appelant, action: a, cible });
    const fait = stockage.poser('actions', a.id, { ...a, statut: 'executee' as const, resultat });
    tracer(stockage, maintenant, fait, appelant, 'SUCCESS', a.motif);
    publier(stockage, maintenant, { type: 'action.executed', tenant_id: a.ressource.tenant_id ?? null, correlation_id: a.correlation_id, source: appelant.acteur.id, donnees: { action_id: a.id, verbe: a.verbe } });
    return fait;
  } catch (e) {
    const erreur = e instanceof Error ? e.message : 'Exécution refusée.';
    const rate = stockage.poser('actions', a.id, { ...a, statut: 'echouee' as const, erreur });
    tracer(stockage, maintenant, rate, appelant, 'FAILURE', erreur);
    return rate;
  }
}

/**
 * The one entry for every action (§10). Same idempotency key from the same actor
 * returns the first outcome without doing anything twice.
 */
export function soumettre(
  stockage: Stockage, maintenant: Date, appelant: Appelant,
  d: { verbe: string; parametres: P; motif: string; idempotence: string; correlation_id?: string | null },
): { action: Action; approbation: Approbation | null; deja: boolean } {
  const cleIdem = `${appelant.acteur.id}:${d.idempotence}`;
  const deja = stockage.lire<{ action_id: string }>('actions_idempotence', cleIdem);
  if (deja) {
    const a = stockage.lire<Action>('actions', deja.action_id)!;
    return { action: a, approbation: a.approbation_id ? stockage.lire<Approbation>('approbations', a.approbation_id) : null, deja: true };
  }
  const def = CATALOGUE[d.verbe];
  if (!def) throw new Error(`Action inconnue : ${d.verbe}. Actions connues : ${Object.keys(CATALOGUE).join(', ')}.`);
  const parametres = def.lire(d.parametres);
  const { cible, ressource } = resoudre(stockage, def, parametres);
  const decision = decider(appelant, def, parametres, ressource);
  const a: Action = {
    id: `ACT-${randomUUID()}`, verbe: d.verbe, acteur_id: appelant.acteur.id, acteur_type: appelant.acteur.type, parametres, ressource, motif: d.motif, decision,
    statut: 'en_attente', idempotence: d.idempotence, correlation_id: d.correlation_id || randomUUID(), cree_le: maintenant.toISOString(), approbation_id: null, resultat: null, erreur: null,
  };
  stockage.poser('actions_idempotence', cleIdem, { action_id: a.id });

  if (decision.verdict === 'DENY') {
    const refusee = stockage.poser('actions', a.id, { ...a, statut: 'refusee' as const, erreur: decision.motif });
    tracer(stockage, maintenant, refusee, appelant, 'DENIED', decision.motif);
    publier(stockage, maintenant, { type: 'security.policy_denied', tenant_id: ressource.tenant_id ?? null, correlation_id: a.correlation_id, source: appelant.acteur.id, donnees: { action_id: a.id, verbe: a.verbe, motif: decision.motif } });
    return { action: refusee, approbation: null, deja: false };
  }
  if (decision.verdict === 'ALLOW') return { action: executer(stockage, maintenant, stockage.poser('actions', a.id, a), appelant, cible), approbation: null, deja: false };

  const ap: Approbation = {
    id: `APR-${randomUUID().slice(0, 13).toUpperCase()}`, action_id: a.id, verbe: a.verbe, libelle: def.libelle, demandeur: appelant.acteur.id, demandeur_type: appelant.acteur.type,
    tenant_id: ressource.tenant_id ?? null, risque: decision.risque, requises: decision.approbations_requises === 2 ? 2 : 1, impact: def.impact(parametres, cible), motif: d.motif,
    statut: 'en_attente', decisions: [], cree_le: maintenant.toISOString(), expire_le: new Date(maintenant.getTime() + DUREE_APPROBATION_MS).toISOString(),
  };
  stockage.poser('approbations', ap.id, ap);
  const attente = stockage.poser('actions', a.id, { ...a, approbation_id: ap.id });
  tracer(stockage, maintenant, attente, appelant, 'PENDING', decision.motif);
  publier(stockage, maintenant, { type: 'action.approval_requested', tenant_id: ap.tenant_id, correlation_id: a.correlation_id, source: appelant.acteur.id, donnees: { approbation_id: ap.id, verbe: a.verbe, risque: ap.risque } });
  return { action: attente, approbation: ap, deja: false };
}

/** Expires approvals past their date, with their actions. */
export function expirerApprobations(stockage: Stockage, maintenant: Date): number {
  const perimees = stockage.lister<Approbation>('approbations', (x) => x.statut === 'en_attente' && Date.parse(x.expire_le) <= maintenant.getTime());
  for (const ap of perimees) {
    stockage.poser('approbations', ap.id, { ...ap, statut: 'expiree' as const });
    const a = stockage.lire<Action>('actions', ap.action_id);
    if (a) stockage.poser('actions', a.id, { ...a, statut: 'expiree' as const, erreur: "L'approbation n'est pas venue à temps." });
  }
  return perimees.length;
}

/**
 * One approver's decision (§10.1). The approver must be a human holding the
 * action's own permission on its scope, distinct from the requester and from the
 * earlier approvers. Enough approvals → the action runs as its requester asked.
 */
export function trancher(
  stockage: Stockage, maintenant: Date, approbateur: Appelant, id: string, decision: DecisionApprobateur['decision'], note: string,
): { approbation: Approbation; action: Action } {
  expirerApprobations(stockage, maintenant);
  const ap = stockage.lire<Approbation>('approbations', id);
  if (!ap) throw new Error("Cette approbation n'existe pas.");
  if (ap.statut !== 'en_attente') throw new Error(`Cette approbation est déjà ${ap.statut}.`);
  const a = stockage.lire<Action>('actions', ap.action_id)!;
  const def = CATALOGUE[a.verbe];
  const moi = approbateur.acteur;
  if (moi.type !== 'HUMAN') throw new Error('Seul un humain approuve.');
  if (!approbateur.mfa && !approbateur.secours) throw new Error('Approuver demande une session ouverte avec votre second facteur.');
  if (!aLaPermission(moi.roles, 'core.approval.decide', a.ressource)) throw new Error("Vous n'avez pas le droit d'approuver sur ce périmètre.");
  if (!aLaPermission(moi.roles, def.permission as Permission, a.ressource)) throw new Error(`Approuver cette action demande vous-même la permission ${def.permission}.`);
  if (moi.id === ap.demandeur) throw new Error('Le demandeur ne peut pas approuver sa propre demande.');
  if (ap.decisions.some((x) => x.par === moi.id && x.decision === 'approuve')) throw new Error('Vous avez déjà approuvé : une deuxième approbation doit venir de quelqu’un d’autre.');

  const decisions = [...ap.decisions, { par: moi.id, nom: moi.nom_affiche, decision, note: note.slice(0, 500), quand: maintenant.toISOString() }];
  const approuvees = new Set(decisions.filter((x) => x.decision === 'approuve').map((x) => x.par)).size;
  const statut: Approbation['statut'] = decision === 'refuse' ? 'refusee' : approuvees >= ap.requises ? 'approuvee' : 'en_attente';
  const suivante = stockage.poser('approbations', ap.id, { ...ap, decisions, statut });
  auditer(stockage, maintenant, {
    tenant_id: ap.tenant_id, acteur: moi.id, acteur_type: 'HUMAN', action: `approval.${decision}`, cible: ap.id, detail: `${ap.verbe} : ${note}`.slice(0, 500),
    politique: a.decision.verdict, risque: ap.risque, approbation: ap.id, resultat: 'SUCCESS', correlation_id: a.correlation_id,
  });
  publier(stockage, maintenant, { type: 'approval.decided', tenant_id: ap.tenant_id, correlation_id: a.correlation_id, source: moi.id, donnees: { approbation_id: ap.id, decision, statut } });

  if (statut === 'refusee') {
    return { approbation: suivante, action: stockage.poser('actions', a.id, { ...a, statut: 'refusee' as const, erreur: `Refusée par ${moi.nom_affiche} : ${note}` }) };
  }
  if (statut === 'approuvee') {
    // The action runs as its requester, with the approvals standing in for the checks it was waiting on.
    const fondateur = a.acteur_id === ACTEUR_FONDATEUR.id;
    const demandeur = fondateur ? ACTEUR_FONDATEUR : stockage.lire<Acteur>('acteurs', a.acteur_id);
    if (!demandeur || demandeur.statut !== 'actif') {
      return { approbation: suivante, action: stockage.poser('actions', a.id, { ...a, statut: 'echouee' as const, erreur: "Le demandeur n'est plus actif : l'action ne part pas." }) };
    }
    const appelantDemandeur: Appelant = { acteur: demandeur, mfa: true, secours: fondateur };
    const { cible } = resoudre(stockage, def, a.parametres);
    return { approbation: suivante, action: executer(stockage, maintenant, a, appelantDemandeur, cible) };
  }
  return { approbation: suivante, action: a };
}
