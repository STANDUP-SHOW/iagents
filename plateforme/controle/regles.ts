// Les règles du Control Plane écrites une seule fois : transitions de statut
// des Box et des Skill Packs, comparaison de versions, et ce qui se lit dans
// le catalogue (templates d'agents, compteur public).

import { depot } from '../depot.ts';
import catalogueJson from '../../catalogue/catalogue.json' with { type: 'json' };
import type { Box, RapportUsine, SkillPack, StatutBox } from '../modele.ts';
import { profilMateriel } from '../../box/materiel/index.ts';

type StatutSkill = SkillPack['validation_status'];

/**
 * Allowed Box transitions. Anything not listed is refused. `usine -> qualifiee`
 * only happens through a passing factory report (POST /controle/box/usine/rapport);
 * `stock | qualifiee -> provisionnee` only through /attribuer (it needs a tenant);
 * `expediee -> active` also happens on the first telemetry at the client's.
 * restituee and remplacee are final: a returned or replaced Box never runs agents
 * again under its old identity.
 */
export const TRANSITIONS_BOX: Record<StatutBox, StatutBox[]> = {
  usine: [],
  qualifiee: ['stock'],
  stock: [],
  provisionnee: ['expediee', 'active', 'suspendue', 'restituee'],
  expediee: ['active', 'restituee'],
  active: ['suspendue', 'restituee', 'remplacee'],
  suspendue: ['active', 'restituee', 'remplacee'],
  restituee: [],
  remplacee: [],
};

/** Statuses reachable through POST /controle/boxes/:id/statut (contract). */
export const STATUTS_DEMANDABLES: StatutBox[] = ['stock', 'expediee', 'active', 'suspendue', 'restituee', 'remplacee'];

/** Statuses from which /attribuer may take a Box: identified, qualified or not, but without a tenant. */
export const STATUTS_ATTRIBUABLES: StatutBox[] = ['stock', 'qualifiee'];

/** A Box whose signed requests are refused outright (http.ts): nothing of it runs any more. */
export const STATUTS_FERMES: StatutBox[] = ['suspendue', 'restituee', 'remplacee'];

/**
 * The commercial reference printed on the label (brief §12): `IA-FR-CMD-00000127`
 * for business, `IA-FR-HOME-00000128` for home. `CMD` is the brief's own code
 * for the business Box ("Commander" being the desktop application, not a gamme).
 * The counter is per gamme, kept by the platform in `compteurs/reference-box`.
 */
export function referenceBox(gamme: Box['gamme'], numero: number): string {
  if (!Number.isInteger(numero) || numero < 1 || numero > 99_999_999) throw new Error(`Numéro de Box hors bornes : ${numero}.`);
  return `IA-FR-${gamme === 'business' ? 'CMD' : 'HOME'}-${String(numero).padStart(8, '0')}`;
}

export const REFERENCE_BOX = /^IA-FR-(CMD|HOME)-\d{8}$/;

/**
 * The verdict of a factory report, derived from its tests and the hardware
 * profile's obligatory tests: `passe` only when no test failed and every
 * obligatory test is present and passed. A test `non_constate` is honest about
 * what the bench could not see, and it is enough to refuse the qualification when
 * the profile demands that test. Computed here, never read from the report.
 */
export function verdictRapport(
  tests: RapportUsine['tests'],
  testsObligatoires: readonly string[],
): { verdict: RapportUsine['verdict']; manquants: string[]; echoues: string[] } {
  const parId = new Map(tests.map((t) => [t.id, t.verdict]));
  const echoues = tests.filter((t) => t.verdict === 'echec').map((t) => t.id);
  const manquants = testsObligatoires.filter((id) => parId.get(id) !== 'passe');
  return { verdict: echoues.length === 0 && manquants.length === 0 ? 'passe' : 'echec', manquants, echoues };
}

/** The obligatory tests of a hardware profile, or null when the profile is unknown to the repository. */
export function testsObligatoiresDe(profilMaterielId: string): readonly string[] | null {
  return profilMateriel(profilMaterielId)?.tests_obligatoires ?? null;
}

