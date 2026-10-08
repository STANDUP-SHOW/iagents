// Routes of the « voix » module (docs/master/routes.md, section voix): voice
// registry, numbers, switchboard policy, operator webhooks, Voice Hub queues,
// human handoff, outbound campaigns and the Box's view of its calls.
//
// What leaves for an operator or an engine is a real HTTP call behind an
// adapter (`telephonie.ts`, `fournisseurs-voix.ts`). The media bridge that would
// carry a phone line's audio to a voice engine (Telnyx `stream_url`, Twilio
// Media Streams) needs a WebSocket upgrade the platform server does not offer
// yet: until then `pont_media` is false, and the switchboard sends calls to a
// human, the voicemail or a callback instead of pretending an agent answers.
import { randomUUID } from 'node:crypto';
import type { ModeVoix, PhoneNumber, VoiceProfile } from '../modele.ts';
import { ok, refus, type Contexte, type Reponse, type Route } from '../serveur.ts';
import type { Stockage } from '../stockage.ts';
import { campagneInvalide, verifierContact } from './campagnes.ts';
import type { Env } from './cles.ts';
import { coutAppel } from './cout.ts';
import { BASES_OFFICIELLES as BASES_VOIX, disponibilites, type Bases as BasesVoix, type Cerveau } from './fournisseurs-voix.ts';
import { admettre, depasses, enfiler, fileInvalide, suivant } from './hub.ts';
import { choisirMoteur, MODES, profilInvalide } from './registre.ts';
import { ETAT_INITIAL, standardInvalide, transition, type Action, type EtatAppel, type Evenement, type Transition } from './standard.ts';
import { BASES_OFFICIELLES as BASES_TEL, echapperXml, normaliserE164, operateur, type Bases as BasesTel, type PhoneProvider } from './telephonie.ts';
import taux from './taux.json' with { type: 'json' };
import type { AppelVoix, Campagne, Canal, DecisionHandoff, EnFile, FileAttente, Handoff, Opposition, Standard } from './types.ts';
import { PROVIDERS_TEL } from './types.ts';

export type ConfigVoix = { env: Env; basesVoix: BasesVoix; basesTel: BasesTel; cerveau: Cerveau | null; pont_media: boolean };
let config: ConfigVoix = { env: process.env, basesVoix: BASES_VOIX, basesTel: BASES_TEL, cerveau: null, pont_media: false };
/** The bench points the adapters at local fakes; production keeps the official addresses. */
export function configurerVoix(c: Partial<ConfigVoix>): void { config = { ...config, ...c }; }

const C = {
  profils: 'voix_profils', numeros: 'numeros', standards: 'voix_standards', files: 'voix_files', enFile: 'voix_en_file',
  appels: 'voix_appels', handoffs: 'voix_handoffs', rappels: 'voix_rappels', campagnes: 'voix_campagnes', opposition: 'voix_opposition',
};

const iso = (d: Date) => d.toISOString();
const corpsObjet = (ctx: Contexte): Record<string, unknown> => (ctx.corps && typeof ctx.corps === 'object' ? ctx.corps as Record<string, unknown> : {});

function tenantBox(ctx: Contexte): string | Reponse {
  const t = ctx.box?.tenant_id;
  return t ? t : refus(403, 'Cette Box n’est attribuée à aucun client.');
}

// ---------------------------------------------------------------------------
// Executing the machine's actions
// ---------------------------------------------------------------------------

type Fait = { action: Action['type']; fait: boolean; motif: string };

const ACTIONS_MEDIA = new Set(['dire', 'messagerie', 'mettre_en_attente', 'connecter_agent']);

