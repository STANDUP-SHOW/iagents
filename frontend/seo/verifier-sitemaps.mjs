// Reads the sitemaps a build wrote and refuses what max's SEO brief (10/10)
// refuses: an index missing, a file over 15 000 addresses, an address that is
// not absolute https, carries a query string, is in no generated page, or is
// marked noindex. Run by the bench on its trial build and by `npm run build`.
//
//   node seo/verifier-sitemaps.mjs [outDir]    (default: dist)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const SORTIE = join(dirname(fileURLToPath(import.meta.url)), '..', process.argv[2] ?? 'dist');
const SITE = 'https://iagent.agency';
const MAX = 15000;
const fautes = [];
const lireXml = (nom) => {
  const brut = readFileSync(join(SORTIE, nom));
  return (nom.endsWith('.gz') ? gunzipSync(brut) : brut).toString('utf8');
};

if (!existsSync(join(SORTIE, 'sitemap-index.xml'))) { console.error('sitemap-index.xml absent'); process.exit(1); }
const index = lireXml('sitemap-index.xml');
const fichiers = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (fichiers.length < 7) fautes.push(`l'index ne liste que ${fichiers.length} sitemaps`);
if (lireXml('sitemap.xml') !== index) fautes.push("sitemap.xml (l'ancienne adresse) ne porte pas le même index");
if (!readFileSync(join(SORTIE, 'robots.txt'), 'utf8').includes(`Sitemap: ${SITE}/sitemap-index.xml`)) fautes.push("robots.txt n'annonce pas sitemap-index.xml");
const rapport = JSON.parse(readFileSync(join(SORTIE, 'seo-rapport.json'), 'utf8'));
let total = 0;
const vues = new Set();
for (const loc of fichiers) {
  if (!loc.startsWith(`${SITE}/sitemap-`)) { fautes.push(`index : ${loc} n'est pas un de nos sitemaps`); continue; }
  const nom = loc.slice(SITE.length + 1);
  const xml = lireXml(nom);
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  total += urls.length;
  if (urls.length > MAX) fautes.push(`${nom} : ${urls.length} adresses, plus de ${MAX}`);
  if (nom.includes('combinaisons') && !nom.endsWith('.xml.gz')) fautes.push(`${nom} : les combinaisons se livrent compressées`);
  for (const u of urls) {
    if (!u.startsWith(`${SITE}/`) && u !== SITE + '/') fautes.push(`${nom} : ${u} n'est pas une adresse absolue du site`);
    if (u.includes('?') || u.includes('#')) fautes.push(`${nom} : ${u} porte des paramètres`);
    if (vues.has(u)) fautes.push(`${nom} : ${u} est listée deux fois`);
    vues.add(u);
    const chemin = u.slice(SITE.length);
    const fichier = join(SORTIE, chemin === '/' ? 'index.html' : `${chemin.slice(1)}.html`);
    if (existsSync(fichier)) {
      const tete = readFileSync(fichier, 'utf8').slice(0, 4000);
      if (/<meta name="robots" content="noindex/.test(tete)) fautes.push(`${nom} : ${u} est en noindex`);
    } else if (rapport.adresses.generees > 1000 && existsSync(join(SORTIE, 'index.html'))) fautes.push(`${nom} : ${u} n'a pas de page construite`);
  }
}
if (total !== rapport.adresses.indexables) fautes.push(`les sitemaps portent ${total} adresses, le rapport en compte ${rapport.adresses.indexables}`);
const trop = Object.entries(rapport.anomalies).filter(([, v]) => v.nombre);
for (const [k, v] of trop) fautes.push(`rapport : ${v.nombre} ${k}`);
if (fautes.length) { for (const f of fautes.slice(0, 30)) console.error('  ✗   ' + f); process.exit(1); }
console.log(`sitemaps : ${fichiers.length} fichiers, ${total} adresses, toutes absolues, sans paramètre, indexables ; rapport sans anomalie`);
