// sitemap.xml and robots.txt, drawn from the list of pages. Written once:
// the prerender writes them, the bench checks them.
import { SITE } from './contenu.js';

export const urlDe = (page) => SITE + (page.chemin === '/' ? '/' : page.chemin);

export function sitemapXml(pages, jour) {
  const urls = pages.filter((p) => !p.horsPlan).map((p) => `  <url><loc>${urlDe(p)}</loc><lastmod>${jour}</lastmod></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export const robotsTxt = () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`;
