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

// Le contenu du pack : ce qui fait qu'un agent parle comme la branche du client. Facultatif
// tant que les 282 ne sont pas écrits, mais contrôlé dès qu'il est là — un pack à moitié
// rempli se remarquerait le jour où un client l'ajoute à son agent, pas avant.
const logiciels = new Set<string>(
  JSON.parse(readFileSync(join(racine, 'catalogue/logiciels.json'), 'utf8')).logiciels.map((l: any) => l.id)
);

const liste = (a: any, champ: string, mini: number) => {
  const v = a.pack[champ];
  if (!Array.isArray(v) || v.length < mini) {
    faute(`${a.nom} : ${champ} demande au moins ${mini} entrée(s)`);
    return [];
  }
  return v;
};

const texte = (a: any, ou: string, valeur: unknown, mini: number) => {
  if (typeof valeur !== 'string' || valeur.trim().length < mini) {
    faute(`${a.nom} : ${ou} trop court, ${mini} caractères attendus`);
  }
};

let avecPack = 0;
for (const a of ref.activites) {
  if (!a.pack) continue;
  avecPack++;
  const inconnus = Object.keys(a.pack).filter(
    (k) => !['vocabulaire', 'documents', 'unites', 'rythmes', 'interlocuteurs', 'regles', 'logiciels'].includes(k)
  );
  if (inconnus.length) faute(`${a.nom} : champ de pack inconnu « ${inconnus.join(', ')} »`);

  // Les mots de la branche : c'est par là que l'agent cesse de parler comme une application.
  const termes = new Set<string>();
  for (const v of liste(a, 'vocabulaire', 4)) {
    texte(a, `vocabulaire « ${v.terme} »`, v.terme, 2);
    texte(a, `sens de « ${v.terme} »`, v.sens, 40);
    const k = String(v.terme).trim().toLowerCase();
    if (termes.has(k)) faute(`${a.nom} : terme « ${v.terme} » en double`); else termes.add(k);
  }
  for (const d of liste(a, 'documents', 3)) {
    texte(a, `document « ${d.nom} »`, d.nom, 3);
    texte(a, `rôle de « ${d.nom} »`, d.role, 40);
  }
  for (const u of liste(a, 'unites', 2)) {
    texte(a, `unité « ${u.unite} »`, u.unite, 1);
    texte(a, `emploi de « ${u.unite} »`, u.emploi, 30);
  }
  for (const r of liste(a, 'rythmes', 2)) texte(a, 'rythme', r, 50);
  for (const i of liste(a, 'interlocuteurs', 3)) {
    texte(a, `interlocuteur « ${i.role} »`, i.role, 3);
    texte(a, `attente de « ${i.role} »`, i.attend, 40);
  }
  for (const r of liste(a, 'regles', 2)) texte(a, 'règle', r, 40);

  // Les logiciels se citent par identifiant : la fiche du logiciel reste la seule source.
  const cites = new Set<string>();
  for (const id of liste(a, 'logiciels', 2)) {
    if (!logiciels.has(id)) faute(`${a.nom} : logiciel inconnu au référentiel « ${id} »`);
    if (cites.has(id)) faute(`${a.nom} : logiciel ${id} cité deux fois`); else cites.add(id);
  }
}
if (avecPack < ref.activites.length) {
  console.log(`  ⟳ ${ref.activites.length - avecPack} activité(s) sans contenu de pack`);
}

const parFamille = new Map<string, number>();
for (const a of ref.activites) parFamille.set(a.famille, (parFamille.get(a.famille) ?? 0) + 1);
const vides = ref.familles.filter((f: string) => !parFamille.has(f));
if (vides.length) console.log(`  ⟳ familles encore sans activité : ${vides.join(', ')}`);

console.log(`${ref.activites.length} activités, ${fautes} faute(s)`);
if (fautes) process.exit(1);
