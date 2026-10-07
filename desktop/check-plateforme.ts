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
    const refuse = r instanceof Error || r === false || r === null || (typeof r === 'object' && r !== null && 'erreur' in r);
    if (refuse) faute(`plateforme/controle/jeton.ts refuse le jeton témoin : ${String((r as Error)?.message ?? JSON.stringify(r))}`);
    else console.log('  ⟳ jeton témoin accepté par plateforme/controle/jeton.ts');
  }
}

console.log(`  ⟳ ${requetes.length} requêtes témoins, 1 jeton témoin`);
console.log(`plateforme (Box) : ${fautes} faute(s)`);
if (fautes) process.exit(1);
