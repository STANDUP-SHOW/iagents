// Le relais WhatsApp : la moitié que la machine du client ne peut pas tenir.
//
// Meta ne livre un message entrant qu'en le POUSSANT vers une adresse publique
// à certificat valide, et n'offre aucune API de relève. Le poste du client n'a
// pas d'adresse publique, donc il faut quelqu'un entre les deux. Ce fichier est
// ce quelqu'un, et rien de plus : il reçoit, il vérifie, il garde quelques
// minutes, et il rend au poste qui vient chercher.
//
// Ce qu'il ne fait pas, volontairement :
//  - il n'ENVOIE rien. Le poste appelle graph.facebook.com directement, donc le
//    jeton Meta du client ne passe jamais ici ;
//  - il n'ARCHIVE rien. Les messages vivent en mémoire, quelques minutes, et le
//    processus n'écrit aucun fichier. Ce qui transite, c'est la correspondance
//    des clients de nos clients : la garder ferait de nous un dépôt que
//    personne n'a demandé ;
//  - il ne JOURNALISE aucun contenu. Un texte recopié dans les journaux de
//    l'hébergeur serait archivé malgré tout ce qui précède.
//
// Le contrat que ce fichier met en œuvre est dans `docs/relais-whatsapp.md`, et
// c'est `desktop/src-tauri/src/whatsapp.rs` qui le fixe : c'est lui le client.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Combien de temps un message attend d'être relevé avant d'être oublié. */
const DUREE_DE_VIE_MS = 10 * 60 * 1000;
/** Plafond de la longue attente, quoi que demande le poste. */
const ATTENTE_MAX_S = 60;
/** Au-delà, on ne garde plus : un poste éteint ne doit pas faire enfler la mémoire. */
const MESSAGES_MAX = 1000;
/** Une charge de Meta est petite ; au-delà c'est autre chose, et on la refuse. */
const CORPS_MAX_OCTETS = 1024 * 1024;

export type MessageRecu = {
  de: string;
  nom: string;
  texte: string;
  recu_le: string;
};

type Range = MessageRecu & { id: number; pose_le: number };

export type Reglages = {
  secretApplication: string;
  motDeVerification: string;
  secretDuRelais: string;
};

/**
 * Lit les réglages dans l'environnement. Aucune valeur par défaut : un relais
 * qui démarrerait sans secret accepterait n'importe quelle charge comme venant
 * de Meta, et laisserait n'importe qui relever les messages. Mieux vaut ne pas
 * démarrer, comme le fait déjà l'application avec `declaration_recevable`.
 */
export function reglagesDeLEnvironnement(env: Record<string, string | undefined>): Reglages {
  const manquants: string[] = [];
  const lire = (nom: string): string => {
    const valeur = (env[nom] ?? '').trim();
    if (valeur === '') manquants.push(nom);
    return valeur;
  };
  const reglages: Reglages = {
    secretApplication: lire('META_APP_SECRET'),
    motDeVerification: lire('META_VERIFY_TOKEN'),
    secretDuRelais: lire('RELAIS_SECRET'),
  };
  if (manquants.length > 0) {
    throw new Error(
      `Le relais ne démarre pas : ${manquants.join(', ')} ${
        manquants.length > 1 ? 'ne sont pas posés' : "n'est pas posé"
      } dans l'environnement. Sans eux, le relais accepterait n'importe quelle charge comme venant de Meta.`,
    );
  }
  return reglages;
}

