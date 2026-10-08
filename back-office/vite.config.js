import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The web build is for development and captures only (the product is the
// Tauri app). In a browser, `/plateforme` is proxied to the platform so the
// page stays same-origin: the platform sets no CORS header, and the desktop
// app does not need one since Rust makes the calls.
const plateforme = {
  '/plateforme': {
    target: process.env.PLATEFORME_URL || 'http://127.0.0.1:8787',
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/plateforme/, ''),
  },
};

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  clearScreen: false,
  server: { port: 5174, strictPort: true, proxy: plateforme },
  preview: { port: 4174, strictPort: true, proxy: plateforme },
  // The bench (SSR build) runs on Node 22 and uses top-level await.
  build: { outDir: 'dist', sourcemap: false, target: isSsrBuild ? 'node22' : 'modules' },
}));
