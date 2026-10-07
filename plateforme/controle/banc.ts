// Banc du Control Plane : parle à un vrai serveur sur 127.0.0.1 (creerPlateforme),
// signe comme une vraie Box, et rejoue chaque garde du module. Lancé par
// plateforme/banc.ts (npm run controle) ou seul :
//   node --experimental-strip-types plateforme/controle/banc.ts
import { createHash, createPublicKey, generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { creerPlateforme, messageASigner } from '../serveur.ts';
import { Stockage } from '../stockage.ts';
import { routes } from './routes.ts';
import { detecterDonneeClient, refusDonneeClient } from './detecteur.ts';
import { empreinteFiche, signerJetonLicence, verifierJetonLicence, type ContenuJeton } from './jeton.ts';
import { cheminFiche, comparerVersions } from './regles.ts';
import {
  bruteX25519, chiffrerSkill, cleDeriveePourTemoin, clePriveeEd25519DepuisGraine, clePriveeX25519, dechiffrerSkillPourBanc, infoSkill,
  messageSkill, signerSkill, verifierSignatureSkill,
} from './scellement.ts';
import { auditer } from './audit.ts';

const FICHIER_TEMOINS = fileURLToPath(new URL('./temoins-signature.json', import.meta.url));
const H = 3600_000;
const graine = (t: string) => createHash('sha256').update(t).digest();
const brut32 = (t: string) => graine(t).toString('base64url');

/**
 * Frozen vectors for the Box side (desktop replays them in Rust): fixed keys,
 * fixed ephemeral key and nonce, expected outputs. Deterministic: Ed25519
 * signatures are, and nothing here draws randomness.
 */
export function temoinsSignature() {
  const plateforme = clePriveeEd25519DepuisGraine(graine('iagent-temoin-plateforme'));
  const plateformePem = createPublicKey(plateforme).export({ type: 'spki', format: 'pem' }).toString();
  const boxPrivee = brut32('iagent-temoin-box-x25519');
  const boxPublique = bruteX25519(createPublicKey(clePriveeX25519(boxPrivee)));
  const ephemerePrivee = brut32('iagent-temoin-ephemere');
  const nonce = graine('iagent-temoin-nonce').subarray(0, 12);
  const deviceId = 'BOX-TEMOIN';
  const skillPackId = 'temoin-skill';
  const version = '1.2.3';
  const contenu = 'Rapprocher le relevé bancaire avec le grand livre ; lister les écarts — « accents » et €.';
  const empreinte = createHash('sha256').update(contenu, 'utf8').digest('hex');
  const ficheOctets = '{"id":"AG-TEMOIN","nom":"Témoin"}\n';
  const charge: ContenuJeton = {
    v: 2, device_id: deviceId, tenant_id: 'T-TEMOIN',
    cle_box: createHash('sha256').update('cle-box-temoin').digest('hex'),
    emis_le: '2026-10-07T10:00:00.000Z', expire_le: '2026-10-08T10:00:00.000Z', grace_jusqu_au: '2026-10-10T10:00:00.000Z',
    droits: [{ id: 'ENT-1', agent_template_id: 'AG-0001', specialisation_id: null, licence: 'professional', fin: null,
      empreinte_fiche: createHash('sha256').update(ficheOctets, 'utf8').digest('hex') }],
  };
  const jeton = signerJetonLicence(charge, plateforme);
  const emis = Date.parse(charge.emis_le);
  const verifications = [
    { cas: 'joignable, 23 h après émission', maintenant: new Date(emis + 23 * H).toISOString(), injoignable: false },
    { cas: 'injoignable, 30 h après émission : grâce', maintenant: new Date(emis + 30 * H).toISOString(), injoignable: true },
    { cas: 'joignable, 30 h après émission : expiré', maintenant: new Date(emis + 30 * H).toISOString(), injoignable: false },
    { cas: 'injoignable, 73 h après émission : grâce dépassée', maintenant: new Date(emis + 73 * H).toISOString(), injoignable: true },
  ].map((v) => ({ ...v, valide: verifierJetonLicence(jeton, plateformePem, deviceId, new Date(v.maintenant), v.injoignable).valide }));
  const info = infoSkill(deviceId, skillPackId, version);
  const scelle = chiffrerSkill({ contenu, deviceId, skillPackId, version, cleBoxPublique: boxPublique, ephemerePrivee, nonce });
  return {
    pourquoi: 'Produit par plateforme/controle/banc.ts (--ecrire) depuis scellement.ts et jeton.ts ; rejoué par le Rust du desktop. Ne pas modifier à la main.',
    plateforme: { graine_ed25519_hex: graine('iagent-temoin-plateforme').toString('hex'), cle_publique_pem: plateformePem },
    fiche: { octets_utf8: ficheOctets, empreinte_sha256: charge.droits[0].empreinte_fiche },
    jeton: { charge, jeton, verifications },
    skill: {
      skill_pack_id: skillPackId, version, contenu, empreinte,
      message_signe: messageSkill(skillPackId, version, empreinte),
      signature: signerSkill(skillPackId, version, empreinte, plateforme),
    },
    chiffrement: {
      device_id: deviceId,
      box_x25519_privee: boxPrivee, box_x25519_publique: boxPublique,
      ephemere_x25519_privee: ephemerePrivee, ephemere_publique: scelle.ephemere_publique,
      nonce: scelle.nonce, info, cle_derivee_hex: cleDeriveePourTemoin(ephemerePrivee, boxPublique, info),
      chiffre: scelle.chiffre,
    },
  };
}

export async function lancer(): Promise<number> {
  let fautes = 0;
  let controles = 0;
  const verifier = (quoi: string, vrai: boolean) => {
    controles++;
    if (vrai) console.log(`  ok  ${quoi}`);
    else { fautes++; console.log(`  FAUTE  ${quoi}`); }
  };

  // --- pure pieces --------------------------------------------------------------
  const positifs: [string, string][] = [
    ['Écrire à jean.dupont@exemple.fr pour confirmer', 'adresse e-mail'],
    ['Appeler le 06 12 34 56 78 le matin', 'numéro de téléphone'],
    ['Joindre le +33 6 12 34 56 78', 'numéro de téléphone'],
    ['Virement sur FR76 3000 6000 0112 3456 7890 189', 'IBAN'],
    ['Client SIRET 732 829 320 00074', 'SIRET ou SIREN'],
    ['Payer avec la carte 4111 1111 1111 1111', 'numéro de carte bancaire'],
    ['Assuré 1 85 05 78 006 084 91', 'numéro de sécurité sociale'],
    ['Utiliser la clé sk-ant-abcdefghijklmnopqrstu', 'secret ou clé d’accès'],
    ['Facturer 1 200 € à Dupont chaque mois', 'montant rattaché à un nom propre'],
    ['Relancer M. Martin pour 300 €', 'montant rattaché à un nom propre'],
  ];
  for (const [t, type] of positifs) verifier(`détecteur : « ${t} » → ${type}`, detecterDonneeClient(t).includes(type as never));
  const negatifs = [
    'Saisir la facture dans Pennylane puis rapprocher le relevé.',
    'Le montant de 1 200 € est saisi dans Sage 100.',
    'Contrôler la TVA à 20 % sur chaque ligne HT.',
    'Vérifier les 3 relances de la semaine 42 et les 12 dossiers.',
    'Exporter le grand livre en CSV puis le classer par compte 401.',
    'Une référence qui a la forme d’un IBAN sans en être un : XK42 ABCD EFGH IJKL MN',
  ];
  for (const t of negatifs) verifier(`détecteur laisse passer : « ${t} »`, detecterDonneeClient(t).length === 0);
  const refusIban = refusDonneeClient({ a: ['ok', { b: 'FR76 3000 6000 0112 3456 7890 189' }] }) ?? '';
  verifier('détecteur fouille les champs imbriqués et ne recopie pas la valeur', refusIban.includes('IBAN') && !refusIban.includes('3000'));

  verifier('versions comparées par nombres : 0.10.0 > 0.9.0', comparerVersions('0.10.0', '0.9.0') > 0);
  verifier('une pré-version précède sa version : 1.0.0-beta.2 < 1.0.0', comparerVersions('1.0.0-beta.2', '1.0.0') < 0);
  verifier('pré-versions par nombres : beta.10 > beta.9', comparerVersions('1.0.0-beta.10', '1.0.0-beta.9') > 0);

  // --- frozen vectors shared with the Box --------------------------------------
  const t = temoinsSignature();
  const texteTemoins = JSON.stringify(t, null, 2) + '\n';
  if (process.argv.includes('--ecrire')) { writeFileSync(FICHIER_TEMOINS, texteTemoins); console.log(`  ⟳ ${FICHIER_TEMOINS} écrit`); }
  verifier('temoins-signature.json correspond à ce que signent et chiffrent jeton.ts et scellement.ts (sinon --ecrire, et prévenir desktop)',
    existsSync(FICHIER_TEMOINS) && readFileSync(FICHIER_TEMOINS, 'utf8') === texteTemoins);
  verifier('témoin de grâce : valide à 23 h, valide à 30 h injoignable, refusé à 30 h joignable, refusé à 73 h injoignable',
    t.jeton.verifications.map((v) => v.valide).join() === 'true,true,false,false');
  verifier('témoin : le chiffré se rouvre avec la clé de la Box et rend le contenu',
    dechiffrerSkillPourBanc({ ...t.chiffrement, clePriveeBox: t.chiffrement.box_x25519_privee, deviceId: t.chiffrement.device_id, skillPackId: t.skill.skill_pack_id, version: t.skill.version }) === t.skill.contenu);
  verifier('témoin : la signature du Skill Pack se vérifie', verifierSignatureSkill(t.skill.skill_pack_id, t.skill.version, t.skill.empreinte, t.skill.signature, t.plateforme.cle_publique_pem));

  // v1 tokens are refused outright.
  {
    const p = clePriveeEd25519DepuisGraine(graine('iagent-temoin-plateforme'));
    const ancien = signerJetonLicence({ ...t.jeton.charge, v: 1 } as unknown as ContenuJeton, p);
    const r1 = verifierJetonLicence(ancien, t.plateforme.cle_publique_pem, 'BOX-TEMOIN', new Date('2026-10-07T12:00:00Z'));
    verifier('un jeton v1, même bien signé, est refusé', !r1.valide && /périmée/.test(r1.motif));
    const sansFiche = signerJetonLicence({ ...t.jeton.charge, droits: [{ ...t.jeton.charge.droits[0], empreinte_fiche: '' }] }, p);
    verifier("un jeton dont un droit n'a pas d'empreinte de fiche est refusé", !verifierJetonLicence(sansFiche, t.plateforme.cle_publique_pem, 'BOX-TEMOIN', new Date('2026-10-07T12:00:00Z')).valide);
  }

  // One byte changed in a sheet changes its hash.
  {
    const dossier = mkdtempSync(join(tmpdir(), 'fiche-'));
    try {
      const origine = cheminFiche('AG-0001')!;
      const octets = readFileSync(origine);
      const copie = join(dossier, 'AG-0001.json');
      writeFileSync(copie, octets);
      const meme = empreinteFiche(copie) === empreinteFiche(origine);
      const change = Buffer.from(octets);
      change[Math.floor(change.length / 2)] ^= 0x01;
      writeFileSync(copie, change);
      verifier("une fiche modifiée d'un octet change son empreinte", meme && empreinteFiche(copie) !== empreinteFiche(origine));
    } finally { rmSync(dossier, { recursive: true, force: true }); }
  }

  let refusAudit = false;
  try { auditer(new Stockage(null), new Date(), { tenant_id: null, acteur: 'x', action: 'y', cible: 'z', detail: '-----BEGIN PRIVATE KEY-----' }); } catch { refusAudit = true; }
  verifier("l'audit refuse une trace qui porterait un secret", refusAudit);

  // --- a real server --------------------------------------------------------------
  const avant = process.env.PLATEFORME_CLE_SIGNATURE;
  delete process.env.PLATEFORME_CLE_SIGNATURE;
  const plateforme = generateKeyPairSync('ed25519');
  const clePlateformePem = plateforme.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const autreCle = generateKeyPairSync('ed25519');

  const horloge = Date.parse('2026-10-07T09:00:00.000Z');
  const maintenant = () => new Date(horloge);
  const secret = 'secret-admin-du-banc-controle-assez-long';
  const stockage = new Stockage(null);
  const { serveur } = creerPlateforme({ secretAdmin: secret, fichierDonnees: null }, { stockage, maintenant, routes });
  await new Promise<void>((r) => serveur.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;

  type R = { statut: number; corps: any };
  const lire = async (r: Response): Promise<R> => ({ statut: r.status, corps: await r.json().catch(() => null) });
  const admin = async (methode: string, chemin: string, corps?: unknown): Promise<R> =>
    lire(await fetch(`${base}${chemin}`, {
      method: methode, headers: { authorization: `Bearer ${secret}` },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    }));
  const publique = async (chemin: string): Promise<R> => lire(await fetch(`${base}${chemin}`));
  const parBox = async (cle: KeyObject, id: string, methode: string, chemin: string, corps?: unknown): Promise<R> => {
    const brut = corps === undefined ? '' : JSON.stringify(corps);
    const h = maintenant().toISOString();
    const sig = sign(null, Buffer.from(messageASigner(methode, chemin.split('?')[0], h, brut)), cle).toString('base64');
    return lire(await fetch(`${base}${chemin}`, {
      method: methode, body: brut || undefined,
      headers: { 'x-box-id': id, 'x-horodatage': h, 'x-signature': sig },
    }));
  };
  const pemPublic = (k: KeyObject) => k.export({ type: 'spki', format: 'pem' }).toString();

  try {
    // Signing key absent: the routes say so instead of pretending.
    let r = await publique('/controle/cle-publique');
    verifier('sans PLATEFORME_CLE_SIGNATURE, la clé publique est refusée en le disant', r.statut === 503 && /PLATEFORME_CLE_SIGNATURE/.test(r.corps?.erreur));

    // Tenants
    verifier('créer un client exige le back-office', (await lire(await fetch(`${base}/controle/tenants`, { method: 'POST', body: '{}' }))).statut === 401);
    r = await admin('POST', '/controle/tenants', { nom: 'Atelier', segment: 'business', pays: 'france' });
    verifier('un pays mal écrit est refusé', r.statut === 400);
    const tA = (await admin('POST', '/controle/tenants', { nom: 'Atelier Nord', segment: 'business', pays: 'FR', opt_in_skills: true })).corps;
    const tB = (await admin('POST', '/controle/tenants', { nom: 'Cabinet Sud', segment: 'business', pays: 'FR' })).corps;
    verifier('opt_in_skills est faux par défaut', tB?.opt_in_skills === false && tA?.opt_in_skills === true);
    verifier('lister les clients', (await admin('GET', '/controle/tenants')).corps?.length === 2);

    // Provisioning
    const k1 = generateKeyPairSync('ed25519');
    const k2 = generateKeyPairSync('ed25519');
    const k3 = generateKeyPairSync('ed25519');
    const x1 = generateKeyPairSync('x25519');
    const x2 = generateKeyPairSync('x25519');
    const brutePrivee = (k: KeyObject) => k.export({ type: 'pkcs8', format: 'der' }).subarray(16).toString('base64url');
    const boxDe = (serial: string, k: { publicKey: KeyObject }, xk?: { publicKey: KeyObject }) => ({ serial, gamme: 'business', identite_publique: pemPublic(k.publicKey), os: 'ubuntu-core-24', version_desktop: '0.2.1', ...(xk ? { cle_chiffrement_publique: bruteX25519(xk.publicKey) } : {}) });
    verifier('une clé de chiffrement qui ne fait pas 32 octets est refusée', (await admin('POST', '/controle/boxes', { ...boxDe('SN-XC', k1), cle_chiffrement_publique: Buffer.alloc(31, 7).toString('base64url') })).statut === 400);
    r = await admin('POST', '/controle/boxes', { ...boxDe('SN-PRIV', k1), identite_publique: k1.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() });
    verifier('une clé PRIVÉE envoyée au provisioning est refusée', r.statut === 400 && /PRIVÉE/.test(r.corps?.erreur));
    const x = generateKeyPairSync('x25519');
    verifier("une clé qui n'est pas Ed25519 est refusée", (await admin('POST', '/controle/boxes', { ...boxDe('SN-X', k1), identite_publique: pemPublic(x.publicKey) })).statut === 400);
    const b1 = (await admin('POST', '/controle/boxes', boxDe('SN-001', k1, x1))).corps;
    verifier('une Box provisionnée entre en stock, identifiée par sa clé', b1?.statut === 'stock' && /^BOX-[0-9a-f]{16}$/.test(b1?.device_id) && b1?.tenant_id === null);
    verifier('numéro de série unique', (await admin('POST', '/controle/boxes', boxDe('SN-001', k2))).statut === 409);
    verifier('une clé publique ne sert qu’à une Box', (await admin('POST', '/controle/boxes', boxDe('SN-009', k1))).statut === 409);
    verifier('une clé de chiffrement ne sert qu’à une Box', (await admin('POST', '/controle/boxes', boxDe('SN-008', k2, x1))).statut === 409);
    const b2 = (await admin('POST', '/controle/boxes', boxDe('SN-002', k2, x2))).corps;
    const b3 = (await admin('POST', '/controle/boxes', boxDe('SN-003', k3))).corps;
    verifier('inventaire filtré par statut', (await admin('GET', '/controle/boxes?statut=stock')).corps?.length === 3);
    verifier('une Box inconnue rend 404', (await admin('GET', '/controle/boxes/BOX-0000000000000000')).statut === 404);

    // Status transitions
    verifier('stock → active refusé (il faut attribuer)', (await admin('POST', `/controle/boxes/${b1.device_id}/statut`, { statut: 'active', motif: 'essai' })).statut === 409);
    verifier('un statut hors contrat est refusé', (await admin('POST', `/controle/boxes/${b1.device_id}/statut`, { statut: 'stock', motif: 'essai' })).statut === 400);
    r = await admin('POST', `/controle/boxes/${b1.device_id}/attribuer`, { tenant_id: tA.tenant_id, plan_id: 'box-commander-36' });
    verifier('attribuer : stock → provisionnee', r.corps?.statut === 'provisionnee' && r.corps?.tenant_id === tA.tenant_id);
    verifier('une Box déjà attribuée ne se réattribue pas', (await admin('POST', `/controle/boxes/${b1.device_id}/attribuer`, { tenant_id: tB.tenant_id, plan_id: 'x' })).statut === 409);
    verifier('provisionnee → remplacee refusé', (await admin('POST', `/controle/boxes/${b1.device_id}/statut`, { statut: 'remplacee', motif: 'essai' })).statut === 409);
    verifier('un changement de statut sans motif est refusé', (await admin('POST', `/controle/boxes/${b1.device_id}/statut`, { statut: 'active' })).statut === 400);
    await admin('POST', `/controle/boxes/${b2.device_id}/attribuer`, { tenant_id: tB.tenant_id, plan_id: 'box-commander-36' });
    await admin('POST', `/controle/boxes/${b3.device_id}/attribuer`, { tenant_id: tA.tenant_id, plan_id: 'box-commander-24' });

    // Entitlements
    const droit = (t: any, b: any, agent: string, extra: Record<string, unknown> = {}) =>
      admin('POST', '/controle/entitlements', { tenant_id: t.tenant_id, device_id: b.device_id, agent_template_id: agent, specialisation_id: null, licence: 'professional', debut: '2026-10-01T00:00:00Z', fin: null, ...extra });
    verifier("un agent absent d'agents/ et de socle/ est refusé", (await droit(tA, b1, 'AG-9999')).statut === 400);
    verifier('une licence inconnue est refusée', (await droit(tA, b1, 'AG-0001', { licence: 'platine' })).statut === 400);
    verifier('une fin avant le début est refusée', (await droit(tA, b1, 'AG-0001', { fin: '2026-09-01T00:00:00Z' })).statut === 400);
    verifier("un droit sur la Box d'un autre client est refusé", (await droit(tA, b2, 'AG-0001')).statut === 409);
    const e1 = (await droit(tA, b1, 'AG-0001')).corps;
    const e0 = (await droit(tA, b1, 'AG-0000', { licence: 'commander' })).corps;
    const eCourt = (await droit(tA, b1, 'AG-0002', { fin: '2026-10-07T10:00:00Z' })).corps;
    verifier('droits créés (agents/ et socle/)', e1?.statut === 'active' && e0?.statut === 'active' && eCourt?.statut === 'active');
    verifier('un même droit actif ne se crée pas deux fois', (await droit(tA, b1, 'AG-0001')).statut === 409);
    const eB = (await droit(tB, b2, 'AG-0003')).corps;
    verifier('entitlements filtrés par client', (await admin('GET', `/controle/entitlements?tenant_id=${tB.tenant_id}`)).corps?.map((e: any) => e.id).join() === eB?.id);

    // Rights of a Box
    r = await parBox(k1.privateKey, b1.device_id, 'GET', '/controle/box/droits');
    verifier("une Box provisionnée mais pas activée n'a aucun droit", r.statut === 403);
    await admin('POST', `/controle/boxes/${b1.device_id}/statut`, { statut: 'active', motif: 'installée chez le client' });
    await admin('POST', `/controle/boxes/${b2.device_id}/statut`, { statut: 'active', motif: 'installée' });
    await admin('POST', `/controle/boxes/${b3.device_id}/statut`, { statut: 'active', motif: 'installée' });
    r = await parBox(k1.privateKey, b1.device_id, 'GET', '/controle/box/droits');
    verifier('sans PLATEFORME_CLE_SIGNATURE, aucun jeton : refus qui le dit', r.statut === 503 && /PLATEFORME_CLE_SIGNATURE/.test(r.corps?.erreur));
    process.env.PLATEFORME_CLE_SIGNATURE = clePlateformePem.replace(/\n/g, '\\n'); // as an env file would carry it
    const cle = (await publique('/controle/cle-publique')).corps;
    verifier('la clé publique de la plateforme se lit', cle?.algorithme === 'Ed25519' && /BEGIN PUBLIC KEY/.test(cle?.cle_publique) && !/PRIVATE/.test(JSON.stringify(cle)));
    r = await parBox(k1.privateKey, b1.device_id, 'GET', '/controle/box/droits');
    const jeton: string = r.corps?.jeton;
    verifier('une Box active reçoit ses droits et un jeton', r.statut === 200 && r.corps?.droits?.length === 3 && typeof jeton === 'string');
    verifier("une Box ne reçoit que les droits de SON client", !r.corps?.droits?.some((e: any) => e.id === eB.id));
    const v = verifierJetonLicence(jeton, cle.cle_publique, b1.device_id, maintenant(), false, pemPublic(k1.publicKey));
    verifier('le jeton se vérifie pour cette Box et cette clé', v.valide && v.droits.length === 3 && v.contenu.tenant_id === tA.tenant_id);
    verifier('le jeton vaut 24 h', v.valide && Date.parse(v.contenu.expire_le) - horloge === 24 * 3600_000);
    verifier('jeton refusé pour une autre Box', !verifierJetonLicence(jeton, cle.cle_publique, b2.device_id, maintenant()).valide);
    verifier('jeton refusé pour une autre clé de Box', !verifierJetonLicence(jeton, cle.cle_publique, b1.device_id, maintenant(), false, pemPublic(k2.publicKey)).valide);
    const expire = verifierJetonLicence(jeton, cle.cle_publique, b1.device_id, new Date(horloge + 24 * 3600_000 + 1));
    verifier('jeton refusé une fois expiré', !expire.valide && /expiré/.test(expire.motif));
    verifier('jeton refusé si la clé publique annoncée est une autre', !verifierJetonLicence(jeton, pemPublic(autreCle.publicKey), b1.device_id, maintenant()).valide);
    const [charge] = jeton.split('.');
    const contenu: ContenuJeton = JSON.parse(Buffer.from(charge, 'base64url').toString('utf8'));
    const falsifie = signerJetonLicence({ ...contenu }, autreCle.privateKey);
    verifier('jeton signé par une autre clé refusé', !verifierJetonLicence(falsifie, cle.cle_publique, b1.device_id, maintenant()).valide);
    const gonfle = `${Buffer.from(JSON.stringify({ ...contenu, expire_le: '2099-01-01T00:00:00.000Z' })).toString('base64url')}.${jeton.split('.')[1]}`;
    verifier('jeton dont la charge est modifiée refusé', !verifierJetonLicence(gonfle, cle.cle_publique, b1.device_id, maintenant()).valide);
    const plusTard = verifierJetonLicence(jeton, cle.cle_publique, b1.device_id, new Date(horloge + 2 * 3600_000));
    verifier("un droit dont la fin est passée tombe du jeton avant l'expiration du jeton", plusTard.valide && plusTard.droits.length === 2 && !plusTard.droits.some((d) => d.id === eCourt.id));
    verifier('jeton v2 : chaque droit porte l’empreinte des octets exacts de sa fiche',
      v.valide && v.contenu.v === 2 && v.contenu.droits.every((d) => d.empreinte_fiche === empreinteFiche(cheminFiche(d.agent_template_id)!)));
    verifier('grâce hors ligne : émission + 72 h, signée dans la charge', v.valide && Date.parse(v.contenu.grace_jusqu_au) - horloge === 72 * H && r.corps?.grace_jusqu_au === v.contenu.grace_jusqu_au);
    verifier('grâce : valide à 30 h si la plateforme est injoignable', verifierJetonLicence(jeton, cle.cle_publique, b1.device_id, new Date(horloge + 30 * H), true).valide);
    verifier('grâce : refusé à 30 h si la plateforme est joignable', !verifierJetonLicence(jeton, cle.cle_publique, b1.device_id, new Date(horloge + 30 * H), false).valide);
    const audela = verifierJetonLicence(jeton, cle.cle_publique, b1.device_id, new Date(horloge + 73 * H), true);
    verifier('grâce : refusé à 73 h même injoignable', !audela.valide && /72 heures/.test(audela.motif));
    verifier('signature sur les octets de la charge (format convenu avec desktop)',
      (await import('node:crypto')).verify(null, Buffer.from(charge, 'ascii'), (await import('node:crypto')).createPublicKey(cle.cle_publique), Buffer.from(jeton.split('.')[1], 'base64url')));

    // Revocation is immediate
    r = await admin('POST', `/controle/entitlements/${e1.id}/revoquer`, { motif: 'abonnement arrêté' });
    verifier('révoquer un droit', r.corps?.statut === 'revoquee');
    r = await parBox(k1.privateKey, b1.device_id, 'GET', '/controle/box/droits');
    const apres = verifierJetonLicence(r.corps?.jeton, cle.cle_publique, b1.device_id, maintenant());
    verifier('la révocation joue au prochain appel de la Box (droits et jeton)', r.statut === 200 && !r.corps.droits.some((e: any) => e.id === e1.id)
      && apres.valide && apres.droits.length === 2 && !apres.droits.some((d) => d.id === e1.id));
    verifier('un droit révoqué ne se révoque pas deux fois', (await admin('POST', `/controle/entitlements/${e1.id}/revoquer`, { motif: 'x' })).statut === 409);
    verifier('une révocation sans motif est refusée', (await admin('POST', `/controle/entitlements/${e0.id}/revoquer`, {})).statut === 400);

    // Suspension: no rights at all
    await admin('POST', `/controle/boxes/${b1.device_id}/statut`, { statut: 'suspendue', motif: 'impayé' });
    verifier('Box suspendue : plus aucun droit', (await parBox(k1.privateKey, b1.device_id, 'GET', '/controle/box/droits')).statut === 403);
    verifier('Box suspendue : plus aucun Skill Pack', (await parBox(k1.privateKey, b1.device_id, 'GET', '/controle/box/skills')).statut === 403);
    verifier('Box suspendue : plus de mises à jour', (await parBox(k1.privateKey, b1.device_id, 'GET', '/controle/box/mises-a-jour')).statut === 403);
    await admin('POST', `/controle/boxes/${b1.device_id}/statut`, { statut: 'active', motif: 'régularisé' });
    r = await parBox(k1.privateKey, b1.device_id, 'GET', '/controle/box/droits');
    verifier('réactivée, la Box retrouve ses droits non révoqués, et eux seuls', r.statut === 200 && r.corps.droits.length === 2 && !r.corps.droits.some((e: any) => e.id === e1.id));
    verifier("une Box ne se fait pas passer pour une autre (signée par la mauvaise clé)", (await parBox(k2.privateKey, b1.device_id, 'GET', '/controle/box/droits')).statut === 401);

    // Telemetry
    verifier('une mesure hors bornes est refusée', (await parBox(k1.privateKey, b1.device_id, 'POST', '/controle/box/telemetrie', { cpu: 150, version_desktop: '0.2.1' })).statut === 400);
    r = await parBox(k1.privateKey, b1.device_id, 'POST', '/controle/box/telemetrie', { cpu: 37, memoire: 61, disque: 40, temperature: 52, version_desktop: '0.2.2' });
    const vue = (await admin('GET', `/controle/boxes/${b1.device_id}`)).corps;
    verifier('la dernière santé est posée sur la Box', r.statut === 200 && vue?.sante?.cpu === 37 && vue?.sante?.temperature === 52 && vue?.version_desktop === '0.2.2' && vue?.sante?.vu_le === maintenant().toISOString());

    // Updates
    const maj = (extra: Record<string, unknown>) => admin('POST', '/controle/mises-a-jour', { composant: 'desktop', canal: 'stable', version: '0.3.0', url: 'https://maj.iagent.agency/desktop-0.3.0.msi', empreinte: 'a'.repeat(64), ...extra });
    verifier('mise à jour en http refusée', (await maj({ url: 'http://maj.iagent.agency/x.msi' })).statut === 400);
    verifier('mise à jour sans empreinte refusée', (await maj({ empreinte: undefined })).statut === 400);
    verifier('mise à jour à empreinte mal formée refusée', (await maj({ empreinte: 'abc' })).statut === 400);
    verifier('mise à jour à composant inconnu refusée', (await maj({ composant: 'bios' })).statut === 400);
    verifier('publier une mise à jour', (await maj({})).statut === 201);
    verifier('une mise à jour ne se republie pas', (await maj({})).statut === 409);
    verifier('une mise à jour ne recule pas', (await maj({ version: '0.2.9' })).statut === 409);
    await maj({ version: '0.4.0-beta.1', canal: 'beta' });
    r = await parBox(k1.privateKey, b1.device_id, 'GET', '/controle/box/mises-a-jour');
    const d = r.corps?.mises_a_jour?.find((m: any) => m.composant === 'desktop');
    verifier('la Box voit la version visée sur son canal, et qu’elle est en retard', d?.version === '0.3.0' && d?.a_jour === false && d?.actuelle === '0.2.2');

    // Skill Packs
    const contenuSkill = 'Rapprocher le relevé bancaire mensuel avec le grand livre, puis lister les écarts par compte.';
    const pack = (extra: Record<string, unknown> = {}) => ({
      skill_pack_id: 'rapprochement-bancaire', version: '1.0.0', compatible_agents: ['AG-0002'], compatible_tools: ['LOG-0001'],
      sector_scope: ['comptabilite'], locale: 'fr-FR', changelog: 'Première version.', contenu: contenuSkill,
      empreinte: createHash('sha256').update(contenuSkill).digest('hex'), ...extra,
    });
    verifier('Skill Pack pour un agent inconnu refusé', (await admin('POST', '/controle/skills', pack({ compatible_agents: ['AG-9999'] }))).statut === 400);
    verifier('Skill Pack sans empreinte refusé', (await admin('POST', '/controle/skills', pack({ empreinte: undefined }))).statut === 400);
    verifier("Skill Pack dont l'empreinte ne correspond pas au contenu refusé", (await admin('POST', '/controle/skills', pack({ empreinte: 'b'.repeat(64) }))).statut === 400);
    r = await admin('POST', '/controle/skills', pack({ changelog: 'Retours de jean.dupont@exemple.fr intégrés.' }));
    verifier('Skill Pack déposé avec une donnée client refusé', r.statut === 422 && !/jean\.dupont/.test(r.corps?.erreur));
    r = await admin('POST', '/controle/skills', pack());
    const sk = r.corps;
    verifier('un Skill Pack déposé est candidat', r.statut === 201 && sk?.validation_status === 'candidat' && sk?.id === 'rapprochement-bancaire@1.0.0');
    verifier('une version ne se redépose pas', (await admin('POST', '/controle/skills', pack())).statut === 409);
    verifier('une version ne recule pas', (await admin('POST', '/controle/skills', pack({ version: '0.9.0' }))).statut === 409);
    const skillsDeB1 = async () => (await parBox(k1.privateKey, b1.device_id, 'GET', '/controle/box/skills')).corps ?? [];
    verifier("un candidat n'atteint aucune Box", (await skillsDeB1()).length === 0);
    const revue = (id: string, decision: string) => admin('POST', `/controle/skills/${encodeURIComponent(id)}/revue`, { decision, motif: 'relu' });
    verifier('candidat → valide refusé (il faut la revue)', (await revue(sk.id, 'valide')).statut === 409);
    verifier('une revue sans motif est refusée', (await admin('POST', `/controle/skills/${encodeURIComponent(sk.id)}/revue`, { decision: 'en-revue' })).statut === 400);
    verifier('candidat → en-revue', (await revue(sk.id, 'en-revue')).corps?.validation_status === 'en-revue');
    delete process.env.PLATEFORME_CLE_SIGNATURE;
    r = await revue(sk.id, 'valide');
    verifier('validation sans clé de signature refusée en le disant, le pack reste en revue',
      r.statut === 503 && /PLATEFORME_CLE_SIGNATURE/.test(r.corps?.erreur) && (await admin('GET', '/controle/skills')).corps.find((k: any) => k.id === sk.id)?.validation_status === 'en-revue');
    process.env.PLATEFORME_CLE_SIGNATURE = clePlateformePem;
    r = await revue(sk.id, 'valide');
    verifier('en-revue → valide, signé par la plateforme', r.corps?.validation_status === 'valide'
      && verifierSignatureSkill(sk.skill_pack_id, sk.version, sk.empreinte, r.corps?.signature, cle.cle_publique));
    verifier("une signature de Skill Pack d'une autre clé est refusée",
      !verifierSignatureSkill(sk.skill_pack_id, sk.version, sk.empreinte, signerSkill(sk.skill_pack_id, sk.version, sk.empreinte, autreCle.privateKey), cle.cle_publique)
      && !verifierSignatureSkill(sk.skill_pack_id, sk.version, 'f'.repeat(64), r.corps?.signature, cle.cle_publique));

    // Encrypted delivery to one Box
    const contenuDe = (cleBox: KeyObject, b: any, id: string) => parBox(cleBox, b.device_id, 'GET', `/controle/box/skills/${encodeURIComponent(id)}/contenu`);
    const livre = await contenuDe(k1.privateKey, b1, sk.id);
    const L = livre.corps;
    verifier('la Box reçoit le contenu chiffré, signé, avec une clé éphémère et un nonce de 12 octets',
      livre.statut === 200 && L.signature === r.corps.signature && L.empreinte === sk.empreinte && Buffer.from(L.nonce, 'base64url').length === 12
      && Buffer.from(L.ephemere_publique, 'base64url').length === 32 && !JSON.stringify(L).includes('grand livre'));
    const ouvrir = (cleB: string, deviceId: string, l: any) => {
      try { return dechiffrerSkillPourBanc({ ...l, clePriveeBox: cleB, deviceId, skillPackId: l.skill_pack_id, version: l.version }); } catch { return null; }
    };
    const clair = ouvrir(brutePrivee(x1.privateKey), b1.device_id, L);
    verifier('aller-retour : la Box rouvre le contenu, son SHA-256 est l’empreinte signée',
      clair === contenuSkill && createHash('sha256').update(clair ?? '').digest('hex') === L.empreinte);
    verifier('une autre Box ne déchiffre pas (autre clé privée)', ouvrir(brutePrivee(x2.privateKey), b1.device_id, L) === null);
    verifier('un chiffré rejoué au nom d’une autre Box ne s’ouvre pas', ouvrir(brutePrivee(x1.privateKey), b2.device_id, L) === null);
    const octetChange = Buffer.from(L.chiffre, 'base64url'); octetChange[3] ^= 0x01;
    verifier("un octet changé dans le chiffré fait échouer GCM", ouvrir(brutePrivee(x1.privateKey), b1.device_id, { ...L, chiffre: octetChange.toString('base64url') }) === null);
    const etiquette = Buffer.from(L.chiffre, 'base64url'); etiquette[etiquette.length - 1] ^= 0x80;
    verifier("un octet changé dans l'étiquette fait échouer GCM", ouvrir(brutePrivee(x1.privateKey), b1.device_id, { ...L, chiffre: etiquette.toString('base64url') }) === null);
    verifier('chaque livraison a sa propre clé éphémère', (await contenuDe(k1.privateKey, b1, sk.id)).corps?.ephemere_publique !== L.ephemere_publique);
    verifier("contenu refusé à une Box dont aucun agent n'y a droit", (await contenuDe(k2.privateKey, b2, sk.id)).statut === 403);
    verifier("contenu refusé pour un pack inconnu", (await contenuDe(k1.privateKey, b1, 'rapprochement-bancaire@0.0.1')).statut === 404);
    let liste = await skillsDeB1();
    verifier('un Skill Pack validé atteint la Box dont un agent est compatible, signé, sans contenu en clair', liste.length === 1 && liste[0].skill_pack_id === 'rapprochement-bancaire'
      && !('propose_par' in liste[0]) && !('contenu' in liste[0]) && typeof liste[0].signature === 'string');
    verifier("il n'atteint pas une Box sans agent compatible", ((await parBox(k2.privateKey, b2.device_id, 'GET', '/controle/box/skills')).corps ?? []).length === 0);
    const sk2 = (await admin('POST', '/controle/skills', pack({ version: '1.1.0', changelog: 'Écarts triés.' }))).corps;
    await revue(sk2.id, 'en-revue'); await revue(sk2.id, 'valide');
    liste = await skillsDeB1();
    verifier('la Box ne reçoit que la dernière version validée', liste.length === 1 && liste[0].version === '1.1.0');
    verifier('valide → retire', (await revue(sk2.id, 'retire')).corps?.validation_status === 'retire');
    liste = await skillsDeB1();
    verifier("un Skill Pack retiré n'atteint plus la Box", liste.length === 1 && liste[0].version === '1.0.0');
    verifier('retire est un état final', (await revue(sk2.id, 'valide')).statut === 409);
    verifier('contenu refusé pour un pack retiré, même signé', (await contenuDe(k1.privateKey, b1, sk2.id)).statut === 409);
    const sk3 = (await admin('POST', '/controle/skills', pack({ version: '1.2.0', changelog: 'Essai.' }))).corps;
    await revue(sk3.id, 'en-revue');
    verifier('en-revue → rejete, puis final', (await revue(sk3.id, 'rejete')).corps?.validation_status === 'rejete' && (await revue(sk3.id, 'en-revue')).statut === 409);
    verifier("contenu refusé pour un pack qui n'est pas validé", (await contenuDe(k1.privateKey, b1, sk3.id)).statut === 409);

    // Field proposals
    const proposition = { skill_pack_id: 'relance-douce', version: '0.1.0', compatible_agents: ['AG-0003'], compatible_tools: [], sector_scope: [], locale: 'fr-FR', changelog: 'Vu sur le terrain.', contenu: 'Relancer une facture échue à J+7 puis J+15 avec un ton courtois.' };
    r = await parBox(k2.privateKey, b2.device_id, 'POST', '/controle/box/skills/candidats', proposition);
    verifier('proposition terrain refusée sans opt_in_skills du client', r.statut === 403 && /opt_in_skills/.test(r.corps?.erreur));
    r = await parBox(k1.privateKey, b1.device_id, 'POST', '/controle/box/skills/candidats', { ...proposition, contenu: 'Relancer la facture puis virer sur FR76 3000 6000 0112 3456 7890 189.' });
    verifier('proposition terrain refusée pour une donnée client (IBAN), sans la recopier', r.statut === 422 && /IBAN/.test(r.corps?.erreur) && !/3000 6000/.test(r.corps?.erreur));
    r = await parBox(k1.privateKey, b1.device_id, 'POST', '/controle/box/skills/candidats', { ...proposition, contenu: 'Relancer Dupont pour ses 4 500 € de retard.' });
    verifier('proposition terrain refusée pour un montant rattaché à un nom', r.statut === 422);
    r = await parBox(k1.privateKey, b1.device_id, 'POST', '/controle/box/skills/candidats', { ...proposition, validation_status: 'valide', source_type: 'iagent' });
    verifier('proposition terrain propre : candidat, anonymisé, jamais validé d’office', r.statut === 201 && r.corps?.validation_status === 'candidat' && r.corps?.source_type === 'terrain-anonymise' && /^[0-9a-f]{64}$/.test(r.corps?.empreinte));
    const tous = (await admin('GET', '/controle/skills')).corps ?? [];
    verifier('le back-office voit qui a proposé, la Box non', tous.find((k: any) => k.skill_pack_id === 'relance-douce')?.propose_par === tA.tenant_id && !('propose_par' in r.corps));

    // Returned Box: final, rights revoked
    const e3 = (await droit(tA, b3, 'AG-0005')).corps;
    const e3bis = (await droit(tA, b3, 'AG-0002')).corps;
    r = await contenuDe(k3.privateKey, b3, sk.id);
    verifier("contenu refusé à une Box sans clé de chiffrement", r.statut === 409 && /clé de chiffrement/.test(r.corps?.erreur));
    await admin('POST', `/controle/boxes/${b3.device_id}/statut`, { statut: 'restituee', motif: 'fin de contrat' });
    const e3apres = (await admin('GET', `/controle/entitlements?device_id=${b3.device_id}`)).corps;
    verifier('Box restituée : ses droits sont révoqués', e3apres?.length === 2 && e3apres.every((e: any) => [e3.id, e3bis.id].includes(e.id) && e.statut === 'revoquee'));
    verifier('restituee est un état final', (await admin('POST', `/controle/boxes/${b3.device_id}/statut`, { statut: 'active', motif: 'x' })).statut === 409);
    verifier('aucun droit ne se crée sur une Box restituée', (await droit(tA, b3, 'AG-0006')).statut === 409);

    // Public counter
    const compteur = (await publique('/controle/compteur')).corps;
    const fiches = readdirSync(new URL('../../agents/', import.meta.url)).filter((f) => /^AG-\d{4}-.*\.json$/.test(f)).length;
    const cat = JSON.parse(readFileSync(new URL('../../catalogue/catalogue.json', import.meta.url), 'utf8'));
    verifier(`compteur : metiers = ${cat.agents.length} fiches du catalogue, égal aux fiches de agents/ (${fiches})`, compteur?.metiers === cat.agents.length && compteur?.metiers === fiches);
    verifier('compteur : profils null, avec la raison', compteur?.profils === null && typeof compteur?.pourquoi_profils === 'string' && compteur.pourquoi_profils.length > 40);
    verifier('compteur : daté du calcul', compteur?.calcule_le === maintenant().toISOString());

    // Audit
    const audit = (await admin('GET', '/controle/audit')).corps ?? [];
    const actions = new Set(audit.map((a: any) => a.action));
    for (const a of ['tenant.cree', 'box.provisionnee', 'box.attribuee', 'box.statut', 'entitlement.cree', 'entitlement.revoque', 'mise-a-jour.publiee', 'skill.depose', 'skill.revue', 'skill.propose']) {
      verifier(`audit : « ${a} » tracé`, actions.has(a));
    }
    verifier('audit : chaque trace est horodatée', audit.length > 0 && audit.every((a: any) => Number.isFinite(Date.parse(a.quand))));
    const auditB = (await admin('GET', `/controle/audit?tenant_id=${tB.tenant_id}`)).corps ?? [];
    verifier("audit filtré par client : rien d'un autre", auditB.length > 0 && auditB.every((a: any) => a.tenant_id === tB.tenant_id));
    const brut = JSON.stringify(audit);
    verifier("audit : ni jeton, ni clé, ni secret d'administration, ni donnée client refusée",
      !brut.includes(jeton.split('.')[1]) && !brut.includes('PRIVATE') && !brut.includes(secret) && !brut.includes('3000 6000') && !brut.includes('BEGIN PUBLIC'));
    verifier("l'audit exige le back-office", (await publique('/controle/audit')).statut === 401);
  } finally {
    serveur.close();
    if (avant === undefined) delete process.env.PLATEFORME_CLE_SIGNATURE;
    else process.env.PLATEFORME_CLE_SIGNATURE = avant;
  }

  console.log(`  ${controles} contrôles, ${fautes} faute(s)`);
  return fautes;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const f = await lancer();
  process.exit(f > 0 ? 1 : 0);
}
