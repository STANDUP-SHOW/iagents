import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const ici = (chemin: string) => fileURLToPath(new URL(chemin, import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    // The back-office screens (../back-office/src) are mounted in the
    // « Administration iAgent » space: they must use THIS React, not a second
    // copy, or hooks break at the first render.
    dedupe: ['react', 'react-dom'],
    // Its stylesheet imports Montserrat by package name; back-office/ has no
    // node_modules of its own in a desktop build, so the font resolves here.
    alias: { '@fontsource/montserrat': ici('./node_modules/@fontsource/montserrat') },
  },
  server: {
    port: 5173,
    fs: { allow: [ici('.'), ici('../back-office')] },
  },
  build: {
    outDir: 'dist',
  },
})
