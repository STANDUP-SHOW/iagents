import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Statique, chemins relatifs : la page est servie par iagent-device depuis
// /opt/iagent/usine/ui, jamais depuis un CDN (la Box n'a pas besoin d'Internet
// pour afficher son écran d'usine).
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
  server: { host: '127.0.0.1', port: 5174, proxy: { '/api': 'http://127.0.0.1:8787' } },
});
