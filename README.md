# log_splitter

3D log splitting sim. Analog swing, real grain/knot variance, physical splits.
Not a tap-timing game wearing a chopping skin.

## Play

```
npm install
npm run dev
```

- **Scroll** turns the log on the block; read the bark and end grain before you swing.
- **Tap mode** (default): click where you want the split.
- **Swing mode**: press, pull down to wind up, then drive up fast. Drive speed is
  power; a crooked drive lands off your line or glances off. Toggle in ⚙.
- If the maul sticks, click to wiggle it free — your next blow in the crack hits harder.

Rounds split into halves, halves into quarters; quarters fly to the woodpile that
grows in a semicircle around the block. Progress is **cords stacked** — the pile is
the save file (persisted in localStorage; stats live in ⚙).

## The wood

Every log is generated: species (pine pops, oak needs weight, elm fights back),
grain twist, seasoned vs. green, and knots that show on the bark and faces and
will eat a badly-placed blow. Crack progress persists on the log between hits.

## Dev

```
npm test        # vitest — core sim (log gen, strike resolution, swing analysis, layout, save)
npm run typecheck
npm run build
```

`src/core/` is the pure, tested simulation; `src/render/` is Three.js presentation;
`main.ts` orchestrates. `window.__ls` exposes read-only game state for headless driving.
