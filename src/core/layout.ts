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

// open toward the camera, and clear of the delivery pile off to the left
const ARC_START = (218 * Math.PI) / 180;
const ARC_SPAN = (128 * Math.PI) / 180;

/**
 * The woodpile is a loose tumbled heap of split billets behind the block — a
 * mound, not a stacked wall. Split pieces land in a fixed spot the moment
 * they're made (the slot is a pure function of index, so a piece never moves
 * once placed), and the mound is built as jittered layers that shrink and rise:
 * a wide base course thinning to a peak, a low dome. Each piece gets a fully
 * random yaw and a real tilt so the heap reads as tossed firewood, faces and
 * bark every which way, rather than anything racked.
 */
// mound centered behind the block, in the middle of the open-behind arc
const HEAP_ANGLE = ARC_START + ARC_SPAN / 2;
const HEAP_DIST = 1.7;
const HEAP_CX = Math.cos(HEAP_ANGLE) * HEAP_DIST;
const HEAP_CZ = Math.sin(HEAP_ANGLE) * HEAP_DIST;
/** ground-layer footprint radius; each layer up is tighter */
const HEAP_BASE_R = 0.72;
/** vertical pitch between heap layers */
const HEAP_LAYER_RISE = 0.13;

/** which layer the index-th billet lands in, and where within that layer */
function heapCell(index: number): { layer: number; i: number; size: number } {
  let layer = 0;
  let rem = index;
  for (;;) {
    // 11, 9, 7, 5, 3, then 2s forever — a broad base tapering to a peak
    const size = Math.max(2, 11 - layer * 2);
    if (rem < size) return { layer, i: rem, size };
    rem -= size;
    layer++;
  }
}

const GOLDEN = 2.399963; // golden angle, for even disc fill within a layer

/**
 * The resting slot of the `index`-th billet added to the heap, across all
 * rounds. Deterministic and independent of the total count.
 */
export function woodpileSlot(index: number): Slot {
  const { layer, i, size } = heapCell(index);
  const layerR = HEAP_BASE_R * Math.max(0.25, 1 - layer * 0.13);
  // sunflower placement: even coverage of the layer's disc, rotated per layer
  const ang = i * GOLDEN + layer * 1.7;
  const rr = layerR * Math.sqrt((i + 0.4) / size);
  const jx = (hash2(index, 11) - 0.5) * 0.12;
  const jz = (hash2(index, 23) - 0.5) * 0.12;

  return {
    x: HEAP_CX + Math.cos(ang) * rr + jx,
    y: 0.03 + layer * HEAP_LAYER_RISE + (hash2(index, 41) - 0.5) * 0.03,
    z: HEAP_CZ + Math.sin(ang) * rr + jz,
    // fully tumbled: length points any which way, with a real lean
    rotY: hash2(index, 37) * Math.PI * 2,
    tilt: (hash2(index, 53) - 0.5) * 0.7,
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
