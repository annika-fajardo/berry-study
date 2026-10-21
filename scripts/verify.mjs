// End-to-end verification with Playwright against the production build.
// Usage: npm run build && (npx vite preview --port 4173 &) && PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/verify.mjs
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const TMP = mkdtempSync(join(tmpdir(), 'berry-verify-'))

const BASE = process.env.BASE_URL || 'http://localhost:4173/'
const SHOTS = 'screenshots'
mkdirSync(SHOTS, { recursive: true })
const TABS = ['today', 'schedule', 'courses', 'focus', 'grades', 'settings']
const results = []
const errors = []
const ok = (name, pass, detail = '') => { results.push({ name, pass: !!pass, detail }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')) }

const browser = await chromium.launch()

function watch(page, label) {
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${label}] console: ${m.text()}`) })
  page.on('pageerror', e => errors.push(`[${label}] pageerror: ${e.message}`))
}
async function dismissOverlays(page) {
  for (let i = 0; i < 3; i++) {
    const c = page.locator('.celebrate button')
    if (await c.count()) { await c.first().click(); await page.waitForTimeout(150) } else break
  }
}
async function onboard(page, name = 'Tux') {
  const inp = page.locator('#onboard-name')
  if (await inp.count()) { await inp.fill(name); await page.getByRole('button', { name: "Let's go" }).click() }
}
async function xp(page) {
  await page.goto(BASE + '#/today'); await page.waitForSelector('.level-card')
  const t = await page.locator('.level-card .lc-sub').innerText()
  return Number(t.match(/\(([\d,]+) xp\)/)[1].replace(/,/g, ''))
}
const go = async (page, hash) => { await page.goto(BASE + '#/' + hash); await page.waitForTimeout(250); await dismissOverlays(page) }

/* ---------------- functional checks at phone size ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light', acceptDownloads: true })
  const page = await ctx.newPage(); watch(page, 'functional')
  await page.goto(BASE); await page.waitForSelector('.page')
  ok('first run shows onboarding (cat name prompt)', await page.locator('#onboard-name').count() === 1)
  await onboard(page, 'Tux')

  // seed loaded
  await go(page, 'settings')
  const sumText = await page.locator('#data-h + p + p').innerText()
  ok('seed: 64 schedule items', /64 schedule items/.test(sumText), sumText)
  ok('seed: 36 grade rows', /36 grade rows/.test(sumText))
  await go(page, 'schedule')
  await page.getByRole('button', { name: 'Show past' }).click()
  await page.getByRole('button', { name: 'Show completed' }).click()
  ok('schedule shows all 64 items with past+completed filters', (await page.locator('#agenda .row').count()) === 64, String(await page.locator('#agenda .row').count()))
  await page.getByRole('button', { name: 'Show past' }).click()
  await page.getByRole('button', { name: 'Show completed' }).click()
  await go(page, 'grades')
  const gpa = (await page.locator('#gpa').innerText()).trim()
  ok('projected GPA shows a number', /^\d\.\d\d$/.test(gpa), gpa)
  ok('grades: 36 mark inputs', (await page.locator('.gtable input').count()) === 36)

  // tick → XP up, row disappears, undo → XP back
  const xp0 = await xp(page)
  await go(page, 'schedule')
  const row = page.locator('#agenda .row:not(.done)').first()
  const id = await row.getAttribute('data-item')
  const title = await row.locator('.title').innerText()
  await row.locator('input.check').check()
  await page.waitForTimeout(700)
  ok('ticked task disappears from the main view', (await page.locator(`#agenda [data-item="${id}"]`).count()) === 0, title)
  const undo = page.locator('.toast').filter({ hasText: 'Done:' }).getByRole('button', { name: 'Undo' })
  ok('undo toast appears', await undo.count() === 1)
  await page.screenshot({ path: `${SHOTS}/flow-tick-undo-toast.png` })
  const xp1 = await xp(page)
  ok('ticking a task increases XP', xp1 > xp0, `${xp0} → ${xp1}`)
  // untick through the completed filter
  await go(page, 'schedule')
  await page.getByRole('button', { name: 'Show completed' }).click()
  await page.locator(`#agenda [data-item="${id}"] input.check`).uncheck()
  await page.waitForTimeout(300)
  const xp2 = await xp(page)
  ok('unticking returns XP to where it was', xp2 === xp0, `${xp1} → ${xp2}`)
  // tick again and use Undo from the toast
  await go(page, 'schedule')
  await page.locator(`#agenda [data-item="${id}"] input.check`).check()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Show completed' }).click()
  await page.waitForTimeout(100)
  const undo2 = page.locator('.toast').filter({ hasText: 'Done:' }).getByRole('button', { name: 'Undo' }).first()
  if (await undo2.count()) await undo2.click()
  await page.waitForTimeout(200)
  ok('undo button restores the task', await page.locator(`#agenda [data-item="${id}"] input.check`).isChecked() === false)
  ok('XP back after undo', (await xp(page)) === xp0)

  // FNCE 445 quiz-style question
  await go(page, 'courses/fnce-445/adaptive')
  const xpq0 = await xp(page)
  await go(page, 'courses/fnce-445/adaptive')
  await page.getByRole('button', { name: /Start (round 1|a round on my weak spots)/ }).click()
  let correct = 0, answered = 0
  for (let round = 0; round < 3 && !correct; round++) {
    const cards = page.locator('section.card[data-q]')
    const n = await cards.count()
    for (let i = 0; i < n && !correct; i++) {
      const c = cards.nth(i)
      await c.locator('.mc button').first().click(); answered++
      await page.waitForTimeout(80)
      if (await c.locator('.mc button.right.wrong, .mc button.right').first().count() && !(await c.locator('.mc button.wrong').count())) correct++
      if (i === 0 && round === 0) {
        ok('quiz-style: steps shown after answering', (await c.locator('.sol div').count()) >= 2)
        ok('quiz-style: trap explanations shown', (await c.locator('.sol .traps li').count()) >= 2, String(await c.locator('.sol .traps li').count()))
        await c.screenshot({ path: `${SHOTS}/flow-fnce445-quiz-answer.png` })
      }
    }
    if (!correct) { const n2 = page.getByRole('button', { name: 'Next round: focus on my weak spots' }); if (await n2.count()) await n2.click() }
    await dismissOverlays(page)
  }
  const xpq1 = await xp(page)
  ok('quiz-style: correct answer awards XP', correct > 0 && xpq1 >= xpq0 + 10, `${answered} answered, ${xpq0} → ${xpq1}`)

  // drill
  await go(page, 'courses/fnce-445/drills')
  await page.getByRole('button', { name: /^Forward price, no dividends/ }).click()
  await page.locator('#drill-in').fill('100')
  await page.getByRole('button', { name: 'Check' }).click()
  ok('drill: worked solution shown', await page.locator('.sol').filter({ hasText: 'Worked solution' }).count() === 1)
  ok('drill: result recorded on the chip', /· \d+\/\d+/.test(await page.getByRole('button', { name: /^Forward price, no dividends/ }).innerText()))
  await page.getByRole('button', { name: 'Next question' }).click()
  ok('drill: next question loads', await page.locator('#drill-in').isEnabled())

  // flashcards
  await go(page, 'courses/fnce-477/flash')
  await page.locator('button.flash').click()
  ok('flashcard flips', (await page.locator('button.flash').getAttribute('aria-label')).includes('back'))
  await page.getByRole('button', { name: 'Got it' }).click()
  ok('flashcard: got it counts', /1 known/i.test(await page.locator('.card .eyebrow').first().innerText()))

  // practice set (prof's questions) on FNCE 445
  await go(page, 'courses/fnce-445/quiz')
  const pq1 = page.locator('section.card:has(.mc)').first()
  await pq1.locator('.mc button').nth(2).click()
  ok('practice set: solution after correct pick', await pq1.locator('.sol').count() === 1)

  // FNCE 477 decks open
  await go(page, 'courses/fnce-477/decks')
  ok('decks: 3 decks listed', (await page.locator('.deckrow').count()) === 3)
  await page.locator('.deckrow').first().getByRole('button', { name: 'See results' }).click()
  ok('decks: results view with explanations', (await page.locator('.sol').count()) >= 10)

  // Flora log
  await go(page, 'focus')
  const plants0 = await page.locator('.garden .plot').count()
  const min0 = await page.locator('[data-week-min="FNCE 477"]').innerText()
  await page.locator('#flora-min').fill('30')
  await page.locator('#flora-course').selectOption('FNCE 477')
  await page.getByRole('button', { name: 'Log Flora session' }).click()
  await page.waitForTimeout(400); await dismissOverlays(page)
  const plants1 = await page.locator('.garden .plot').count()
  const min1 = await page.locator('[data-week-min="FNCE 477"]').innerText()
  ok('Flora log: a plant appears in this week\'s garden', plants1 === plants0 + 1, `${plants0} → ${plants1}`)
  ok('Flora log: weekly minutes update', min0 !== min1, `${min0} → ${min1}`)
  await page.screenshot({ path: `${SHOTS}/flow-flora-logged.png`, fullPage: true })

  // focus timer start + early stop wilts
  await page.getByRole('button', { name: /^Start \d+-minute focus/ }).click()
  ok('timer running shows the napping cat', await page.locator('.dial .napper svg').count() === 1)
  await page.screenshot({ path: `${SHOTS}/flow-timer-running.png` })
  await page.getByRole('button', { name: 'Stop early' }).click()
  await page.getByRole('button', { name: 'Stop and wilt' }).click()
  await page.waitForTimeout(300)
  ok('stopping early wilts a plant', await page.locator('.garden .plant.wilted').count() >= 1)

  // add / edit / delete with styled confirm
  await go(page, 'schedule')
  await page.getByRole('button', { name: '+ Add item' }).click()
  await page.locator('#ed-t').fill('Verification item')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.waitForTimeout(200)
  const added = page.locator('#agenda .row').filter({ hasText: 'Verification item' })
  ok('add item works', await added.count() === 1)
  await added.getByRole('button', { name: 'Edit Verification item' }).click()
  await page.getByRole('button', { name: 'Delete' }).click()
  ok('delete uses a styled confirm dialog', await page.getByRole('dialog').filter({ hasText: 'Delete this item?' }).count() === 1)
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await page.waitForTimeout(200)
  ok('delete removes the item', await page.locator('#agenda .row').filter({ hasText: 'Verification item' }).count() === 0)

  // export → reset → import → identical
  await go(page, 'settings')
  const beforeReset = await page.locator('#data-h + p + p').innerText()
  const d1 = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export data (JSON)' }).click()
  const f1 = `${TMP}/verify-export-1.json`; await (await d1).saveAs(f1)
  await page.getByRole('button', { name: 'Reset to seed…' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Reset' }).click()
  await page.waitForTimeout(300)
  const afterReset = await page.locator('#data-h + p + p').innerText()
  await page.locator('[data-testid="import-input"]').setInputFiles(f1)
  await page.getByRole('dialog').getByRole('button', { name: 'Replace' }).click()
  await page.waitForTimeout(400)
  const d2 = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export data (JSON)' }).click()
  const f2 = `${TMP}/verify-export-2.json`; await (await d2).saveAs(f2)
  const a = JSON.parse(readFileSync(f1, 'utf8')), b = JSON.parse(readFileSync(f2, 'utf8'))
  ok('export → reset → import round-trips identically', JSON.stringify(a.data) === JSON.stringify(b.data), 'after reset: ' + afterReset)
  ok('reset to seed actually changed the data', beforeReset !== afterReset, `${beforeReset} | ${afterReset}`)
  // persistence across reload
  await page.reload(); await page.waitForSelector('.page')
  const d3 = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export data (JSON)' }).click()
  const f3 = `${TMP}/verify-export-3.json`; await (await d3).saveAs(f3)
  ok('data persists in IndexedDB across reload', JSON.stringify(JSON.parse(readFileSync(f3, 'utf8')).data) === JSON.stringify(a.data))
  // invalid import rejected
  writeFileSync(`${TMP}/verify-bad.json`, '{"hello": 1}')
  await page.locator('[data-testid="import-input"]').setInputFiles(`${TMP}/verify-bad.json`)
  await page.waitForTimeout(200)
  ok('invalid import is rejected with a message', await page.locator('[role="alert"]').filter({ hasText: 'No schedule' }).count() === 1)
  await ctx.close()
}

/* ---------------- screenshots: 390×844 and 1280×800, light and dark ---------------- */
for (const [w, h] of [[390, 844], [1280, 800]]) {
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme })
    const page = await ctx.newPage(); watch(page, `${w}-${scheme}`)
    await page.goto(BASE); await page.waitForSelector('.page'); await onboard(page)
    for (const t of TABS) {
      await go(page, t); await page.waitForTimeout(350)
      await page.screenshot({ path: `${SHOTS}/${w}-${scheme}-${t}.png`, fullPage: true })
    }
    for (const [name, hash] of [['course-fnce445', 'courses/fnce-445/formulas'], ['course-fnce477-decks', 'courses/fnce-477/decks'], ['course-mgst451-quiz', 'courses/mgst-451/adaptive']]) {
      await go(page, hash)
      if (name === 'course-mgst451-quiz') { await page.getByRole('button', { name: /Start/ }).first().click(); await page.locator('section.card[data-q]').first().locator('.mc button').first().click() }
      await page.waitForTimeout(300)
      await page.screenshot({ path: `${SHOTS}/${w}-${scheme}-${name}.png`, fullPage: true })
    }
    await ctx.close()
  }
}

