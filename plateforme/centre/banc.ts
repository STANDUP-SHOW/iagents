// Bench of the internal call centre. Pure parts first (slots, consent, prompt,
// the Twilio signature against the official library's own value), then the
// platform itself through a REAL server with fakes on 127.0.0.1 for Meta,
// Twilio and the Anthropic API: a prospect on WhatsApp who asks a price, gives
// his name, books a meeting, asks for a human and says STOP; callers on the
// phone; an outbound call refused then allowed. Every guard below fails if its
// rule is undone.

import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createHmac } from 'node:crypto';
import { creerPlateforme } from '../serveur.ts';
import { Stockage } from '../stockage.ts';
import { ecouter, fauxOperateur, type Recu } from '../voix/banc-faux.ts';
import { signatureTwilio } from '../voix/telephonie.ts';
import {
  C, consigne, creneauxLibres, demandeArret, historique, nouvelleConversation, peutAppeler, poserConsentement,
  reglagesInvalides, tarifsEnTexte, type Contact, type Conversation, type RendezVous,
} from './centre.ts';
import { CerveauDemonstration } from './cerveau-demonstration.ts';
import { configurerCentre, travauxEnCours } from './routes.ts';

let fautes = 0;
function verifier(nom: string, ok: boolean, detail?: unknown): void {
  if (ok) console.log(`  ok  ${nom}`);
  else { fautes++; console.log(`  FAUTE  ${nom}${detail === undefined ? '' : ` — ${typeof detail === 'string' ? detail.slice(0, 600) : JSON.stringify(detail).slice(0, 600)}`}`); }
}

// Tuesday 13 October 2026, 10:30 in Paris (summer time, UTC+2).
const mardi1030 = new Date('2026-10-13T08:30:00Z');

