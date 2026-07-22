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

const PILE_RADIUS = 2.6;
// open toward the camera (35°..145°) and clear of the delivery pile (145°..205°)
const ARC_START = (205 * Math.PI) / 180;
const ARC_SPAN = (190 * Math.PI) / 180;
const SLOT_WIDTH = 0.5;
const PER_ROW = Math.floor((ARC_SPAN * PILE_RADIUS) / SLOT_WIDTH);
const ROW_HEIGHT = 0.15;

export function woodpileSlot(i: number): Slot {
  const row = Math.floor(i / PER_ROW);
  const col = i % PER_ROW;
  // alternate row direction + half-slot offset so courses interlock
  const frac = (col + 0.5 + (row % 2) * 0.5) / PER_ROW;
  const a = ARC_START + frac * ARC_SPAN;
  const jA = (hash2(i, 11) - 0.5) * 0.02;
  const jR = (hash2(i, 23) - 0.5) * 0.12;
  const r = PILE_RADIUS + jR;
  return {
    // pieces lie bark-up resting on their apex line, so row 0 sits at ~0
    x: Math.cos(a + jA) * r,
    y: 0.015 + row * ROW_HEIGHT,
    z: Math.sin(a + jA) * r,
    // tangent to the arc; +π/2 turns the radial direction into the tangent
    rotY: -(a + jA) + Math.PI / 2 + (hash2(i, 37) - 0.5) * 0.15,
    tilt: (hash2(i, 53) - 0.5) * 0.1,
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