/* ---------------- level-up celebration screenshot ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' })
  const page = await ctx.newPage(); watch(page, 'levelup')
  await page.goto(BASE); await page.waitForSelector('.page'); await onboard(page)
  await go(page, 'focus')
  // log enough Flora minutes to cross the next level threshold
  await page.locator('#flora-min').fill('400')
  await page.getByRole('button', { name: 'Log Flora session' }).click()
  await page.waitForTimeout(600)
  ok('level-up celebration appears when crossing a threshold', await page.locator('.celebrate').count() === 1)
  await page.screenshot({ path: `${SHOTS}/flow-level-up.png` })
  await dismissOverlays(page)
  ok('level-up is dismissible', await page.locator('.celebrate').count() === 0)
  await ctx.close()
}

/* ---------------- no horizontal overflow at 360px ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 360, height: 760 }, colorScheme: 'light' })
  const page = await ctx.newPage(); watch(page, '360')
  await page.goto(BASE); await page.waitForSelector('.page'); await onboard(page)
  const bad = []
  for (const t of [...TABS, 'courses/fnce-445/formulas', 'courses/fnce-445/assign', 'courses/fnce-445/adaptive', 'courses/fnce-445/drills', 'courses/fnce-477/decks', 'courses/fnce-477/progress', 'courses/sgma-591/flash']) {
    await go(page, t)
    if (t.endsWith('assign')) await page.locator('details.q').first().evaluate(d => { d.open = true })
    if (t.endsWith('adaptive')) await page.getByRole('button', { name: /Start/ }).first().click()
    await page.waitForTimeout(200)
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    if (sw > 360) bad.push(`${t}: ${sw}px`)
  }
  ok('no horizontal overflow at 360px', bad.length === 0, bad.join(', '))
  await page.goto(BASE + '#/schedule'); await page.waitForTimeout(300)
  await page.screenshot({ path: `${SHOTS}/360-light-schedule.png`, fullPage: true })
  await ctx.close()
}

await browser.close()
ok('zero console errors and page errors', errors.length === 0, errors.slice(0, 8).join(' | '))
writeFileSync(`${SHOTS}/verify-results.json`, JSON.stringify({ results, errors }, null, 2))
const failed = results.filter(r => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
