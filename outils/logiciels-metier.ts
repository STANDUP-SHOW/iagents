/**
 * The vocabulary a fiche uses to name the business software its tasks open.
 *
 * A word here is a `categorie` of catalogue/logiciels.json, and nothing else: that is what
 * lets the shop and the application name the real products behind it — « bureautique »
 * becomes Microsoft 365, LibreOffice, Google Workspace, and the client recognises his own.
 *
 * Until 2026-09-23, 23 of the 146 words used by the 1249 fiches matched no category at all
 * (`tableur` 855 times, `libreoffice` 449, `client-email` 332, `logiciel-cabinet`…). Nothing
 * checked them, `logicielsMetier()` had nothing to resolve, and the shop displayed the bare
 * word. This file is where each of them was replaced — the fourth item of jalon B.
 *
 * Two kinds of replacement, and the difference matters:
 *  - RENOMMES: the word named a real family under a name the referential does not use.
 *  - HORS_LOGICIEL: the word named no business software at all. Mail, calendar, WhatsApp,
 *    telephone and files are declared in `connecteurs` and resolved to real connectors by
 *    capacites.ts; the browser, the audio player and the local image model belong to the
 *    application. Leaving them here was the same fact written in two places.
 */

/** A generic word and the referential category that actually holds its products. */
export const RENOMMES: Record<string, string> = {
  tableur: 'bureautique',
  libreoffice: 'bureautique',
  excel: 'bureautique',
  audit: 'audit-grc',
  dam: 'dam-marque',
  'suivi-energie': 'energie',
  'outil-notes-de-frais': 'note-de-frais',
  'composition-image': 'design-creation',
  'retouche-image': 'design-creation',
};

/** A word that names no business software, and what carries it instead. */
export const HORS_LOGICIEL: Record<string, string> = {
  'client-email': 'connecteur « email »',
  calendrier: 'connecteur « calendrier »',
  agenda: 'connecteur « calendrier »',
  whatsapp: 'connecteur « whatsapp »',
  telephone: 'connecteur « telephone »',
  'gestionnaire-fichiers': 'connecteur « fichiers »',
  navigateur: "le navigateur intégré de l'application",
  'lecteur-audio': "la voix de l'application",
  'generateur-image-local': 'le modèle image du bloc `modeles`',
};

/**
 * Four words meant a different family depending on the trade that used them: « le logiciel
 * du cabinet » is not the same product for a juriste and for un médecin. Each is resolved
 * on the fiche that used it, never guessed from the word.
 */
export const PAR_FICHE: Record<string, Record<string, string>> = {
  'AG-0021': { 'logiciel-cabinet': 'juridique' },          // Assistant juridique administratif
  'AG-0022': { 'logiciel-agence': 'immobilier' },          // Assistant immobilier administratif
  'AG-0023': { 'logiciel-cabinet-sante': 'sante' },        // Assistant médical administratif
  'AG-0076': { 'logiciel-de-gestion': 'banque-assurance' },// Gestionnaire de sinistres
  'AG-0078': { 'logiciel-de-gestion': 'banque-assurance' },// Gestionnaire contrats
  'AG-0079': { 'logiciel-de-gestion': 'banque-assurance' },// Gestionnaire polices
  'AG-0993': { qhse: 'dechets-environnement' },            // Agent conformité environnementale
  'AG-0994': { qhse: 'dechets-environnement' },            // Agent reporting déchets
  'AG-0995': { qhse: 'dechets-environnement' },            // Agent suivi recyclage
  'AG-1088': { qhse: 'qualite' },                          // Coordinateur audit qualité
};

/**
 * What to answer when a fiche uses a word that is not a category. Every one of these was
 * replaced in the fiches on 2026-09-23; the sentence is what the bench prints so the word
 * is not written again.
 */
export function remplacement(mot: string, ficheId: string): string | null {
  const propre = PAR_FICHE[ficheId]?.[mot];
  if (propre) return `écrire « ${propre} »`;
  if (mot in RENOMMES) return `écrire « ${RENOMMES[mot]} »`;
  if (mot in HORS_LOGICIEL) return `retirer le mot : c'est ${HORS_LOGICIEL[mot]} qui le porte`;
  return null;
}

/**
 * The business software a set of tasks opens, sorted and unique. A word the referential does
 * not know is left out: it is reported on its own by the bench, and correcting a fiche must
 * never copy a word into a second place where nothing would catch it again.
 */
export function logicielsDesTaches(
  taches: readonly { logiciels?: string[] }[],
  categories: Set<string>,
): string[] {
  const vus = new Set<string>();
  for (const t of taches) for (const mot of t.logiciels ?? []) if (categories.has(mot)) vus.add(mot);
  return [...vus].sort();
}
