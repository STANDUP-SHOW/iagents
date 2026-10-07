// PhoneProvider (MASTER §11): Telnyx, Twilio and a generic SIP gateway behind
// one interface. Everything that leaves for an operator is a real HTTP call;
// the bench points `bases` at a fake operator on 127.0.0.1. Without its secret,
// an adapter refuses — an unsigned webhook is never accepted "for now".
//
// Formats READ in the official documentation (page, date):
//  - Telnyx webhooks: https://developers.telnyx.com/docs/messaging/messages/receiving-webhooks
//    (07/10/2026): Ed25519, headers `telnyx-signature-ed25519` (base64) and `telnyx-timestamp`
//    (Unix seconds), signed string `{timestamp}|{raw body}`, reject when older than 5 minutes;
//    public key from Mission Control (base64; raw 32 bytes or X.509 depending on the sample —
//    both accepted here). Payload: https://developers.telnyx.com/docs/voice/programmable-voice/receiving-webhooks
//    `data.event_type` (call.initiated, call.answered, call.hangup), `data.payload.call_control_id`,
//    `from`, `to`, `direction` ("incoming"); NOTE the page's own sample writes `from` as
//    "+1-202-555-0133", hence the normalisation below.
//  - Telnyx commands: https://developers.telnyx.com/api/call-control/dial-call (POST /v2/calls,
//    Bearer, `to`, `from`, `connection_id`, answer `data.call_control_id`),
//    /api/call-control/transfer-call (POST /v2/calls/:id/actions/transfer {to}),
//    /api/call-control/hangup-call (POST /v2/calls/:id/actions/hangup), read 07/10/2026.
//    NOT VERIFIED: /v2/calls/:id/actions/answer — the answer page shows no URL; path inferred
//    from transfer/hangup.
//  - Twilio signature: https://www.twilio.com/docs/usage/security (07/10/2026): full URL with
//    query, POST params sorted by name (case-sensitive), name+value appended with no delimiter,
//    HMAC-SHA1 with the Auth Token, Base64; header X-Twilio-Signature. The page's worked example
//    (token 12345, signature L/OH5YylLD5NRKLltdqwSvS0BnU=) is replayed by the bench.
//  - Twilio calls: https://www.twilio.com/docs/voice/api/call-resource (07/10/2026): POST
//    /2010-04-01/Accounts/{AccountSid}/Calls.json, form-encoded To, From, Url|Twiml, answer `sid`.
//    NOT VERIFIED line by line: updating a live call by POST …/Calls/{Sid}.json with `Twiml` or
//    `Status=completed`, and HTTP Basic auth AccountSid:AuthToken (the page shows SDK samples).
//    Inbound webhook parameters CallSid, From, To, CallStatus: standard TwiML request, NOT re-read.
//  - Generic SIP: no vendor. Our own contract with the gateway that fronts the SIP trunk:
//    webhook header `x-iagent-horodatage` (ISO) and `x-iagent-signature: sha256=<hex HMAC-SHA256
//    of "{horodatage}.{raw body}">`, body {type, id, de, vers}; commands POST {base}/appels,
//    /appels/:id/decrocher|transfert|raccrocher with Bearer SIP_PASSERELLE_JETON.
import { createHmac, createPublicKey, timingSafeEqual, verify } from 'node:crypto';
import { cle, manque, type Env } from './cles.ts';
import type { ProviderTel } from './types.ts';

const E164 = /^\+[1-9]\d{1,14}$/;

/** E.164 or null. Accepts the separators operators and people write (spaces, dashes, dots, brackets) and 00. */
export function normaliserE164(brut: unknown): string | null {
  if (typeof brut !== 'string') return null;
  let s = brut.trim().replace(/[\s.\-()]/g, '');
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  return E164.test(s) ? s : null;
}

/** A transfer destination: an E.164 number or a SIP URI. */
export function destinationValide(d: string): boolean {
  return normaliserE164(d) !== null || /^sips?:[^\s@]+@[^\s@]+$/.test(d);
}

