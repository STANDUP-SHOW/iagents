/**
 * La Box et la plateforme signent-elles la même chose ?
 *
 * Une requête `box` est signée en Rust (`desktop/src-tauri/src/plateforme.rs`)
 * et vérifiée en TypeScript (`plateforme/serveur.ts`, `messageASigner`). Deux
 * implémentations d'une même règle finissent par dire deux choses : un retour
 * à la ligne en trop, une empreinte en majuscules, et toutes les Box sont
 * refusées en 401 sans qu'aucune construction ne bronche.
 *
 * Ce banc produit donc les témoins depuis le code du SERVEUR (le message à
 * signer vient de `messageASigner`, la signature de `node:crypto`), les compare
 * à `desktop/temoins-plateforme.json`, et le test Rust rejoue le même fichier
 * par `include_str!`. Si l'un des deux côtés change, l'un des deux bancs tombe.
 *
 * Même chose pour le jeton de licence, au format convenu avec le chantier
 * controle (07/10/2026) : `<charge>.<signature>`, charge = base64url sans
 * remplissage du JSON, signature Ed25519 sur le texte de la charge.
 *
 * `--ecrire` regénère le fichier (à ne faire que si le format a changé exprès).
 */
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { messageASigner, signatureBox } from '../plateforme/serveur.ts';
import type { Box } from '../plateforme/modele.ts';

const racine = join(import.meta.dirname, '..');
const fichier = join(racine, 'desktop/temoins-plateforme.json');
let fautes = 0;
const faute = (m: string) => {
  console.log(`  ✗ ${m}`);
  fautes += 1;
};

// Fixed seeds: Ed25519 is deterministic, so the same seed and message always
// give the same signature, on both sides.
const GRAINE_BOX = Buffer.alloc(32, 7);
const GRAINE_PLATEFORME = Buffer.alloc(32, 11);
const ENTETE_PKCS8 = Buffer.from('302e020100300506032b657004220420', 'hex');

const clePrivee = (graine: Buffer) =>
  createPrivateKey({ key: Buffer.concat([ENTETE_PKCS8, graine]), format: 'der', type: 'pkcs8' });
const b64url = (b: Buffer) => b.toString('base64url');

const box = clePrivee(GRAINE_BOX);
const boxPem = createPublicKey(box).export({ type: 'spki', format: 'pem' }).toString();
const boxDer = createPublicKey(box).export({ type: 'spki', format: 'der' });
const plateforme = clePrivee(GRAINE_PLATEFORME);
const plateformePem = createPublicKey(plateforme).export({ type: 'spki', format: 'pem' }).toString();

const requetes = [
  { methode: 'GET', chemin: '/controle/box/droits', horodatage: '2026-10-07T12:00:00.000Z', corps: '' },
  {
    methode: 'POST',
    chemin: '/voix/box/handoffs/APPEL-1',
    horodatage: '2026-10-07T12:00:01.250Z',
    corps: '{"decision":"prendre"}',
  },
  {
    methode: 'POST',
    chemin: '/controle/box/telemetrie',
    horodatage: '2026-10-07T12:00:02.000Z',
    corps: '{"memoire":0.42,"version_desktop":"0.2.0","note":"accentué €"}',
  },
].map((r) => {
  const message = messageASigner(r.methode, r.chemin, r.horodatage, r.corps);
  return { ...r, message, signature: sign(null, Buffer.from(message, 'utf8'), box).toString('base64') };
});

const charge = {
  v: 1,
  device_id: 'BOX-TEMOIN',
  tenant_id: 'T-TEMOIN',
  cle_box: createHash('sha256').update(boxDer).digest('hex'),
  emis_le: '2026-10-07T10:00:00.000Z',
  expire_le: '2026-10-08T10:00:00.000Z',
  droits: [
    { id: 'ENT-1', agent_template_id: 'AG-0179', specialisation_id: null, licence: 'professional', fin: null },
    { id: 'ENT-2', agent_template_id: 'AG-0196', specialisation_id: null, licence: 'essential', fin: '2026-10-07T18:00:00.000Z' },
  ],
};
const texteCharge = b64url(Buffer.from(JSON.stringify(charge), 'utf8'));
const jeton = `${texteCharge}.${b64url(sign(null, Buffer.from(texteCharge, 'ascii'), plateforme))}`;

const temoins = {
  pourquoi:
    'Produit par desktop/check-plateforme.ts depuis plateforme/serveur.ts ; rejoué par le test Rust de plateforme.rs. Ne pas modifier à la main.',
  box: { graine_hex: GRAINE_BOX.toString('hex'), cle_publique_pem: boxPem },
  plateforme: { graine_hex: GRAINE_PLATEFORME.toString('hex'), cle_publique_pem: plateformePem },
  requetes,
  licence: { jeton, charge },
};

if (process.argv.includes('--ecrire')) {
  writeFileSync(fichier, JSON.stringify(temoins, null, 2) + '\n');
  console.log(`  ⟳ ${fichier} écrit`);
}

