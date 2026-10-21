// Generates favicon.svg and the PWA/Apple PNG icons from the Berry SVG component.
// Usage: npm run icons   (uses tsx + Playwright's Chromium; PLAYWRIGHT_BROWSERS_PATH may point at a preinstalled browser)
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
const out = JSON.parse(execFileSync('npx', ['tsx', '-e', `
import { berrySvg } from './scripts/icon-svg.tsx'
console.log(JSON.stringify({
  fav: berrySvg({ pad: 2, size: 64 }),
  any: berrySvg({ pad: 8, bg: '#FCEBF1' }),
  mask: berrySvg({ pad: 38, bg: '#FCEBF1' }),
}))`], { encoding: 'utf8' }))
mkdirSync('public', { recursive: true })
writeFileSync('public/favicon.svg', out.fav)
const browser = await chromium.launch()
const page = await browser.newPage()
async function png(svg, size, file) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<html><body style="margin:0;line-height:0">${svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`)}</body></html>`)
  await page.screenshot({ path: 'public/' + file, omitBackground: false, clip: { x: 0, y: 0, width: size, height: size } })
}
await png(out.any, 192, 'icon-192.png')
await png(out.any, 512, 'icon-512.png')
await png(out.mask, 192, 'icon-maskable-192.png')
await png(out.mask, 512, 'icon-maskable-512.png')
await png(out.any, 180, 'apple-touch-icon.png')
await browser.close()
console.log('icons written to public/')
