/**
 * L'empreinte du message relu, côté interface.
 *
 * Envoyer est irréversible, et la règle du projet est que le client valide
 * avant tout envoi. Pour que cette validation porte sur le texte réellement
 * expédié et non sur un brouillon régénéré entre-temps, l'interface calcule
 * cette empreinte sur ce qu'elle affiche et la passe à `courriel_envoyer`, qui
 * la recalcule côté Rust et refuse dès qu'elle diffère.
 *
 * L'algorithme est FNV-1a 64 bits, et il doit rester identique aux deux bouts :
 * `desktop/src-tauri/src/courriel.rs::empreinte`. `desktop/check-courriel.ts`
 * compare les deux sur des valeurs de référence et s'arrête si elles divergent.
 * Ce n'est pas une signature : tout tourne dans le même processus. C'est un
 * contrôle de cohérence entre l'écran de relecture et le clic d'envoi.
 */

export type Brouillon = {
  destinataires: string[];
  objet: string;
  corps: string;
};

const BASE = 0xcbf29ce484222325n;
const PREMIER = 0x00000100000001b3n;
const MASQUE = 0xffffffffffffffffn;

export function empreinte(brouillon: Brouillon): string {
  let h = BASE;

  // Rust travaille sur les octets UTF-8, pas sur les unités UTF-16 de
  // JavaScript : sans TextEncoder, un « é » donnerait deux empreintes
  // différentes des deux côtés.
  const encodeur = new TextEncoder();

  const avaler = (texte: string) => {
    for (const octet of encodeur.encode(texte)) {
      h = (h ^ BigInt(octet)) & MASQUE;
      h = (h * PREMIER) & MASQUE;
    }
    // Séparateur entre les champs : sans lui, un objet allongé d'un mot pris
    // au début du corps donnerait la même empreinte que l'original.
    h = (h ^ 0xffn) & MASQUE;
    h = (h * PREMIER) & MASQUE;
  };

  for (const d of brouillon.destinataires) avaler(d.trim());
  avaler(brouillon.objet.trim());
  avaler(brouillon.corps.trim());

  return h.toString(16).padStart(16, '0');
}
