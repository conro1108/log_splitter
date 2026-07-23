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
 * One round's worth of splits becomes one *bundle*: a loose low heap of its
 * billets, each laid flat on a split face and tossed around the bundle spot at
 * its own angle — a pile of split wood, not a reassembled round. Piece 0 anchors
 * the heap; the rest scatter around it. Bundles fill the arc left to right, one
 * round per log; only once the arc is full does the pile start a course on top.
 */
const BUNDLE_WIDTH = 0.48;
/** how many logs the arc holds before the pile starts a course on top */
export const BUNDLES_PER_LAYER = Math.floor((ARC_SPAN * PILE_RADIUS) / BUNDLE_WIDTH);
/** a heap of one round stands about this tall; a new course clears it */
const LAYER_HEIGHT = 0.3;
/** nominal upper bound on splits per round, for callers that iterate a bundle */
export const PER_BUNDLE = 8;

/**
 * `bundle` counts logs stacked so far; `k` is the billet's index within its own
 * round. Piece 0 sits at the bundle anchor on the ground; later pieces scatter
 * around it (some riding a little higher, as if tossed onto the heap).
 */
export function woodpileSlot(bundle: number, k = 0): Slot {
  const layer = Math.floor(bundle / BUNDLES_PER_LAYER);
  const col = bundle % BUNDLES_PER_LAYER;
  // half-bundle offset on odd layers so upper courses nestle into the valleys
  const frac = (col + 0.5 + (layer % 2) * 0.5) / BUNDLES_PER_LAYER;
  const a = ARC_START + frac * ARC_SPAN;
  const baseY = layer * LAYER_HEIGHT;

  // piece 0 anchors the bundle dead-centre; keeping it unscattered lets the pile
  // advance monotonically along the arc (and gives every heap a grounded base)
  if (k === 0) {
    return {
      x: Math.cos(a) * PILE_RADIUS,
      y: baseY,
      z: Math.sin(a) * PILE_RADIUS,
      rotY: hash2(bundle, 37) * Math.PI * 2,
      tilt: (hash2(bundle, 53) - 0.5) * 0.12,
    };
  }

  // scatter the rest around the anchor: an offset along the arc tangent and in
  // and out radially, a random spin, and a chance to ride up onto the heap
  const seed = bundle * 16 + k;
  const tang = (hash2(seed, 11) - 0.5) * 0.30;
  const r = PILE_RADIUS + (hash2(seed, 23) - 0.5) * 0.16;
  const up = hash2(seed, 41) < 0.4 ? 0.12 : 0;

  return {
    x: Math.cos(a) * r - Math.sin(a) * tang,
    y: baseY + up,
    z: Math.sin(a) * r + Math.cos(a) * tang,
    rotY: hash2(seed, 37) * Math.PI * 2,
    tilt: (hash2(seed, 53) - 0.5) * 0.16,
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
