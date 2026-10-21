# Berry Study

A calm study dashboard for Fall 2026 at Haskayne (FNCE 477, FNCE 445, MGST 451, SGMA 591). It keeps the
content and logic of the old single-file *Course Desk* — the schedule and daily priorities, the gradebook and
projected GPA, formula sheets, the FNCE 445 quiz-style bank with trap answers, the assignment coach, endless
drills, flashcards and the FNCE 477 quiz decks — and adds a real calendar, a scheduler that works out when to
study, test readiness, what-if grades, Google Calendar and D2L, and Emi.

**Look:** a Notion-style student dashboard. Warm cream, linen panels, hairline borders, a serif for page titles
(Newsreader), Inter Tight for everything else, and a handwritten note or two in Caveat. The event palette is
strawberries and matcha: sage `#9CAD8C`, pistachio `#DDE0BC`, linen `#ECE9E5`, blush `#F0CBD7`, rose `#E9B5BD`,
strawberry `#CE859A`, deep rose `#D2828B`, with those last three deepened where text needs contrast. Light is the
default; the dark theme is a deep matcha-charcoal. Icons are Lucide at 1.5px. No gradients, glows or stickers.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check, then dist/ (PWA) and dist-single/index.html
npm run preview      # serve dist/ at http://localhost:4173
npm test             # vitest: scheduler, readiness, grades, .ics, D2L, backups
npm run verify       # Playwright end-to-end (needs the preview server running)
npm run icons        # regenerate the favicon and PWA icons from Emi's head
```

- `dist/` is the installable PWA: manifest, service worker, offline cache of the app shell, fonts and PDFs.
- `dist-single/index.html` is one self-contained file (fonts and both PDFs inlined, PWA off) to open straight
  from disk. It keeps its own data, separate from the hosted copy, because browsers store data per site.

## Deploy to GitHub Pages

1. Push to the repo and open **Settings → Pages**, then set **Source** to **GitHub Actions**.
2. `.github/workflows/deploy.yml` builds with `npm run build:pwa` and publishes `dist/`.
3. It serves at `https://<user>.github.io/berry-study/`.

Vite's `base` is `./` and routing is hash-based (`#/schedule/week`, `#/study/fnce-445/practice`), so it works
from any sub-path. Set `BASE_PATH=/berry-study/` to force an absolute base.

**Install it.** iPhone: open in Safari, then **Share → Add to Home Screen**. Desktop Chrome: the install icon in
the address bar. After the first visit it works offline.

## The app

**Dashboard** — Emi's scene (it changes with the time of day and season, and she wanders in it), the streak and
xp chips, then: Ready to study?, today's timeline, today's priorities, suggested study blocks, updates from D2L,
and the four course tiles.

**Calendar** — a real week grid (7am–11pm, 15-minute snapping), plus day, month and the old agenda list.
Deadlines and exams are all-day chips, connected calendars show as busy time, accepted study blocks are solid
and suggestions are dashed with Accept / Skip. Double-click an empty slot to add a block.

**Courses** — every course has the same four sections, whatever material exists:

| Section | What's in it |
|---|---|
| Learn | Formula sheet, key concepts or frameworks, and the course PDFs |
| Practice | One surface: quiz-style questions, drills, flashcards, decks, the prof's practice set |
| Assignments | What's due, the step-by-step coach for the current one, earlier ones collapsed |
| Progress | Readiness, weakest topics, practice history, study time |