export type RequeteEntrante = { brut: string; entetes: Record<string, string>; url: string; maintenant: Date };
export type EvenementEntrant = {
  type: 'appel-entrant' | 'decroche' | 'raccroche' | 'autre';
  id_operateur: string;
  de: string | null;
  vers: string | null;
  quoi: string;
};

export type Bases = { telnyx: string; twilio: string };
export const BASES_OFFICIELLES: Bases = { telnyx: 'https://api.telnyx.com', twilio: 'https://api.twilio.com' };

export interface PhoneProvider {
  readonly nom: ProviderTel;
  /** null when the request is authentic, otherwise the French reason of the refusal. */
  verifier(r: RequeteEntrante): string | null;
  lire(r: RequeteEntrante): EvenementEntrant;
  /** null when commands can leave, otherwise what is missing. */
  indisponible(): string | null;
  appeler(o: { de: string; vers: string }): Promise<{ id_operateur: string }>;
  decrocher(id: string): Promise<void>;
  transferer(id: string, vers: string): Promise<void>;
  raccrocher(id: string): Promise<void>;
  /** true when the answer to the webhook itself carries instructions (TwiML). */
  readonly repondParWebhook: boolean;
}

async function commande(qui: string, url: string, init: RequestInit): Promise<unknown> {
  let r: Response;
  try { r = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) }); } catch {
    throw new Error(`${qui} est injoignable : la commande n’est pas partie.`);
  }
  if (r.status === 401 || r.status === 403) throw new Error(`${qui} refuse nos identifiants : vérifiez-les.`);
  if (!r.ok) throw new Error(`${qui} a refusé la commande (code ${r.status}).`);
  const t = await r.text();
  try { return t ? JSON.parse(t) : null; } catch { return null; }
}

function memeChaine(a: string, b: string): boolean {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const DERIVE_S = 5 * 60;

// --- Telnyx -----------------------------------------------------------------

function clePubliqueTelnyx(b64: string) {
  const der = Buffer.from(b64, 'base64');
  if (der.length === 32) {
    // Raw Ed25519 key: wrap it in the SPKI prefix of RFC 8410.
    return createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), der]), format: 'der', type: 'spki' });
  }
  return createPublicKey({ key: der, format: 'der', type: 'spki' });
}

export function telnyx(env: Env, bases: Bases): PhoneProvider {
  const indisponible = () => manque(['telnyx_api', 'telnyx_connexion'], env, 'Commander un appel chez Telnyx');
  const entetes = () => ({ authorization: `Bearer ${cle('telnyx_api', env)}`, 'content-type': 'application/json' });
  const action = async (id: string, quoi: string, corps: unknown) => {
    const m = indisponible(); if (m) throw new Error(m);
    await commande('Telnyx', `${bases.telnyx}/v2/calls/${encodeURIComponent(id)}/actions/${quoi}`, { method: 'POST', headers: entetes(), body: JSON.stringify(corps) });
  };
  return {
    nom: 'telnyx',
    repondParWebhook: false,
    verifier(r) {
      const k = cle('telnyx_cle_publique', env);
      if (!k) return 'TELNYX_CLE_PUBLIQUE n’est pas posée : aucun webhook Telnyx n’est accepté sans vérifier sa signature.';
      const sig = r.entetes['telnyx-signature-ed25519']; const ts = r.entetes['telnyx-timestamp'];
      if (!sig || !ts) return 'Webhook Telnyx sans signature : refusé.';
      const t = Number(ts);
      if (!Number.isFinite(t) || Math.abs(r.maintenant.getTime() / 1000 - t) > DERIVE_S) return 'Webhook Telnyx trop ancien ou daté du futur : refusé (rejeu possible).';
      try {
        return verify(null, Buffer.from(`${ts}|${r.brut}`, 'utf8'), clePubliqueTelnyx(k), Buffer.from(sig, 'base64')) ? null : 'Signature Telnyx fausse : refusé.';
      } catch { return 'Signature ou clé publique Telnyx illisible : refusé.'; }
    },
    lire(r) {
      const v = JSON.parse(r.brut) as { data?: { event_type?: string; payload?: { call_control_id?: string; from?: string; to?: string; direction?: string } } };
      const t = v.data?.event_type ?? ''; const p = v.data?.payload ?? {};
      const type = t === 'call.initiated' && p.direction === 'incoming' ? 'appel-entrant'
        : t === 'call.answered' ? 'decroche' : t === 'call.hangup' ? 'raccroche' : 'autre';
      return { type, id_operateur: String(p.call_control_id ?? ''), de: normaliserE164(p.from), vers: normaliserE164(p.to), quoi: t };
    },
    indisponible,
    async appeler(o) {
      const m = indisponible(); if (m) throw new Error(m);
      const v = (await commande('Telnyx', `${bases.telnyx}/v2/calls`, {
        method: 'POST', headers: entetes(),
        body: JSON.stringify({ connection_id: cle('telnyx_connexion', env), to: o.vers, from: o.de }),
      })) as { data?: { call_control_id?: string } } | null;
      const id = v?.data?.call_control_id;
      if (!id) throw new Error('Telnyx n’a pas rendu d’identifiant d’appel : on ne sait pas si l’appel est parti.');
      return { id_operateur: id };
    },
    decrocher: (id) => action(id, 'answer', {}),
    transferer: (id, vers) => action(id, 'transfer', { to: vers }),
    raccrocher: (id) => action(id, 'hangup', {}),
  };
}

