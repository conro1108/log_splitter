# CLAUDE.md

log_splitter is a 3D log-splitting sim (a task-satisfaction game, deployed
statically on Vercel). Read the log, aim, swing. Not a tap-timing game
wearing a chopping skin — the wood (grain, knots, species) is the puzzle.

TypeScript + Vite + Three.js, no framework. `src/core/` is pure logic (log
generation, split resolution, layout, session/save) and is
the only part with tests. `src/render/` builds the Three.js scene, meshes,
and textures. `main.ts` orchestrates. Tests are Vitest, colocated as
`*.test.ts`.

`npm run dev` / `npm test` / `npm run typecheck` / `npm run build`.

Mobile-first: the target is an iOS PWA, so portrait on a phone is the
primary viewport and desktop is the wide end of the same layout. Camera
framing comes from `cameraFrameFor(aspect)` in `src/render/scene.ts`.

## Core stays pure

Anything that decides game outcomes (toughness, crack progress, swing
power/accuracy, what counts as a split) belongs in `src/core/` and gets a
test. `src/render/` and `main.ts` should only read `core` state and draw —
if a rendering file starts making gameplay decisions, that logic moved to
the wrong layer.

Difficulty is a tested contract, not a vibe: `split.test.ts` asserts how
many committed blows each kind of round takes. Retune there first.

## Verifying visuals costs real CPU

Unit tests can't catch a bad camera or a mesh that reads wrong, so check
rendering changes with a headless screenshot. But headless Chromium
rasterizes WebGL in software: a long driving session pegs a core and
climbs, since the woodpile only grows. Keep it cheap — drive the game
through `window.__ls.strikeAt()` rather than hunting for the log with
mouse moves, screenshot and close each context immediately, and put a
watchdog timeout in the script.

This project merges straight to `main` — no feature branches or PRs.

Always commit and push after completing a piece of work, without asking for
confirmation first. Always `git pull` before pushing, in case downstream
changes have landed — this is still single-threaded on `main`, just cheap
insurance.
