import { describe, expect, it } from 'vitest';
import {
  BUNDLES_PER_LAYER, PER_BUNDLE, unsplitPilePos, UNSPLIT_PILE_SIZE, woodpileSlot,
} from './layout';

describe('woodpileSlot', () => {
  it('is deterministic', () => {
    expect(woodpileSlot(4, 2)).toEqual(woodpileSlot(4, 2));
  });

  it('keeps the pile in a band around the block', () => {
    for (let b = 0; b < 60; b++) {
      for (let k = 0; k < PER_BUNDLE; k++) {
        const s = woodpileSlot(b, k);
        const r = Math.hypot(s.x, s.z);
        expect(r).toBeGreaterThan(1.68);
        expect(r).toBeLessThan(2.02);
      }
    }
  });

  it('leaves the sector where the player stands open', () => {
    for (let b = 0; b < 60; b++) {
      const s = woodpileSlot(b, 0);
      let a = Math.atan2(s.z, s.x);
      if (a < 0) a += Math.PI * 2;
      const deg = (a * 180) / Math.PI;
      expect(deg > 36 && deg < 144).toBe(false);
    }
  });

  it('fills left to right along the arc, one bundle per log', () => {
    // successive bundles advance monotonically in x across a single course
    const xs: number[] = [];
    for (let b = 0; b < BUNDLES_PER_LAYER; b++) xs.push(woodpileSlot(b, 0).x);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    }
  });

  it('does not start a new layer until the arc is full', () => {
    // every bundle in the first course sits at ground level, not stacked
    for (let b = 1; b < BUNDLES_PER_LAYER; b++) {
      expect(woodpileSlot(b, 0).y).toBeCloseTo(woodpileSlot(0, 0).y);
    }
    // the next one over starts a course on top, back at the left
    const wrapped = woodpileSlot(BUNDLES_PER_LAYER, 0);
    expect(wrapped.y).toBeGreaterThan(woodpileSlot(0, 0).y);
    expect(wrapped.x).toBeLessThan(woodpileSlot(BUNDLES_PER_LAYER - 1, 0).x);
  });

  it('scatters a bundle into a low heap around its anchor', () => {
    const anchor = woodpileSlot(7, 0);
    for (let k = 1; k < PER_BUNDLE; k++) {
      const s = woodpileSlot(7, k);
      // pieces cluster into one heap, not spread thin or flung away
      const spread = Math.hypot(s.x - anchor.x, s.z - anchor.z);
      expect(spread).toBeLessThan(0.35);
      // and stay low — a heap, never a tower
      expect(s.y).toBeLessThan(anchor.y + 0.2);
    }
  });

  it('keeps a lopsided round from growing into a tower', () => {
    // seven billets off one round should still be under knee height
    const tallest = Math.max(...[0, 1, 2, 3, 4, 5, 6].map((k) => woodpileSlot(2, k).y));
    expect(tallest).toBeLessThan(0.5);
  });

  it('keeps one log\'s bundle clustered together', () => {
    const pieces = [0, 1, 2, 3].map((k) => woodpileSlot(3, k));
    const next = woodpileSlot(4, 0);
    for (const p of pieces) {
      const withinBundle = Math.hypot(p.x - pieces[0].x, p.z - pieces[0].z);
      const toNextBundle = Math.hypot(p.x - next.x, p.z - next.z);
      expect(withinBundle).toBeLessThan(toNextBundle + 0.3);
    }
  });
});

describe('unsplitPilePos', () => {
  it('stacks a pyramid with rising rows', () => {
    expect(UNSPLIT_PILE_SIZE).toBe(12);
    expect(unsplitPilePos(11).y).toBeGreaterThan(unsplitPilePos(0).y);
    const seen = new Set<string>();
    for (let i = 0; i < UNSPLIT_PILE_SIZE; i++) {
      const p = unsplitPilePos(i);
      seen.add(`${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`);
    }
    expect(seen.size).toBe(UNSPLIT_PILE_SIZE);
  });
});
