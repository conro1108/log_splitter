import type { PieceState } from './split';
import { pieceSpan, pieceVolume } from './split';

/** A full cord of stacked firewood, in m³. Progress is measured honestly. */
export const CORD_M3 = 3.62;

export type InputMode = 'tap' | 'swing';

export interface StackedPiece {
  r: number;
  len: number;
  span: number;
  /** log seed, so a rebuilt pile keeps its colors */
  seed: number;
}

export interface SessionState {
  /** m³ stacked so far */
  volume: number;
  logsSplit: number;
  stacked: StackedPiece[];
  nextSeed: number;
  mode: InputMode;
  sound: boolean;
}

export function newSession(seed = Date.now() % 1_000_000): SessionState {
  return { volume: 0, logsSplit: 0, stacked: [], nextSeed: seed, mode: 'tap', sound: true };
}

export function takeSeed(s: SessionState): number {
  return s.nextSeed++;
}

export function recordStacked(s: SessionState, piece: PieceState): void {
  s.stacked.push({
    r: piece.spec.radius,
    len: piece.spec.length,
    span: pieceSpan(piece),
    seed: piece.spec.seed,
  });
  s.volume += pieceVolume(piece);
}

export function cords(s: SessionState): number {
  return s.volume / CORD_M3;
}

const SAVE_VERSION = 1;

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
        typeof p?.span !== 'number' || typeof p?.seed !== 'number'
      ) {
        return null;
      }
      stacked.push({ r: p.r, len: p.len, span: p.span, seed: p.seed });
    }
    return {
      volume: d.volume,
      logsSplit: d.logsSplit,
      stacked,
      nextSeed: d.nextSeed,
      mode: d.mode === 'swing' ? 'swing' : 'tap',
      sound: d.sound !== false,
    };
  } catch {
    return null;
  }
}
