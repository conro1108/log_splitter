import { hash2 } from './rng';

/**
 * Where things sit in the yard. Block at origin, camera off in +Z.
 * The woodpile accumulates in a semicircle around the splitting block,
 * leaving the front sector (where you stand) open.
 */

export interface Slot {
  x: number;
  y: number;
  z: number;
  /** yaw of the piece's long axis (lying tangent to the arc) */
  rotY: number;
  /** small random tilt, radians */
  tilt: number;
}

// Kept tight and roughly symmetric behind the block: a phone in portrait has
// very little horizontal field, and a wider ring would grow mostly off-screen.
const PILE_RADIUS = 1.85;
// open toward the camera, and clear of the delivery pile off to the left
const ARC_START = (218 * Math.PI) / 180;
const ARC_SPAN = (128 * Math.PI) / 180;

/**
 * One round's worth of splits becomes one *bundle*: its wedges set back into the
 * round they came from, lying on its side — but bloomed apart a little (see
 * `reassembledPose`) so the split lines open into visible gaps and it reads as
 * split wood, not a whole log. Every piece of a round shares one bundle center;
 * the wedges' own arc positions do the arranging, which is what keeps them from
 * overlapping. Bundles fill the arc left to right, one round per log; only once
 * the arc is full does a course start on top.
 */
const BUNDLE_WIDTH = 0.42;
/** how many logs the arc holds before the pile starts a course on top */
export const BUNDLES_PER_LAYER = Math.floor((ARC_SPAN * PILE_RADIUS) / BUNDLE_WIDTH);
/** a bloomed round lying on its side stands about a diameter tall */
const LAYER_HEIGHT = 0.36;
/** nominal upper bound on splits per round, for callers that iterate a bundle */
export const PER_BUNDLE = 8;

/**
 * All pieces of one round share this bundle center; `reassembledPose` places
 * each at its own arc position and blooms it outward, so `k` doesn't move the
 * slot — the arc positions arrange the wedges without overlap.
 */
export function woodpileSlot(bundle: number, _k = 0): Slot {
  const layer = Math.floor(bundle / BUNDLES_PER_LAYER);
  const col = bundle % BUNDLES_PER_LAYER;
  // half-bundle offset on odd layers so upper courses nestle into the valleys
  const frac = (col + 0.5 + (layer % 2) * 0.5) / BUNDLES_PER_LAYER;
  const a = ARC_START + frac * ARC_SPAN;

  // Per-bundle jitter (shared by all the round's pieces so the round stays whole
  // rather than scattering). Small: wood someone stacked, not wood someone threw.
  const jA = (hash2(bundle, 11) - 0.5) * 0.02;
  const jR = (hash2(bundle, 23) - 0.5) * 0.04;
  const r = PILE_RADIUS + jR;

  return {
    // y is the resting *surface*; reassembledPose lifts the axis by one radius
    x: Math.cos(a + jA) * r,
    y: layer * LAYER_HEIGHT,
    z: Math.sin(a + jA) * r,
    // tangent to the arc; +π/2 turns the radial direction into the tangent
    rotY: -(a + jA) + Math.PI / 2 + (hash2(bundle, 37) - 0.5) * 0.1,
    tilt: (hash2(bundle, 53) - 0.5) * 0.05,
  };
}

/** the delivery pile of unsplit rounds, off to the left */
const UNSPLIT_ROWS = [5, 4, 3];
export const UNSPLIT_PILE_SIZE = UNSPLIT_ROWS.reduce((a, b) => a + b, 0);

export function unsplitPilePos(i: number): Slot {
  let row = 0;
  let col = i;
  while (row < UNSPLIT_ROWS.length && col >= UNSPLIT_ROWS[row]) {
    col -= UNSPLIT_ROWS[row];
    row++;
  }
  row = Math.min(row, UNSPLIT_ROWS.length - 1);
  return {
    x: -2.45 + (hash2(i, 71) - 0.5) * 0.06,
    y: 0.17 + row * 0.3,
    z: -0.35 + col * 0.42 + row * 0.21,
    rotY: Math.PI / 2 + (hash2(i, 89) - 0.5) * 0.08, // axis along X
    tilt: 0,
  };
}
