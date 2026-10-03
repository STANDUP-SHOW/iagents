/**
 * Chaque agent que le client configure devient sa propre fiche.
 *
 * Demande de max du 03/10/2026 : un secrétaire administratif, pour une association de
 * services à la personne, sur tel CRM et tel ERP, ce n'est plus « le secrétaire du
 * catalogue » mais un expert de plus — et à force d'embauches, des milliers de fiches.
 *
 * La fiche fille ne fait qu'AJOUTER à sa fiche mère : l'activité de la maison (ses mots,
 * ses pièces, ses règles) et les logiciels que l'employeur tient en plus de ceux du poste.
 * Elle ne retire rien et ne réécrit rien — tâches, règles strictes, connecteurs, accès,
 * matériel et exécution restent ceux de la mère, et `fiches::fille_recevable` le refait
 * côté Rust avant d'écrire, pour qu'un écran fautif ne puisse pas alléger une règle.
 *
 * Rien de personnel n'y entre : ni prénom, ni voix, ni la phrase dite par le client. Ceux-là
 * restent dans `installation.json`. La fiche ne décrit que la combinaison poste × activité ×
 * logiciels, et son identifiant en est l'empreinte : deux employeurs qui composent le même
 * agent obtiennent la même fiche. C'est ce qui permettrait un jour de les rassembler ; les
 * faire sortir du poste est une décision qui reste à max.
 */
import type { Activite, Logiciel, Qualification } from './entretien.ts';
import { phrasePortee } from './entretien.ts';

/** Ce que la fiche fille lit de sa mère : le reste est recopié tel quel. */
export interface FicheMere {
  id: string;
  nom: string;
  description?: string;
  expert?: { connaissances?: { titre: string; resume: string }[]; regles?: string[]; [k: string]: unknown };
  qualifications?: { logiciels?: Qualification[]; [k: string]: unknown };
  [k: string]: unknown;
}

/** Un logiciel que l'employeur tient. `remplace` : celui de la fiche qu'il remplace, s'il y en a un. */
export interface LogicielTenu {
  logiciel: Logiciel;
  remplace?: Qualification;
  /** Ce que la fiche disait déjà en faire, quand la demande l'a reconnu dans le poste. */
  usage?: string;
}

export interface Specialisation {
  activite: Activite | null;
  logiciels: LogicielTenu[];
}

export const FORMAT_COMPOSE = 1;

/** Ce que l'identifiant d'une fiche fille ajoute à celui de sa mère : huit chiffres hexadécimaux. */
export const IDENTIFIANT_COMPOSE = /^AG-\d{4}-[0-9A-F]{8}$/;

/**
 * FNV-1a sur 32 bits. Pas une protection : une empreinte stable, sans dépendance, la même
 * dans le navigateur et au banc. Huit chiffres suffisent pour les fiches d'un poste.
 */
function empreinte(texte: string): string {
  let h = 0x811c9dc5;
  for (const octet of new TextEncoder().encode(texte)) {
    h ^= octet;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).toUpperCase().padStart(8, '0');
}

/** Les logiciels qui ne sont pas déjà dans les qualifications de la mère, dans un ordre stable. */
function ajoutes(mere: FicheMere, s: Specialisation): LogicielTenu[] {
  const deja = new Set((mere.qualifications?.logiciels ?? []).map((q) => q.logiciel));
  const vus = new Set<string>();
  return s.logiciels
    .filter((t) => !deja.has(t.logiciel.id) && !vus.has(t.logiciel.id) && vus.add(t.logiciel.id))
    .sort((a, b) => a.logiciel.id.localeCompare(b.logiciel.id));
}

export function identifiantCompose(mere: FicheMere, s: Specialisation): string {
  const cle = [mere.id, s.activite?.id ?? '', ...ajoutes(mere, s).map((t) => t.logiciel.id)].join('|');
  return `${mere.id}-${empreinte(cle)}`;
}

const minuscule = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

function usageAjoute(t: LogicielTenu, nomDe: (id: string) => string | undefined): string {
  if (t.usage) return t.usage;
  const portee = phrasePortee(t.logiciel);
  if (t.remplace) {
    const ancien = nomDe(t.remplace.logiciel) ?? 'l’outil de ma fiche';
    return `Chez cet employeur, je fais dans ${t.logiciel.nom} ce que ma fiche fait dans ${ancien} : ${minuscule(t.remplace.usage)} ${portee}`;
  }
  return `Chez cet employeur, je tiens ${t.logiciel.nom}. ${portee}`;
}

/**
 * La fiche fille, ou `null` quand rien ne la distingue de sa mère : sans activité ni
 * logiciel de plus, l'agent est celui du catalogue et garde son identifiant.
 */
export function ficheComposee(
  mere: FicheMere,
  s: Specialisation,
  nomDe: (id: string) => string | undefined = () => undefined
): (FicheMere & { compose: Record<string, unknown> }) | null {
  const plus = ajoutes(mere, s);
  const activite = s.activite;
  if (!activite && plus.length === 0) return null;

  const p = activite?.pack;
  const connaissances = [
    ...(mere.expert?.connaissances ?? []),
    ...(activite
      ? [{ titre: `La maison : ${activite.nom}`, resume: activite.trait }]
      : []),
    ...(p?.vocabulaire ?? []).map((v) => ({ titre: v.terme, resume: v.sens })),
    ...(p?.documents ?? []).map((d) => ({ titre: d.nom, resume: d.role })),
  ];
  // Les règles de la branche s'ajoutent à celles du poste, jamais à leur place. Elles
  // n'atteignaient l'agent par aucun chemin avant cette fiche : `reglesDeLaBranche` existait
  // et personne ne l'appelait.
  const regles = [...(mere.expert?.regles ?? []), ...(p?.regles ?? [])];

  const noms = plus.map((t) => t.logiciel.nom);
  const nom = [mere.nom, activite ? ` — ${activite.nom}` : '', noms.length ? ` · ${noms.join(', ')}` : ''].join('');
  const precision = [
    activite ? `pour une maison de la branche « ${activite.nom} »` : '',
    noms.length ? `sur ${noms.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  return {
    ...mere,
    id: identifiantCompose(mere, s),
    nom,
    description: `${mere.description ?? ''} Préparé ${precision}.`.trim(),
    expert: { ...mere.expert, connaissances, regles },
    qualifications: {
      ...mere.qualifications,
      logiciels: [
        ...(mere.qualifications?.logiciels ?? []),
        ...plus.map((t) => ({ logiciel: t.logiciel.id, usage: usageAjoute(t, nomDe) })),
      ],
    },
    compose: {
      format: FORMAT_COMPOSE,
      mere: mere.id,
      activite: activite?.id ?? null,
      logicielsAjoutes: plus.map((t) => t.logiciel.id),
    },
  };
}
