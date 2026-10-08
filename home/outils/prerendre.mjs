// After `vite build`: writes one HTML file per page (cleanUrls on Vercel
// serves /tarifs from tarifs.html), each with its own title, description and
// Open Graph tags and its content already rendered, plus sitemap.xml and
// robots.txt drawn from the same list of pages.
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ICI, 'dist');
const { rendre, PAGES, PAGE_404, sitemapXml, robotsTxt } = await import(pathToFileURL(join(ICI, '.ssr', 'serveur.js')).href);

const modele = readFileSync(join(DIST, 'index.html'), 'utf8');
for (const repere of ['<!--tete-->', '<!--app-->']) {
  if (!modele.includes(repere)) throw new Error(`prerendre : l'emplacement ${repere} manque dans dist/index.html`);
}

for (const page of [...PAGES, PAGE_404]) {
  const { tete, html } = rendre(page.chemin);
  if (!html.includes('<h1')) throw new Error(`prerendre : ${page.chemin} n'a pas de titre principal`);
  writeFileSync(join(DIST, page.fichier), modele.replace('<!--tete-->', tete).replace('<!--app-->', html));
}

writeFileSync(join(DIST, 'sitemap.xml'), sitemapXml(PAGES, new Date().toISOString().slice(0, 10)));
writeFileSync(join(DIST, 'robots.txt'), robotsTxt());

rmSync(join(ICI, '.ssr'), { recursive: true, force: true });
console.log(`home : ${PAGES.length} pages + 404 prérendues, sitemap.xml et robots.txt écrits dans dist/`);
