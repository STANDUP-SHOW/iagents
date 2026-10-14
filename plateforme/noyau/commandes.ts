// Les commandes envoyées à une Box (ADMIN MASTER §4.4, §8.2). Une commande est
// mise en file ici ; c'est la Box qui la relève (connexion sortante, §8), l'exécute
// et rend son résultat. Rien ici ne dit qu'une commande a été exécutée tant que la
// Box ne l'a pas rendue : le statut reste `en_file` puis `remise`, ou `expiree`.
//
// Command safety (§8.2): unique id and idempotency key, TTL, server-side
// authorisation (the Action Gateway decides before anything is queued here),
// allowlist of services, output redacted before it is stored, audit on both sides.

import { randomUUID } from 'node:crypto';
import type { Stockage } from '../stockage.ts';
import type { Box } from '../modele.ts';
import { RESSEMBLE_A_UN_SECRET } from '../controle/audit.ts';
import SERVICES_OS from '../../box/os/systemd/SERVICES.json' with { type: 'json' };

export const TYPES_COMMANDE = [
  'restart_service', 'diagnostic', 'restart_box', 'shutdown', 'update', 'rollback', 'rotate_certificate', 'factory_reset', 'remote_screen', 'controlled_shell',
] as const;
export type TypeCommande = (typeof TYPES_COMMANDE)[number];

/** How long a command waits for its Box before it expires: short for live actions, longer for maintenance. */
export const TTL_COMMANDE_S: Record<TypeCommande, number> = {
  restart_service: 15 * 60, diagnostic: 30 * 60, restart_box: 30 * 60, shutdown: 60 * 60, update: 24 * 3600, rollback: 24 * 3600,
  rotate_certificate: 24 * 3600, factory_reset: 3600, remote_screen: 10 * 60, controlled_shell: 10 * 60,
};

export type StatutCommande = 'en_file' | 'remise' | 'reussie' | 'echouee' | 'expiree';
export type Commande = {
  id: string;
  device_id: string;
  tenant_id: string | null;
  type: TypeCommande;
  parametres: Record<string, string | number | boolean>;
  statut: StatutCommande;
  cree_le: string;
  expire_le: string;
  remise_le: string | null;
  termine_le: string | null;
  resultat: { code: number; sortie: string; duree_ms: number } | null;
  action_id: string | null;
  demandeur: string;
  correlation_id: string;
};

/**
 * Services a command may restart: the ones iAgent OS really runs. A service whose
 * unit is a placeholder (`etat: absent`) is refused in plain words rather than
 * "restarted" — restarting nothing would report a success that did not happen.
 */
export function servicesRedemarrables(): { reels: string[]; absents: string[] } {
  const s = (SERVICES_OS as { services: Record<string, { etat: string }> }).services;
  const reels = Object.entries(s).filter(([n, v]) => v.etat === 'reel' && n !== 'iagent-usine').map(([n]) => n);
  const absents = Object.entries(s).filter(([, v]) => v.etat !== 'reel').map(([n]) => n);
  return { reels, absents };
}

/** Short names agents and screens use, mapped to the systemd unit. */
export function uniteDuService(nom: string): string {
  return nom.startsWith('iagent-') ? nom : `iagent-${nom}`;
}

export function verifierService(nom: string): string {
  const unite = uniteDuService(nom);
  const { reels, absents } = servicesRedemarrables();
  if (reels.includes(unite)) return unite;
  if (absents.includes(unite)) throw new Error(`Le service ${unite} n'est pas encore livré sur iAgent OS : il n'y a rien à redémarrer.`);
  throw new Error(`Le service ${unite} n'est pas dans la liste des services d'iAgent OS (${reels.join(', ')}).`);
}

/** Which Box may receive commands: one that is installed at a client or in maintenance. */
export function boxRecoitCommandes(box: Box): string | null {
  if (box.statut === 'active' || box.statut === 'expediee' || box.statut === 'provisionnee') return null;
  return `La Box ${box.device_id} est ${box.statut} : elle ne reçoit pas de commande.`;
}

