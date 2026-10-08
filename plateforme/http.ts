// Le cœur HTTP de la plateforme, sans serveur : ce qui authentifie une requête
// et choisit la route, indépendamment de qui l'a reçue. Deux portes s'en
// servent — `serveur.ts` (Node, `node:http`) et `cloudflare/worker.ts`
// (Cloudflare Workers) — pour qu'aucun refus ne vive à un seul des deux
// endroits : un accès admin ou une signature de Box vérifiés d'un côté et
// oubliés de l'autre seraient une porte ouverte.

import { Buffer } from 'node:buffer';
import { createHash, createPublicKey, timingSafeEqual, verify } from 'node:crypto';
import type { Stockage } from './stockage.ts';
import type { Box } from './modele.ts';
import type { ConnexionWs } from './ws.ts';

export type Acces = 'public' | 'admin' | 'box';

export type Contexte = {
  stockage: Stockage;
  params: Record<string, string>;
  query: URLSearchParams;
  corps: unknown;
  /** Corps brut, octets exacts : un webhook d'opérateur signe ce qu'il a envoyé, pas ce qu'on relit. */
  brut: string;
  /** En-têtes de la requête, noms en minuscules. */
  entetes: Record<string, string>;
  /** Chemin et paramètres tels que reçus. */
  url: string;
  /** La Box authentifiée, quand l'accès est `box`. */
  box: Box | null;
  maintenant: () => Date;
};

/** `type` : pour répondre autre chose que du JSON (TwiML d'un opérateur) ; `corps` est alors écrit tel quel. */
export type Reponse = { statut: number; corps: unknown; type?: string };

export type Route = {
  methode: 'GET' | 'POST' | 'PUT' | 'DELETE';
  chemin: string; // ex. /controle/boxes/:id
  acces: Acces;
  traiter: (ctx: Contexte) => Reponse | Promise<Reponse>;
};

export type ContexteFlux = { stockage: Stockage; params: Record<string, string>; maintenant: () => Date };
/** Une chaîne : le refus (rien n'est ouvert). Une fonction : elle reçoit la connexion acceptée. */
export type RouteFlux = { chemin: string; ouvrir: (ctx: ContexteFlux) => Promise<string | ((ws: ConnexionWs) => void)> };

/** Refus en français, sans jargon, jamais avec un secret dedans. */
export const refus = (statut: number, message: string): Reponse => ({ statut, corps: { erreur: message } });
export const ok = (corps: unknown, statut = 200): Reponse => ({ statut, corps });

export const CORPS_MAX = 2 * 1024 * 1024;
const DERIVE_HORLOGE_MS = 5 * 60 * 1000;

