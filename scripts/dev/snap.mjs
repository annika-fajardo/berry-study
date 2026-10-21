import { chromium } from 'playwright'
const [url, out, w = 1280, h = 800, scheme = 'light', wait = '600'] = process.argv.slice(2)
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: +w, height: +h }, colorScheme: scheme })
const errs = []
p.on('console', m => m.type() === 'error' && errs.push(m.text()))
p.on('pageerror', e => errs.push(e.message))
await p.goto(url); await p.waitForSelector('.page', { timeout: 15000 })
await p.waitForTimeout(+wait)
await p.screenshot({ path: out, fullPage: true })
if (errs.length) console.log('ERRORS:', errs.slice(0, 5).join(' | '))
await b.close()
