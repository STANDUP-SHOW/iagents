import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// One HTML template for every page: outils/prerendre.mjs fills it per address
// after the build, so each page ships its own title, description and content.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3100,
    // src/tarifs.js may read ../plateforme/tarifs/plans.json (repository root).
    fs: { allow: [resolve(__dirname, '..')] },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