/** Runs the actions that leave through the operator's REST API; the rest is stored here. */
async function executer(s: Stockage, p: PhoneProvider, appel: AppelVoix, actions: Action[], maintenant: Date, parWebhook: boolean): Promise<Fait[]> {
  const faits: Fait[] = [];
  for (const a of actions) {
    try {
      if (a.type === 'notifier_handoff') {
        const h: Handoff = { id: appel.id, tenant_id: appel.tenant_id, appel_id: appel.id, appelant: a.appelant, motif: a.motif, resume: a.resume, humain_id: a.humain_id, cree_le: iso(maintenant), statut: 'en-attente', decide_le: null };
        s.pourTenant(appel.tenant_id).poser(C.handoffs, h.id, h);
        faits.push({ action: a.type, fait: true, motif: 'Demande de prise en main posée pour la Box.' });
      } else if (a.type === 'programmer_rappel') {
        s.pourTenant(appel.tenant_id).poser(C.rappels, `${appel.id}`, { tenant_id: appel.tenant_id, appel_id: appel.id, numero: a.numero, cree_le: iso(maintenant), fait: false });
        faits.push({ action: a.type, fait: true, motif: 'Rappel inscrit.' });
      } else if (parWebhook && p.repondParWebhook) {
        faits.push({ action: a.type, fait: true, motif: 'Dans la réponse au webhook.' });
      } else if (a.type === 'decrocher') {
        await p.decrocher(appel.id_operateur); faits.push({ action: a.type, fait: true, motif: 'Décroché chez l’opérateur.' });
      } else if (a.type === 'transferer') {
        await p.transferer(appel.id_operateur, a.vers); faits.push({ action: a.type, fait: true, motif: `Transféré vers ${a.cible}.` });
      } else if (a.type === 'raccrocher') {
        await p.raccrocher(appel.id_operateur); faits.push({ action: a.type, fait: true, motif: 'Raccroché chez l’opérateur.' });
      } else if (ACTIONS_MEDIA.has(a.type)) {
        faits.push({ action: a.type, fait: false, motif: p.nom === 'twilio' ? 'Hors webhook, Twilio ne reçoit ce geste que par le pont média, absent.' : 'Demande le pont média (ou une commande d’opérateur non relevée) : non exécuté.' });
      }
    } catch (e) {
      faits.push({ action: a.type, fait: false, motif: e instanceof Error ? e.message : 'Échec.' });
    }
  }
  for (const f of faits) appel.journal.push({ quand: iso(maintenant), quoi: `${f.action} : ${f.motif}` });
  return faits;
}

