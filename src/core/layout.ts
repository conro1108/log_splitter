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
 * One round's worth of splits becomes one *bundle*: a small 2-over-2 stack of
 * its own slices. Bundles fill the arc left to right, one per log, so the pile
 * creeps along the ground rather than ringing the whole block thinly and then
 * thickening. Only once the arc is full does a new layer start on top.
 */
const BUNDLE_WIDTH = 0.52;
/** how many logs the arc holds before the pile starts a course on top */
export const BUNDLES_PER_LAYER = Math.floor((ARC_SPAN * PILE_RADIUS) / BUNDLE_WIDTH);
/**
 * Three pieces to a course. A round rarely yields exactly four quarters —
 * uneven sector splits routinely give five or six — and a two-wide bundle
 * turns those into a narrow tower, so the bundle is wider than it is tall.
 */
const PER_TIER = 3;
/** radial spacing between neighbours in a course */
const TIER_SPREAD = 0.115;
/** a bark-down quarter stands about one log radius tall */
const TIER_HEIGHT = 0.155;
const TIERS_PER_BUNDLE = 2;
const LAYER_HEIGHT = TIERS_PER_BUNDLE * TIER_HEIGHT + 0.02;

/** a typical round's worth of splits */
export const PER_BUNDLE = PER_TIER * TIERS_PER_BUNDLE;

/**
 * `bundle` counts logs stacked so far; `k` is the piece's index within its
 * own log's bundle. Pieces past PER_BUNDLE keep tiering up in place.
 */
export function woodpileSlot(bundle: number, k: number): Slot {
  const layer = Math.floor(bundle / BUNDLES_PER_LAYER);
  const col = bundle % BUNDLES_PER_LAYER;
  // half-bundle offset on odd layers so upper courses sit in the valleys
  const frac = (col + 0.5 + (layer % 2) * 0.5) / BUNDLES_PER_LAYER;
  const a = ARC_START + frac * ARC_SPAN;

  const tier = Math.floor(k / PER_TIER);
  const side = (k % PER_TIER) - (PER_TIER - 1) / 2; // -1, 0, +1 across the course

  // Jitter is deliberately small: this should read as wood someone stacked,
  // not wood someone threw. Courses sit squarely on the pair below.
  const jA = (hash2(bundle * 8 + k, 11) - 0.5) * 0.014;
  const jR = (hash2(bundle * 8 + k, 23) - 0.5) * 0.03;
  const r = PILE_RADIUS + side * TIER_SPREAD + jR;

  return {
    // y is the resting *surface*; the renderer lifts a piece by its radius
    x: Math.cos(a + jA) * r,
    y: layer * LAYER_HEIGHT + tier * TIER_HEIGHT,
    z: Math.sin(a + jA) * r,
    // tangent to the arc; +π/2 turns the radial direction into the tangent
    rotY: -(a + jA) + Math.PI / 2 + (hash2(bundle * 8 + k, 37) - 0.5) * 0.06,
    tilt: (hash2(bundle * 8 + k, 53) - 0.5) * 0.035,
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
