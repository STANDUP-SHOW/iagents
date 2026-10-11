// Demonstration of the call centre, without any account: the real platform
// server, the real routes and storage, with Meta, Twilio and the language
// model replaced by local fakes (`cerveau-demonstration.ts` reads a few
// phrases). It plays three real journeys through HTTP — a prospect on
// WhatsApp, a caller on the phone, an outbound call with consent — then keeps
// the console open: http://127.0.0.1:<port>/centre/console.
//
//   node --experimental-strip-types plateforme/centre/demonstration.ts [--port 8790] [--garder]
//
// The console says on top that the providers are simulated.

import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { creerPlateforme } from '../serveur.ts';
import { Stockage } from '../stockage.ts';
import { ecouter, fauxOperateur } from '../voix/banc-faux.ts';
import { signatureTwilio } from '../voix/telephonie.ts';
import { CerveauDemonstration } from './cerveau-demonstration.ts';
import { configurerCentre, travauxEnCours } from './routes.ts';

const arg = (nom: string) => { const i = process.argv.indexOf(nom); return i > 0 ? process.argv[i + 1] : undefined; };
const port = Number(arg('--port') ?? 8790);
const garder = process.argv.includes('--garder');

const graph = createServer((req, res) => { req.resume(); req.on('end', () => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"messages":[{"id":"wamid.demo"}]}'); }); });
const baseGraph = await ecouter(graph);
const op = fauxOperateur();
const baseOp = await ecouter(op.serveur);
const env = {
  CENTRE_DEMONSTRATION: '1',
  META_APP_SECRET: 'demo-meta', META_VERIFY_TOKEN: 'demo', WHATSAPP_JETON: 'demo', WHATSAPP_NUMERO_ID: '100000000000001',
  TWILIO_ACCOUNT_SID: 'ACdemo', TWILIO_AUTH_TOKEN: 'demo-twilio', VOIX_URL_PUBLIQUE: `http://127.0.0.1:${port}`,
  CENTRE_NUMERO: '+33987654321', CENTRE_NUMERO_HUMAIN: '+33746476968',
};
configurerCentre({ env, graph: baseGraph, basesTel: { telnyx: baseOp, twilio: baseOp }, cerveau: new CerveauDemonstration() });

// Tuesday 13 October 2026, from 10:12 in Paris, a few minutes between each message.
let horloge = new Date('2026-10-13T08:12:00Z');
const avancer = (min: number) => { horloge = new Date(horloge.getTime() + min * 60_000); };
const secret = 'demonstration-centre-appels-iagent';
const { serveur } = creerPlateforme({ secretAdmin: secret, fichierDonnees: null }, { stockage: new Stockage(null), maintenant: () => horloge });
await new Promise<void>((r) => serveur.listen(port, '127.0.0.1', r));
const base = `http://127.0.0.1:${port}`;

let n = 0;
async function whatsapp(de: string, nom: string, texte: string): Promise<void> {
  avancer(2);
  const brut = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: 'W', changes: [{ field: 'messages', value: { contacts: [{ wa_id: de, profile: { name: nom } }], messages: [{ from: de, id: `wamid.${++n}`, timestamp: String(Math.floor(horloge.getTime() / 1000)), type: 'text', text: { body: texte } }] } }] }] });
  await fetch(`${base}/centre/whatsapp`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${createHmac('sha256', env.META_APP_SECRET).update(brut).digest('hex')}` }, body: brut });
  await travauxEnCours();
}
async function twilio(chemin: string, champs: Record<string, string>): Promise<string> {
  avancer(1);
  const p = Object.entries(champs) as [string, string][];
  const r = await fetch(`${base}${chemin}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': signatureTwilio(env.TWILIO_AUTH_TOKEN, `${env.VOIX_URL_PUBLIQUE}${chemin}`, p) }, body: new URLSearchParams(p).toString() });
  return r.text();
}
const admin = (chemin: string, corps: unknown) => fetch(`${base}${chemin}`, { method: 'POST', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' }, body: JSON.stringify(corps) }).then((r) => r.json());

// 1. A printer on WhatsApp: a price, his name, a meeting.
await whatsapp('33622334455', 'Paul Martin', 'Bonjour, combien coûte un agent ?');
await whatsapp('33622334455', 'Paul Martin', "Je m'appelle Paul Martin de l'Imprimerie Martin, nous sommes 12 personnes.");
await whatsapp('33622334455', 'Paul Martin', 'Oui, je voudrais un rendez-vous.');
await whatsapp('33622334455', 'Paul Martin', 'Le premier me va.');

// 2. A caller on the phone who wants a human.
const appel = { CallSid: 'CAdemo1', From: '+33644556677', To: env.CENTRE_NUMERO, CallStatus: 'ringing', Direction: 'inbound', AccountSid: env.TWILIO_ACCOUNT_SID };
await twilio('/centre/telephone/entrant', appel);
await twilio('/centre/telephone/tour', { ...appel, CallStatus: 'in-progress', SpeechResult: 'Bonjour, quels sont vos tarifs pour une PME ?' });
await twilio('/centre/telephone/tour', { ...appel, CallStatus: 'in-progress', SpeechResult: 'D’accord, je voudrais parler à un conseiller.' });
await twilio('/centre/telephone/apres-transfert', { ...appel, DialCallStatus: 'no-answer' });

// 3. A prospect who asked to be called back: consent recorded, then the call.
await admin('/centre/contacts', { e164: '+33688776655', nom: 'Claire Dubois', source: 'formulaire « Être rappelé » du site', preuve: 'case cochée le 12/10/2026 à 18:04' });
const lance = await admin('/centre/appels', { e164: '+33688776655', objet: 'votre demande de devis pour un cabinet comptable' }) as { appel: string };
await twilio('/centre/telephone/sortant', { CallSid: lance.appel, From: env.CENTRE_NUMERO, To: '+33688776655', CallStatus: 'in-progress', Direction: 'outbound-api', AccountSid: env.TWILIO_ACCOUNT_SID });
await twilio('/centre/telephone/tour', { CallSid: lance.appel, From: env.CENTRE_NUMERO, To: '+33688776655', CallStatus: 'in-progress', SpeechResult: 'Oui, c’est un bon moment. Je voudrais un rendez-vous.' });

// 4. Someone who does not want to be contacted any more.
await whatsapp('33611223344', 'Inconnu', 'STOP');

const etat = await fetch(`${base}/centre/etat`, { headers: { authorization: `Bearer ${secret}` } }).then((r) => r.json()) as { conversations: unknown[]; rendez_vous: unknown[]; a_traiter: unknown[] };
console.log(`Démonstration jouée : ${etat.conversations.length} conversations, ${etat.rendez_vous.length} rendez-vous, ${etat.a_traiter.length} à traiter.`);
console.log(`Console : ${base}/centre/console — secret : ${secret}`);
if (!garder) { for (const s of [serveur, graph, op.serveur]) s.close(); }
