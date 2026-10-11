// Ce que Meta envoie, et comment le croire : la signature de chaque charge et
// la lecture des messages texte. Sans serveur ni réseau, pour que deux
// processus s'en servent sans en écrire une seconde copie : le relais des
// clients (`serveur.ts`) et le centre d'appels interne de la plateforme
// (`plateforme/centre/routes.ts`), qui ne peut pas importer `node:http` chez
// Cloudflare.

import { Buffer } from 'node:buffer';
import { createHmac, timingSafeEqual } from 'node:crypto';

export type MessageRecu = {
  de: string;
  nom: string;
  texte: string;
  recu_le: string;
};

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

