import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import accueil from './accueil/donnees.mjs';
import { PAGES } from './src/pages/site.js';
import { organisationSchema } from './src/data/entreprise.js';

// The home page's Organization block comes from src/data/entreprise.js, like
// the legal notice, so the two cannot say different things.
const organisation = () => ({
  name: 'organisation',
  transformIndexHtml(html) {
    if (!html.includes('__ORGANISATION__')) return html;
    return html.replace('__ORGANISATION__', JSON.stringify(organisationSchema()));
  },
});

// Two pages: the home page (index.html, served at /) and the shop
// (catalogue.html, served at /catalogue thanks to cleanUrls in vercel.json).
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), accueil(), organisation()],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // An SSR build (the bench, the home page's prerender) names its own entry.
    rollupOptions: isSsrBuild ? {} : {
      input: {
        accueil: resolve(__dirname, 'index.html'),
        catalogue: resolve(__dirname, 'catalogue.html'),
        // The offer pages of max's site plan (src/pages/site.js).
        ...Object.fromEntries(PAGES.map((p) => [p.nom, resolve(__dirname, `${p.nom}.html`)])),
      },
    },
  },
}));