console.log(' Règles pures');
verifier('réglages lisibles', reglagesInvalides() === null, reglagesInvalides());
const t = tarifsEnTexte();
verifier('les prix viennent du fichier du site (Essential 149 €, Box 69 € sur 36 mois)', t.includes('Essential : 149 € HT par mois') && t.includes('69 € HT par mois sur 36 mois'), t);
verifier('une offre que le site ne vend pas encore est nommée sans prix', /iAgent Reception[^\n]*ne pas donner de prix/.test(t), t);
{
  const s = new Stockage(null);
  const lundi8h = new Date('2026-10-26T07:00:00Z'); // Monday after the change to winter time: 08:00 in Paris
  const l = creneauxLibres(s, lundi8h);
  verifier('premier créneau : deux heures de délai, heure d’hiver comprise', l[0]?.debut === '2026-10-26T09:00:00.000Z' && l[0].libelle === 'lundi 26 octobre à 10 h', l);
  verifier('dernier créneau du matin à 11 h 30, pas à midi', l.some((x) => x.libelle === 'lundi 26 octobre à 11 h 30') && !l.some((x) => x.libelle.endsWith('à 12 h')), l);
  const vendredi = creneauxLibres(s, new Date('2026-10-30T15:00:00Z')); // Friday 16:00
  verifier('ni samedi ni dimanche', vendredi.every((x) => !/^(samedi|dimanche)/.test(x.libelle)), vendredi);
  const veilleFerie = creneauxLibres(s, new Date('2026-11-10T15:30:00Z')); // Tuesday 10 Nov 16:30, 11 Nov is a holiday
  verifier('jour férié sauté (11 novembre)', veilleFerie.length > 0 && veilleFerie.every((x) => !x.libelle.includes('11 novembre')), veilleFerie);
  s.poser<RendezVous>(C.rendezVous, 'r', { id: 'r', debut: l[0].debut, fin: '', conversation_id: 'x', canal: 'whatsapp', contact: '+33600000000', nom: 'X', entreprise: null, objet: '', cree_le: '', statut: 'confirme' });
  verifier('un créneau réservé n’est plus proposé', creneauxLibres(s, lundi8h)[0]?.debut !== l[0].debut);

  verifier('appel sans consentement refusé', !peutAppeler(s, '+33612345678', mardi1030).autorise);
  verifier('consentement sans source refusé', typeof poserConsentement(s, { e164: '+33612345678', preuve: 'x' }, mardi1030) === 'string');
  verifier('consentement sans preuve refusé', typeof poserConsentement(s, { e164: '+33612345678', source: 'formulaire' }, mardi1030) === 'string');
  verifier('consentement daté du futur refusé', typeof poserConsentement(s, { e164: '+33612345678', source: 'f', preuve: 'p', date: '2027-01-01' }, mardi1030) === 'string');
  poserConsentement(s, { e164: '06 12 34 56 78'.replace(/^0/, '+33'), source: 'formulaire du site', preuve: 'case cochée « être rappelé »' }, mardi1030);
  verifier('avec consentement, un mardi à 10 h 30 : autorisé', peutAppeler(s, '+33612345678', mardi1030).autorise);
  const samedi = peutAppeler(s, '+33612345678', new Date('2026-10-17T08:30:00Z'));
  verifier('le samedi : refusé, motif en français', !samedi.autorise && samedi.motif.includes('samedi'), samedi);
  const soir = peutAppeler(s, '+33612345678', new Date('2026-10-13T18:30:00Z'));
  verifier('à 20 h 30 : refusé', !soir.autorise, soir);
  const c = s.lire<Contact>(C.contacts, '+33612345678')!;
  s.poser(C.contacts, c.id, { ...c, appels: ['2026-10-01T08:00:00Z', '2026-10-05T08:00:00Z', '2026-10-07T08:00:00Z', '2026-10-09T08:00:00Z'] });
  verifier('quatre appels en trente jours : le cinquième est refusé', !peutAppeler(s, '+33612345678', mardi1030).autorise);

  verifier('« STOP » arrête tout, « stop au gaspillage » non', demandeArret('STOP') && demandeArret('Stop.') && !demandeArret('stop au gaspillage de temps'));
  const conv = nouvelleConversation({ id: 'x', canal: 'telephone', sens: 'entrant', contact: '+33600000000' }, mardi1030);
  conv.tours.push({ qui: 'agent', texte: 'Bonjour', le: '' }, { qui: 'contact', texte: 'Oui', le: '' }, { qui: 'systeme', texte: 'outil', le: '' }, { qui: 'humain', texte: 'Ici Max', le: '' });
  const h = historique(conv);
  verifier('l’historique commence par la personne et alterne', h[0].role === 'user' && h.every((m, i) => i === 0 || m.role !== h[i - 1].role) && !JSON.stringify(h).includes('outil'), h);
  const cs = consigne(conv, mardi1030);
  verifier('au téléphone, la consigne demande des phrases courtes et dit que c’est une IA', cs.includes('AU TÉLÉPHONE') && cs.includes('intelligence artificielle'));
}
// The expected value was computed with Twilio's own library (npm twilio@5.3.0,
// getExpectedTwilioSignature), not with our code: the same URL, parameters and token.
verifier('signature Twilio identique à celle de la bibliothèque officielle', signatureTwilio('jeton-de-banc-0123456789', 'https://centre.exemple.fr/telephone/entrant', [
  ['CallSid', 'CA0123456789abcdef0123456789abcdef'], ['From', '+33612345678'], ['To', '+33987654321'], ['SpeechResult', 'Bonjour, je voudrais un rendez-vous à Béziers'],
]) === 'tEl367oKzZsutzh9/owFIppnNjA=');

// ---------------------------------------------------------------------------
console.log(' Plateforme : fausses portes de Meta, Twilio et Anthropic');