export function correspond(modele: string, chemin: string): Record<string, string> | null {
  const a = modele.split('/').filter(Boolean);
  const b = chemin.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

/** Ce qu'une Box signe : méthode, chemin, horodatage et empreinte du corps. */
export function messageASigner(methode: string, chemin: string, horodatage: string, corps: string): string {
  const empreinte = createHash('sha256').update(corps, 'utf8').digest('hex');
  return `${methode}\n${chemin}\n${horodatage}\n${empreinte}`;
}

export function signatureBox(
  box: Box,
  methode: string,
  chemin: string,
  horodatage: string,
  corps: string,
  signatureB64: string,
  maintenant: Date,
): boolean {
  const t = Date.parse(horodatage);
  if (!Number.isFinite(t) || Math.abs(maintenant.getTime() - t) > DERIVE_HORLOGE_MS) return false;
  try {
    return verify(
      null,
      Buffer.from(messageASigner(methode, chemin, horodatage, corps), 'utf8'),
      createPublicKey(box.identite_publique),
      Buffer.from(signatureB64, 'base64'),
    );
  } catch {
    return false;
  }
}

export function memeSecret(attendu: string, recu: string): boolean {
  const a = Buffer.from(attendu, 'utf8');
  const b = Buffer.from(recu, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export type Reglages = { secretAdmin: string; fichierDonnees: string | null };

export function reglagesDeLEnvironnement(env: Record<string, string | undefined>): Reglages {
  const secretAdmin = (env.PLATEFORME_ADMIN_SECRET ?? '').trim();
  if (secretAdmin.length < 24) {
    throw new Error(
      "La plateforme ne démarre pas : PLATEFORME_ADMIN_SECRET n'est pas posé (24 caractères au moins). Sans lui, n'importe qui administrerait les Box et les licences.",
    );
  }
  return { secretAdmin, fichierDonnees: env.PLATEFORME_DONNEES?.trim() || 'donnees/plateforme.json' };
}

/** Une requête déjà lue : la porte a lu le corps en entier (borné à `CORPS_MAX`). */
export type Requete = { methode: string; url: string; entetes: Record<string, string>; brut: string };

export type Socle = { reglages: Reglages; stockage: Stockage; maintenant: () => Date; routes: Route[] };

export const ACCUEIL: Reponse = { statut: 200, corps: 'plateforme iagent', type: 'text/plain; charset=utf-8' };

/** Route trouvée, accès vérifié, traitement : la seule suite d'étapes, pour les deux portes. */
export async function traiterRequete(s: Socle, req: Requete): Promise<Reponse> {
  const url = new URL(req.url || '/', 'http://plateforme');
  if (req.methode === 'GET' && url.pathname === '/') return ACCUEIL;
  let trouvee: { route: Route; params: Record<string, string> } | null = null;
  for (const route of s.routes) {
    if (route.methode !== req.methode) continue;
    const params = correspond(route.chemin, url.pathname);
    if (params) { trouvee = { route, params }; break; }
  }
  if (!trouvee) return refus(404, "Cette adresse n'existe pas.");
  if (Buffer.byteLength(req.brut, 'utf8') > CORPS_MAX) return refus(413, 'Requête trop grosse.');

  const { brut, entetes } = req;
  let corps: unknown = null;
  const formulaire = (entetes['content-type'] ?? '').startsWith('application/x-www-form-urlencoded');
  if (brut && !formulaire) {
    try { corps = JSON.parse(brut); } catch { return refus(400, "Le corps n'est pas du JSON lisible."); }
  }

  let box: Box | null = null;
  const { route, params } = trouvee;
  if (route.acces === 'admin') {
    const jeton = (entetes.authorization ?? '').replace(/^Bearer\s+/i, '');
    if (!jeton || !memeSecret(s.reglages.secretAdmin, jeton)) return refus(401, 'Accès réservé au back-office.');
  } else if (route.acces === 'box') {
    const id = entetes['x-box-id'] ?? '';
    box = id ? s.stockage.lire<Box>('boxes', id) : null;
    if (!box || !signatureBox(box, req.methode, url.pathname, entetes['x-horodatage'] ?? '', brut, entetes['x-signature'] ?? '', s.maintenant())) {
      return refus(401, "Cette Box n'est pas reconnue, ou sa signature ne tombe pas juste.");
    }
    if (box.statut === 'suspendue' || box.statut === 'restituee' || box.statut === 'remplacee') {
      return refus(403, "Cette Box n'est plus active : ses agents ne peuvent pas s'exécuter.");
    }
  }
  try {
    return await route.traiter({
      stockage: s.stockage, params, query: url.searchParams, corps, brut, entetes, url: req.url || '/', box, maintenant: s.maintenant,
    });
  } catch (e) {
    return refus(400, e instanceof Error ? e.message : 'Requête refusée.');
  }
}

/** Le flux qui répond à ce chemin, s'il en est un. */
export function fluxPour(flux: RouteFlux[], chemin: string): { f: RouteFlux; params: Record<string, string> } | null {
  for (const f of flux) { const params = correspond(f.chemin, chemin); if (params) return { f, params }; }
  return null;
}