const lu = existsSync(fichier) ? readFileSync(fichier, 'utf8') : null;
if (lu === null) faute('desktop/temoins-plateforme.json est absent : lancez ce banc avec --ecrire');
else if (lu !== JSON.stringify(temoins, null, 2) + '\n') {
  faute(
    "les témoins ne correspondent plus à ce que le serveur signe : messageASigner ou le format du jeton a changé. " +
      'Si c’est voulu, --ecrire puis relancez les tests Rust.'
  );
}

// The server itself must accept what the vector says the Box sends.
const boxFictive = { identite_publique: boxPem } as Box;
for (const r of requetes) {
  const accepte = signatureBox(boxFictive, r.methode, r.chemin, r.horodatage, r.corps, r.signature, new Date(r.horodatage));
  if (!accepte) faute(`le serveur refuse la requête témoin ${r.methode} ${r.chemin}`);
  const corrompue = signatureBox(boxFictive, r.methode, r.chemin, r.horodatage, r.corps + ' ', r.signature, new Date(r.horodatage));
  if (corrompue) faute(`le serveur accepte un corps modifié sur ${r.chemin} : le banc ne prouve rien`);
}
const [c, s] = jeton.split('.');
if (!verify(null, Buffer.from(c, 'ascii'), createPublicKey(plateformePem), Buffer.from(s, 'base64url'))) {
  faute('le jeton témoin ne se vérifie pas avec la clé publique de la plateforme');
}

// When the controle module ships its verifier, it must agree with the vector.
const verificateur = join(racine, 'plateforme/controle/jeton.ts');
if (existsSync(verificateur)) {
  const mod = await import(verificateur);
  if (typeof mod.verifierJetonLicence === 'function') {
    let r: unknown;
    try {
      r = await mod.verifierJetonLicence(jeton, plateformePem, 'BOX-TEMOIN', new Date('2026-10-07T12:00:00.000Z'));
    } catch (e) {
      r = e;
    }
    const v = r as { valide?: boolean; motif?: string } | null;
    if (!v || v.valide !== true) faute(`plateforme/controle/jeton.ts refuse le jeton témoin : ${v?.motif ?? String(r)}`);
    else console.log('  ⟳ jeton témoin accepté par plateforme/controle/jeton.ts');
  }
}

// --- Every route the Box calls exists, with that method and `box` access ------
//
// plateforme.rs names its routes as string literals: a path renamed on the
// server would only fail at the customer's, with « ne sert pas encore cette
// adresse ». The banc reads them in the Rust file and looks them up in the
// routes the server actually assembles.
const { toutesLesRoutes, creerPlateforme } = await import('../plateforme/serveur.ts');
const rust = readFileSync(join(racine, 'desktop/src-tauri/src/plateforme.rs'), 'utf8');
const appels = [...rust.matchAll(/appel_box\(\s*"(GET|POST|PUT)",\s*(?:&format!\(\s*)?"([^"]+)"/g)].map((m) => ({
  methode: m[1],
  chemin: m[2].replace('{}', ':param'),
}));
if (appels.length < 8) faute(`seulement ${appels.length} appels lus dans plateforme.rs : le banc ne lit plus le fichier`);
const correspond = (modele: string, chemin: string) => {
  const a = modele.split('/').filter(Boolean);
  const b = chemin.split('/').filter(Boolean);
  return a.length === b.length && a.every((x, i) => x.startsWith(':') || b[i].startsWith(':') || x === b[i]);
};
for (const a of appels) {
  const r = (toutesLesRoutes as { methode: string; chemin: string; acces: string }[]).find(
    (x) => x.methode === a.methode && correspond(x.chemin, a.chemin)
  );
  if (!r) faute(`la Box appelle ${a.methode} ${a.chemin}, que le serveur ne sert pas`);
  else if (r.acces !== 'box') faute(`la Box appelle ${a.methode} ${a.chemin}, route « ${r.acces} » et non « box »`);
}
console.log(`  ⟳ ${appels.length} routes appelées par la Box, toutes servies`);

