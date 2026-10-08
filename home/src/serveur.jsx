// Server rendering of one page, with its head tags. Used by the prerender
// (outils/prerendre.mjs) and by the bench.
import { renderToString } from 'react-dom/server';
import App from './App.jsx';
import { PAGES, PAGE_404, pageDe } from './pages.js';
import { urlDe, sitemapXml, robotsTxt } from './seo.js';

export { PAGES, PAGE_404, sitemapXml, robotsTxt };

const echapper = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function tete(page) {
  const url = urlDe(page);
  const t = echapper(page.titre);
  const d = echapper(page.description);
  return [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    page.horsPlan ? '<meta name="robots" content="noindex" />' : `<link rel="canonical" href="${url}" />`,
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="iAgent Home" />',
    '<meta property="og:locale" content="fr_FR" />',
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${new URL('/og-home.png', url).href}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    '<meta property="og:image:alt" content="iAgent Home — votre Home Agent gère ce qui encombre votre vie" />',
    '<meta name="twitter:card" content="summary_large_image" />',
  ].join('\n    ');
}

export function rendre(chemin) {
  const page = pageDe(chemin);
  return { page, tete: tete(page), html: renderToString(<App chemin={page.chemin} />) };
}