const graphRecus: Recu[] = [];
let graphEnPanne = false;
const graph = createServer(async (req, res) => {
  const m: Buffer[] = []; for await (const x of req) m.push(x as Buffer);
  graphRecus.push({ methode: req.method ?? '', chemin: req.url ?? '', entetes: req.headers as Record<string, string>, corps: Buffer.concat(m).toString('utf8') });
  res.writeHead(graphEnPanne ? 500 : 200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(graphEnPanne ? { error: { message: 'panne' } } : { messaging_product: 'whatsapp', messages: [{ id: `wamid.${graphRecus.length}` }] }));
});
const baseGraph = await ecouter(graph);
const op = fauxOperateur();
const baseOp = await ecouter(op.serveur);

const env = {
  META_APP_SECRET: 'secret-application-meta-du-banc',
  META_VERIFY_TOKEN: 'mot-de-verification-du-banc',
  WHATSAPP_JETON: 'EAAjeton-whatsapp-du-banc',
  WHATSAPP_NUMERO_ID: '106540352242922',
  TWILIO_ACCOUNT_SID: 'ACbanc0000000000000000000000000000',
  TWILIO_AUTH_TOKEN: 'jeton-twilio-du-banc-0123456789',
  VOIX_URL_PUBLIQUE: 'https://centre.iagent.exemple',
  CENTRE_NUMERO: '+33987654321',
  CENTRE_NUMERO_HUMAIN: '+33746476968',
};
const SECRETS = [env.META_APP_SECRET, env.WHATSAPP_JETON, env.TWILIO_AUTH_TOKEN, 'sk-ant-banc-cle'];
const cerveau = new CerveauDemonstration();
configurerCentre({ env, graph: baseGraph, basesTel: { telnyx: baseOp, twilio: baseOp }, cerveau });

const s = new Stockage(null);
let horloge = mardi1030;
const secretAdmin = 'secret-admin-du-banc-centre-assez-long';
const { serveur } = creerPlateforme({ secretAdmin, fichierDonnees: null }, { stockage: s, maintenant: () => horloge });
const base = await ecouter(serveur);
const reponses: string[] = [];
const lire = async (r: Response) => { const texte = await r.text(); reponses.push(texte); let corps: any = null; try { corps = JSON.parse(texte); } catch { /* TwiML or text */ } return { statut: r.status, type: r.headers.get('content-type') ?? '', corps, texte }; };
const admin = async (methode: string, chemin: string, corps?: unknown) =>
  lire(await fetch(`${base}${chemin}`, { method: methode, headers: { authorization: `Bearer ${secretAdmin}`, 'content-type': 'application/json' }, body: corps === undefined ? undefined : JSON.stringify(corps) }));

let wamid = 0;
const whatsapp = async (de: string, nom: string, texte: string, o: { signer?: string; rejouer?: string } = {}) => {
  const brut = o.rejouer ?? JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: 'WABA', changes: [{ field: 'messages', value: {
    messaging_product: 'whatsapp', metadata: { phone_number_id: env.WHATSAPP_NUMERO_ID },
    contacts: [{ wa_id: de, profile: { name: nom } }],
    messages: [{ from: de, id: `wamid.in.${++wamid}`, timestamp: String(Math.floor(horloge.getTime() / 1000) + wamid), type: 'text', text: { body: texte } }],
  } }] }] });
  const sig = `sha256=${createHmac('sha256', o.signer ?? env.META_APP_SECRET).update(brut).digest('hex')}`;
  const r = await lire(await fetch(`${base}/centre/whatsapp`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig }, body: brut }));
  await travauxEnCours();
  return { ...r, brut };
};
const envoyes = () => graphRecus.map((r) => JSON.parse(r.corps) as { to: string; text: { body: string } });
const dernierEnvoi = () => envoyes()[envoyes().length - 1];
const conv = (id: string) => s.lire<Conversation>(C.conversations, id)!;

