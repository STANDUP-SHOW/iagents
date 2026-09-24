/**
 * Les connecteurs, côté application.
 *
 * Le référentiel V6 pose lui-même sa règle : « un connecteur n'est activé qu'après
 * identification de son éditeur, de son authentification, de ses permissions, de ses coûts
 * et de son risque ». Écrite dans un document, cette règle ne refuse rien. Ce module est
 * l'endroit où elle refuse : aucun écran ne propose de connecter quoi que ce soit sans
 * passer par `demanderActivation`, qui rend soit un refus motivé, soit le mode d'emploi.
 *
 * La règle elle-même vit dans outils/activation.ts, avec le banc et l'import. Trois copies
 * d'une règle, c'est trois réponses différentes le jour où l'une bouge.
 *
 * Au 23/09/2026 elle refuse les 137 : le relevé ne chiffre aucun coût et ne classe le risque
 * que de 20 produits. C'est voulu — le jour où quelqu'un renseigne OFF001, le bouton
 * apparaît sans qu'une ligne de code change.
 */
import { manques, EXIGENCES, type Condition } from '../../../outils/activation.ts';
import {
  CAPACITES,
  SERVI_PAR_L_APPLICATION,
  type Capacite,
} from '../../../outils/capacites.ts';

export { CAPACITES, SERVI_PAR_L_APPLICATION, type Capacite };

export type Trilogique = boolean | 'partiel' | 'a-confirmer';

export interface ServeurMcp {
  mode: string;
  statut: string;
  source: string;
}

export interface McpConnecteur {
  prevu: Trilogique;
  chantier: 'a-developper' | 'a-construire' | 'a-qualifier' | 'a-confirmer';
  urgence: 'prioritaire' | 'fondamental' | null;
  transport: 'stdio' | 'streamable-http' | 'stdio-ou-http' | 'a-confirmer';
  statutReleve: string;
  serveur: ServeurMcp | null;
}

export interface Connecteur {
  id: string;
  nom: string;
  categorie: 'metier' | 'communication' | 'bureautique';
  famille: string;
  specialite: string;
  zone: string;
  deploiement: 'cloud' | 'serveur' | 'serveur-et-cloud' | 'a-confirmer';
  api: Trilogique;
  authentification: string;
  accesRequis: string;
  adminRequis: 'oui' | 'souvent' | 'parfois' | 'non' | 'a-confirmer';
  lecture: Trilogique;
  ecriture: Trilogique;
  webhooks: Trilogique;
  voieDesktop: string;
  mcp: McpConnecteur;
  risque: 'critique' | 'eleve' | 'moyen' | 'faible' | null;
  priorite: 'P0' | 'P1' | 'P2' | null;
  cout: number | null;
  etapesClient: string[];
  etapesIntegrateur: string[];
  urlProduit: string;
  urlDocumentation: string;
  sert: Capacite[];
  activation: { activable: boolean; manques: Condition[] };
  validation: string;
  validationNote: string;
  limites: string;
}

export interface Pack {
  id: string;
  secteur: string;
  libelle: string;
  coeur: string[];
  optionnels: string[];
  communication: string[];
  bureautique: string[];
  controle: string;
  runtime: string;
}

export interface ReferentielConnecteurs {
  categories: string[];
  familles: string[];
  packs: Pack[];
  connecteurs: Connecteur[];
}

/** Ce que rend la demande d'activation : jamais un booléen nu, toujours de quoi l'expliquer. */
export type Reponse =
  | { accorde: false; motif: string; manques: Condition[] }
  | {
      accorde: true;
      connecteur: Connecteur;
      authentification: string;
      accesRequis: string;
      etapesClient: string[];
      etapesIntegrateur: string[];
    };

const INCONNU = (id: string): Reponse => ({
  accorde: false,
  motif: `Aucun connecteur « ${id} » au catalogue.`,
  manques: [],
});

/**
 * Le seul chemin vers une connexion. Ce qui est refusé ici est refusé partout : l'écran
 * n'affiche pas de bouton, l'agent ne reçoit pas d'outil, et le motif est écrit en clair
 * pour que le client sache ce qui manque plutôt que de croire à une panne.
 *
 * La règle est rejouée à chaque appel plutôt que lue dans le fichier : un catalogue
 * fabriqué à la main pourrait porter `activable: true` sans remplir la moindre condition.
 */
export function demanderActivation(ref: ReferentielConnecteurs, id: string): Reponse {
  const c = ref.connecteurs.find((x) => x.id === id);
  if (!c) return INCONNU(id);

  const absents = manques(c);
  if (absents.length > 0) {
    return {
      accorde: false,
      motif:
        `${c.nom} ne peut pas encore être connecté : il manque ` +
        absents.map((m) => EXIGENCES[m]).join(', ') +
        '.',
      manques: absents,
    };
  }
  return {
    accorde: true,
    connecteur: c,
    authentification: c.authentification,
    accesRequis: c.accesRequis,
    etapesClient: c.etapesClient,
    etapesIntegrateur: c.etapesIntegrateur,
  };
}

