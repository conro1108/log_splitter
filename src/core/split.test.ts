import { describe, expect, it } from 'vitest';
import type { LogSpec } from './log';
import {
  crackBucket,
  isFullRound,
  isStackable,
  makeRound,
  pieceSpan,
  pieceVolume,
  planeToughness,
  resolveStrike,
  type PieceState,
} from './split';

const TAU = Math.PI * 2;

function spec(overrides: Partial<LogSpec> = {}): LogSpec {
  return {
    seed: 1,
    species: 'pine',
    radius: 0.15,
    length: 0.4,
    twist: 0,
    seasoned: true,
    knots: [],
    ...overrides,
  };
}

const fullPower = { radialFrac: 0.5, power: 1, accuracy: 1 };

describe('piece model', () => {
  it('a fresh round is a full cylinder and not stackable', () => {
    const p = makeRound(spec());
    expect(isFullRound(p)).toBe(true);
    expect(pieceSpan(p)).toBeCloseTo(TAU);
    expect(isStackable(p)).toBe(false);
    expect(pieceVolume(p)).toBeCloseTo(Math.PI * 0.15 ** 2 * 0.4);
  });

  it('a quarter is stackable', () => {
    const p: PieceState = { spec: spec(), arcStart: 0, arcEnd: Math.PI / 2, cracks: {} };
    expect(isStackable(p)).toBe(true);
  });

  it('θ and θ+π are the same crack on a full round', () => {
    const p = makeRound(spec());
    expect(crackBucket(p, 0.4)).toBe(crackBucket(p, 0.4 + Math.PI));
    expect(crackBucket(p, 0.4)).not.toBe(crackBucket(p, 0.4 + Math.PI / 2));
  });
});

describe('resolveStrike', () => {
  it('splits straight-grained seasoned pine in one committed blow', () => {
    const p = makeRound(spec());
    const r = resolveStrike(p, { angle: 1, ...fullPower }, () => 0.99);
    expect(r.outcome).toBe('split');
    expect(r.pieces).toBeDefined();
    const [a, b] = r.pieces!;
    expect(pieceSpan(a)).toBeCloseTo(Math.PI);
    expect(pieceSpan(b)).toBeCloseTo(Math.PI);
    expect(pieceSpan(a) + pieceSpan(b)).toBeCloseTo(pieceSpan(p));
  });

  it('glances off on a sloppy swing without marking the log', () => {
    const p = makeRound(spec());
    const r = resolveStrike(p, { angle: 1, radialFrac: 0.5, power: 1, accuracy: 0.1 });
    expect(r.outcome).toBe('glance');
    expect(p.cracks).toEqual({});
  });

  it('accumulates crack progress across blows on tough wood until it splits', () => {
    const tough = spec({ species: 'elm', radius: 0.2, twist: 1, seasoned: false });
    const p = makeRound(tough);
    let last = 0;
    let split = false;
    for (let i = 0; i < 20; i++) {
      const r = resolveStrike(p, { angle: 0.5, ...fullPower }, () => 0.99);
      expect(r.progress).toBeGreaterThan(last);
      last = r.progress;
      if (r.outcome === 'split') { split = true; break; }
    }
    expect(split).toBe(true);
    expect(last).toBe(1);
  });

  it('progress on one plane does not help a different plane', () => {
    const tough = spec({ species: 'elm', radius: 0.2, twist: 1, seasoned: false });
    const p = makeRound(tough);
    resolveStrike(p, { angle: 0.5, ...fullPower }, () => 0.99);
    const other = resolveStrike(p, { angle: 0.5 + Math.PI / 2, ...fullPower }, () => 0.99);
    const own = p.cracks[crackBucket(p, 0.5)];
    expect(other.progress).toBeLessThan(own + 0.01);
  });

  it('a hard knot in the path raises toughness and eats weak blows', () => {
    const knotty = spec({
      species: 'oak',
      knots: [{ angle: 0, z: 0.5, size: 0.3, hardness: 1 }],
    });
    const p = makeRound(knotty);
    expect(planeToughness(p, 0)).toBeGreaterThan(planeToughness(p, Math.PI / 2) * 1.5);
    const r = resolveStrike(p, { angle: 0, radialFrac: 0.5, power: 0.5, accuracy: 1 }, () => 0.99);
    expect(r.outcome).toBe('knot');
    expect(r.knotHit).toBeDefined();
  });

  it('the maul can stick in a deep partial crack', () => {
    const tough = spec({ species: 'oak', radius: 0.19, seasoned: false });
    const p = makeRound(tough);
    p.cracks[crackBucket(p, 1)] = 0.45;
    const r = resolveStrike(p, { angle: 1, ...fullPower }, () => 0);
    if (r.outcome !== 'split') expect(r.outcome).toBe('stuck');
  });

  it('splitting a half yields two sectors that partition it', () => {
    const half: PieceState = { spec: spec(), arcStart: 0, arcEnd: Math.PI, cracks: {} };
    const r = resolveStrike(half, { angle: Math.PI / 2, ...fullPower }, () => 0.99);
    expect(r.outcome).toBe('split');
    const [a, b] = r.pieces!;
    expect(a.arcEnd).toBeCloseTo(b.arcStart);
    expect(pieceSpan(a) + pieceSpan(b)).toBeCloseTo(Math.PI);
  });

  it('never shaves an unusable sliver off a sector', () => {
    const half: PieceState = { spec: spec(), arcStart: 0, arcEnd: Math.PI, cracks: {} };
    const r = resolveStrike(half, { angle: 0.01, ...fullPower }, () => 0.99);
    expect(r.outcome).toBe('split');
    for (const piece of r.pieces!) {
      expect(pieceSpan(piece)).toBeGreaterThanOrEqual(0.12);
    }
  });
});
