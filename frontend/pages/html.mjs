// Writes one HTML page per offer page of src/pages/site.js, at the root of
// frontend/ where Vite finds them. Run by the build; the files are committed so
// the dev server serves them too, and the build fails if they drift.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES } from '../src/pages/site.js';

const ICI = join(dirname(fileURLToPath(import.meta.url)), '..');
const echapper = (t) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export const html = (p) => `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${echapper(p.titre)}</title>
  <meta name="description" content="${echapper(p.description)}" />
  <link rel="canonical" href="https://iagent.agency/${p.nom}" />${p.noindex ? '\n  <meta name="robots" content="noindex,follow" />' : ''}
  <link rel="icon" href="/favicon.ico" sizes="48x48" /><link rel="icon" type="image/svg+xml" href="/favicon.svg" /><link rel="apple-touch-icon" href="/apple-touch-icon.png" /><link rel="manifest" href="/site.webmanifest" />
  <meta name="theme-color" content="#020817" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="iAgent" />
  <meta property="og:locale" content="fr_FR" />
  <meta property="og:url" content="https://iagent.agency/${p.nom}" />
  <meta property="og:title" content="${echapper(p.titre)}" />
  <meta property="og:description" content="${echapper(p.description)}" />
  <meta property="og:image" content="https://iagent.agency/accueil/partage.png" />
  <meta name="twitter:card" content="summary_large_image" />
</head>
<body>
  <div id="page" data-page="${p.nom}"><!--page--></div>
  <script type="module" src="/src/pages/main.jsx"></script>
</body>
</html>
`;

const verifier = process.argv.includes('--verifier');
let ecarts = 0;
for (const p of PAGES) {
  const fichier = join(ICI, `${p.nom}.html`);
  const attendu = html(p);
  if (existsSync(fichier) && readFileSync(fichier, 'utf8') === attendu) continue;
  if (verifier) { console.error(`pages : ${p.nom}.html n'est pas à jour (node pages/html.mjs)`); ecarts++; }
  else writeFileSync(fichier, attendu);
}
if (ecarts) process.exit(1);
console.log(`pages : ${PAGES.length} pages de l'offre`);
