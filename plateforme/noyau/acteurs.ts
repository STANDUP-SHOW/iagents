// Les acteurs du noyau iAgent (ADMIN MASTER §3, P3) : humains, agents internes,
// services et Box sont identifiables, autorisables et auditables de la même façon.
//
// Credentials, never a shared password:
//  - every HUMAN, AGENT or SERVICE actor gets a personal key, shown ONCE at
//    creation and kept here as its SHA-256 only;
//  - a HUMAN opens a session with that key plus a TOTP code (RFC 6238) once MFA
//    is set up — the session token lives 12 h;
//  - an AGENT trades its key for a short token (15 min), so a leaked token dies fast;
//  - a DEVICE never holds a token: a Box signs each request with its Ed25519 key (http.ts).
// The platform's PLATEFORME_ADMIN_SECRET stays max's personal break-glass key:
// it maps to the FOUNDER actor, never to an anonymous "admin".

import { Buffer } from 'node:buffer';
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes } from 'node:crypto';
import type { Stockage } from '../stockage.ts';
import { estScope, ROLES, type LienRole } from './permissions.ts';

export type TypeActeur = 'HUMAN' | 'AGENT' | 'SERVICE' | 'DEVICE';
/** Agent autonomy (§3.3): 0 observe, 1 suggest, 2 low risk, 3 policy bound, 4 department, 5 executive (still bounded). */
export type Autonomie = 0 | 1 | 2 | 3 | 4 | 5;

/** Ceilings the policy engine reads for an actor; absent = the core's default. Amounts in euros, rates in percent. */
export type Budgets = { remise_max_pct?: number; credit_max_eur?: number; remboursement_max_eur?: number };

export type Acteur = {
  id: string;
  type: TypeActeur;
  statut: 'actif' | 'suspendu' | 'retire';
  nom_affiche: string;
  roles: LienRole[];
  /** AGENT only; humans and services carry null. */
  autonomie: Autonomie | null;
  departement: string | null;
  manager_id: string | null;
  budgets: Budgets;
  /** SHA-256 (hex) of the personal key. */
  cle_empreinte: string | null;
  /** TOTP secret, AES-256-GCM sealed with a key derived from the platform secret; `actif` once a first code was checked. */
  mfa: { scelle: string; actif: boolean } | null;
  cree_le: string;
  cree_par: string;
};

export type JetonActeur = {
  /** SHA-256 (hex) of the token: the token itself is never stored. */
  id: string;
  acteur_id: string;
  nature: 'session' | 'agent' | 'service';
  mfa: boolean;
  cree_le: string;
  expire_le: string;
};

/** Who is calling, as the core sees it after authentication. */
export type Appelant = { acteur: Acteur; mfa: boolean; secours: boolean };

export const DUREE_SESSION_MS = 12 * 3600_000;
export const DUREE_JETON_AGENT_MS = 15 * 60_000;
export const DUREE_JETON_SERVICE_MS = 3600_000;
const PREFIXE_CLE = 'iak_';
const PREFIXE_JETON = 'iat_';

/** The FOUNDER actor behind the break-glass secret: global, MFA-equivalent (the secret lives in max's vault). */
export const ACTEUR_FONDATEUR: Acteur = {
  id: 'ACT-FONDATEUR', type: 'HUMAN', statut: 'actif', nom_affiche: 'Fondateur', roles: [{ role: 'FONDATEUR', scope: { type: 'GLOBAL', id: null } }],
  autonomie: null, departement: null, manager_id: null, budgets: {}, cle_empreinte: null, mfa: null, cree_le: '2026-10-14T00:00:00.000Z', cree_par: 'noyau',
};

export const sha256 = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');

