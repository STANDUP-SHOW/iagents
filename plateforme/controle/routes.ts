// Routes du module « controle » : le Control Plane minimal (MASTER §6, §7, §8),
// exactement celles de docs/master/routes.md.
//
// Rules live elsewhere, once: transitions and versions in regles.ts, the client
// data detector in detecteur.ts, the licence token in jeton.ts, the audit writer
// in audit.ts. This file validates input, applies them, and answers.

import { createHash, createPublicKey, randomBytes, randomUUID } from 'node:crypto';
import { ok, refus, type Contexte, type Reponse, type Route } from '../serveur.ts';
import type { Box, Entitlement, SkillPack, Tenant } from '../modele.ts';
import type { Stockage } from '../stockage.ts';
import { ACTEUR_ADMIN, acteurBox, auditer } from './audit.ts';
import { refusDonneeClient } from './detecteur.ts';
import { cleDeSignature, DUREE_JETON_MS, empreinteCle, empreinteFiche, GRACE_JETON_MS, signerJetonLicence, type ContenuJeton } from './jeton.ts';
import { chiffrerSkill, clePubliqueX25519, signerSkill } from './scellement.ts';
import {
  calculerCompteur, cheminFiche, comparerVersions, estEmpreinte, estSemver, STATUTS_DEMANDABLES, templatesConnus,
  TRANSITIONS_BOX, TRANSITIONS_SKILL, urlRecevable,
} from './regles.ts';

// Types local to the Control Plane. Not in modele.ts (owned by the platform
// socle): reported so the coordinator can move them there.
export type MiseAJour = {
  id: string;
  composant: 'desktop' | 'os' | 'skills';
  version: string;
  canal: 'stable' | 'beta';
  url: string;
  empreinte: string;
  publiee_le: string;
};

/** A stored Skill Pack: the model's fields plus where it came from and its review trail. */
export type SkillPackDepose = SkillPack & {
  id: string; // `${skill_pack_id}@${version}`
  contenu: string | null;
  depose_le: string;
  /** Tenant that proposed it from the field; never returned to a Box. */
  propose_par: string | null;
  /** Ed25519 signature by the platform, set at validation (scellement.ts). */
  signature: string | null;
  revues: { quand: string; decision: SkillPack['validation_status']; motif: string }[];
};

const LICENCES = ['essential', 'professional', 'expert', 'commander', 'home'] as const satisfies readonly Entitlement['licence'][];
type LicencesManquantes = Exclude<Entitlement['licence'], (typeof LICENCES)[number]>;
const _licencesCompletes: [LicencesManquantes] extends [never] ? true : false = true;
void _licencesCompletes;

const COMPOSANTS = ['desktop', 'os', 'skills'] as const;
const CANAUX = ['stable', 'beta'] as const;
/** A Box carries no channel field in the model: every Box follows `stable`. */
const CANAL_BOX: MiseAJour['canal'] = 'stable';

// --- small readers -------------------------------------------------------------

class Refus extends Error {
  statut: number;
  constructor(statut: number, message: string) { super(message); this.statut = statut; }
}
const non = (statut: number, message: string): never => { throw new Refus(statut, message); };

function objet(corps: unknown): Record<string, unknown> {
  if (!corps || typeof corps !== 'object' || Array.isArray(corps)) non(400, 'Le corps de la requête doit être un objet JSON.');
  return corps as Record<string, unknown>;
}
function texte(c: Record<string, unknown>, champ: string, max = 500): string {
  const v = c[champ];
  if (typeof v !== 'string' || !v.trim()) non(400, `Le champ « ${champ} » est obligatoire.`);
  if ((v as string).length > max) non(400, `Le champ « ${champ} » est trop long.`);
  return (v as string).trim();
}
function parmi<T extends string>(c: Record<string, unknown>, champ: string, valeurs: readonly T[]): T {
  const v = c[champ];
  if (typeof v !== 'string' || !(valeurs as readonly string[]).includes(v)) {
    non(400, `Le champ « ${champ} » doit valoir ${valeurs.join(', ')}.`);
  }
  return v as T;
}
function listeDeTextes(c: Record<string, unknown>, champ: string, nonVide = false): string[] {
  const v = c[champ] ?? [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || !x.trim())) non(400, `Le champ « ${champ} » doit être une liste de textes.`);
  if (nonVide && (v as string[]).length === 0) non(400, `Le champ « ${champ} » ne peut pas être vide.`);
  return [...new Set((v as string[]).map((x) => x.trim()))];
}
function date(c: Record<string, unknown>, champ: string): string {
  const v = c[champ];
  if (typeof v !== 'string' || !Number.isFinite(Date.parse(v))) non(400, `Le champ « ${champ} » doit être une date ISO.`);
  return new Date(v as string).toISOString();
}