// --- Twilio -----------------------------------------------------------------

/** Twilio's string to sign: URL, then each POST parameter name+value, sorted by name. */
export function chaineTwilio(url: string, params: [string, string][]): string {
  const tri = [...params].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  return url + tri.map(([k, v]) => k + v).join('');
}

export function signatureTwilio(jeton: string, url: string, params: [string, string][]): string {
  return createHmac('sha1', jeton).update(Buffer.from(chaineTwilio(url, params), 'utf8')).digest('base64');
}

export function twilio(env: Env, bases: Bases): PhoneProvider {
  const indisponible = () => manque(['twilio_sid', 'twilio_jeton', 'url_publique'], env, 'Commander un appel chez Twilio');
  const auth = () => `Basic ${Buffer.from(`${cle('twilio_sid', env)}:${cle('twilio_jeton', env)}`).toString('base64')}`;
  const compte = () => `${bases.twilio}/2010-04-01/Accounts/${encodeURIComponent(cle('twilio_sid', env)!)}`;
  const modifier = async (id: string, champs: Record<string, string>) => {
    const m = indisponible(); if (m) throw new Error(m);
    await commande('Twilio', `${compte()}/Calls/${encodeURIComponent(id)}.json`, {
      method: 'POST', headers: { authorization: auth(), 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(champs).toString(),
    });
  };
  return {
    nom: 'twilio',
    repondParWebhook: true,
    verifier(r) {
      const jeton = cle('twilio_jeton', env);
      const base = cle('url_publique', env);
      if (!jeton) return 'TWILIO_AUTH_TOKEN n’est pas posé : aucun webhook Twilio n’est accepté sans vérifier sa signature.';
      if (!base) return 'VOIX_URL_PUBLIQUE n’est pas posée : la signature Twilio porte sur l’adresse publique, impossible de la vérifier.';
      const sig = r.entetes['x-twilio-signature'];
      if (!sig) return 'Webhook Twilio sans signature : refusé.';
      const params = [...new URLSearchParams(r.brut).entries()];
      const attendu = signatureTwilio(jeton, base.replace(/\/$/, '') + r.url, params);
      return memeChaine(attendu, sig) ? null : 'Signature Twilio fausse : refusé.';
    },
    lire(r) {
      const p = new URLSearchParams(r.brut);
      const statut = p.get('CallStatus') ?? '';
      const type = statut === 'ringing' && (p.get('Direction') ?? 'inbound') === 'inbound' ? 'appel-entrant'
        : statut === 'in-progress' ? 'decroche'
        : ['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(statut) ? 'raccroche' : 'autre';
      return { type, id_operateur: p.get('CallSid') ?? '', de: normaliserE164(p.get('From')), vers: normaliserE164(p.get('To')), quoi: statut };
    },
    indisponible,
    async appeler(o) {
      const m = indisponible(); if (m) throw new Error(m);
      const v = (await commande('Twilio', `${compte()}/Calls.json`, {
        method: 'POST', headers: { authorization: auth(), 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: o.vers, From: o.de, Url: `${cle('url_publique', env)!.replace(/\/$/, '')}/voix/fournisseurs/twilio/entrant` }).toString(),
      })) as { sid?: string } | null;
      if (!v?.sid) throw new Error('Twilio n’a pas rendu d’identifiant d’appel : on ne sait pas si l’appel est parti.');
      return { id_operateur: v.sid };
    },
    // Twilio picks up through the TwiML answered to its webhook: nothing to send.
    decrocher: async () => {},
    transferer: (id, vers) => modifier(id, { Twiml: `<Response><Dial>${echapperXml(vers)}</Dial></Response>` }),
    raccrocher: (id) => modifier(id, { Status: 'completed' }),
  };
}

export function echapperXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Generic SIP gateway ------------------------------------------------------

export function signatureSip(secret: string, horodatage: string, brut: string): string {
  return `sha256=${createHmac('sha256', secret).update(`${horodatage}.${brut}`, 'utf8').digest('hex')}`;
}

export function sip(env: Env): PhoneProvider {
  const indisponible = () => manque(['sip_passerelle', 'sip_jeton'], env, 'Commander un appel à la passerelle SIP');
  const envoyer = async (chemin: string, corps: unknown) => {
    const m = indisponible(); if (m) throw new Error(m);
    return commande('La passerelle SIP', `${cle('sip_passerelle', env)!.replace(/\/$/, '')}${chemin}`, {
      method: 'POST', headers: { authorization: `Bearer ${cle('sip_jeton', env)}`, 'content-type': 'application/json' }, body: JSON.stringify(corps),
    });
  };
  return {
    nom: 'sip',
    repondParWebhook: false,
    verifier(r) {
      const secret = cle('sip_secret', env);
      if (!secret) return 'SIP_SECRET_WEBHOOK n’est pas posé : aucun webhook de la passerelle SIP n’est accepté sans signature.';
      const h = r.entetes['x-iagent-horodatage']; const sig = r.entetes['x-iagent-signature'];
      if (!h || !sig) return 'Webhook SIP sans signature : refusé.';
      const t = Date.parse(h);
      if (!Number.isFinite(t) || Math.abs(r.maintenant.getTime() - t) > DERIVE_S * 1000) return 'Webhook SIP trop ancien : refusé.';
      return memeChaine(signatureSip(secret, h, r.brut), sig) ? null : 'Signature SIP fausse : refusé.';
    },
    lire(r) {
      const v = JSON.parse(r.brut) as { type?: string; id?: string; de?: string; vers?: string };
      const type = v.type === 'appel-entrant' || v.type === 'decroche' || v.type === 'raccroche' ? v.type : 'autre';
      return { type, id_operateur: String(v.id ?? ''), de: normaliserE164(v.de), vers: normaliserE164(v.vers), quoi: String(v.type ?? '') };
    },
    indisponible,
    async appeler(o) {
      const v = (await envoyer('/appels', { de: o.de, vers: o.vers })) as { id?: string } | null;
      if (!v?.id) throw new Error('La passerelle SIP n’a pas rendu d’identifiant d’appel.');
      return { id_operateur: v.id };
    },
    decrocher: async (id) => { await envoyer(`/appels/${encodeURIComponent(id)}/decrocher`, {}); },
    transferer: async (id, vers) => { await envoyer(`/appels/${encodeURIComponent(id)}/transfert`, { vers }); },
    raccrocher: async (id) => { await envoyer(`/appels/${encodeURIComponent(id)}/raccrocher`, {}); },
  };
}

export function operateur(nom: string, env: Env, bases: Bases): PhoneProvider | null {
  if (nom === 'telnyx') return telnyx(env, bases);
  if (nom === 'twilio') return twilio(env, bases);
  if (nom === 'sip') return sip(env);
  return null;
}