/** TwiML answered to Twilio's webhook (verbs Say, Record, Pause, Dial, Sip, Hangup — NOT re-read 07/10/2026). */
export function twiml(actions: Action[]): string {
  const v: string[] = [];
  for (const a of actions) {
    if (a.type === 'dire') v.push(`<Say language="fr-FR">${echapperXml(a.texte)}</Say>`);
    else if (a.type === 'messagerie') v.push('<Record maxLength="120" playBeep="true"/>');
    else if (a.type === 'mettre_en_attente') v.push('<Pause length="60"/>');
    else if (a.type === 'transferer') v.push(a.vers.startsWith('sip') ? `<Dial><Sip>${echapperXml(a.vers)}</Sip></Dial>` : `<Dial>${echapperXml(a.vers)}</Dial>`);
    else if (a.type === 'raccrocher') v.push('<Hangup/>');
  }
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${v.join('')}</Response>`;
}

function contexteAppel(s: Stockage, std: Standard, appel: AppelVoix, maintenant: Date, exclure = true) {
  const actives = s.pourTenant(std.tenant_id).lister<AppelVoix>(C.appels, (a) => (!exclure || a.id !== appel.id) && ['conversation', 'handoff'].includes((a.etat as EtatAppel).etape)).length;
  return { standard: std, appelant: appel.appelant, maintenant, agent_au_telephone: config.pont_media, places_libres: admettre(actives, std.plafond_sessions).admis };
}

/** Applies one event to a stored call: transition, actions, queue bookkeeping, cost at the end. */
export async function appliquerEvenement(s: Stockage, tenant: string, appelId: string, ev: Evenement, maintenant: Date, parWebhook = false): Promise<{ t: Transition; faits: Fait[]; appel: AppelVoix } | null> {
  const vue = s.pourTenant(tenant);
  const appel = vue.lire<AppelVoix>(C.appels, appelId);
  if (!appel || !appel.standard_id) return null;
  const std = vue.lire<Standard>(C.standards, appel.standard_id);
  const p = operateur(appel.provider, config.env, config.basesTel);
  if (!std || !p) return null;
  const avant = appel.etat as EtatAppel;
  const t = transition(contexteAppel(s, std, appel, maintenant), avant, ev);
  appel.journal.push({ quand: iso(maintenant), quoi: `${ev.type} : ${t.motif}` });
  if (t.refuse) { vue.poser(C.appels, appel.id, appel); return { t, faits: [], appel }; }
  appel.etat = t.etat;
  const ext = std.extensions.find((e) => e.numero === t.etat.extension);
  if (ext) appel.agent_instance_id = ext.agent_instance_id;
  if (t.etat.resume) appel.resume = t.etat.resume;
  const faits = await executer(s, p, appel, t.actions, maintenant, parWebhook);

  // Queue bookkeeping
  if (t.etat.etape === 'attente' && t.etat.file_id) {
    const f = vue.lire<FileAttente>(C.files, t.etat.file_id);
    if (f) {
      const entree: EnFile = { appel_id: appel.id, tenant_id: tenant, file_id: f.id, priorite: f.priorite, depuis: iso(maintenant), appelant: appel.appelant };
      const r = enfiler(f, vue.lister<EnFile & { tenant_id: string }>(C.enFile).filter((x) => x.appel_id !== appel.id), entree);
      if (r.resultat === 'en-file') vue.poser(C.enFile, appel.id, entree);
      else {
        vue.poser(C.appels, appel.id, appel);
        appel.journal.push({ quand: iso(maintenant), quoi: r.motif });
        return appliquerEvenement(s, tenant, appel.id, { type: 'attente_depassee', vers: r.vers.type, file_id: r.vers.type === 'file' ? r.vers.file_id : undefined }, maintenant, parWebhook);
      }
    }
  } else s.retirer(C.enFile, appel.id);

  if (t.etat.etape === 'termine' && !appel.fin) {
    appel.fin = iso(maintenant);
    appel.duree_s = Math.max(0, Math.round((maintenant.getTime() - Date.parse(appel.debut)) / 1000));
    appel.issue = t.etat.issue ?? 'abandonne';
    const c = coutAppel({ duree_s: appel.duree_s, direction: appel.direction, provider: appel.provider, appele: appel.appele, voix: null, outils: [] });
    appel.cout_manquants = c.manquants;
    appel.cout = c.total === null ? null : { telephonie: c.telephonie!, voix: c.voix!, llm: c.llm!, outils: c.outils!, total: c.total, devise: c.devise };
    const h = vue.lire<Handoff>(C.handoffs, appel.id);
    if (h && h.statut === 'en-attente') vue.poser(C.handoffs, h.id, { ...h, statut: 'refuser', decide_le: iso(maintenant) });
  }
  vue.poser(C.appels, appel.id, appel);

  // A place freed: serve the next waiting call.
  const libere = ['conversation', 'handoff'].includes(avant.etape) && !['conversation', 'handoff'].includes(t.etat.etape);
  if (libere) {
    const prochain = suivant(vue.lister<FileAttente>(C.files), vue.lister<EnFile & { tenant_id: string }>(C.enFile));
    if (prochain) await appliquerEvenement(s, tenant, prochain.appel_id, { type: 'file_libre' }, maintenant);
  }
  return { t, faits, appel };
}

/** Calls that waited too long overflow as their queue says. Run lazily on each webhook and supervision read. */
export async function reveillerFiles(s: Stockage, tenant: string, maintenant: Date): Promise<number> {
  const vue = s.pourTenant(tenant);
  const trop = depasses(vue.lister<FileAttente>(C.files), vue.lister<EnFile & { tenant_id: string }>(C.enFile), maintenant);
  for (const { appel, file } of trop) {
    const d = file.debordement;
    await appliquerEvenement(s, tenant, appel.appel_id, { type: 'attente_depassee', vers: d.type, file_id: d.type === 'file' ? d.file_id : undefined }, maintenant);
  }
  return trop.length;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function entrant(ctx: Contexte): Promise<Reponse> {
  const p = operateur(ctx.params.provider, config.env, config.basesTel);
  if (!p) return refus(404, `Opérateur inconnu : « ${ctx.params.provider} ».`);
  const maintenant = ctx.maintenant();
  const req = { brut: ctx.brut, entetes: ctx.entetes, url: ctx.url, maintenant };
  const motif = p.verifier(req);
  if (motif) return refus(401, motif);
  let ev;
  try { ev = p.lire(req); } catch { return refus(400, 'Webhook illisible.'); }
  const repondre = (actions: Action[]): Reponse => (p.repondParWebhook ? { statut: 200, corps: twiml(actions), type: 'text/xml; charset=utf-8' } : ok({ recu: true }));
  const s = ctx.stockage;
  const existant = s.lister<AppelVoix>(C.appels, (a) => a.provider === p.nom && a.id_operateur === ev.id_operateur)[0];

  if (ev.type === 'appel-entrant') {
    if (existant) return repondre([]); // operator retry: already handled
    if (!ev.vers || !ev.de) return refus(400, 'Webhook sans numéro appelant ou appelé lisible.');
    const num = s.lister<PhoneNumber>(C.numeros, (n) => n.e164 === ev.vers && n.provider === p.nom && n.statut === 'actif')[0];
    if (!num) return refus(404, `Le numéro ${ev.vers} n’est rattaché à aucun client chez ${p.nom}.`);
    const std = num.routage_id ? s.pourTenant(num.tenant_id).lire<Standard>(C.standards, num.routage_id) : null;
    if (!std) return refus(409, `Le numéro ${ev.vers} n’a pas de standard : personne ne saurait prendre l’appel.`);
    await reveillerFiles(s, num.tenant_id, maintenant);
    const appel: AppelVoix = {
      id: randomUUID(), tenant_id: num.tenant_id, direction: 'entrant', appelant: ev.de, appele: ev.vers, agent_instance_id: null,
      debut: iso(maintenant), duree_s: 0, resume: null, consentement_enregistrement: false, issue: 'abandonne', cout: null,
      provider: p.nom, id_operateur: ev.id_operateur, standard_id: std.id, moteur_voix: null, etat: ETAT_INITIAL,
      journal: [], cout_manquants: [], enregistre: false, fin: null,
    };
    s.pourTenant(num.tenant_id).poser(C.appels, appel.id, appel);
    const r = await appliquerEvenement(s, num.tenant_id, appel.id, { type: 'entrant' }, maintenant, true);
    return repondre(r?.t.actions ?? []);
  }
  if (!existant) return repondre([]);
  if (ev.type === 'raccroche') {
    await appliquerEvenement(s, existant.tenant_id, existant.id, { type: 'raccroche' }, maintenant, true);
  } else {
    existant.journal.push({ quand: iso(maintenant), quoi: `opérateur : ${ev.quoi}` });
    s.pourTenant(existant.tenant_id).poser(C.appels, existant.id, existant);
  }
  return repondre([]);
}

async function decider(ctx: Contexte): Promise<Reponse> {
  const tenant = tenantBox(ctx); if (typeof tenant !== 'string') return tenant;
  const decision = String(corpsObjet(ctx).decision ?? '');
  if (!['prendre', 'refuser', 'rappeler', 'laisser'].includes(decision)) return refus(400, 'La décision est prendre, refuser, rappeler ou laisser.');
  const vue = ctx.stockage.pourTenant(tenant);
  const h = vue.lire<Handoff>(C.handoffs, ctx.params.appel);
  if (!h) return refus(404, 'Aucune demande de prise en main pour cet appel.');
  if (h.statut !== 'en-attente') return refus(409, `Cette demande a déjà reçu une réponse : ${h.statut}.`);
  const maintenant = ctx.maintenant();
  const r = await appliquerEvenement(ctx.stockage, tenant, h.appel_id, { type: 'decision', decision: decision as DecisionHandoff }, maintenant);
  if (!r) return refus(404, 'L’appel n’existe plus.');
  if (r.t.refuse) return refus(409, r.t.motif);
  const fait = { ...h, statut: decision as Handoff['statut'], decide_le: iso(maintenant) };
  vue.poser(C.handoffs, h.id, fait);
  return ok({ handoff: fait, etat: r.t.etat, motif: r.t.motif, actions: r.faits });
}

async function lancerCampagne(ctx: Contexte): Promise<Reponse> {
  const camp = ctx.stockage.lire<Campagne>(C.campagnes, ctx.params.id);
  if (!camp) return refus(404, 'Campagne inconnue.');
  const vue = ctx.stockage.pourTenant(camp.tenant_id);
  const maintenant = ctx.maintenant();
  const opposition = new Map(vue.lister<Opposition>(C.opposition).map((o) => [o.e164, o.liste]));
  const p = operateur(camp.provider, config.env, config.basesTel)!;
  const resultats: Campagne['lancements'][number]['resultats'] = [];
  for (const contact of camp.contacts) {
    const numero = normaliserE164(contact.e164) ?? contact.e164;
    const appels30 = vue.lister<AppelVoix>(C.appels, (a) => a.direction === 'sortant' && a.appele === numero && maintenant.getTime() - Date.parse(a.debut) < 30 * 86_400_000).length;
    const v = verifierContact({ contact, pays: camp.pays, fenetres: camp.fenetres, enregistrement_demande: camp.enregistrement, maintenant, opposition, appels_30_jours: appels30 });
    if (!v.autorise) { resultats.push({ e164: numero, statut: 'refuse', motif: v.motif }); continue; }
    const manque = p.indisponible();
    if (manque) { resultats.push({ e164: numero, statut: 'echec', motif: manque }); continue; }
    try {
      const { id_operateur } = await p.appeler({ de: camp.numero_appelant, vers: numero });
      const appel: AppelVoix = {
        id: randomUUID(), tenant_id: camp.tenant_id, direction: 'sortant', appelant: camp.numero_appelant, appele: numero, agent_instance_id: null,
        debut: iso(maintenant), duree_s: 0, resume: null, consentement_enregistrement: v.enregistrer, issue: 'abandonne', cout: null,
        provider: camp.provider, id_operateur, standard_id: null, moteur_voix: null, etat: { etape: 'sonne', extension: null, transferts: 0 },
        journal: [{ quand: iso(maintenant), quoi: `campagne ${camp.id} : ${v.note}` }], cout_manquants: [], enregistre: v.enregistrer, fin: null,
      };
      vue.poser(C.appels, appel.id, appel);
      resultats.push({ e164: numero, statut: 'appele', motif: v.note, appel_id: appel.id });
    } catch (e) {
      resultats.push({ e164: numero, statut: 'echec', motif: e instanceof Error ? e.message : 'Échec.' });
    }
  }
  camp.lancements.push({ quand: iso(maintenant), resultats });
  vue.poser(C.campagnes, camp.id, camp);
  return ok({ campagne: camp.id, resultats });
}

function consommation(ctx: Contexte): Reponse {
  const tenant = tenantBox(ctx); if (typeof tenant !== 'string') return tenant;
  const vue = ctx.stockage.pourTenant(tenant);
  const mois = ctx.maintenant().toISOString().slice(0, 7);
  const appels = vue.lister<AppelVoix>(C.appels, (a) => a.debut.startsWith(mois));
  const somme = { telephonie: 0, voix: 0, llm: 0, outils: 0, total: 0 };
  const manquants = new Set<string>();
  let sansCout = 0;
  for (const a of appels) {
    if (a.cout) for (const k of Object.keys(somme) as (keyof typeof somme)[]) somme[k] += a.cout[k];
    else if (a.fin) { sansCout++; a.cout_manquants.forEach((m) => manquants.add(m)); }
  }
  const numeros = ctx.stockage.lister<PhoneNumber>(C.numeros, (n) => n.tenant_id === tenant && n.statut === 'actif');
  let abonnement: number | null = 0;
  for (const n of numeros) {
    const t = (taux.telephonie as Record<string, { numero_mois: { valeur: number } | null }>)[n.provider]?.numero_mois;
    if (t && abonnement !== null) abonnement += t.valeur; else { abonnement = null; manquants.add(`abonnement du numéro ${n.provider} non relevé`); }
  }
  const r = (x: number) => Math.round(x * 1e4) / 1e4;
  return ok({
    mois,
    appels: appels.length,
    minutes_entrantes: r(appels.filter((a) => a.direction === 'entrant').reduce((x, a) => x + a.duree_s, 0) / 60),
    minutes_sortantes: r(appels.filter((a) => a.direction === 'sortant').reduce((x, a) => x + a.duree_s, 0) / 60),
    cout: { telephonie: r(somme.telephonie), voix: r(somme.voix), llm: r(somme.llm), outils: r(somme.outils), total: r(somme.total), devise: taux.devise },
    appels_sans_cout: sansCout,
    numeros: numeros.length,
    abonnement_numeros: abonnement === null ? null : r(abonnement),
    manquants: [...manquants],
  });
}

export const routes: Route[] = [
  {
    methode: 'PUT', chemin: '/voix/profils/:id', acces: 'admin',
    traiter: (ctx) => {
      const p = { ...(corpsObjet(ctx) as unknown as VoiceProfile), id: ctx.params.id };
      const m = profilInvalide(p); if (m) return refus(400, m);
      return ok(ctx.stockage.poser(C.profils, p.id, p));
    },
  },
  {
    methode: 'GET', chemin: '/voix/box/session', acces: 'box',
    traiter: (ctx) => {
      const tenant = tenantBox(ctx); if (typeof tenant !== 'string') return tenant;
      const persona = ctx.query.get('persona') ?? '';
      const profil = ctx.stockage.lister<VoiceProfile>(C.profils, (p) => p.persona_id === persona)[0];
      if (!profil) return refus(404, `Aucun profil vocal pour la persona « ${persona} ».`);
      const mode = (ctx.query.get('mode') ?? 'balanced') as ModeVoix;
      if (!MODES.includes(mode)) return refus(400, `Mode inconnu : ${mode}. Connus : ${MODES.join(', ')}.`);
      const canal = (ctx.query.get('canal') ?? 'desktop') as Canal;
      if (!['desktop', 'telephone', 'support'].includes(canal)) return refus(400, 'Le canal est desktop, telephone ou support.');
      const choix = choisirMoteur({ profil, mode, langue: ctx.query.get('langue') ?? profil.locale, canal, disponibilite: disponibilites({ env: config.env, bases: config.basesVoix, cerveau: config.cerveau }) });
      return ok({ persona, profil: profil.id, ...choix });
    },
  },
  {
    methode: 'POST', chemin: '/voix/numeros', acces: 'admin',
    traiter: (ctx) => {
      const b = corpsObjet(ctx);
      const tenant = String(b.tenant_id ?? ''); const provider = String(b.provider ?? '');
      if (!tenant) return refus(400, 'Le numéro doit nommer son client (tenant_id).');
      if (!PROVIDERS_TEL.includes(provider as PhoneNumber['provider'])) return refus(400, 'L’opérateur est telnyx, twilio ou sip.');
      if (b.e164 === undefined || b.e164 === null || b.e164 === '') {
        return refus(501, 'La plateforme n’achète pas de numéro : achetez-le dans le compte de l’opérateur, puis déclarez-le ici avec son e164.');
      }
      const e164 = normaliserE164(b.e164);
      if (!e164) return refus(400, `« ${String(b.e164)} » n’est pas un numéro E.164 (+ indicatif pays, 15 chiffres au plus).`);
      if (ctx.stockage.lire(C.numeros, e164)) return refus(409, `Le numéro ${e164} est déjà déclaré.`);
      const routage = b.routage_id ? String(b.routage_id) : null;
      if (routage && !ctx.stockage.pourTenant(tenant).lire(C.standards, routage)) return refus(400, `Le standard ${routage} n’existe pas pour ce client.`);
      const n: PhoneNumber = { e164, tenant_id: tenant, provider: provider as PhoneNumber['provider'], statut: 'actif', routage_id: routage };
      return ok(ctx.stockage.pourTenant(tenant).poser(C.numeros, e164, n), 201);
    },
  },
  {
    methode: 'GET', chemin: '/voix/numeros', acces: 'admin',
    traiter: (ctx) => {
      const t = ctx.query.get('tenant_id');
      return ok({ numeros: ctx.stockage.lister<PhoneNumber>(C.numeros, (n) => !t || n.tenant_id === t) });
    },
  },
  {
    methode: 'PUT', chemin: '/voix/standards/:id', acces: 'admin',
    traiter: (ctx) => {
      const s = { ...(corpsObjet(ctx) as unknown as Standard), id: ctx.params.id };
      const m = standardInvalide(s); if (m) return refus(400, m);
      if (s.file_id && !ctx.stockage.pourTenant(s.tenant_id).lire(C.files, s.file_id)) return refus(400, `La file ${s.file_id} n’existe pas pour ce client.`);
      return ok(ctx.stockage.pourTenant(s.tenant_id).poser(C.standards, s.id, s));
    },
  },
  { methode: 'POST', chemin: '/voix/fournisseurs/:provider/entrant', acces: 'public', traiter: entrant },
  {
    methode: 'GET', chemin: '/voix/appels', acces: 'admin',
    traiter: async (ctx) => {
      const t = ctx.query.get('tenant_id');
      if (!t) return refus(400, 'Précisez le client : ?tenant_id=');
      await reveillerFiles(ctx.stockage, t, ctx.maintenant());
      const vue = ctx.stockage.pourTenant(t);
      const appels = vue.lister<AppelVoix>(C.appels).sort((a, b) => b.debut.localeCompare(a.debut));
      return ok({
        appels,
        en_cours: appels.filter((a) => !a.fin).map((a) => ({ id: a.id, appelant: a.appelant, etape: (a.etat as EtatAppel).etape, depuis: a.debut })),
        files: vue.lister<FileAttente>(C.files).map((f) => ({ ...f, en_attente: vue.lister<EnFile & { tenant_id: string }>(C.enFile, (e) => e.file_id === f.id) })),
      });
    },
  },
  {
    methode: 'GET', chemin: '/voix/box/appels', acces: 'box',
    traiter: (ctx) => {
      const tenant = tenantBox(ctx); if (typeof tenant !== 'string') return tenant;
      const appels = ctx.stockage.pourTenant(tenant).lister<AppelVoix>(C.appels).sort((a, b) => b.debut.localeCompare(a.debut));
      return ok({ appels: appels.map(({ journal: _j, etat: _e, id_operateur: _i, ...reste }) => reste) });
    },
  },
  {
    methode: 'GET', chemin: '/voix/box/handoffs', acces: 'box',
    traiter: (ctx) => {
      const tenant = tenantBox(ctx); if (typeof tenant !== 'string') return tenant;
      return ok({ handoffs: ctx.stockage.pourTenant(tenant).lister<Handoff>(C.handoffs, (h) => h.statut === 'en-attente') });
    },
  },
  { methode: 'POST', chemin: '/voix/box/handoffs/:appel', acces: 'box', traiter: decider },
  {
    methode: 'PUT', chemin: '/voix/files/:id', acces: 'admin',
    traiter: (ctx) => {
      const f = { ...(corpsObjet(ctx) as unknown as FileAttente), id: ctx.params.id };
      const m = fileInvalide(f); if (m) return refus(400, m);
      if (f.debordement.type === 'file' && !ctx.stockage.pourTenant(f.tenant_id).lire(C.files, f.debordement.file_id)) return refus(400, `La file de débordement ${f.debordement.file_id} n’existe pas.`);
      return ok(ctx.stockage.pourTenant(f.tenant_id).poser(C.files, f.id, f));
    },
  },
  {
    methode: 'POST', chemin: '/voix/campagnes', acces: 'admin',
    traiter: (ctx) => {
      const b = corpsObjet(ctx) as Partial<Campagne> & { opposition?: { e164: string; liste: string }[] };
      const m = campagneInvalide(b); if (m) return refus(400, m);
      const tenant = b.tenant_id!;
      const vue = ctx.stockage.pourTenant(tenant);
      const maintenant = ctx.maintenant();
      for (const o of b.opposition ?? []) {
        const e = normaliserE164(o.e164);
        if (!e) return refus(400, `Liste d’opposition : « ${o.e164} » n’est pas un numéro E.164.`);
        vue.poser<Opposition>(C.opposition, `${tenant}:${e}`, { id: `${tenant}:${e}`, tenant_id: tenant, e164: e, liste: String(o.liste || 'interne'), depuis: iso(maintenant) });
      }
      const c: Campagne = {
        id: randomUUID(), tenant_id: tenant, pays: b.pays!, provider: b.provider!, numero_appelant: normaliserE164(b.numero_appelant)!,
        source_consentement: b.source_consentement!, fenetres: b.fenetres ?? [], enregistrement: b.enregistrement === true,
        contacts: b.contacts!, cree_le: iso(maintenant), lancements: [],
      };
      return ok(vue.poser(C.campagnes, c.id, c), 201);
    },
  },
  { methode: 'POST', chemin: '/voix/campagnes/:id/lancer', acces: 'admin', traiter: lancerCampagne },
  { methode: 'GET', chemin: '/voix/box/consommation', acces: 'box', traiter: consommation },
];
