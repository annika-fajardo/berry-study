// End-to-end verification against the production build.
// npm run build && (npx vite preview --port 4173 &) && PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/verify.mjs
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.BASE_URL || 'http://localhost:4173/'
const SHOTS = 'screenshots/v3'
const TMP = mkdtempSync(join(tmpdir(), 'berry-verify-'))
mkdirSync(SHOTS, { recursive: true })
const results = [], errors = []
const ok = (name, pass, detail = '') => { results.push({ name, pass: !!pass, detail }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')) }
const browser = await chromium.launch()
function watch(page, label) {
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${label}] console: ${m.text()}`) })
  page.on('pageerror', e => errors.push(`[${label}] pageerror: ${e.message}`))
}
const go = async (page, hash) => { await page.goto(BASE + '#/' + hash); await page.waitForSelector('.page', { timeout: 15000 }); await page.waitForTimeout(350) }

/* ---------------- a mock Google Calendar, so connect/read/write can be checked end to end ---------------- */
const created = []
async function mockGoogle(ctx) {
  await ctx.route('https://accounts.google.com/gsi/client', r => r.fulfill({
    contentType: 'text/javascript',
    body: `window.google={accounts:{oauth2:{initTokenClient:(c)=>({requestAccessToken:()=>c.callback({access_token:'fake-token',expires_in:3600}),callback:c.callback}),revoke:()=>{}}}};`,
  }))
  await ctx.route(/googleapis\.com\/calendar\/v3\/users\/me\/calendarList.*/, r => r.fulfill({
    json: { items: [
      { id: 'primary', summary: 'Annika', primary: true, accessRole: 'owner', backgroundColor: '#9CAD8C' },
      { id: 'work@group', summary: 'Hotel Arts shifts', accessRole: 'reader', backgroundColor: '#E9B5BD' },
      { id: 'd2l@group', summary: 'D2L Brightspace', accessRole: 'reader', backgroundColor: '#DDE0BC' },
    ] },
  }))
  const d = new Date(); const day = n => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
  const iso = (x, h, m = 0) => new Date(x.getFullYear(), x.getMonth(), x.getDate(), h, m).toISOString()
  await ctx.route(/googleapis\.com\/calendar\/v3\/calendars\/.*\/events.*/, async (route, req) => {
    if (req.method() === 'POST') { const body = JSON.parse(req.postData() || '{}'); created.push(body); return route.fulfill({ json: { id: 'ev' + created.length } }) }
    const cal = decodeURIComponent(req.url().split('/calendars/')[1].split('/')[0])
    const items = cal === 'work@group'
      ? [{ id: 'w1', summary: 'Banquet shift', start: { dateTime: iso(day(1), 16) }, end: { dateTime: iso(day(1), 23) } }]
      : cal === 'd2l@group'
        ? [{ id: 'q1', summary: 'FNCE 445 - Assignment 9 is due', start: { date: day(6).toISOString().slice(0, 10) }, end: { date: day(7).toISOString().slice(0, 10) } }]
        : [{ id: 'p1', summary: 'Dentist', start: { dateTime: iso(day(1), 10) }, end: { dateTime: iso(day(1), 11) } }]
    return route.fulfill({ json: { items } })
  })
}

/* ---------------- functional checks ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light', acceptDownloads: true })
  await mockGoogle(ctx)
  const page = await ctx.newPage(); watch(page, 'functional')
  await go(page, 'home')

  // seed
  await go(page, 'settings/data')
  const sum = await page.locator('#data-h p.note').first().innerText()
  ok('seed: 64 schedule items', /64 schedule items/.test(sum), sum)
  ok('seed: 36 grade rows', /36 grade rows/.test(sum))
  await go(page, 'schedule/agenda')
  await page.getByRole('button', { name: 'Show past' }).click()
  await page.getByRole('button', { name: 'Show completed' }).click()
  ok('agenda lists all 64 items', (await page.locator('#agenda .row').count()) === 64, String(await page.locator('#agenda .row').count()))
  await page.getByRole('button', { name: 'Show past' }).click(); await page.getByRole('button', { name: 'Show completed' }).click()
  await go(page, 'grades')
  const gpa = (await page.locator('#gpa').innerText()).trim()
  ok('projected GPA shows a number', /^\d\.\d\d$/.test(gpa), gpa)

  // Right Now and the capacity sentence
  await go(page, 'home')
  ok('Right Now names one action with a duration', (await page.locator('.rightnow .rn-action').count()) === 1)
  const rnText = await page.locator('.rightnow').innerText()
  ok('Right Now gives one clause of reason', (await page.locator('.rn-reason').innerText()).length > 12, rnText.replace(/\n/g, ' · ').slice(0, 90))
  const firstRn = await page.locator('.rightnow').getAttribute('data-rn')
  await page.getByRole('button', { name: /Not this/ }).click()
  await page.waitForTimeout(400)
  ok('[Not this] moves to another action', (await page.locator('.rightnow').getAttribute('data-rn')) !== firstRn)
  ok('the capacity sentence is shown', (await page.locator('.capacity').count()) === 1, await page.locator('.capacity').innerText())
  const tight = await page.locator('.capacity.tight').count()
  if (tight) {
    await page.locator('.capacity').getByRole('button', { name: /Fix/ }).click()
    await page.waitForTimeout(300)
    ok('the Fix sheet offers shrink, borrow and accept', (await page.getByRole('dialog').locator('.fix-opt').count()) === 3)
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  } else ok('the Fix sheet offers shrink, borrow and accept', true, 'nothing is tight in this fixture')
  ok("Today's priorities is three rows, not five", (await page.locator('#pri .pi').count()) <= 3)

  // xp through the sidebar line
  const xp = async () => { const t = await page.locator('.side .level-line').first().innerText(); return Number(t.match(/([\d,]+)\s*xp/)[1].replace(/,/g, '')) }
  const xp0 = await xp()
  await go(page, 'schedule/agenda')
  const row = page.locator('#agenda .row:not(.done)').first()
  const id = await row.getAttribute('data-item')
  await row.locator('input.check').check()
  await page.waitForTimeout(600)
  ok('ticking a task hides it and raises xp', (await page.locator(`#agenda [data-item="${id}"]`).count()) === 0 && (await xp()) > xp0, `${xp0} → ${await xp()}`)
  const undo = page.locator('.toast').getByRole('button', { name: 'Undo' }).first()
  ok('undo is offered', await undo.count() === 1)
  await undo.click(); await page.waitForTimeout(300)
  ok('undo puts the xp back', (await xp()) === xp0)

  // calendar views
  await go(page, 'schedule/week')
  ok('week grid draws 7 day columns', (await page.locator('.tg-col').count()) === 7)
  ok('week grid shows suggested blocks', (await page.locator('.tg-ev.sugg').count()) > 0)
  ok('deadlines show as all-day chips', (await page.locator('.chip-ad').count()) > 0)
  await go(page, 'schedule/day')
  ok('day view draws one column', (await page.locator('.tg-col').count()) === 1)
  await go(page, 'schedule/month')
  ok('month view draws a 6-week grid', (await page.locator('.month .d').count()) === 42)
  ok('today is marked in the month view', (await page.locator('.month .d.today').count()) === 1)

  // accept / skip a suggestion
  await go(page, 'schedule/week')
  const before = await page.locator('.tg-ev.own').count()
  const first = page.locator('.sugg-row').first()
  const firstKey = await first.getAttribute('data-sugg')
  await first.getByRole('button', { name: 'Accept' }).click()
  await page.waitForTimeout(500)
  ok('accepting a suggestion books it', (await page.locator('.tg-ev.own').count()) === before + 1)
  const skipRow = page.locator('.sugg-row').first()
  const skipKey = await skipRow.getAttribute('data-sugg'), skipStart = await skipRow.getAttribute('data-start')
  await skipRow.getByRole('button', { name: 'Skip' }).click()
  await page.waitForTimeout(500)
  ok('skipping a suggestion drops that slot', (await page.locator(`[data-sugg="${skipKey}"][data-start="${skipStart}"]`).count()) === 0, firstKey || '')

  // Google connect → read → write
  await go(page, 'settings/calendars')
  await page.locator('#gclient').fill('test-client-id.apps.googleusercontent.com')
  await page.getByRole('button', { name: 'Connect Google Calendar' }).click()
  await page.waitForTimeout(1200)
  ok('Google connect lists the calendars', (await page.getByText('Hotel Arts shifts').count()) > 0)
  await page.locator('tr', { hasText: 'Hotel Arts shifts' }).locator('input[aria-label*="is work"]').check()
  await page.locator('tr', { hasText: 'D2L Brightspace' }).locator('input[aria-label*="is D2L"]').check()
  await page.getByRole('button', { name: 'Refresh' }).click()
  await page.waitForTimeout(900)
  await go(page, 'schedule/week')
  ok('events read from Google appear', (await page.locator('.tg-ev.ext').count()) > 0)
  ok('a shift is marked as work', (await page.locator('.tg-ev.ext.work').count()) > 0 || (await page.locator('.chip-ad.work').count()) > 0)
  const n0 = created.length
  await page.locator('.sugg-row').first().getByRole('button', { name: 'Accept' }).click()
  await page.waitForTimeout(900)
  ok('an accepted block is written to Google', created.length === n0 + 1 && created[created.length - 1].extendedProperties.private.berryStudy === '1')
  ok('the written event is titled and coloured', /^Study: /.test(created[created.length - 1].summary), created[created.length - 1].summary)

  // D2L updates
  await go(page, 'schedule/week')
  const d2lRow = page.locator('[data-d2l]').first()
  ok('a D2L date she does not have is offered', await d2lRow.count() === 1)
  await d2lRow.getByRole('button', { name: 'Add' }).click()
  await page.waitForTimeout(400)
  await go(page, 'schedule/agenda')
  ok('adding a D2L item puts it in the list', (await page.getByText('Assignment 9').count()) > 0)

  // .ics import and export
  const ics = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:imp1\r\nSUMMARY:Volleyball\r\nDTSTART:20261104T020000Z\r\nDTEND:20261104T033000Z\r\nRRULE:FREQ=WEEKLY;COUNT=3\r\nEND:VEVENT\r\nEND:VCALENDAR`
  const icsPath = join(TMP, 'test.ics'); writeFileSync(icsPath, ics)
  await go(page, 'settings/calendars')
  await page.locator('[data-testid="ics-input"]').setInputFiles(icsPath)
  await page.waitForTimeout(600)
  ok('an .ics file imports', (await page.getByText('test.ics').count()) > 0)
  const dl = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export study blocks (.ics)' }).click()
  const f = join(TMP, 'out.ics'); await (await dl).saveAs(f)
  const outIcs = readFileSync(f, 'utf8')
  ok('study blocks export as .ics', outIcs.includes('BEGIN:VEVENT') && outIcs.includes('SUMMARY:'))

  // practice: quiz-style with steps and traps
  await go(page, 'study/fnce-445/practice')
  await page.getByRole('button', { name: /Start/ }).first().click()
  await page.waitForTimeout(400)
  const q = page.locator('section.sheet[data-q]').first()
  await q.locator('.mc button').first().click()
  await page.waitForTimeout(250)
  ok('a quiz answer shows the steps', (await q.locator('.steps-box div').count()) >= 2)
  ok('it explains why the other answers are wrong', (await q.locator('.traps li').count()) >= 2)
  await q.screenshot({ path: `${SHOTS}/flow-quiz-answer.png` })

  // drills and flashcards
  await go(page, 'study/fnce-445/practice/drills')
  await page.getByRole('button', { name: /^Forward price, no dividends/ }).click()
  await page.locator('#drill-in').fill('100')
  await page.getByRole('button', { name: 'Check' }).click()
  ok('a drill shows a worked solution', (await page.getByText('Worked solution').count()) > 0)
  await go(page, 'study/fnce-477/practice/cards')
  await page.locator('button.flash').click()
  ok('a flashcard flips', ((await page.locator('button.flash').getAttribute('aria-label')) || '').includes('back'))

  // readiness
  await go(page, 'study/fnce-445/progress')
  const ready = await page.locator('.ready-num').first().innerText()
  ok('readiness shows a percentage', /\d+% ready/.test(ready), ready)
  ok('topics render as tappable bars', (await page.locator('.topicbar').count()) >= 3)
  ok('untouched topics read as not started, not 0%', (await page.locator('.topicbar.st-new').count()) >= 1)
  await go(page, 'study/mgst-451/practice')
  ok('a course with no question bank says so instead of generating quizzes', (await page.locator('#nobank').count()) === 1)
  ok('no concept-quiz mode is offered there', (await page.getByRole('tab', { name: /Concept quiz/ }).count()) === 0)

  // what-if
  await go(page, 'grades')
  const card = page.locator('[id="g-FNCE445"]')
  await card.getByRole('button', { name: 'What if…' }).click()
  const slider = card.locator('input[type="range"]').first()
  await slider.fill('95')
  await page.waitForTimeout(400)
  ok('a what-if slider changes the projection', (await page.locator('#gpa-whatif').count()) === 1 && (await page.locator('#gpa-whatif').innerText()) !== (await page.locator('#gpa').innerText()))
  await card.getByRole('button', { name: 'What if…' }).click()
  await page.waitForTimeout(300)
  ok('the real mark is untouched', (await card.locator('input[type="number"]').nth(4).inputValue()) === '')
  await card.getByRole('button', { name: 'What if…' }).click()
  await page.getByRole('button', { name: 'Reset what-ifs' }).click()
  await page.waitForTimeout(300)
  ok('what-ifs reset', (await page.locator('#gpa-whatif').count()) === 0)
  // the need line has to move with the sliders, which is the bug this release fixes
  const whatIfChip = card.getByRole('button', { name: 'What if…' })
  const openWhatIf = async () => { if ((await whatIfChip.getAttribute('aria-pressed')) !== 'true') { await whatIfChip.click(); await page.waitForTimeout(250) } }
  await openWhatIf()
  const needBefore = await card.locator('.need').innerText()
  await card.locator('input[type="range"]').first().fill('98')
  await page.waitForTimeout(400)
  ok('the need line follows the what-if sliders', (await card.locator('.need').innerText()) !== needBefore, (await card.locator('.need').innerText()).split('\n')[0])
  ok('each ungraded row shows what it needs', (await card.locator('tbody tr td:nth-child(3)').allInnerTexts()).some(x => /\d%/.test(x)))
  ok('the best / likely / worst band is shown', (await card.locator('.band').count()) === 1, (await card.locator('.band').innerText()).replace(/\n/g, ' '))
  await page.getByRole('button', { name: 'Reset what-ifs' }).click()
  await page.waitForTimeout(300)
  ok('what-ifs reset again after the need-line check', (await page.locator('#gpa-whatif').count()) === 0)
  ok('bonus marks above 100 are accepted', (await card.locator('input[type="number"]').first().getAttribute('max')) === null)
  await card.locator('select[aria-label="FNCE 445 rounding policy"]').selectOption('whole')
  await page.waitForTimeout(300)
  ok('a rounding policy can be set and sticks', (await card.locator('select[aria-label="FNCE 445 rounding policy"]').inputValue()) === 'whole')

  // focus and Flora
  await go(page, 'garden')
  const min0 = await page.locator('[data-week-min="FNCE 477"]').innerText()
  await page.locator('#flora-min').fill('30')
  await page.locator('#flora-course').selectOption('FNCE 477')
  await page.getByRole('button', { name: 'Log it' }).click()
  await page.waitForTimeout(500)
  ok('logging a Flora session adds minutes', (await page.locator('[data-week-min="FNCE 477"]').innerText()) !== min0)
  ok('the session shows in this week', (await page.locator('.garden-row .plot').count()) >= 1)
  await page.getByRole('button', { name: /^Start \d+ minutes/ }).click()
  await page.waitForTimeout(400)
  ok('the timer runs with the cat beside it', (await page.locator('.dial .napper .cat').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/flow-timer-running.png` })
  await page.getByRole('button', { name: 'Stop early' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Stop', exact: true }).click()
  await page.waitForTimeout(300)

  // the cat reacts and can be switched
  await go(page, 'settings')
  const cat = page.locator('.cat.live').first()
  if (await cat.count()) { await cat.click(); await page.waitForTimeout(150); ok('clicking the cat triggers a reaction', !!(await cat.getAttribute('data-reaction'))) }
  else ok('clicking the cat triggers a reaction', true, 'no live cat on this page')
  await page.locator('[data-breed="tabby"]').click()
  await page.waitForTimeout(300)
  ok('switching companion takes effect', (await page.locator('.cat.breed-tabby').count()) > 0)
  await page.reload(); await page.waitForSelector('.page')
  ok('the companion choice persists', (await page.locator('.cat.breed-tabby').count()) > 0)
  await page.locator('[data-breed="emi"]').click()
  ok('no companion is locked behind a reward', (await page.locator('.comp.locked').count()) === 0)

  // quick capture
  await page.getByRole('button', { name: /Add anything/ }).click()
  await page.locator('#capture').fill('FNCE 445 quiz friday 20% ~3h')
  await page.waitForTimeout(250)
  const chipText = (await page.locator('.chips-row').innerText()).replace(/\s+/g, ' ')
  ok('capture parses one line into chips', /FNCE 445/.test(chipText) && /Test/.test(chipText) && /20%/.test(chipText) && /3h/.test(chipText), chipText)
  await page.locator('.pchip-kind .pchip-x').click()
  await page.waitForTimeout(150)
  ok('removing a chip returns its word to the title', (await page.locator('.row-between .note').first().innerText()).includes('quiz'))
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.waitForTimeout(400)
  await go(page, 'schedule/agenda')
  ok('capture adds the item', (await page.getByText('quiz', { exact: false }).count()) > 0)

  // the #/add?t= door
  await page.goto(BASE + '#/add?t=' + encodeURIComponent('MGST 451 read ch 9 tomorrow'))
  await page.waitForTimeout(500)
  ok('the #/add URL opens capture prefilled', (await page.locator('#capture').inputValue()).includes('MGST 451'))
  await page.keyboard.press('Escape')

  // export → reset → import
  await go(page, 'settings/data')
  const beforeReset = await page.locator('#data-h p.note').first().innerText()
  const d1 = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export data (JSON)' }).click()
  const f1 = join(TMP, 'export1.json'); await (await d1).saveAs(f1)
  await page.getByRole('button', { name: 'Reset to seed…' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Reset' }).click()
  await page.waitForTimeout(500)
  const afterReset = await page.locator('#data-h p.note').first().innerText()
  ok('reset to seed changes the data', beforeReset !== afterReset)
  await page.locator('[data-testid="import-input"]').setInputFiles(f1)
  try { await page.getByRole('dialog').getByRole('button', { name: 'Replace' }).waitFor({ timeout: 8000 }) }
  catch { console.log('IMPORT DEBUG dialogs=' + (await page.getByRole('dialog').count()) + ' err=' + JSON.stringify(await page.locator('p.bad').allInnerTexts()) + ' bytes=' + readFileSync(f1, 'utf8').length) }
  await page.getByRole('dialog').getByRole('button', { name: 'Replace' }).click()
  await page.waitForTimeout(600)
  const d2 = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export data (JSON)' }).click()
  const f2 = join(TMP, 'export2.json'); await (await d2).saveAs(f2)
  ok('export → reset → import round-trips', JSON.stringify(JSON.parse(readFileSync(f1, 'utf8')).data) === JSON.stringify(JSON.parse(readFileSync(f2, 'utf8')).data))
  await page.waitForTimeout(600)
  await page.reload(); await page.waitForSelector('.page'); await page.waitForTimeout(400)
  const d3 = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export data (JSON)' }).click()
  const f3 = join(TMP, 'export3.json'); await (await d3).saveAs(f3)
  const a3 = JSON.parse(readFileSync(f3, 'utf8')).data, a1 = JSON.parse(readFileSync(f1, 'utf8')).data
  const same = ['items', 'grades', 'practice', 'mastery', 'events', 'xp', 'sessions'].every(k => JSON.stringify(a3[k]) === JSON.stringify(a1[k]))
  ok('data survives a reload', same, same ? '' : Object.keys(a1).filter(k => JSON.stringify(a3[k]) !== JSON.stringify(a1[k])).join(','))
  writeFileSync(join(TMP, 'bad.json'), '{"hello":1}')
  await page.locator('[data-testid="import-input"]').setInputFiles(join(TMP, 'bad.json'))
  await page.waitForTimeout(300)
  ok('a file that is not a backup is refused', (await page.locator('[role="alert"]').count()) > 0)
  await ctx.close()
}

/* ---------------- reduced motion ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
  const page = await ctx.newPage(); watch(page, 'reduced')
  await go(page, 'home')
  ok('reduced motion puts the cat in calm mode', (await page.locator('.cat.calm').count()) > 0 && (await page.locator('[data-cat-mode="full"]').count()) === 0)
  await ctx.close()
}

/* ---------------- the installable build updates itself ---------------- */
{
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const man = await (await page.request.get(BASE + 'manifest.webmanifest')).json()
  ok('the manifest carries home-screen shortcuts', (man.shortcuts || []).length === 3, (man.shortcuts || []).map(x => x.short_name).join(', '))
  const sw = await (await page.request.get(BASE + 'sw.js')).text()
  ok('the service worker takes over without being unregistered', /skipWaiting\(\)/.test(sw) && /clientsClaim\(\)/.test(sw) && /cleanupOutdatedCaches/.test(sw))
  const app = await (await page.request.get(BASE + 'index.html')).text()
  const js = (app.match(/assets\/index-[\w-]+\.js/) || [])[0]
  const code = js ? await (await page.request.get(BASE + js)).text() : ''
  ok('a new version offers a reload while the page is open', /New version available/.test(code))
  await ctx.close()
}

/* ---------------- screenshots ---------------- */
const PAGES = [['dashboard', 'home'], ['calendar-week', 'schedule/week'], ['calendar-day', 'schedule/day'], ['courses', 'study'], ['course-fnce445', 'study/fnce-445/learn'], ['practice', 'study/fnce-445/practice'], ['progress', 'study/fnce-445/progress'], ['focus', 'garden'], ['grades', 'grades'], ['settings', 'settings'], ['settings-calendars', 'settings/calendars']]
for (const [w, h, scheme] of [[1280, 900, 'light'], [390, 844, 'light'], [1280, 900, 'dark']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme })
  const page = await ctx.newPage(); watch(page, `${w}-${scheme}`)
  if (scheme === 'dark') { await go(page, 'settings'); await page.getByRole('radio', { name: 'Dark' }).click(); await page.waitForTimeout(300) }
  for (const [name, hash] of PAGES) {
    if (w === 390 && name.startsWith('calendar-w')) continue
    if (scheme === 'dark' && !['dashboard', 'calendar-week', 'course-fnce445', 'grades'].includes(name)) continue
    await go(page, hash); await page.waitForTimeout(500)
    await page.screenshot({ path: `${SHOTS}/${w}-${scheme}-${name}.png`, fullPage: true })
  }
  await ctx.close()
}

/* ---------------- no horizontal overflow at 360 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 360, height: 760 } })
  const page = await ctx.newPage(); watch(page, '360')
  const bad = []
  for (const h of ['home', 'schedule/day', 'schedule/week', 'schedule/month', 'schedule/agenda', 'study', 'study/fnce-445/learn', 'study/fnce-445/practice', 'study/fnce-445/assignments', 'study/fnce-445/progress', 'garden', 'grades', 'settings', 'settings/calendars', 'settings/study', 'settings/classes', 'settings/data']) {
    await go(page, h)
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    if (sw > 360) bad.push(`${h}: ${sw}px`)
  }
  ok('no horizontal overflow at 360px', bad.length === 0, bad.join(', '))
  await page.screenshot({ path: `${SHOTS}/360-light-dashboard.png`, fullPage: true })
  await ctx.close()
}

await browser.close()
ok('no console errors and no page errors', errors.length === 0, errors.slice(0, 6).join(' | '))
writeFileSync(`${SHOTS}/verify-results.json`, JSON.stringify({ results, errors }, null, 2))
const failed = results.filter(r => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
