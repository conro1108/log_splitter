import { describe, expect, it } from 'vitest';
import { SLOTS_PER_COURSE, unsplitPilePos, UNSPLIT_PILE_SIZE, woodpileSlot } from './layout';

describe('woodpileSlot', () => {
  it('is deterministic', () => {
    expect(woodpileSlot(14)).toEqual(woodpileSlot(14));
  });

  it('keeps the pile in a band around the block', () => {
    for (let i = 0; i < 60; i++) {
      const s = woodpileSlot(i);
      const r = Math.hypot(s.x, s.z);
      // a single continuous rick around the block — never sprawling outward
      expect(r).toBeGreaterThan(1.7);
      expect(r).toBeLessThan(2.0);
    }
  });

  it('leaves the sector where the player stands open', () => {
    for (let i = 0; i < 60; i++) {
      const s = woodpileSlot(i);
      let a = Math.atan2(s.z, s.x);
      if (a < 0) a += Math.PI * 2;
      const deg = (a * 180) / Math.PI;
      expect(deg > 36 && deg < 144).toBe(false);
    }
  });

  it('fills a course left to right before starting the next', () => {
    // consecutive pieces in one course advance monotonically along the arc
    const xs: number[] = [];
    for (let i = 0; i < SLOTS_PER_COURSE; i++) xs.push(woodpileSlot(i).x);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    }
  });

  it('climbs a course only once the one below is full', () => {
    // the whole first course sits at ground level
    for (let i = 1; i < SLOTS_PER_COURSE; i++) {
      expect(woodpileSlot(i).y).toBeCloseTo(woodpileSlot(0).y);
    }
    // the next piece starts a course on top
    expect(woodpileSlot(SLOTS_PER_COURSE).y).toBeGreaterThan(woodpileSlot(0).y);
  });

  it('is one continuous rick, not per-round clumps', () => {
    // neighbouring pieces sit a roughly even step apart the whole way along —
    // no big gaps between "bundles", which is what read as separate stacks
    const steps: number[] = [];
    for (let i = 1; i < SLOTS_PER_COURSE; i++) {
      const a = woodpileSlot(i - 1);
      const b = woodpileSlot(i);
      steps.push(Math.hypot(a.x - b.x, a.z - b.z));
    }
    const min = Math.min(...steps);
    const max = Math.max(...steps);
    expect(max / min).toBeLessThan(1.5);
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
