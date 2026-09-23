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
  activation: { activable: boolean; manques: Condition[] };
  validation: string;
  validationNote: string;
  limites: string;
}

export interface ReferentielConnecteurs {
  categories: string[];
  familles: string[];
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
