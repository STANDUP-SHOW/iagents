// Routes du noyau iAgent (ADMIN MASTER §17) : `/v1/…`. Les consoles (Fleet,
// Platform, Team) et les agents internes passent tous par ici ; les Box aussi,
// pour le battement, l'état voulu et les commandes (§8).
//
// Conventions (§17.1): JSON in and out, one error shape `{ erreur }`, cursor
// pagination (`apres`, `limite`, `suivant`), an idempotency key on every action,
// a correlation id carried from the request to the audit and the events.

import { randomUUID } from 'node:crypto';
import { ok, refus, type Contexte, type Reponse, type Route } from '../http.ts';
import type { Audit, Box, Entitlement } from '../modele.ts';
import type { Stockage } from '../stockage.ts';
import { auditer } from '../controle/audit.ts';
import { estSemver } from '../controle/regles.ts';
import { commencerMfa, codeMfaValide, creerActeur, lireRoles, ouvrirSession, public_, revoquerJetons, type Acteur, type Appelant, type Autonomie } from './acteurs.ts';
import { aLaPermission, PERMISSIONS, ROLES, type Permission, type Ressource } from './permissions.ts';
import {
  BATTEMENTS_MANQUES_HORS_LIGNE, connexionDe, convergence, cycleDe, etatVouluDe, PERIODE_BATTEMENT_S, recalculerEtatVoulu, scoreSante,
  type Battement, type ConsigneAgent, type ContenuEtat, type EtatReel,
} from './etat.ts';
import { aRemettre, enregistrerResultat, expirer, servicesRedemarrables, TYPES_COMMANDE, type Commande } from './commandes.ts';
import { changerIncident, ETATS_INCIDENT, TRANSITIONS_INCIDENT, lireEvenements, publier, rejouerLettresMortes, type EtatIncident, type Incident } from './evenements.ts';
import { CATALOGUE, expirerApprobations, soumettre, trancher, type Action, type Approbation } from './passerelle.ts';

// --- small readers -------------------------------------------------------------------

class Refus extends Error { statut: number; constructor(statut: number, m: string) { super(m); this.statut = statut; } }
const non = (statut: number, m: string): never => { throw new Refus(statut, m); };
const traiter = (f: (ctx: Contexte) => Reponse) => (ctx: Contexte): Reponse => {
  try { return f(ctx); } catch (e) {
    if (e instanceof Refus) return refus(e.statut, e.message);
    return refus(400, e instanceof Error ? e.message : 'Requête refusée.');
  }
};
function objet(corps: unknown): Record<string, unknown> {
  if (!corps || typeof corps !== 'object' || Array.isArray(corps)) non(400, 'Le corps de la requête doit être un objet JSON.');
  return corps as Record<string, unknown>;
}
function texte(c: Record<string, unknown>, champ: string, max = 300): string {
  const v = c[champ];
  if (typeof v !== 'string' || !v.trim()) non(400, `Le champ « ${champ} » est obligatoire.`);
  if ((v as string).length > max) non(400, `Le champ « ${champ} » est trop long.`);
  return (v as string).trim();
}
const optionnel = (c: Record<string, unknown>, champ: string, max = 300): string | null => (c[champ] === undefined || c[champ] === null ? null : texte(c, champ, max));
const correlation = (ctx: Contexte): string => {
  const v = (ctx.entetes['x-correlation-id'] ?? '').trim();
  return /^[A-Za-z0-9-]{8,64}$/.test(v) ? v : randomUUID();
};
function page<T>(tous: T[], cle: (x: T) => string, ctx: Contexte): { elements: T[]; suivant: string | null } {
  const limite = Math.min(Math.max(Number(ctx.query.get('limite') ?? 100) || 100, 1), 500);
  const apres = ctx.query.get('apres');
  const tries = [...tous].sort((a, b) => cle(a).localeCompare(cle(b)));
  const depuis = apres ? tries.filter((x) => cle(x) > apres) : tries;
  const elements = depuis.slice(0, limite);
  return { elements, suivant: depuis.length > limite ? cle(elements[elements.length - 1]) : null };
}
const peut = (a: Appelant, p: Permission, r: Ressource = {}) => aLaPermission(a.acteur.roles, p, r);
const ressourceBox = (b: Box): Ressource => ({ device_id: b.device_id, tenant_id: b.tenant_id });

// --- Box side (§8) ---------------------------------------------------------------------

type Connu = { device_id: string; etat: string; disque_critique: boolean };

