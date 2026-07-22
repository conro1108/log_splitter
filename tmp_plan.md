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
  woodpile physically grows — it's the save file you can look at.
- Zen mode is the default and the identity: no timer, no fail state, no
  score on screen. Ambient sound, weather, time of day drifting. Challenge
  modes (timed cords, hardwood-only, one-swing-per-log) come later and stay
  opt-in.

## The swing (the core mechanic)

- **Analog swing input**: pull back (mouse drag down / stick back), then
  drive through (push forward). Speed and straightness of the gesture map
  to swing power and accuracy — like analog-stick golf swings. A crooked
  gesture lands the maul off your aim point or at a glancing angle.
- Aim is free: you place the strike point and angle on the log face
  yourself. No snap-to-target, no timing bar.
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

## Split simulation

Don't do runtime mesh CSG. At log generation time, precompute a **fracture
graph**: candidate split planes following the grain field, weakened between
knots. A strike delivers energy at a point; the sim picks/extends the
cheapest crack path through the graph, and separation happens along
pre-authored fragment boundaries. Deterministic given the log seed + strike,
cheap at runtime, and the split faces can genuinely follow the grain —
which is the whole visual payoff. Fragments are rigid bodies after
separation (fly, tumble, land — physics does the celebration).

## Feel

- **Sound is half the game**: the ring of a clean pop vs. the dead thud of
  a knot vs. the creak of a partial split. Budget for it accordingly.
- Impact juice: brief hitstop on contact, chips and bark flying, maul
  vibration on a glance. Controller haptics if the platform allows.
- Tone: worksite, not spa. Cold morning, flannel-and-splinters, a crow
  somewhere. Peaceful because the work is absorbing, not because the world
  is soft.

## Aesthetic

**Nice-looking stylized 3D** — still the odd-one-out among the projects
(everything else is pixel art), but fidelity is not the point; **physics
and general 3D feel are**. Target something like polished-indie stylized:
clean shapes, good lighting, weather and time-of-day doing most of the
beauty work. "Looks nice" comes from light and motion, not texel density.

- Grain and knots must stay **readable** — they're gameplay information,
  not decoration. Stylization helps here: exaggerated grain lines and
  obvious knot whorls beat subtle realism for teaching the player to
  read a log.
- Split faces still can't be one static texture (every fracture is
  unique), but a stylized grain shader driven by the sim's grain field
  is a much smaller ask than a photoreal one — and keeps the rule that
  what you see is literally what it splits along.
- Tiny static scene (one hillside, a block, a pile) keeps the asset
  budget honest; keep the avatar minimal/first-person-armless so
  animation never becomes a cost center.

## Tech stack — decided lean: Godot 4

First 3D project; ambition is welcome, but the ambition budget should go
to the *physics and feel*, not to fighting a heavyweight engine. Unreal's
big advantage was free photorealism — with a stylized target that
advantage evaporates, and its costs (sprawling editor, C++ under
everything, big installs, slow compiles) don't. Godot 4 is the pick:

- **GDScript** (Python-ish, no C++ anywhere near this project), a small
  fast editor, seconds-not-minutes iteration — the right ergonomics for
  evenings-and-weekends and for feel-tuning, which is most of this game.
- **Jolt physics** (Godot 4.4's default) is genuinely good rigid-body
  simulation — flying fragments, tumbling stacks, maul impacts are well
  within its comfort zone.
- Godot's stylized 3D is fully up to "looks nice": good lighting,
  volumetric fog, sky/weather systems, shader language close to GLSL.
- What we give up vs. Unreal: Chaos Destruction and the Megascans
  library. Neither is load-bearing anymore — the fracture design below
  is engine-agnostic (precomputed fragments swapped in at split time,
  then plain rigid bodies), and a stylized scene needs few assets.
- **Fallback**: Unity (C#, bigger ecosystem/tutorial base) if Godot hits
  a wall — but the code that matters (grain field, fracture graph,
  swing input) would port, since none of it leans on engine magic.

**Lift calibration** (evenings/weekends, from zero 3D): Godot editor
fluency in days rather than weeks; ~4–6 weeks to the vertical slice.

**On-ramp**: official "Your first 3D game" tutorial → a small physics toy
(throw boxes at a stack) → then straight to the slice, letting the game
pull in what's needed next.

**The vertical slice is the go/no-go**: one log on a block, swing at it,
watch it split convincingly. If that works, the rest is content and
polish; if it doesn't, we learned cheaply.

## Open questions

- First-person vs. fixed over-the-shoulder camera? First-person is
  immersive and hides the avatar; fixed camera simplifies the swing
  gesture mapping. Prototype the gesture in first-person first.
- How much stacking sim? Free-stack with physics is charming but fiddly;
  snap-assisted stacking is probably right.
- Session framing: pure sandbox, or gentle jobs ("2 cords for the neighbor
  before snow")? Jobs give shape without adding pressure.

## Not in scope for v1

VR, multiplayer, economy/selling wood, tree felling and bucking (you start
with rounds), more than 3 species. One block, one maul, one hillside; make
a single clean split feel worth the whole download.
