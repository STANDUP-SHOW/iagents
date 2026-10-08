/**
 * Adds the new fiches an editorial file announces, before `npm run editorial` writes them.
 *
 * `appliquer-editorial` only rewrites fiches that already exist: the catalogue owns the
 * identity, and it refuses an id it does not know. A new métier (« Deviseur en industrie
 * graphique », which no fiche covered) is announced in the editorial file under
 * `nouvelles: [{ id, metier, slug, profil }]`, with `secteurNom` when the secteur is new.
 * This tool writes those identities into catalogue/catalogue.json, recounts the secteurs,
 * and lays an empty package in agents/ for the editorial to fill. It never touches a fiche
 * that already exists, so it can be run again.
 *
 * Usage: npm run ajouter-fiches -- imprimerie-arts-graphiques
 * Then:  npm run editorial -- imprimerie-arts-graphiques
 *        npm run verifier -- --corriger
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const secteur = process.argv[2];
if (!secteur) {
  console.error('Usage : npm run ajouter-fiches -- <secteur>');
  process.exit(1);
}

const cheminCatalogue = join(racine, 'catalogue/catalogue.json');
const catalogue = JSON.parse(readFileSync(cheminCatalogue, 'utf8'));
const editorial = JSON.parse(readFileSync(join(racine, 'outils/editorial', `${secteur}.json`), 'utf8'));
const versionApp: string = JSON.parse(readFileSync(join(racine, 'desktop/package.json'), 'utf8')).version;
const profils = new Set<string>(catalogue.profils.map((p: any) => p.id));
const nouvelles: { id: string; metier: string; slug: string; profil: string }[] = editorial.nouvelles ?? [];
if (!nouvelles.length) {
  console.log(`aucune fiche annoncée sous « nouvelles » dans outils/editorial/${secteur}.json`);
  process.exit(0);
}

if (!catalogue.secteurs.some((s: any) => s.id === secteur)) {
  if (!editorial.secteurNom) throw new Error(`secteur ${secteur} inconnu : donner « secteurNom » dans l'éditorial`);
  catalogue.secteurs.push({ id: secteur, nom: editorial.secteurNom, agents: 0 });
  console.log(`  + secteur ${secteur} (${editorial.secteurNom})`);
}

const parId = new Map<string, any>(catalogue.agents.map((a: any) => [a.id, a]));
const slugs = new Set<string>(catalogue.agents.map((a: any) => a.slug));
const fichiers = readdirSync(join(racine, 'agents'));
let ajoutees = 0;

for (const n of nouvelles) {
  if (!/^AG-\d{4}$/.test(n.id)) throw new Error(`identifiant mal formé : ${n.id}`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(n.slug)) throw new Error(`slug mal formé : ${n.slug}`);
  if (!profils.has(n.profil)) throw new Error(`${n.id} : profil ${n.profil} inconnu du catalogue`);
  if (!editorial.agents.some((e: any) => e.id === n.id)) throw new Error(`${n.id} annoncée sans éditorial`);
  const deja = parId.get(n.id);
  if (deja) {
    if (deja.secteur !== secteur || deja.slug !== n.slug || deja.metier !== n.metier) {
      throw new Error(`${n.id} existe déjà sous une autre identité (${deja.secteur}, ${deja.metier})`);
    }
  } else {
    if (slugs.has(n.slug)) throw new Error(`slug ${n.slug} déjà pris par une autre fiche`);
    const entree = { id: n.id, secteur, metier: n.metier, slug: n.slug, profil: n.profil };
    catalogue.agents.push(entree);
    parId.set(n.id, entree);
    slugs.add(n.slug);
    ajoutees++;
    console.log(`  + ${n.id} ${n.metier}`);
  }
  if (!fichiers.some((f) => f.startsWith(`${n.id}-`))) {
    const chemin = join(racine, 'agents', `${n.id}-${n.slug}.json`);
    if (existsSync(chemin)) continue;
    // The editorial writes everything the client reads; verifier --corriger derives the rest.
    const vide = {
      format: 'iagent-paquet/1',
      id: n.id,
      slug: n.slug,
      version: '1.0.0',
      famille: 'metier',
      secteur,
      nom: n.metier,
      miseAJour: { canal: 'stable', appMinimum: versionApp, notes: 'Première version.' },
      profil_risque: 'PR-00',
    };
    writeFileSync(chemin, JSON.stringify(vide, null, 2) + '\n');
  }
}

catalogue.agents.sort((a: any, b: any) => a.id.localeCompare(b.id));
for (const s of catalogue.secteurs) s.agents = catalogue.agents.filter((a: any) => a.secteur === s.id).length;
writeFileSync(cheminCatalogue, JSON.stringify(catalogue, null, 2) + '\n');
console.log(`${ajoutees} fiche(s) ajoutée(s) au catalogue pour le secteur ${secteur}`);