/** Wraps a handler so a `Refus` becomes its status; anything else is the server's 400. */
const traiter = (f: (ctx: Contexte) => Reponse) => (ctx: Contexte): Reponse => {
  try { return f(ctx); } catch (e) { if (e instanceof Refus) return refus(e.statut, e.message); throw e; }
};

const boxOuRien = (s: Stockage, id: string): Box => s.lire<Box>('boxes', id) ?? non(404, "Cette Box n'existe pas.");
const tenantOuRien = (s: Stockage, id: string): Tenant => s.lire<Tenant>('tenants', id) ?? non(404, "Ce client n'existe pas.");

/** Rights this Box may use right now: its tenant's active entitlements, in their dates. */
function droitsActifs(s: Stockage, box: Box, maintenant: Date): Entitlement[] {
  if (!box.tenant_id || box.statut !== 'active') return [];
  const t = maintenant.getTime();
  return s.pourTenant(box.tenant_id).lister<Entitlement>('entitlements', (e) =>
    e.device_id === box.device_id && e.statut === 'active' && Date.parse(e.debut) <= t && (e.fin === null || Date.parse(e.fin) > t),
  );
}

/** Revokes every live entitlement of a Box (returned or replaced), with one trace each. */
function revoquerToutDeLaBox(s: Stockage, box: Box, maintenant: Date, motif: string): void {
  if (!box.tenant_id) return;
  const vue = s.pourTenant(box.tenant_id);
  for (const e of vue.lister<Entitlement>('entitlements', (e) => e.device_id === box.device_id && (e.statut === 'active' || e.statut === 'suspendue'))) {
    vue.poser('entitlements', e.id, { ...e, statut: 'revoquee' });
    auditer(s, maintenant, { tenant_id: e.tenant_id, acteur: ACTEUR_ADMIN, action: 'entitlement.revoque', cible: e.id, detail: `Box ${box.device_id} ${box.statut} : ${motif}` });
  }
}

/** Checks common to every Skill Pack deposit, admin or field. */
function lireSkill(s: Stockage, c: Record<string, unknown>) {
  const skill_pack_id = texte(c, 'skill_pack_id', 64);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(skill_pack_id)) non(400, "« skill_pack_id » : lettres, chiffres, point, tiret ; 3 à 64 caractères.");
  const version = texte(c, 'version', 64);
  if (!estSemver(version)) non(400, '« version » doit être une version semver (ex. 1.4.0).');
  const compatible_agents = listeDeTextes(c, 'compatible_agents', true);
  const inconnus = compatible_agents.filter((a) => !templatesConnus().has(a));
  if (inconnus.length) non(400, `Agent inconnu du catalogue : ${inconnus.join(', ')}.`);
  const compatible_tools = listeDeTextes(c, 'compatible_tools');
  const sector_scope = listeDeTextes(c, 'sector_scope');
  const locale = texte(c, 'locale', 16);
  if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(locale)) non(400, '« locale » doit ressembler à fr ou fr-FR.');
  const changelog = texte(c, 'changelog', 4000);
  const contenu = c.contenu === undefined || c.contenu === null ? null : typeof c.contenu === 'string' ? c.contenu : non(400, '« contenu » doit être un texte.');
  if (contenu !== null && contenu.length > 500_000) non(400, '« contenu » est trop long.');
  // Semver never goes backwards for one pack, whatever the status of earlier versions.
  const precedentes = s.lister<SkillPackDepose>('skills', (k) => k.skill_pack_id === skill_pack_id);
  const plusHaute = precedentes.map((k) => k.version).sort(comparerVersions).at(-1);
  if (plusHaute && comparerVersions(version, plusHaute) <= 0) {
    non(409, `La version ${version} ne dépasse pas la ${plusHaute} déjà déposée : une version ne recule jamais et ne se redépose pas.`);
  }
  const fuite = refusDonneeClient({ skill_pack_id, compatible_tools, sector_scope, changelog, contenu });
  if (fuite) non(422, fuite);
  return { skill_pack_id, version, compatible_agents, compatible_tools, sector_scope, locale, changelog, contenu };
}

