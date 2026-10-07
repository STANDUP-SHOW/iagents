// Every internal link of the home page must land on a page the build
// produced: a renamed activity or a fiche taken out of the shop would
// otherwise leave a dead link on the first page anyone sees.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const morts = [];
for (const [, brut] of html.matchAll(/href="([^"]+)"/g)) {
  const href = brut.replace(/&amp;/g, '&');
  if (/^(https?:|mailto:|tel:)/.test(href)) continue;
  if (href.startsWith('#')) { if (href.length > 1 && !ids.has(href.slice(1))) morts.push(href); continue; }
  const chemin = decodeURIComponent(href.split(/[?#]/)[0]);
  if (chemin === '/') continue;
  const candidats = [join(DIST, chemin), join(DIST, chemin + '.html'), join(DIST, chemin, 'index.html')];
  if (!candidats.some((c) => existsSync(c) && !c.endsWith('/'))) morts.push(href);
}
if (morts.length) {
  console.error(`accueil : ${morts.length} lien(s) sans page :\n  ${[...new Set(morts)].join('\n  ')}`);
  process.exit(1);
}
console.log('accueil : tous les liens internes mènent à une page construite');