// --- WhatsApp -----------------------------------------------------------------
const verif = await lire(await fetch(`${base}/centre/whatsapp?hub.mode=subscribe&hub.verify_token=${env.META_VERIFY_TOKEN}&hub.challenge=1158201444`));
verifier('Meta : la poignée de vérification rend le défi', verif.statut === 200 && verif.texte === '1158201444', verif.texte);
verifier('Meta : un mauvais mot est refusé', (await lire(await fetch(`${base}/centre/whatsapp?hub.mode=subscribe&hub.verify_token=faux&hub.challenge=1`))).statut === 403);
const nonSigne = await whatsapp('33611111111', 'Intrus', 'bonjour', { signer: 'pas-le-bon-secret' });
verifier('WhatsApp : charge mal signée refusée, rien rangé, rien envoyé', nonSigne.statut === 401 && s.lister(C.conversations).length === 0 && graphRecus.length === 0);

const prix = await whatsapp('33622334455', 'Paul Martin', 'Bonjour, combien coûte un agent ?');
const env1 = dernierEnvoi();
verifier('WhatsApp : 200 rendu à Meta', prix.statut === 200);
verifier('WhatsApp : la réponse part vers Meta, à la bonne adresse, avec le jeton', graphRecus.length === 1 && graphRecus[0].chemin === `/v21.0/${env.WHATSAPP_NUMERO_ID}/messages` && graphRecus[0].entetes.authorization === `Bearer ${env.WHATSAPP_JETON}` && env1.to === '33622334455', graphRecus[0]);
verifier('WhatsApp : l’assistante donne le prix lu dans le fichier du site', env1.text.body.includes('149 euros'), env1.text.body);
await whatsapp('33622334455', 'Paul Martin', '', { rejouer: prix.brut });
verifier('WhatsApp : une charge renvoyée par Meta ne fait pas répondre deux fois', graphRecus.length === 1, graphRecus.length);

await whatsapp('33622334455', 'Paul Martin', "Je m'appelle Paul Martin de l'Imprimerie Martin, nous sommes 12 personnes.");
const idWa = 'wa-+33622334455';
verifier('WhatsApp : la qualification est notée (nom, entreprise, activité, postes)', conv(idWa).qualification.nom === 'Paul Martin' && conv(idWa).qualification.entreprise === 'Imprimerie Martin' && conv(idWa).qualification.nombre_postes === 12 && conv(idWa).qualification.activite === 'imprimerie', conv(idWa).qualification);
await whatsapp('33622334455', 'Paul Martin', 'Je voudrais un rendez-vous.');
verifier('WhatsApp : deux créneaux réels proposés', /Je peux vous proposer \w+ \d+ octobre à/.test(dernierEnvoi().text.body) && conv(idWa).creneaux_proposes.length > 1, dernierEnvoi().text.body);
await whatsapp('33622334455', 'Paul Martin', 'Le premier me va.');
const rdvs = s.lister<RendezVous>(C.rendezVous);
verifier('WhatsApp : le rendez-vous est réservé sur le créneau proposé, au nom de la personne', rdvs.length === 1 && rdvs[0].debut === conv(idWa).creneaux_proposes[0].debut && rdvs[0].nom === 'Paul Martin' && rdvs[0].entreprise === 'Imprimerie Martin', rdvs);
verifier('WhatsApp : la confirmation donne le jour et l’heure', dernierEnvoi().text.body.includes('Rendez-vous') && dernierEnvoi().text.body.includes('octobre'), dernierEnvoi().text.body);
const consigneRdv = cerveau.consignes[cerveau.consignes.length - 1];
verifier('la consigne du modèle porte les vrais créneaux proposés et ce qui est noté', consigneRdv.includes('"debut":"') && consigneRdv.includes('nom = Paul Martin'));

await whatsapp('33622334455', 'Paul Martin', 'Je préfère parler à un conseiller.');
verifier('WhatsApp : demande d’un humain → conversation à traiter, l’assistante se tait ensuite', conv(idWa).etat === 'humain' && conv(idWa).transfert?.statut === 'a-traiter', conv(idWa).transfert);
const avant = graphRecus.length;
await whatsapp('33622334455', 'Paul Martin', 'Allô ?');
verifier('WhatsApp : pendant la main humaine, aucune réponse automatique', graphRecus.length === avant && conv(idWa).tours.at(-1)?.texte === 'Allô ?');