The page opens with one recommended action ("Midterm exam in 14 days · 20% ready · start with forward with
discrete dividends") and a Start button. Thin courses show the same four sections with a note about what would
fill them in.

**Focus** — a timer with Emi loafing beside it, this week's sessions, and Flora logging.

**Grades** — a report card per course with the projected GPA, what it takes to hold or raise a letter, and
**what if** sliders on anything unmarked.

**Settings** — appearance and cat animations, the companion picker, calendars, classes, study time, and data.

## Smart scheduling

`src/lib/scheduler.ts` is deterministic — no AI. It estimates effort, finds free time and places blocks.

- **Effort:** test `1.5h + 0.2h` per weight-%, deadline `1h + 0.15h` per weight-%, class prep `0.75h`, and
  quizzes worth 5% or less capped at 2h. Editable per item (Agenda → Edit → "Study time needed").
- **Placement:** earliest deadline first, spread over days (at most two blocks for one item per day), the last
  block before a test is review, and the weakest topic for that test goes in the title.
- **Busy:** events from connected calendars, work shifts, attended classes, and blocks you already accepted,
  each with a gap around them.
- **Preferences:** a study window per weekday (9:00–22:00), at most 4h a day, 50-minute blocks, 10-minute
  breaks, 15-minute gaps, and days you mark as off.

**Work shifts.** Anything matching shift/banquet/Hotel Arts/Mejuri/work, or on a calendar tagged Work, counts as
a shift. No study for 60 minutes after one; after a shift of 5h or more, the rest of that day gets one light
block of 30 minutes at most; a day with 8h or more of shifts is light review only. Those days are tagged in the
calendar. All four numbers are editable.

**Classes.** Add when each class meets in Settings → Classes. A class you attend is busy time and gets an
optional 30-minute pre-read. A class marked "I self-study instead" (on by default for FNCE 445) frees that hour
and gets a self-study block on that week's topic, taken from the week's class-prep items and their readings.

**Readiness.** For each upcoming test: 75% topic knowledge, 25% study already done. Knowledge is the mean
accuracy over the topics that test covers — mapped through the course's question types, concepts and deck topics
— where topics never practised count as zero and accuracy older than 14 days decays by half every further 14
days. It shows on the test chip, the dashboard and the course page, with the weakest three topics linked
straight to that drill or quiz.

## Calendars

**Google (live, from the browser).** Settings → Calendars. Paste a Google OAuth Client ID; it's stored on the
device, and `VITE_GOOGLE_CLIENT_ID` can bake one in. To make one:

1. Google Cloud console → create a project.
2. APIs & Services → enable the **Google Calendar API**.
3. **OAuth consent screen**: External, publishing status Testing, add your own Google address as a test user.
4. Credentials → **OAuth client ID** → Web application.
5. Authorized JavaScript origins: `https://annika-fajardo.github.io` and `http://localhost:4173`.

Berry Study then reads the calendars you tick (for the visible range plus two weeks, with transparent and
declined events treated as free) and can write accepted study blocks to the calendar you choose. Written events
are titled "Study: …", take a colour matching the course and carry `extendedProperties.private.berryStudy="1"`,
so the app only ever edits or deletes its own events. It re-checks on open and every 15 minutes.

**Apple Calendar.** Either share the iCloud calendar as a public link and add it to Google (Other calendars →
+ → From URL) so it arrives with everything else, or import a `.ics` file in Settings as a read-only source.
"Export study blocks (.ics)" gives a file you can open on a Mac or iPhone to add them to Apple Calendar.

**D2L / Brightspace.** In D2L: Calendar → Subscribe, copy the URL. In Google Calendar: Other calendars → + →
From URL, paste. Then tick **D2L** next to that calendar in Settings. D2L dates show as deadline chips rather
than busy time, and anything new or moved appears in "Updates from D2L" with Add, Update date or Ignore.
Nothing is changed automatically. Google can take a few hours to pick up changes to the feed.

Without a Client ID the calendar still works with your own events, imported `.ics` files and suggestions.

## Emi

The tuxedo cat is drawn from photos of the real Emi: a soft blob silhouette with feathered edges, small wide
ears, green ring eyes set low and wide, long white whiskers, a white chin patch, a small bib into a belly
streak, white boots on all four paws (higher at the back) and a long black tail.

She is one component (`src/components/Cat.tsx`) with a small behaviour machine: breathing, blinks every 3–7
seconds, ear twitches, a tail swish, the odd yawn or head tilt; her eyes follow the pointer; tapping her gets a
random reaction (squish, "?", a squiggle mrrp, rolling over, a purr) and five quick taps send her zooming off
and back; hovering is petting and a long press makes her loaf. She wanders the scene and the Focus panel at most
once every 45 seconds, never while a quiz question is open. She reacts to the app: a hop when you tick something,
a slow blink when you're right, a head tilt and "?" when you're not, a spinner on her head while Google syncs,
the megaphone for overdue work, a scribble bubble when there are no free slots, a loaf by the running timer, a
stretch when it finishes, and a proud sit on a level-up.

**Settings → Companion** switches her for Tabby, Smoke, Pip or Mochi, each with its own timing and quirks
(Tabby loafs and yawns, Smoke is shy, Pip has zoomies, Mochi talks). Void unlocks at level 10 and Goldie at a
30-day streak. Emi is the default and never locked. **Cat animations: Full / Calm / Off** is in Settings, and
reduced-motion defaults to Calm.

## Data and backups

- Everything is stored **on this device** in IndexedDB. Nothing is sent anywhere except to Google, if you
  connect it, straight from the browser.
- First launch imports `src/data/seed.json`, the Course Desk export, and migrates it. All the old document ids
  are kept, so practice and mastery history still matches.
- **Export** writes one JSON file with the whole state. **Import** validates it, then offers Replace or Merge.
  It also accepts a raw Course Desk export. Export → reset → import round-trips exactly, and the tests check it.
- **Reset to seed** restores the original data and keeps your theme, companion, calendars, classes and prefs.
- Storage sits behind `StorageAdapter` (`src/store/storage.ts`), so a cloud adapter (Supabase, say) can be
  added without touching the UI. Migrations are keyed by schema version in `src/store/migrate.ts` (now v3).
- "Today" always comes from the device's local date, which is Calgary time on your devices.

## xp

Ticking a task is 5–55 xp (class prep 5, deadline 15, test 25, plus 1 per weight-% capped at 30); un-ticking
takes it back. Each correct answer is 10, a first try on the practice set or an assignment check adds 5, a clean
round or deck adds 30, and a finished focus or Flora session is 1 per minute. xp is a ledger, so totals, levels
and streaks are recomputed from it and nothing can pay out twice. Levels run Seed → Sprout → … → Matcha Master
and beyond; a level-up is a small toast with the cat, not confetti.

## Decisions

- **Old history counts.** Done tasks, past correct answers and Course Desk study time became dated xp on first
  launch, so she starts at level 6 rather than zero.
- **No AI.** The adaptive quiz became a concept quiz built from each course's own concepts; written deck answers
  are self-marked against the key points. An AI module could slot in where `startRound` and `score` live.
- **Finance maths is verbatim.** `COURSE_CONTENT`, `DRILLS`, `QTYPES`, `buildQ`, `pickQTypes` and the helpers
  were lifted from `course-desk.html`; only type annotations changed, and `pickQTypes` takes mastery as an
  argument instead of reading a global. `prioritize()`, `courseStats()`, `letterFor()` and `needLine()` were
  ported line for line.
- **Colours and contrast.** Every text/background pair passes WCAG AA in both themes, which is why the text
  strawberry is `#A04B5D` rather than the raw `#CE859A`.
- **Motion** is hand-rolled CSS on transform and opacity only, and stops under `prefers-reduced-motion`.

## File tree

```
src/
  main.tsx, App.tsx        boot; sidebar / top bar + drawer / 4-item bottom bar
  components/              Cat (poses, behaviour, breeds), Scene, ui (Panel, ViewTabs, PageHead, Empty), Modal, Overlays
  data/                    courses, ported content and drills, seed.json
  lib/                     scheduler, readiness, calendar, google, ics, d2l, work, schedule, grades, game, backup, time, dates, router, events
  store/                   types, store (one save path), storage adapters, migrations, seed, actions
  views/                   Dashboard, Calendar (+ Agenda, D2lPanel), Courses (+ Quizzes, CourseTile), Focus, Grades, Settings, QuickCapture
  styles/                  app.css (tokens and layout), cat.css (Emi's animations)
public/                    PDFs, favicon, PWA icons
scripts/                   verify.mjs (Playwright), gen-icons.mjs
screenshots/v2/            current screenshots      screenshots/progress/  milestone shots + LOG.md
```
