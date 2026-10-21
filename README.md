# Berry Study

A playful, offline-first study app for Fall 2026 at Haskayne (FNCE 477, FNCE 445, MGST 451, SGMA 591).
It replaces the single-file *Course Desk* and keeps its content and logic: the schedule and daily priorities,
the gradebook with projected GPA, formula sheets, the FNCE 445 quiz-style bank with trap answers, the
Assignment 2 coach, endless drills, flashcards and the FNCE 477 quiz decks. On top of that it adds XP, levels, a
streak, a focus timer that grows a garden, Flora logging, and two characters: **Berry** the strawberry and your
**tuxedo cat** (name her in Settings; the default is "Tux").

Look and feel: "matcha strawberry". The palette is strawberry `#C66F80`, pink `#F4C7D0`, blush `#FCEBF1`,
matcha dark `#4A6644`, matcha `#9FAA74`, pistachio `#D7DAB3` and oat cream `#ECE3D2`. Display type is Fraunces
italic, UI text is Nunito and formulas are in JetBrains Mono, all self-hosted. There is a dark mode
("matcha latte at night") plus Auto/Light/Dark in Settings.

## Run it locally

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check, then build dist/ (PWA) and dist-single/index.html
npm run preview      # serve dist/ at http://localhost:4173
```

- `dist/` is the installable PWA (manifest, service worker, offline cache of the app shell, fonts and PDFs).
- `dist-single/index.html` is one self-contained file with everything inlined, including fonts and both PDFs, and
  with the PWA turned off. Open it straight from disk (double-click) as a fallback. It keeps its own data, separate
  from the hosted app, because browsers store data per site. Use Export/Import to move data between them.

### Verify

```bash
npm run build
npx vite preview --port 4173 &
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npm run verify   # or omit the env var after `npx playwright install chromium`
```

`scripts/verify.mjs` drives Chromium through the app and writes screenshots and `verify-results.json` to
`screenshots/`. `npm run icons` regenerates `public/favicon.svg` and the PNG icons from the Berry SVG component.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repo, for example `berry-study`, on the `main` branch.
2. In the repo, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. The included workflow `.github/workflows/deploy.yml` builds with `npm run build:pwa` and publishes `dist/`
   using the official `configure-pages`, `upload-pages-artifact` and `deploy-pages` actions.
4. The app is served at `https://<user>.github.io/berry-study/`.

It works under any sub-path because Vite's `base` is `./` (relative URLs) and routing uses the hash
(`#/schedule`, `#/courses/fnce-445/adaptive`, and so on). To force an absolute base, set `BASE_PATH=/berry-study/`
when building.

**Install it.** On iPhone, open the site in Safari, then tap **Share → Add to Home Screen**. In desktop Chrome, use
the install icon in the address bar. After the first visit it works offline.

## Data and backups

- Everything is stored **on this device** in IndexedDB (via `idb-keyval`). Nothing is sent anywhere.
- On first launch the app imports `src/data/seed.json`, your Course Desk export, as schema v1 and migrates it to
  the current schema. All of the old app's document ids (`items/a01`, `grades/g445-01`, `practice/pq1`,
  `mastery/fnce-445--qt-arb`, `deckruns/fnce477-d1--1` …) are kept, so practice and mastery history still matches.
- **Settings → Export data** downloads one JSON file (`{ app, schema, exportedAt, data }`) holding the whole state.
  **Import** checks the file, then lets you **Replace** everything or **Merge** (imported records win on matching
  ids). It also accepts a raw Course Desk export. Export → reset → import round-trips exactly, and the verification
  script checks this.
- To move to another device: Export on the old one, send yourself the file, then Import on the new one.
- **Reset to seed** goes back to the original Course Desk data. Your theme and cat name are kept.
- Design: one in-memory store (`src/store/store.ts`). Every change goes through `update()`, which leads to one
  debounced `save()` path. Storage sits behind the `StorageAdapter` interface (`src/store/storage.ts`). To add
  cloud sync (for example Supabase), implement `load/save/clear` against a table holding the state, or per
  collection, and return it from `pickAdapter()`. No UI changes are needed. Migrations are keyed by schema version
  in `src/store/migrate.ts`.
- "Today" always comes from the device's local date, which is Calgary time on your devices.

## Flora logging

Flora has no public API and doesn't share data with other apps. On **Focus**, use **Log a Flora session**: enter
the minutes, course and date. It plants exactly what a built-in session of that length would (a little flower under
25 minutes, a strawberry plant for 25 or more, a matcha bush for 50 or more), adds the minutes to that day's study
time, and gives the same XP (1 per minute). Tap any plant in the garden to remove one logged by mistake; its
minutes and XP come off too.

