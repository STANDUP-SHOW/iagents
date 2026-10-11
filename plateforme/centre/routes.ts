// Routes of the internal call centre (`centre.ts` holds the business logic).
//
// Channels, and how each one is trusted:
//  - WhatsApp Cloud API: Meta pushes to /centre/whatsapp, signed with the app
//    secret over the RAW bytes (`signatureValide` from relais/serveur.ts — the
//    same check the client relay uses, not a second copy). The answer leaves by
//    POST {graph}/v21.0/{phone number id}/messages, the version
//    desktop/src-tauri/src/whatsapp.rs already speaks.
//  - Twilio Programmable Voice: the number's voice webhook is
//    /centre/telephone/entrant; each turn is a TwiML <Gather input="speech">,
//    so Twilio hears and speaks and the platform only thinks. Every webhook is
//    checked with the Twilio adapter of the voice module (`twilio().verifier`).
//    TwiML read in https://www.twilio.com/docs/voice/twiml/gather (speech input,
//    `language`, `speechTimeout="auto"`, `actionOnEmptyResult`, `SpeechResult`)
//    and https://www.twilio.com/docs/voice/twiml/dial (`action`, `timeout`,
//    `DialCallStatus`) — from memory of those pages, not re-read in this
//    session: the first real call confirms them.
//
// The back-office (admin secret) reads the journal, takes over a WhatsApp
// conversation, records consents and places outbound calls — the only door to
// an outbound call is `peutAppeler`, the same rules as the client campaigns.

import { Buffer } from 'node:buffer';
import { memeSecret, ok, refus, type Contexte, type Reponse, type Route } from '../http.ts';
import type { Stockage } from '../stockage.ts';
import { depouillerEntrant, signatureValide } from '../../relais/meta.ts';
import { cle, type Env } from '../voix/cles.ts';
import { BASES_OFFICIELLES as BASES_VOIX, CerveauAnthropic, type Cerveau } from '../voix/fournisseurs-voix.ts';
import { BASES_OFFICIELLES as BASES_TEL, echapperXml, normaliserE164, twilio, type Bases as BasesTel } from '../voix/telephonie.ts';
import {
  ajouterTour, C, contactDe, demandeArret, fenetreWhatsAppOuverte, humainJoignable, nouvelleConversation, peutAppeler,
  poserConsentement, purger, REGLAGES, retirerConsentement, tourAgent,
  type Contact, type Conversation, type RendezVous, type ResultatTour,
} from './centre.ts';
import { CONSOLE } from './console.ts';

export const VERSION_GRAPH = 'v21.0';

export type ConfigCentre = { env: Env; graph: string; basesTel: BasesTel; anthropic: string; cerveau: Cerveau | null };
let config: ConfigCentre = { env: process.env, graph: 'https://graph.facebook.com', basesTel: BASES_TEL, anthropic: BASES_VOIX.anthropic, cerveau: null };
/** The bench points every adapter at local fakes and gives a scripted brain; production keeps the official addresses. */
export function configurerCentre(c: Partial<ConfigCentre>): void { config = { ...config, ...c }; }

// ---------------------------------------------------------------------------
// What is switched on, said in French with the names of what is missing
// ---------------------------------------------------------------------------

const VARIABLES_CENTRE = {
  META_APP_SECRET: 'le secret de l’application Meta',
  META_VERIFY_TOKEN: 'le mot de vérification du webhook Meta',
  WHATSAPP_JETON: 'le jeton d’accès du numéro WhatsApp Business',
  WHATSAPP_NUMERO_ID: 'l’identifiant du numéro WhatsApp Business',
  TWILIO_ACCOUNT_SID: 'l’identifiant de compte Twilio',
  TWILIO_AUTH_TOKEN: 'le jeton d’authentification Twilio',
  VOIX_URL_PUBLIQUE: 'l’adresse publique de la plateforme (https://…)',
  CENTRE_NUMERO: 'le numéro de téléphone du centre chez Twilio',
  CENTRE_NUMERO_HUMAIN: 'le numéro du conseiller qui reçoit les transferts',
  ANTHROPIC_API_KEY: 'la clé du modèle de langage (Anthropic)',
} as const;
type VariableCentre = keyof typeof VARIABLES_CENTRE;