// --- TOTP (RFC 6238 over RFC 4226, SHA-1, 6 digits, 30 s) --------------------

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(octets: Buffer): string {
  let bits = 0, valeur = 0, sortie = '';
  for (const o of octets) {
    valeur = (valeur << 8) | o; bits += 8;
    while (bits >= 5) { sortie += BASE32[(valeur >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) sortie += BASE32[(valeur << (5 - bits)) & 31];
  return sortie;
}
export function depuisBase32(t: string): Buffer {
  let bits = 0, valeur = 0;
  const sortie: number[] = [];
  for (const c of t.replace(/=+$/, '').toUpperCase()) {
    const i = BASE32.indexOf(c);
    if (i < 0) throw new Error('base32 illisible');
    valeur = (valeur << 5) | i; bits += 5;
    if (bits >= 8) { sortie.push((valeur >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(sortie);
}

/** HOTP value for one counter (RFC 4226 §5.3, dynamic truncation). */
export function hotp(secret: Buffer, compteur: number): string {
  const c = Buffer.alloc(8);
  c.writeBigUInt64BE(BigInt(compteur));
  const h = createHmac('sha1', secret).update(c).digest();
  const d = h[h.length - 1] & 0x0f;
  const n = ((h[d] & 0x7f) << 24) | (h[d + 1] << 16) | (h[d + 2] << 8) | h[d + 3];
  return String(n % 1_000_000).padStart(6, '0');
}

/** Accepts the current 30 s step and one step either side (clock drift of a phone). */
export function totpValide(secret: Buffer, code: string, maintenant: Date): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const pas = Math.floor(maintenant.getTime() / 30_000);
  return [pas - 1, pas, pas + 1].some((p) => hotp(secret, p) === code);
}

function cleMfa(secretPlateforme: string): Buffer {
  return Buffer.from(hkdfSync('sha256', Buffer.from(secretPlateforme, 'utf8'), Buffer.alloc(0), Buffer.from('iagent-mfa-v1', 'utf8'), 32));
}
function sceller(secretPlateforme: string, clair: Buffer): string {
  const nonce = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', cleMfa(secretPlateforme), nonce);
  const chiffre = Buffer.concat([c.update(clair), c.final()]);
  return [nonce, c.getAuthTag(), chiffre].map((b) => b.toString('base64url')).join('.');
}
function desceller(secretPlateforme: string, scelle: string): Buffer {
  const [nonce, tag, chiffre] = scelle.split('.').map((p) => Buffer.from(p, 'base64url'));
  const d = createDecipheriv('aes-256-gcm', cleMfa(secretPlateforme), nonce);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(chiffre), d.final()]);
}

// --- actors --------------------------------------------------------------------

export function lireRoles(v: unknown): LienRole[] {
  if (!Array.isArray(v) || v.length === 0) throw new Error('« roles » doit être une liste non vide de { role, scope: { type, id } }.');
  return v.map((l) => {
    const role = (l as LienRole)?.role;
    const scope = (l as LienRole)?.scope;
    if (typeof role !== 'string' || !ROLES[role]) throw new Error(`Rôle inconnu : ${String(role)}. Rôles connus : ${Object.keys(ROLES).join(', ')}.`);
    if (!scope || !estScope(scope.type)) throw new Error(`Le rôle ${role} n'a pas de portée lisible (GLOBAL, REGION, TENANT, SITE, DEVICE, AGENT_INSTANCE, DEPARTMENT).`);
    const id = scope.type === 'GLOBAL' ? null : scope.id;
    if (scope.type !== 'GLOBAL' && (typeof id !== 'string' || !id.trim())) throw new Error(`La portée ${scope.type} du rôle ${role} doit nommer ce qu'elle couvre.`);
    if (role === 'FONDATEUR') throw new Error('Le rôle FONDATEUR ne se donne pas : il appartient à la clé de secours de la plateforme.');
    return { role, scope: { type: scope.type, id } };
  });
}

/** Creates an actor and its personal key. The key is returned here and nowhere else. */
export function creerActeur(
  stockage: Stockage,
  maintenant: Date,
  par: string,
  d: { type: Exclude<TypeActeur, 'DEVICE'>; nom_affiche: string; roles: LienRole[]; autonomie?: Autonomie | null; departement?: string | null; manager_id?: string | null; budgets?: Budgets },
): { acteur: Acteur; cle: string } {
  if (d.type === 'AGENT' && (d.autonomie === undefined || d.autonomie === null)) throw new Error('Un agent interne a toujours un niveau d’autonomie (0 à 5).');
  if (d.type !== 'AGENT' && d.autonomie !== undefined && d.autonomie !== null) throw new Error('Seul un agent interne porte un niveau d’autonomie.');
  const prefixe = { HUMAN: 'HUM', AGENT: 'AGT', SERVICE: 'SVC' }[d.type];
  const id = `${prefixe}-${randomBytes(6).toString('hex').toUpperCase()}`;
  const cle = PREFIXE_CLE + randomBytes(32).toString('base64url');
  const acteur: Acteur = {
    id, type: d.type, statut: 'actif', nom_affiche: d.nom_affiche, roles: d.roles, autonomie: d.type === 'AGENT' ? d.autonomie! : null,
    departement: d.departement ?? null, manager_id: d.manager_id ?? null, budgets: d.budgets ?? {}, cle_empreinte: sha256(cle), mfa: null,
    cree_le: maintenant.toISOString(), cree_par: par,
  };
  stockage.poser('acteurs', id, acteur);
  return { acteur, cle };
}

/** What may leave the core about an actor: never the key's hash nor the sealed TOTP. */
export function public_(a: Acteur) {
  const { cle_empreinte: _c, mfa, ...reste } = a;
  return { ...reste, mfa_actif: mfa?.actif ?? false };
}

/** Starts MFA enrolment: a fresh TOTP secret, sealed here, shown once as an otpauth URI. */
export function commencerMfa(stockage: Stockage, secretPlateforme: string, acteur: Acteur): { secret: string; uri: string } {
  if (acteur.type !== 'HUMAN') throw new Error('Seul un humain enrôle un second facteur ; un agent reçoit un jeton court.');
  const secret = randomBytes(20);
  stockage.poser('acteurs', acteur.id, { ...acteur, mfa: { scelle: sceller(secretPlateforme, secret), actif: false } });
  const s = base32(secret);
  return { secret: s, uri: `otpauth://totp/iAgent:${encodeURIComponent(acteur.nom_affiche)}?secret=${s}&issuer=iAgent&digits=6&period=30` };
}

export function codeMfaValide(secretPlateforme: string, acteur: Acteur, code: string, maintenant: Date): boolean {
  if (!acteur.mfa) return false;
  try { return totpValide(desceller(secretPlateforme, acteur.mfa.scelle), code, maintenant); } catch { return false; }
}

function emettre(stockage: Stockage, acteur: Acteur, nature: JetonActeur['nature'], mfa: boolean, maintenant: Date, duree: number) {
  const jeton = PREFIXE_JETON + randomBytes(32).toString('base64url');
  const j: JetonActeur = { id: sha256(jeton), acteur_id: acteur.id, nature, mfa, cree_le: maintenant.toISOString(), expire_le: new Date(maintenant.getTime() + duree).toISOString() };
  stockage.poser('jetons_acteurs', j.id, j);
  return { jeton, expire_le: j.expire_le, mfa };
}

/**
 * Trades a personal key (and a TOTP code for a human with MFA) for a token.
 * One refusal message for every bad credential: the caller learns nothing about which part failed.
 */
export function ouvrirSession(
  stockage: Stockage, secretPlateforme: string, maintenant: Date, d: { acteur_id: string; cle: string; code?: string | null },
): { jeton: string; expire_le: string; mfa: boolean } {
  const refus = 'Identifiant, clé ou code refusés.';
  const a = stockage.lire<Acteur>('acteurs', d.acteur_id);
  if (!a || a.statut !== 'actif' || !a.cle_empreinte || sha256(d.cle) !== a.cle_empreinte) throw new Error(refus);
  if (a.type === 'HUMAN') {
    if (a.mfa?.actif) {
      if (!d.code || !codeMfaValide(secretPlateforme, a, d.code, maintenant)) throw new Error(refus);
      return emettre(stockage, a, 'session', true, maintenant, DUREE_SESSION_MS);
    }
    return emettre(stockage, a, 'session', false, maintenant, DUREE_SESSION_MS);
  }
  if (a.type === 'AGENT') return emettre(stockage, a, 'agent', false, maintenant, DUREE_JETON_AGENT_MS);
  return emettre(stockage, a, 'service', false, maintenant, DUREE_JETON_SERVICE_MS);
}

/** The caller behind a Bearer value, or null. The break-glass secret is compared by the caller (http.ts) in constant time. */
export function appelantDuJeton(stockage: Stockage, jeton: string, maintenant: Date): Appelant | null {
  if (!jeton.startsWith(PREFIXE_JETON)) return null;
  const j = stockage.lire<JetonActeur>('jetons_acteurs', sha256(jeton));
  if (!j || Date.parse(j.expire_le) <= maintenant.getTime()) return null;
  const a = stockage.lire<Acteur>('acteurs', j.acteur_id);
  if (!a || a.statut !== 'actif') return null;
  return { acteur: a, mfa: j.mfa, secours: false };
}

/** Ends every token of an actor (suspension, lost device). */
export function revoquerJetons(stockage: Stockage, acteurId: string): number {
  const tous = stockage.lister<JetonActeur>('jetons_acteurs', (j) => j.acteur_id === acteurId);
  for (const j of tous) stockage.retirer('jetons_acteurs', j.id);
  return tous.length;
}
