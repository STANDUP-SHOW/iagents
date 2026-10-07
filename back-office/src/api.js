// The `Client` the screens are given, and its two implementations.
//
// Screens depend on this interface only (MASTER §15, coupling with the
// Desktop Commander): whoever mounts them hands a Client in.
//
//   Client = {
//     appeler(nom, { params?, query?, corps? }) : Promise<réponse JSON>
//         nom is a key of routes.json; rejects with ErreurPlateforme;
//     jeton:   { present(): Promise<boolean>, poser(j): Promise<string>, oublier(): Promise<string> },
//     adresse: { lire(): Promise<string>, poser(a): Promise<string> },
//   }
//
// Rule (MASTER §15, CLAUDE.md): a platform error is shown exactly as the
// platform wrote it (`{ "erreur": "<phrase en français>" }`) and never turns
// into a success. Anything other than a 2xx JSON answer without `erreur` is
// an ErreurPlateforme.
import { chemin as construire } from './routes.js';

export class ErreurPlateforme extends Error {
  constructor(message, statut, plateforme = true) {
    super(message);
    this.name = 'ErreurPlateforme';
    this.statut = statut;
    /** false: refused on this side before anything was sent (no token, bad address, undeclared route). */
    this.plateforme = plateforme;
  }
}

/** Joins the platform address setting and a route path. */
export function adresseComplete(adresse, cheminRoute) {
  return String(adresse ?? '').trim().replace(/\/+$/, '') + cheminRoute;
}

/** Same rule as admin/src/lib.rs `adresse_recevable`: https, or plain http on this machine only. */
export function adresseRecevable(adresse) {
  const propre = String(adresse ?? '').trim().replace(/\/+$/, '');
  if (!propre) throw new Error("Saisissez l'adresse de la plateforme.");
  if (!/^(https:\/\/[^/\s@?#]+|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?|\/[^\s]*)$/.test(propre)) {
    throw new Error("L'adresse doit commencer par https:// (ou http://127.0.0.1 pour une plateforme sur ce poste), sans identifiant ni paramètre : le jeton ne part jamais en clair.");
  }
  return propre;
}

/** Reads a platform answer the same way on both sides (mirrors `interpreter` in admin/src/lib.rs). */
export function interpreter(statut, texte, methode, cheminRoute) {
  let json;
  let lisible = true;
  try { json = texte ? JSON.parse(texte) : null; } catch { lisible = false; }
  if (lisible && json && typeof json === 'object' && typeof json.erreur === 'string') {
    throw new ErreurPlateforme(json.erreur, statut);
  }
  if (statut < 200 || statut >= 300) {
    throw new ErreurPlateforme(`La plateforme a répondu ${statut} sans phrase d'erreur lisible (${methode} ${cheminRoute}).`, statut);
  }
  if (!lisible) {
    throw new ErreurPlateforme(`La plateforme a répondu à ${methode} ${cheminRoute}, mais pas en JSON : l'adresse vise sans doute autre chose que la plateforme.`, statut);
  }
  return json;
}

/**
 * Browser Client, for `vite` development, the captures and the bench. The
 * token stays in this closure only: no storage at all, it is typed again
 * after a reload. The desktop app uses creerClientTauri instead.
 */
export function creerClientWeb({ adresse: adresseDepart, jeton: jetonDepart = '', fetch: f = globalThis.fetch, stockage }) {
  let jeton = jetonDepart;
  const local = stockage === undefined ? (() => { try { return globalThis.localStorage ?? null; } catch { return null; } })() : stockage;
  let adresse = adresseDepart ?? (() => { try { return local?.getItem('iagent-back-office.adresse') || '/plateforme'; } catch { return '/plateforme'; } })();

  async function appeler(nom, { params, query, corps } = {}) {
    const { methode, chemin } = construire(nom, params, query);
    if (!jeton) throw new ErreurPlateforme('Aucun jeton du back-office n’est saisi : rien n’a été envoyé.', 0, false);
    const entetes = { accept: 'application/json', authorization: `Bearer ${jeton}` };
    const avecCorps = methode !== 'GET';
    if (avecCorps) entetes['content-type'] = 'application/json';
    let reponse;
    try {
      reponse = await f(adresseComplete(adresse, chemin), {
        method: methode, headers: entetes, body: avecCorps ? JSON.stringify(corps ?? {}) : undefined,
      });
    } catch (e) {
      throw new ErreurPlateforme(`La plateforme ne répond pas à l'adresse « ${adresse} » (${e && e.message ? e.message : 'connexion impossible'}). Vérifiez l'adresse dans les réglages.`, 0);
    }
    return interpreter(reponse.status, await reponse.text(), methode, chemin);
  }

  return {
    appeler,
    jeton: {
      present: async () => Boolean(jeton),
      poser: async (j) => {
        const propre = String(j ?? '').trim();
        if (!propre) throw new Error('Saisissez le jeton du back-office.');
        jeton = propre;
        return 'Jeton gardé pour cette page seulement.';
      },
      oublier: async () => { jeton = ''; return 'Jeton oublié.'; },
    },
    adresse: {
      lire: async () => adresse,
      poser: async (a) => {
        adresse = adresseRecevable(a);
        try { local?.setItem('iagent-back-office.adresse', adresse); } catch { /* setting kept for this page only */ }
        return adresse;
      },
    },
  };
}

/**
 * Desktop Client: every call goes through the Rust command
 * `plateforme_appeler`, which reads the token from the system keyring and
 * attaches it there. The token never comes back to JavaScript.
 */
export function creerClientTauri(invoke) {
  const versErreur = (e) => {
    if (e && typeof e === 'object' && typeof e.erreur === 'string') return new ErreurPlateforme(e.erreur, e.statut ?? 0, e.plateforme !== false);
    return new ErreurPlateforme(typeof e === 'string' ? e : 'La commande du back-office a échoué sans message.', 0, false);
  };
  const appel = async (commande, args) => { try { return await invoke(commande, args); } catch (e) { throw versErreur(e); } };
  return {
    appeler: async (nom, { params, query, corps } = {}) => {
      const { methode, chemin } = construire(nom, params, query);
      return appel('plateforme_appeler', { nom, methode, chemin, corps: methode === 'GET' ? null : (corps ?? {}) });
    },
    jeton: {
      present: () => appel('jeton_present'),
      poser: (j) => appel('jeton_poser', { jeton: String(j ?? '') }),
      oublier: () => appel('jeton_oublier'),
    },
    adresse: {
      lire: () => appel('adresse_lire'),
      poser: (a) => appel('adresse_poser', { adresse: String(a ?? '') }),
    },
  };
}

/** Runs one platform call and returns a plain outcome: never throws, never invents success. */
export async function executer(promesse) {
  try {
    return { ok: true, corps: await promesse };
  } catch (e) {
    return {
      ok: false,
      erreur: e && e.message ? e.message : String(e),
      statut: e && e.statut,
      // false: refused here before anything left (bad JSON, missing field), not by the platform.
      plateforme: e instanceof ErreurPlateforme ? e.plateforme : false,
    };
  }
}
