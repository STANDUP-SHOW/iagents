/**
 * Banc du back-office, rendu côté serveur sans rien installer de plus.
 *
 * Same lesson as frontend/banc/rendu.jsx: `vite build` does not see a
 * variable that does not exist, so every screen is really rendered here, with
 * platform answers injected through the REAL client (a fake fetch stands in
 * for the network). An undefined variable throws in renderToString and fails
 * the bench; so does « undefined », « NaN » or « [object Object] » in the HTML.
 *
 * Then the guards, each one failing if its rule is undone:
 *  - a platform error is shown verbatim, never as a success;
 *  - the token is never rendered nor stored in the browser;
 *  - only `admin` and `public` routes of docs/master/routes.md are callable;
 *  - the web build is noindex;
 *  - the charte gradient is the one of desktop/src/charte.css;
 *  - JS and Rust read addresses and answers the same way (temoins/).
 */
import { renderToString } from 'react-dom/server';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import Administration, { ECRANS } from '../src/Administration.jsx';
import App, { Connexion } from '../src/App.jsx';
import { creerClientWeb, executer, interpreter, adresseRecevable, ErreurPlateforme } from '../src/api.js';
import { ROUTES, chemin } from '../src/routes.js';
import { Resultat, lireJson } from '../src/composants.jsx';
import { corpsNouvelleVersion, etatVersion } from '../src/ecrans/Plans.jsx';
import { corpsDevis } from '../src/ecrans/Devis.jsx';
import { corpsProfil } from '../src/ecrans/Personas.jsx';
import { DECISIONS } from '../src/ecrans/Skills.jsx';
import { reponsesDeBanc, JETON_DE_BANC, plans, etude, boxes, opportunites } from './donnees-de-banc.mjs';
import temoinsAdresses from '../temoins/adresses.json';
import temoinsReponses from '../temoins/reponses.json';

const ici = (p) => fileURLToPath(new URL(p, import.meta.url));
// The SSR build lands in banc/dist/, so the back-office root is two levels up.
const RACINE = ici('../../');
const DEPOT = join(RACINE, '..');

let n = 0;
let fautes = 0;
const ok = (m) => { n++; console.log('  ok  ' + m); };
const echoue = (m) => { fautes++; console.error('  ✗   ' + m); };
const verifier = (vrai, m, sinon) => (vrai ? ok(m) : echoue(sinon ?? m));

// ---- a fake network that answers like the platform ------------------------
function fauxFetch(table) {
  const appels = [];
  const f = async (url, init = {}) => {
    const u = new URL(url, 'http://banc');
    const cle = `${init.method ?? 'GET'} ${u.pathname.replace(/^\/plateforme/, '')}`;
    appels.push({ cle, init });
    const r = typeof table === 'function' ? table(cle, init) : (cle in table ? { statut: 200, corps: table[cle] } : { statut: 404, corps: { erreur: "Cette adresse n'existe pas." } });
    const texte = typeof r.texte === 'string' ? r.texte : JSON.stringify(r.corps);
    return { status: r.statut, ok: r.statut >= 200 && r.statut < 300, text: async () => texte };
  };
  f.appels = appels;
  return f;
}

/** Runs each read of a screen through the real client and keeps the outcome by path. */
async function precharger(client, lectures) {
  const initial = {};
  for (const [nom, options] of lectures) {
    const r = await executer(client.appeler(nom, options));
    initial[chemin(nom, options.params, options.query).chemin] = r.ok ? { donnees: r.corps } : { erreur: r.erreur, plateforme: r.plateforme };
  }
  return initial;
}

const texteDe = (html) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ');

function rendre(quoi, element) {
  try {
    const html = renderToString(element);
    const texte = texteDe(html);
    for (const poison of ['undefined', 'NaN', '[object Object]']) {
      if (texte.includes(poison)) { echoue(`${quoi} : « ${poison} » à l'écran`); return null; }
    }
    return { html, texte };
  } catch (e) {
    echoue(`${quoi} ne se rend pas : ${e && e.message}`);
    return null;
  }
}

const clientBanc = (table) => creerClientWeb({ adresse: '/plateforme', jeton: JETON_DE_BANC, fetch: fauxFetch(table), stockage: null });

