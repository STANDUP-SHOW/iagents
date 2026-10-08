// Banc de la porte Cloudflare : la plateforme lancée dans le vrai moteur de
// Cloudflare (workerd, par `wrangler dev`, sans compte ni réseau), puis
// interrogée comme une Box et le back-office l'interrogeront. Ce banc ne rejoue
// pas les bancs des modules — ils tournent sous Node sur le même code — il
// vérifie ce que SEULE la porte Cloudflare peut casser :
//  - le stockage survit à un redémarrage (une clé par document dans l'objet) ;
//  - une fiche lue dans les fichiers statiques a les mêmes octets que sur le
//    disque (le jeton de licence signe son empreinte) ;
//  - les catalogues importés en JSON rendent le même export de tarifs que Node ;
//  - le flux téléphonique s'ouvre (101) avec un jeton émis par un vrai appel,
//    et se refuse sans ;
//  - les fiches ne sont pas servies à qui les demande.
// Lancer : `npm --prefix plateforme/cloudflare run banc`.

import { spawn, type ChildProcess } from 'node:child_process';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { creerPlateforme, messageASigner } from '../serveur.ts';
import { signatureTwilio } from '../voix/telephonie.ts';

const ici = new URL('./', import.meta.url).pathname;
const racine = new URL('../../', import.meta.url).pathname;
let fautes = 0;
const verifier = (nom: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok' : 'FAUTE'}  ${nom}${ok || !detail ? '' : ` — ${detail.slice(0, 400)}`}`);
  if (!ok) fautes++;
};

const libre = () => new Promise<number>((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = (s.address() as { port: number }).port; s.close(() => r(p)); }); });
const port = await libre();
const base = `http://127.0.0.1:${port}`;
const persistance = mkdtempSync(join(tmpdir(), 'iagent-cf-'));

const secretAdmin = 'secret-admin-du-banc-cloudflare-assez-long';
const plateforme = generateKeyPairSync('ed25519');
const pemPlateforme = plateforme.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const env: Record<string, string> = {
  PLATEFORME_ADMIN_SECRET: secretAdmin,
  PLATEFORME_CLE_SIGNATURE: pemPlateforme.replace(/\n/g, '\\n'),
  TWILIO_ACCOUNT_SID: 'ACbanc', TWILIO_AUTH_TOKEN: 'jeton-twilio-banc',
  VOIX_URL_PUBLIQUE: base,
  // A phone engine "has its key": the bridge opens. The key is false, so the engine refuses and the call goes to a human.
  GEMINI_API_KEY: 'cle-gemini-banc-fausse',
};
const fichierEnv = join(persistance, 'variables.env');
writeFileSync(fichierEnv, Object.entries(env).map(([k, v]) => `${k}="${v}"`).join('\n'));

