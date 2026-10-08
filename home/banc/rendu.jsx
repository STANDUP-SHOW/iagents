/**
 * Banc du site iAgent Home, à la manière de frontend/banc/rendu.jsx.
 *
 * Une construction verte ne prouve pas qu'une page s'affiche : on rend
 * vraiment chaque page en SSR, avec ses balises de tête, et on vérifie ce
 * qu'elle dit. Et surtout : aucun prix n'est écrit dans un composant (MASTER
 * §1). Le seul endroit qui connaît un prix est src/tarifs.js, qui lit
 * plateforme/tarifs/plans.json ou, à défaut, src/tarifs-home.provisoire.json.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rendre, PAGES, PAGE_404, sitemapXml, robotsTxt } from '../src/serveur.jsx';
import { NAVIGATION, FONCTIONS, POLITIQUE, NIVEAUX, PROMESSE, BUSINESS, SITE } from '../src/contenu.js';
import { PLANS, HYPOTHESES, PROVISOIRE, ORIGINE, IDS_HOME, lirePlans, montant } from '../src/tarifs.js';

const ICI = join(dirname(fileURLToPath(import.meta.url)), '..', '..'); // home/ (the bench runs from banc/dist)
const RACINE = join(ICI, '..');
let n = 0;
const ok = (m) => { n++; console.log('  ok  ' + m); };
const echoue = (m) => { console.error('  ✗   ' + m); process.exitCode = 1; };
const verifier = (vrai, bien, mal) => (vrai ? ok(bien) : echoue(mal));

// Text as a reader sees it: tags removed, entities and React's <!-- --> gone.
const texte = (html) => html
  .replace(/<!-- -->/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
  .replace(/[ \t\r\n]+/g, ' '); // not \s: it would eat the non-breaking spaces of prices

// ---------------------------------------------------------------------------
// 1. No amount in euros written by hand in the site's code.
//    The detector first proves it still sees what it must see.
const MONTANT = /\d[\d   .,]*\s*(?:€|&euro;|\\u20ac|euros?\b|EUR\b)|(?:€|&euro;)\s*\d/i;
{
  const doitVoir = ['49 €', '129€', '149–169 €', '79 euros', '9,90 €', '€49', '1 299 EUR', '49&euro;', '49\\u00a0€'];
  const doitIgnorer = ['`${corps}${INSECABLE}€`', 'prix en €', 'TTC/mois', '11 domaines'];
  const rates = doitVoir.filter((s) => !MONTANT.test(s));
  const faux = doitIgnorer.filter((s) => MONTANT.test(s));
  verifier(!rates.length && !faux.length, 'le détecteur de montants voit « 49 € », « 79 euros », « €49 »… et laisse passer « TTC/mois »',
    `détecteur de montants cassé : manque ${rates.join(' | ')} ; voit à tort ${faux.join(' | ')}`);

  const fichiers = [];
  const parcourir = (d) => readdirSync(d).forEach((x) => {
    const f = join(d, x);
    if (statSync(f).isDirectory()) parcourir(f);
    else if (/\.(jsx?|mjs|css|html)$/.test(x)) fichiers.push(f);
  });
  parcourir(join(ICI, 'src'));
  fichiers.push(join(ICI, 'index.html'));
  const fautes = [];
  for (const f of fichiers) {
    readFileSync(f, 'utf8').split('\n').forEach((ligne, i) => {
      if (MONTANT.test(ligne)) fautes.push(`${relative(ICI, f)}:${i + 1} « ${ligne.trim().slice(0, 80)} »`);
    });
  }
  verifier(!fautes.length, `aucun montant en € écrit dans les ${fichiers.length} fichiers de code du site`,
    `montant écrit en dur (les prix viennent de src/tarifs.js) : ${fautes.join(' ; ')}`);
}

// ---------------------------------------------------------------------------
// 2. Prices come from the right file, and are TTC.
{
  const officiel = existsSync(join(RACINE, 'plateforme', 'tarifs', 'plans.json'));
  verifier(PROVISOIRE === !officiel, `prix lus dans ${ORIGINE}${PROVISOIRE ? ' (provisoire : plateforme/tarifs/plans.json absent)' : ''}`,
    `src/tarifs.js lit ${ORIGINE} alors que plans.json ${officiel ? 'existe' : 'n’existe pas'}`);
  verifier(PLANS.length === 4 && PLANS.every((p, i) => p.id === IDS_HOME[i] && p.prix > 0), 'quatre plans Home avec un prix : ' + PLANS.map((p) => `${p.nom} ${montant(p)}`).join(', '),
    `plans Home lus : ${PLANS.map((p) => p.id).join(', ')}`);

  const plan = (x) => ({ plan_id: 'home-digital', nom: 'D', description: '', currency: 'EUR', billing_period: 'mois', base_price: 1, base_price_max: null, effective_from: '2026-01-01', effective_to: null, public_visibility: true, region: 'FR', tax_mode: 'TTC', legacy_flag: false, ...x });
  const quatre = (x = {}) => IDS_HOME.map((id) => plan({ plan_id: id, ...x }));
  const refuse = (donnees, attendu) => { try { lirePlans(donnees, 'essai', new Date('2026-10-07')); return false; } catch (e) { return e.message.includes(attendu); } };
  verifier(refuse({ plans: quatre({ tax_mode: 'HT' }) }, 'TTC'), 'un plan Home en HT est refusé, en le disant', 'un plan HT passerait sur un site qui affiche du TTC');
  verifier(refuse({ plans: quatre().slice(1) }, 'home-digital'), 'un plan Home manquant est refusé, en le nommant', 'un plan manquant passerait');
  verifier(refuse({ plans: quatre({ effective_from: '2027-01-01' }) }, 'en vigueur'), 'un prix pas encore en vigueur n’est pas affiché', 'un prix futur serait affiché');
  verifier(refuse({ plans: quatre({ base_price: null }) }, 'pas de prix'), 'un plan « sur devis » est refusé plutôt qu’affiché vide', 'un plan sans prix passerait');
  const versions = lirePlans({ plans: [...quatre(), plan({ base_price: 2, effective_from: '2026-06-01' }), plan({ base_price: 3, legacy_flag: true, effective_from: '2026-09-01' })] }, 'essai', new Date('2026-10-07'));
  verifier(versions[0].prix === 2, 'entre deux versions, la plus récente en vigueur et non masquée l’emporte', `version retenue : ${versions[0].prix}`);
  const sansDrapeau = lirePlans({ plans: quatre() }, 'essai', new Date('2026-10-07'));
  verifier(sansDrapeau.every((p) => !p.hypothese), 'sans drapeau dans le fichier, aucun prix n’est dit « hypothèse »', 'un prix serait dit hypothèse sans que le fichier le dise');
}

// ---------------------------------------------------------------------------
// 3. Every page renders, with its head, its single h1 and the navigation.
const rendus = new Map();
for (const page of [...PAGES, PAGE_404]) {
  try {
    const r = rendre(page.chemin);
    rendus.set(page.chemin, r);
    const fautes = [];
    if ((r.html.match(/<h1[\s>]/g) ?? []).length !== 1) fautes.push('pas exactement un h1');
    if (!r.tete.includes(`<title>`) || page.titre.length > 75 || page.titre.length < 20) fautes.push(`titre de ${page.titre.length} caractères`);
    if (page.description.length < 70 || page.description.length > 165) fautes.push(`description de ${page.description.length} caractères`);
    for (const og of ['og:title', 'og:description', 'og:url', 'og:image', 'og:locale', 'twitter:card']) if (!r.tete.includes(`"${og}"`)) fautes.push(`balise ${og} absente`);
    if (!page.horsPlan && !r.tete.includes(`rel="canonical" href="${SITE}`)) fautes.push('pas d’adresse canonique');
    for (const l of NAVIGATION) if (!r.html.includes(`href="${l.chemin}"`)) fautes.push(`lien « ${l.libelle} » absent`);
    if (!r.html.includes(`href="${BUSINESS}"`)) fautes.push('lien vers iAgent Business absent');
    if (!page.horsPlan && !r.html.includes(`href="${page.chemin}" aria-current="page"`)) fautes.push('la navigation ne marque pas la page courante');
    if (!r.html.includes('href="#contenu"')) fautes.push('pas de lien d’évitement');
    const sansAlt = (r.html.match(/<img(?![^>]*\balt=)[^>]*>/g) ?? []).length;
    if (sansAlt) fautes.push(`${sansAlt} image(s) sans alt`);
    verifier(!fautes.length, `${page.chemin} se rend : un h1, titre, description, Open Graph, navigation`, `${page.chemin} : ${fautes.join(', ')}`);
  } catch (e) {
    echoue(`${page.chemin} ne se rend pas : ${e.message}`);
  }
}
{
  const titres = new Set(PAGES.map((p) => p.titre));
  const desc = new Set(PAGES.map((p) => p.description));
  verifier(titres.size === PAGES.length && desc.size === PAGES.length, 'chaque page a son titre et sa description propres', 'deux pages partagent un titre ou une description');
  const libelles = NAVIGATION.map((l) => l.libelle).join(' · ');
  verifier(libelles === 'Home · Ce qu’il fait · Box Home · Tarifs · Sécurité · Aide', `navigation du MASTER : ${libelles}`, `navigation : ${libelles}`);
  const modele = readFileSync(join(ICI, 'index.html'), 'utf8');
  verifier(/<html lang="fr">/.test(modele) && modele.includes('width=device-width'), 'page en français, réglée pour le téléphone', 'index.html sans lang="fr" ou sans viewport');
}

// ---------------------------------------------------------------------------
// 4. What the pages say.
const lu = (chemin) => texte(rendus.get(chemin)?.html ?? '');
{
  verifier(lu('/').includes(PROMESSE), 'la promesse Home est sur l’accueil', 'la promesse Home manque à l’accueil');

  const absentes = FONCTIONS.filter((f) => !lu('/ce-qu-il-fait').includes(f.titre));
  verifier(FONCTIONS.length === 11 && !absentes.length, 'les onze fonctions du §13 sont sur « Ce qu’il fait »', `fonctions absentes : ${absentes.map((f) => f.titre).join(', ')}`);

  // Policy table: the MASTER's levels, row by row, read in the rendered table.
  const attendu = { 'Lire et classer une facture': 'Autonome', 'Préparer une réponse': 'Autonome', 'Envoyer un courrier important': 'Confirmation', 'Payer une facture': 'Confirmation forte', 'Modifier ou résilier un contrat': 'Confirmation forte', 'Prendre un rendez-vous': 'Selon votre règle' };
  for (const chemin of ['/', '/ce-qu-il-fait', '/securite']) {
    const html = rendus.get(chemin).html;
    const lignes = [...html.matchAll(/<tr><th scope="row">([^<]+)<\/th><td><span class="niveau niveau-(\w+)">([^<]+)<\/span><\/td><\/tr>/g)].map((m) => [m[1].replace(/&#x27;/g, '\''), m[3]]);
    const faux = Object.entries(attendu).filter(([a, niv]) => !lignes.some(([x, y]) => x === a && y === niv));
    verifier(lignes.length === 6 && !faux.length, `${chemin} : politique d’action conforme (payer et résilier = confirmation forte)`, `${chemin} : politique d’action fausse ou absente pour ${faux.map(([a]) => a).join(', ')}`);
  }
  verifier(POLITIQUE.every((l) => NIVEAUX[l.niveau]), 'chaque action a un niveau connu', 'une action a un niveau inconnu');

  const box = lu('/box-home');
  verifier(/louée/.test(box) && /propriété d’iAgent/.test(box) && /blanc/.test(box) && !/\b(achetez|acheter|à vendre)\b/i.test(box), 'la Box Home est présentée blanche et louée, propriété d’iAgent', 'la page Box Home ne la présente pas comme louée');
}

// ---------------------------------------------------------------------------
// 5. Prices on the pages are exactly the file's, all TTC, and called
//    hypotheses only when the file says so.
{
  const tarifs = lu('/tarifs');
  const manquent = PLANS.filter((p) => !tarifs.includes(montant(p)));
  verifier(!manquent.length, 'la page Tarifs affiche les quatre prix du fichier', `prix absents de Tarifs : ${manquent.map((p) => p.id).join(', ')}`);
  const unites = (rendus.get('/tarifs').html.match(/TTC\/<!-- -->mois|TTC\/mois/g) ?? []).length;
  verifier(unites >= PLANS.length, 'chaque prix est dit TTC/mois', `${unites} mentions TTC/mois pour ${PLANS.length} prix`);
  const connus = new Set(PLANS.map(montant));
  const etrangers = [];
  for (const [chemin, r] of rendus) {
    for (const m of texte(r.html).matchAll(/(?:à partir de )?\d[\d   ]*(?:–\d[\d   ]*)? ?€/g)) {
      const v = m[0].trim();
      if (![...connus].some((c) => c.endsWith(v) || v.endsWith(c))) etrangers.push(`${chemin} : « ${v} »`);
    }
  }
  verifier(!etrangers.length, 'aucun montant affiché qui ne vienne du fichier de tarifs', `montants inconnus du fichier : ${etrangers.join(' ; ')}`);
  const dit = /hypothèses de lancement/.test(tarifs);
  verifier(dit === HYPOTHESES, HYPOTHESES ? 'le fichier dit « hypothèses de lancement », la page aussi' : 'le fichier ne dit pas « hypothèse », la page non plus',
    `la page ${dit ? 'dit' : 'ne dit pas'} « hypothèses de lancement » alors que le fichier ${HYPOTHESES ? 'le dit' : 'ne le dit pas'}`);
}

// ---------------------------------------------------------------------------
// 6. Nothing invented: no head-count of customers, no testimonial.
{
  const fautes = [];
  for (const [chemin, r] of rendus) {
    const t = texte(r.html);
    const m = t.match(/\d[\d   .]*\s*(?:foyers|familles|clients|utilisateurs|abonnés|avis|étoiles)|\d+\s*%\s*(?:de temps|des foyers|de satisfaction)|témoign|★/i);
    if (m) fautes.push(`${chemin} : « ${m[0]} »`);
  }
  verifier(!fautes.length, 'aucune métrique de clientèle ni témoignage inventés', `chiffre ou témoignage invérifiable : ${fautes.join(' ; ')}`);
}

// ---------------------------------------------------------------------------
// 7. Sitemap and robots, from the same list.
{
  const xml = sitemapXml([...PAGES, PAGE_404], '2026-10-07');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  verifier(locs.length === PAGES.length && PAGES.every((p) => locs.includes(SITE + (p.chemin === '/' ? '/' : p.chemin))) && !locs.some((l) => l.includes('404')),
    `sitemap.xml : les ${PAGES.length} pages sur ${SITE}, pas la 404`, `sitemap.xml : ${locs.join(', ')}`);
  verifier(robotsTxt().includes(`Sitemap: ${SITE}/sitemap.xml`), 'robots.txt désigne le sitemap', 'robots.txt ne désigne pas le sitemap');
}

// ---------------------------------------------------------------------------
// 8. Accessibility of the palette: WCAG AA contrast of every text pair, and a
//    visible focus. Colours are read in the stylesheet, not recopied.
{
  const css = readFileSync(join(ICI, 'src', 'styles.css'), 'utf8');
  const v = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const paires = [
    ['encre', 'perle'], ['encre-douce', 'perle'], ['encre-douce', 'perle-2'], ['encre-douce', 'blanc'], ['marine', 'blanc'], ['blanc', 'marine'], ['marine', 'perle-2'],
  ].map(([t, f]) => [`${t} sur ${f}`, v[t], v[f]]);
  for (const niv of Object.keys(NIVEAUX)) {
    const m = css.match(new RegExp(`\\.niveau-${niv} \\{ background: (#[0-9A-Fa-f]{6}); color: (#[0-9A-Fa-f]{6}); \\}`));
    paires.push([`badge ${niv}`, m?.[2], m?.[1]]);
  }
  const faibles = paires.filter(([, t, f]) => !t || !f || ratio(t, f) < 4.5).map(([nom, t, f]) => `${nom} ${t && f ? ratio(t, f).toFixed(2) : 'introuvable'}`);
  verifier(!faibles.length, `contrastes AA tenus sur ${paires.length} paires de couleurs (min ${Math.min(...paires.map(([, t, f]) => ratio(t, f))).toFixed(1)}:1)`, `contraste insuffisant : ${faibles.join(', ')}`);
  verifier(/:focus-visible\s*\{[^}]*outline:\s*3px solid/.test(css), 'focus visible : contour de 3 px', 'aucun focus visible déclaré');
  verifier(!/#0[0-9A-F]{5}\b.*body|background:\s*#0/.test(css) && /background: var\(--perle\)/.test(css), 'fond perle, pas de fond sombre', 'le site reprend un fond sombre');
}

console.log(`\n${n} attentes tenues — site Home ${process.exitCode ? 'EN FAUTE' : 'ok'}`);
