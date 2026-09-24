/**
 * The activation rule the V6 connector referential sets for itself, quoted in
 * docs/cadrage.md §4 point 3:
 *
 *   « un connecteur n'est activé qu'après identification de son éditeur, de son
 *   authentification, de ses permissions, de ses coûts et de son risque »
 *
 * Written once, here, because the shop, the desktop app and the bench must all answer
 * the same question the same way. A rule that lives in three places is a rule that will
 * say yes in one of them.
 *
 * The rule says what must be *identified*, not what must be permissive: a connector whose
 * cost is known to be zero passes, one whose cost nobody has looked up does not.
 */

export type Condition = 'editeur' | 'authentification' | 'permissions' | 'cout' | 'risque';

export const CONDITIONS: Condition[] = [
  'editeur',
  'authentification',
  'permissions',
  'cout',
  'risque',
];

/** What each condition asks for, in the words shown to whoever has to fill the gap. */
export const EXIGENCES: Record<Condition, string> = {
  editeur: "l'éditeur et sa documentation (urlProduit et urlDocumentation)",
  authentification: "le moyen d'authentification (authentification)",
  permissions: "les permissions demandées au client (accesRequis, adminRequis, lecture, ecriture)",
  cout: 'le coût pour le client (cout)',
  risque: 'le risque de la connexion (risque)',
};

const vide = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/** Une URL utilisable, pas une case remplie : « - » et « à confirmer » ne mènent nulle part. */
const adresse = (v: unknown): boolean =>
  typeof v === 'string' && /^https?:\/\/[^\s]+$/.test(v.trim());

/** Un champ qui dit explicitement qu'on ne sait pas ne compte pas comme une réponse. */
const indecis = (v: unknown): boolean =>
  typeof v === 'string' && /^(a-confirmer|à confirmer|a confirmer|\?|-)$/i.test(v.trim());

export interface Connecteur {
  id: string;
  nom: string;
  urlProduit?: string;
  urlDocumentation?: string;
  authentification?: string;
  accesRequis?: string;
  adminRequis?: string;
  lecture?: unknown;
  ecriture?: unknown;
  cout?: unknown;
  coutPourLeClient?: unknown;
  risque?: unknown;
}

/**
 * Les conditions que ce connecteur ne remplit pas, dans l'ordre de la règle. Liste vide =
 * activable. Aucune valeur n'est devinée ici : c'est l'import qui renseigne, cette fonction
 * ne fait que constater.
 */
export function manques(c: Connecteur): Condition[] {
  const absents: Condition[] = [];

  // L'éditeur : le relevé ne porte pas de colonne « éditeur », mais deux adresses qui mènent
  // chez lui. Sans documentation joignable, personne ne peut vérifier ce que le connecteur fait.
  if (!adresse(c.urlProduit) || !adresse(c.urlDocumentation)) absents.push('editeur');

  if (vide(c.authentification) || indecis(c.authentification)) absents.push('authentification');

  // Les permissions : ce qu'on demande au client d'ouvrir, et jusqu'où l'agent ira dedans.
  // « lecture seule » est une réponse ; « on ne sait pas » n'en est pas une.
  if (
    vide(c.accesRequis) ||
    indecis(c.accesRequis) ||
    vide(c.adminRequis) ||
    indecis(c.adminRequis) ||
    typeof c.lecture !== 'boolean' ||
    typeof c.ecriture !== 'boolean'
  ) {
    absents.push('permissions');
  }

  // Le coût : `null` veut dire « personne n'a chiffré », et c'est le cas des 137 aujourd'hui.
  // Un connecteur gratuit se déclare `0`, ce qui est une information ; `null` n'en est pas une.
  //
  // Et un coût identifié par nous n'est pas un coût connu du client : un connecteur à 25 €
  // par mois passerait la règle (25 ≥ 0) et le client cliquerait « Se connecter » sans avoir
  // rien lu. Dès qu'il y a un montant, la phrase qui le lui dit est exigée avec lui — c'est
  // la raison d'être de la condition, pas une formalité de plus.
  const chiffre = typeof c.cout === 'number' && c.cout >= 0;
  const phrase = typeof c.coutPourLeClient === 'string' && c.coutPourLeClient.trim() !== '';
  if (!chiffre || (typeof c.cout === 'number' && c.cout > 0 && !phrase)) absents.push('cout');

  if (vide(c.risque) || indecis(c.risque)) absents.push('risque');

  return absents;
}

export const activable = (c: Connecteur): boolean => manques(c).length === 0;

/** Ce qu'on affiche à qui demande pourquoi un connecteur ne s'allume pas. */
export function motif(c: Connecteur): string {
  const absents = manques(c);
  if (absents.length === 0) return '';
  return `${c.nom} ne peut pas être activé : il manque ${absents
    .map((m) => EXIGENCES[m])
    .join(', ')}.`;
}