/** Comparaison à temps constant, pour qu'un secret ne se devine pas essai par essai. */
export function memeSecret(attendu: string, recu: string): boolean {
  const a = Buffer.from(attendu, 'utf8');
  const b = Buffer.from(recu, 'utf8');
  // timingSafeEqual lève si les longueurs diffèrent ; une longueur n'est pas un
  // secret, et de toute façon celle d'une signature est fixe.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Vérifie la signature dont Meta accompagne chaque charge.
 *
 * Relevé chez lui le 24/09/2026 : en-tête `X-Hub-Signature-256`, valeur
 * « sha256= » suivie du HMAC-SHA256 du corps en hexadécimal minuscule, la clé
 * étant le SECRET DE L'APPLICATION et non le jeton du numéro.
 *
 * LE PIÈGE QUI DÉCIDE : Meta signe « an escaped unicode version of the
 * payload ». Le corps qu'il envoie porte donc ses caractères accentués déjà
 * échappés, et c'est cette forme-là qui est signée. Il faut hacher LES OCTETS
 * REÇUS TELS QUELS. Relire puis réémettre le JSON rendrait « é » au lieu de
 * « é », donc d'autres octets, donc une signature qui ne tombe jamais
 * juste — et comme les messages qui nous intéressent sont écrits en français,
 * ce serait le cas courant et non un cas rare. D'où le `Buffer` en paramètre
 * plutôt qu'un objet déjà analysé : la signature se vérifie AVANT tout
 * `JSON.parse`, et le type interdit de se tromper.
 */
export function signatureValide(corps: Buffer, entete: string | undefined, secretApplication: string): boolean {
  if (!entete || !entete.startsWith('sha256=')) return false;
  const attendue = createHmac('sha256', secretApplication).update(corps).digest('hex');
  return memeSecret(attendue, entete.slice('sha256='.length));
}

/**
 * Lit la charge que Meta pousse et en tire les messages texte.
 *
 * ATTENTION, ÉCRIT DEUX FOIS : `whatsapp::depouiller_entrant` fait la même
 * chose en Rust, côté poste. Le relais ne peut pas l'appeler (autre processus,
 * autre langage), donc les deux doivent dire la même chose, et le banc rejoue
 * ici les deux pièges que le banc Rust rejoue là-bas.
 */
export function depouillerEntrant(charge: unknown): MessageRecu[] {
  const recus: MessageRecu[] = [];
  const tableau = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const objet = (v: unknown): Record<string, unknown> =>
    v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  const texteDe = (v: unknown): string | null => (typeof v === 'string' ? v : null);

  for (const entree of tableau(objet(charge).entry)) {
    for (const changement of tableau(objet(entree).changes)) {
      const valeur = objet(changement).value;
      if (valeur === undefined) continue;
      // `contacts` porte le nom de profil, `messages` le texte, et les deux se
      // rejoignent par le NUMÉRO : `contacts[].wa_id` d'un côté,
      // `messages[].from` de l'autre. Les apparier par position collerait le
      // nom d'une personne au message d'une autre dès qu'une notification en
      // porte plusieurs.
      const contacts = tableau(objet(valeur).contacts);
      for (const message of tableau(objet(valeur).messages)) {
        const de = texteDe(objet(message).from);
        const texte = texteDe(objet(objet(message).text).body);
        // Une notification qui n'est pas un texte (statut, accusé de lecture,
        // image) ne remonte rien : la remonter ferait répondre l'agent à du vide.
        if (de === null || texte === null) continue;
        const contact = contacts.find((c) => texteDe(objet(c).wa_id) === de);
        const nomTrouve = texteDe(objet(objet(contact).profile).name);
        const nom = nomTrouve !== null && nomTrouve.trim() !== '' ? nomTrouve : de;
        recus.push({ de, nom, texte, recu_le: texteDe(objet(message).timestamp) ?? '' });
      }
    }
  }
  return recus;
}

/**
 * Ce que le relais garde, et le seul endroit qui le garde : en mémoire, borné
 * en nombre et en durée. Le point de reprise (`suite`) est un compteur qui ne
 * recule pas, pour que le poste ne reçoive jamais deux fois le même message.
 */
export class Boite {
  #messages: Range[] = [];
  #dernierId = 0;
  #attendeurs: Array<() => void> = [];

  poser(recus: MessageRecu[], maintenant = Date.now()): void {
    for (const recu of recus) {
      this.#dernierId += 1;
      this.#messages.push({ ...recu, id: this.#dernierId, pose_le: maintenant });
    }
    if (this.#messages.length > MESSAGES_MAX) {
      this.#messages = this.#messages.slice(-MESSAGES_MAX);
    }
    if (recus.length > 0) this.#reveiller();
  }

  /** Oublie ce qui a dépassé sa durée de vie. Appelé à chaque passage. */
  balayer(maintenant = Date.now()): void {
    this.#messages = this.#messages.filter((m) => maintenant - m.pose_le < DUREE_DE_VIE_MS);
  }

  depuis(point: number, maintenant = Date.now()): { messages: MessageRecu[]; suite: number } {
    this.balayer(maintenant);
    const retenus = this.#messages.filter((m) => m.id > point);
    // Sans message, on rend le point demandé : le poste ne recule pas, et un
    // `suite` plus bas lui ferait resservir ce qu'il a déjà traité.
    const suite = retenus.length > 0 ? retenus[retenus.length - 1]!.id : point;
    const messages = retenus.map(({ de, nom, texte, recu_le }) => ({ de, nom, texte, recu_le }));
    return { messages, suite };
  }

  /** Garde la ligne ouverte jusqu'à ce qu'un message arrive, ou que le temps passe. */
  async attendre(attenteS: number): Promise<void> {
    const plafonnee = Math.min(Math.max(attenteS, 0), ATTENTE_MAX_S);
    if (plafonnee === 0) return;
    await new Promise<void>((resoudre) => {
      let fini = false;
      const finir = () => {
        if (fini) return;
        fini = true;
        clearTimeout(minuteur);
        this.#attendeurs = this.#attendeurs.filter((a) => a !== finir);
        resoudre();
      };
      const minuteur = setTimeout(finir, plafonnee * 1000);
      // Un minuteur qui retiendrait le processus à l'arrêt : on le détache.
      minuteur.unref?.();
      this.#attendeurs.push(finir);
    });
  }

  #reveiller(): void {
    const attendeurs = this.#attendeurs;
    this.#attendeurs = [];
    for (const reveiller of attendeurs) reveiller();
  }
}