verifier('back-office : /centre/etat refusé sans secret', (await lire(await fetch(`${base}/centre/etat`))).statut === 401);
const etat1 = await admin('GET', '/centre/etat');
verifier('back-office : la conversation est en tête des choses à traiter', etat1.statut === 200 && etat1.corps.a_traiter.includes(idWa) && etat1.corps.rendez_vous.length === 1, etat1.corps?.a_traiter);
verifier('back-office : chaque canal se dit branché quand ses réglages sont là', Object.entries(etat1.corps.canaux).every(([, v]) => v === null), etat1.corps.canaux);
const rep = await admin('POST', `/centre/conversations/${encodeURIComponent(idWa)}/reponse`, { texte: 'Bonjour Paul, ici Maxime. Je vous appelle demain à 10 h.' });
verifier('back-office : le conseiller répond sur WhatsApp, la demande passe à traitée', rep.statut === 200 && dernierEnvoi().text.body.startsWith('Bonjour Paul, ici Maxime') && conv(idWa).transfert?.statut === 'traite' && conv(idWa).tours.at(-1)?.qui === 'humain', rep.texte);
verifier('back-office : rendre la main à l’assistante', (await admin('POST', `/centre/conversations/${encodeURIComponent(idWa)}/agent`, {})).statut === 200 && conv(idWa).etat === 'agent');

graphEnPanne = true;
await whatsapp('33622334455', 'Paul Martin', 'Et pour la Box, combien ?');
graphEnPanne = false;
verifier('WhatsApp : une réponse que Meta refuse n’est pas écrite comme dite, et la conversation remonte', conv(idWa).tours.at(-1)?.qui === 'systeme' && conv(idWa).tours.at(-1)!.texte.includes('non envoyé') && conv(idWa).transfert?.statut === 'a-traiter', conv(idWa).tours.at(-1));

await whatsapp('33622334455', 'Paul Martin', 'STOP');
verifier('WhatsApp : « STOP » retire le consentement et le confirme', s.lire<Contact>(C.contacts, '+33622334455')?.retire_le !== null && dernierEnvoi().text.body.includes('ne recevrez plus'), dernierEnvoi().text.body);
const refuse = await admin('POST', '/centre/appels', { e164: '+33622334455', objet: 'votre demande' });
verifier('après « STOP », un appel sortant est refusé avec le motif', refuse.statut === 409 && refuse.corps.erreur.includes('ne plus être contactée'), refuse.corps);

horloge = new Date(mardi1030.getTime() + 25 * 3_600_000);
const tard = await admin('POST', `/centre/conversations/${encodeURIComponent(idWa)}/reponse`, { texte: 'Vous êtes là ?' });
verifier('back-office : 24 h après le dernier message, WhatsApp n’autorise plus de réponse libre — refus expliqué', tard.statut === 409 && tard.corps.erreur.includes('24 heures'), tard.corps);
horloge = mardi1030;

configurerCentre({ cerveau: null, env: { ...env } });
await whatsapp('33699887766', 'Julie', 'Bonjour, vous êtes ouverts samedi ?');
verifier('sans clé du modèle : accusé de réception honnête, demande mise à traiter', dernierEnvoi().text.body.includes('Un conseiller') && conv('wa-+33699887766').transfert?.statut === 'a-traiter' && conv('wa-+33699887766').transfert!.resume.includes('ANTHROPIC_API_KEY'), conv('wa-+33699887766').transfert);
const etat2 = await admin('GET', '/centre/etat');
verifier('sans clé du modèle : la console le dit en nommant la variable', String(etat2.corps.canaux.cerveau).includes('ANTHROPIC_API_KEY'));
configurerCentre({ cerveau, env });