/** Records a change of connection state and publishes it once. */
function noterConnexion(stockage: Stockage, box: Box, etat: string, maintenant: Date, source: string): void {
  const avant = stockage.lire<Connu>('connexions', box.device_id);
  const disqueCritique = (box.sante?.disque ?? 0) >= 95;
  if (avant?.etat === etat && avant.disque_critique === disqueCritique) return;
  stockage.poser('connexions', box.device_id, { device_id: box.device_id, etat, disque_critique: disqueCritique });
  const correlation_id = randomUUID();
  if (etat === 'hors_ligne' && avant?.etat !== 'hors_ligne') {
    publier(stockage, maintenant, { type: 'device.offline', tenant_id: box.tenant_id, correlation_id, source, donnees: { device_id: box.device_id } });
  } else if (etat !== 'hors_ligne' && avant?.etat === 'hors_ligne') {
    publier(stockage, maintenant, { type: 'device.back_online', tenant_id: box.tenant_id, correlation_id, source, donnees: { device_id: box.device_id } });
  }
  if (disqueCritique && !avant?.disque_critique) publier(stockage, maintenant, { type: 'device.disk_critical', tenant_id: box.tenant_id, correlation_id, source, donnees: { device_id: box.device_id, disque: box.sante?.disque } });
}

function lireContenu(c: Record<string, unknown>): ContenuEtat {
  const r = c.reel;
  if (!r || typeof r !== 'object' || Array.isArray(r)) non(400, '« reel » doit être un objet { versions, agents, politiques }.');
  const o = r as Record<string, unknown>;
  const carte = (champ: string) => {
    const v = o[champ] ?? {};
    if (!v || typeof v !== 'object' || Array.isArray(v)) non(400, `« reel.${champ} » doit être un objet.`);
    if (Object.keys(v as object).length > 200) non(400, `« reel.${champ} » : deux cents entrées au plus.`);
    return v as Record<string, unknown>;
  };
  const versions = carte('versions');
  for (const [k, v] of Object.entries(versions)) if (!estSemver(v)) non(400, `« reel.versions.${k} » doit être une version semver.`);
  const agents: Record<string, ConsigneAgent> = {};
  for (const [k, v] of Object.entries(carte('agents'))) {
    const a = v as Partial<ConsigneAgent>;
    if (!a || !['RUN', 'HOLD', 'STOP'].includes(String(a.consigne))) non(400, `« reel.agents.${k}.consigne » : RUN, HOLD ou STOP.`);
    agents[k] = { agent_template_id: String(a.agent_template_id ?? ''), etat: (a.etat ?? 'ACTIVE') as ConsigneAgent['etat'], consigne: a.consigne as ConsigneAgent['consigne'] };
  }
  const politiques = carte('politiques') as Record<string, string | number | boolean>;
  return { versions: versions as Record<string, string>, agents, politiques };
}

// --- views for the consoles -------------------------------------------------------------------

function ligneBox(stockage: Stockage, b: Box, maintenant: Date) {
  const battement = stockage.lire<Battement>('battements', b.device_id);
  const connexion = connexionDe(b, battement, maintenant);
  const conv = convergence(stockage, b.device_id);
  const alertes = stockage.lister<Incident>('incidents', (i) => i.ressource.startsWith(b.device_id) && i.etat !== 'RESOLVED' && i.etat !== 'POSTMORTEM');
  return {
    device_id: b.device_id, reference: b.reference, tenant_id: b.tenant_id, gamme: b.gamme, statut: b.statut, connexion, score_sante: scoreSante(b, connexion),
    profil_materiel: b.profil_materiel, memoire_go: b.inventaire?.memoire_go ?? null, disque_go: b.inventaire?.disque.capacite_go ?? null,
    versions: { os: b.os, desktop: b.version_desktop, ...(b.versions ?? {}) }, vu_le: battement?.vu_le ?? b.sante?.vu_le ?? null, convergee: conv.convergee,
    alertes: alertes.map((i) => ({ id: i.id, severite: i.severite, titre: i.titre })),
  };
}

function balayer(stockage: Stockage, maintenant: Date) {
  let changements = 0;
  for (const b of stockage.lister<Box>('boxes', (x) => x.statut === 'active' || x.statut === 'expediee')) {
    const etat = connexionDe(b, stockage.lire<Battement>('battements', b.device_id), maintenant);
    if (etat === 'jamais_vue') continue;
    const avant = stockage.lire<Connu>('connexions', b.device_id)?.etat;
    noterConnexion(stockage, b, etat, maintenant, 'service:balayage');
    if (avant !== etat) changements++;
  }
  const expirees = expirer(stockage, maintenant);
  for (const c of expirees) publier(stockage, maintenant, { type: 'device.command_expired', tenant_id: c.tenant_id, correlation_id: c.correlation_id, source: 'service:balayage', donnees: { commande_id: c.id, device_id: c.device_id, type: c.type } });
  return { changements_connexion: changements, commandes_expirees: expirees.length, approbations_expirees: expirerApprobations(stockage, maintenant), lettres_rejouees: rejouerLettresMortes(stockage, maintenant) };
}