/**
 * Répond, et ne lève jamais. Le poste coupe au bout de 35 secondes alors que la
 * longue attente peut en tenir 60 : écrire sur une ligne déjà fermée est donc le
 * cas ORDINAIRE ici, pas une anomalie. Sans ce garde, l'écriture lève dans le
 * gestionnaire asynchrone, et un rejet non traité arrête le processus — le relais
 * tomberait pour la raison la plus banale qui soit.
 */
function repondre(reponse: ServerResponse, code: number, corps: string, type = 'text/plain; charset=utf-8'): void {
  if (reponse.writableEnded || reponse.destroyed) return;
  try {
    reponse.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
    reponse.end(corps);
  } catch {
    // La ligne est partie entre-temps. Il n'y a personne à qui répondre.
  }
}

/** Lit le corps en OCTETS, sans l'analyser : la signature se calcule sur eux. */
function lireLeCorps(requete: IncomingMessage): Promise<Buffer> {
  return new Promise((resoudre, rejeter) => {
    const morceaux: Buffer[] = [];
    let taille = 0;
    requete.on('data', (morceau: Buffer) => {
      taille += morceau.length;
      if (taille > CORPS_MAX_OCTETS) {
        rejeter(new Error('corps trop grand'));
        requete.destroy();
        return;
      }
      morceaux.push(morceau);
    });
    requete.on('end', () => resoudre(Buffer.concat(morceaux)));
    requete.on('error', rejeter);
  });
}

