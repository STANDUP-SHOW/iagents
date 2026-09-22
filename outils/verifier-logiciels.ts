/**
 * Validates catalogue/logiciels.json, the referential a fiche quotes when it claims to know
 * a business tool. Nothing here is derived: it is source data, like catalogue/reference/.
 * What this checks is that it stays usable — unique ids and names, declared categories and
 * domains, and no product from the V6 referential silently dropped along the way.
 * Exit code 1 on any failure.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const ref = JSON.parse(readFileSync(join(racine, 'catalogue/logiciels.json'), 'utf8'));
const v6 = JSON.parse(readFileSync(join(racine, 'catalogue/reference/connecteurs-erp-crm.json'), 'utf8'));

const categories = new Set<string>(ref.categories);
const domaines = new Set<string>(ref.domaines);
const API = new Set(['officielle', 'limitee', 'partenaire', 'aucune', 'a-confirmer']);
const MCP = new Set(['officiel', 'communautaire', 'a-developper', 'aucun']);
const DEPLOIEMENT = new Set(['cloud', 'serveur', 'serveur-et-cloud']);

let fautes = 0;
const faute = (msg: string) => { fautes++; console.log(`  ✗ ${msg}`); };

const ids = new Set<string>();
const appellations = new Map<string, string>();

ref.logiciels.forEach((l: any, i: number) => {
  const attendu = `LOG-${String(i + 1).padStart(4, '0')}`;
  if (l.id !== attendu) faute(`${l.nom} : identifiant ${l.id}, attendu ${attendu}`);
  if (ids.has(l.id)) faute(`identifiant ${l.id} en double`); else ids.add(l.id);
  // Le nom et ses alias servent à reconnaître ce que dit le client à l'entretien : deux entrées
  // ne peuvent pas répondre à la même appellation.
  for (const a of [l.nom, ...(l.alias ?? [])]) {
    const k = a.trim().toLowerCase();
    if (appellations.has(k)) faute(`appellation « ${a} » portée par ${appellations.get(k)} et ${l.id}`);
    else appellations.set(k, l.id);
  }
  if (!categories.has(l.categorie)) faute(`${l.nom} : catégorie inconnue « ${l.categorie} »`);
  for (const d of l.domaines ?? []) if (!domaines.has(d)) faute(`${l.nom} : domaine inconnu « ${d} »`);
  if (!l.domaines?.length) faute(`${l.nom} : aucun domaine déclaré`);
  if (!DEPLOIEMENT.has(l.deploiement)) faute(`${l.nom} : déploiement inconnu « ${l.deploiement} »`);
  if (!API.has(l.acces?.api)) faute(`${l.nom} : niveau d'API inconnu « ${l.acces?.api} »`);
  if (!MCP.has(l.acces?.mcp)) faute(`${l.nom} : statut MCP inconnu « ${l.acces?.mcp} »`);
  if (typeof l.acces?.navigateur !== 'boolean') faute(`${l.nom} : acces.navigateur doit être un booléen`);
  if (!l.editeur) faute(`${l.nom} : éditeur manquant`);
  if (!l.marches?.length) faute(`${l.nom} : aucun marché déclaré`);
});

// Le relevé V6 vient des tableurs de Max : aucun de ses produits ne disparaît sans qu'on le voie.
for (const e of v6.entrees) {
  if (!appellations.has(String(e['Nom']).trim().toLowerCase())) {
    faute(`« ${e['Nom']} » du référentiel V6 n'a pas d'entrée ni d'alias dans logiciels.json`);
  }
}

const parCategorie = new Map<string, number>();
for (const l of ref.logiciels) parCategorie.set(l.categorie, (parCategorie.get(l.categorie) ?? 0) + 1);
const vides = ref.categories.filter((c: string) => !parCategorie.has(c));
if (vides.length) console.log(`  ⟳ catégories encore sans logiciel : ${vides.join(', ')}`);

console.log(`${ref.logiciels.length} logiciels, ${fautes} faute(s)`);
if (fautes) process.exit(1);
