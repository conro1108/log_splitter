import type { PieceState } from './split';
import { pieceSpan, pieceVolume } from './split';

/** A full cord of stacked firewood, in m³. Progress is measured honestly. */
export const CORD_M3 = 3.62;

export interface StackedPiece {
  r: number;
  len: number;
  span: number;
  /** arcStart of the wedge, so a rebuilt round reassembles into its sectors */
  arc: number;
  /** log seed, so a rebuilt pile keeps its colors */
  seed: number;
}

export interface SessionState {
  /** m³ stacked so far */
  volume: number;
  logsSplit: number;
  stacked: StackedPiece[];
  nextSeed: number;
  sound: boolean;
}

export function newSession(seed = Date.now() % 1_000_000): SessionState {
  return { volume: 0, logsSplit: 0, stacked: [], nextSeed: seed, sound: true };
}

export function takeSeed(s: SessionState): number {
  return s.nextSeed++;
}

export function recordStacked(s: SessionState, piece: PieceState): void {
  s.stacked.push({
    r: piece.spec.radius,
    len: piece.spec.length,
    span: pieceSpan(piece),
    arc: piece.arcStart,
    seed: piece.spec.seed,
  });
  s.volume += pieceVolume(piece);
}

export function cords(s: SessionState): number {
  return s.volume / CORD_M3;
}

export interface BundleSlot {
  bundle: number;
  k: number;
}

/**
 * Group stacked pieces into per-log bundles. Pieces from one round arrive
 * consecutively and share a seed, so a run of equal seeds is one bundle.
 */
export function bundleAssignments(stacked: StackedPiece[]): BundleSlot[] {
  const out: BundleSlot[] = [];
  let bundle = -1;
  let k = 0;
  let lastSeed: number | null = null;
  for (const p of stacked) {
    if (p.seed !== lastSeed) {
      bundle++;
      k = 0;
      lastSeed = p.seed;
    }
    out.push({ bundle, k });
    k++;
  }
  return out;
}

/** where the next piece of `seed` goes, given what has been dispatched so far */
export function nextBundleSlot(prev: BundleSlot | null, prevSeed: number | null, seed: number): BundleSlot {
  if (prev === null || prevSeed !== seed) return { bundle: (prev?.bundle ?? -1) + 1, k: 0 };
  return { bundle: prev.bundle, k: prev.k + 1 };
}

const SAVE_VERSION = 2;

export function serialize(s: SessionState): string {
  return JSON.stringify({ v: SAVE_VERSION, ...s });
}

export function deserialize(raw: string): SessionState | null {
  try {
    const d = JSON.parse(raw);
    if (d?.v !== SAVE_VERSION) return null;
    if (
      typeof d.volume !== 'number' ||
      typeof d.logsSplit !== 'number' ||
      typeof d.nextSeed !== 'number' ||
      !Array.isArray(d.stacked)
    ) {
      return null;
    }
    const stacked: StackedPiece[] = [];
    for (const p of d.stacked) {
      if (
        typeof p?.r !== 'number' || typeof p?.len !== 'number' ||
        typeof p?.span !== 'number' || typeof p?.arc !== 'number' ||
        typeof p?.seed !== 'number'
      ) {
        return null;
      }
      stacked.push({ r: p.r, len: p.len, span: p.span, arc: p.arc, seed: p.seed });
    }
    return {
      volume: d.volume,
      logsSplit: d.logsSplit,
      stacked,
      nextSeed: d.nextSeed,
      sound: d.sound !== false,
    };
  } catch {
    return null;
  }
}
