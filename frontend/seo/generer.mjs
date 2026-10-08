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

import { PAGES as PAGES_OFFRE } from '../src/pages/site.js';
import { slugifier } from './slug.mjs';
import { portraitDe } from '../src/data/portraits.js';
export { slugifier };

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

// Level 3: jobs every business has (office, accounting, HR, sales, purchasing,
// marketing), each in each activity. Jobs written for one trade ("assistant
// médical administratif") are left out: in a sawmill they would be nonsense.
const SECTEURS_TRANSVERSAUX = new Set(['administration', 'comptabilite', 'ressources-humaines', 'commercial', 'achats', 'marketing']);
const METIER_PROPRE = /immobilier|médical|juridique|cabinet de recrutement/i;
const transversaux = fiches.filter((f) => SECTEURS_TRANSVERSAUX.has(f.secteur) && !METIER_PROPRE.test(f.nom));
const urlPosteActivite = (f, a) => `${urlActivite.get(a.id)}/${f.slug}`;

// --- layout ---------------------------------------------------------------
// The same header, colours and type as the rest of iagent.agency (charte
// e-agent: Montserrat, the eight-colour gradient), with the full menu and a
// way back on every page: these pages are where a search engine lands people.
const TELECHARGEMENT = 'https://github.com/STANDUP-SHOW/iagents/releases/latest/download/iAgent-Windows.msi';
const MENU = [
  ['Produit', '/workforce'], ['Agents', '/catalogue'], ['Créer votre entreprise', '/create'], ['Voice', '/voice'],
  ['iAgent Box', '/box'], ['Entreprise', '/enterprise'], ['Ressources', '/how-it-works'],
];
const PIED = [
  ['Produit', [['iAgent Workforce', '/workforce'], ['iAgent Box', '/box'], ['Tarifs', '/pricing'], ['Pourquoi louer', '/why-rent'], ['Télécharger pour Windows', TELECHARGEMENT]]],
  ['Agents', [['Le catalogue des métiers', '/catalogue'], ['Skill Packs', '/skills'], ['Créer votre entreprise', '/create'], ['Opportunités', '/opportunities']]],
  ['Voice', [['iAgent Voice', '/voice'], ['Standard téléphonique', '/standard-telephonique'], ['Support Center', '/support-center'], ['Sales Center', '/sales-center']]],
  ['Entreprise', [['iAgent Enterprise', '/enterprise'], ['IA locale et hybride', '/local-ai'], ['Sécurité', '/security'], ['Questions fréquentes', '/faq'], ['Contact', '/contact']]],
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
.logo img{height:26px;width:auto;display:block}
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
@media (max-width:480px){main ul{grid-template-columns:1fr}.pied-grille{grid-template-columns:1fr}.appel{padding:28px 22px}}`;

const liens = (items) => items.map(([t, u]) => `<a href="${u}">${echapper(t)}</a>`).join('');

function page({ url, titre, description, fil = [], corps, portrait = null, appel = null }) {
  // The page's title and hook open the coloured band; the rest is the body.
  const m = corps.match(/^\s*(<h1>[\s\S]*?<\/h1>)\s*(<p class="accroche">[\s\S]*?<\/p>)?/);
  const tete = m ? m[0] : '';
  const reste = (m ? corps.slice(m[0].length) : corps)
    .replace(/<\/strong> : /g, '</strong>').replace(/(<li><a [^>]*>[^<]*<\/a>) : /g, '$1<br>');
  const filHtml = [['Accueil', '/'], ...fil].map(([t, u]) => (u ? `<a href="${u}">${echapper(t)}</a>` : `<span>${echapper(t)}</span>`)).join('<span aria-hidden="true">›</span>');
  const [appelTitre, appelTexte] = appel ?? ['Trouvez le collaborateur IA de votre métier', '1 249 métiers, réglés sur votre secteur et votre activité.'];
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${echapper(titre)} | iAgent</title>
<meta name="description" content="${echapper(description.slice(0, 300))}">
<meta name="theme-color" content="#020817">
<link rel="canonical" href="${SITE}${url}"><link rel="icon" type="image/png" href="/puce-cerveau.png">
<link rel="preload" href="/polices/montserrat-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/seo.css"></head>
<body>
<header class="tete"><div class="cadre tete-ligne">
<a class="logo" href="/" aria-label="iAgent, accueil"><img src="/accueil/logo-iagent-blanc.svg" alt="iAgent" width="91" height="26"></a>
<nav class="menu" aria-label="Navigation principale">${liens(MENU)}</nav>
<a class="bouton bouton-degrade" href="${TELECHARGEMENT}">Télécharger l'app</a>
<details class="mobile"><summary aria-label="Ouvrir le menu"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16M4 16h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></summary>
<nav aria-label="Menu">${liens(MENU)}<a href="${TELECHARGEMENT}">Télécharger l'app</a></nav></details>
</div></header>
<div class="bandeau"><div class="cadre">
<nav class="fil" aria-label="Fil d'Ariane">${filHtml}<a class="retour" href="/catalogue">← Retour au catalogue</a></nav>
<div class="heros${portrait ? ' avec-portrait' : ''}"><div>${tete}
<div class="actions"><a class="bouton bouton-degrade" href="/catalogue">Recruter un agent</a><a class="bouton bouton-contour" href="/how-it-works">Comment ça marche</a></div></div>
${portrait ? `<div class="portrait"><img src="${portrait}" alt="" width="320" height="320"></div>` : ''}</div>
</div></div>
<main class="cadre">${reste}
<section class="appel"><div><h2>${echapper(appelTitre)}</h2><p>${echapper(appelTexte)}</p></div>
<div class="actions" style="margin:0"><a class="bouton bouton-degrade" href="/catalogue">Voir le catalogue</a><a class="bouton bouton-contour" href="/pricing">Voir les tarifs</a></div></section>
</main>
<footer class="pied"><div class="cadre pied-grille">
<div><img src="/accueil/logo-iagent-blanc.svg" alt="iAgent" width="112" height="32"><p>Des collaborateurs IA par métier, qui connaissent vos logiciels et travaillent chez vous, en local, ou par API.</p></div>
${PIED.map(([t, items]) => `<nav aria-label="${t}"><b>${t}</b>${liens(items)}</nav>`).join('')}
</div><div class="cadre pied-bas"><span>© 2026 iAgent · e-Agent Agency</span><span>Human ambition. Agentic execution.</span></div></footer>
</body></html>
`;
}

