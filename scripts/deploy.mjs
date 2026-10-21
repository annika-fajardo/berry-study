/* Publish dist/ to the gh-pages branch, which is what GitHub Pages serves for this repo.
   GitHub Actions never fires here, so the branch carries a prebuilt dist/ instead.

   npm run deploy            # build, then force-push dist/ to gh-pages
   npm run deploy -- --dry   # build and stage the branch, but don't push

   It works in a scratch clone under .deploy/ so the working tree is never touched, and it
   force-pushes: gh-pages is a build output, not history worth keeping. */
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync, mkdirSync, cpSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DRY = process.argv.includes('--dry')
const BRANCH = 'gh-pages'
const WORK = '.deploy'
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts })
const out = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', ...opts }).trim()

// 1. a clean production build
run('npm', ['run', 'build'])
if (!existsSync('dist/index.html')) { console.error('dist/index.html is missing — the build did not finish.'); process.exit(1) }

// 2. a scratch worktree holding only the built files
const remote = out('git', ['remote', 'get-url', 'origin'])
const sha = out('git', ['rev-parse', '--short', 'HEAD'])
rmSync(WORK, { recursive: true, force: true })
mkdirSync(WORK, { recursive: true })
run('git', ['init', '-q', '-b', BRANCH], { cwd: WORK })
run('git', ['remote', 'add', 'origin', remote], { cwd: WORK })
cpSync('dist', WORK, { recursive: true })
writeFileSync(join(WORK, '.nojekyll'), '') // keep Pages from hiding files that start with _
run('git', ['add', '-A'], { cwd: WORK })
run('git', ['-c', 'user.name=berry-deploy', '-c', 'user.email=deploy@localhost', 'commit', '-q', '-m', `Deploy ${sha}`], { cwd: WORK })

// 3. publish
if (DRY) { console.log(`\nStaged ${WORK}/ for ${BRANCH} (dry run — nothing pushed).`); process.exit(0) }
run('git', ['push', '--force', 'origin', `${BRANCH}:${BRANCH}`], { cwd: WORK })
rmSync(WORK, { recursive: true, force: true })
console.log(`\nPushed dist/ (${sha}) to ${BRANCH}. Pages serves it in a minute or two; the service worker updates itself on the next visit.`)