// --- Phone ------------------------------------------------------------------
const twilio = async (chemin: string, champs: Record<string, string>, o: { faux?: boolean } = {}) => {
  const params = Object.entries(champs) as [string, string][];
  const sig = signatureTwilio(o.faux ? 'autre-jeton' : env.TWILIO_AUTH_TOKEN, `${env.VOIX_URL_PUBLIQUE}${chemin}`, params);
  return lire(await fetch(`${base}${chemin}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': sig }, body: new URLSearchParams(params).toString() }));
};
const appel = { CallSid: 'CAentrant1', From: '+33655443322', To: env.CENTRE_NUMERO, CallStatus: 'ringing', Direction: 'inbound', AccountSid: env.TWILIO_ACCOUNT_SID };
verifier('téléphone : webhook mal signé refusé', (await twilio('/centre/telephone/entrant', appel, { faux: true })).statut === 401);
const accueil = await twilio('/centre/telephone/entrant', appel);
verifier('téléphone : l’accueil dit tout de suite que c’est une IA et que l’échange est transcrit', accueil.statut === 200 && accueil.type.startsWith('text/xml') && accueil.texte.includes('une intelligence artificielle') && accueil.texte.includes('transcrit'), accueil.texte);
verifier('téléphone : la parole est écoutée en français, la suite revient à une adresse absolue', accueil.texte.includes('<Gather input="speech" language="fr-FR"') && accueil.texte.includes(`action="${env.VOIX_URL_PUBLIQUE}/centre/telephone/tour"`), accueil.texte);
const tarif = await twilio('/centre/telephone/tour', { ...appel, CallStatus: 'in-progress', SpeechResult: 'Quels sont vos tarifs ?', Confidence: '0.92' });
verifier('téléphone : la réponse est dite puis on réécoute', tarif.texte.includes('149 euros') && tarif.texte.includes('<Gather'), tarif.texte);
const silence1 = await twilio('/centre/telephone/tour', { ...appel, CallStatus: 'in-progress' });
verifier('téléphone : un silence → on redemande', silence1.texte.includes('répéter') && silence1.texte.includes('<Gather'));
const silence2 = await twilio('/centre/telephone/tour', { ...appel, CallStatus: 'in-progress', SpeechResult: '' });
verifier('téléphone : deux silences → au revoir et raccroché', silence2.texte.includes('<Hangup/>') && conv('tel-CAentrant1').etat === 'terminee', silence2.texte);

const appel2 = { ...appel, CallSid: 'CAentrant2', From: '+33644556677' };
await twilio('/centre/telephone/entrant', appel2);
const humain = await twilio('/centre/telephone/tour', { ...appel2, CallStatus: 'in-progress', SpeechResult: 'Je voudrais parler à un conseiller s’il vous plaît' });
verifier('téléphone : transfert pendant les heures → Dial vers le conseiller, avec retour', humain.texte.includes(`<Dial timeout="25" callerId="${env.CENTRE_NUMERO}" action="${env.VOIX_URL_PUBLIQUE}/centre/telephone/apres-transfert"`) && humain.texte.includes(`${env.CENTRE_NUMERO_HUMAIN}</Dial>`), humain.texte);
const personne = await twilio('/centre/telephone/apres-transfert', { ...appel2, DialCallStatus: 'no-answer' });
verifier('téléphone : personne ne décroche → c’est dit, rappel à faire', personne.texte.includes('rappelle') && personne.texte.includes('<Hangup/>') && conv('tel-CAentrant2').transfert?.statut === 'a-traiter', personne.texte);

horloge = new Date('2026-10-17T09:00:00Z'); // Saturday 11:00
const appel3 = { ...appel, CallSid: 'CAentrant3', From: '+33633221100' };
await twilio('/centre/telephone/entrant', appel3);
const samedi = await twilio('/centre/telephone/tour', { ...appel3, CallStatus: 'in-progress', SpeechResult: 'Passez-moi un humain' });
verifier('téléphone : le samedi, pas de Dial, rappel promis et noté', !samedi.texte.includes('<Dial') && samedi.texte.includes('vous rappelle') && conv('tel-CAentrant3').transfert?.statut === 'a-traiter', samedi.texte);
horloge = mardi1030;

const appel4 = { ...appel, CallSid: 'CAentrant4', From: '+33612121212' };
await twilio('/centre/telephone/entrant', appel4);
await twilio('/centre/telephone/tour', { ...appel4, CallStatus: 'in-progress', SpeechResult: 'Ne m’appelez plus jamais.' });
verifier('téléphone : « ne m’appelez plus » retire le consentement', !!s.lire<Contact>(C.contacts, '+33612121212')?.retire_le);

class CerveauEnPanne { appels = 0; async repondre(): Promise<never> { this.appels++; throw new Error('Le modèle de langage est injoignable.'); } }
configurerCentre({ cerveau: new CerveauEnPanne() as never });
const appel5 = { ...appel, CallSid: 'CAentrant5', From: '+33677889900' };
await twilio('/centre/telephone/entrant', appel5);
const panne = await twilio('/centre/telephone/tour', { ...appel5, CallStatus: 'in-progress', SpeechResult: 'Bonjour' });
verifier('téléphone : modèle en panne → l’appelant est passé à un conseiller, pas laissé en silence', panne.texte.includes('<Dial') && conv('tel-CAentrant5').tours.some((x) => x.qui === 'systeme' && x.texte.includes('injoignable')), panne.texte);
configurerCentre({ cerveau });

// --- Outbound -----------------------------------------------------------------
const sansConsentement = await admin('POST', '/centre/appels', { e164: '+33688776655', objet: 'votre demande de devis' });
verifier('appel sortant sans consentement refusé, rien ne part chez Twilio', sansConsentement.statut === 409 && op.recus.length === 0, sansConsentement.corps);
verifier('consentement sans preuve refusé par la console', (await admin('POST', '/centre/contacts', { e164: '+33688776655', nom: 'Claire Dubois', source: 'formulaire du site' })).statut === 400);
verifier('consentement enregistré avec sa source et sa preuve', (await admin('POST', '/centre/contacts', { e164: '+33688776655', nom: 'Claire Dubois', source: 'formulaire « Être rappelé » du site', preuve: 'case cochée le 12/10/2026 à 18:04' })).statut === 200);
horloge = new Date('2026-10-17T09:00:00Z');
const samediSortant = await admin('POST', '/centre/appels', { e164: '+33688776655', objet: 'votre demande de devis' });
verifier('appel sortant un samedi refusé', samediSortant.statut === 409 && samediSortant.corps.erreur.includes('samedi') && op.recus.length === 0, samediSortant.corps);
horloge = mardi1030;
configurerCentre({ env: { ...env, CENTRE_NUMERO: '' } });
const sansNumero = await admin('POST', '/centre/appels', { e164: '+33688776655', objet: 'votre demande de devis' });
verifier('sans numéro du centre : refus qui nomme la variable, rien ne part', sansNumero.statut === 503 && sansNumero.corps.erreur.includes('CENTRE_NUMERO') && op.recus.length === 0, sansNumero.corps);
configurerCentre({ env });
const lance = await admin('POST', '/centre/appels', { e164: '+33688776655', objet: 'votre demande de devis' });
const commande = op.recus[0];
const champs = new URLSearchParams(commande?.corps ?? '');
verifier('appel sortant autorisé : une seule commande Twilio, au format de l’API', lance.statut === 200 && op.recus.length === 1 && commande.chemin === `/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls.json` && champs.get('To') === '+33688776655' && champs.get('From') === env.CENTRE_NUMERO && champs.get('Url') === `${env.VOIX_URL_PUBLIQUE}/centre/telephone/sortant`, commande);
verifier('appel sortant : identifiants en Basic, jamais dans l’adresse', commande?.entetes.authorization === `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`);
const decroche = await twilio('/centre/telephone/sortant', { CallSid: lance.corps.appel, From: env.CENTRE_NUMERO, To: '+33688776655', CallStatus: 'in-progress', Direction: 'outbound-api', AccountSid: env.TWILIO_ACCOUNT_SID });
verifier('appel sortant décroché : objet annoncé, IA dite, droit de refuser rappelé', decroche.texte.includes('Claire Dubois') && decroche.texte.includes('votre demande de devis') && decroche.texte.includes('intelligence artificielle') && decroche.texte.includes('ne souhaitez plus être appelé'), decroche.texte);
verifier('appel sortant compté pour la règle des quatre appels', s.lire<Contact>(C.contacts, '+33688776655')!.appels.length === 1);

// --- Console, retention, secrets ---------------------------------------------------
const page = await lire(await fetch(`${base}/centre/console`));
verifier('console : la page se sert sans données', page.statut === 200 && page.type.startsWith('text/html') && !page.texte.includes('+33622334455') && page.texte.includes('/centre/etat'));
const vieille = nouvelleConversation({ id: 'wa-vieille', canal: 'whatsapp', sens: 'entrant', contact: '+33600000001' }, new Date('2025-01-01T00:00:00Z'));
s.poser(C.conversations, vieille.id, vieille);
const etat3 = await admin('GET', '/centre/etat');
verifier('conservation : une conversation de plus d’un an est effacée', etat3.corps.purgees === 1 && !s.lire(C.conversations, 'wa-vieille'));
verifier('aucune réponse de la plateforme ne contient un secret', !reponses.some((r) => SECRETS.some((x) => r.includes(x))));

// --- The real Anthropic adapter, against a fake API --------------------------------
const requetes: any[] = [];
const anthropic = createServer(async (req, res) => {
  const m: Buffer[] = []; for await (const x of req) m.push(x as Buffer);
  const corps = JSON.parse(Buffer.concat(m).toString('utf8'));
  requetes.push({ entetes: req.headers, corps });
  const premier = requetes.length === 1;
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(premier
    ? { content: [{ type: 'text', text: 'Je regarde.' }, { type: 'tool_use', id: 'toolu_1', name: 'creneaux_libres', input: {} }], stop_reason: 'tool_use', usage: { input_tokens: 900, output_tokens: 30 } }
    : { content: [{ type: 'text', text: 'Je peux vous proposer mardi à 14 h.' }], stop_reason: 'end_turn', usage: { input_tokens: 1000, output_tokens: 20 } }));
});
const baseAnthropic = await ecouter(anthropic);
configurerCentre({ cerveau: null, anthropic: baseAnthropic, env: { ...env, ANTHROPIC_API_KEY: 'sk-ant-banc-cle' } });
await whatsapp('33655554444', 'Léon', 'Avez-vous un créneau mardi ?');
const [r1, r2] = requetes;
verifier('Anthropic : clé et version en en-têtes, nos six outils déclarés', r1?.entetes['x-api-key'] === 'sk-ant-banc-cle' && r1.entetes['anthropic-version'] === '2023-06-01' && r1.corps.tools.map((x: any) => x.name).join(',') === 'noter_qualification,creneaux_libres,reserver_rendez_vous,transferer_a_un_humain,ne_plus_contacter,terminer', r1?.corps?.tools);
verifier('Anthropic : le résultat de l’outil revient avec son identifiant', r2?.corps.messages.at(-1).content[0].type === 'tool_result' && r2.corps.messages.at(-1).content[0].tool_use_id === 'toolu_1' && r2.corps.messages.at(-2).content.some((b: any) => b.type === 'tool_use'), r2?.corps?.messages);
verifier('Anthropic : la réponse finale part sur WhatsApp et les jetons sont comptés', dernierEnvoi().text.body === 'Je peux vous proposer mardi à 14 h.' && conv('wa-+33655554444').jetons.entree === 1900);

for (const x of [serveur, graph, op.serveur, anthropic]) x.close();
console.log(fautes ? `\nCentre d'appels : ${fautes} faute(s).` : '\nCentre d’appels : tout passe.');
process.exit(fautes ? 1 : 0);