## Gamification rules

| Action | XP |
|---|---|
| Tick a task | class prep 5, deadline 15, test 25, plus 1 per weight-% point (bonus capped at 30). Un-ticking removes it. |
| Correct quiz, drill, concept-quiz or assignment-check answer | 10 |
| First-try bonus (prof's practice set, assignment checks) | +5 |
| Clean round (10/10 quiz-style or concept quiz, or every deck MC right) | +30 |
| Focus or Flora session | 1 per minute (only for a completed session) |

- XP is a **ledger** (`state.xp`), and totals, levels and streaks are always recomputed from it. Entries carry a
  `ref`, such as `item:a01` or `check:a2-1a-0`, so the same thing can't pay out twice.
- Levels rise on a curve (steps of 100, 160, 220 …): Seed → Sprout → Bud → Blossom → Berry → Ripe Berry →
  Matcha Master → Jam Jar → Berry Patch → Strawberry Moon → Orchard Keeper → Matcha Sage → Grand Gardener →
  Matcha Legend N.
- The streak counts consecutive days with at least one XP action. Berry gets sleepy after 2+ days with none.
- Stopping a timer early wilts that plant. The minutes still count as study time but earn no XP.

## Decisions I made

- **Old history counts.** On first launch, done tasks, past correct answers (practice and mastery) and Course Desk
  study time became XP entries dated when they happened. So you start at level 6 with a 2-day streak, not at zero.
  The Course Desk study timer minutes appear as a plant in the garden archive.
- **No AI.** "Ask Claude", "Plan my day" and the written-answer feedback are gone. Written answers in the
  Assignment 2 coach are still saved on the device. For courses without a quiz bank (FNCE 477, MGST 451,
  SGMA 591), the AI-written adaptive quiz became a **concept quiz**: multiple choice built from the course's own
  concepts. You read a description with its name hidden and pick the concept. Wrong options are neighbouring
  concepts, each explained. It uses the old weighting (`pickTargets`) and writes to the same `mastery` ids.
  Written deck answers that used to be AI-marked can now be **self-marked** against the key points. An AI module
  could plug in later where `startAdaptive`/`score` live (`src/views/Quizzes.tsx`).
- **Finance maths is verbatim.** `COURSE_CONTENT`, `DRILLS`, `QTYPES`, `buildQ`, `pickQTypes`, `rnd/ri/f2/ncdf/bsCall`
  were sliced straight from `course-desk.html` into `src/data/content.ts` and `src/data/drills.ts`. The only
  changes are type annotations, and `pickQTypes` now takes `mastery` as a parameter instead of reading a global.
  `prioritize()`, `courseStats()`, `letterFor()` and `needLine()` were ported line for line
  (`src/lib/schedule.ts`, `src/lib/grades.ts`).
- **The course study timer moved to Focus.** The old per-course count-up timer is now the Focus timer, a
  countdown with 25/50/custom lengths. Each course page links to it with that course preselected. Minutes still
  go to the old `study/<date>` documents.
- **Colours.** Course colours come from the palette family: matcha (477), strawberry (445), cocoa (451) and
  plum (591). Every text/background pair passes WCAG AA in both themes. Button text on strawberry uses a deeper
  strawberry, `#A84D62`, to reach 5.3:1.
- **Motion.** Hand-rolled CSS animations instead of Framer Motion, to keep the bundle small. All motion stops
  under `prefers-reduced-motion`.
- **Characters.** Original inline SVG in a shared "mochi" style: chubby silhouettes, flat fills and a soft-ink
  outline drawn as an outline pass plus a fill pass, with a cream sticker halo so they read in dark mode.
  Berry has six moods. The tuxedo cat has five poses (sit, loaf, sleep, stretch, jump) and a slow blink.

## File tree

```
src/
  main.tsx, App.tsx             boot, shell (bottom tabs / left rail), onboarding, timer watcher
  data/content.ts, drills.ts    ported course content, drill generators, FNCE 445 quiz bank
  data/courses.ts, seed.json    COURSES/LET/PTS/KIND, the Course Desk export
  lib/                          schedule, grades, game (XP/levels/streak), backup, concepts, router, events
  store/                        types, store (single save path), storage adapters, migrations, seed, actions
  components/                   Characters (Berry, TuxCat, Plant, CourseIcon), Modal/Confirm, overlays, icons
  views/                        Today, Schedule, Courses (+ Quizzes), Focus & Garden, Grades, Settings
public/                         PDFs, favicon, PWA and Apple icons
scripts/                        verify.mjs (Playwright), gen-icons.mjs
```
