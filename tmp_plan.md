# log_splitter — design notes (draft)

## What the genre is

This sits in the **task-satisfaction sim** genre: PowerWash Simulator, Lawn
Mowing Simulator, the chopping/carving corners of VR. The formula is a real
physical chore, made tactile and legible, with visible accumulating progress
and no pressure. What separates the good ones from idle-game skins is that
the *task itself* has skill and texture — the README's line is the thesis:
**not a tap-timing game wearing a chopping skin.**

For splitting wood specifically, the real-world skill is (1) reading the
log — grain direction, knots, checks already started — (2) choosing a
strike point and angle, and (3) delivering an accurate, committed swing.
The game is those three things, simulated honestly enough that an
experienced player splits faster and cleaner than a button-masher.

## Core fantasy / loop

- A **session**: a pile of unsplit rounds on one side, your growing
  woodpile on the other. Pick a round, set it on the block, read it,
  split it (usually into halves, then quarters), stack the pieces.
- Progress is measured the way it is in real life: **cords stacked**. The
  woodpile physically grows — it's the save file you can look at. i like the idea of it accumulating around your splitting surface in a sort of semi-circle
- Zen mode is the default and the identity: no timer, no fail state, no
  score on screen. Ambient sound, weather, time of day drifting. Challenge
  modes (timed cords, hardwood-only, one-swing-per-log) come later and stay
  opt-in.

## The swing (the core mechanic)

- **Analog swing input**: pull back (mouse drag down / stick back), then
  drive through (push forward). Speed and straightness of the gesture map
  to swing power and accuracy — like analog-stick golf swings. A crooked
  gesture lands the maul off your aim point or at a glancing angle. <-- actually id like both modes. can be toggled in some dev tools screen or front ui. just spinng and tapping at the right place sounds kinda nice.
- you should be able to spin the target log around, and intuitively aim where we're chopping by physically aiming tap/swing
- Outcomes are continuous, not pass/fail: clean split, partial split
  (maul stuck — wiggle it free, hit again in the crack), glance-off,
  buried-in-knot thunk. Partial progress persists on the log.
- Optional tools later: wedge + sledge for monsters, hatchet for kindling.

## The log model (the content)

Each log is a small puzzle, procedurally generated:

- **Grain**: a direction field through the log — mostly straight, sometimes
  twisted (elm is famously miserable). Splits propagate along grain, so a
  straight-grained round pops in one hit and a twisted one fights you.
- **Knots**: hard nodes that deflect or arrest a crack. Visible on the faces
  and bark, so reading the log before swinging is real skill, not RNG.
- **Species** = difficulty tiers: pine (easy, soft, satisfying pop), oak
  (dense, heavy swing needed), elm/gum (interlocked grain, the boss logs).
  Seasoned vs. green as a modifier.

