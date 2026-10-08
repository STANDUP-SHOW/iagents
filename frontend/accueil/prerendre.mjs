// Puts the rendered home page into dist/index.html, so visitors without
// script, crawlers and link previews read the whole film.
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = join(dirname(fileURLToPath(import.meta.url)), '..');
const { rendre } = await import(pathToFileURL(join(ICI, '.accueil-ssr', 'serveur.js')).href);
const page = join(ICI, 'dist', 'index.html');
const html = readFileSync(page, 'utf8');
if (!html.includes('<!--accueil-->')) throw new Error("prerendre : l'emplacement <!--accueil--> manque dans dist/index.html");
const rendu = rendre();
if (!rendu.includes('<h1')) throw new Error("prerendre : la page rendue n'a pas de titre principal");
writeFileSync(page, html.replace('<!--accueil-->', rendu));
rmSync(join(ICI, '.accueil-ssr'), { recursive: true, force: true });
console.log(`accueil : ${Math.round(rendu.length / 1024)} ko de page rendue dans dist/index.html`);

// The offer pages of the site plan, the same way.
const { rendrePage, PAGES } = await import(pathToFileURL(join(ICI, '.pages-ssr', 'serveur.js')).href);
for (const { nom } of PAGES) {
  const fichier = join(ICI, 'dist', `${nom}.html`);
  const brut = readFileSync(fichier, 'utf8');
  if (!brut.includes('<!--page-->')) throw new Error(`prerendre : l'emplacement <!--page--> manque dans dist/${nom}.html`);
  const corps = rendrePage(nom);
  if (!corps.includes('<h1')) throw new Error(`prerendre : la page ${nom} n'a pas de titre principal`);
  writeFileSync(fichier, brut.replace('<!--page-->', corps));
}
rmSync(join(ICI, '.pages-ssr'), { recursive: true, force: true });
console.log(`pages : ${PAGES.length} pages de l'offre rendues`);