// What each screen must show from the bench answers: its proof of reading them.
const ATTENDU = {
  plans: ['agent-essential', 'masqué', 'legacy', 'ancienne', 'à venir', 'sur devis', 'BE', 'Aucune route de remise'],
  boxes: ['IAB-2026-0001', 'Boulangerie Martin (banc)', 'suspendue', 'en stock', 'échue le', 'CPU 23', 'jamais remontée'],
  licences: ['ent-0001', 'AG-0179', 'revoquee', 'Révoquer', 'Cabinet Roux Avocats (banc)'],
  voix: ['+33187650001', 'telnyx', 'transfere-humain', '0,16', 'Commande de 3 baguettes', 'GET /voix/fournisseurs'],
  catalogue: ['182 490', '1 249', 'GET /controle/catalogue'],
  personas: ['Profil de voix', 'GET /voix/profils', 'PUT /voix/profils/:id'],
  skills: ['SP-relances-factures', 'en-revue', 'Valider', 'Rejeter', 'Retirer', 'non signé', 'LOG-0012'],
  opportunites: ['Accueil téléphonique des boulangeries', 'brouillon', 'Publier', 'Générer les brouillons du jour', '82'],
  etudes: ['Nouvelle étude', 'GET /create/projets', 'Secrétariat juridique'],
  devis: ['Aucune route de demande de devis', 'POST /devis/demandes', 'Agent Essential', 'Chiffrer'],
  audit: ['entitlement.revoquer', 'impayé de septembre', 'BOX-7F3A', 'muette depuis', 'GET /controle/telemetrie'],
};

console.log('Écrans, avec les réponses de banc');
for (const e of ECRANS) {
  const client = clientBanc(reponsesDeBanc());
  const initial = await precharger(client, e.lectures);
  const r = rendre(`écran « ${e.titre} »`, <Administration client={client} initial={initial} ecranInitial={e.id} />);
  if (!r) continue;
  const manquants = (ATTENDU[e.id] ?? []).filter((m) => !r.texte.includes(m));
  verifier(!manquants.length, `« ${e.titre} » se rend avec ses données (${(ATTENDU[e.id] ?? []).length} repères)`, `« ${e.titre} » : absent de l'écran → ${manquants.join(' | ')}`);
  verifier(!r.texte.includes('Lecture en cours'), `« ${e.titre} » n'attend aucune lecture non injectée`, `« ${e.titre} » attend une lecture que le banc n'a pas fournie (lectures incomplètes)`);
}
verifier(Object.keys(ATTENDU).length === ECRANS.length && ECRANS.every((e) => ATTENDU[e.id]), `les ${ECRANS.length} écrans ont leurs repères`, 'un écran n’a pas de repères dans le banc');

console.log('\nÉtats ouverts (formulaires, fiches, relectures)');
{
  const client = clientBanc(reponsesDeBanc());
  const cas = [
    ['plans', { versionInitiale: 'agent-essential' }, ['Nouvelle version de agent-essential', 'rien n\'est écrasé', 'Enregistrer la version']],
    ['plans', { versionInitiale: '' }, ['Nouveau plan : sa première version']],
    ['boxes', { boxInitiale: boxes[0].device_id }, [`Fiche de la Box ${boxes[0].device_id}`, 'clé publique Ed25519 enregistrée', 'box-commander-36']],
    ['opportunites', { ouverteInitiale: opportunites[0].id }, ['Relecture : Accueil téléphonique', 'Pénurie de vendeurs le matin']],
    ['etudes', { etudeInitiale: etude.id }, [`Étude ${etude.id}`, 'ambitieux', '61 000', 'seuil rentabilite mois']],
  ];
  for (const [id, props, attendus] of cas) {
    const e = ECRANS.find((x) => x.id === id);
    const lectures = [...e.lectures];
    if (props.boxInitiale) lectures.push(['box', { params: { id: props.boxInitiale } }]);
    if (props.etudeInitiale) lectures.push(['etude', { params: { id: props.etudeInitiale } }]);
    const initial = await precharger(client, lectures);
    const r = rendre(`${id} ${JSON.stringify(props)}`, <Administration client={client} initial={initial} ecranInitial={id} propsEcran={props} />);
    if (!r) continue;
    const manquants = attendus.filter((m) => !r.texte.includes(m));
    verifier(!manquants.length, `${id} ${JSON.stringify(props)} se rend`, `${id} ${JSON.stringify(props)} : absent → ${manquants.join(' | ')}`);
  }
}

