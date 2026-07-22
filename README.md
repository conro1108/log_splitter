# log_splitter

3D log splitting sim. Real grain/knot variance, physical splits.
Not a tap-timing game wearing a chopping skin.

## Play

```
npm install
npm run dev
```

Installable as a PWA — built mobile-first for iOS, and it reshapes itself from a
phone held upright to a wide desktop window.

- **Drag sideways** (or scroll) turns the log on the block; read the bark and end
  grain before you swing.
- **Tap** where you want the split to aim and strike.
- If the axe sticks, tap to work it free — your next blow in the crack hits harder.

A clean round splits in one blow; a big green oak or a twisted elm takes two, and a
knot square in your path takes more. Rounds split into halves, halves into quarters;
each round's pieces stack as their own little bundle, and bundles fill the woodpile
left to right around the block. Progress is **cords stacked** — the pile is the save
file (persisted in localStorage; stats live in ⚙).

## The wood

Every log is generated: species (pine pops, oak needs weight, elm fights back),
grain twist, seasoned vs. green, and knots that show on the bark and faces and
will eat a badly-placed blow. Crack progress persists on the log between hits.

## Dev

```
npm test        # vitest — core sim (log gen, strike resolution, layout, save)
npm run typecheck
npm run build
npm run icons   # regenerate PWA icons
```

`src/core/` is the pure, tested simulation; `src/render/` is Three.js presentation;
`main.ts` orchestrates. `window.__ls` exposes read-only game state for headless driving.
