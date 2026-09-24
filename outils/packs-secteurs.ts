/**
 * Les 43 packs sectoriels : pour un secteur, les connecteurs qu'on y rencontre.
 *
 * Deuxième point du jalon B (`docs/cadrage.md` §4) : « la fiche déclare son pack
 * sectoriel, l'application propose les connecteurs de ce pack. Rien à saisir. »
 * Sans ça, une fiche de comptable se voit proposer les onze connecteurs de
 * fichiers du catalogue au lieu de Pennylane, Xero, Sage et QuickBooks.
 *
 * Vit ici et pas dans l'import, pour la même raison que `activation.ts` :
 * `verifier-connecteurs.ts` rejoue le calcul et refuse toute divergence. Un
 * champ dérivé écrit à un seul endroit finit par diverger de sa source.
 */

export type Pack = {
  id: string;
  secteur: string;
  libelle: string;
  coeur: string[];
  optionnels: string[];
  communication: string[];
  bureautique: string[];
  controle: string;
  runtime: string;
};

/** Slug stable, le même que celui des fiches : `Édition recherche contenu` → `edition-recherche-contenu`. */
export function slugSecteur(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Les identifiants du catalogue font deux à quatre lettres puis trois chiffres :
 * `HR001`, `ACC001`, `AUTO001`. En exiger trois jetait les six connecteurs RH du
 * pack des ressources humaines en silence, et ce pack se retrouvait sans aucun
 * ERP/CRM cœur — d'où le banc qui compte les paniers vides.
 */
const RESSEMBLE_A_UN_ID = /^[A-Z]{2,5}[0-9]{2,4}$/;

/** Ce qu'un pack cite mais que le catalogue ne connaît pas. */
export type Inconnu = { secteur: string; id: string };

/**
 * Convertit le relevé en packs. `connus` est l'ensemble des identifiants du
 * catalogue : un identifiant absent n'est PAS écrit dans le pack — un pack qui
 * promet un connecteur inexistant ment au client — mais il est rendu à part
 * pour que le banc le nomme au lieu de le taire.
 */
export function convertir(
  entrees: Record<string, string>[],
  connus: Set<string>
): { packs: Pack[]; inconnus: Inconnu[] } {
  const inconnus: Inconnu[] = [];

  const liste = (brut: string | undefined, secteur: string): string[] => {
    const ids = (brut ?? '')
      .split(/[•·,;]/)
      .map((x) => x.trim().toUpperCase())
      .filter((x) => RESSEMBLE_A_UN_ID.test(x));
    for (const id of ids) if (!connus.has(id)) inconnus.push({ secteur, id });
    return ids.filter((id) => connus.has(id));
  };

  const packs = entrees.map((e) => {
    const secteur = slugSecteur(e['Secteur'] ?? '');
    return {
      id: e['Pack ID'] ?? '',
      secteur,
      libelle: e['Secteur'] ?? '',
      coeur: liste(e['ERP/CRM cœur'], secteur),
      optionnels: liste(e['ERP/CRM optionnels'], secteur),
      communication: liste(e['Communication par défaut'], secteur),
      bureautique: liste(e['Bureautique par défaut'], secteur),
      controle: e['Niveau de contrôle'] ?? '',
      runtime: e['Runtime principal'] ?? '',
    };
  });

  return { packs, inconnus };
}
