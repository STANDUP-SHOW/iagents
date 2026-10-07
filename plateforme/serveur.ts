// La plateforme iAgent : Control Plane, Voice Hub, iAgent Create et moteur de
// tarifs derrière un seul serveur HTTP sans dépendance (MASTER §6, §12, §9, §5).
//
// Chaque module déclare ses routes dans `<module>/routes.ts` ; ce fichier ne
// fait que les assembler, authentifier et répondre. Trois accès :
//  - `public`  : lisible sans rien (tarifs publics, opportunités publiées) ;
//  - `admin`   : back-office, `Authorization: Bearer <PLATEFORME_ADMIN_SECRET>` ;
//  - `box`     : une Box signe sa requête avec sa clé Ed25519 (voir `signatureBox`),
//                la plateforme la vérifie avec la clé publique enregistrée au
//                provisioning. C'est l'identité cryptographique unique du §6 ;
//                le mTLS se pose devant, chez l'hébergeur, et ne remplace pas ceci.
// Aucun secret n'est journalisé (§18) : seuls la méthode, le chemin et le statut.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash, createPublicKey, timingSafeEqual, verify } from 'node:crypto';
import { Stockage } from './stockage.ts';
import type { Box } from './modele.ts';
import { routes as routesControle } from './controle/routes.ts';
import { routes as routesVoix } from './voix/routes.ts';
import { routes as routesCreate } from './create/routes.ts';
import { routes as routesTarifs } from './tarifs/routes.ts';

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

/** Refus en français, sans jargon, jamais avec un secret dedans. */
export const refus = (statut: number, message: string): Reponse => ({ statut, corps: { erreur: message } });
export const ok = (corps: unknown, statut = 200): Reponse => ({ statut, corps });

const CORPS_MAX = 2 * 1024 * 1024;
const DERIVE_HORLOGE_MS = 5 * 60 * 1000;

export const toutesLesRoutes: Route[] = [...routesControle, ...routesVoix, ...routesCreate, ...routesTarifs];

function correspond(modele: string, chemin: string): Record<string, string> | null {
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

function memeSecret(attendu: string, recu: string): boolean {
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

export function creerPlateforme(
  reglages: Reglages,
  options: { stockage?: Stockage; maintenant?: () => Date; routes?: Route[] } = {},
) {
  const stockage = options.stockage ?? new Stockage(reglages.fichierDonnees);
  const maintenant = options.maintenant ?? (() => new Date());
  const routes = options.routes ?? toutesLesRoutes;

  const repondre = (res: ServerResponse, r: Reponse) => {
    if (r.type && typeof r.corps === 'string') {
      res.writeHead(r.statut, { 'content-type': r.type });
      res.end(r.corps);
      return;
    }
    res.writeHead(r.statut, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(r.corps));
  };

  const serveur = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://plateforme');
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('plateforme iagent');
      return;
    }
    let trouvee: { route: Route; params: Record<string, string> } | null = null;
    for (const route of routes) {
      if (route.methode !== req.method) continue;
      const params = correspond(route.chemin, url.pathname);
      if (params) { trouvee = { route, params }; break; }
    }
    if (!trouvee) return repondre(res, refus(404, "Cette adresse n'existe pas."));

    const morceaux: Buffer[] = [];
    let taille = 0;
    for await (const m of req) {
      taille += (m as Buffer).length;
      if (taille > CORPS_MAX) return repondre(res, refus(413, 'Requête trop grosse.'));
      morceaux.push(m as Buffer);
    }
    const brut = Buffer.concat(morceaux).toString('utf8');
    let corps: unknown = null;
    const formulaire = String(req.headers['content-type'] ?? '').startsWith('application/x-www-form-urlencoded');
    if (brut && !formulaire) {
      try { corps = JSON.parse(brut); } catch { return repondre(res, refus(400, "Le corps n'est pas du JSON lisible.")); }
    }

    let box: Box | null = null;
    const { route, params } = trouvee;
    if (route.acces === 'admin') {
      const jeton = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
      if (!jeton || !memeSecret(reglages.secretAdmin, jeton)) return repondre(res, refus(401, 'Accès réservé au back-office.'));
    } else if (route.acces === 'box') {
      const id = String(req.headers['x-box-id'] ?? '');
      const horodatage = String(req.headers['x-horodatage'] ?? '');
      const signature = String(req.headers['x-signature'] ?? '');
      box = id ? stockage.lire<Box>('boxes', id) : null;
      if (!box || !signatureBox(box, req.method!, url.pathname, horodatage, brut, signature, maintenant())) {
        return repondre(res, refus(401, "Cette Box n'est pas reconnue, ou sa signature ne tombe pas juste."));
      }
      if (box.statut === 'suspendue' || box.statut === 'restituee' || box.statut === 'remplacee') {
        return repondre(res, refus(403, "Cette Box n'est plus active : ses agents ne peuvent pas s'exécuter."));
      }
    }
    try {
      const entetes: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) entetes[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
      repondre(res, await route.traiter({
        stockage, params, query: url.searchParams, corps, brut, entetes, url: req.url ?? '/', box, maintenant,
      }));
    } catch (e) {
      repondre(res, refus(400, e instanceof Error ? e.message : 'Requête refusée.'));
    }
  });
  return { serveur, stockage };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { serveur } = creerPlateforme(reglagesDeLEnvironnement(process.env));
  const port = Number(process.env.PORT ?? 8787);
  serveur.listen(port, () => console.log(`plateforme iagent sur le port ${port}`));
}
