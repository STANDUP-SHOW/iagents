/**
 * Validates catalogue/activites.json — the trades of the client companies, which become the
 * packs added to an agent. Distinct from the `secteur` of a fiche, which names one of the 43
 * job families of the catalogue; confusing the two would break the shop in a way nobody
 * would notice for months.
 * Exit code 1 on any failure.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const ref = JSON.parse(readFileSync(join(racine, 'catalogue/activites.json'), 'utf8'));
const catalogue = JSON.parse(readFileSync(join(racine, 'catalogue/catalogue.json'), 'utf8'));

let fautes = 0;
const faute = (msg: string) => { fautes++; console.log(`  ✗ ${msg}`); };

const familles = new Set<string>(ref.familles);
const ids = new Set<string>();
const appellations = new Map<string, string>();

ref.activites.forEach((a: any, i: number) => {
  const attendu = `ACT-${String(i + 1).padStart(4, '0')}`;
  if (a.id !== attendu) faute(`${a.nom} : identifiant ${a.id}, attendu ${attendu}`);
  if (ids.has(a.id)) faute(`identifiant ${a.id} en double`); else ids.add(a.id);
  if (!familles.has(a.famille)) faute(`${a.nom} : famille inconnue « ${a.famille} »`);
  // Le client dit son métier avec ses mots : deux activités ne peuvent pas répondre au même.
  for (const mot of [a.nom, ...(a.alias ?? [])]) {
    const k = mot.trim().toLowerCase();
    if (appellations.has(k)) faute(`appellation « ${mot} » portée par ${appellations.get(k)} et ${a.id}`);
    else appellations.set(k, a.id);
  }
  if (!a.trait || a.trait.length < 40) faute(`${a.nom} : le trait doit dire ce qui caractérise la branche`);
  if (a.trait && a.trait.length > 260) faute(`${a.nom} : trait trop long, une ligne suffit`);
});

// Le mot « secteur » appartient aux 43 familles de métiers du catalogue. Une activité qui
// porterait le même nom qu'un secteur ferait croire aux deux axes qu'ils sont le même.
const secteurs = new Set<string>(catalogue.agents.map((a: any) => String(a.secteur).toLowerCase()));
for (const a of ref.activites) {
  if (secteurs.has(a.nom.toLowerCase())) {
    faute(`${a.nom} porte le nom d'un secteur de métier du catalogue : les deux axes doivent rester distincts`);
  }
}

const parFamille = new Map<string, number>();
for (const a of ref.activites) parFamille.set(a.famille, (parFamille.get(a.famille) ?? 0) + 1);
const vides = ref.familles.filter((f: string) => !parFamille.has(f));
if (vides.length) console.log(`  ⟳ familles encore sans activité : ${vides.join(', ')}`);

console.log(`${ref.activites.length} activités, ${fautes} faute(s)`);
if (fautes) process.exit(1);
