// Skill Packs signés et chiffrés pour une Box (MASTER §6 : « Skill packages
// signés/chiffrés »). Format agreed with the desktop workstream, which replays
// plateforme/controle/temoins-signature.json in Rust:
//
// Signature (at validation): Ed25519 with PLATEFORME_CLE_SIGNATURE over the UTF-8
//   message `iagent-skill-v1\n<skill_pack_id>\n<version>\n<empreinte>`, base64url
//   without padding. `empreinte` is the SHA-256 of the content, so the signature
//   covers the content.
// Encryption (per Box, per call):
//   - the Box registered `cle_chiffrement_publique`, raw X25519 32 bytes, base64url;
//   - the platform makes a fresh X25519 ephemeral key for each delivery;
//   - key = HKDF-SHA256(X25519(ephemeral, box), salt = empty,
//                       info = `iagent-skill-v1|<device_id>|<skill_pack_id>|<version>`, 32 bytes);
//   - AES-256-GCM, 12-byte nonce, 16-byte tag appended to the ciphertext,
//     associated data = info;
//   - every binary field base64url without padding.
// Only the Box holding the matching X25519 private key can open it, and binding
// device_id, pack and version into both the key and the AAD means a ciphertext
// replayed for another Box or another version fails authentication.

import {
  createCipheriv, createDecipheriv, createPrivateKey, createPublicKey, diffieHellman, generateKeyPairSync,
  hkdfSync, randomBytes, sign, verify, type KeyObject,
} from 'node:crypto';

const b64 = (b: Buffer | Uint8Array): string => Buffer.from(b).toString('base64url');
const deB64 = (s: string): Buffer => Buffer.from(s, 'base64url');

// DER prefixes of a PKCS#8 private key / SPKI public key for X25519 and Ed25519
// (RFC 8410): the raw 32 bytes follow them.
const PKCS8_X25519 = Buffer.from('302e020100300506032b656e04220420', 'hex');
const SPKI_X25519 = Buffer.from('302a300506032b656e032100', 'hex');
const PKCS8_ED25519 = Buffer.from('302e020100300506032b657004220420', 'hex');

export const messageSkill = (skillPackId: string, version: string, empreinte: string): string =>
  `iagent-skill-v1\n${skillPackId}\n${version}\n${empreinte}`;

export const infoSkill = (deviceId: string, skillPackId: string, version: string): string =>
  `iagent-skill-v1|${deviceId}|${skillPackId}|${version}`;

export function signerSkill(skillPackId: string, version: string, empreinte: string, cle: KeyObject): string {
  return b64(sign(null, Buffer.from(messageSkill(skillPackId, version, empreinte), 'utf8'), cle));
}

export function verifierSignatureSkill(skillPackId: string, version: string, empreinte: string, signature: string, clePubliquePem: string): boolean {
  try {
    return verify(null, Buffer.from(messageSkill(skillPackId, version, empreinte), 'utf8'), createPublicKey(clePubliquePem), deB64(signature));
  } catch {
    return false;
  }
}

/** Raw X25519 public key (base64url, 32 bytes) -> KeyObject, or null if unusable. */
export function clePubliqueX25519(brute: string): KeyObject | null {
  if (typeof brute !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(brute)) return null;
  const octets = deB64(brute);
  if (octets.length !== 32 || octets.every((o) => o === 0)) return null;
  try {
    return createPublicKey({ key: Buffer.concat([SPKI_X25519, octets]), format: 'der', type: 'spki' });
  } catch {
    return null;
  }
}

export const clePriveeX25519 = (brute: string): KeyObject =>
  createPrivateKey({ key: Buffer.concat([PKCS8_X25519, deB64(brute)]), format: 'der', type: 'pkcs8' });

export const clePriveeEd25519DepuisGraine = (graine: Buffer): KeyObject =>
  createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, graine]), format: 'der', type: 'pkcs8' });

/** Raw 32 bytes of an X25519 public key, base64url. */
export const bruteX25519 = (cle: KeyObject): string => b64(cle.export({ type: 'spki', format: 'der' }).subarray(SPKI_X25519.length));

function cleDerivee(privee: KeyObject, publique: KeyObject, info: string): Buffer {
  const secret = diffieHellman({ privateKey: privee, publicKey: publique });
  if (secret.every((o) => o === 0)) throw new Error('Clé de chiffrement de la Box inutilisable.');
  return Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), Buffer.from(info, 'utf8'), 32));
}

export type SkillChiffre = { ephemere_publique: string; nonce: string; chiffre: string };

/**
 * Encrypts a Skill Pack content for one Box. `ephemerePrivee` and `nonce` are
 * only passed by the test vectors; in service both are fresh at every call.
 */
export function chiffrerSkill(p: {
  contenu: string; deviceId: string; skillPackId: string; version: string; cleBoxPublique: string;
  ephemerePrivee?: string; nonce?: Buffer;
}): SkillChiffre {
  const box = clePubliqueX25519(p.cleBoxPublique);
  if (!box) throw new Error("Cette Box n'a pas de clé de chiffrement utilisable.");
  const eph = p.ephemerePrivee ? clePriveeX25519(p.ephemerePrivee) : generateKeyPairSync('x25519').privateKey;
  const nonce = p.nonce ?? randomBytes(12);
  if (nonce.length !== 12) throw new Error('Le nonce fait 12 octets.');
  const info = infoSkill(p.deviceId, p.skillPackId, p.version);
  const c = createCipheriv('aes-256-gcm', cleDerivee(eph, box, info), nonce);
  c.setAAD(Buffer.from(info, 'utf8'));
  const chiffre = Buffer.concat([c.update(Buffer.from(p.contenu, 'utf8')), c.final(), c.getAuthTag()]);
  return { ephemere_publique: bruteX25519(createPublicKey(eph)), nonce: b64(nonce), chiffre: b64(chiffre) };
}

/**
 * What the Box does, written here so the test bench proves the round trip.
 * Pure; throws when the key, the binding (device, pack, version) or a single
 * byte of the ciphertext is wrong (GCM authentication).
 */
export function dechiffrerSkillPourBanc(p: SkillChiffre & {
  clePriveeBox: string; deviceId: string; skillPackId: string; version: string;
}): string {
  const eph = clePubliqueX25519(p.ephemere_publique);
  if (!eph) throw new Error('Clé éphémère illisible.');
  const info = infoSkill(p.deviceId, p.skillPackId, p.version);
  const tout = deB64(p.chiffre);
  if (tout.length < 16) throw new Error('Chiffré trop court.');
  const d = createDecipheriv('aes-256-gcm', cleDerivee(clePriveeX25519(p.clePriveeBox), eph, info), deB64(p.nonce));
  d.setAAD(Buffer.from(info, 'utf8'));
  d.setAuthTag(tout.subarray(tout.length - 16));
  return Buffer.concat([d.update(tout.subarray(0, tout.length - 16)), d.final()]).toString('utf8');
}

/** For the vectors only: the derived key, so another implementation can check its HKDF step. */
export function cleDeriveePourTemoin(ephemerePrivee: string, cleBoxPublique: string, info: string): string {
  return cleDerivee(clePriveeX25519(ephemerePrivee), clePubliqueX25519(cleBoxPublique)!, info).toString('hex');
}
