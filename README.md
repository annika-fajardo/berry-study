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
npm run build        # type-check, then dist/ (the PWA)
npm run preview      # serve dist/ at http://localhost:4173
npm run deploy       # build, then force-push dist/ to the gh-pages branch (--dry stages without pushing)
npm test             # vitest: scheduler, readiness, grades, .ics, D2L, backups
npm run verify       # Playwright end-to-end (needs the preview server running)
npm run icons        # regenerate the favicon and PWA icons from Emi's head
```

- `dist/` is the installable PWA: manifest, service worker, offline cache of the app shell, fonts and PDFs.
  The manifest carries three shortcuts (Start 25 min, Add a deadline, Today), the app icon shows a badge with
  the number of overdue items where the browser supports it, and storage asks to be made persistent on boot.

## Deploy to GitHub Pages

Pages serves the **`gh-pages` branch**, which holds a prebuilt `dist/`. Actions never fires on this repo, so
`.github/workflows/deploy.yml` is kept only for reference — it is unused, and pushing to `main` deploys nothing.

```bash
npm run deploy        # build, then force-push dist/ to gh-pages
npm run deploy -- --dry   # build and stage .deploy/ without pushing, to see what would go up
```

`scripts/deploy.mjs` builds, copies `dist/` into a scratch clone under `.deploy/`, adds `.nojekyll` and
force-pushes `gh-pages`. Your working tree is never touched. In **Settings → Pages**, Source is
**Deploy from a branch** → `gh-pages` / `/ (root)`. It serves at `https://<user>.github.io/berry-study/`.

Vite's `base` is `./` and routing is hash-based (`#/schedule/week`, `#/study/fnce-445/practice`), so it works
from any sub-path. Set `BASE_PATH=/berry-study/` to force an absolute base.

**Updates.** The service worker is built with `registerType: 'autoUpdate'` plus `skipWaiting`, `clientsClaim`
and `cleanupOutdatedCaches`, so a new build takes over by itself and the old caches are dropped — nobody has to
unregister anything or clear site data, which is what v2 needed. The app also re-checks for a new version on
focus and every 30 minutes, and if one lands while the page is open it says **New version available · Reload**.

**Install it.** iPhone: open in Safari, then **Share → Add to Home Screen**. Desktop Chrome: the install icon in
the address bar. After the first visit it works offline.

## The app

**Dashboard** — **Right now** comes first, above everything, on every screen size: one card with the course, the
action, how long it should take, a Start button, one clause of why ("Quiz 5 was yesterday. You're 53% ready, and
this topic is untouched"), and **Not this** to move on, which is remembered for the rest of that day. It is built
from `prioritize()` × `readiness().weak` × `schedule()`; on a quiet day it offers a way to get ahead instead.

Under it, the **capacity sentence**: "7h 45m of work before Sunday · 20h free · two blocks won't fit", with
**Fix** offering Shrink, Borrow or Accept when it doesn't fit. Then "since you were last here" if she's been
away, Emi's scene, the next three priorities, the four course tiles, today's timeline, the next test with its
readiness, at most two suggested blocks per day, and updates from D2L.

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

**Grades** — a report card per course: the projected GPA (weighted by course units), what the course is tracking
at, an **A at best · B+ likely · F at worst** band, what it takes to hold or raise a letter, and a **Need**
column saying what each unmarked item has to score on its own. **What if** sliders on anything unmarked feed all
of it — the need lines move with the sliders, which they did not in Course Desk. Marks above 100 are accepted as
bonus and reported; a category scheme (FNCE 445's assignments / quizzes / midterm / participation / final) shares
its weight across its rows and can drop the lowest N; and a per-course rounding policy says when exact and
rounded land on different letters.

**Add anything** — one field. "FNCE 445 quiz friday 20% ~3h" becomes correctable chips for course, kind, date,
weight and effort; removing a chip puts its words back in the title. `#/add?t=…` opens it prefilled, which is
what the home-screen shortcut and an iOS Shortcut use, and dropping an `.ics` file on the window still imports.

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

**Readiness.** For each upcoming test: 75% topic knowledge, 25% study already done. Every topic is in one of
three states — not started, weak or solid. Knowledge is the mean accuracy over the topics she has actually
practised; **a topic she has never opened is left out rather than counted as zero**, and the card says "9 of 15
topics tracked" so the number is honest about what it covers. A course with no practice behind it at all says so
instead of showing 0%. Accuracy older than 14 days decays by half every further 14 days. Topics render as
tappable bars, weakest (and never-started) first, each linking straight to that drill or quiz.

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
(Tabby loafs and yawns, Smoke is shy, Pip has zoomies, Mochi talks). Every companion is available from the
start: nothing is locked behind xp or a streak. **Cat animations: Full / Calm / Off** is in Settings, and
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
  added without touching the UI. Migrations are keyed by schema version in `src/store/migrate.ts` (now v4; v4
  attaches FNCE 445's rows to their real weighting categories and adds the per-course rounding policy).
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
- **No AI, and no invented questions.** Only FNCE 445 and FNCE 477 have real question banks, so only they offer
  quizzes. The other courses say plainly that there's no question bank yet and point at what is there (formula
  sheets, readings, the assignment coach) rather than generating filler from a concept list. Written deck
  answers are self-marked against the key points. An AI module could slot in where `startRound` and `score` live.
- **Honest numbers over full ones.** Readiness leaves untracked topics out instead of scoring them zero, the
  grade card refuses to print a need line for a course with nothing graded, and the capacity sentence names the
  work that will not fit rather than quietly dropping it.
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
  lib/                     scheduler, rightnow, capacity, readiness, calendar, google, ics, d2l, work, schedule, grades, parse, game, backup, time, dates, router, events
  store/                   types, store (one save path), storage adapters, migrations, seed, actions
  views/                   Dashboard, RightNow (+ capacity line, Fix sheet), Digest, Calendar (+ Agenda, D2lPanel), Courses (+ Quizzes, CourseTile), Focus, Grades, Settings, QuickCapture
  styles/                  app.css (tokens and layout), cat.css (Emi's animations)
public/                    PDFs, favicon, PWA icons
scripts/                   verify.mjs (Playwright), gen-icons.mjs
screenshots/v3/            current screenshots      screenshots/progress/  milestone shots + LOG.md
```
