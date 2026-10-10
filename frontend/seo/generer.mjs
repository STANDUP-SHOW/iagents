// Static pages for search engines, built from the repository's data after
// `vite build`: one page per job, per activity, per software, per job ×
// software the job is qualified on, and per cross-trade job × activity (level
// 3, max's choice of 30/09/2026), plus robots.txt and a sitemap index.
// Every page carries text that is its own (the fiche's sentence about what
// the agent does in that software), never a template with a name swapped in.
//
//   node seo/generer.mjs [outDir]    (default: dist)
//
// The run fails, writing nothing, when a slug collides or a link points at a
// page that is not generated: a dead link in 10 000 pages is found here or
// never.
import { readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE = 'https://iagent.agency';
// max's SEO brief (10/10): combination sitemaps of 15 000 to 20 000 addresses,
// well under the 50 000 that Google accepts, so each can be watched in Search Console.
const MAX_URLS_PAR_SITEMAP = 15000;
const ARGS = process.argv.slice(2);
const SORTIE = join(RACINE, 'frontend', ARGS.find((a) => !a.startsWith('--')) ?? 'dist');
const RELEVER_DATES = ARGS.includes('--dates');

const lire = (chemin) => JSON.parse(readFileSync(join(RACINE, chemin), 'utf8'));
const fichiersFiches = readdirSync(join(RACINE, 'agents')).filter((n) => n.endsWith('.json'));
const fiches = fichiersFiches.map((n) => lire(join('agents', n)));
const cheminFiche = new Map(fiches.map((f, i) => [f.id, `agents/${fichiersFiches[i]}`]));
const activites = lire('catalogue/activites.json').activites;
const logiciels = lire('catalogue/logiciels.json').logiciels;
const secteursListe = lire('catalogue/catalogue.json').secteurs;
// Every total a page writes comes from here, the site's one source.
const STATS = statistiquesCatalogue(fiches);
const secteurs = new Map(secteursListe.map((s) => [s.id, s.nom]));

import { PAGES as PAGES_OFFRE } from '../src/pages/site.js';
import { ENTREPRISE } from '../src/data/entreprise.js';
import { urlRecruter } from '../src/data/recrutement.js';
import { slugifier } from './slug.mjs';
import { statistiquesCatalogue } from '../src/data/statistiques.js';
import { DEVIS } from '../../outils/poste-de-devis.ts';
import { portraitDe } from '../src/data/portraits.js';
import { estTransversal, cerclesDeLActivite, personnelDeLActivite, FAMILLES_ACTIVITE } from '../src/data/activites-recherche.js';
export { slugifier };

const echapper = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// --- dates ----------------------------------------------------------------
// A page's <lastmod> is the date its data last changed (max's brief: never a
// date regenerated at every build). seo/dates.json keeps, for every source
// (a fiche, an activity, a software, a sector), the fingerprint of its data and
// the day it was first seen with that fingerprint. A source whose data changed
// since takes today's date and is counted in the report; `--dates` writes the
// file anew, dating new sources by their last commit when git knows it.
const FICHIER_DATES = join(RACINE, 'frontend', 'seo', 'dates.json');
const datesConnues = existsSync(FICHIER_DATES) ? JSON.parse(readFileSync(FICHIER_DATES, 'utf8')) : {};
const AUJOURDHUI = new Date().toISOString().slice(0, 10);
const datesVues = {};
const sourcesModifiees = [];
let datesGit = null;
function dateGit(chemin) {
  if (!RELEVER_DATES) return null;
  if (!datesGit) {
    datesGit = new Map();
    try {
      const log = execFileSync('git', ['log', '--format=>%cs', '--name-only', '--', 'agents', 'catalogue'], { cwd: RACINE, encoding: 'utf8', maxBuffer: 1 << 28 });
      let d = null;
      for (const ligne of log.split('\n')) {
        if (ligne.startsWith('>')) d = ligne.slice(1);
        else if (ligne && !datesGit.has(ligne)) datesGit.set(ligne, d);
      }
    } catch { /* no git here: today's date */ }
  }
  return datesGit.get(chemin) ?? null;
}
function dateDe(cle, donnees, chemin) {
  const h = createHash('sha256').update(JSON.stringify(donnees)).digest('hex').slice(0, 16);
  const connue = datesConnues[cle];
  if (connue && connue[0] === h) return (datesVues[cle] = connue)[1];
  if (!RELEVER_DATES) sourcesModifiees.push(cle);
  return (datesVues[cle] = [h, dateGit(chemin) ?? AUJOURDHUI])[1];
}
const plusRecente = (...dates) => dates.filter(Boolean).sort().pop() ?? null;

// --- addresses ------------------------------------------------------------
const logParId = new Map(logiciels.map((l) => [l.id, l]));
const memo = new Map();
const unique = (cle, f) => (memo.has(cle) ? memo.get(cle) : memo.set(cle, f()).get(cle));
const dFiche = (f) => unique(`fiche:${f.id}`, () => dateDe(`fiche:${f.id}`, f, cheminFiche.get(f.id)));
const dActivite = (a) => unique(`activite:${a.id}`, () => dateDe(`activite:${a.id}`, a, 'catalogue/activites.json'));
const dLogiciel = (id) => unique(`logiciel:${id}`, () => dateDe(`logiciel:${id}`, logParId.get(id), 'catalogue/logiciels.json'));
const dSecteur = (id) => unique(`secteur:${id}`, () => dateDe(`secteur:${id}`, secteursListe.find((x) => x.id === id), 'catalogue/catalogue.json'));
const slugs = new Map(); // url -> what claimed it, to refuse collisions
function reserver(url, qui) {
  if (slugs.has(url)) throw new Error(`adresse ${url} prise deux fois : ${slugs.get(url)} et ${qui}`);
  slugs.set(url, qui);
  return url;
}

const urlFiche = new Map(fiches.map((f) => [f.id, reserver(`/agents/${f.slug}`, f.id)]));
const urlActivite = new Map(activites.map((a) => [a.id, reserver(`/activites/${slugifier(a.nom)}`, a.id)]));
const urlSecteur = new Map([...secteurs].map(([id, nom]) => [id, reserver(`/secteurs/${slugifier(nom)}`, id)]));

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

// Level 3: jobs every business has (office, accounting, HR, sales, purchasing,
// marketing), each in each activity. Jobs written for one trade ("assistant
// médical administratif") are left out: in a sawmill they would be nonsense.
// The rule lives in src/data/activites-recherche.js, which the library's
// search reads too: a printer must be offered the same jobs on both.
const transversaux = fiches.filter(estTransversal);
const urlPosteActivite = (f, a) => `${urlActivite.get(a.id)}/${f.slug}`;

// --- layout ---------------------------------------------------------------
// The same header, colours and type as the rest of iagent.agency (charte
// e-agent: Montserrat, the eight-colour gradient), with the full menu and a
// way back on every page: these pages are where a search engine lands people.
const RECRUTER = '/how-it-works';
const MENU = [
  ['Produit', '/workforce'], ['Agents', '/catalogue'], ['Créer', '/create'], ['Entreprise', '/enterprise'], ['Tarifs', '/pricing'],
];
const PIED = [
  ['Produit', [['iAgent Workforce', '/workforce'], ['iAgent Box', '/box'], ['Tarifs', '/pricing'], ['Pourquoi louer', '/why-rent'], ['Recruter un agent', RECRUTER]]],
  ['Agents', [['Le catalogue des métiers', '/catalogue'], ['Par activité', '/activites'], ['Par secteur', '/secteurs'], ['Skill Packs', '/skills'], ['Créer votre entreprise', '/create'], ['Opportunités', '/opportunities']]],
  ['Voice', [['iAgent Voice', '/voice'], ['Standard téléphonique', '/standard-telephonique'], ['Support Center', '/support-center'], ['Sales Center', '/sales-center']]],
  ['Entreprise', [['iAgent Enterprise', '/enterprise'], ['IA locale et hybride', '/local-ai'], ['Sécurité', '/security'], ['Questions fréquentes', '/faq'], ['Contact', '/contact']]],
  ['Ressources', [['Comment ça marche', '/how-it-works'], ['Activités', '/activites'], ['Secteurs', '/secteurs'], ['Logiciels métier', '/logiciels']]],
];
const POLICES = [400, 600, 800].map((g) => `@font-face{font-family:Montserrat;font-style:normal;font-weight:${g};font-display:swap;src:url(/polices/montserrat-latin-${g}-normal.woff2) format("woff2")}`).join('');
const STYLE = `${POLICES}
:root{--fond:#020817;--fond-2:#061226;--carte:rgba(10,22,44,.72);--trait:rgba(118,202,233,.16);--trait-fort:rgba(118,202,233,.32);--texte:#eef3fb;--doux:#a9b6cc;--pale:#6f7f99;--cyan:#03f3ff;
--degrade:linear-gradient(90deg,#e5007e 0%,#e6216d 22.63%,#de6970 29.33%,#bcce00 37.71%,#76cae9 57.26%,#b61180 71.23%,#ed744b 84.08%,#fdc802 97.49%)}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--fond);color:var(--texte);font:16px/1.65 Montserrat,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--cyan)}img{max-width:100%}
.cadre{max-width:1180px;margin:0 auto;padding:0 20px}
.tete{position:sticky;top:0;z-index:10;background:rgba(2,8,23,.86);backdrop-filter:blur(12px);border-bottom:1px solid var(--trait)}
.tete-ligne{display:flex;align-items:center;gap:28px;height:68px}
.logo{flex:none}.logo img{height:26px;width:auto;display:block}
.menu{display:flex;gap:24px;flex:1}.menu a{color:var(--doux);text-decoration:none;font-size:.92rem;font-weight:500;white-space:nowrap}.menu a:hover{color:#fff}
.bouton{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 22px;font-weight:700;font-size:.92rem;text-decoration:none;border-radius:14px 4px 14px 4px;white-space:nowrap}
.bouton-degrade{background:var(--degrade);color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.35);box-shadow:0 8px 28px rgba(229,0,126,.25)}
.bouton-contour{border:1px solid var(--trait-fort);color:#fff;background:rgba(255,255,255,.03)}.bouton-contour:hover{border-color:var(--cyan)}
.mobile{display:none;margin-left:auto;position:relative}.mobile summary{list-style:none;cursor:pointer;width:44px;height:44px;border:1px solid var(--trait-fort);border-radius:12px;display:grid;place-items:center}
.mobile summary::-webkit-details-marker{display:none}.mobile nav{position:absolute;right:0;top:54px;width:260px;padding:12px;background:#061226;border:1px solid var(--trait-fort);border-radius:16px;display:flex;flex-direction:column}
.mobile nav a{padding:10px 12px;color:var(--texte);text-decoration:none;border-radius:10px}.mobile nav a:hover{background:rgba(3,243,255,.08)}
.bandeau{position:relative;overflow:hidden;border-bottom:1px solid var(--trait);background:radial-gradient(900px 380px at 85% -10%,rgba(118,202,233,.16),transparent 70%),radial-gradient(700px 300px at 0% 120%,rgba(229,0,126,.12),transparent 70%),var(--fond)}
.bandeau::after{content:'';position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--degrade);opacity:.8}
.fil{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding-top:22px;font-size:.84rem;color:var(--pale)}.fil a{color:var(--doux);text-decoration:none}.fil a:hover{color:var(--cyan)}
.retour{margin-left:auto;color:var(--cyan)!important;font-weight:600}
.heros{display:grid;grid-template-columns:1fr;gap:32px;align-items:center;padding:28px 0 48px}
.heros.avec-portrait{grid-template-columns:minmax(0,1fr) 260px}
.heros h1{font-weight:800;font-size:clamp(1.9rem,3.6vw,3rem);line-height:1.12;letter-spacing:-.01em;margin:.2em 0 .35em}
.accroche{font-size:1.15rem;color:var(--doux);max-width:46em;margin:0}
.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:26px}
.portrait{position:relative;border-radius:22px;overflow:hidden;aspect-ratio:4/5;border:1px solid var(--trait-fort);box-shadow:0 24px 60px rgba(0,0,0,.45)}
.portrait img{width:100%;height:100%;object-fit:cover;object-position:50% 10%;display:block}
.portrait::before{content:'';position:absolute;inset:auto 0 0 0;height:4px;background:var(--degrade)}
main.cadre{padding-top:12px;padding-bottom:24px}
main h2{font-weight:800;font-size:1.35rem;margin:2.2em 0 .9em;display:flex;align-items:center;gap:12px}
main h2::before{content:'';width:28px;height:4px;border-radius:2px;background:var(--degrade);flex:none}
.carte{background:var(--carte);border:1px solid var(--trait);border-radius:20px;padding:22px 26px;margin:24px 0}
.carte p{margin:.4em 0}
main ul{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
main li{background:var(--carte);border:1px solid var(--trait);border-radius:16px;padding:16px 18px;color:var(--doux);font-size:.95rem;transition:border-color .2s}
main li:hover{border-color:var(--trait-fort)}main li strong{display:block;color:var(--texte);font-weight:700;margin-bottom:4px}
main li a{font-weight:600;text-decoration:none}
main p{color:var(--doux)}main p a{text-decoration:none;border-bottom:1px solid rgba(3,243,255,.35)}
.appel{margin:56px auto 0;padding:36px 32px;border-radius:24px;position:relative;overflow:hidden;background:linear-gradient(135deg,rgba(6,18,38,.95),rgba(2,8,23,.95));border:1px solid var(--trait-fort);display:flex;flex-wrap:wrap;gap:20px;align-items:center;justify-content:space-between}
.appel::before{content:'';position:absolute;inset:0 0 auto 0;height:3px;background:var(--degrade)}
.appel h2{margin:0;font-size:1.5rem;font-weight:800}.appel p{margin:.3em 0 0;color:var(--doux)}
.pied{margin-top:64px;border-top:1px solid var(--trait);color:var(--doux);font-size:.9rem}
.pied-grille{display:grid;grid-template-columns:1.3fr repeat(4,1fr);gap:32px;padding:48px 20px}
.pied b{display:block;color:var(--pale);font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;margin-bottom:12px}
.pied a{display:block;color:var(--doux);text-decoration:none;padding:4px 0}.pied a:hover{color:var(--cyan)}
.pied-bas{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;padding:0 20px 32px;color:var(--pale);font-size:.8rem}
.puces{display:flex;flex-wrap:wrap;gap:8px;margin:0}.puces a{border:1px solid var(--trait-fort)!important;border-radius:999px;padding:6px 14px;font-size:.86rem;color:var(--texte);background:rgba(255,255,255,.03)}.puces a:hover{border-color:var(--cyan)!important;color:var(--cyan)}
.suite{margin-top:12px}.suite summary{cursor:pointer;color:var(--cyan);font-weight:600;margin-bottom:12px}
@media (max-width:1180px){.menu{display:none}.tete .bouton-degrade{display:none}.mobile{display:block}}
@media (max-width:820px){.heros.avec-portrait{grid-template-columns:1fr}.heros.avec-portrait .portrait{max-width:220px;order:-1}.pied-grille{grid-template-columns:1fr 1fr}.retour{margin-left:0}}
@media (max-width:480px){.heros.avec-portrait .portrait{max-width:140px}main ul{grid-template-columns:1fr}.pied-grille{grid-template-columns:1fr}.appel{padding:28px 22px}}`;

const liens = (items) => items.map(([t, u]) => `<a href="${u}">${echapper(t)}</a>`).join('');

function page({ url, titre, description, fil = [], corps, portrait = null, appel = null, recruter = null, noindex = false }) {
  // The page's title and hook open the coloured band; the rest is the body.
  const m = corps.match(/^\s*(<h1>[\s\S]*?<\/h1>)\s*(<p class="accroche">[\s\S]*?<\/p>)?/);
  const tete = m ? m[0] : '';
  const reste = (m ? corps.slice(m[0].length) : corps)
    .replace(/<\/strong> : /g, '</strong>').replace(/(<li><a [^>]*>[^<]*<\/a>) : /g, '$1<br>');
  const filHtml = [['Accueil', '/'], ...fil].map(([t, u]) => (u ? `<a href="${u}">${echapper(t)}</a>` : `<span>${echapper(t)}</span>`)).join('<span aria-hidden="true">›</span>');
  const [appelTitre, appelTexte] = appel ?? ['Trouvez le collaborateur IA de votre métier', `${STATS.metiers.toLocaleString('fr-FR')} métiers, réglés sur votre secteur et votre activité.`];
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${echapper(titre)} | iAgent</title>
<meta name="description" content="${echapper(description.slice(0, 300))}">
<meta name="theme-color" content="#020817">${noindex ? '\n<meta name="robots" content="noindex,follow">' : ''}
<link rel="canonical" href="${SITE}${url}"><link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/polices/montserrat-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/seo.css"></head>
<body>
<header class="tete"><div class="cadre tete-ligne">
<a class="logo" href="/" aria-label="iAgent, accueil"><img src="/accueil/logo-iagent-blanc.svg" alt="iAgent" width="91" height="26"></a>
<nav class="menu" aria-label="Navigation principale">${liens(MENU)}</nav>
<a class="bouton bouton-degrade" href="/contact">Demander une démo</a>
<details class="mobile"><summary aria-label="Ouvrir le menu"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16M4 16h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></summary>
<nav aria-label="Menu">${liens(MENU)}<a href="/contact">Demander une démo</a></nav></details>
</div></header>
<div class="bandeau"><div class="cadre">
<nav class="fil" aria-label="Fil d'Ariane">${filHtml}<a class="retour" href="/catalogue">← Retour au catalogue</a></nav>
<div class="heros${portrait ? ' avec-portrait' : ''}"><div>${tete}
<div class="actions">${recruter ? `<a class="bouton bouton-degrade" href="${echapper(recruter)}">Recruter cet agent</a>` : '<a class="bouton bouton-degrade" href="/catalogue">Recruter un agent</a>'}<a class="bouton bouton-contour" href="/how-it-works">Comment ça marche</a></div></div>
${portrait ? `<div class="portrait"><img src="${portrait}" alt="" width="320" height="320"></div>` : ''}</div>
</div></div>
<main class="cadre">${reste}
<section class="appel"><div><h2>${echapper(appelTitre)}</h2><p>${echapper(appelTexte)}</p></div>
<div class="actions" style="margin:0">${recruter ? `<a class="bouton bouton-degrade" href="${echapper(recruter)}">Recruter cet agent</a>` : '<a class="bouton bouton-degrade" href="/catalogue">Voir le catalogue</a>'}<a class="bouton bouton-contour" href="/pricing">Voir les tarifs</a></div></section>
</main>
<footer class="pied"><div class="cadre pied-grille">
<div><img src="/accueil/logo-iagent-blanc.svg" alt="iAgent" width="112" height="32"><p>Des collaborateurs IA par métier, qui connaissent vos logiciels et travaillent chez vous, en local, ou par API.</p></div>
${PIED.map(([t, items]) => `<nav aria-label="${t}"><b>${t}</b>${liens(items)}</nav>`).join('')}
</div><div class="cadre pied-bas"><span>© 2026 ${echapper(ENTREPRISE.nom)} · <a href="/mentions-legales" style="display:inline;padding:0">Mentions légales</a></span><span>Human ambition. Agentic execution.</span></div></footer>
</body></html>
`;
}

const liste = (items) => `<ul>${items.join('')}</ul>`;
// A long run of links reads as chips, folded beyond two dozen.
const puces = (items) => items.length <= 24
  ? `<p class="puces">${items.join('')}</p>`
  : `<p class="puces">${items.slice(0, 24).join('')}</p><details class="suite"><summary>Voir les ${items.length - 24} autres</summary><p class="puces">${items.slice(24).join('')}</p></details>`;
// « Un agent agent de devis » read on the preview of 10/10: a title that already says « agent » keeps its own word.
const unAgent = (f) => (/^agent /i.test(f.nom) ? `Un ${echapper(f.nom.toLowerCase())}` : `Un agent ${echapper(f.nom.toLowerCase())}`);
const lien = (texte, url) => `<a href="${url}">${echapper(texte)}</a>`;
// What the activity's pack says beyond words, documents and rules: what the
// trade counts, who it deals with, when its year turns. Every activity has the
// three (422 on 422 at 10/10); they were written for the hiring interview and
// never shown, while max asked for pages with the trade's real matter.
const sectionsDuPack = (p) => [
  p.unites?.length ? `<h2>Ce qu'il compte dans votre activité</h2>${liste(p.unites.map((u) => `<li><strong>${echapper(u.unite)}</strong> : ${echapper(u.emploi)}</li>`))}` : '',
  p.interlocuteurs?.length ? `<h2>Avec qui il travaille</h2>${liste(p.interlocuteurs.map((i) => `<li><strong>${echapper(i.role)}</strong> : ${echapper(i.attend)}</li>`))}` : '',
  p.rythmes?.length ? `<h2>Les moments de l'année</h2>${liste(p.rythmes.map((r) => `<li>${echapper(r)}</li>`))}` : '',
].join('\n');

// Two fiches of different sectors can share a title (« Assistant paie » in
// accounting and in HR): in a list, the sector tells them apart.
const titres = new Map();
for (const f of fiches) titres.set(f.nom, (titres.get(f.nom) ?? 0) + 1);
const homonymes = new Set([...titres].filter(([, k]) => k > 1).map(([nom]) => nom));
const nomDistinct = (f) => homonymes.has(f.nom) ? `${f.nom} (${(secteurs.get(f.secteur) ?? f.secteur).toLowerCase()})` : f.nom;

// --- pages ----------------------------------------------------------------
const pages = new Map(); // url -> html
// url -> { famille, lastmod, noindex }: the family names the sitemap the
// address goes in; a page kept out of the index says why, and is in no sitemap.
const meta = new Map();
const poser = (url, famille, lastmod, html, noindex = null) => { pages.set(url, html); meta.set(url, { famille, lastmod, noindex }); };


for (const f of fiches) {
  const url = urlFiche.get(f.id);
  const secteur = secteurs.get(f.secteur) ?? f.secteur;
  const quals = f.qualifications.logiciels;
  poser(url, 'metiers', plusRecente(dFiche(f), ...quals.map((q) => dLogiciel(q.logiciel))), page({
    url,
    titre: `${f.nom} : agent IA`,
    description: f.accroche,
    fil: [['Secteurs', '/secteurs'], [secteur, urlSecteur.get(f.secteur)]],
    portrait: portraitDe(f),
    recruter: urlRecruter({ slug: f.slug }),
    appel: [`Recrutez votre ${f.nom.toLowerCase()}`, "Un entretien d'embauche dans l'application, et il se met au travail chez vous."],
    corps: `<h1>${echapper(f.nom)}, un agent IA qui travaille pour vous</h1>
<p class="accroche">${echapper(f.accroche)}</p>
<div class="carte"><p>${echapper(f.description)}</p></div>
<h2>Ce qu'il fait chaque jour</h2>
${liste(f.taches.map((t) => `<li><strong>${echapper(t.nom)}</strong> : ${echapper(t.description)}</li>`))}
<h2>Les logiciels qu'il sait tenir</h2>
${liste(quals.map((q) => `<li>${lien(logParId.get(q.logiciel).nom, urlPosteLogiciel(f, q.logiciel))} : ${echapper(q.usage)}</li>`))}
${transversaux.includes(f) ? `<h2>Dans votre activité</h2>${puces(activites.map((a) => lien(a.nom, urlPosteActivite(f, a))))}` : ''}`,
  }));

  for (const q of quals) {
    const l = logParId.get(q.logiciel);
    const u = urlPosteLogiciel(f, q.logiciel);
    reserver(u, `${f.id}×${q.logiciel}`);
    const autres = quals.filter((x) => x !== q).map((x) => lien(logParId.get(x.logiciel).nom, urlPosteLogiciel(f, x.logiciel)));
    const taches = f.taches.filter((t) => (t.logiciels ?? []).includes(l.categorie));
    poser(u, 'metiers-logiciels', plusRecente(dFiche(f), dLogiciel(q.logiciel)), page({
      url: u,
      titre: `${f.nom} sur ${l.nom}`,
      description: `${f.nom} qui sait travailler sur ${l.nom}. ${q.usage}`,
      fil: [['Agents', '/catalogue'], [f.nom, urlFiche.get(f.id)], [l.nom, urlLogiciel.get(q.logiciel)]],
      portrait: portraitDe(f),
      recruter: urlRecruter({ slug: f.slug }),
      corps: `<h1>${unAgent(f)} qui travaille sur ${echapper(l.nom)}</h1>
<p class="accroche">${echapper(q.usage)}</p>
<div class="carte"><p>${echapper(f.accroche)}</p></div>
${taches.length ? `<h2>Ses tâches dans ${echapper(l.nom)}</h2>${liste(taches.map((t) => `<li><strong>${echapper(t.nom)}</strong> : ${echapper(t.description)}</li>`))}` : ''}
<h2>À propos de ${echapper(l.nom)}</h2>
<p>${echapper(l.nom)}${l.editeur ? `, édité par ${echapper(l.editeur)}` : ''}. ${lien(`Tous nos agents qui savent tenir ${l.nom}`, urlLogiciel.get(q.logiciel))}.</p>
${autres.length ? `<h2>Il sait aussi tenir</h2>${puces(autres)}` : ''}`,
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
  poser(url, 'logiciels', plusRecente(dLogiciel(id), ...postes.map(({ f }) => dFiche(f)), ...acts.map(dActivite)), page({
    url,
    titre: `Agents IA qui savent tenir ${l.nom}`,
    description: postes.length
      ? `${postes.length} métiers iAgent savent travailler sur ${l.nom}${l.editeur ? ` (${l.editeur})` : ''}.`
      : `${l.nom}${l.editeur ? `, édité par ${l.editeur}` : ''} : les activités qui l'emploient et les métiers iAgent qui travaillent avec.`,
    fil: [['Logiciels', null], [l.nom, null]],
    corps: `<h1>Des agents IA qui savent tenir ${echapper(l.nom)}</h1>
<p class="accroche">${echapper(l.nom)}${l.editeur ? `, édité par ${echapper(l.editeur)}` : ''}.</p>
${postes.length ? `<h2>Les postes qualifiés</h2>${liste(postes.map(({ f, q }) => `<li>${lien(f.nom, urlPosteLogiciel(f, id))} : ${echapper(q.usage)}</li>`))}` : ''}
${acts.length ? `<h2>Les activités qui l'emploient</h2>${liste(acts.map((a) => `<li>${lien(a.nom, urlActivite.get(a.id))}</li>`))}` : ''}`,
  }));
}

// Every activity, by family: the way in for a visitor who knows their trade
// (« imprimerie ») and not the name of the job they need.
// Every software of the reference list, A to Z: max wants the whole list on
// show (10/10). A tool that no job or activity cites has no page of its own
// (see `cites`), so it is listed with its publisher, without a link.
const parLettre = new Map();
for (const l of [...logParId.values()].sort((x, y) => x.nom.localeCompare(y.nom, 'fr', { sensitivity: 'base' }))) {
  const c = l.nom.normalize('NFD').charAt(0).toUpperCase();
  const lettre = /[A-Z]/.test(c) ? c : '0-9';
  if (!parLettre.has(lettre)) parLettre.set(lettre, []);
  parLettre.get(lettre).push(l);
}
const nomLogiciel = (l) => (urlLogiciel.has(l.id) ? lien(l.nom, urlLogiciel.get(l.id)) : echapper(l.nom)) + (l.editeur ? ` <small>${echapper(l.editeur)}</small>` : '');
poser('/logiciels', 'core', plusRecente(...logiciels.map((l) => dLogiciel(l.id))), page({
  url: '/logiciels',
  titre: `Logiciels métier : les ${STATS.logiciels.toLocaleString('fr-FR')} outils que connaissent les agents iAgent`,
  description: `ERP, CRM, comptabilité, paie, logiciels de production, de santé, d'industrie… Les ${STATS.logiciels.toLocaleString('fr-FR')} logiciels métier du référentiel iAgent, de A à Z.`,
  fil: [['Logiciels', null]],
  corps: `<h1>Les ${STATS.logiciels.toLocaleString('fr-FR')} logiciels métier du référentiel</h1>
<p class="accroche">Les outils que vos agents savent tenir, de A à Z, avec leur éditeur. Vous connaissez votre activité ? <a href="/activites">Voyez les logiciels de votre branche</a>.</p>
<p class="puces">${[...parLettre.keys()].map((k) => `<a href="#lettre-${k}">${k}</a>`).join('')}</p>
${[...parLettre].map(([k, ls]) => `<h2 id="lettre-${k}">${k}</h2>${liste(ls.map((l) => `<li>${nomLogiciel(l)}</li>`))}`).join('\n')}`,
}));

// Every family of jobs (the 43 sectors), each with its own page listing its
// jobs: the other way in, for a visitor who knows the field and not the title.
poser('/secteurs', 'core', plusRecente(...[...secteurs.keys()].map(dSecteur), ...fiches.map(dFiche)), page({
  url: '/secteurs',
  titre: `Agents IA par secteur : ${STATS.secteurs} familles de métiers`,
  description: `Comptabilité, commerce, santé, juridique, logistique… Les ${STATS.metiers} métiers iAgent rangés en ${STATS.secteurs} secteurs.`,
  fil: [['Secteurs', null]],
  corps: `<h1>Les métiers, secteur par secteur</h1>
<p class="accroche">${STATS.secteurs} familles de métiers, ${STATS.metiers} métiers. Vous connaissez votre activité plutôt que le métier ? <a href="/activites">Cherchez par activité</a>.</p>
${liste([...secteurs].map(([id, nom]) => `<li>${lien(nom, urlSecteur.get(id))}<br>${fiches.filter((f) => f.secteur === id).length} métiers</li>`))}`,
}));
for (const [id, nom] of secteurs) {
  const leurs = fiches.filter((f) => f.secteur === id);
  const url = urlSecteur.get(id);
  poser(url, 'secteurs', plusRecente(dSecteur(id), ...leurs.map(dFiche)), page({
    url,
    titre: `Agents IA ${nom.toLowerCase()} : ${leurs.length} métiers`,
    description: `${leurs.length} agents IA du secteur ${nom.toLowerCase()} : ${leurs.slice(0, 4).map((f) => f.nom.toLowerCase()).join(', ')}…`,
    fil: [['Secteurs', '/secteurs'], [nom, null]],
    corps: `<h1>${echapper(nom)} : ${leurs.length} métiers</h1>
<p class="accroche">Chaque agent est un professionnel du métier, réglé sur votre activité et vos logiciels pendant l'entretien d'embauche.</p>
${liste(leurs.map((f) => `<li>${lien(f.nom, urlFiche.get(f.id))} : ${echapper(f.accroche)}</li>`))}`,
  }));
}

poser('/activites', 'core', plusRecente(...activites.map(dActivite)), page({
  url: '/activites',
  titre: `Agents IA par activité : ${STATS.activites} activités`,
  description: `Imprimerie, boulangerie, cabinet comptable, transport… Trouvez les agents IA de votre activité parmi ${STATS.activites} activités.`,
  fil: [['Activités', null]],
  corps: `<h1>Votre activité, vos agents</h1>
<p class="accroche">Choisissez votre activité parmi ${STATS.activites} : chaque agent que vous recrutez reçoit son vocabulaire, ses documents, ses règles et ses logiciels. Vous préférez chercher par famille de métiers ? <a href="/secteurs">Les secteurs</a>.</p>
${Object.entries(FAMILLES_ACTIVITE).map(([id, nom]) => {
    const siennes = activites.filter((a) => a.famille === id);
    return siennes.length ? `<h2>${echapper(nom)}</h2>${puces(siennes.map((a) => lien(a.nom, urlActivite.get(a.id))))}` : '';
  }).join('\n')}`,
}));
const sansFamille = activites.filter((a) => !FAMILLES_ACTIVITE[a.famille]);
if (sansFamille.length) throw new Error(`activités sans famille connue : ${sansFamille.map((a) => a.id).join(', ')}`);

for (const a of activites) {
  const url = urlActivite.get(a.id);
  const p = a.pack ?? {};
  const { proches, outilles } = cerclesDeLActivite(a, fiches);
  const personnel = personnelDeLActivite(a, fiches);
  const sesFiches = [...proches, ...outilles, ...(personnel ? [...personnel.services.flatMap((x) => x.postes.map((y) => y.fiche)), ...personnel.terrain.map((y) => y.fiche)] : [])];
  poser(url, 'activites', plusRecente(dActivite(a), ...sesFiches.map(dFiche)), page({
    url,
    titre: `Agents IA pour ${a.nom.toLowerCase()}`,
    description: `${a.trait} Des agents IA qui parlent le métier de votre activité.`,
    fil: [['Activités', '/activites'], [a.nom, null]],
    corps: `<h1>Des agents IA pour votre activité : ${echapper(a.nom.toLowerCase())}</h1>
<p class="accroche">${echapper(a.trait)}</p>
<p>Chaque agent iAgent reçoit le savoir de votre activité en plus de son métier : son vocabulaire, ses documents, ses règles et ses logiciels.</p>
${personnel ? `<h2>Tout le personnel d'une entreprise de votre branche</h2><p>Sous les vrais noms des postes, service par service. Chacun est un agent que vous recrutez.</p>
${personnel.services.filter((s) => s.postes.length).map((s) => `<h3>${echapper(s.libelle)}</h3>${liste(s.postes.map(({ role, fiche }) => `<li><strong>${echapper(role)}</strong> : ${lien(fiche.nom, urlFiche.get(fiche.id))}</li>`))}`).join('\n')}
${personnel.terrain.length ? `<h3>Sur le terrain</h3><p>Ces métiers restent les vôtres : vos agents préparent leur travail, ils ne prennent pas leur place.</p>${liste(personnel.terrain.map(({ metier, fiche }) => `<li><strong>${echapper(metier)}</strong> : préparé par ${lien(fiche.nom, urlFiche.get(fiche.id))}</li>`))}` : ''}
<p class="sources">Postes relevés dans ${echapper(personnel.sources.join(' ; '))}.</p>` : ''}
${p.logiciels?.length ? `<h2>Les logiciels de votre métier</h2><p>Vos agents y travaillent : à l'entretien d'embauche, chacun vous demande lesquels tournent dans votre entreprise.</p>${liste(p.logiciels.map((id) => logParId.get(id)).map((l) => `<li>${lien(l.nom, urlLogiciel.get(l.id))}${l.editeur ? `, de ${echapper(l.editeur)}` : ''}</li>`))}` : ''}
${proches.length + outilles.length ? `<h2>Les métiers les plus proches de votre activité</h2>${puces([...proches, ...outilles].map((f) => lien(nomDistinct(f), urlFiche.get(f.id))))}` : ''}
${p.vocabulaire?.length ? `<h2>Le vocabulaire qu'il connaît</h2>${liste(p.vocabulaire.map((v) => `<li><strong>${echapper(v.terme)}</strong> : ${echapper(v.sens)}</li>`))}` : ''}
${p.documents?.length ? `<h2>Les documents qu'il manie</h2>${liste(p.documents.map((d) => `<li><strong>${echapper(d.nom)}</strong> : ${echapper(d.role)}</li>`))}` : ''}
${p.regles?.length ? `<h2>Les règles qu'il respecte</h2>${liste(p.regles.map((r) => `<li>${echapper(r)}</li>`))}` : ''}
${sectionsDuPack(p)}
<h2>Les postes que toute entreprise emploie, réglés sur votre activité</h2>${puces(transversaux.map((f) => lien(nomDistinct(f), urlPosteActivite(f, a))))}`,
  }));
}

// max's rule (SEO brief of 10/10): a job × activity page is indexed only when
// it has matter of its own: a valid job with its missions, an activity that
// takes this job (the cross-trade rule above), the activity's own introduction,
// vocabulary, documents, rules and software. Missing one, the page still
// exists for the visitor who follows a link, says noindex, and is in no sitemap.
function sansMatiere(f, a) {
  const p = a.pack ?? {};
  const manque = [
    !f.taches?.length && 'missions du métier',
    !estTransversal(f) && 'métier sans rapport avec cette activité',
    !a.trait && "introduction de l'activité",
    !p.vocabulaire?.length && "vocabulaire de l'activité",
    !p.documents?.length && "documents de l'activité",
    !p.regles?.length && "règles de l'activité",
    !p.logiciels?.length && "logiciels de l'activité",
  ].filter(Boolean);
  return manque.length ? manque.join(', ') : null;
}

// Each page joins what the fiche says about the job and what the activity's
// pack says about the trade: its vocabulary, documents, rules, and the
// activity's software the job actually works in (same family as one of its
// tasks), which then goes into the title: "… pour imprimerie, sur Masterprint".
for (const a of activites) {
  const p = a.pack ?? {};
  // The trade's own staff (catalogue/personnel.json): the name this job bears
  // in the branch, and the branch's own expert when it has one for the same
  // function. max (10/10): « agent de devis × optique » must read as the
  // optician's quoting post, as the printer's deviseur already does.
  const per = personnelDeLActivite(a, fiches);
  const postes = per ? per.services.flatMap((s) => s.postes.map((x) => ({ ...x, service: s.libelle }))) : [];
  const placeDe = new Map(postes.map((x) => [x.fiche.id, x]));
  const expertDevis = postes.find((x) => !estTransversal(x.fiche) && (DEVIS.test(x.role) || DEVIS.test(x.fiche.nom))) ?? null;
  for (const f of transversaux) {
    const url = reserver(urlPosteActivite(f, a), `${f.id}×${a.id}`);
    const familles = new Set(f.taches.flatMap((t) => t.logiciels ?? []));
    const outils = (p.logiciels ?? []).map((id) => logParId.get(id)).filter((l) => familles.has(l.categorie));
    const outilsDe = (t) => outils.filter((l) => (t.logiciels ?? []).includes(l.categorie));
    const sur = outils.length ? `, sur ${outils.map((l) => l.nom).join(' ou ')}` : '';
    const activite = a.nom.toLowerCase();
    const place = placeDe.get(f.id) ?? null;
    const expert = DEVIS.test(f.nom) && expertDevis && expertDevis.fiche.id !== f.id ? expertDevis : null;
    const raison = sansMatiere(f, a);
    poser(url, 'combinaisons', plusRecente(dFiche(f), dActivite(a), ...outils.map((l) => dLogiciel(l.id))), page({
      noindex: Boolean(raison),
      url,
      titre: `${f.nom} pour ${activite}${sur}`,
      description: `${f.nom} pour ${activite}${sur}. ${f.accroche} ${a.trait}`,
      fil: [[a.nom, urlActivite.get(a.id)], [f.nom, urlFiche.get(f.id)]],
      portrait: portraitDe(f),
      recruter: urlRecruter({ slug: f.slug, activite: a.nom }),
      corps: `<h1>${unAgent(f)} pour ${echapper(activite)}${echapper(sur)}</h1>
<p class="accroche">${echapper(f.accroche)}</p>
<div class="carte"><p>${echapper(a.trait)}</p>${place ? `<p>Dans une entreprise de ${echapper(activite)}, ce poste s'appelle « ${echapper(place.role)} » (${echapper(place.service.toLowerCase())}).</p>` : ''}<p>Il reçoit le savoir de votre activité en plus de son métier : son vocabulaire, ses documents, ses règles et ses logiciels.</p></div>
${expert ? `<div class="carte"><p>Votre branche a son propre expert du devis : ${lien(expert.fiche.nom, urlFiche.get(expert.fiche.id))}, « ${echapper(expert.role)} ». ${echapper(expert.fiche.accroche)}</p></div>` : ''}
<h2>Ce qu'il fait chaque jour</h2>
${liste(f.taches.map((t) => `<li><strong>${echapper(t.nom)}</strong> : ${echapper(t.description)}${outilsDe(t).length ? ` Dans ${outilsDe(t).map((l) => echapper(l.nom)).join(' ou ')}.` : ''}</li>`))}
${outils.length ? `<h2>Les logiciels de votre activité qu'il tient</h2>${liste(outils.map((l) => `<li>${lien(l.nom, urlLogiciel.get(l.id))}${l.editeur ? `, de ${echapper(l.editeur)}` : ''}</li>`))}` : ''}
${(p.logiciels ?? []).length > outils.length ? `<h2>Les autres logiciels de votre activité</h2><p>Il vous demande à l'entretien lesquels vous employez.</p>${puces((p.logiciels ?? []).map((id) => logParId.get(id)).filter((l) => !outils.includes(l)).map((l) => lien(l.nom, urlLogiciel.get(l.id))))}` : ''}
${p.vocabulaire?.length ? `<h2>Le vocabulaire qu'il connaît</h2>${liste(p.vocabulaire.map((v) => `<li><strong>${echapper(v.terme)}</strong> : ${echapper(v.sens)}</li>`))}` : ''}
${p.documents?.length ? `<h2>Les documents qu'il manie</h2>${liste(p.documents.map((d) => `<li><strong>${echapper(d.nom)}</strong> : ${echapper(d.role)}</li>`))}` : ''}
${p.regles?.length ? `<h2>Les règles qu'il respecte</h2>${liste(p.regles.map((r) => `<li>${echapper(r)}</li>`))}` : ''}
${sectionsDuPack(p)}`,
    }), raison);
  }
}

// --- checks, then write ---------------------------------------------------
const cibles = new Set(pages.keys());
const HORS_SEO = new Set(['/', '/catalogue', '/favicon.ico', '/favicon.svg', '/apple-touch-icon.png', '/site.webmanifest', '/seo.css', ...PAGES_OFFRE.map((p) => `/${p.nom}`)]);
for (const [url, html] of pages) {
  for (const [, lu] of html.matchAll(/href="(\/[^"]*)"/g)) {
    // A page with what the visitor chose in its address (/recruter?poste=…) is still that page.
    const href = lu.split('?')[0];
    if (HORS_SEO.has(href) || href.startsWith('/polices/')) continue;
    if (!cibles.has(href)) throw new Error(`${url} renvoie vers ${href}, page non générée`);
  }
}

for (const dossier of ['agents', 'activites', 'logiciels']) rmSync(join(SORTIE, dossier), { recursive: true, force: true });
for (const [url, html] of pages) {
  const fichier = join(SORTIE, `${url.slice(1)}.html`);
  mkdirSync(dirname(fichier), { recursive: true });
  writeFileSync(fichier, html);
}

// --- sitemaps ---------------------------------------------------------------
// One index, one sitemap per family (max's brief of 10/10), the combinations
// cut in files of 15 000 and gzipped. Only indexable, canonical, absolute https
// addresses: no query string, no noindex page, nothing redirected.
// The offer pages of max's site plan are built by Vite; the list page
// (/recrutement) is a cart, noindex, and stays out.
for (const p of PAGES_OFFRE) meta.set(`/${p.nom}`, { famille: 'core', lastmod: null, noindex: p.noindex ? 'panier du visiteur' : null });
meta.set('/', { famille: 'core', lastmod: null, noindex: null });
meta.set('/catalogue', { famille: 'core', lastmod: null, noindex: null });
const redirigees = new Set((JSON.parse(readFileSync(join(RACINE, 'vercel.json'), 'utf8')).redirects ?? []).map((r) => r.source));
const FAMILLES = ['core', 'metiers', 'secteurs', 'activites', 'logiciels', 'metiers-logiciels', 'combinaisons'];
const parFamille = new Map(FAMILLES.map((f) => [f, []]));
for (const [url, m] of meta) {
  if (m.noindex || redirigees.has(url) || url.includes('?')) continue;
  parFamille.get(m.famille).push(url);
}
const ORDRE_CORE = ['/', '/catalogue'];
parFamille.get('core').sort((a, b) => (ORDRE_CORE.indexOf(b) - ORDRE_CORE.indexOf(a)) || a.localeCompare(b));

const urlset = (urls) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => {
  const d = meta.get(u).lastmod;
  return `<url><loc>${SITE}${u}</loc>${d ? `<lastmod>${d}</lastmod>` : ''}</url>`;
}).join('\n')}\n</urlset>\n`;
mkdirSync(SORTIE, { recursive: true });
for (const vieux of readdirSync(SORTIE).filter((n) => /^sitemap.*\.xml(\.gz)?$/.test(n))) rmSync(join(SORTIE, vieux));
const sitemaps = []; // { fichier, famille, urls }
for (const famille of FAMILLES) {
  const urls = parFamille.get(famille);
  if (!urls.length) continue;
  // A family too big for one file is cut, numbered and gzipped.
  if (urls.length > MAX_URLS_PAR_SITEMAP || famille === 'combinaisons') {
    for (let i = 0, n = 1; i < urls.length; i += MAX_URLS_PAR_SITEMAP, n += 1) {
      const fichier = `sitemap-${famille}-${String(n).padStart(2, '0')}.xml.gz`;
      const lot = urls.slice(i, i + MAX_URLS_PAR_SITEMAP);
      writeFileSync(join(SORTIE, fichier), gzipSync(urlset(lot)));
      sitemaps.push({ fichier, famille, urls: lot });
    }
  } else {
    const fichier = `sitemap-${famille}.xml`;
    writeFileSync(join(SORTIE, fichier), urlset(urls));
    sitemaps.push({ fichier, famille, urls });
  }
}
const index = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemaps.map((s) => {
  const d = plusRecente(...s.urls.map((u) => meta.get(u).lastmod));
  return `<sitemap><loc>${SITE}/${s.fichier}</loc>${d ? `<lastmod>${d}</lastmod>` : ''}</sitemap>`;
}).join('\n')}\n</sitemapindex>\n`;
writeFileSync(join(SORTIE, 'sitemap-index.xml'), index);
// The address submitted before 10/10 keeps answering, with the same index.
writeFileSync(join(SORTIE, 'sitemap.xml'), index);
writeFileSync(join(SORTIE, 'seo.css'), STYLE.trim() + '\n');
// A Vercel preview (VERCEL_ENV=preview) is a copy of the site on another host:
// its robots.txt forbids everything, so a search engine never indexes a copy
// in place of iagent.agency (max's brief of 10/10 17h). Vercel adds on its
// side the header `x-robots-tag: noindex` on every preview answer. Only the
// production build, and a build on a machine without Vercel, announce the index.
const EN_APERCU = Boolean(process.env.VERCEL_ENV) && process.env.VERCEL_ENV !== 'production';
writeFileSync(join(SORTIE, 'robots.txt'), EN_APERCU
  ? `# Aperçu de travail : rien à indexer ici, le site est https://iagent.agency/\nUser-agent: *\nDisallow: /\n`
  : `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap-index.xml\n`);

// --- report -------------------------------------------------------------------
// max's brief: the SEO report, at every build (seo-rapport.json next to the
// sitemaps, for the back-office's « SEO Factory »). Every address is opened
// from what was written: a title, an h1, a canonical pointing at itself, and a
// noindex exactly where the rule put one. Counters are read back too: a total
// of jobs, sectors, activities or software written anywhere must be the
// catalogue's (the crawl of 10/10 still found « 1 249 métiers » on a page).
const construitIci = existsSync(join(SORTIE, 'index.html')); // false for the bench's trial run
const fichierDe = (url) => join(SORTIE, url === '/' ? 'index.html' : `${url.slice(1)}.html`);
const nombreLu = (t) => Number(t.replace(/[\s  ]/g, ''));
// A total written on a page is the catalogue's or it is wrong. Two nets: the
// totals the site published before (the crawl of 10/10 read 1 249 / 43 / 1 693
// from an old build, 1 403 / 63 / 303 / 1 973 from a later one), and the
// phrases that announce a total, whatever the number.
const ANCIENS_TOTAUX = { métiers: [1249, 1403], secteurs: [43, 63, 64], activités: [303], logiciels: [1693, 1973] };
const ATTENDU = { métiers: STATS.metiers, secteurs: STATS.secteurs, activités: STATS.activites, logiciels: STATS.logiciels };
const PHRASES_TOTAUX = /(\d{1,3}(?:[\s\u00a0\u202f]\d{3})*)\s*(?:<\/?(?:strong|span|b|em|a)[^>]*>\s*)*(métiers prêts|métiers iAgent, à|métiers rangés|familles de métiers|métiers, réglés|métiers\.|activités reconnues|activités\b(?=[^<]{0,3}<)|logiciels métier du référentiel|logiciels au référentiel|secteurs\b)/g;
const QUOI = (phrase) => phrase.match(/métiers|secteurs|activités|logiciels/)[0];
// An anomaly names the address, its family, the reason, the day it was seen
// and what to do: the line max's SEO agency can act on without opening the code.
const anomalies = { absentes: [], sansTitre: [], sansH1: [], sansCanonical: [], canonicalAilleurs: [], noindexIncoherent: [], compteursFaux: [], metiersSansPage: [], logicielsSansPageCites: [] };
const ACTIONS = {
  absentes: 'construire la page ou retirer son adresse',
  sansTitre: 'donner un <title> à la page',
  sansH1: 'donner un <h1> à la page',
  sansCanonical: 'poser <link rel="canonical"> sur la page',
  canonicalAilleurs: "faire pointer le canonical sur la page elle-même",
  noindexIncoherent: "aligner la balise robots sur la règle d'indexation",
  compteursFaux: 'lire le total dans statistiquesCatalogue() au lieu de l\'écrire',
  metiersSansPage: 'vérifier la fiche du métier dans agents/ et son slug',
  logicielsSansPageCites: 'vérifier le logiciel dans catalogue/logiciels.json',
};
const anomalie = (quoi, url, raison) => anomalies[quoi].push({ url, famille: meta.get(url)?.famille ?? null, raison, detectee: AUJOURDHUI, action: ACTIONS[quoi] });
const noindexParRaison = {};
for (const [url, m] of meta) {
  if (m.noindex) noindexParRaison[m.noindex] = (noindexParRaison[m.noindex] ?? 0) + 1;
  let html = pages.get(url);
  if (html === undefined) {
    if (!existsSync(fichierDe(url))) { if (construitIci) anomalie('absentes', url, 'aucun fichier construit pour cette adresse'); continue; }
    html = readFileSync(fichierDe(url), 'utf8');
  }
  const tete = html.slice(0, html.indexOf('</head>'));
  if (!/<title>[^<]+<\/title>/.test(tete)) anomalie('sansTitre', url, 'pas de <title>');
  if (!/<h1[\s>]/.test(html)) anomalie('sansH1', url, 'pas de <h1>');
  const canonical = tete.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (!canonical) anomalie('sansCanonical', url, 'pas de canonical');
  else if (canonical !== `${SITE}${url}`) anomalie('canonicalAilleurs', url, `canonical vers ${canonical}`);
  if (/<meta name="robots" content="noindex/.test(tete) !== Boolean(m.noindex)) anomalie('noindexIncoherent', url, m.noindex ? `la règle dit noindex (${m.noindex}) et la page ne le dit pas` : 'la page dit noindex et la règle non');
  for (const [, lu, phrase] of html.matchAll(PHRASES_TOTAUX)) {
    const quoi = QUOI(phrase);
    const n = nombreLu(lu);
    if (n !== ATTENDU[quoi] && (ANCIENS_TOTAUX[quoi].includes(n) || n > ATTENDU[quoi] / 2)) anomalie('compteursFaux', url, `« ${lu} ${phrase.replace(/<[^>]+>/g, '')} » au lieu de ${ATTENDU[quoi]}`);
  }
}
const familleDe = (prefixe) => [...meta.values()].filter((m) => m.famille === prefixe);

// --- jobs: three sources that must agree ------------------------------------
// The catalogue's list (catalogue/catalogue.json), the fiches on disk
// (agents/) and the job sitemap are three counts from three places; the report
// writes all three and names any job missing from the sitemap, so a job that
// disappears is seen here and not by a visitor (max's brief of 10/10 17h:
// 1 645 expected against 1 644 published — the one was AG-1690, merged into
// AG-1610 on 09/10 as the same post twice; nothing was lost, and this block
// would now say so by name).
const indexables = new Set(sitemaps.flatMap((x) => x.urls));
const catalogueIds = new Set(lire('catalogue/catalogue.json').agents.map((a) => a.id));
const fichesParId = new Map(fiches.map((f) => [f.id, f]));
for (const id of catalogueIds) {
  const f = fichesParId.get(id);
  const url = f ? urlFiche.get(id) : null;
  if (!f) anomalie('metiersSansPage', `/agents/${id}`, `${id} est au catalogue sans fiche dans agents/`);
  else if (!indexables.has(url)) anomalie('metiersSansPage', url, meta.get(url)?.noindex ? `noindex : ${meta.get(url).noindex}` : 'absente du sitemap des métiers');
}
for (const f of fiches) if (!catalogueIds.has(f.id)) anomalie('metiersSansPage', urlFiche.get(f.id), `${f.id} a une fiche dans agents/ sans ligne au catalogue`);
const metiersRapport = {
  base: catalogueIds.size,
  fiches: fiches.length,
  publics: fiches.filter((f) => !meta.get(urlFiche.get(f.id))?.noindex).length,
  indexables: parFamille.get('metiers').length,
  exclus: anomalies.metiersSansPage.length,
  exclusDetail: anomalies.metiersSansPage.map((x) => ({ url: x.url, raison: x.raison })),
  regle: "un métier = une ligne de catalogue/catalogue.json = une fiche dans agents/ = une adresse /agents/<slug> dans sitemap-metiers.xml ; la construction s'arrête si l'un des trois manque",
};

// --- software: why 3 071 at the catalogue make fewer pages ------------------
// A software page exists when a fiche is qualified on it or an activity's pack
// lists it; the rest of the catalogue is kept for the hiring interview (the
// client names his tool, the agent recognises it) and makes no page, because
// a page about a tool no agent uses would promise nothing. The report says it
// by cause, so the gap is read as a choice and not as a loss.
const slugNom = (l) => slugifier(l.nom);
const slugsAvecPage = new Set([...urlLogiciel.keys()].map((id) => slugNom(logParId.get(id))));
const sansPage = logiciels.filter((l) => !urlLogiciel.has(l.id));
const causeDe = (l) => {
  if (!l.nom?.trim()) return 'sans nom';
  if (slugsAvecPage.has(slugNom(l))) return "même nom qu'un logiciel qui a sa page (doublon ou édition régionale)";
  if (l.aConfirmer || l.note?.includes('à confirmer')) return 'cité par aucune fiche ni aucun pack d\'activité, et encore à confirmer';
  return 'cité par aucune fiche ni aucun pack d\'activité';
};
const compterPar = (liste, cle) => Object.fromEntries(Object.entries(liste.reduce((acc, x) => ((acc[cle(x)] = (acc[cle(x)] ?? 0) + 1), acc), {})).sort((a, b) => b[1] - a[1]));
for (const id of cites) if (!urlLogiciel.has(id)) anomalie('logicielsSansPageCites', `/logiciels/${id}`, `${id} est cité par une fiche ou une activité et n'a pas de page`);
const logicielsRapport = {
  total: logiciels.length,
  avecPage: urlLogiciel.size,
  sansPage: sansPage.length,
  causes: compterPar(sansPage, causeDe),
  sansPageParCategorie: (() => { const e = Object.entries(compterPar(sansPage, (l) => l.categorie ?? 'sans catégorie')); return Object.fromEntries([...e.slice(0, 15), ['autres familles', e.slice(15).reduce((n, [, v]) => n + v, 0)]]); })(),
  exemples: sansPage.slice(0, 20).map((l) => ({ id: l.id, nom: l.nom, categorie: l.categorie, cause: causeDe(l) })),
  regle: "un logiciel a sa page quand une fiche est qualifiée dessus ou qu'un pack d'activité le liste ; les autres servent l'entretien d'embauche et ne font pas de page",
};

// --- what is kept out of the sitemaps, address by address ------------------
// max's brief (10/10 17h): say whether the noindex page and the redirected
// address are the same one. `uniques` counts distinct addresses; `details`
// names each with its status, its robots rule and its reason.
const exclusions = new Map();
for (const [url, m] of meta) if (m.noindex) exclusions.set(url, { url, statut: 200, robots: 'noindex', famille: m.famille, raison: m.noindex });
for (const r of JSON.parse(readFileSync(join(RACINE, 'vercel.json'), 'utf8')).redirects ?? []) {
  const e = exclusions.get(r.source);
  if (e) { e.statut = r.permanent ? 308 : 307; e.raison += ` ; redirigée vers ${r.destination}`; }
  else exclusions.set(r.source, { url: r.source, statut: r.permanent ? 308 : 307, robots: null, famille: meta.get(r.source)?.famille ?? null, raison: `redirigée vers ${r.destination}` });
}
const rapport = {
  genere: AUJOURDHUI,
  environnement: EN_APERCU ? `aperçu (${process.env.VERCEL_ENV}) : robots.txt interdit tout, rien à indexer ici` : 'production : robots.txt annonce sitemap-index.xml',
  compteurs: { metiers: STATS.metiers, secteurs: STATS.secteurs, activites: STATS.activites, logiciels: STATS.logiciels, taches: STATS.taches },
  metiers: metiersRapport,
  logiciels: logicielsRapport,
  adresses: {
    generees: meta.size,
    indexables: sitemaps.reduce((n, x) => n + x.urls.length, 0),
    noindex: Object.values(noindexParRaison).reduce((a, b) => a + b, 0),
    noindexParRaison,
    redirigees: [...redirigees].length,
    erreurs404: anomalies.absentes.length,
    exclusionsUniques: exclusions.size,
    details: [...exclusions.values()],
  },
  parFamille: Object.fromEntries(FAMILLES.map((f) => [f, { pages: familleDe(f).length, indexables: parFamille.get(f).length }])),
  sitemaps: sitemaps.map((x) => ({ fichier: x.fichier, adresses: x.urls.length, lastmod: plusRecente(...x.urls.map((u) => meta.get(u).lastmod)) })),
  dates: {
    regle: "lastmod = jour où la donnée de la page a changé (empreinte de chaque fiche, activité, logiciel, secteur dans seo/dates.json), jamais le jour de la construction ; une page composée prend la plus récente de ses sources : métier + logiciels qualifiés, métier + activité + logiciels de l'activité employés, logiciel + métiers et activités qui le citent",
    sourcesSuivies: Object.keys(datesVues).length,
    modifieesDepuisLeReleve: sourcesModifiees.length,
    exemples: sourcesModifiees.slice(0, 20),
  },
  anomalies: Object.fromEntries(Object.entries(anomalies).map(([k, v]) => [k, { nombre: v.length, action: ACTIONS[k], exemples: v.slice(0, 20) }])),
};
writeFileSync(join(SORTIE, 'seo-rapport.json'), JSON.stringify(rapport, null, 2) + '\n');
if (RELEVER_DATES) {
  writeFileSync(FICHIER_DATES, JSON.stringify(Object.fromEntries(Object.entries(datesVues).sort()), null, 0).replace(/\],"/g, '],\n"') + '\n');
  console.log(`dates : ${Object.keys(datesVues).length} sources relevées dans seo/dates.json`);
}

const compte = (prefixe) => [...pages.keys()].filter((u) => u.startsWith(prefixe)).length;
const postesLogiciels = [...pages.keys()].filter((u) => u.startsWith('/agents/') && u.split('/').length === 4).length;
const postesActivites = [...pages.keys()].filter((u) => u.startsWith('/activites/') && u.split('/').length === 4).length;
console.log(`pages : ${fiches.length} postes, ${compte('/activites/') - postesActivites} activités, ${compte('/logiciels/')} logiciels, ${postesLogiciels} poste × logiciel, ${postesActivites} poste × activité — ${pages.size} en tout`);
console.log(`sitemaps : ${rapport.adresses.indexables} adresses indexables en ${sitemaps.length} fichiers (${sitemaps.map((x) => `${x.fichier} ${x.urls.length}`).join(', ')}), ${rapport.adresses.noindex} en noindex`);
if (sourcesModifiees.length) console.log(`dates : ${sourcesModifiees.length} source(s) modifiée(s) depuis le relevé, datée(s) d'aujourd'hui (node seo/generer.mjs --dates pour relever)`);
const fautes = Object.entries(anomalies).filter(([, v]) => v.length);
if (fautes.length) {
  for (const [k, v] of fautes) console.error(`SEO ${k} : ${v.length} — ${v.slice(0, 5).map((x) => `${x.url} (${x.raison})`).join(' ; ')}`);
  process.exit(1);
}