console.log('\nUne erreur de la plateforme s’affiche telle quelle');
{
  const PHRASE = 'Accès réservé au back-office.';
  for (const e of ECRANS.filter((x) => x.lectures.length)) {
    const client = clientBanc(() => ({ statut: 401, corps: { erreur: PHRASE } }));
    const initial = await precharger(client, e.lectures);
    const r = rendre(`« ${e.titre} » refusé`, <Administration client={client} initial={initial} ecranInitial={e.id} />);
    if (!r) continue;
    verifier(r.texte.includes(`La plateforme refuse : ${PHRASE}`) && !r.texte.includes('La plateforme a enregistré'),
      `« ${e.titre} » montre le refus mot pour mot`, `« ${e.titre} » ne montre pas « ${PHRASE} » tel quel`);
    // No row of the bench data may appear when the platform refused: nothing stale, nothing invented.
    verifier(!/IAB-2026|ent-0001|SP-relances|agent-essential|opp-2026|aud-1|\+3318765/.test(r.texte), `« ${e.titre} » n'affiche aucune donnée après un refus`);
  }
  const client = clientBanc(() => ({ statut: 200, corps: { erreur: 'Refus rendu avec un statut 200.' } }));
  const initial = await precharger(client, ECRANS[0].lectures);
  const r = rendre('refus en 200', <Administration client={client} initial={initial} ecranInitial="plans" />);
  verifier(r && r.texte.includes('Refus rendu avec un statut 200.'), 'un corps « erreur » sous un statut 200 reste une erreur');

  const fait = rendre('résultat erreur', <Resultat etat={{ statut: 'erreur', erreur: "Aucune clé Telnyx n'est posée (TELNYX_API_KEY).", plateforme: true }} />);
  verifier(fait && fait.texte.includes("La plateforme refuse : Aucune clé Telnyx n'est posée (TELNYX_API_KEY).") && !fait.texte.includes('enregistré'), 'une action refusée montre la phrase, pas un succès');
  const local = rendre('résultat local', <Resultat etat={{ statut: 'erreur', erreur: 'Le contenu n’est pas du JSON lisible.', plateforme: false }} />);
  verifier(local && local.texte.includes("Rien n'est parti") && !local.texte.includes('La plateforme refuse'), "un refus du formulaire ne se fait pas passer pour un refus de la plateforme");
  const reussi = rendre('résultat fait', <Resultat etat={{ statut: 'fait', corps: { plan_id: 'x' } }} succes={(c) => `plan ${c.plan_id}`} />);
  verifier(reussi && reussi.texte.includes('La plateforme a enregistré : plan x'), 'un succès dit ce que la plateforme a rendu');

  // The client itself, on each kind of answer.
  const c400 = clientBanc(() => ({ statut: 400, corps: { erreur: 'Le statut « perdu » n’existe pas.' } }));
  const r400 = await executer(c400.appeler('statutBox', { params: { id: 'BOX-1' }, corps: { statut: 'perdu', motif: 'x' } }));
  verifier(!r400.ok && r400.erreur === 'Le statut « perdu » n’existe pas.' && r400.plateforme === true, 'executer rend la phrase exacte de la plateforme');
  const cReseau = creerClientWeb({ adresse: 'http://127.0.0.1:9', jeton: 'x', fetch: async () => { throw new Error('ECONNREFUSED'); }, stockage: null });
  const rReseau = await executer(cReseau.appeler('boxes'));
  verifier(!rReseau.ok && /ne répond pas/.test(rReseau.erreur) && !rReseau.erreur.includes('Bearer'), 'une plateforme injoignable est dite, sans le jeton');
  const rLocal = await executer(Promise.resolve().then(() => lireJson('{ pas du json', 'Le Skill Pack')));
  verifier(!rLocal.ok && rLocal.plateforme === false && rLocal.erreur.startsWith("Le Skill Pack n'est pas du JSON lisible"), 'un JSON illisible est refusé avant tout envoi');
  const sansJeton = creerClientWeb({ adresse: '/plateforme', jeton: '', fetch: fauxFetch({}), stockage: null });
  const rSans = await executer(sansJeton.appeler('boxes'));
  verifier(!rSans.ok && rSans.plateforme === false, 'sans jeton, rien ne part');
}

