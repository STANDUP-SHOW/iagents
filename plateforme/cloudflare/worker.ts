// La porte Cloudflare de la plateforme : la même plateforme que `serveur.ts`,
// servie par un Worker. Choisie par max le 08/10/2026 (son hébergement OVH est
// mutualisé et ne fait tourner aucun programme en continu ; il a un compte
// Cloudflare).
//
// Tout passe par UN Durable Object, `Plateforme`, nommé une fois pour toutes :
// la plateforme tient son état en mémoire et le rend durable à chaque
// changement, comme sous Node. Un seul objet = un seul écrivain, donc aucune
// requête ne lit un état qu'une autre est en train de changer — la garantie que
// le processus Node unique donnait. Le jour où le volume l'exige, on découpe par
// tenant, pas avant.
//
// Ce qui change par rapport à Node, et seulement ça :
//  - le stockage : une clé par document dans le stockage de l'objet
//    (`collection/id`), relue en entier au réveil ;
//  - les fiches : servies comme fichiers statiques (`.fichiers/`, construit par
//    `construire.ts`), lues par le binding ASSETS, jamais publiées (le Worker
//    passe avant les fichiers, `run_worker_first`) ;
//  - le flux téléphonique : un `WebSocketPair` de Cloudflare au lieu de `ws.ts`.
// L'authentification, le choix de la route et chaque refus restent dans
// `http.ts`, commun aux deux portes.

import { DurableObject } from 'cloudflare:workers';
import { Stockage, type Doc, type Donnees } from '../stockage.ts';
import { fluxPour, reglagesDeLEnvironnement, refus, traiterRequete, type Reglages, type Reponse } from '../http.ts';
import { tousLesFlux, toutesLesRoutes } from '../assemblage.ts';
import { indexer, poserDepot, type Depot } from '../depot.ts';
import { MESSAGE_MAX, type ConnexionWs } from '../ws.ts';
import { verifierPhases } from '../create/equipes.ts';

type Env = {
  PLATEFORME: DurableObjectNamespace<Plateforme>;
  ASSETS: Fetcher;
  [secret: string]: unknown;
};

/** Le nom de l'unique objet. Le changer, c'est repartir d'un stockage vide. */
const NOM_OBJET = 'plateforme';

const enJson = (r: Reponse): Response =>
  r.type && typeof r.corps === 'string'
    ? new Response(r.corps, { status: r.statut, headers: { 'content-type': r.type } })
    : new Response(JSON.stringify(r.corps), { status: r.statut, headers: { 'content-type': 'application/json; charset=utf-8' } });

/** Les fiches, lues dans les fichiers statiques du Worker. L'index est relevé à la construction. */
async function depotStatique(assets: Fetcher): Promise<Depot> {
  const lire = async (chemin: string): Promise<Uint8Array> => {
    const r = await assets.fetch(new Request(`https://fichiers/${chemin}`));
    if (!r.ok) throw new Error(`Le fichier ${chemin} manque à la plateforme.`);
    return new Uint8Array(await r.arrayBuffer());
  };
  const parDossier = JSON.parse(new TextDecoder().decode(await lire('index.json'))) as Record<string, string[]>;
  const index = indexer(parDossier);
  return { fiches: () => index, lire };
}

/** Une connexion WebSocket de Cloudflare sous la forme que le pont attend (`ws.ts`). */
function connexion(ws: WebSocket): ConnexionWs {
  let ouverte = true;
  const c: ConnexionWs = {
    envoyer(texte) { if (ouverte) ws.send(texte); },
    fermer(code = 1000, raison = '') {
      if (!ouverte) return;
      ouverte = false;
      try { ws.close(code, raison.slice(0, 120)); } catch { /* already closed */ }
      c.surFermeture(code);
    },
    get ouverte() { return ouverte; },
    surMessage: () => {},
    surFermeture: () => {},
  };
  // The same three refusals as ws.ts: binary, oversized (the runtime also caps at 1 MiB), handler faults contained.
  ws.addEventListener('message', (e: MessageEvent) => {
    if (typeof e.data !== 'string') return c.fermer(1003, 'messages binaires refusés');
    if (e.data.length > MESSAGE_MAX) return c.fermer(1009, 'message trop gros');
    try { c.surMessage(e.data); } catch { /* a handler's fault never kills the socket */ }
  });
  ws.addEventListener('close', (e: CloseEvent) => { if (ouverte) { ouverte = false; c.surFermeture(e.code || 1006); } });
  ws.addEventListener('error', () => { if (ouverte) { ouverte = false; c.surFermeture(1006); } });
  return c;
}

export class Plateforme extends DurableObject<Env> {
  private stockage!: Stockage;
  private reglages: Reglages | null = null;
  private refusDemarrage: string | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      try { this.reglages = reglagesDeLEnvironnement(process.env); } catch (e) { this.refusDemarrage = (e as Error).message; }
      poserDepot(await depotStatique(env.ASSETS));
      try { verifierPhases(); } catch (e) { this.refusDemarrage ??= (e as Error).message; }
      const initial: Donnees = {};
      for (const [cle, doc] of await ctx.storage.list<Doc>()) {
        const i = cle.indexOf('/');
        (initial[cle.slice(0, i)] ??= {})[cle.slice(i + 1)] = doc;
      }
      // put/delete are not awaited on purpose: the runtime holds every response until the
      // write is durable (output gate), so nothing answers before what it changed is saved.
      this.stockage = new Stockage({
        initial,
        changer: (collection, id, doc) => {
          const cle = `${collection}/${id}`;
          if (doc) void ctx.storage.put(cle, doc); else void ctx.storage.delete(cle);
        },
      });
    });
  }

  async fetch(requete: Request): Promise<Response> {
    // Same rule as Node: without its admin secret the platform does not run at all.
    if (!this.reglages || this.refusDemarrage) return enJson(refus(503, this.refusDemarrage ?? 'La plateforme ne démarre pas.'));
    const maintenant = () => new Date();
    const url = new URL(requete.url);

    if ((requete.headers.get('upgrade') ?? '').toLowerCase() === 'websocket') {
      const trouve = fluxPour(tousLesFlux, url.pathname);
      if (!trouve || requete.method !== 'GET') return enJson(refus(404, "Cette adresse n'existe pas."));
      let r: string | ((ws: ConnexionWs) => void);
      try { r = await trouve.f.ouvrir({ stockage: this.stockage, params: trouve.params, maintenant }); } catch { r = 'Flux refusé.'; }
      if (typeof r === 'string') return enJson(refus(401, r));
      const [client, serveur] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
      serveur.accept();
      r(connexion(serveur));
      return new Response(null, { status: 101, webSocket: client });
    }

    const entetes: Record<string, string> = {};
    requete.headers.forEach((v, k) => { entetes[k.toLowerCase()] = v; });
    const brut = requete.body ? await requete.text() : '';
    return enJson(await traiterRequete(
      { reglages: this.reglages, stockage: this.stockage, maintenant, routes: toutesLesRoutes },
      { methode: requete.method, url: url.pathname + url.search, entetes, brut },
    ));
  }
}

export default {
  fetch(requete: Request, env: Env): Promise<Response> {
    return env.PLATEFORME.get(env.PLATEFORME.idFromName(NOM_OBJET)).fetch(requete);
  },
} satisfies ExportedHandler<Env>;