/** An action request answered the same way wherever it came from (console button, agent tool, route shortcut). */
function repondreAction(r: { action: Action; approbation: Approbation | null; deja: boolean }): Reponse {
  const { action, approbation, deja } = r;
  const statut = action.statut === 'refusee' ? 403 : action.statut === 'echouee' ? 422 : action.statut === 'en_attente' ? 202 : 200;
  return { statut, corps: { action, approbation, deja, ...(action.erreur && statut >= 400 ? { erreur: action.erreur } : {}) } };
}
function viaPasserelle(ctx: Contexte, verbe: string, parametres: Record<string, unknown>): Reponse {
  const c = objet(ctx.corps ?? {});
  return repondreAction(soumettre(ctx.stockage, ctx.maintenant(), ctx.appelant!, {
    verbe, parametres, motif: texte(c, 'motif', 500), idempotence: texte(c, 'idempotence', 100), correlation_id: correlation(ctx),
  }));
}

const VERBE_DE_COMMANDE: Record<string, string> = {
  restart_service: 'fleet.service.restart', diagnostic: 'fleet.device.diagnostic', restart_box: 'fleet.device.restart', shutdown: 'fleet.device.shutdown',
  update: 'fleet.device.update', rollback: 'fleet.device.rollback', rotate_certificate: 'fleet.device.certificate.rotate', factory_reset: 'fleet.device.reset.factory',
  remote_screen: 'fleet.device.remote.screen', controlled_shell: 'fleet.device.shell',
};

// --- routes ----------------------------------------------------------------------------------