let dev: ChildProcess | null = null;
let journal = '';
async function demarrer(): Promise<void> {
  dev = spawn(join(ici, 'node_modules/.bin/wrangler'), ['dev', '--ip', '127.0.0.1', '--port', String(port), '--persist-to', join(persistance, 'etat'), '--env-file', fichierEnv, '--show-interactive-dev-session=false', '--log-level', 'warn'], { cwd: ici, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });
  dev.stdout!.on('data', (d) => { journal += d; });
  dev.stderr!.on('data', (d) => { journal += d; });
  for (let i = 0; i < 240; i++) {
    if (dev.exitCode !== null) break;
    try { const r = await fetch(base + '/'); if (r.status === 200) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`wrangler dev ne répond pas :\n${journal.slice(-3000)}`);
}
async function arreter(): Promise<void> {
  if (!dev) return;
  const d = dev; dev = null;
  if (d.exitCode !== null || d.signalCode !== null) return;
  await new Promise<void>((r) => { d.once('exit', () => r()); d.kill('SIGINT'); setTimeout(() => { d.kill('SIGKILL'); }, 5000).unref(); });
}

type R = { statut: number; texte: string; corps: any; type: string };
const lire = async (r: Response): Promise<R> => { const texte = await r.text(); let corps: any = null; try { corps = JSON.parse(texte); } catch { /* not json */ } return { statut: r.status, texte, corps, type: r.headers.get('content-type') ?? '' }; };
const admin = async (methode: string, chemin: string, corps?: unknown) =>
  lire(await fetch(base + chemin, { method: methode, headers: { authorization: `Bearer ${secretAdmin}`, 'content-type': 'application/json' }, body: corps === undefined ? undefined : JSON.stringify(corps) }));
const cleBox = generateKeyPairSync('ed25519');
let deviceId = '';
const parBox = async (methode: string, chemin: string, corps = '') => {
  const h = new Date().toISOString();
  const s = sign(null, Buffer.from(messageASigner(methode, chemin.split('?')[0], h, corps), 'utf8'), cleBox.privateKey).toString('base64');
  return lire(await fetch(base + chemin, { method: methode, headers: { 'x-box-id': deviceId, 'x-horodatage': h, 'x-signature': s, 'content-type': 'application/json' }, body: corps || undefined }));
};

console.log(' Porte Cloudflare : la plateforme dans workerd');
try {
  await demarrer();
  verifier('la plateforme répond dans le moteur de Cloudflare', (await lire(await fetch(base + '/'))).texte === 'plateforme iagent');
  verifier('back-office sans secret : refusé', (await lire(await fetch(base + '/controle/tenants', { method: 'POST', body: '{}' }))).statut === 401);
  verifier('adresse inconnue : refus en français', (await lire(await fetch(base + '/nulle-part'))).corps?.erreur === "Cette adresse n'existe pas.");
  const fiche = readdirSync(join(racine, 'agents')).find((n) => n.startsWith('AG-0179-'))!;
  const servie = await fetch(`${base}/agents/${fiche}`);
  verifier('les fiches ne sont pas servies telles quelles (le Worker passe avant les fichiers)', servie.status === 404);

  // Licences: the full path a Box takes, the sheet read from the static files.
  const t = await admin('POST', '/controle/tenants', { nom: 'Client du banc Cloudflare', segment: 'business', pays: 'FR' });
  const tenant = String(t.corps?.tenant_id ?? '');
  const b = await admin('POST', '/controle/boxes', { serial: 'SN-BANC-CF', gamme: 'business', identite_publique: cleBox.publicKey.export({ type: 'spki', format: 'pem' }).toString(), os: 'ubuntu-core', version_desktop: '0.2.0' });
  deviceId = String(b.corps?.device_id ?? '');
  await admin('POST', `/controle/boxes/${deviceId}/attribuer`, { tenant_id: tenant, plan_id: 'box-commander-36' });
  const actif = await admin('POST', `/controle/boxes/${deviceId}/statut`, { statut: 'active', motif: 'banc cloudflare' });
  const ent = await admin('POST', '/controle/entitlements', { tenant_id: tenant, device_id: deviceId, agent_template_id: 'AG-0179', licence: 'professional', debut: new Date(Date.now() - 3600_000).toISOString() });
  verifier('client, Box et droit créés par le back-office', t.statut === 201 && b.statut === 201 && actif.statut === 200 && ent.statut === 201, JSON.stringify([t.corps, b.corps, actif.corps, ent.corps]));
  const droits = await parBox('GET', '/controle/box/droits');
  const charge = String(droits.corps?.jeton ?? '').split('.')[0];
  const contenu = charge ? JSON.parse(Buffer.from(charge, 'base64url').toString('utf8')) : null;
  const attendue = createHash('sha256').update(readFileSync(join(racine, 'agents', fiche))).digest('hex');
  verifier('jeton de licence émis, signé par la clé posée en secret', droits.statut === 200 && contenu?.v === 2, droits.texte);
  verifier('l’empreinte de la fiche lue chez Cloudflare est celle des octets du disque', contenu?.droits?.[0]?.empreinte_fiche === attendue);
  const autre = generateKeyPairSync('ed25519');
  const h = new Date().toISOString();
  const faux = await lire(await fetch(base + '/controle/box/droits', { headers: { 'x-box-id': deviceId, 'x-horodatage': h, 'x-signature': sign(null, Buffer.from(messageASigner('GET', '/controle/box/droits', h, '')), autre.privateKey).toString('base64') } }));
  verifier('une Box qui signe avec une autre clé : refusée', faux.statut === 401);

  // Pricing: the JSON imported into the Worker gives what Node computes from the same files.
  const { serveur } = creerPlateforme({ secretAdmin, fichierDonnees: null });
  await new Promise<void>((r) => serveur.listen(0, '127.0.0.1', r));
  const exportNode = await (await fetch(`http://127.0.0.1:${(serveur.address() as { port: number }).port}/tarifs/export-site`)).text();
  serveur.close();
  const exportCf = await lire(await fetch(base + '/tarifs/export-site'));
  verifier('export des tarifs identique à celui de Node', exportCf.statut === 200 && exportCf.texte === exportNode, exportCf.texte);

  // Phone: a signed Twilio call answered with a stream, the stream opened in workerd.
  const profil = { id: 'vp-lea', persona_id: 'AI-LEA', locale: 'fr-FR', palier: 'standard', voix_par_moteur: { gemini: 'Kore' }, ordre_de_repli: ['gemini'] };
  const tous = [1, 2, 3, 4, 5, 6, 7];
  const std = {
    id: 'S1', tenant_id: tenant, nom: 'Standard', fuseau: 'Europe/Paris', accueil: 'Bonjour, ici Léa.', message_ferme: 'Nous sommes fermés.',
    horaires: [{ jours: tous, debut: '00:00', fin: '23:59' }], extension_accueil: '100',
    extensions: [{ numero: '100', agent_instance_id: 'AI-LEA', prenom: 'Léa', departement: 'accueil' }],
    humains: [{ id: 'H1', nom: 'Max', departements: ['accueil'], cibles: [{ type: 'mobile', adresse: '+33 6 12 34 56 78' }] }],
    messagerie: true, rappel: true, file_id: 'F1', plafond_sessions: 2, consentement_enregistrement: false,
  };
  const file = { id: 'F1', tenant_id: tenant, nom: 'Accueil', priorite: 1, capacite: 2, attente_max_s: 60, debordement: { type: 'messagerie' }, rappel: true };
  const reglage = [
    await admin('PUT', '/voix/profils/vp-lea', profil),
    await admin('PUT', '/voix/files/F1', file),
    await admin('PUT', '/voix/standards/S1', std),
    await admin('POST', '/voix/numeros', { tenant_id: tenant, provider: 'twilio', e164: '+33186000002', routage_id: 'S1' }),
  ];
  verifier('standard téléphonique réglé par le back-office', reglage.every((r) => r.statut === 200 || r.statut === 201), reglage.map((r) => r.texte).join(' | '));
  const params: [string, string][] = [['CallSid', 'CA-CF'], ['From', '+33144444444'], ['To', '+33186000002'], ['CallStatus', 'ringing'], ['Direction', 'inbound'], ['AccountSid', 'ACbanc']];
  const appel = await lire(await fetch(base + '/voix/fournisseurs/twilio/entrant', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': signatureTwilio(env.TWILIO_AUTH_TOKEN, `${base}/voix/fournisseurs/twilio/entrant`, params) },
    body: new URLSearchParams(params).toString(),
  }));
  const flux = /<Stream url="([^"]+)"/.exec(appel.texte)?.[1] ?? '';
  verifier('appel Twilio signé : la réponse branche le son sur la plateforme', appel.statut === 200 && flux.startsWith(`ws://127.0.0.1:${port}/voix/flux/twilio/`), appel.texte);

  const ouvrir = (url: string) => new Promise<{ ouvert: boolean; recus: string[]; ws: WebSocket | null }>((r) => {
    const ws = new WebSocket(url);
    const recus: string[] = [];
    ws.addEventListener('message', (e) => recus.push(String(e.data)));
    ws.addEventListener('open', () => r({ ouvert: true, recus, ws }));
    ws.addEventListener('error', () => r({ ouvert: false, recus, ws: null }));
  });
  const refuse = await ouvrir(`ws://127.0.0.1:${port}/voix/flux/twilio/jeton-invente`);
  verifier('flux sans jeton valide : refusé avant d’ouvrir', !refuse.ouvert);
  const o = flux ? await ouvrir(flux) : { ouvert: false, recus: [], ws: null };
  verifier('flux de l’appel : ouvert dans workerd (101)', o.ouvert, journal.slice(-1500));
  if (o.ws) {
    o.ws.send(JSON.stringify({ event: 'connected', protocol: 'Call', version: '1.0.0' }));
    o.ws.send(JSON.stringify({ event: 'start', sequenceNumber: '1', start: { streamSid: 'MZ-CF', callSid: 'CA-CF', tracks: ['inbound'], mediaFormat: { encoding: 'audio/x-mulaw', sampleRate: 8000, channels: 1 } }, streamSid: 'MZ-CF' }));
    // The engine key is false: the engine refuses, the bridge keeps the line and asks for a human.
    let ho: R | null = null;
    for (let i = 0; i < 60; i++) {
      ho = await parBox('GET', '/voix/box/handoffs');
      if (ho.corps?.handoffs?.length) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    verifier('moteur refusé : l’appel passe à un humain, visible par la Box', ho?.corps?.handoffs?.[0]?.appelant === '+33144444444', ho?.texte);
    verifier('le flux réutilisé : refusé (jeton à usage unique)', !(await ouvrir(flux)).ouvert);
    o.ws.send(JSON.stringify({ event: 'stop', streamSid: 'MZ-CF', stop: { callSid: 'CA-CF' } }));
    o.ws.close();
  }

  // Durable: everything above survives a restart of the Worker.
  await arreter();
  await demarrer();
  const apres = await parBox('GET', '/controle/box/droits');
  verifier('après redémarrage : la Box, son client et son droit sont toujours là', apres.statut === 200 && String(apres.corps?.jeton ?? '').includes('.'), apres.texte);
  const sup = await admin('GET', `/voix/appels?tenant_id=${tenant}`);
  verifier('après redémarrage : l’appel est toujours connu de la supervision', sup.statut === 200 && JSON.stringify(sup.corps).includes('+33144444444'), sup.texte);
} catch (e) {
  verifier('le banc va jusqu’au bout', false, `${(e as Error).message}\n${journal.slice(-2000)}`);
} finally {
  await arreter();
  rmSync(persistance, { recursive: true, force: true });
}
console.log(`\n${fautes} faute(s).`);
process.exit(fautes ? 1 : 0);