// --- End to end with the real Control Plane: provision, activate, read rights --
//
// The Box side is played here with the témoin seed, which the Rust test proves
// signs exactly like plateforme.rs. The token the real server issues must carry
// every field Rust's `Charge` and `Droit` read, with the types it expects.
{
  const avant = process.env.PLATEFORME_CLE_SIGNATURE;
  process.env.PLATEFORME_CLE_SIGNATURE = plateforme.export({ type: 'pkcs8', format: 'pem' }).toString();
  const secretAdmin = 'secret-admin-du-banc-desktop-assez-long';
  const { serveur } = creerPlateforme({ secretAdmin, fichierDonnees: null });
  await new Promise<void>((r) => serveur.listen(0, '127.0.0.1', r));
  const adr = `http://127.0.0.1:${(serveur.address() as { port: number }).port}`;
  const admin = async (methode: string, chemin: string, corps?: unknown) => {
    const r = await fetch(adr + chemin, {
      method: methode,
      headers: { authorization: `Bearer ${secretAdmin}`, 'content-type': 'application/json' },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
    return { statut: r.status, corps: (await r.json()) as Record<string, unknown> };
  };
  let deviceId = '';
  const parBox = async (methode: string, chemin: string, corps = '') => {
    const h = new Date().toISOString();
    const signature = sign(null, Buffer.from(messageASigner(methode, chemin, h, corps), 'utf8'), box).toString('base64');
    const r = await fetch(adr + chemin, {
      method: methode,
      headers: { 'x-box-id': deviceId, 'x-horodatage': h, 'x-signature': signature, 'content-type': 'application/json' },
      body: corps || undefined,
    });
    return { statut: r.status, corps: (await r.json()) as Record<string, unknown> };
  };
  try {
    const t = await admin('POST', '/controle/tenants', { nom: 'Client du banc desktop', segment: 'business', pays: 'FR' });
    const b = await admin('POST', '/controle/boxes', { serial: 'SN-BANC-DESKTOP', gamme: 'business', identite_publique: boxPem, os: 'ubuntu-core', version_desktop: '0.2.0' });
    deviceId = String(b.corps.device_id ?? '');
    await admin('POST', `/controle/boxes/${deviceId}/attribuer`, { tenant_id: t.corps.tenant_id, plan_id: 'box-commander-36' });
    const actif = await admin('POST', `/controle/boxes/${deviceId}/statut`, { statut: 'active', motif: 'banc desktop' });
    const ent = await admin('POST', '/controle/entitlements', {
      tenant_id: t.corps.tenant_id, device_id: deviceId, agent_template_id: 'AG-0179', licence: 'professional',
      debut: new Date(Date.now() - 3600_000).toISOString(),
    });
    if (actif.statut !== 200 || ent.statut !== 201) faute(`provisioning de banc refusé : ${JSON.stringify(actif.corps)} ${JSON.stringify(ent.corps)}`);

    const cp = await fetch(adr + '/controle/cle-publique').then((r) => r.json() as Promise<{ cle_publique?: string }>);
    if (cp.cle_publique !== plateformePem) faute('GET /controle/cle-publique ne rend pas la clé attendue sous « cle_publique »');

    const d = await parBox('GET', '/controle/box/droits');
    const jetonReel = String(d.corps.jeton ?? '');
    const [cr, sr] = jetonReel.split('.');
    if (d.statut !== 200 || !cr || !sr) faute(`GET /controle/box/droits ne rend pas de jeton : ${JSON.stringify(d.corps)}`);
    else {
      if (!verify(null, Buffer.from(cr, 'ascii'), createPublicKey(plateformePem), Buffer.from(sr, 'base64url'))) {
        faute('le jeton du Control Plane ne se vérifie pas comme plateforme.rs le vérifie (signature sur le texte de la charge)');
      }
      const c = JSON.parse(Buffer.from(cr, 'base64url').toString('utf8')) as Record<string, unknown>;
      for (const champ of ['device_id', 'emis_le', 'expire_le']) {
        if (typeof c[champ] !== 'string') faute(`le jeton réel n'a pas « ${champ} » en texte, que plateforme.rs exige`);
      }
      if (c.device_id !== deviceId) faute('le jeton réel ne porte pas le device_id de la Box');
      if (c.cle_box !== createHash('sha256').update(boxDer).digest('hex')) faute('« cle_box » du jeton réel n’est pas le SHA-256 du DER de la clé de la Box');
      const droits = c.droits as Record<string, unknown>[];
      if (!Array.isArray(droits) || droits.length !== 1) faute('le jeton réel ne porte pas le droit ouvert');
      else {
        for (const champ of ['id', 'agent_template_id', 'licence']) {
          if (typeof droits[0][champ] !== 'string') faute(`un droit du jeton réel n'a pas « ${champ} » en texte`);
        }
        for (const champ of ['specialisation_id', 'fin']) {
          if (!(champ in droits[0])) faute(`un droit du jeton réel n'a pas « ${champ} » (même nul)`);
        }
        if (droits[0].agent_template_id !== 'AG-0179') faute('le droit du jeton réel ne nomme pas AG-0179');
      }
      console.log(`  ⟳ jeton du vrai Control Plane lu de bout en bout (${deviceId})`);
    }
    // The body `corps_telemetrie` builds (percent, absent measures left out).
    const tel = await parBox('POST', '/controle/box/telemetrie', '{"cpu":100.0,"memoire":50.0,"temperature":51.0,"version_desktop":"0.2.0"}');
    const s = (tel.corps.sante ?? {}) as Record<string, unknown>;
    if (tel.statut !== 200 || s.memoire !== 50 || 'disque' in s) faute(`la télémétrie de la Box est mal reçue : ${JSON.stringify(tel.corps)}`);
  } finally {
    serveur.close();
    if (avant === undefined) delete process.env.PLATEFORME_CLE_SIGNATURE;
    else process.env.PLATEFORME_CLE_SIGNATURE = avant;
  }
}

console.log(`  ⟳ ${requetes.length} requêtes témoins, 1 jeton témoin`);
console.log(`plateforme (Box) : ${fautes} faute(s)`);
if (fautes) process.exit(1);
