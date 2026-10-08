// La plateforme iAgent : Control Plane, Voice Hub, iAgent Create et moteur de
// tarifs derrière un seul serveur HTTP sans dépendance, ici sa porte Node (MASTER §6, §12, §9, §5).
//
// Chaque module déclare ses routes dans `<module>/routes.ts`, `assemblage.ts`
// les réunit et `http.ts` authentifie et choisit la route ; ce fichier ne fait
// que lire la requête Node et écrire la réponse. L'autre porte est
// `cloudflare/worker.ts`. Trois accès :
//  - `public`  : lisible sans rien (tarifs publics, opportunités publiées) ;
//  - `admin`   : back-office, `Authorization: Bearer <PLATEFORME_ADMIN_SECRET>` ;
//  - `box`     : une Box signe sa requête avec sa clé Ed25519 (voir `signatureBox`),
//                la plateforme la vérifie avec la clé publique enregistrée au
//                provisioning. C'est l'identité cryptographique unique du §6 ;
//                le mTLS se pose devant, chez l'hébergeur, et ne remplace pas ceci.
// Aucun secret n'est journalisé (§18) : seuls la méthode, le chemin et le statut.
//
// Un module peut aussi déclarer des flux (`flux` dans ses routes) : une connexion
// WebSocket qu'ouvre un opérateur téléphonique pour porter le son d'un appel
// (`ws.ts`). Le flux s'authentifie lui-même — l'opérateur ne signe pas cette
// connexion : c'est un jeton à usage unique dans le chemin, émis par la plateforme.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Stockage } from './stockage.ts';
import { stockageSurFichier } from './stockage-fichier.ts';
import { accepter, refuserUpgrade, type ConnexionWs } from './ws.ts';
import { CORPS_MAX, fluxPour, refus, traiterRequete, type Reglages, type Reponse, type Route, type RouteFlux } from './http.ts';
import { tousLesFlux, toutesLesRoutes } from './assemblage.ts';

export * from './http.ts';
export { tousLesFlux, toutesLesRoutes };

export function creerPlateforme(
  reglages: Reglages,
  options: { stockage?: Stockage; maintenant?: () => Date; routes?: Route[]; flux?: RouteFlux[] } = {},
) {
  const stockage = options.stockage ?? stockageSurFichier(reglages.fichierDonnees);
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
    const morceaux: Buffer[] = [];
    let taille = 0;
    for await (const m of req) {
      taille += (m as Buffer).length;
      if (taille > CORPS_MAX) return repondre(res, refus(413, 'Requête trop grosse.'));
      morceaux.push(m as Buffer);
    }
    const entetes: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) entetes[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
    repondre(res, await traiterRequete(
      { reglages, stockage, maintenant, routes },
      { methode: req.method ?? 'GET', url: req.url ?? '/', entetes, brut: Buffer.concat(morceaux).toString('utf8') },
    ));
  });
  const flux = options.flux ?? tousLesFlux;
  serveur.on('upgrade', async (req: IncomingMessage, sock: import('node:stream').Duplex, tete: Buffer) => {
    sock.on('error', () => {});
    const url = new URL(req.url ?? '/', 'http://plateforme');
    const trouve = fluxPour(flux, url.pathname);
    if (!trouve || req.method !== 'GET') return refuserUpgrade(sock, 404, "Cette adresse n'existe pas.");
    let r: string | ((ws: ConnexionWs) => void);
    try { r = await trouve.f.ouvrir({ stockage, params: trouve.params, maintenant }); } catch { r = 'Flux refusé.'; }
    if (typeof r === 'string') return refuserUpgrade(sock, 401, r);
    const ws = accepter(req, sock, tete);
    if (ws) r(ws);
  });
  return { serveur, stockage };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { reglagesDeLEnvironnement } = await import('./http.ts');
  const { serveur } = creerPlateforme(reglagesDeLEnvironnement(process.env));
  const port = Number(process.env.PORT ?? 8787);
  serveur.listen(port, () => console.log(`plateforme iagent sur le port ${port}`));
}