const sha256 = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');

/** What a Box may see of a Skill Pack: the model's fields and the content, never who proposed it. */
function pourLaBox(k: SkillPackDepose) {
  const { id, skill_pack_id, version, source_type, validation_status, compatible_agents, compatible_tools, sector_scope, locale, changelog, empreinte, signature } = k;
  // The content never travels in clear: a Box fetches it encrypted to its own key.
  return { id, skill_pack_id, version, source_type, validation_status, compatible_agents, compatible_tools, sector_scope, locale, changelog, empreinte, signature };
}

// --- routes ------------------------------------------------------------------------

export const routes: Route[] = [
  // Tenants
  {
    methode: 'POST', chemin: '/controle/tenants', acces: 'admin',
    traiter: traiter(({ stockage, corps, maintenant }) => {
      const c = objet(corps);
      const nom = texte(c, 'nom', 200);
      const segment = parmi(c, 'segment', ['business', 'home', 'enterprise'] as const);
      const pays = texte(c, 'pays', 2);
      if (!/^[A-Z]{2}$/.test(pays)) non(400, '« pays » est un code ISO à deux lettres majuscules (ex. FR).');
      if (c.opt_in_skills !== undefined && typeof c.opt_in_skills !== 'boolean') non(400, '« opt_in_skills » est vrai ou faux.');
      const t: Tenant = {
        tenant_id: `T-${randomBytes(6).toString('hex')}`, nom, segment, pays,
        opt_in_skills: c.opt_in_skills === true, // false by default (§7)
        cree_le: maintenant().toISOString(),
      };
      stockage.poser('tenants', t.tenant_id, t);
      auditer(stockage, maintenant(), { tenant_id: t.tenant_id, acteur: ACTEUR_ADMIN, action: 'tenant.cree', cible: t.tenant_id, detail: `segment ${segment}, opt_in_skills ${t.opt_in_skills}` });
      return ok(t, 201);
    }),
  },
  {
    methode: 'GET', chemin: '/controle/tenants', acces: 'admin',
    traiter: ({ stockage }) => ok(stockage.lister<Tenant>('tenants')),
  },

  // Boxes: provisioning, inventory, assignment, status
  {
    methode: 'POST', chemin: '/controle/boxes', acces: 'admin',
    traiter: traiter(({ stockage, corps, maintenant }) => {
      const c = objet(corps);
      const serial = texte(c, 'serial', 100);
      const gamme = parmi(c, 'gamme', ['business', 'home'] as const);
      const os = texte(c, 'os', 100);
      const version_desktop = texte(c, 'version_desktop', 64);
      if (!estSemver(version_desktop)) non(400, '« version_desktop » doit être une version semver.');
      const brut = texte(c, 'identite_publique', 2000);
      // The private key never leaves the Box: a PEM carrying one is refused, not derived.
      if (/PRIVATE KEY/.test(brut)) non(400, "« identite_publique » contient une clé PRIVÉE : elle ne doit jamais quitter la Box. Envoyez la clé publique seule.");
      let identite_publique: string;
      try {
        const k = createPublicKey(brut);
        if (k.asymmetricKeyType !== 'ed25519') non(400, "« identite_publique » doit être une clé publique Ed25519.");
        identite_publique = k.export({ type: 'spki', format: 'pem' }).toString();
      } catch (e) {
        if (e instanceof Refus) throw e;
        return refus(400, "« identite_publique » ne se lit pas comme une clé publique PEM.");
      }
      let cle_chiffrement_publique: string | null = null;
      if (c.cle_chiffrement_publique !== undefined && c.cle_chiffrement_publique !== null) {
        if (!clePubliqueX25519(c.cle_chiffrement_publique as string)) {
          non(400, '« cle_chiffrement_publique » doit être une clé publique X25519 brute de 32 octets, en base64url sans remplissage.');
        }
        cle_chiffrement_publique = c.cle_chiffrement_publique as string;
      }
      const empreinte = empreinteCle(identite_publique);
      const device_id = `BOX-${empreinte.slice(0, 16)}`;
      const boxes = stockage.lister<Box>('boxes');
      if (boxes.some((b) => b.serial === serial)) return refus(409, `Le numéro de série ${serial} est déjà enregistré.`);
      if (boxes.some((b) => b.device_id === device_id || empreinteCle(b.identite_publique) === empreinte)) {
        return refus(409, 'Cette clé publique est déjà celle d’une autre Box : chaque Box a sa propre identité.');
      }
      if (cle_chiffrement_publique && boxes.some((b) => b.cle_chiffrement_publique === cle_chiffrement_publique)) {
        return refus(409, 'Cette clé de chiffrement est déjà celle d’une autre Box.');
      }
      const box: Box = {
        device_id, tenant_id: null, serial, identite_publique, cle_chiffrement_publique, gamme, os, version_desktop,
        statut: 'stock', plan_id: null, sante: null, garantie_jusqu_au: null,
      };
      stockage.poser('boxes', device_id, box);
      auditer(stockage, maintenant(), { tenant_id: null, acteur: ACTEUR_ADMIN, action: 'box.provisionnee', cible: device_id, detail: `série ${serial}, gamme ${gamme}, clé ${empreinte.slice(0, 16)}` });
      return ok(box, 201);
    }),
  },
  {
    methode: 'GET', chemin: '/controle/boxes', acces: 'admin',
    traiter: ({ stockage, query }) => {
      const statut = query.get('statut');
      const tenant = query.get('tenant_id');
      return ok(stockage.lister<Box>('boxes', (b) => (!statut || b.statut === statut) && (!tenant || b.tenant_id === tenant)));
    },
  },
  {
    methode: 'GET', chemin: '/controle/boxes/:id', acces: 'admin',
    traiter: traiter(({ stockage, params }) => ok(boxOuRien(stockage, params.id))),
  },
  {
    methode: 'POST', chemin: '/controle/boxes/:id/attribuer', acces: 'admin',
    traiter: traiter(({ stockage, params, corps, maintenant }) => {
      const c = objet(corps);
      const box = boxOuRien(stockage, params.id);
      const tenant = tenantOuRien(stockage, texte(c, 'tenant_id', 64));
      const plan_id = texte(c, 'plan_id', 64);
      if (box.statut !== 'stock') return refus(409, `Cette Box est « ${box.statut} » : seule une Box en stock s'attribue.`);
      const suivante: Box = { ...box, tenant_id: tenant.tenant_id, plan_id, statut: 'provisionnee' };
      stockage.poser('boxes', box.device_id, suivante);
      auditer(stockage, maintenant(), { tenant_id: tenant.tenant_id, acteur: ACTEUR_ADMIN, action: 'box.attribuee', cible: box.device_id, detail: `plan ${plan_id}` });
      return ok(suivante);
    }),
  },
  {
    methode: 'POST', chemin: '/controle/boxes/:id/statut', acces: 'admin',
    traiter: traiter(({ stockage, params, corps, maintenant }) => {
      const c = objet(corps);
      const box = boxOuRien(stockage, params.id);
      const statut = parmi(c, 'statut', STATUTS_DEMANDABLES);
      const motif = texte(c, 'motif', 500);
      if (!TRANSITIONS_BOX[box.statut].includes(statut)) {
        const permis = TRANSITIONS_BOX[box.statut];
        return refus(409, `Passage de « ${box.statut} » à « ${statut} » refusé. ${permis.length ? `Depuis « ${box.statut} » : ${permis.join(', ')}.` : `« ${box.statut} » est un état final.`}`);
      }
      const suivante: Box = { ...box, statut };
      stockage.poser('boxes', box.device_id, suivante);
      auditer(stockage, maintenant(), { tenant_id: box.tenant_id, acteur: ACTEUR_ADMIN, action: 'box.statut', cible: box.device_id, detail: `${box.statut} -> ${statut} : ${motif}` });
      if (statut === 'restituee' || statut === 'remplacee') revoquerToutDeLaBox(stockage, suivante, maintenant(), motif);
      return ok(suivante);
    }),
  },

  // Entitlements
  {
    methode: 'POST', chemin: '/controle/entitlements', acces: 'admin',
    traiter: traiter(({ stockage, corps, maintenant }) => {
      const c = objet(corps);
      const tenant = tenantOuRien(stockage, texte(c, 'tenant_id', 64));
      const box = boxOuRien(stockage, texte(c, 'device_id', 64));
      if (box.tenant_id !== tenant.tenant_id) return refus(409, "Cette Box n'est pas attribuée à ce client.");
      if (box.statut !== 'provisionnee' && box.statut !== 'active') return refus(409, `Cette Box est « ${box.statut} » : aucun agent ne s'y active.`);
      const agent_template_id = texte(c, 'agent_template_id', 16);
      if (!/^AG-\d{4}$/.test(agent_template_id) || !templatesConnus().has(agent_template_id)) {
        return refus(400, `${agent_template_id} n'est pas un agent du catalogue (agents/ ou socle/).`);
      }
      const specialisation_id = c.specialisation_id === undefined || c.specialisation_id === null ? null : texte(c, 'specialisation_id', 64);
      const licence = parmi(c, 'licence', LICENCES);
      const debut = date(c, 'debut');
      const fin = c.fin === undefined || c.fin === null ? null : date(c, 'fin');
      if (fin !== null && Date.parse(fin) <= Date.parse(debut)) return refus(400, '« fin » doit venir après « debut ».');
      const vue = stockage.pourTenant(tenant.tenant_id);
      const doublon = vue.lister<Entitlement>('entitlements', (e) =>
        e.device_id === box.device_id && e.agent_template_id === agent_template_id && e.specialisation_id === specialisation_id && e.statut === 'active');
      if (doublon.length) return refus(409, `Cet agent a déjà un droit actif sur cette Box (${doublon[0].id}).`);
      const e: Entitlement = {
        id: `ENT-${randomUUID()}`, tenant_id: tenant.tenant_id, device_id: box.device_id, agent_template_id,
        specialisation_id, licence, statut: 'active', debut, fin,
      };
      vue.poser('entitlements', e.id, e);
      auditer(stockage, maintenant(), { tenant_id: tenant.tenant_id, acteur: ACTEUR_ADMIN, action: 'entitlement.cree', cible: e.id, detail: `${agent_template_id} sur ${box.device_id}, licence ${licence}` });
      return ok(e, 201);
    }),
  },
  {
    methode: 'GET', chemin: '/controle/entitlements', acces: 'admin',
    traiter: ({ stockage, query }) => {
      const tenant = query.get('tenant_id');
      const device = query.get('device_id');
      return ok(stockage.lister<Entitlement>('entitlements', (e) => (!tenant || e.tenant_id === tenant) && (!device || e.device_id === device)));
    },
  },
  {
    methode: 'POST', chemin: '/controle/entitlements/:id/revoquer', acces: 'admin',
    traiter: traiter(({ stockage, params, corps, maintenant }) => {
      const c = objet(corps);
      const motif = texte(c, 'motif', 500);
      const e = stockage.lire<Entitlement>('entitlements', params.id) ?? non(404, "Ce droit n'existe pas.");
      if (e.statut === 'revoquee') return refus(409, 'Ce droit est déjà révoqué.');
      const r: Entitlement = { ...e, statut: 'revoquee' };
      stockage.pourTenant(e.tenant_id).poser('entitlements', e.id, r);
      auditer(stockage, maintenant(), { tenant_id: e.tenant_id, acteur: ACTEUR_ADMIN, action: 'entitlement.revoque', cible: e.id, detail: motif });
      return ok(r);
    }),
  },

  // What a Box asks for itself
  {
    methode: 'GET', chemin: '/controle/box/droits', acces: 'box',
    traiter: traiter(({ stockage, box, maintenant }) => {
      const b = box!;
      if (b.statut !== 'active' || !b.tenant_id) return refus(403, `Cette Box est « ${b.statut} » : elle n'a aucun droit tant qu'elle n'est pas activée.`);
      const cle = cleDeSignature();
      if ('erreur' in cle) return refus(503, cle.erreur);
      const now = maintenant();
      const droits = droitsActifs(stockage, b, now);
      // The sheet is hashed now, from its exact bytes: the signed token signs the sheet.
      const droitsJeton = droits.map((e) => {
        const chemin = cheminFiche(e.agent_template_id);
        if (!chemin) non(409, `La fiche de ${e.agent_template_id} est introuvable sur la plateforme : aucun jeton n'est émis tant qu'elle manque.`);
        return { id: e.id, agent_template_id: e.agent_template_id, specialisation_id: e.specialisation_id, licence: e.licence, fin: e.fin, empreinte_fiche: empreinteFiche(chemin!) };
      });
      const contenu: ContenuJeton = {
        v: 2, device_id: b.device_id, tenant_id: b.tenant_id, cle_box: empreinteCle(b.identite_publique),
        emis_le: now.toISOString(), expire_le: new Date(now.getTime() + DUREE_JETON_MS).toISOString(),
        grace_jusqu_au: new Date(now.getTime() + GRACE_JETON_MS).toISOString(),
        droits: droitsJeton,
      };
      return ok({ droits, jeton: signerJetonLicence(contenu, cle.cle), expire_le: contenu.expire_le, grace_jusqu_au: contenu.grace_jusqu_au });
    }),
  },
  {
    methode: 'GET', chemin: '/controle/cle-publique', acces: 'public',
    traiter: () => {
      const cle = cleDeSignature();
      if ('erreur' in cle) return refus(503, cle.erreur);
      return ok({ cle_publique: cle.publique, algorithme: 'Ed25519' });
    },
  },
  {
    methode: 'POST', chemin: '/controle/box/telemetrie', acces: 'box',
    traiter: traiter(({ stockage, box, corps, maintenant }) => {
      const c = objet(corps);
      const mesure = (champ: string, min: number, max: number): number | undefined => {
        const v = c[champ];
        if (v === undefined || v === null) return undefined;
        if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) non(400, `« ${champ} » doit être un nombre entre ${min} et ${max}.`);
        return v as number;
      };
      const sante: NonNullable<Box['sante']> = { vu_le: maintenant().toISOString() };
      const cpu = mesure('cpu', 0, 100); if (cpu !== undefined) sante.cpu = cpu;
      const memoire = mesure('memoire', 0, 100); if (memoire !== undefined) sante.memoire = memoire;
      const disque = mesure('disque', 0, 100); if (disque !== undefined) sante.disque = disque;
      const temperature = mesure('temperature', -40, 130); if (temperature !== undefined) sante.temperature = temperature;
      const version_desktop = texte(c, 'version_desktop', 64);
      if (!estSemver(version_desktop)) non(400, '« version_desktop » doit être une version semver.');
      const suivante: Box = { ...box!, sante, version_desktop };
      stockage.poser('boxes', suivante.device_id, suivante);
      return ok({ sante });
    }),
  },
  {
    methode: 'GET', chemin: '/controle/box/mises-a-jour', acces: 'box',
    traiter: ({ stockage, box }) => {
      const visees = COMPOSANTS.flatMap((composant) => {
        const m = stockage.lister<MiseAJour>('mises_a_jour', (u) => u.composant === composant && u.canal === CANAL_BOX)
          .sort((a, b) => comparerVersions(a.version, b.version)).at(-1);
        if (!m) return [];
        const actuelle = composant === 'desktop' ? box!.version_desktop : null;
        const a_jour = actuelle !== null && estSemver(actuelle) ? comparerVersions(actuelle, m.version) >= 0 : null;
        return [{ composant, version: m.version, url: m.url, empreinte: m.empreinte, actuelle, a_jour }];
      });
      return ok({ canal: CANAL_BOX, mises_a_jour: visees });
    },
  },
  {
    methode: 'POST', chemin: '/controle/mises-a-jour', acces: 'admin',
    traiter: traiter(({ stockage, corps, maintenant }) => {
      const c = objet(corps);
      const composant = parmi(c, 'composant', COMPOSANTS);
      const canal = parmi(c, 'canal', CANAUX);
      const version = texte(c, 'version', 64);
      if (!estSemver(version)) non(400, '« version » doit être une version semver.');
      const url = texte(c, 'url', 2000);
      const pourquoi = urlRecevable(url);
      if (pourquoi) non(400, pourquoi);
      const empreinte = c.empreinte;
      if (!estEmpreinte(empreinte)) non(400, "« empreinte » est obligatoire : le SHA-256 du paquet en 64 caractères hexadécimaux minuscules. Sans elle, la Box ne peut pas vérifier ce qu'elle installe.");
      const derniere = stockage.lister<MiseAJour>('mises_a_jour', (u) => u.composant === composant && u.canal === canal)
        .map((u) => u.version).sort(comparerVersions).at(-1);
      if (derniere && comparerVersions(version, derniere) <= 0) {
        return refus(409, `La version ${version} ne dépasse pas la ${derniere} déjà publiée sur ${composant}/${canal} : une mise à jour ne recule jamais.`);
      }
      const m: MiseAJour = { id: `${composant}:${canal}:${version}`, composant, version, canal, url, empreinte: empreinte as string, publiee_le: maintenant().toISOString() };
      stockage.poser('mises_a_jour', m.id, m);
      auditer(stockage, maintenant(), { tenant_id: null, acteur: ACTEUR_ADMIN, action: 'mise-a-jour.publiee', cible: m.id, detail: `empreinte ${m.empreinte.slice(0, 16)}` });
      return ok(m, 201);
    }),
  },

  // Skill Packs
  {
    methode: 'POST', chemin: '/controle/skills', acces: 'admin',
    traiter: traiter(({ stockage, corps, maintenant }) => {
      const c = objet(corps);
      const k = lireSkill(stockage, c);
      const source_type = c.source_type === undefined ? 'iagent' : parmi(c, 'source_type', ['iagent', 'terrain-anonymise', 'editeur'] as const);
      const empreinte = c.empreinte;
      if (!estEmpreinte(empreinte)) non(400, "« empreinte » est obligatoire : le SHA-256 du paquet signé, en 64 caractères hexadécimaux minuscules.");
      if (k.contenu !== null && sha256(k.contenu) !== empreinte) non(400, "« empreinte » ne correspond pas au contenu déposé.");
      const d: SkillPackDepose = {
        ...k, id: `${k.skill_pack_id}@${k.version}`, source_type, validation_status: 'candidat', empreinte: empreinte as string,
        depose_le: maintenant().toISOString(), propose_par: null, signature: null, revues: [],
      };
      stockage.poser('skills', d.id, d);
      auditer(stockage, maintenant(), { tenant_id: null, acteur: ACTEUR_ADMIN, action: 'skill.depose', cible: d.id, detail: `source ${source_type}` });
      return ok(d, 201);
    }),
  },
  {
    methode: 'POST', chemin: '/controle/skills/:id/revue', acces: 'admin',
    traiter: traiter(({ stockage, params, corps, maintenant }) => {
      const c = objet(corps);
      const k = stockage.lire<SkillPackDepose>('skills', params.id) ?? non(404, "Ce Skill Pack n'existe pas.");
      const decision = parmi(c, 'decision', ['en-revue', 'valide', 'rejete', 'retire'] as const);
      const motif = texte(c, 'motif', 1000);
      const permis = TRANSITIONS_SKILL[k.validation_status];
      if (!permis.includes(decision)) {
        return refus(409, `Passage de « ${k.validation_status} » à « ${decision} » refusé. ${permis.length ? `Depuis « ${k.validation_status} » : ${permis.join(', ')}.` : `« ${k.validation_status} » est un état final.`}`);
      }
      let signature = k.signature ?? null;
      if (decision === 'valide') {
        // A validated pack is a signed pack, or it is not validated.
        const cle = cleDeSignature();
        if ('erreur' in cle) return refus(503, `Validation refusée : ${cle.erreur}`);
        if (!estEmpreinte(k.empreinte)) return refus(409, "Validation refusée : ce Skill Pack n'a pas d'empreinte à signer.");
        signature = signerSkill(k.skill_pack_id, k.version, k.empreinte, cle.cle);
      }
      const quand = maintenant().toISOString();
      const r: SkillPackDepose = { ...k, validation_status: decision, signature, revues: [...k.revues, { quand, decision, motif }] };
      stockage.poser('skills', k.id, r);
      auditer(stockage, maintenant(), { tenant_id: k.propose_par, acteur: ACTEUR_ADMIN, action: 'skill.revue', cible: k.id, detail: `${k.validation_status} -> ${decision} : ${motif}` });
      return ok(r);
    }),
  },
  {
    methode: 'GET', chemin: '/controle/skills', acces: 'admin',
    traiter: ({ stockage }) => ok(stockage.lister<SkillPackDepose>('skills')),
  },
  {
    methode: 'GET', chemin: '/controle/box/skills', acces: 'box',
    traiter: ({ stockage, box, maintenant }) => {
      const agents = new Set(droitsActifs(stockage, box!, maintenant()).map((e) => e.agent_template_id));
      const derniers = new Map<string, SkillPackDepose>();
      for (const k of stockage.lister<SkillPackDepose>('skills', (k) => k.validation_status === 'valide' && k.compatible_agents.some((a) => agents.has(a)))) {
        const avant = derniers.get(k.skill_pack_id);
        if (!avant || comparerVersions(k.version, avant.version) > 0) derniers.set(k.skill_pack_id, k);
      }
      return ok([...derniers.values()].map(pourLaBox));
    },
  },
  {
    methode: 'GET', chemin: '/controle/box/skills/:id/contenu', acces: 'box',
    traiter: traiter(({ stockage, box, params, maintenant }) => {
      const b = box!;
      const k = stockage.lire<SkillPackDepose>('skills', params.id) ?? non(404, "Ce Skill Pack n'existe pas.");
      if (k.validation_status !== 'valide') return refus(409, `Ce Skill Pack est « ${k.validation_status} » : seul un Skill Pack validé se livre.`);
      const agents = new Set(droitsActifs(stockage, b, maintenant()).map((e) => e.agent_template_id));
      if (!k.compatible_agents.some((a) => agents.has(a))) return refus(403, "Aucun agent de cette Box n'a droit à ce Skill Pack.");
      if (!b.cle_chiffrement_publique) return refus(409, "Cette Box n'a pas de clé de chiffrement enregistrée : elle ne peut recevoir aucun contenu de Skill Pack.");
      if (!k.signature || !k.empreinte) return refus(409, "Ce Skill Pack n'est pas signé : il ne se livre pas.");
      if (k.contenu === null) return refus(409, "Le contenu de ce Skill Pack n'est pas déposé sur la plateforme.");
      const s = chiffrerSkill({ contenu: k.contenu, deviceId: b.device_id, skillPackId: k.skill_pack_id, version: k.version, cleBoxPublique: b.cle_chiffrement_publique });
      auditer(stockage, maintenant(), { tenant_id: b.tenant_id, acteur: acteurBox(b.device_id), action: 'skill.livre', cible: k.id, detail: 'contenu chiffré pour cette Box' });
      return ok({ skill_pack_id: k.skill_pack_id, version: k.version, empreinte: k.empreinte, signature: k.signature, ...s });
    }),
  },
  {
    methode: 'POST', chemin: '/controle/box/skills/candidats', acces: 'box',
    traiter: traiter(({ stockage, box, corps, maintenant }) => {
      const b = box!;
      const tenant = b.tenant_id ? stockage.lire<Tenant>('tenants', b.tenant_id) : null;
      if (!tenant || tenant.opt_in_skills !== true) {
        return refus(403, "Ce client n'a pas accepté de participer à l'amélioration commune des Skill Packs (opt_in_skills) : rien de ce que fait sa Box ne devient Skill Pack.");
      }
      const c = objet(corps);
      if (typeof c.contenu !== 'string' || !c.contenu.trim()) non(400, '« contenu » est obligatoire pour une proposition terrain.');
      const k = lireSkill(stockage, c);
      const d: SkillPackDepose = {
        ...k, id: `${k.skill_pack_id}@${k.version}`, source_type: 'terrain-anonymise', validation_status: 'candidat',
        empreinte: sha256(k.contenu!), depose_le: maintenant().toISOString(), propose_par: tenant.tenant_id, signature: null, revues: [],
      };
      stockage.poser('skills', d.id, d);
      auditer(stockage, maintenant(), { tenant_id: tenant.tenant_id, acteur: acteurBox(b.device_id), action: 'skill.propose', cible: d.id, detail: 'proposition terrain, en attente de revue' });
      return ok(pourLaBox(d), 201);
    }),
  },

  // Public counter and audit
  {
    methode: 'GET', chemin: '/controle/compteur', acces: 'public',
    traiter: ({ maintenant }) => ok(calculerCompteur(maintenant())),
  },
  {
    methode: 'GET', chemin: '/controle/audit', acces: 'admin',
    traiter: ({ stockage, query }) => {
      const tenant = query.get('tenant_id');
      return ok(stockage.lister<{ tenant_id: string | null; quand: string }>('audit', (a) => !tenant || a.tenant_id === tenant)
        .sort((a, b) => a.quand.localeCompare(b.quand)));
    },
  },
];
