# CLAUDE.md

log_splitter is a 3D log-splitting sim (a task-satisfaction game, deployed
statically on Vercel). Read the log, aim, swing. Not a tap-timing game
wearing a chopping skin — the wood (grain, knots, species) is the puzzle.

TypeScript + Vite + Three.js, no framework. `src/core/` is pure logic (log
generation, split resolution, swing analysis, layout, session/save) and is
the only part with tests. `src/render/` builds the Three.js scene, meshes,
and textures. `main.ts` orchestrates. Tests are Vitest, colocated as
`*.test.ts`.

`npm run dev` / `npm test` / `npm run typecheck` / `npm run build`.

## Core stays pure

Anything that decides game outcomes (toughness, crack progress, swing
power/accuracy, what counts as a split) belongs in `src/core/` and gets a
test. `src/render/` and `main.ts` should only read `core` state and draw —
if a rendering file starts making gameplay decisions, that logic moved to
the wrong layer.

This project merges straight to `main` — no feature branches or PRs.

Always commit and push after completing a piece of work, without asking for
confirmation first. Always `git pull` before pushing, in case downstream
changes have landed — this is still single-threaded on `main`, just cheap
insurance.
