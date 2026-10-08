// Screenshots of every built page, desktop and phone, served the way Vercel
// serves them (cleanUrls). Playwright is not a dependency of the site: give
// its location with PLAYWRIGHT (default /opt/node-tools/node_modules/playwright)
// and the browser with CHROMIUM.
//
//   npm run build && node outils/captures.mjs [dossier de sortie]
//   node outils/captures.mjs --og        (writes public/og-home.png, 1200×630)
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ICI = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ICI, 'dist');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? '/opt/node-tools/node_modules/playwright');
const executablePath = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.xml': 'application/xml', '.txt': 'text/plain' };

function servir() {
  const serveur = createServer((req, res) => {
    const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const essais = chemin === '/' ? ['index.html'] : [chemin.slice(1), `${chemin.slice(1)}.html`];
    const trouve = essais.map((e) => join(DIST, e)).find((f) => f.startsWith(DIST) && existsSync(f) && !f.endsWith('/'));
    const fichier = trouve ?? join(DIST, '404.html');
    res.writeHead(trouve ? 200 : 404, { 'content-type': TYPES[extname(fichier)] ?? 'application/octet-stream' });
    res.end(readFileSync(fichier));
  });
  return new Promise((ok) => serveur.listen(0, '127.0.0.1', () => ok(serveur)));
}

if (!existsSync(join(DIST, 'index.html'))) throw new Error('captures : construire d’abord (npm run build)');
const serveur = await servir();
const base = `http://127.0.0.1:${serveur.address().port}`;
const navigateur = await chromium.launch({ executablePath });

try {
  if (process.argv.includes('--og')) {
    const page = await navigateur.newPage({ viewport: { width: 1200, height: 630 } });
    await page.goto(`${base}/`);
    await page.setContent(`<!doctype html><html lang="fr"><head><link rel="stylesheet" href="${base}${readFileSync(join(DIST, 'index.html'), 'utf8').match(/href="(\/assets\/[^"]+\.css)"/)[1]}"></head>
      <body style="margin:0;width:1200px;height:630px;display:flex;align-items:center;gap:56px;padding:0 80px;box-sizing:border-box;background:linear-gradient(180deg,#fff,#FAFAF7)">
      <div style="flex:1"><img src="${base}/logo-iagent.svg" width="200" alt=""><p style="font:600 22px Montserrat;color:#4A5262;margin:28px 0 8px;letter-spacing:.12em;text-transform:uppercase">Home</p>
      <p style="font:700 46px/1.15 Montserrat;color:#1C2230;margin:0">Vous gérez votre vie ; votre Home Agent gère ce qui l’encombre.</p></div>
      <img src="${base}/icone.svg" width="300" alt=""></body></html>`);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(ICI, 'public', 'og-home.png') });
    console.log('public/og-home.png écrite');
  } else {
    const sortie = process.argv[2] ?? '/mnt/project-files/master/captures';
    mkdirSync(sortie, { recursive: true });
    // The pages are the ones the sitemap lists: the same list as the prerender.
    const PAGES = [...readFileSync(join(DIST, 'sitemap.xml'), 'utf8').matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)]
      .map((m) => ({ chemin: m[1], nom: m[1] === '/' ? 'accueil' : m[1].slice(1) }));
    for (const [appareil, options] of [
      ['bureau', { viewport: { width: 1440, height: 900 } }],
      ['telephone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
    ]) {
      const contexte = await navigateur.newContext(options);
      const page = await contexte.newPage();
      const erreurs = [];
      page.on('pageerror', (e) => erreurs.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
      for (const { chemin, nom } of PAGES) {
        await page.goto(base + chemin, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        const largeur = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (largeur > 0) throw new Error(`${chemin} (${appareil}) : la page déborde de ${largeur} px en largeur`);
        const fichier = join(sortie, `home-${nom}-${appareil}.png`);
        await page.screenshot({ path: fichier, fullPage: true });
        console.log(`  ${fichier}`);
      }
      if (erreurs.length) throw new Error(`erreurs dans la page (${appareil}) : ${erreurs.join(' | ')}`);
      await contexte.close();
    }
  }
} finally {
  await navigateur.close();
  serveur.close();
}
