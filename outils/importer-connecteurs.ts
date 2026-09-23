/**
 * Turns the three V6 connector sheets into connecteurs/catalogue.json, the single
 * file the desktop app reads. The sheets are source data — they stay untouched in
 * catalogue/reference/ — but their column names carry spaces, accents and free text,
 * which no code should have to parse at runtime.
 *
 * Nothing is invented here. A value the sheet does not state becomes null or
 * 'a-confirmer', never a guess: the whole point of the activation rule below is to
 * count what is genuinely missing.
 *
 *   node --experimental-strip-types outils/importer-connecteurs.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { manques } from './activation.ts';
import { sertQuoi } from './capacites.ts';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = (p: string) => JSON.parse(readFileSync(join(racine, p), 'utf8'));

type Ligne = Record<string, string>;

/** Slug stable : les familles servent de clés, elles ne peuvent pas porter d'accent. */
function slug(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Oui / Non / Partiel / À confirmer, écrits de huit façons dans les relevés.
 * « Partiels », « Limités », « Modules » disent tous la même chose : ça existe mais
 * pas partout. Les écraser en `true` promettrait plus que ce que la source dit.
 */
function trilogique(brut: string | undefined): true | false | 'partiel' | 'a-confirmer' {
  const v = slug(brut ?? '');
  if (!v || v === 'a-confirmer' || v === 'variable' || v === 'selon-fournisseur') return 'a-confirmer';
  if (v.startsWith('non')) return false;
  if (v.startsWith('oui') || v === 'standard' || v === 'interne') return true;
  if (v.startsWith('partiel') || v.startsWith('limite') || v === 'modules' || v.startsWith('selon')) {
    return 'partiel';
  }
  return 'a-confirmer';
}

/** Oui / Souvent / Parfois / Non — l'administrateur du client doit-il intervenir. */
function admin(brut: string | undefined): 'oui' | 'souvent' | 'parfois' | 'non' | 'a-confirmer' {
  const v = slug(brut ?? '');
  if (v === 'oui') return 'oui';
  if (v === 'souvent') return 'souvent';
  if (v === 'parfois' || v === 'selon-scopes') return 'parfois';
  if (v === 'non') return 'non';
  return 'a-confirmer';
}

function zone(brut: string | undefined): string {
  const v = slug(brut ?? '');
  if (!v || v === '-') return 'a-confirmer';
  return v;
}

function deploiement(brut: string | undefined): 'cloud' | 'serveur' | 'serveur-et-cloud' | 'a-confirmer' {
  const v = slug(brut ?? '');
  if (v === 'cloud') return 'cloud';
  if (v === 'local') return 'serveur';
  if (v.includes('cloud') && (v.includes('local') || v.includes('entreprise'))) return 'serveur-et-cloud';
  if (v === 'hybride') return 'serveur-et-cloud';
  return 'a-confirmer';
}

/**
 * Le transport MCP conseillé par le relevé. « stdio local ou HTTP » laisse le choix :
 * la valeur `stdio-ou-http` le dit, au lieu de trancher à la place de l'intégrateur.
 */
function transport(brut: string | undefined): string {
  const v = slug(brut ?? '');
  if (!v || v === '-') return 'a-confirmer';
  if (v.includes('stdio') && v.includes('http')) return 'stdio-ou-http';
  if (v.includes('stdio')) return 'stdio';
  if (v.includes('http')) return 'streamable-http';
  return 'a-confirmer';
}

/**
 * La colonne « Statut MCP » du relevé dit où en est le chantier, pas si un serveur
 * existe : « À développer » y est écrit 68 fois sur 137, et « Prioritaire » veut dire
 * prioritaire à écrire. Rien ici n'affirme qu'un connecteur MCP fonctionne aujourd'hui.
 */
function chantier(brut: string | undefined): 'a-developper' | 'a-construire' | 'a-qualifier' | 'a-confirmer' {
  const v = slug(brut ?? '');
  if (v.startsWith('a-developper') || v.startsWith('prioritaire') || v === 'fondamental') {
    return 'a-developper';
  }
  if (v.startsWith('a-construire')) return 'a-construire';
  if (v.startsWith('a-qualifier') || v.startsWith('via-')) return 'a-qualifier';
  return 'a-confirmer';
}

/** Le mot de priorité du relevé, gardé à part de l'état du chantier. */
function urgence(brut: string | undefined): 'prioritaire' | 'fondamental' | null {
  const v = slug(brut ?? '');
  if (v.startsWith('prioritaire')) return 'prioritaire';
  if (v === 'fondamental') return 'fondamental';
  return null;
}

/**
 * « À valider par version », « À qualifier avec EBP », « Retiré le 5 mai 2025 » : l'état
 * tient dans une énumération courte, le reste est une note pour l'intégrateur. Slugifier
 * la phrase entière donnait autant d'états que de lignes, donc aucun état.
 */
function validation(brut: string | undefined): { etat: string; note: string } {
  const texte = (brut ?? '').trim();
  const v = slug(texte);
  const etats: [string, string][] = [
    ['documente', 'documente'],
    ['standard', 'standard'],
    ['variable', 'variable'],
    ['a-valider', 'a-valider'],
    ['a-qualifier', 'a-qualifier'],
    ['limite', 'limite'],
    ['retire', 'retire'],
    ['specification-interne', 'interne'],
  ];
  for (const [prefixe, etat] of etats) {
    if (v === prefixe || v.startsWith(prefixe + '-')) {
      return { etat, note: v === prefixe ? '' : texte };
    }
  }
  return { etat: 'a-confirmer', note: texte };
}

/**
 * Le risque, repris du relevé des serveurs MCP. Quand une ligne dit « Moyen à élevé »
 * ou « Élevé en écriture », on garde le pire des deux : un connecteur mal classé vers
 * le bas est un connecteur activé trop vite.
 */
function risque(brut: string | undefined): 'critique' | 'eleve' | 'moyen' | 'faible' | null {
  const v = slug(brut ?? '');
  if (!v) return null;
  if (v.includes('critique')) return 'critique';
  if (v.includes('eleve')) return 'eleve';
  if (v.includes('moyen')) return 'moyen';
  if (v.includes('faible')) return 'faible';
  return null;
}

function etapes(brut: string | undefined): string[] {
  if (!brut) return [];
  return brut
    .split(/[,;•]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Le relevé des serveurs MCP porte le risque et la priorité, que les trois autres
// n'ont pas. On les rapproche par le nom du produit, seule clé commune.
const mcp = lire('catalogue/reference/mcp-serveurs.json');
const parNom = new Map<string, Ligne>();
for (const e of mcp.entrees as Ligne[]) {
  parNom.set(slug(e['Application / serveur'] ?? ''), e);
}

/** Rapproche « Microsoft 365 / Graph » de « Microsoft 365 », sans inventer de lien. */
function serveurMcp(nom: string): Ligne | undefined {
  const s = slug(nom);
  if (parNom.has(s)) return parNom.get(s);
  for (const [cle, ligne] of parNom) {
    if (cle.length >= 5 && (s.startsWith(cle + '-') || s === cle)) return ligne;
  }
  return undefined;
}

const SOURCES = [
  { fichier: 'catalogue/reference/connecteurs-erp-crm.json', categorie: 'metier' },
  { fichier: 'catalogue/reference/connecteurs-communication.json', categorie: 'communication' },
  { fichier: 'catalogue/reference/connecteurs-bureautique.json', categorie: 'bureautique' },
];

const connecteurs: Record<string, unknown>[] = [];
const familles = new Set<string>();

for (const source of SOURCES) {
  const d = lire(source.fichier);
  for (const e of d.entrees as Ligne[]) {
    const nom = e['Nom'];
    const famille = slug(e['Famille'] ?? '');
    familles.add(famille);
    const serveur = serveurMcp(nom);

    connecteurs.push({
      id: e['ID connecteur'],
      nom,
      categorie: source.categorie,
      famille,
      specialite: e['Spécialité / secteur'] ?? '',
      zone: zone(e['Zone']),
      deploiement: deploiement(e['Déploiement']),
      api: trilogique(e['API officielle']),
      // L'authentification reste en clair : « OAuth 2.0 / Entra ID » dit quelque chose
      // qu'aucune énumération courte ne rendrait, et c'est l'intégrateur qui la lit.
      authentification: e['Authentification'] ?? '',
      accesRequis: e['Accès requis'] ?? '',
      adminRequis: admin(e['Admin requis']),
      lecture: trilogique(e['Lecture']),
      ecriture: trilogique(e['Écriture']),
      webhooks: trilogique(e['Webhooks']),
      voieDesktop: e['Voie desktop'] ?? '',
      mcp: {
        // La colonne « MCP desktop » vaut « Oui » 135 fois sur 137 : elle dit la voie
        // prévue, pas un serveur qui tourne. D'où `prevu`, et non `disponible`.
        prevu: trilogique(e['MCP desktop']),
        chantier: chantier(e['Statut MCP']),
        urgence: urgence(e['Statut MCP']),
        transport: transport(e['Transport MCP conseillé']),
        statutReleve: e['Statut MCP'] ?? '',
        // Seul le relevé des serveurs MCP affirme qu'un serveur existe, et il donne sa
        // source. Quand le produit n'y figure pas, on n'affirme rien : `null` se voit.
        serveur: serveur
          ? {
              mode: serveur['Mode'] ?? '',
              statut: serveur['Statut'] ?? '',
              source: serveur['Source officielle ou registre'] ?? '',
            }
          : null,
      },
      risque: risque(serveur?.['Risque']),
      priorite: serveur?.['Priorité'] ?? null,
      // Aucun relevé ne chiffre le coût d'un connecteur. Le champ existe parce que la
      // règle d'activation l'exige ; il reste nul tant que personne ne l'a renseigné.
      cout: null,
      etapesClient: etapes(e['Étapes utilisateur']),
      etapesIntegrateur: etapes(e['Étapes intégrateur']),
      urlProduit: e['URL produit'] ?? '',
      urlDocumentation: e['URL documentation'] ?? '',
      // Dérivés, jamais saisis : `sert` dit quels besoins de fiche ce connecteur couvre, et
      // la règle d'activation relit les champs ci-dessus pour dire ce qui manque. Un
      // connecteur ne s'allume pas parce qu'on a coché une case ailleurs.
      sert: [],
      activation: null,
      validation: validation(e['Statut validation']).etat,
      validationNote: validation(e['Statut validation']).note,
      limites: e['Notes / limites'] ?? '',
    });
  }
}

// La règle de docs/cadrage.md §4.3, appliquée à chaque ligne une fois tous ses champs posés.
for (const c of connecteurs) {
  const absents = manques(c as never);
  c.activation = { activable: absents.length === 0, manques: absents };
  c.sert = sertQuoi(c as never);
}

const sortie = {
  note:
    "Converti depuis les relevés V6 de catalogue/reference/ par outils/importer-connecteurs.ts. " +
    "Ne pas modifier à la main : relancer l'import. Un champ que le relevé ne dit pas vaut null " +
    "ou « a-confirmer », jamais une valeur devinée.",
  source: 'catalogue/reference/connecteurs-*.json et mcp-serveurs.json',
  genere: new Date().toISOString().slice(0, 10),
  categories: ['metier', 'communication', 'bureautique'],
  familles: [...familles].sort(),
  connecteurs,
};

writeFileSync(
  join(racine, 'connecteurs/catalogue.json'),
  JSON.stringify(sortie, null, 2) + '\n',
  'utf8'
);

const avecRisque = connecteurs.filter((c) => c.risque !== null).length;
const activables = connecteurs.filter((c) => (c.activation as { activable: boolean }).activable).length;
const parManque = new Map<string, number>();
for (const c of connecteurs) {
  for (const m of (c.activation as { manques: string[] }).manques) {
    parManque.set(m, (parManque.get(m) ?? 0) + 1);
  }
}
console.log(
  `${connecteurs.length} connecteurs écrits, ${familles.size} familles, ` +
    `${avecRisque} avec un risque connu.`
);
console.log(`${activables} activable(s) selon la règle. Ce qui manque, condition par condition :`);
for (const [m, n] of [...parManque].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)} sans ${m}`);
}
