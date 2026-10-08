// Le jeton de licence d'une Box (MASTER §6) : « si abonnement stoppé, agent non
// exécutable ; copie disque inutile sur une autre machine ».
//
// Format agreed with the desktop workstream (07/10/2026):
//   jeton = "<charge>.<signature>"
//   charge    = base64url (no padding) of the UTF-8 JSON payload
//   signature = base64url (no padding) of the Ed25519 signature over the ASCII
//               bytes of <charge> itself (the text before the dot, not the JSON)
// Payload: { v: 2, device_id, tenant_id, cle_box, emis_le, expire_le, droits[] }.
// Each right carries `empreinte_fiche`, the SHA-256 of the exact bytes of the
// agent sheet (agents/ or socle/) when the token was issued: the token is
// signed, so the sheet is signed through it (§6 « fiches signées »). The Box
// refuses to run a sheet whose bytes do not hash to that value.
// `cle_box` is the SHA-256 of the Box public key (DER SPKI): the token names the
// key it was issued to, and `device_id` names the Box. A disk copied to another
// machine carries a token for another device_id, which verification refuses, and
// it expires within 24 h anyway.
//
// `verifierJetonLicence` is pure (no I/O, clock passed in) so the application can
// reuse it verbatim.

import { createHash, createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';

/** Renewal is expected 24 h after issue (`expire_le`). */
export const DUREE_JETON_MS = 24 * 60 * 60 * 1000;
/**
 * Offline grace: when the platform does not answer at all, the token keeps
 * running until `grace_jusqu_au` = issue + 72 h. A platform that answers
 * "suspended", "returned" or "revoked" (403, or empty rights) is never a grace
 * case: the application drops the token then.
 */
export const GRACE_JETON_MS = 72 * 60 * 60 * 1000;
const DERIVE_HORLOGE_MS = 5 * 60 * 1000;

export type DroitJeton = {
  id: string;
  agent_template_id: string;
  specialisation_id: string | null;
  licence: string;
  fin: string | null;
  /** SHA-256 (hex) of the exact bytes of the agent sheet file. */
  empreinte_fiche: string;
};

export type ContenuJeton = {
  v: 2;
  device_id: string;
  tenant_id: string;
  cle_box: string;
  emis_le: string;
  expire_le: string;
  /** Offline grace limit, signed with the rest. */
  grace_jusqu_au: string;
  droits: DroitJeton[];
};

export type Verdict =
  | { valide: true; contenu: ContenuJeton; droits: DroitJeton[] }
  | { valide: false; motif: string };

const b64url = (b: Buffer): string => b.toString('base64url');

/** SHA-256 (hex) of a public key in DER SPKI form. */
export function empreinteCle(clePubliquePem: string): string {
  const der = createPublicKey(clePubliquePem).export({ type: 'spki', format: 'der' });
  return createHash('sha256').update(der).digest('hex');
}

/** SHA-256 (hex) of the exact bytes of an agent sheet: the only place this hash is computed. Bytes, never a re-serialised JSON. */
export function empreinteFiche(octets: Uint8Array): string {
  return createHash('sha256').update(octets).digest('hex');
}

/** Environment PEMs often arrive with literal "\n": accept both. */
function pem(texte: string): string {
  return texte.includes('\\n') ? texte.replace(/\\n/g, '\n') : texte;
}

/**
 * The platform signing key, read from PLATEFORME_CLE_SIGNATURE at call time.
 * Returns a French refusal instead of a key when it is absent or unusable; the
 * key itself never appears in any message.
 */
export function cleDeSignature(env: Record<string, string | undefined> = process.env):
  | { cle: KeyObject; publique: string }
  | { erreur: string } {
  const brut = (env.PLATEFORME_CLE_SIGNATURE ?? '').trim();
  if (!brut) {
    return { erreur: "PLATEFORME_CLE_SIGNATURE n'est pas posée : la plateforme ne peut signer aucun jeton de licence, donc aucune Box ne reçoit de droits." };
  }
  try {
    const cle = createPrivateKey(pem(brut));
    if (cle.asymmetricKeyType !== 'ed25519') {
      return { erreur: "PLATEFORME_CLE_SIGNATURE n'est pas une clé privée Ed25519 : aucun jeton de licence ne peut être signé." };
    }
    const publique = createPublicKey(cle).export({ type: 'spki', format: 'pem' }).toString();
    return { cle, publique };
  } catch {
    return { erreur: "PLATEFORME_CLE_SIGNATURE ne se lit pas comme une clé PEM : aucun jeton de licence ne peut être signé." };
  }
}

export function signerJetonLicence(contenu: ContenuJeton, cle: KeyObject): string {
  const charge = b64url(Buffer.from(JSON.stringify(contenu), 'utf8'));
  const signature = b64url(sign(null, Buffer.from(charge, 'ascii'), cle));
  return `${charge}.${signature}`;
}

const estIso = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));