export function enfiler(
  stockage: Stockage, maintenant: Date,
  d: { box: Box; type: TypeCommande; parametres: Commande['parametres']; action_id: string | null; demandeur: string; correlation_id: string },
): Commande {
  const refus = boxRecoitCommandes(d.box);
  if (refus) throw new Error(refus);
  const c: Commande = {
    id: `CMD-${randomUUID()}`, device_id: d.box.device_id, tenant_id: d.box.tenant_id, type: d.type, parametres: d.parametres, statut: 'en_file',
    cree_le: maintenant.toISOString(), expire_le: new Date(maintenant.getTime() + TTL_COMMANDE_S[d.type] * 1000).toISOString(),
    remise_le: null, termine_le: null, resultat: null, action_id: d.action_id, demandeur: d.demandeur, correlation_id: d.correlation_id,
  };
  return stockage.poser('commandes', c.id, c);
}

/** Expires what waited too long. Returns the expired commands so the caller can publish their events. */
export function expirer(stockage: Stockage, maintenant: Date, deviceId?: string): Commande[] {
  const t = maintenant.getTime();
  const perimees = stockage.lister<Commande>('commandes', (c) =>
    (c.statut === 'en_file' || c.statut === 'remise') && Date.parse(c.expire_le) <= t && (!deviceId || c.device_id === deviceId));
  return perimees.map((c) => stockage.poser('commandes', c.id, { ...c, statut: 'expiree' as const, termine_le: maintenant.toISOString() }));
}

/** The commands a Box picks up now. Handing one out twice is allowed (lost answer): the Box dedupes by id. */
export function aRemettre(stockage: Stockage, box: Box, maintenant: Date): Commande[] {
  expirer(stockage, maintenant, box.device_id);
  const prets = stockage.lister<Commande>('commandes', (c) => c.device_id === box.device_id && (c.statut === 'en_file' || c.statut === 'remise'))
    .sort((a, b) => a.cree_le.localeCompare(b.cree_le));
  return prets.map((c) => c.statut === 'remise' ? c : stockage.poser('commandes', c.id, { ...c, statut: 'remise' as const, remise_le: maintenant.toISOString() }));
}

const SORTIE_MAX = 8000;
/** Output is redacted before it is stored: anything shaped like a key or token becomes [masqué]. */
export function caviarder(sortie: string): string {
  const masque = new RegExp(RESSEMBLE_A_UN_SECRET.source, 'g');
  const propre = sortie.replace(masque, '[masqué]').replace(/(password|mot de passe|secret|token|jeton)\s*[:=]\s*\S+/gi, '$1=[masqué]');
  return propre.length > SORTIE_MAX ? `${propre.slice(0, SORTIE_MAX)}\n[… sortie tronquée]` : propre;
}

/** Records what the Box says happened. Idempotent: the same result twice is accepted once. */
export function enregistrerResultat(
  stockage: Stockage, box: Box, id: string, r: { reussie: boolean; code: number; sortie: string; duree_ms: number }, maintenant: Date,
): { commande: Commande; deja: boolean } {
  const c = stockage.lire<Commande>('commandes', id);
  if (!c || c.device_id !== box.device_id) throw new Error("Cette commande n'existe pas pour cette Box.");
  if (c.statut === 'reussie' || c.statut === 'echouee') return { commande: c, deja: true };
  if (c.statut === 'expiree') throw new Error('Cette commande a expiré avant son résultat : elle ne se rouvre pas.');
  const suivante: Commande = {
    ...c, statut: r.reussie ? 'reussie' : 'echouee', termine_le: maintenant.toISOString(),
    resultat: { code: r.code, sortie: caviarder(r.sortie), duree_ms: r.duree_ms },
  };
  return { commande: stockage.poser('commandes', c.id, suivante), deja: false };
}