export const routes: Route[] = [
  // Identity
  {
    methode: 'POST', chemin: '/v1/sessions', acces: 'public',
    traiter: traiter(({ stockage, corps, maintenant, secretPlateforme }) => {
      const c = objet(corps);
      try {
        return ok(ouvrirSession(stockage, secretPlateforme, maintenant(), { acteur_id: texte(c, 'acteur_id', 40), cle: texte(c, 'cle', 200), code: optionnel(c, 'code', 6) }));
      } catch (e) { return refus(401, e instanceof Error ? e.message : 'Refusé.'); }
    }),
  },
  { methode: 'GET', chemin: '/v1/moi', acces: 'acteur', traiter: ({ appelant }) => ok({ ...public_(appelant!.acteur), session_mfa: appelant!.mfa, cle_de_secours: appelant!.secours }) },
  {
    methode: 'GET', chemin: '/v1/registre', acces: 'acteur',
    traiter: () => ok({
      permissions: PERMISSIONS,
      roles: Object.entries(ROLES).map(([id, r]) => ({ id, libelle: r.libelle, permissions: r.permissions })),
      actions: Object.values(CATALOGUE).map((a) => ({ verbe: a.verbe, libelle: a.libelle, permission: a.permission, cible: a.cible, risque_de_base: a.risque({ montant_eur: 0, pourcentage: 0 }) })),
      commandes: TYPES_COMMANDE, services: servicesRedemarrables(), etats_incident: ETATS_INCIDENT, transitions_incident: TRANSITIONS_INCIDENT,
      battement: { periode_s: PERIODE_BATTEMENT_S, manques_hors_ligne: BATTEMENTS_MANQUES_HORS_LIGNE },
    }),
  },
  {
    methode: 'POST', chemin: '/v1/acteurs', acces: 'acteur', permission: 'core.actor.manage',
    traiter: traiter(({ stockage, corps, maintenant, appelant }) => {
      const c = objet(corps);
      const type = texte(c, 'type', 10);
      if (type !== 'HUMAN' && type !== 'AGENT' && type !== 'SERVICE') non(400, '« type » : HUMAN, AGENT ou SERVICE (une Box s’enrôle par l’usine).');
      if (!appelant!.mfa && !appelant!.secours) non(403, 'Créer un acteur demande une session avec second facteur.');
      const autonomie = c.autonomie === undefined || c.autonomie === null ? null : Number(c.autonomie);
      if (autonomie !== null && (!Number.isInteger(autonomie) || autonomie < 0 || autonomie > 5)) non(400, '« autonomie » : un entier de 0 à 5.');
      const budgets = (c.budgets ?? {}) as Record<string, unknown>;
      for (const [k, v] of Object.entries(budgets)) {
        if (!['remise_max_pct', 'credit_max_eur', 'remboursement_max_eur'].includes(k) || typeof v !== 'number' || v < 0) non(400, `Budget « ${k} » illisible.`);
      }
      const { acteur, cle } = creerActeur(stockage, maintenant(), appelant!.acteur.id, {
        type: type as 'HUMAN' | 'AGENT' | 'SERVICE', nom_affiche: texte(c, 'nom_affiche', 80), roles: lireRoles(c.roles),
        autonomie: autonomie as Autonomie | null, departement: optionnel(c, 'departement', 60), manager_id: optionnel(c, 'manager_id', 40), budgets,
      });
      auditer(stockage, maintenant(), { tenant_id: null, acteur: appelant!.acteur.id, acteur_type: appelant!.acteur.type, action: 'core.actor.create', cible: acteur.id, detail: `${acteur.type} ${acteur.nom_affiche}`, resultat: 'SUCCESS' });
      publier(stockage, maintenant(), { type: 'actor.created', tenant_id: null, correlation_id: randomUUID(), source: appelant!.acteur.id, donnees: { acteur_id: acteur.id, type: acteur.type } });
      return ok({ acteur: public_(acteur), cle, avertissement: 'Cette clé ne sera plus jamais affichée. Rangez-la dans le coffre de la machine qui s’en sert.' }, 201);
    }),
  },
  {
    methode: 'GET', chemin: '/v1/acteurs', acces: 'acteur', permission: 'core.actor.manage',
    traiter: (ctx) => ok(page(ctx.stockage.lister<Acteur>('acteurs').map(public_), (a) => a.id, ctx)),
  },
  {
    methode: 'POST', chemin: '/v1/acteurs/:id/statut', acces: 'acteur', permission: 'core.actor.manage',
    traiter: traiter(({ stockage, params, corps, maintenant, appelant }) => {
      const c = objet(corps);
      const statut = texte(c, 'statut', 10);
      if (!['actif', 'suspendu', 'retire'].includes(statut)) non(400, '« statut » : actif, suspendu ou retire.');
      const a = stockage.lire<Acteur>('acteurs', params.id) ?? non(404, "Cet acteur n'existe pas.");
      if (a.id === appelant!.acteur.id) non(409, 'On ne change pas son propre statut.');
      stockage.poser('acteurs', a.id, { ...a, statut: statut as Acteur['statut'] });
      const jetons = statut === 'actif' ? 0 : revoquerJetons(stockage, a.id);
      auditer(stockage, maintenant(), { tenant_id: null, acteur: appelant!.acteur.id, acteur_type: appelant!.acteur.type, action: 'core.actor.status', cible: a.id, detail: `${statut} : ${texte(c, 'motif', 300)}`, resultat: 'SUCCESS' });
      if (statut !== 'actif') publier(stockage, maintenant(), { type: 'actor.suspended', tenant_id: null, correlation_id: randomUUID(), source: appelant!.acteur.id, donnees: { acteur_id: a.id, statut } });
      return ok({ id: a.id, statut, jetons_revoques: jetons });
    }),
  },
  {
    methode: 'POST', chemin: '/v1/moi/mfa', acces: 'acteur',
    traiter: traiter(({ stockage, appelant, secretPlateforme }) => {
      if (appelant!.secours) non(409, 'La clé de secours n’a pas de second facteur : créez votre propre compte humain.');
      if (appelant!.acteur.mfa?.actif) non(409, 'Votre second facteur est déjà en place.');
      return ok({ ...commencerMfa(stockage, secretPlateforme, appelant!.acteur), consigne: "Ajoutez ce compte dans votre application d'authentification, puis confirmez avec le code à 6 chiffres." });
    }),
  },
  {
    methode: 'POST', chemin: '/v1/moi/mfa/confirmer', acces: 'acteur',
    traiter: traiter(({ stockage, corps, appelant, maintenant, secretPlateforme }) => {
      const a = stockage.lire<Acteur>('acteurs', appelant!.acteur.id) ?? non(409, 'La clé de secours n’a pas de second facteur.');
      if (!a.mfa) non(409, 'Commencez par demander un second facteur.');
      if (!codeMfaValide(secretPlateforme, a, texte(objet(corps), 'code', 6), maintenant())) non(401, 'Code refusé.');
      stockage.poser('acteurs', a.id, { ...a, mfa: { ...a.mfa!, actif: true } });
      auditer(stockage, maintenant(), { tenant_id: null, acteur: a.id, acteur_type: 'HUMAN', action: 'core.actor.mfa', cible: a.id, detail: 'second facteur activé', resultat: 'SUCCESS' });
      return ok({ mfa_actif: true, consigne: 'Ouvrez une nouvelle session avec votre code pour agir sur les actions sensibles.' });
    }),
  },

  // Fleet (§4, §17)
  {
    methode: 'GET', chemin: '/v1/vue-ensemble', acces: 'acteur', permission: 'fleet.device.read',
    traiter: ({ stockage, appelant, maintenant }) => {
      const m = maintenant();
      const lignes = stockage.lister<Box>('boxes', (b) => peut(appelant!, 'fleet.device.read', ressourceBox(b))).map((b) => ligneBox(stockage, b, m));
      const compter = (f: (l: (typeof lignes)[number]) => string) => lignes.reduce<Record<string, number>>((acc, l) => { const k = f(l); acc[k] = (acc[k] ?? 0) + 1; return acc; }, {});
      return ok({
        total: lignes.length, par_connexion: compter((l) => l.connexion), par_statut: compter((l) => l.statut), par_gamme: compter((l) => l.gamme),
        par_profil: compter((l) => l.profil_materiel ?? 'non qualifiée'), par_version_desktop: compter((l) => l.versions.desktop),
        non_convergees: lignes.filter((l) => !l.convergee).length,
        incidents_ouverts: stockage.lister<Incident>('incidents', (i) => i.etat !== 'RESOLVED' && i.etat !== 'POSTMORTEM').length,
        approbations_en_attente: stockage.lister<Approbation>('approbations', (a) => a.statut === 'en_attente').length,
        commandes_en_file: stockage.lister<Commande>('commandes', (c) => c.statut === 'en_file' || c.statut === 'remise').length,
        calcule_le: m.toISOString(),
      });
    },
  },
  {
    methode: 'GET', chemin: '/v1/devices', acces: 'acteur', permission: 'fleet.device.read',
    traiter: (ctx) => {
      const m = ctx.maintenant();
      const q = (ctx.query.get('q') ?? '').toLowerCase();
      const f = { statut: ctx.query.get('statut'), connexion: ctx.query.get('connexion'), tenant_id: ctx.query.get('tenant_id'), gamme: ctx.query.get('gamme') };
      const lignes = ctx.stockage.lister<Box>('boxes', (b) => peut(ctx.appelant!, 'fleet.device.read', ressourceBox(b)))
        .map((b) => ligneBox(ctx.stockage, b, m))
        .filter((l) => (!f.statut || l.statut === f.statut) && (!f.connexion || l.connexion === f.connexion) && (!f.tenant_id || l.tenant_id === f.tenant_id) && (!f.gamme || l.gamme === f.gamme)
          && (!q || `${l.device_id} ${l.reference} ${l.tenant_id ?? ''}`.toLowerCase().includes(q)));
      return ok(page(lignes, (l) => l.device_id, ctx));
    },
  },
  {
    methode: 'GET', chemin: '/v1/devices/:id', acces: 'acteur', permission: 'fleet.device.read',
    traiter: traiter(({ stockage, params, appelant, maintenant }) => {
      const b = stockage.lire<Box>('boxes', params.id) ?? non(404, "Cette Box n'existe pas.");
      if (!peut(appelant!, 'fleet.device.read', ressourceBox(b))) non(404, "Cette Box n'existe pas.");
      const m = maintenant();
      const droits = b.tenant_id ? stockage.pourTenant(b.tenant_id).lister<Entitlement>('entitlements', (e) => e.device_id === b.device_id) : [];
      const { identite_publique: _cle, cle_chiffrement_publique: _x, ...sansCles } = b;
      return ok({
        box: sansCles, ligne: ligneBox(stockage, b, m), battement: stockage.lire<Battement>('battements', b.device_id),
        etat_voulu: etatVouluDe(stockage, b.device_id), etat_reel: stockage.lire<EtatReel>('etats_reels', b.device_id), convergence: convergence(stockage, b.device_id),
        agents: droits.map((e) => ({ entitlement_id: e.id, agent_template_id: e.agent_template_id, licence: e.licence, statut_droit: e.statut, etat: cycleDe(stockage, e).etat })),
        commandes: stockage.lister<Commande>('commandes', (c) => c.device_id === b.device_id).sort((x, y) => y.cree_le.localeCompare(x.cree_le)).slice(0, 50),
        incidents: stockage.lister<Incident>('incidents', (i) => i.ressource.startsWith(b.device_id)),
        audit: stockage.lister<Audit>('audit', (a) => a.cible === b.device_id || a.cible === `box:${b.device_id}`).sort((x, y) => y.quand.localeCompare(x.quand)).slice(0, 50),
      });
    }),
  },
  {
    methode: 'GET', chemin: '/v1/devices/:id/desired-state', acces: 'acteur', permission: 'fleet.device.read',
    traiter: traiter(({ stockage, params, appelant }) => {
      const b = stockage.lire<Box>('boxes', params.id) ?? non(404, "Cette Box n'existe pas.");
      if (!peut(appelant!, 'fleet.device.read', ressourceBox(b))) non(404, "Cette Box n'existe pas.");
      return ok({ etat_voulu: etatVouluDe(stockage, b.device_id), etat_reel: stockage.lire<EtatReel>('etats_reels', b.device_id), convergence: convergence(stockage, b.device_id) });
    }),
  },
  {
    methode: 'PUT', chemin: '/v1/devices/:id/desired-state', acces: 'acteur', permission: 'fleet.device.desired.update',
    traiter: traiter((ctx) => {
      const c = objet(ctx.corps);
      return viaPasserelle(ctx, 'fleet.device.desired.update', { device_id: ctx.params.id, versions: c.versions, politiques: c.politiques });
    }),
  },
  {
    methode: 'POST', chemin: '/v1/devices/:id/commands', acces: 'acteur',
    traiter: traiter((ctx) => {
      const c = objet(ctx.corps);
      const type = texte(c, 'type', 40);
      const verbe = VERBE_DE_COMMANDE[type] ?? non(400, `« type » : ${Object.keys(VERBE_DE_COMMANDE).join(', ')}.`);
      const p = (c.parametres && typeof c.parametres === 'object' ? c.parametres : {}) as Record<string, unknown>;
      return viaPasserelle(ctx, verbe, { ...p, device_id: ctx.params.id });
    }),
  },
  { methode: 'POST', chemin: '/v1/devices/:id/diagnostics', acces: 'acteur', traiter: traiter((ctx) => viaPasserelle(ctx, 'fleet.device.diagnostic', { device_id: ctx.params.id })) },

  // Agents (§5.4, §17)
  ...(['pause', 'resume', 'suspend', 'terminate'] as const).map((v): Route => ({
    methode: 'POST', chemin: `/v1/agents/:id/${v}`, acces: 'acteur',
    traiter: traiter((ctx) => viaPasserelle(ctx, `platform.agent.${v}`, { entitlement_id: ctx.params.id, motif: objet(ctx.corps).motif })),
  })),

  // Action Gateway and approvals (§10)
  {
    methode: 'POST', chemin: '/v1/actions', acces: 'acteur',
    traiter: traiter((ctx) => {
      const c = objet(ctx.corps);
      const p = c.parametres;
      if (!p || typeof p !== 'object' || Array.isArray(p)) non(400, '« parametres » doit être un objet.');
      return repondreAction(soumettre(ctx.stockage, ctx.maintenant(), ctx.appelant!, {
        verbe: texte(c, 'verbe', 80), parametres: p as Record<string, unknown>, motif: texte(c, 'motif', 500), idempotence: texte(c, 'idempotence', 100),
        correlation_id: optionnel(c, 'correlation_id', 64) ?? correlation(ctx),
      }));
    }),
  },
  {
    methode: 'GET', chemin: '/v1/actions', acces: 'acteur',
    traiter: (ctx) => {
      const tout = peut(ctx.appelant!, 'security.audit.read');
      const statut = ctx.query.get('statut');
      return ok(page(ctx.stockage.lister<Action>('actions', (a) => (tout || a.acteur_id === ctx.appelant!.acteur.id) && (!statut || a.statut === statut)), (a) => `${a.cree_le}|${a.id}`, ctx));
    },
  },
  {
    methode: 'GET', chemin: '/v1/approbations', acces: 'acteur', permission: 'core.approval.decide',
    traiter: (ctx) => {
      expirerApprobations(ctx.stockage, ctx.maintenant());
      const statut = ctx.query.get('statut') ?? 'en_attente';
      const visibles = ctx.stockage.lister<Approbation>('approbations', (a) => (statut === 'toutes' || a.statut === statut)
        && peut(ctx.appelant!, 'core.approval.decide', ctx.stockage.lire<Action>('actions', a.action_id)?.ressource ?? {}));
      return ok(page(visibles.map((a) => ({ ...a, action: ctx.stockage.lire<Action>('actions', a.action_id) })), (a) => `${a.cree_le}|${a.id}`, ctx));
    },
  },
  {
    methode: 'POST', chemin: '/v1/approbations/:id/decision', acces: 'acteur', permission: 'core.approval.decide',
    traiter: traiter(({ stockage, params, corps, appelant, maintenant }) => {
      const c = objet(corps);
      const decision = texte(c, 'decision', 20);
      if (!['approuve', 'refuse', 'clarification'].includes(decision)) non(400, '« decision » : approuve, refuse ou clarification.');
      const r = trancher(stockage, maintenant(), appelant!, params.id, decision as 'approuve' | 'refuse' | 'clarification', texte(c, 'note', 500));
      return ok(r);
    }),
  },

  // Events, incidents, audit (§7, §11, §16)
  {
    methode: 'GET', chemin: '/v1/evenements', acces: 'acteur', permission: 'core.event.read',
    traiter: (ctx) => {
      const apres = Number(ctx.query.get('apres') ?? 0) || 0;
      const limite = Math.min(Math.max(Number(ctx.query.get('limite') ?? 100) || 100, 1), 500);
      const filtre = { type: ctx.query.get('type') ?? undefined, tenant_id: ctx.query.get('tenant_id') ?? undefined, correlation_id: ctx.query.get('correlation_id') ?? undefined };
      const elements = lireEvenements(ctx.stockage, apres, limite + 1, filtre)
        .filter((e) => peut(ctx.appelant!, 'core.event.read', { tenant_id: e.tenant_id, device_id: (e.donnees.device_id as string) ?? null }));
      return ok({ elements: elements.slice(0, limite), suivant: elements.length > limite ? String(elements[limite - 1].seq) : null });
    },
  },
  {
    methode: 'GET', chemin: '/v1/incidents', acces: 'acteur', permission: 'fleet.device.read',
    traiter: (ctx) => {
      const etat = ctx.query.get('etat');
      const ouverts = ctx.query.get('ouverts') === '1';
      return ok(page(ctx.stockage.lister<Incident>('incidents', (i) => (!etat || i.etat === etat) && (!ouverts || (i.etat !== 'RESOLVED' && i.etat !== 'POSTMORTEM'))
        && peut(ctx.appelant!, 'fleet.device.read', { tenant_id: i.tenant_id, device_id: i.ressource.split('#')[0] })), (i) => `${i.ouvert_le}|${i.id}`, ctx));
    },
  },
  {
    methode: 'POST', chemin: '/v1/incidents/:id/etat', acces: 'acteur', permission: 'core.incident.manage',
    traiter: traiter(({ stockage, params, corps, appelant, maintenant }) => {
      const c = objet(corps);
      const etat = texte(c, 'etat', 20);
      if (!(ETATS_INCIDENT as readonly string[]).includes(etat)) non(400, `« etat » : ${ETATS_INCIDENT.join(', ')}.`);
      const responsable = c.responsable === undefined ? undefined : optionnel(c, 'responsable', 40);
      return ok(changerIncident(stockage, maintenant(), params.id, etat as EtatIncident, appelant!.acteur.id, texte(c, 'note', 500), responsable));
    }),
  },
  {
    methode: 'GET', chemin: '/v1/audit', acces: 'acteur', permission: 'security.audit.read',
    traiter: (ctx) => {
      const f = { correlation_id: ctx.query.get('correlation_id'), acteur: ctx.query.get('acteur'), cible: ctx.query.get('cible'), tenant_id: ctx.query.get('tenant_id') };
      const lignes = ctx.stockage.lister<Audit>('audit', (a) => (!f.correlation_id || a.correlation_id === f.correlation_id) && (!f.acteur || a.acteur.startsWith(f.acteur))
        && (!f.cible || a.cible === f.cible) && (!f.tenant_id || a.tenant_id === f.tenant_id) && peut(ctx.appelant!, 'security.audit.read', { tenant_id: a.tenant_id }));
      return ok(page(lignes, (a) => `${a.quand}|${a.id}`, ctx));
    },
  },
  {
    methode: 'POST', chemin: '/v1/balayage', acces: 'acteur', permission: 'core.sweep.run',
    traiter: ({ stockage, maintenant }) => ok(balayer(stockage, maintenant())),
  },

  // Box side (§8): heartbeat, desired/actual state, commands
  {
    methode: 'POST', chemin: '/v1/box/battement', acces: 'box',
    traiter: traiter(({ stockage, box, corps, maintenant }) => {
      const c = objet(corps ?? {});
      const uptime = c.uptime_s === undefined ? 0 : Number(c.uptime_s);
      if (!Number.isFinite(uptime) || uptime < 0) non(400, '« uptime_s » doit être un nombre positif.');
      const m = maintenant();
      const avant = stockage.lire<Battement>('battements', box!.device_id);
      const b: Battement = { device_id: box!.device_id, tenant_id: box!.tenant_id, vu_le: m.toISOString(), uptime_s: uptime, sequence: (avant?.sequence ?? 0) + 1 };
      stockage.poser('battements', b.device_id, b);
      noterConnexion(stockage, box!, connexionDe(box!, b, m), m, `box:${box!.device_id}`);
      const voulu = etatVouluDe(stockage, box!.device_id);
      const enFile = stockage.lister<Commande>('commandes', (x) => x.device_id === box!.device_id && x.statut === 'en_file').length;
      // Jitter: thousands of Boxes must not all call back in the same second (§9.1).
      const prochain = PERIODE_BATTEMENT_S + Math.floor(Math.random() * 11) - 5;
      return ok({ prochain_dans_s: prochain, version_voulue: voulu?.version ?? null, commandes_en_attente: enFile });
    }),
  },
  {
    methode: 'GET', chemin: '/v1/box/etat-voulu', acces: 'box',
    traiter: ({ stockage, box, maintenant }) => {
      const { etat } = recalculerEtatVoulu(stockage, box!, maintenant(), 'noyau', randomUUID());
      return ok(etat);
    },
  },
  {
    methode: 'POST', chemin: '/v1/box/etat-reel', acces: 'box',
    traiter: traiter(({ stockage, box, corps, maintenant }) => {
      const c = objet(corps);
      const version = Number(c.version_appliquee);
      if (!Number.isInteger(version) || version < 0) non(400, '« version_appliquee » doit être un entier.');
      const voulu = etatVouluDe(stockage, box!.device_id);
      if (voulu && version > voulu.version) non(409, `La Box dit avoir appliqué la version ${version}, la plateforme n'en a publié que ${voulu.version}.`);
      const avant = convergence(stockage, box!.device_id).convergee;
      const r: EtatReel = { device_id: box!.device_id, tenant_id: box!.tenant_id, version_appliquee: version, reel: lireContenu(c), recu_le: maintenant().toISOString() };
      stockage.poser('etats_reels', r.device_id, r);
      const apres = convergence(stockage, box!.device_id);
      if (apres.convergee && !avant) publier(stockage, maintenant(), { type: 'device.converged', tenant_id: box!.tenant_id, correlation_id: voulu?.correlation_id ?? randomUUID(), source: `box:${box!.device_id}`, donnees: { device_id: box!.device_id, version } });
      return ok(apres);
    }),
  },
  {
    methode: 'GET', chemin: '/v1/box/commandes', acces: 'box',
    traiter: ({ stockage, box, maintenant }) => ok({
      commandes: aRemettre(stockage, box!, maintenant()).map(({ id, type, parametres, expire_le, correlation_id }) => ({ id, type, parametres, expire_le, correlation_id })),
    }),
  },
  {
    methode: 'POST', chemin: '/v1/box/commandes/:id/resultat', acces: 'box',
    traiter: traiter(({ stockage, box, params, corps, maintenant }) => {
      const c = objet(corps);
      if (typeof c.reussie !== 'boolean') non(400, '« reussie » doit valoir vrai ou faux.');
      const code = Number(c.code ?? (c.reussie ? 0 : 1));
      const duree = Number(c.duree_ms ?? 0);
      const sortie = typeof c.sortie === 'string' ? c.sortie : '';
      if (sortie.length > 200_000) non(413, 'Sortie trop longue.');
      const { commande, deja } = enregistrerResultat(stockage, box!, params.id, { reussie: c.reussie as boolean, code, sortie, duree_ms: duree }, maintenant());
      if (!deja) {
        auditer(stockage, maintenant(), {
          tenant_id: commande.tenant_id, acteur: `box:${box!.device_id}`, acteur_type: 'DEVICE', action: `fleet.command.${commande.type}`, cible: box!.device_id,
          detail: `résultat ${commande.statut} (code ${code})`, resultat: commande.statut === 'reussie' ? 'SUCCESS' : 'FAILURE', correlation_id: commande.correlation_id,
        });
        publier(stockage, maintenant(), {
          type: commande.statut === 'reussie' ? 'device.command_succeeded' : 'device.command_failed', tenant_id: commande.tenant_id, correlation_id: commande.correlation_id,
          source: `box:${box!.device_id}`, donnees: { commande_id: commande.id, device_id: box!.device_id, type: commande.type },
        });
      }
      return ok({ id: commande.id, statut: commande.statut, deja });
    }),
  },
];

/** Minimal OpenAPI 3.1 contract of the core, derived from the route table so it cannot drift from it (§17.1). */
export function contratOpenApi(): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of routes) {
    const chemin = r.chemin.replace(/:([a-z_]+)/g, '{$1}');
    (paths[chemin] ??= {})[r.methode.toLowerCase()] = {
      security: r.acces === 'public' ? [] : [{ [r.acces]: [] }],
      ...(r.permission ? { 'x-permission': r.permission } : {}),
      responses: { default: { description: 'JSON ; une erreur est { "erreur": "<phrase en français>" }' } },
    };
  }
  return {
    openapi: '3.1.0', info: { title: 'iAgent Core', version: '1.0.0' }, paths,
    components: { securitySchemes: {
      acteur: { type: 'http', scheme: 'bearer', description: 'Jeton de session (humain, 12 h) ou d’agent (15 min), ou clé de secours.' },
      box: { type: 'apiKey', in: 'header', name: 'x-signature', description: 'Signature Ed25519 de la Box : méthode, chemin, horodatage, empreinte du corps.' },
    } },
  };
}
routes.push({ methode: 'GET', chemin: '/v1/openapi.json', acces: 'public', traiter: () => ok(contratOpenApi()) });