console.log('\nLes formulaires construisent ce que le contrat attend');
{
  const source = plans.find((p) => p.plan_id === 'agent-essential' && !p.effective_to);
  const corps = corpsNouvelleVersion(source, { base_price: '31,5', effective_from: '2026-12-01' });
  verifier(corps.base_price === 31.5 && corps.effective_to === null && corps.plan_id === 'agent-essential' && corps.region === 'FR', 'une nouvelle version garde le plan, change le prix, n’a pas de fin');
  verifier(source.base_price === 29 && source.effective_to === null, 'la version source n’est pas modifiée en mémoire');
  let refuse = '';
  try { corpsNouvelleVersion(source, { effective_from: '' }); } catch (e) { refuse = e.message; }
  verifier(refuse.includes("date d'effet"), 'une version sans date d’effet est refusée avant envoi');
  verifier(etatVersion({ effective_from: '2026-06-01', effective_to: '2026-10-01' }, '2026-10-07').libelle === 'ancienne'
    && etatVersion({ effective_from: '2026-11-01', effective_to: null }, '2026-10-07').libelle === 'à venir'
    && etatVersion({ effective_from: '2026-10-01', effective_to: null }, '2026-10-07').libelle === 'en vigueur', 'ancienne, à venir, en vigueur');
  const d = corpsDevis([{ plan_id: 'agent-essential', quantite: '3' }, { plan_id: '', quantite: 1 }], 'FR', '2026-10-07');
  verifier(d.lignes.length === 1 && d.lignes[0].quantite === 3 && d.region === 'FR', 'le devis porte {lignes:[{plan_id, quantite}], region, date}');
  const p = corpsProfil({ id: 'vp-julie', persona_id: '', locale: 'fr-FR', palier: 'standard', ordre_de_repli: 'gemini-live, local', voix_par_moteur: '{"local":"siwis"}' });
  verifier(p.persona_id === null && p.ordre_de_repli.length === 2 && p.voix_par_moteur.local === 'siwis', 'le profil de voix a la forme de VoiceProfile');
  verifier(DECISIONS['en-revue'].some(([d2]) => d2 === 'valide') && DECISIONS.valide.some(([d2]) => d2 === 'retire') && DECISIONS.candidat.some(([d2]) => d2 === 'en-revue'),
    'la revue propose en-revue, valider, rejeter, retirer');
}

console.log('\nLe jeton');
{
  const stock = new Map();
  const faux = { getItem: (k) => stock.get(k) ?? null, setItem: (k, v) => stock.set(k, String(v)), removeItem: (k) => stock.delete(k) };
  const client = creerClientWeb({ fetch: fauxFetch(reponsesDeBanc()), stockage: faux });
  await client.adresse.poser('http://127.0.0.1:8787');
  await client.jeton.poser(JETON_DE_BANC);
  verifier([...stock.values()].every((v) => !v.includes(JETON_DE_BANC)), 'le client web ne range le jeton dans aucun stockage du navigateur');
  verifier(await client.jeton.present(), 'le jeton posé est présent pour la page');
  const f = fauxFetch(reponsesDeBanc());
  const c2 = creerClientWeb({ adresse: '/plateforme', jeton: JETON_DE_BANC, fetch: f, stockage: null });
  await c2.appeler('boxes');
  verifier(f.appels[0].init.headers.authorization === `Bearer ${JETON_DE_BANC}`, 'le jeton part en Bearer vers la plateforme');
  const initial = await precharger(c2, ECRANS[1].lectures);
  const app = rendre('application connectée', <App client={c2} etatInitial={{ adresse: '/plateforme', connecte: true }} initial={initial} ecranInitial="boxes" />);
  verifier(app && !app.html.includes(JETON_DE_BANC) && app.texte.includes('Jeton posé (jamais affiché)'), 'une fois saisi, le jeton n’apparaît nulle part à l’écran');
  const cx = rendre('connexion', <Connexion client={c2} adresseDepart="https://plateforme.exemple.fr" onConnecte={() => {}} />);
  verifier(cx && /type="password"/.test(cx.html) && !cx.html.includes(JETON_DE_BANC), 'la saisie du jeton est masquée et vide');
  const sources = [];
  const parcourir = (d) => { for (const x of readdirSync(d)) { const p = join(d, x); if (statSync(p).isDirectory()) parcourir(p); else if (/\.(jsx?|html)$/.test(x)) sources.push(p); } };
  parcourir(join(RACINE, 'src'));
  sources.push(join(RACINE, 'index.html'));
  const fautifs = sources.filter((p) => /sessionStorage|document\.cookie|localStorage\.setItem\([^)]*jeton/i.test(readFileSync(p, 'utf8')));
  verifier(!fautifs.length, 'aucun écran ne range le jeton dans le navigateur (sessionStorage, cookie)', `stockage du jeton dans ${fautifs.join(', ')}`);
}

