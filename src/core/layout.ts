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
 * The woodpile is one continuous rick, not a clump per round. Every split piece
 * — whoever it came from — takes the next cell in a single stacked wall that
 * marches along the arc and climbs in courses. Each cell is wider than a billet
 * is long, so neighbours sit apart with a gap and never clip (there is no
 * piece-to-piece physics to untangle overlaps). Pieces lie flat and parallel,
 * lengths tangent to the arc, like split logs racked against a wall.
 */
/** billets per course before the rick starts another course on top */
export const SLOTS_PER_COURSE = 14;
/** vertical pitch between courses — about a billet's face height */
const COURSE_HEIGHT = 0.15;

/**
 * The continuous position of the `index`-th piece stacked, across all rounds.
 * Pieces face end-out (axis radial) so the wall shows their split end grain —
 * the classic look of a firewood stack seen face-on.
 */
export function woodpileSlot(index: number): Slot {
  const course = Math.floor(index / SLOTS_PER_COURSE);
  const i = index % SLOTS_PER_COURSE;
  // brick-stagger alternate courses so upper pieces bridge the joints below
  const frac = (i + 0.5 + (course % 2) * 0.5) / SLOTS_PER_COURSE;
  const a = ARC_START + frac * ARC_SPAN;

  return {
    x: Math.cos(a) * PILE_RADIUS,
    y: course * COURSE_HEIGHT,
    z: Math.sin(a) * PILE_RADIUS,
    // radial: the log's length points in toward the block, end-grain out
    rotY: -a + (hash2(index, 37) - 0.5) * 0.06,
    tilt: (hash2(index, 53) - 0.5) * 0.03,
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
