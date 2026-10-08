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
 * agent obtiennent la même fiche.
 *
 * Elle remonte au catalogue commun (choix de max du 03/10/2026 : « Automatique »), mais ce
 * qui part n'est pas la fiche : c'est sa RECETTE, le bloc `compose`, fait d'identifiants et
 * de rien d'autre. Le catalogue commun refait la fiche depuis ses propres sources avec
 * `ficheDepuisRecette`. Rien de ce que le poste a écrit ne voyage donc, pas même une phrase
 * qu'un écran fautif y aurait glissée, et deux recettes égales donnent la même fiche des deux
 * côtés.
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

/** Logiciel ajouté → logiciel de la mère qu'il remplace, clés dans l'ordre des ajouts. */
function remplacements(plus: LogicielTenu[]): Record<string, string> {
  return Object.fromEntries(plus.filter((t) => t.remplace).map((t) => [t.logiciel.id, t.remplace!.logiciel]));
}

export function identifiantCompose(mere: FicheMere, s: Specialisation): string {
  // Le remplacement entre dans l'empreinte : il change la phrase d'usage, donc la fiche.
  const cle = [
    mere.id,
    s.activite?.id ?? '',
    ...ajoutes(mere, s).map((t) => (t.remplace ? `${t.logiciel.id}>${t.remplace.logiciel}` : t.logiciel.id)),
  ].join('|');
  return `${mere.id}-${empreinte(cle)}`;
}

const minuscule = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

function usageAjoute(t: LogicielTenu, nomDe: (id: string) => string | undefined): string {
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
      remplacements: remplacements(plus),
    },
  };
}

/** Ce qui remonte au catalogue commun : des identifiants, et rien d'autre. */
export interface RecetteComposee {
  format: number;
  mere: string;
  activite: string | null;
  logicielsAjoutes: string[];
  remplacements: Record<string, string>;
}

const CLES_DE_LA_RECETTE = ['format', 'mere', 'activite', 'logicielsAjoutes', 'remplacements'];
const ID_FICHE = /^AG-\d{4}$/;
const ID_ACTIVITE = /^ACT-\d{4}$/;
const ID_LOGICIEL = /^LOG-\d{4}$/;

/**
 * La recette, si elle n'est faite que d'identifiants bien formés ; sinon la raison du refus.
 * Le même contrôle tourne côté poste (`partage::recette_de`, en Rust) et côté catalogue
 * commun : une clé de plus, un texte à la place d'un identifiant, et rien ne part.
 */
export function recetteRecevable(brute: unknown): RecetteComposee | string {
  if (brute === null || typeof brute !== 'object' || Array.isArray(brute)) return 'la recette n’est pas un objet';
  const r = brute as Record<string, unknown>;
  const cles = Object.keys(r).sort();
  if (JSON.stringify(cles) !== JSON.stringify([...CLES_DE_LA_RECETTE].sort())) {
    return `la recette porte ${cles.join(', ')} au lieu de ${CLES_DE_LA_RECETTE.join(', ')}`;
  }
  if (r.format !== FORMAT_COMPOSE) return `format ${String(r.format)} inconnu`;
  if (typeof r.mere !== 'string' || !ID_FICHE.test(r.mere)) return 'fiche mère mal nommée';
  if (r.activite !== null && (typeof r.activite !== 'string' || !ID_ACTIVITE.test(r.activite))) {
    return 'activité mal nommée';
  }
  const l = r.logicielsAjoutes;
  if (!Array.isArray(l) || l.length > 50 || !l.every((x) => typeof x === 'string' && ID_LOGICIEL.test(x))) {
    return 'logiciels mal nommés';
  }
  const m = r.remplacements;
  if (m === null || typeof m !== 'object' || Array.isArray(m)) return 'remplacements mal formés';
  for (const [k, v] of Object.entries(m)) {
    if (!l.includes(k) || typeof v !== 'string' || !ID_LOGICIEL.test(v)) return 'remplacements mal formés';
  }
  return r as unknown as RecetteComposee;
}

/** JSON aux clés triées : le poste (Rust) et l'écran ne rangent pas les clés dans le même ordre. */
export function canonique(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonique).join(',')}]`;
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonique(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

/** La recette d'une fiche fille : son bloc `compose`, revérifié. */
export function recetteDe(fille: { compose: Record<string, unknown> }): RecetteComposee | string {
  return recetteRecevable(fille.compose);
}

/**
 * Refait la fiche depuis sa recette et les sources du catalogue. C'est ce que fait le
 * catalogue commun en recevant une recette : il ne croit pas la fiche du poste, il la refait,
 * et refuse une recette qui ne retombe pas exactement sur elle-même (logiciel déjà dans la
 * mère, remplacement d'un logiciel que la mère n'a pas, ordre non canonique).
 */
export function ficheDepuisRecette(
  recette: RecetteComposee,
  sources: { mere: FicheMere; activites: Activite[]; logiciels: Logiciel[] }
): (FicheMere & { compose: Record<string, unknown> }) | string {
  const { mere } = sources;
  if (mere.id !== recette.mere) return 'la fiche mère ne correspond pas';
  let activite: Activite | null = null;
  if (recette.activite) {
    activite = sources.activites.find((a) => a.id === recette.activite) ?? null;
    if (!activite) return `activité ${recette.activite} inconnue`;
  }
  const qualifs = mere.qualifications?.logiciels ?? [];
  const tenus: LogicielTenu[] = [];
  for (const id of recette.logicielsAjoutes) {
    const logiciel = sources.logiciels.find((x) => x.id === id);
    if (!logiciel) return `logiciel ${id} inconnu`;
    const ancien = recette.remplacements[id];
    const remplace = ancien ? qualifs.find((q) => q.logiciel === ancien) : undefined;
    if (ancien && !remplace) return `${id} remplacerait ${ancien}, que la fiche mère ne tient pas`;
    tenus.push({ logiciel, remplace });
  }
  const nomDe = (id: string) => sources.logiciels.find((x) => x.id === id)?.nom;
  const fiche = ficheComposee(mere, { activite, logiciels: tenus }, nomDe);
  if (!fiche) return 'la recette n’ajoute rien à la fiche mère';
  if (canonique(fiche.compose) !== canonique(recette)) return 'la recette ne retombe pas sur elle-même';
  return fiche;
}