/** Review circuit of a Skill Pack: candidat -> en-revue -> valide | rejete, valide -> retire. */
export const TRANSITIONS_SKILL: Record<StatutSkill, StatutSkill[]> = {
  candidat: ['en-revue'],
  'en-revue': ['valide', 'rejete'],
  valide: ['retire'],
  rejete: [],
  retire: [],
};

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export const estSemver = (v: unknown): v is string => typeof v === 'string' && SEMVER.test(v);

/** Semver precedence, by numbers never by text ("0.10.0" > "0.9.0"); a pre-release precedes its release. */
export function comparerVersions(a: string, b: string): number {
  const ma = SEMVER.exec(a);
  const mb = SEMVER.exec(b);
  if (!ma || !mb) throw new Error(`Version illisible : ${!ma ? a : b}.`);
  for (let i = 1; i <= 3; i++) {
    const d = Number(ma[i]) - Number(mb[i]);
    if (d !== 0) return Math.sign(d);
  }
  const pa = ma[4];
  const pb = mb[4];
  if (pa === undefined || pb === undefined) return pa === pb ? 0 : pa === undefined ? 1 : -1;
  const ia = pa.split('.');
  const ib = pb.split('.');
  for (let i = 0; i < Math.max(ia.length, ib.length); i++) {
    if (ia[i] === undefined) return -1;
    if (ib[i] === undefined) return 1;
    const na = /^\d+$/.test(ia[i]);
    const nb = /^\d+$/.test(ib[i]);
    if (na && nb) { const d = Number(ia[i]) - Number(ib[i]); if (d) return Math.sign(d); }
    else if (na !== nb) return na ? -1 : 1;
    else if (ia[i] !== ib[i]) return ia[i] < ib[i] ? -1 : 1;
  }
  return 0;
}

export const estEmpreinte = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);

/** An update or package URL: https only, no credentials, no query secrets. */
export function urlRecevable(v: unknown): string | null {
  if (typeof v !== 'string') return "L'adresse est absente.";
  let u: URL;
  try { u = new URL(v); } catch { return "L'adresse ne se lit pas."; }
  if (u.protocol !== 'https:') return "L'adresse doit être en https : en clair, le paquet se remplacerait sur le chemin.";
  if (u.username || u.password) return "L'adresse ne doit porter ni identifiant ni mot de passe.";
  return null;
}

// --- Catalogue ---------------------------------------------------------------

/** AG-XXXX -> path of its sheet in agents/ or socle/ (the same two folders the app reads), from the repository root. */
const fichesConnues = (): Map<string, string> => depot().fiches();

/** AG-XXXX ids that have a sheet in agents/ or socle/. */
export function templatesConnus(): Set<string> {
  return new Set(fichesConnues().keys());
}

/** Path of the sheet of an agent template, or null when the catalogue has none. */
export function cheminFiche(agentTemplateId: string): string | null {
  return fichesConnues().get(agentTemplateId) ?? null;
}

export type Compteur = {
  metiers: number;
  familles: number;
  profils: number | null;
  pourquoi_profils: string | null;
  source: string;
  calcule_le: string;
};

/**
 * The public counter (§8), computed from catalogue/catalogue.json at each call,
 * never typed by hand. `profils` stays null: the "postes possibles" method
 * (outils/postes-possibles.ts, PR #35) is not on this branch, and recopying its
 * result would be the hand-written figure §8 forbids.
 */
export function calculerCompteur(maintenant: Date): Compteur {
  const cat = catalogueJson as { agents?: { id: string; secteur: string }[] };
  const agents: { id: string; secteur: string }[] = cat.agents ?? [];
  return {
    metiers: agents.length,
    familles: new Set(agents.map((a) => a.secteur)).size,
    profils: null,
    pourquoi_profils:
      "Le nombre de profils spécialisés (métier posé dans une activité cliente) n'est pas encore calculé ici : la méthode de comptage (outils/postes-possibles.ts, PR #35) n'est pas fusionnée, et un chiffre recopié à la main ne serait pas un compteur.",
    source: 'catalogue/catalogue.json',
    calcule_le: maintenant.toISOString(),
  };
}
