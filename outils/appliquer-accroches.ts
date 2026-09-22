/**
 * Replaces the accroche and resume_metier of every fiche of one secteur from
 * outils/accroches/<secteur>.json.
 *
 * The generator wrote a handful of sentences for 1118 fiches, one of them carrying a typo copied
 * onto 389 of them. Both texts are what a client reads in the shop, so each is rewritten by hand
 * for its own job. This tool only touches those two fields — identity, taches and derived blocks
 * are none of its business — and removes each rewritten id from catalogue/accroches-gabarit.json
 * so that list can only shrink.
 *
 * Usage: npm run accroches -- ressources-humaines
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const secteur = process.argv[2];
if (!secteur) {
  console.error('Usage : npm run accroches -- <secteur>');
  process.exit(1);
}

const catalogue = JSON.parse(readFileSync(join(racine, 'catalogue/catalogue.json'), 'utf8'));
const parId = new Map<string, any>(catalogue.agents.map((a: any) => [a.id, a]));
const source = JSON.parse(
  readFileSync(join(racine, 'outils/accroches', `${secteur}.json`), 'utf8')
) as { secteur: string; accroches: Record<string, { accroche: string; resume: string }> };

const cheminListe = join(racine, 'catalogue/accroches-gabarit.json');
const liste = JSON.parse(readFileSync(cheminListe, 'utf8'));
const motif = (g: string) => new RegExp(g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
const gabarits: RegExp[] = (liste.gabarits as string[]).map(motif);
const gabaritsResume: RegExp[] = (liste.gabaritsResume as string[]).map(motif);

const fichiers = readdirSync(join(racine, 'agents'));
const ecrits: string[] = [];

for (const [id, texte] of Object.entries(source.accroches)) {
  const { accroche, resume } = texte;
  const entree = parId.get(id);
  if (!entree) throw new Error(`${id} absent du catalogue`);
  if (entree.secteur !== secteur) throw new Error(`${id} appartient au secteur ${entree.secteur}`);
  // Rewriting one template into another would pass unnoticed otherwise.
  const gabarit = gabarits.find((r) => r.test(accroche));
  if (gabarit) throw new Error(`${id} : la nouvelle accroche reprend le gabarit « ${gabarit.source} »`);
  const gabaritR = gabaritsResume.find((r) => r.test(resume));
  if (gabaritR) throw new Error(`${id} : le nouveau résumé reprend le gabarit « ${gabaritR.source} »`);
  if (accroche.length < 40) throw new Error(`${id} : accroche trop courte (${accroche.length} caractères)`);
  if (resume.length < 80) throw new Error(`${id} : résumé trop court (${resume.length} caractères)`);

  const fichier = fichiers.find((f) => f.startsWith(`${id}-`));
  if (!fichier) throw new Error(`fiche ${id} absente de agents/`);
  const chemin = join(racine, 'agents', fichier);
  const paquet = JSON.parse(readFileSync(chemin, 'utf8'));
  paquet.accroche = accroche;
  paquet.resume_metier = resume;
  writeFileSync(chemin, JSON.stringify(paquet, null, 2) + '\n');
  ecrits.push(id);
}

const avant = liste.agents.length;
const ecritsIds = new Set(ecrits);
liste.agents = liste.agents.filter((id: string) => !ecritsIds.has(id));
if (liste.agents.length !== avant) {
  writeFileSync(cheminListe, JSON.stringify(liste, null, 2) + '\n');
  console.log(`  ↓ ${avant - liste.agents.length} identifiant(s) retiré(s) de accroches-gabarit.json, ${liste.agents.length} restant(s)`);
}
console.log(`${ecrits.length} accroche(s) réécrite(s) pour le secteur ${secteur}`);