export function creerRelais(reglages: Reglages, boite = new Boite()) {
  return createServer(async (requete, reponse) => {
    const adresse = new URL(requete.url ?? '/', 'http://relais.invalide');
    const chemin = adresse.pathname;

    try {
      // La poignée de vérification de Meta. Relevé chez lui : `hub.mode` vaut
      // toujours « subscribe », et on ne renvoie le défi QUE si le mot
      // correspond — sinon n'importe qui ferait enregistrer cette adresse sous
      // son propre compte.
      if (requete.method === 'GET' && chemin === '/webhook') {
        const mode = adresse.searchParams.get('hub.mode');
        const mot = adresse.searchParams.get('hub.verify_token') ?? '';
        const defi = adresse.searchParams.get('hub.challenge') ?? '';
        if (mode !== 'subscribe' || !memeSecret(reglages.motDeVerification, mot)) {
          repondre(reponse, 403, 'verification refusee');
          return;
        }
        repondre(reponse, 200, defi);
        return;
      }

      // Ce que Meta pousse.
      if (requete.method === 'POST' && chemin === '/webhook') {
        const corps = await lireLeCorps(requete);
        const entete = requete.headers['x-hub-signature-256'];
        const signature = Array.isArray(entete) ? entete[0] : entete;
        if (!signatureValide(corps, signature, reglages.secretApplication)) {
          // Rien n'est rangé, rien n'est journalisé du contenu : une charge non
          // signée est exactement ce dont il faut ne rien faire.
          repondre(reponse, 401, 'signature invalide');
          return;
        }
        let charge: unknown;
        try {
          charge = JSON.parse(corps.toString('utf8'));
        } catch {
          repondre(reponse, 400, 'charge illisible');
          return;
        }
        boite.poser(depouillerEntrant(charge));
        // Meta attend « a 200 OK HTTPS response » « within 5 or less seconds ».
        // On a rangé, on répond ; c'est /messages qui travaille.
        repondre(reponse, 200, 'EVENT_RECEIVED');
        return;
      }

      // Ce que le poste vient chercher.
      if (requete.method === 'GET' && chemin === '/messages') {
        const porteur = requete.headers.authorization ?? '';
        const jeton = porteur.startsWith('Bearer ') ? porteur.slice('Bearer '.length) : '';
        if (!memeSecret(reglages.secretDuRelais, jeton)) {
          repondre(reponse, 401, 'secret refuse');
          return;
        }
        const depuis = Number.parseInt(adresse.searchParams.get('depuis') ?? '0', 10);
        const point = Number.isFinite(depuis) && depuis > 0 ? depuis : 0;
        const attente = Number.parseInt(adresse.searchParams.get('attente') ?? '0', 10);

        let releve = boite.depuis(point);
        if (releve.messages.length === 0 && Number.isFinite(attente) && attente > 0) {
          await boite.attendre(attente);
          releve = boite.depuis(point);
        }
        repondre(reponse, 200, JSON.stringify(releve), 'application/json; charset=utf-8');
        return;
      }

      // Pour que l'hébergeur sache que le processus est vivant, sans rien dire
      // de ce qu'il contient.
      if (requete.method === 'GET' && (chemin === '/' || chemin === '/sante')) {
        repondre(reponse, 200, 'relais whatsapp');
        return;
      }

      repondre(reponse, 404, 'inconnu');
    } catch {
      // Jamais le détail : un message d'erreur qui recopierait l'adresse, un
      // en-tête ou le corps le ferait sortir dans les journaux.
      if (!reponse.headersSent) repondre(reponse, 400, 'demande refusee');
      else if (!reponse.writableEnded && !reponse.destroyed) {
        try { reponse.end(); } catch { /* la ligne est déjà partie */ }
      }
    }
  });
}

// Démarrage. Ignoré quand le banc importe ce fichier.
const lanceDirectement =
  process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (lanceDirectement) {
  const reglages = reglagesDeLEnvironnement(process.env);
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  creerRelais(reglages).listen(port, () => {
    console.log(`relais whatsapp en ecoute sur le port ${port}`);
  });
}