/**
 * Checks a licence token for THIS device at THIS instant. Refuses with a French
 * reason: malformed, signed by another key, issued for another Box, expired, or
 * issued in the future. On success returns only the rights still running at
 * `maintenant` (an entitlement whose `fin` has passed is dropped).
 * `injoignable`: true only when the platform gave no answer at all; the token
 * then runs until `grace_jusqu_au`, otherwise until `expire_le`.
 * `clePubliqueBox`, when given, must be the key the token was issued to.
 */
export function verifierJetonLicence(
  jeton: string,
  clePubliquePem: string,
  deviceId: string,
  maintenant: Date,
  injoignable: boolean = false,
  clePubliqueBox?: string,
): Verdict {
  if (typeof jeton !== 'string') return { valide: false, motif: "Le jeton de licence est absent." };
  const morceaux = jeton.split('.');
  if (morceaux.length !== 2 || !morceaux[0] || !morceaux[1]) {
    return { valide: false, motif: "Le jeton de licence est mal formé." };
  }
  const [charge, signature] = morceaux;
  let bonneSignature = false;
  try {
    bonneSignature = verify(null, Buffer.from(charge, 'ascii'), createPublicKey(clePubliquePem), Buffer.from(signature, 'base64url'));
  } catch {
    bonneSignature = false;
  }
  if (!bonneSignature) {
    return { valide: false, motif: "Le jeton de licence n'a pas été signé par la plateforme iAgent." };
  }
  let c: ContenuJeton;
  try {
    c = JSON.parse(Buffer.from(charge, 'base64url').toString('utf8'));
  } catch {
    return { valide: false, motif: "Le jeton de licence est mal formé." };
  }
  if (c && (c as { v?: unknown }).v !== 2) {
    return { valide: false, motif: "Ce jeton de licence est d'une version périmée : la Box doit redemander ses droits à la plateforme." };
  }
  if (!c || typeof c.device_id !== 'string' || !estIso(c.expire_le) || !estIso(c.emis_le) || !estIso(c.grace_jusqu_au)
    || Date.parse(c.grace_jusqu_au) < Date.parse(c.expire_le) || !Array.isArray(c.droits)
    || c.droits.some((d) => !d || typeof d.empreinte_fiche !== 'string' || !/^[0-9a-f]{64}$/.test(d.empreinte_fiche))) {
    return { valide: false, motif: "Le jeton de licence est mal formé." };
  }
  if (c.device_id !== deviceId) {
    return { valide: false, motif: "Ce jeton de licence a été délivré à une autre Box : il ne vaut rien sur celle-ci." };
  }
  if (clePubliqueBox !== undefined) {
    let empreinte = '';
    try { empreinte = empreinteCle(clePubliqueBox); } catch { empreinte = ''; }
    if (empreinte !== c.cle_box) {
      return { valide: false, motif: "Ce jeton de licence a été délivré à une autre clé de Box : il ne vaut rien sur celle-ci." };
    }
  }
  const t = maintenant.getTime();
  if (injoignable) {
    if (Date.parse(c.grace_jusqu_au) <= t) {
      return { valide: false, motif: "Le jeton de licence a dépassé sa grâce hors ligne de 72 heures : la Box doit joindre la plateforme pour que ses agents reprennent." };
    }
  } else if (Date.parse(c.expire_le) <= t) {
    return { valide: false, motif: "Le jeton de licence a expiré : la Box doit redemander ses droits à la plateforme." };
  }
  if (Date.parse(c.emis_le) > t + DERIVE_HORLOGE_MS) {
    return { valide: false, motif: "Le jeton de licence est daté dans le futur : l'horloge de la Box est fausse." };
  }
  const droits = c.droits.filter((d) => d && (d.fin === null || (estIso(d.fin) && Date.parse(d.fin) > t)));
  return { valide: true, contenu: c, droits };
}
