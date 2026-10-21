import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PDFS = ['FNCE445_Formula_Sheet.pdf', 'FNCE445_Study_Guide.pdf']

/** virtual:pdfs → file name → href. Normal build: a relative URL into public/. Single-file build: an embedded data: URL. */
function pdfLinks(single: boolean): Plugin {
  const id = 'virtual:pdfs'
  return {
    name: 'berry-pdf-links',
    resolveId: (s) => (s === id ? '\0' + id : single && s === 'virtual:pwa-register' ? '\0pwa-stub' : null),
    transformIndexHtml(html) {
      if (!single) return html
      const svg = readFileSync(resolve(__dirname, 'public/favicon.svg'), 'utf8')
      return html
        .replace('href="favicon.svg"', 'href="data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64') + '"')
        .replace(/<link rel="apple-touch-icon"[^>]*>\n?/, '')
    },
    load(s) {
      if (s === '\0pwa-stub') return 'export function registerSW(){ return () => {} }'
      if (s !== '\0' + id) return null
      const map: Record<string, string> = {}
      for (const f of PDFS) {
        map[f] = single
          ? 'data:application/pdf;base64,' + readFileSync(resolve(__dirname, 'public', f)).toString('base64')
          : f
      }
      return `export const PDF_EMBEDDED = ${single};\nexport default ${JSON.stringify(map)};`
    },
  }
}

export default defineConfig(({ mode }) => {
  const single = mode === 'single'
  return {
    // Relative base so the same build works at / and under a sub-path such as /berry-study/ (GitHub Pages).
    base: process.env.BASE_PATH || './',
    define: { __SINGLE__: JSON.stringify(single) },
    build: single
      ? { outDir: 'dist-single', emptyOutDir: true, copyPublicDir: false, chunkSizeWarningLimit: 4000 }
      : { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 900 },
    plugins: [
      react(),
      pdfLinks(single),
      single
        ? viteSingleFile()
        : VitePWA({
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
            },
          }),
    ],
  }
})
