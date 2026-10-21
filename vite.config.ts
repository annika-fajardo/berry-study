import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const PDFS = ['FNCE445_Formula_Sheet.pdf', 'FNCE445_Study_Guide.pdf']

/** virtual:pdfs → file name → the URL the page links to, served from public/. */
function pdfLinks(): Plugin {
  const id = 'virtual:pdfs'
  return {
    name: 'berry-pdf-links',
    resolveId: (s) => (s === id ? '\0' + id : null),
    load(s) {
      if (s !== '\0' + id) return null
      const map: Record<string, string> = Object.fromEntries(PDFS.map(f => [f, f]))
      return `export const PDF_EMBEDDED = false;\nexport default ${JSON.stringify(map)};`
    },
  }
}

export default defineConfig(() => {
  return {
    // Relative base so the same build works at / and under a sub-path such as /berry-study/ (GitHub Pages).
    base: process.env.BASE_PATH || './',
    define: { __SINGLE__: JSON.stringify(false) },
    build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 900 },
    plugins: [
      react(),
      pdfLinks(),
      VitePWA({
            registerType: 'autoUpdate',
            injectRegister: null,
            includeAssets: ['favicon.svg', 'apple-touch-icon.png', ...PDFS],
            manifest: {
              name: 'Berry Study',
              short_name: 'Berry',
              description: 'A playful, offline study planner: schedule, grades, course practice, focus timer and garden.',
              theme_color: '#9CAD8C',
              background_color: '#FBFAF7',
              display: 'standalone',
              start_url: './',
              scope: './',
              shortcuts: [
                { name: 'Start 25 min', short_name: '25 min', url: './#/garden', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
                { name: 'Add a deadline', short_name: 'Add', url: './#/add', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
                { name: 'Today', short_name: 'Today', url: './#/home', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
              ],
              icons: [
                { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                { src: 'icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
                { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png,woff2,pdf,webmanifest}'],
              maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
              navigateFallback: 'index.html',
              // A new build must take over straight away: v2 kept serving v1 from the cache until the
              // service worker was unregistered by hand. The old caches go with it.
              skipWaiting: true,
              clientsClaim: true,
              cleanupOutdatedCaches: true,
            },
      }),
    ],
  }
})