const liste = (items) => `<ul>${items.join('')}</ul>`;
// A long run of links reads as chips, folded beyond two dozen.
const puces = (items) => items.length <= 24
  ? `<p class="puces">${items.join('')}</p>`
  : `<p class="puces">${items.slice(0, 24).join('')}</p><details class="suite"><summary>Voir les ${items.length - 24} autres</summary><p class="puces">${items.slice(24).join('')}</p></details>`;
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
    fil: [['Agents', '/catalogue'], [secteur, null]],
    portrait: portraitDe(f),
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
    pages.set(u, page({
      url: u,
      titre: `${f.nom} sur ${l.nom}`,
      description: `${f.nom} qui sait travailler sur ${l.nom}. ${q.usage}`,
      fil: [['Agents', '/catalogue'], [f.nom, urlFiche.get(f.id)], [l.nom, urlLogiciel.get(q.logiciel)]],
      portrait: portraitDe(f),
      corps: `<h1>Un agent ${echapper(f.nom.toLowerCase())} qui travaille sur ${echapper(l.nom)}</h1>
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
${p.logiciels?.length ? `<h2>Les logiciels de l'activité</h2>${liste(p.logiciels.map((id) => `<li>${lien(logParId.get(id).nom, urlLogiciel.get(id))}</li>`))}` : ''}
<h2>Les postes pour votre activité</h2>${puces(transversaux.map((f) => lien(f.nom, urlPosteActivite(f, a))))}`,
  }));
}

// Each page joins what the fiche says about the job and what the activity's
// pack says about the trade: its vocabulary, documents, rules, and the
// activity's software the job actually works in (same family as one of its
// tasks), which then goes into the title: "… pour imprimerie, sur Masterprint".
for (const a of activites) {
  const p = a.pack ?? {};
  for (const f of transversaux) {
    const url = reserver(urlPosteActivite(f, a), `${f.id}×${a.id}`);
    const familles = new Set(f.taches.flatMap((t) => t.logiciels ?? []));
    const outils = (p.logiciels ?? []).map((id) => logParId.get(id)).filter((l) => familles.has(l.categorie));
    const sur = outils.length ? `, sur ${outils.map((l) => l.nom).join(' ou ')}` : '';
    const activite = a.nom.toLowerCase();
    pages.set(url, page({
      url,
      titre: `${f.nom} pour ${activite}${sur}`,
      description: `${f.nom} pour ${activite}${sur}. ${f.accroche} ${a.trait}`,
      fil: [[a.nom, urlActivite.get(a.id)], [f.nom, urlFiche.get(f.id)]],
      portrait: portraitDe(f),
      corps: `<h1>Un agent ${echapper(f.nom.toLowerCase())} pour ${echapper(activite)}${echapper(sur)}</h1>
<p class="accroche">${echapper(f.accroche)}</p>
<div class="carte"><p>${echapper(a.trait)}</p><p>Il reçoit le savoir de votre activité en plus de son métier : son vocabulaire, ses documents, ses règles et ses logiciels.</p></div>
<h2>Ce qu'il fait chaque jour</h2>
${liste(f.taches.map((t) => `<li><strong>${echapper(t.nom)}</strong> : ${echapper(t.description)}</li>`))}
${outils.length ? `<h2>Les logiciels de votre activité qu'il tient</h2>${liste(outils.map((l) => `<li>${lien(l.nom, urlLogiciel.get(l.id))}${l.editeur ? `, de ${echapper(l.editeur)}` : ''}</li>`))}` : ''}
${p.vocabulaire?.length ? `<h2>Le vocabulaire qu'il connaît</h2>${liste(p.vocabulaire.map((v) => `<li><strong>${echapper(v.terme)}</strong> : ${echapper(v.sens)}</li>`))}` : ''}
${p.documents?.length ? `<h2>Les documents qu'il manie</h2>${liste(p.documents.map((d) => `<li><strong>${echapper(d.nom)}</strong> : ${echapper(d.role)}</li>`))}` : ''}
${p.regles?.length ? `<h2>Les règles qu'il respecte</h2>${liste(p.regles.map((r) => `<li>${echapper(r)}</li>`))}` : ''}`,
    }));
  }
}

// --- checks, then write ---------------------------------------------------
const cibles = new Set(pages.keys());
const HORS_SEO = new Set(['/', '/catalogue', '/puce-cerveau.png', '/seo.css', ...PAGES_OFFRE.map((p) => `/${p.nom}`)]);
for (const [url, html] of pages) {
  for (const [, href] of html.matchAll(/href="(\/[^"]*)"/g)) {
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

// The offer pages of max's site plan (07/10) are built by Vite, listed here.
const urls = ['/', '/catalogue', ...PAGES_OFFRE.map((p) => `/${p.nom}`), ...pages.keys()];
const lots = [];
for (let i = 0; i < urls.length; i += MAX_URLS_PAR_SITEMAP) lots.push(urls.slice(i, i + MAX_URLS_PAR_SITEMAP));
lots.forEach((lot, i) => writeFileSync(join(SORTIE, `sitemap-${i + 1}.xml`),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lot.map((u) => `<url><loc>${SITE}${u}</loc></url>`).join('\n')}\n</urlset>\n`));
writeFileSync(join(SORTIE, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lots.map((_, i) => `<sitemap><loc>${SITE}/sitemap-${i + 1}.xml</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`);
writeFileSync(join(SORTIE, 'seo.css'), STYLE.trim() + '\n');
writeFileSync(join(SORTIE, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);

const compte = (prefixe) => [...pages.keys()].filter((u) => u.startsWith(prefixe)).length;
const postesLogiciels = [...pages.keys()].filter((u) => u.startsWith('/agents/') && u.split('/').length === 4).length;
const postesActivites = [...pages.keys()].filter((u) => u.startsWith('/activites/') && u.split('/').length === 4).length;
console.log(`pages : ${fiches.length} postes, ${compte('/activites/') - postesActivites} activités, ${compte('/logiciels/')} logiciels, ${postesLogiciels} poste × logiciel, ${postesActivites} poste × activité — ${pages.size} en tout, ${lots.length} sitemap(s)`);
