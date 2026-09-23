/**
 * What a fiche asks for, and which connectors can answer.
 *
 * The 1249 fiches declare their needs as eight plain words — voix, conversation, email,
 * whatsapp, calendrier, fichiers, navigateur, telephone — and not as product names. That is
 * the right way round: the fiche says « j'ai besoin d'une messagerie », the client chooses
 * Microsoft 365, Google Workspace or son propre SMTP. This file is the join between the two.
 *
 * The table below is derived from the sheet's own words (`famille`, `specialite`, `nom`,
 * `voieDesktop`), never from what a product is famous for. It was checked match by match:
 * Brevo sends SMS but is not telephony, Telegram carries files but is not a file store,
 * Zoom is a meeting room and not a chat channel for an agent. Each exclusion cost a line.
 */

export const CAPACITES = [
  'voix',
  'conversation',
  'email',
  'whatsapp',
  'calendrier',
  'fichiers',
  'navigateur',
  'telephone',
] as const;

export type Capacite = (typeof CAPACITES)[number];

/**
 * Deux besoins ne passent par aucun connecteur : l'application les tient elle-même. La voix
 * est locale (Whisper et Piper, sans jeton facturé) et le navigateur est celui qu'on a
 * intégré au jalon A, où le client ouvre ses propres sessions. Le dire ici évite de chercher
 * indéfiniment un connecteur « voix » qui n'existera jamais.
 */
export const SERVI_PAR_L_APPLICATION: Record<string, string> = {
  voix: "l'application, en local : Whisper pour entendre, Piper pour parler",
  navigateur: "le navigateur intégré, où le client ouvre ses propres sessions",
};

const sansAccent = (t: string): string =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Regle {
  familles: string[];
  motifs: RegExp[];
  /** Certaines capacités ne se lisent que dans une rubrique : « fichiers » n'est pas un canal. */
  saufCategories?: string[];
}

const REGLES: Partial<Record<Capacite, Regle>> = {
  email: {
    familles: ['email'],
    motifs: [/\boutlook\b/, /\bgmail\b/, /\bmail\b/],
  },
  calendrier: {
    familles: ['planification'],
    motifs: [/\bcalendar\b/, /\bagenda\b/, /rendez-vous/],
  },
  fichiers: {
    familles: [
      'stockage',
      'stockage-intranet',
      'fichiers-locaux',
      'suite-collaborative',
      'capture-documentaire',
    ],
    motifs: [/\bfichiers?\b/, /\bdrive\b/, /onedrive/, /sharepoint/, /workdrive/],
    // Un bot qui sait joindre un fichier n'est pas l'endroit où vivent les documents du client.
    saufCategories: ['communication'],
  },
  conversation: {
    familles: [
      'collaboration',
      'messagerie',
      'messagerie-federee',
      'communaute',
      'reseaux-sociaux',
      'notifications',
      'messagerie-appels',
    ],
    motifs: [/\bteams\b/, /\bchat\b/],
  },
  whatsapp: { familles: [], motifs: [/whatsapp/] },
  telephone: { familles: ['telephonie', 'voix', 'cpaas'], motifs: [/telephone/] },
};

export interface Servable {
  categorie: string;
  famille: string;
  nom: string;
  specialite: string;
  voieDesktop: string;
}

/** Les besoins de fiche que ce connecteur peut couvrir, dans l'ordre de CAPACITES. */
export function sertQuoi(c: Servable): Capacite[] {
  const champ = sansAccent(`${c.specialite} ${c.nom} ${c.voieDesktop}`);
  return CAPACITES.filter((cap) => {
    const regle = REGLES[cap];
    if (!regle) return false;
    if (regle.saufCategories?.includes(c.categorie)) return false;
    return regle.familles.includes(c.famille) || regle.motifs.some((m) => m.test(champ));
  });
}
