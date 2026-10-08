// Captures of the back-office screens, against a local platform loaded with
// the bench data (banc/plateforme-de-banc.ts), through the web build served
// by `vite preview` (which proxies /plateforme to it).
//
// Playwright is NOT a dependency of the back-office: the script loads the one
// installed on the machine (PLAYWRIGHT_MODULE) and its Chromium (CHROMIUM).
//
//   npm run build && npm run captures -- <dossier de sortie>
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { JETON_DE_BANC } from './donnees-de-banc.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const SORTIE = process.argv[2] ?? join(RACINE, 'banc/captures');
const MODULE = process.env.PLAYWRIGHT_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs';
const CHROMIUM = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT_PLATEFORME = 8791;
const PORT_PAGE = 4174;

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
async function pret(url, essais = 60) {
  for (let i = 0; i < essais; i++) {
    try { await fetch(url); return; } catch { await attendre(250); }
  }
  throw new Error(`${url} ne répond pas`);
}

const enfants = [];
const lancer = (cmd, args, env = {}) => {
  const p = spawn(cmd, args, { cwd: RACINE, env: { ...process.env, ...env }, stdio: ['ignore', 'inherit', 'inherit'] });
  enfants.push(p);
  return p;
};
const finir = () => { for (const p of enfants) p.kill('SIGTERM'); };
process.on('exit', finir);

mkdirSync(SORTIE, { recursive: true });
lancer(process.execPath, ['--experimental-strip-types', 'banc/plateforme-de-banc.ts'], { PORT: String(PORT_PLATEFORME) });
lancer(join(RACINE, 'node_modules/.bin/vite'), ['preview', '--port', String(PORT_PAGE), '--strictPort'], { PLATEFORME_URL: `http://127.0.0.1:${PORT_PLATEFORME}` });
await pret(`http://127.0.0.1:${PORT_PLATEFORME}/`);
await pret(`http://127.0.0.1:${PORT_PAGE}/`);

const { chromium } = await import(MODULE);
const navigateur = await chromium.launch({ executablePath: CHROMIUM });
const page = await navigateur.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const faites = [];
const capturer = async (nom) => {
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 15000 });
  await attendre(250);
  const chemin = join(SORTIE, `back-office-${nom}.png`);
  await page.screenshot({ path: chemin, fullPage: true });
  faites.push(chemin);
};

try {
  await page.goto(`http://127.0.0.1:${PORT_PAGE}/`);
  await page.getByLabel('Jeton du back-office').waitFor();
  await page.getByLabel('Adresse de la plateforme').fill('/plateforme');
  await page.getByLabel('Jeton du back-office').fill(JETON_DE_BANC);
  await capturer('connexion');
  await page.getByRole('button', { name: 'Ouvrir le back-office' }).click();
  await page.getByRole('navigation').waitFor();
  const html = await page.content();
  if (html.includes(JETON_DE_BANC)) throw new Error('le jeton apparaît dans la page après la saisie');

  for (const id of ['plans', 'boxes', 'licences', 'voix', 'catalogue', 'personas', 'skills', 'opportunites', 'etudes', 'devis', 'audit']) {
    await page.goto(`http://127.0.0.1:${PORT_PAGE}/#/${id}`);
    await page.locator('.bo-titre').waitFor();
    await capturer(id);
  }

  // Actions: what the platform answers is what is shown.
  await page.goto(`http://127.0.0.1:${PORT_PAGE}/#/opportunites`);
  await page.getByRole('button', { name: 'Générer les brouillons du jour' }).click();
  await page.getByRole('alert').first().waitFor();
  await capturer('opportunites-generer-refuse');

  await page.goto(`http://127.0.0.1:${PORT_PAGE}/#/skills`);
  await page.getByLabel('Motif pour SP-commandes-telephone').fill('Relu : aucune donnée client.');
  await page.locator('tr', { hasText: 'SP-commandes-telephone' }).getByRole('button', { name: 'Valider' }).click();
  await page.getByRole('alert').first().waitFor();
  await capturer('skills-valider-refuse');

  await page.goto(`http://127.0.0.1:${PORT_PAGE}/#/plans`);
  await page.locator('tr', { hasText: 'Agent Essential' }).filter({ hasText: 'en vigueur' }).getByRole('button', { name: 'Nouvelle version' }).click();
  await page.getByLabel('Prix de base (vide = sur devis)').fill('31');
  await page.getByLabel("Date d'effet").fill('2026-12-01');
  await page.getByRole('button', { name: 'Enregistrer la version' }).click();
  await page.getByRole('status').waitFor();
  await page.getByRole('button', { name: 'Nouveau plan' }).scrollIntoViewIfNeeded();
  await capturer('plans-nouvelle-version');
} finally {
  await navigateur.close();
  finir();
}
console.log(faites.map((f) => `  ${f}`).join('\n'));
console.log(`${faites.length} captures.`);
process.exit(0);