const lire = (n: VariableCentre): string | null => (config.env[n] ?? '').trim() || null;
function manque(noms: VariableCentre[]): string | null {
  const absentes = noms.filter((n) => !lire(n));
  return absentes.length ? `il manque ${absentes.map((n) => `${VARIABLES_CENTRE[n]} (${n})`).join(', ')}` : null;
}

export function etatCanaux(): Record<'cerveau' | 'whatsapp' | 'telephone' | 'appels_sortants' | 'transfert', string | null> {
  return {
    cerveau: config.cerveau ? null : manque(['ANTHROPIC_API_KEY']),
    whatsapp: manque(['META_APP_SECRET', 'META_VERIFY_TOKEN', 'WHATSAPP_JETON', 'WHATSAPP_NUMERO_ID']),
    telephone: manque(['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'VOIX_URL_PUBLIQUE']),
    appels_sortants: manque(['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'VOIX_URL_PUBLIQUE', 'CENTRE_NUMERO']),
    transfert: manque(['CENTRE_NUMERO_HUMAIN']),
  };
}

function cerveau(): Cerveau | null {
  if (config.cerveau) return config.cerveau;
  const k = cle('anthropic', config.env);
  return k ? new CerveauAnthropic(k, config.anthropic) : null;
}

// ---------------------------------------------------------------------------
// One conversation at a time: two messages a second apart must not run two
// turns over the same document, the second would erase the first.
// ---------------------------------------------------------------------------

const files = new Map<string, Promise<unknown>>();
function enFile<T>(id: string, travail: () => Promise<T>): Promise<T> {
  const avant = files.get(id) ?? Promise.resolve();
  const suite = avant.then(travail, travail);
  const garde = suite.catch(() => {});
  files.set(id, garde);
  void garde.then(() => { if (files.get(id) === garde) files.delete(id); });
  return suite;
}
/** The bench waits for what the webhooks left running. */
export async function travauxEnCours(): Promise<void> {
  while (files.size) await Promise.all([...files.values()]);
}

const lireConv = (s: Stockage, id: string) => s.lire<Conversation>(C.conversations, id);
const ecrireConv = (s: Stockage, c: Conversation) => s.poser(C.conversations, c.id, c);
const corpsObjet = (ctx: Contexte): Record<string, unknown> => (ctx.corps && typeof ctx.corps === 'object' ? ctx.corps as Record<string, unknown> : {});

async function tourSur(s: Stockage, c: Conversation, maintenant: Date): Promise<ResultatTour | null> {
  const b = cerveau();
  if (!b) return null;
  try {
    return await tourAgent(s, c, b, maintenant);
  } catch (e) {
    ajouterTour(c, 'systeme', `L’assistante n’a pas pu répondre : ${(e as Error).message}`, maintenant);
    return null;
  }
}

// ---------------------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------------------

async function envoyerWhatsApp(vers: string, texte: string): Promise<string | null> {
  const m = manque(['WHATSAPP_JETON', 'WHATSAPP_NUMERO_ID']);
  if (m) return `Message non envoyé : ${m}.`;
  try {
    const r = await fetch(`${config.graph}/${VERSION_GRAPH}/${encodeURIComponent(lire('WHATSAPP_NUMERO_ID')!)}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${lire('WHATSAPP_JETON')}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: vers.replace(/^\+/, ''), type: 'text', text: { preview_url: false, body: texte } }),
      signal: AbortSignal.timeout(15_000),
    });
    if (r.status === 401 || r.status === 403) return 'Meta refuse le jeton WhatsApp : message non envoyé.';
    if (!r.ok) return `Meta a refusé le message (code ${r.status}) : non envoyé.`;
    return null;
  } catch {
    return 'Meta est injoignable : message non envoyé.';
  }
}

/** Sends, and writes in the journal what really happened — a reply that did not leave is never shown as said. */
async function repondreWhatsApp(c: Conversation, qui: 'agent' | 'humain', texte: string, maintenant: Date): Promise<boolean> {
  const echec = await envoyerWhatsApp(c.contact, texte);
  if (echec) {
    ajouterTour(c, 'systeme', `${echec} Texte prévu : « ${texte} »`, maintenant);
    // A previous request already handled must not hide this one: the person is left without an answer.
    if (c.transfert?.statut !== 'a-traiter') c.transfert = { motif: 'réponse non envoyée', resume: echec, le: maintenant.toISOString(), statut: 'a-traiter' };
    return false;
  }
  ajouterTour(c, qui, texte, maintenant);
  return true;
}

async function traiterMessageWhatsApp(s: Stockage, m: { de: string; nom: string; texte: string; recu_le: string }, maintenant: Date): Promise<void> {
  const contact = normaliserE164(`+${m.de}`);
  if (!contact) return;
  const id = `wa-${contact}`;
  await enFile(id, async () => {
    const c = lireConv(s, id) ?? nouvelleConversation({ id, canal: 'whatsapp', sens: 'entrant', contact, nom: m.nom !== m.de ? m.nom : '' }, maintenant);
    const cleMessage = `${m.recu_le}|${m.texte}`;
    if (c.vus.includes(cleMessage)) return;
    c.vus = [...c.vus, cleMessage].slice(-100);
    if (c.etat === 'terminee') c.etat = 'agent';
    ajouterTour(c, 'contact', m.texte, maintenant);
    const fiche = contactDe(s, contact, c.nom);
    if (!s.lire<Contact>(C.contacts, contact)) s.poser(C.contacts, contact, fiche);

    if (demandeArret(m.texte)) {
      retirerConsentement(s, contact, maintenant);
      await repondreWhatsApp(c, 'agent', 'C’est noté : vous ne recevrez plus aucun message ni appel de notre part.', maintenant);
      c.etat = 'terminee';
      ecrireConv(s, c);
      return;
    }
    if (c.etat === 'humain') { ecrireConv(s, c); return; }

    const r = await tourSur(s, c, maintenant);
    if (!r) {
      c.etat = 'humain';
      c.transfert = { motif: 'assistante indisponible', resume: etatCanaux().cerveau ?? 'le modèle de langage n’a pas répondu', le: maintenant.toISOString(), statut: 'a-traiter' };
      await repondreWhatsApp(c, 'agent', 'Bonjour, votre message est bien reçu. Un conseiller d’iAgent Tech vous répond ici même.', maintenant);
      ecrireConv(s, c);
      return;
    }
    await repondreWhatsApp(c, 'agent', r.texte, maintenant);
    if (r.effet.transfert) { c.transfert = r.effet.transfert; c.etat = 'humain'; }
    else if (r.effet.terminer) c.etat = 'terminee';
    ecrireConv(s, c);
  });
}

function verifierMeta(ctx: Contexte): Reponse {
  const mot = lire('META_VERIFY_TOKEN');
  if (!mot) return refus(503, `WhatsApp n’est pas branché : ${manque(['META_VERIFY_TOKEN'])}.`);
  const q = ctx.query;
  if (q.get('hub.mode') !== 'subscribe' || !memeSecret(mot, q.get('hub.verify_token') ?? '')) return refus(403, 'Vérification refusée.');
  return { statut: 200, corps: q.get('hub.challenge') ?? '', type: 'text/plain; charset=utf-8' };
}

function recevoirWhatsApp(ctx: Contexte): Reponse {
  const secret = lire('META_APP_SECRET');
  if (!secret) return refus(503, `WhatsApp n’est pas branché : ${manque(['META_APP_SECRET'])}.`);
  // The platform hands the body over as UTF-8 text; re-encoding valid UTF-8 gives back the exact bytes Meta signed.
  if (!signatureValide(Buffer.from(ctx.brut, 'utf8'), ctx.entetes['x-hub-signature-256'], secret)) return refus(401, 'Signature Meta invalide.');
  let charge: unknown;
  try { charge = JSON.parse(ctx.brut); } catch { return refus(400, 'Charge illisible.'); }
  const messages = depouillerEntrant(charge);
  const maintenant = ctx.maintenant();
  // Meta wants its 200 within seconds; the model may take longer, so the turn runs after the answer.
  ctx.differer((async () => {
    purger(ctx.stockage, maintenant);
    for (const m of messages) await traiterMessageWhatsApp(ctx.stockage, m, maintenant);
  })());
  return { statut: 200, corps: 'EVENT_RECEIVED', type: 'text/plain; charset=utf-8' };
}

// ---------------------------------------------------------------------------
// Telephone (Twilio, TwiML)
// ---------------------------------------------------------------------------

const base = () => (lire('VOIX_URL_PUBLIQUE') ?? '').replace(/\/$/, '');
function twiml(corps: string): Reponse {
  return { statut: 200, corps: `<?xml version="1.0" encoding="UTF-8"?><Response>${corps}</Response>`, type: 'text/xml; charset=utf-8' };
}
const dire = (texte: string) => `<Say language="${REGLAGES.langue}" voice="${echapperXml(REGLAGES.voix_twilio)}">${echapperXml(texte)}</Say>`;
const ecouter = (texte: string) =>
  `<Gather input="speech" language="${REGLAGES.langue}" speechTimeout="auto" timeout="${REGLAGES.telephone.attente_parole_secondes}" actionOnEmptyResult="true" action="${echapperXml(`${base()}/centre/telephone/tour`)}" method="POST">${dire(texte)}</Gather>`;
const raccrocher = (texte: string) => `${dire(texte)}<Hangup/>`;

function transfererOuRappeler(c: Conversation, texte: string, maintenant: Date): Reponse {
  const humain = lire('CENTRE_NUMERO_HUMAIN');
  if (humain && humainJoignable(maintenant)) {
    c.transfert!.statut = 'en-ligne';
    const appelant = lire('CENTRE_NUMERO');
    return twiml(`${dire(texte)}<Dial timeout="${REGLAGES.transfert.sonnerie_secondes}"${appelant ? ` callerId="${echapperXml(appelant)}"` : ''} action="${echapperXml(`${base()}/centre/telephone/apres-transfert`)}" method="POST">${echapperXml(humain)}</Dial>`);
  }
  ajouterTour(c, 'systeme', humain ? 'Hors des heures de transfert : rappel à faire.' : `Transfert impossible : ${manque(['CENTRE_NUMERO_HUMAIN'])}. Rappel à faire.`, maintenant);
  return twiml(`${dire(texte)}${raccrocher('Aucun conseiller ne peut prendre l’appel en ce moment. Votre demande est notée et un conseiller vous rappelle. Au revoir.')}`);
}

function verifierTwilio(ctx: Contexte): Reponse | URLSearchParams {
  const m = manque(['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'VOIX_URL_PUBLIQUE']);
  if (m) return refus(503, `Le téléphone n’est pas branché : ${m}.`);
  const motif = twilio(config.env, config.basesTel).verifier({ brut: ctx.brut, entetes: ctx.entetes, url: ctx.url, maintenant: ctx.maintenant() });
  return motif ? refus(401, motif) : new URLSearchParams(ctx.brut);
}

const ACCUEIL_ENTRANT = () =>
  `Bonjour, vous êtes chez ${REGLAGES.societe}. Je suis ${REGLAGES.prenom}, l’assistante virtuelle : une intelligence artificielle. Notre échange est transcrit par écrit pour être traité. Que puis-je faire pour vous ?`;

async function appelEntrant(ctx: Contexte): Promise<Reponse> {
  const p = verifierTwilio(ctx);
  if (!(p instanceof URLSearchParams)) return p;
  const s = ctx.stockage; const maintenant = ctx.maintenant();
  purger(s, maintenant);
  const sid = p.get('CallSid') ?? '';
  const contact = normaliserE164(p.get('From')) ?? (p.get('From') || 'inconnu');
  return enFile(`tel-${sid}`, async () => {
    const c = lireConv(s, `tel-${sid}`) ?? nouvelleConversation({ id: `tel-${sid}`, canal: 'telephone', sens: 'entrant', contact, id_operateur: sid }, maintenant);
    if (!s.lire<Contact>(C.contacts, contact) && contact.startsWith('+')) s.poser(C.contacts, contact, contactDe(s, contact));
    if (!cerveau()) {
      c.transfert = { motif: 'assistante indisponible', resume: etatCanaux().cerveau ?? '', le: maintenant.toISOString(), statut: 'a-traiter' };
      const r = transfererOuRappeler(c, `Bonjour, vous êtes chez ${REGLAGES.societe}.`, maintenant);
      ecrireConv(s, c);
      return r;
    }
    const accueil = ACCUEIL_ENTRANT();
    ajouterTour(c, 'agent', accueil, maintenant);
    ecrireConv(s, c);
    return twiml(ecouter(accueil));
  });
}

async function appelSortantDecroche(ctx: Contexte): Promise<Reponse> {
  const p = verifierTwilio(ctx);
  if (!(p instanceof URLSearchParams)) return p;
  const s = ctx.stockage; const maintenant = ctx.maintenant();
  const sid = p.get('CallSid') ?? '';
  return enFile(`tel-${sid}`, async () => {
    const c = lireConv(s, `tel-${sid}`);
    if (!c) return twiml('<Hangup/>');
    const accueil = `Bonjour${c.nom ? ` ${c.nom}` : ''}, ici ${REGLAGES.prenom}, l’assistante virtuelle d’${REGLAGES.societe} : une intelligence artificielle. Je vous appelle comme vous l’avez accepté, au sujet de ${c.objet ?? 'votre demande'}. Notre échange est transcrit par écrit, et vous pouvez me dire à tout moment que vous ne souhaitez plus être appelé. Est-ce un bon moment ?`;
    ajouterTour(c, 'agent', accueil, maintenant);
    ecrireConv(s, c);
    return twiml(ecouter(accueil));
  });
}

async function tourTelephone(ctx: Contexte): Promise<Reponse> {
  const p = verifierTwilio(ctx);
  if (!(p instanceof URLSearchParams)) return p;
  const s = ctx.stockage; const maintenant = ctx.maintenant();
  const sid = p.get('CallSid') ?? '';
  return enFile(`tel-${sid}`, async () => {
    const c = lireConv(s, `tel-${sid}`);
    if (!c) return twiml(raccrocher('Pardon, je ne retrouve pas cet appel. Merci de rappeler.'));
    const entendu = (p.get('SpeechResult') ?? '').trim();
    if (!entendu) {
      c.silences += 1;
      const fin = c.silences >= REGLAGES.telephone.silences_avant_fin;
      if (fin) c.etat = 'terminee';
      const texte = fin ? 'Je ne vous entends pas. N’hésitez pas à rappeler ou à nous écrire sur WhatsApp. Au revoir.' : 'Pardon, je ne vous ai pas entendu. Pouvez-vous répéter ?';
      ajouterTour(c, 'agent', texte, maintenant);
      ecrireConv(s, c);
      return twiml(fin ? raccrocher(texte) : ecouter(texte));
    }
    c.silences = 0;
    ajouterTour(c, 'contact', entendu, maintenant);
    const r = await tourSur(s, c, maintenant);
    if (!r) {
      c.transfert = { motif: 'assistante indisponible', resume: 'le modèle de langage n’a pas répondu', le: maintenant.toISOString(), statut: 'a-traiter' };
      const rep = transfererOuRappeler(c, 'Pardon, je rencontre un problème. Je vous passe un conseiller.', maintenant);
      ecrireConv(s, c);
      return rep;
    }
    ajouterTour(c, 'agent', r.texte, maintenant);
    let rep: Reponse;
    if (r.effet.transfert) { c.transfert = r.effet.transfert; c.etat = 'humain'; rep = transfererOuRappeler(c, r.texte, maintenant); }
    else if (r.effet.terminer) { c.etat = 'terminee'; rep = twiml(raccrocher(r.texte)); }
    else rep = twiml(ecouter(r.texte));
    ecrireConv(s, c);
    return rep;
  });
}

async function apresTransfert(ctx: Contexte): Promise<Reponse> {
  const p = verifierTwilio(ctx);
  if (!(p instanceof URLSearchParams)) return p;
  const s = ctx.stockage; const maintenant = ctx.maintenant();
  const sid = p.get('CallSid') ?? '';
  return enFile(`tel-${sid}`, async () => {
    const c = lireConv(s, `tel-${sid}`);
    if (!c) return twiml('<Hangup/>');
    const reussi = p.get('DialCallStatus') === 'completed';
    if (c.transfert) c.transfert.statut = reussi ? 'traite' : 'a-traiter';
    c.etat = 'terminee';
    ajouterTour(c, 'systeme', reussi ? 'Le conseiller a pris l’appel.' : `Personne n’a décroché (${p.get('DialCallStatus') ?? 'inconnu'}) : rappel à faire.`, maintenant);
    ecrireConv(s, c);
    return twiml(reussi ? '<Hangup/>' : raccrocher('Personne n’a pu décrocher. Votre demande est notée et un conseiller vous rappelle. Au revoir.'));
  });
}

// ---------------------------------------------------------------------------
// Back-office
// ---------------------------------------------------------------------------

function etat(ctx: Contexte): Reponse {
  const s = ctx.stockage; const maintenant = ctx.maintenant();
  const purgees = purger(s, maintenant);
  const conversations = s.lister<Conversation>(C.conversations).sort((a, b) => b.maj_le.localeCompare(a.maj_le));
  return ok({
    canaux: etatCanaux(),
    // Set only by demonstration.ts: the console then says that the providers are simulated.
    demonstration: (config.env.CENTRE_DEMONSTRATION ?? '') === '1',
    reglages: { prenom: REGLAGES.prenom, societe: REGLAGES.societe, conservation_jours: REGLAGES.conservation_jours },
    a_traiter: conversations.filter((c) => c.transfert?.statut === 'a-traiter').map((c) => c.id),
    rendez_vous: s.lister<RendezVous>(C.rendezVous, (r) => r.statut === 'confirme' && r.fin >= maintenant.toISOString()).sort((a, b) => a.debut.localeCompare(b.debut)),
    conversations: conversations.slice(0, 200),
    contacts: s.lister<Contact>(C.contacts).sort((a, b) => a.e164.localeCompare(b.e164)),
    purgees,
  });
}

async function repondreHumain(ctx: Contexte): Promise<Reponse> {
  const s = ctx.stockage; const maintenant = ctx.maintenant();
  const texte = typeof corpsObjet(ctx).texte === 'string' ? (corpsObjet(ctx).texte as string).trim() : '';
  if (!texte) return refus(400, 'Écrivez la réponse.');
  const id = ctx.params.id;
  return enFile(id, async () => {
    const c = lireConv(s, id);
    if (!c) return refus(404, 'Conversation introuvable.');
    if (c.canal !== 'whatsapp') return refus(409, 'Au téléphone, on ne répond pas par écrit : rappelez la personne.');
    if (!fenetreWhatsAppOuverte(c, maintenant)) {
      return refus(409, 'Le dernier message de cette personne date de plus de 24 heures : WhatsApp n’autorise plus qu’un modèle de message approuvé par Meta. Appelez-la ou écrivez-lui par e-mail.');
    }
    const parti = await repondreWhatsApp(c, 'humain', texte, maintenant);
    c.etat = 'humain';
    if (parti && c.transfert?.statut === 'a-traiter') c.transfert.statut = 'traite';
    ecrireConv(s, c);
    return parti ? ok({ conversation: c }) : refus(502, c.tours[c.tours.length - 1].texte);
  });
}

function rendreALAgent(ctx: Contexte): Promise<Reponse> {
  const s = ctx.stockage; const id = ctx.params.id;
  return enFile(id, async () => {
    const c = lireConv(s, id);
    if (!c) return refus(404, 'Conversation introuvable.');
    c.etat = 'agent';
    if (c.transfert?.statut === 'a-traiter') c.transfert.statut = 'traite';
    ajouterTour(c, 'systeme', 'Conversation rendue à l’assistante.', ctx.maintenant());
    ecrireConv(s, c);
    return ok({ conversation: c });
  });
}

function marquerTraite(ctx: Contexte): Promise<Reponse> {
  const s = ctx.stockage; const id = ctx.params.id;
  return enFile(id, async () => {
    const c = lireConv(s, id);
    if (!c) return refus(404, 'Conversation introuvable.');
    if (c.transfert) c.transfert.statut = 'traite';
    ajouterTour(c, 'systeme', 'Demande traitée par un conseiller.', ctx.maintenant());
    ecrireConv(s, c);
    return ok({ conversation: c });
  });
}

function consentement(ctx: Contexte): Reponse {
  const r = poserConsentement(ctx.stockage, corpsObjet(ctx), ctx.maintenant());
  return typeof r === 'string' ? refus(400, r) : ok({ contact: r });
}

async function appeler(ctx: Contexte): Promise<Reponse> {
  const s = ctx.stockage; const maintenant = ctx.maintenant();
  const b = corpsObjet(ctx);
  const e164 = normaliserE164(b.e164);
  if (!e164) return refus(400, 'Le numéro n’est pas lisible : écrivez-le avec l’indicatif, par exemple +33612345678.');
  const objet = typeof b.objet === 'string' && b.objet.trim() ? b.objet.trim().slice(0, 200) : '';
  if (!objet) return refus(400, 'Dites l’objet de l’appel : l’assistante l’annonce en premier.');
  const verdict = peutAppeler(s, e164, maintenant);
  if (!verdict.autorise) return refus(409, `Appel refusé : ${verdict.motif}`);
  const m = manque(['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'VOIX_URL_PUBLIQUE', 'CENTRE_NUMERO']);
  if (m) return refus(503, `Appel impossible : ${m}. Rien n’est parti.`);
  if (!cerveau()) return refus(503, `Appel impossible : ${etatCanaux().cerveau}. Rien n’est parti.`);

  const sidCompte = lire('TWILIO_ACCOUNT_SID')!;
  let sid: string | undefined;
  try {
    const r = await fetch(`${config.basesTel.twilio}/2010-04-01/Accounts/${encodeURIComponent(sidCompte)}/Calls.json`, {
      method: 'POST',
      headers: { authorization: `Basic ${Buffer.from(`${sidCompte}:${lire('TWILIO_AUTH_TOKEN')}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: e164, From: lire('CENTRE_NUMERO')!, Url: `${base()}/centre/telephone/sortant`, Method: 'POST' }).toString(),
      signal: AbortSignal.timeout(15_000),
    });
    if (r.status === 401 || r.status === 403) return refus(502, 'Twilio refuse nos identifiants : appel non parti.');
    if (!r.ok) return refus(502, `Twilio a refusé l’appel (code ${r.status}) : appel non parti.`);
    sid = ((await r.json()) as { sid?: string }).sid;
  } catch {
    return refus(502, 'Twilio est injoignable : appel non parti.');
  }
  if (!sid) return refus(502, 'Twilio n’a pas rendu d’identifiant d’appel : on ne sait pas si l’appel est parti.');
  const contact = contactDe(s, e164);
  contact.appels = [...contact.appels, maintenant.toISOString()];
  s.poser(C.contacts, e164, contact);
  const c = nouvelleConversation({ id: `tel-${sid}`, canal: 'telephone', sens: 'sortant', contact: e164, nom: contact.nom, objet, id_operateur: sid }, maintenant);
  ajouterTour(c, 'systeme', `Appel sortant lancé (${verdict.note})`, maintenant);
  ecrireConv(s, c);
  return ok({ appel: sid, conversation: c.id, note: verdict.note });
}

export const routes: Route[] = [
  { methode: 'GET', chemin: '/centre/whatsapp', acces: 'public', traiter: verifierMeta },
  { methode: 'POST', chemin: '/centre/whatsapp', acces: 'public', traiter: recevoirWhatsApp },
  { methode: 'POST', chemin: '/centre/telephone/entrant', acces: 'public', traiter: appelEntrant },
  { methode: 'POST', chemin: '/centre/telephone/sortant', acces: 'public', traiter: appelSortantDecroche },
  { methode: 'POST', chemin: '/centre/telephone/tour', acces: 'public', traiter: tourTelephone },
  { methode: 'POST', chemin: '/centre/telephone/apres-transfert', acces: 'public', traiter: apresTransfert },
  // The page itself carries no data: it asks for the admin secret and reads /centre/etat with it.
  { methode: 'GET', chemin: '/centre/console', acces: 'public', traiter: () => ({ statut: 200, corps: CONSOLE, type: 'text/html; charset=utf-8' }) },
  { methode: 'GET', chemin: '/centre/etat', acces: 'admin', traiter: etat },
  { methode: 'POST', chemin: '/centre/conversations/:id/reponse', acces: 'admin', traiter: repondreHumain },
  { methode: 'POST', chemin: '/centre/conversations/:id/agent', acces: 'admin', traiter: rendreALAgent },
  { methode: 'POST', chemin: '/centre/conversations/:id/traite', acces: 'admin', traiter: marquerTraite },
  { methode: 'POST', chemin: '/centre/contacts', acces: 'admin', traiter: consentement },
  { methode: 'POST', chemin: '/centre/appels', acces: 'admin', traiter: appeler },
];