/** Les connecteurs que l'application a le droit de proposer. Aujourd'hui : aucun. */
export function activables(ref: ReferentielConnecteurs): Connecteur[] {
  return ref.connecteurs.filter((c) => manques(c).length === 0);
}

export interface Rubrique {
  categorie: string;
  familles: { famille: string; connecteurs: Connecteur[] }[];
}

/**
 * La matrice à cocher, rangée comme le client la lit : trois rubriques, puis les familles
 * par ordre alphabétique. On montre tout, y compris ce qui n'est pas activable — cacher un
 * connecteur incomplet ferait croire qu'il n'existe pas, alors qu'il attend un chiffrage.
 */
export function matrice(ref: ReferentielConnecteurs): Rubrique[] {
  return ref.categories.map((categorie) => {
    const dedans = ref.connecteurs.filter((c) => c.categorie === categorie);
    const familles = [...new Set(dedans.map((c) => c.famille))].sort();
    return {
      categorie,
      familles: familles.map((famille) => ({
        famille,
        connecteurs: dedans
          .filter((c) => c.famille === famille)
          .sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
      })),
    };
  });
}

export interface Rayon {
  titre: string;
  /** Ce que le rayon dit au client, en une ligne. */
  precision: string;
  connecteurs: Connecteur[];
}

export interface PackDuMetier {
  secteur: string;
  libelle: string;
  controle: string;
  rayons: Rayon[];
}

/**
 * Ce qu'on rencontre dans ce métier, rangé comme un client le lit.
 *
 * C'est le deuxième point du jalon B : la fiche déclare son secteur, l'application propose
 * les connecteurs de son pack. Rien à saisir. Un comptable voit Pennylane, Xero, Sage et
 * QuickBooks, pas les onze connecteurs de fichiers du catalogue.
 *
 * Rend `null` quand le relevé n'a pas de pack pour ce secteur — au 23/09/2026, `audit` et
 * ses douze fiches. L'écran retombe alors sur la proposition par besoin, plus large et
 * moins juste, plutôt que de montrer une liste vide.
 */
export function packDuMetier(
  ref: ReferentielConnecteurs,
  secteur: string
): PackDuMetier | null {
  const pack = (ref.packs ?? []).find((p) => p.secteur === secteur);
  if (!pack) return null;

  const par = (ids: string[]): Connecteur[] =>
    ids
      .map((id) => ref.connecteurs.find((c) => c.id === id))
      .filter((c): c is Connecteur => c !== undefined)
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

  const rayons: Rayon[] = [
    {
      titre: 'Le logiciel de votre métier',
      precision: "C'est là que travaille votre agent. Sans lui, il ne fait qu'écrire des documents.",
      connecteurs: par(pack.coeur),
    },
    {
      titre: 'Ce qu\'on rencontre aussi',
      precision: 'Moins courant dans ce métier, mais votre agent sait s\'en servir.',
      connecteurs: par(pack.optionnels),
    },
    {
      titre: 'Pour parler à vos clients et à votre équipe',
      precision: 'Par où votre agent reçoit les demandes et donne de ses nouvelles.',
      connecteurs: par(pack.communication),
    },
    {
      titre: 'Vos documents et votre agenda',
      precision: 'Où vivent les fichiers, les messages et les rendez-vous.',
      connecteurs: par(pack.bureautique),
    },
  ].filter((r) => r.connecteurs.length > 0);

  return { secteur: pack.secteur, libelle: pack.libelle, controle: pack.controle, rayons };
}

export interface Besoin {
  capacite: Capacite;
  /** Qui peut le servir. Vide quand c'est l'application elle-même — voir `parLApplication`. */
  candidats: Connecteur[];
  parLApplication: string | null;
}

/**
 * Ce que réclame une fiche, traduit en connecteurs proposables. La fiche dit « email » ; le
 * client choisit. On rend aussi les candidats non activables : le client a le droit de voir
 * que Microsoft 365 existe et d'apprendre ce qui lui manque, plutôt qu'une liste vide.
 */
export function besoinsDeLaFiche(
  ref: ReferentielConnecteurs,
  declares: string[]
): Besoin[] {
  return declares
    .filter((d): d is Capacite => (CAPACITES as readonly string[]).includes(d))
    .map((capacite) => ({
      capacite,
      candidats: ref.connecteurs
        .filter((c) => c.sert.includes(capacite))
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
      parLApplication: SERVI_PAR_L_APPLICATION[capacite] ?? null,
    }));
}

/** Une phrase parlée, pour l'agent qui doit dire de vive voix pourquoi il ne peut pas. */
export function phraseRefus(reponse: Reponse): string {
  if (reponse.accorde) return '';
  return reponse.motif;
}

/** Ce qu'il reste à faire pour ouvrir un connecteur, condition par condition. */
export function resteAFaire(ref: ReferentielConnecteurs): Map<Condition, string[]> {
  const par = new Map<Condition, string[]>();
  for (const c of ref.connecteurs) {
    for (const m of manques(c)) par.set(m, [...(par.get(m) ?? []), c.id]);
  }
  return par;
}
