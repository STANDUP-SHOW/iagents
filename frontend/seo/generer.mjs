// Static pages for search engines, built from the repository's data after
// `vite build`: one page per job, per activity, per software, and per job ×
// software the job is qualified on, plus robots.txt and a sitemap index.
// Every page carries text that is its own (the fiche's sentence about what
// the agent does in that software), never a template with a name swapped in.
//
//   node seo/generer.mjs [outDir]    (default: dist)
//
// The run fails, writing nothing, when a slug collides or a link points at a
// page that is not generated: a dead link in 10 000 pages is found here or
// never.
import { readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE = 'https://iagent.agency';
const MAX_URLS_PAR_SITEMAP = 50000; // the sitemaps.org limit per file
const SORTIE = join(RACINE, 'frontend', process.argv[2] ?? 'dist');

const lire = (chemin) => JSON.parse(readFileSync(join(RACINE, chemin), 'utf8'));
const fiches = readdirSync(join(RACINE, 'agents')).filter((n) => n.endsWith('.json')).map((n) => lire(join('agents', n)));
const activites = lire('catalogue/activites.json').activites;
const logiciels = lire('catalogue/logiciels.json').logiciels;
const secteurs = new Map(lire('catalogue/catalogue.json').secteurs.map((s) => [s.id, s.nom]));

export const slugifier = (texte) =>
  texte.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' et ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const echapper = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// --- addresses ------------------------------------------------------------
const logParId = new Map(logiciels.map((l) => [l.id, l]));
const slugs = new Map(); // url -> what claimed it, to refuse collisions
function reserver(url, qui) {
  if (slugs.has(url)) throw new Error(`adresse ${url} prise deux fois : ${slugs.get(url)} et ${qui}`);
  slugs.set(url, qui);
  return url;
}

const urlFiche = new Map(fiches.map((f) => [f.id, reserver(`/agents/${f.slug}`, f.id)]));
const urlActivite = new Map(activites.map((a) => [a.id, reserver(`/activites/${slugifier(a.nom)}`, a.id)]));

// Only software something cites gets a page: a page about a tool no agent
// uses would promise nothing.
const cites = new Set([
  ...fiches.flatMap((f) => f.qualifications.logiciels.map((q) => q.logiciel)),
  ...activites.flatMap((a) => a.pack?.logiciels ?? []),
]);
const urlLogiciel = new Map();
for (const id of [...cites].sort()) {
  const l = logParId.get(id);
  if (!l) throw new Error(`${id} cité mais absent de catalogue/logiciels.json`);
  let url = `/logiciels/${slugifier(l.nom)}`;
  if (slugs.has(url)) url = `${url}-${slugifier(l.editeur ?? id)}`;
  urlLogiciel.set(id, reserver(url, id));
}
const urlPosteLogiciel = (f, id) => `${urlFiche.get(f.id)}/${urlLogiciel.get(id).split('/').pop()}`;

// --- layout ---------------------------------------------------------------
const STYLE = `
:root{--fond:#0b0d17;--carte:#141827;--trait:#262c44;--texte:#e6e8f2;--doux:#a3a9c2;--neon:#03f3ff;--rose:#e65090;--braise:#f28e44}
*{box-sizing:border-box}body{margin:0;background:var(--fond);color:var(--texte);font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
header,main,footer{max-width:960px;margin:0 auto;padding:16px}
header a{color:var(--neon);font-weight:700;text-decoration:none;letter-spacing:.04em}
h1{font-size:1.9rem;line-height:1.25;margin:.4em 0}h2{color:var(--rose);font-size:1.2rem;margin-top:1.8em}
a{color:var(--neon)}p.accroche{font-size:1.15rem;color:var(--doux)}
.carte{background:var(--carte);border:1px solid var(--trait);border-radius:12px;padding:16px;margin:12px 0}
ul{padding-left:1.2em}li{margin:.3em 0}.fil{font-size:.85rem;color:var(--doux)}
.cta{display:inline-block;margin-top:16px;padding:12px 20px;border-radius:10px;background:rgba(3,243,255,.12);border:1px solid var(--neon);color:var(--neon);font-weight:600;text-decoration:none}
footer{color:var(--doux);font-size:.85rem;border-top:1px solid var(--trait);margin-top:32px}`;

function page({ url, titre, description, fil = [], corps }) {
  const filHtml = fil.length
    ? `<p class="fil">${fil.map(([t, u]) => (u ? `<a href="${u}">${echapper(t)}</a>` : echapper(t))).join(' › ')}</p>`
    : '';
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${echapper(titre)} | iAgent</title>
<meta name="description" content="${echapper(description.slice(0, 300))}">
<link rel="canonical" href="${SITE}${url}"><link rel="icon" type="image/png" href="/puce-cerveau.png">
<style>${STYLE}</style></head>
<body><header><a href="/">iAgent</a></header>
<main>${filHtml}${corps}
<a class="cta" href="/">Voir le catalogue des agents</a></main>
<footer>iAgent : des agents IA métier qui travaillent chez vous, en local, ou par API.</footer>
</body></html>
`;
}

const liste = (items) => `<ul>${items.join('')}</ul>`;
const lien = (texte, url) => `<a href="${url}">${echapper(texte)}</a>`;

// --- pages ----------------------------------------------------------------
const pages = new Map(); // url -> html

for (const f of fiches) {
  const url = urlFiche.get(f.id);
  const secteur = secteurs.get(f.secteur) ?? f.secteur;
  const quals = f.qualifications.logiciels;
  pages.set(url, page({
    url,
    titre: `${f.nom} : agent IA`,
    description: f.accroche,
    fil: [['Agents', null], [secteur, null]],
    corps: `<h1>${echapper(f.nom)}, un agent IA qui travaille pour vous</h1>
<p class="accroche">${echapper(f.accroche)}</p>
<div class="carte"><p>${echapper(f.description)}</p></div>
<h2>Ce qu'il fait chaque jour</h2>
${liste(f.taches.map((t) => `<li><strong>${echapper(t.nom)}</strong> : ${echapper(t.description)}</li>`))}
<h2>Les logiciels qu'il sait tenir</h2>
${liste(quals.map((q) => `<li>${lien(logParId.get(q.logiciel).nom, urlPosteLogiciel(f, q.logiciel))} : ${echapper(q.usage)}</li>`))}`,
  }));

  for (const q of quals) {
    const l = logParId.get(q.logiciel);
    const u = urlPosteLogiciel(f, q.logiciel);
    reserver(u, `${f.id}×${q.logiciel}`);
    const autres = quals.filter((x) => x !== q).map((x) => lien(logParId.get(x.logiciel).nom, urlPosteLogiciel(f, x.logiciel)));
    const taches = f.taches.filter((t) => (t.logiciels ?? []).includes(l.categorie));
    pages.set(u, page({
      url: u,
      titre: `${f.nom} sur ${l.nom}`,
      description: `${f.nom} qui sait travailler sur ${l.nom}. ${q.usage}`,
      fil: [[f.nom, urlFiche.get(f.id)], [l.nom, urlLogiciel.get(q.logiciel)]],
      corps: `<h1>Un agent ${echapper(f.nom.toLowerCase())} qui travaille sur ${echapper(l.nom)}</h1>
<p class="accroche">${echapper(q.usage)}</p>
<div class="carte"><p>${echapper(f.accroche)}</p></div>
${taches.length ? `<h2>Ses tâches dans ${echapper(l.nom)}</h2>${liste(taches.map((t) => `<li><strong>${echapper(t.nom)}</strong> : ${echapper(t.description)}</li>`))}` : ''}
<h2>À propos de ${echapper(l.nom)}</h2>
<p>${echapper(l.nom)}${l.editeur ? `, édité par ${echapper(l.editeur)}` : ''}. ${lien(`Tous nos agents qui savent tenir ${l.nom}`, urlLogiciel.get(q.logiciel))}.</p>
${autres.length ? `<h2>Il sait aussi tenir</h2><p>${autres.join(', ')}</p>` : ''}`,
    }));
  }
}

const postesDuLogiciel = new Map();
for (const f of fiches) for (const q of f.qualifications.logiciels) {
  if (!postesDuLogiciel.has(q.logiciel)) postesDuLogiciel.set(q.logiciel, []);
  postesDuLogiciel.get(q.logiciel).push({ f, q });
}
const activitesDuLogiciel = new Map();
for (const a of activites) for (const id of a.pack?.logiciels ?? []) {
  if (!activitesDuLogiciel.has(id)) activitesDuLogiciel.set(id, []);
  activitesDuLogiciel.get(id).push(a);
}

for (const [id, url] of urlLogiciel) {
  const l = logParId.get(id);
  const postes = postesDuLogiciel.get(id) ?? [];
  const acts = activitesDuLogiciel.get(id) ?? [];
  pages.set(url, page({
    url,
    titre: `Agents IA qui savent tenir ${l.nom}`,
    description: `${postes.length} agents IA iAgent savent travailler sur ${l.nom}${l.editeur ? ` (${l.editeur})` : ''}.`,
    fil: [['Logiciels', null], [l.nom, null]],
    corps: `<h1>Des agents IA qui savent tenir ${echapper(l.nom)}</h1>
<p class="accroche">${echapper(l.nom)}${l.editeur ? `, édité par ${echapper(l.editeur)}` : ''}.</p>
${postes.length ? `<h2>Les postes qualifiés</h2>${liste(postes.map(({ f, q }) => `<li>${lien(f.nom, urlPosteLogiciel(f, id))} : ${echapper(q.usage)}</li>`))}` : ''}
${acts.length ? `<h2>Les activités qui l'emploient</h2>${liste(acts.map((a) => `<li>${lien(a.nom, urlActivite.get(a.id))}</li>`))}` : ''}`,
  }));
}

for (const a of activites) {
  const url = urlActivite.get(a.id);
  const p = a.pack ?? {};
  pages.set(url, page({
    url,
    titre: `Agents IA pour ${a.nom.toLowerCase()}`,
    description: `${a.trait} Des agents IA qui parlent le métier de votre activité.`,
    fil: [['Activités', null], [a.nom, null]],
    corps: `<h1>Des agents IA pour votre activité : ${echapper(a.nom.toLowerCase())}</h1>
<p class="accroche">${echapper(a.trait)}</p>
<p>Chaque agent iAgent reçoit le savoir de votre activité en plus de son métier : son vocabulaire, ses documents, ses règles et ses logiciels.</p>
${p.vocabulaire?.length ? `<h2>Le vocabulaire qu'il connaît</h2>${liste(p.vocabulaire.map((v) => `<li><strong>${echapper(v.terme)}</strong> : ${echapper(v.sens)}</li>`))}` : ''}
${p.documents?.length ? `<h2>Les documents qu'il manie</h2>${liste(p.documents.map((d) => `<li><strong>${echapper(d.nom)}</strong> : ${echapper(d.role)}</li>`))}` : ''}
${p.regles?.length ? `<h2>Les règles qu'il respecte</h2>${liste(p.regles.map((r) => `<li>${echapper(r)}</li>`))}` : ''}
${p.logiciels?.length ? `<h2>Les logiciels de l'activité</h2>${liste(p.logiciels.map((id) => `<li>${lien(logParId.get(id).nom, urlLogiciel.get(id))}</li>`))}` : ''}`,
  }));
}

// --- checks, then write ---------------------------------------------------
const cibles = new Set(pages.keys());
for (const [url, html] of pages) {
  for (const [, href] of html.matchAll(/href="(\/[^"]*)"/g)) {
    if (href === '/' || href === '/puce-cerveau.png') continue;
    if (!cibles.has(href)) throw new Error(`${url} renvoie vers ${href}, page non générée`);
  }
}

for (const dossier of ['agents', 'activites', 'logiciels']) rmSync(join(SORTIE, dossier), { recursive: true, force: true });
for (const [url, html] of pages) {
  const fichier = join(SORTIE, `${url.slice(1)}.html`);
  mkdirSync(dirname(fichier), { recursive: true });
  writeFileSync(fichier, html);
}

const urls = ['/', ...pages.keys()];
const lots = [];
for (let i = 0; i < urls.length; i += MAX_URLS_PAR_SITEMAP) lots.push(urls.slice(i, i + MAX_URLS_PAR_SITEMAP));
lots.forEach((lot, i) => writeFileSync(join(SORTIE, `sitemap-${i + 1}.xml`),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lot.map((u) => `<url><loc>${SITE}${u}</loc></url>`).join('\n')}\n</urlset>\n`));
writeFileSync(join(SORTIE, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lots.map((_, i) => `<sitemap><loc>${SITE}/sitemap-${i + 1}.xml</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`);
writeFileSync(join(SORTIE, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);

const compte = (prefixe) => [...pages.keys()].filter((u) => u.startsWith(prefixe)).length;
const postesLogiciels = [...pages.keys()].filter((u) => u.split('/').length === 4).length;
console.log(`pages : ${fiches.length} postes, ${compte('/activites/')} activités, ${compte('/logiciels/')} logiciels, ${postesLogiciels} poste × logiciel — ${pages.size} en tout, ${lots.length} sitemap(s)`);