console.log('\nRoutes : admin et public de docs/master/routes.md, rien d’autre');
{
  const contrat = new Map();
  for (const ligne of readFileSync(join(DEPOT, 'docs/master/routes.md'), 'utf8').split('\n')) {
    const m = ligne.match(/^\|\s*(GET|POST|PUT|DELETE)\s*\|\s*(\/[^\s|]+)\s*\|\s*(public|admin|box)\s*\|/);
    if (m) contrat.set(`${m[1]} ${m[2]}`, m[3]);
  }
  verifier(contrat.size > 40, `${contrat.size} routes lues dans le contrat`);
  const horsContrat = Object.entries(ROUTES).filter(([, [methode, p]]) => !['admin', 'public'].includes(contrat.get(`${methode} ${p}`)));
  verifier(!horsContrat.length, `les ${Object.keys(ROUTES).length} routes du back-office sont au contrat, en admin ou public`,
    `hors contrat ou hors admin/public : ${horsContrat.map(([nom, [m, p]]) => `${nom} (${m} ${p} : ${contrat.get(`${m} ${p}`) ?? 'absente'})`).join(', ')}`);
  verifier(!Object.values(ROUTES).some(([, p]) => p.includes('/box/')), 'aucune route `box` dans la table');
  const appelsDirects = [];
  const parcourir = (d) => { for (const x of readdirSync(d)) { const p = join(d, x); if (statSync(p).isDirectory()) parcourir(p); else if (/\.jsx?$/.test(x) && !p.endsWith('api.js') && /\bfetch\(|XMLHttpRequest|WebSocket/.test(readFileSync(p, 'utf8'))) appelsDirects.push(p); } };
  parcourir(join(RACINE, 'src'));
  verifier(!appelsDirects.length, 'seul api.js parle au réseau', `appel réseau direct dans ${appelsDirects.join(', ')}`);
  let inconnue = '';
  try { chemin('boxBoxDroits'); } catch (e) { inconnue = e.message; }
  verifier(inconnue.startsWith('Route inconnue'), 'une route absente de la table est refusée');
  verifier(chemin('entitlements', {}, { tenant_id: '' }).chemin === '/controle/entitlements' && chemin('box', { id: 'a/b' }).chemin === '/controle/boxes/a%2Fb', 'paramètres encodés, filtre vide omis');
}

console.log('\nTémoins partagés avec Rust (temoins/)');
{
  for (const c of temoinsAdresses.cas) {
    let recu = true;
    try { adresseRecevable(c.adresse); } catch { recu = false; }
    if (recu !== c.web) echoue(`adresse « ${c.adresse} » : ${recu ? 'acceptée' : 'refusée'} côté web, ${c.web ? 'acceptée' : 'refusée'} attendue`);
  }
  ok(`${temoinsAdresses.cas.length} adresses jugées comme le témoin`);
  for (const c of temoinsReponses.cas) {
    let erreur = null;
    try { interpreter(c.statut, c.texte, 'GET', '/controle/boxes'); } catch (e) { erreur = e instanceof ErreurPlateforme ? e.message : `autre : ${e}`; }
    if (erreur !== c.erreur) echoue(`réponse ${c.statut} ${c.texte.slice(0, 40)} : « ${erreur} » au lieu de « ${c.erreur} »`);
  }
  ok(`${temoinsReponses.cas.length} réponses lues comme le témoin`);
}

console.log('\nNe pas être indexé, porter la charte');
{
  const index = readFileSync(join(RACINE, 'index.html'), 'utf8');
  verifier(/<meta name="robots" content="noindex, nofollow/.test(index), 'index.html : noindex, nofollow');
  verifier(/Disallow: \//.test(readFileSync(join(RACINE, 'public/robots.txt'), 'utf8')), 'robots.txt refuse tout');
  const css = readFileSync(join(RACINE, 'src/charte.css'), 'utf8');
  const degrade = (s) => s.match(/--degrade-charte:\s*([^;]+);/)?.[1]?.trim();
  const desktop = join(DEPOT, 'desktop/src/charte.css');
  if (existsSync(desktop)) verifier(degrade(css) && degrade(css) === degrade(readFileSync(desktop, 'utf8')), 'le dégradé est celui de l’application desktop', `dégradé différent : ${degrade(css)}`);
  verifier(/#e5007e 0%/.test(css) && /#fdc802 97\.49%/.test(css) && /font-family: Montserrat/.test(css), 'Montserrat, du rose #E5007E au jaune #FDC802');
  const conf = JSON.parse(readFileSync(join(RACINE, 'src-tauri/tauri.conf.json'), 'utf8'));
  const confDesktop = JSON.parse(readFileSync(join(DEPOT, 'desktop/src-tauri/tauri.conf.json'), 'utf8'));
  verifier(conf.identifier !== confDesktop.identifier && conf.productName === 'iAgent Back-office', `identifiant distinct de l’application client (${conf.identifier})`);
}

if (fautes) {
  console.error(`\n${fautes} faute(s) sur ${n + fautes} contrôles.`);
  process.exit(1);
}
console.log(`\nBack-office : ${n} contrôles, tout passe.`);
