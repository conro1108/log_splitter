import { describe, expect, it } from 'vitest';
import { unsplitPilePos, UNSPLIT_PILE_SIZE, woodpileSlot } from './layout';

describe('woodpileSlot', () => {
  it('is deterministic', () => {
    expect(woodpileSlot(17)).toEqual(woodpileSlot(17));
  });

  it('keeps the semicircle around the block at a steady radius', () => {
    for (let i = 0; i < 300; i++) {
      const s = woodpileSlot(i);
      const r = Math.hypot(s.x, s.z);
      expect(r).toBeGreaterThan(2.3);
      expect(r).toBeLessThan(2.9);
    }
  });

  it('leaves the sector where the player stands open', () => {
    for (let i = 0; i < 300; i++) {
      const s = woodpileSlot(i);
      let a = Math.atan2(s.z, s.x);
      if (a < 0) a += Math.PI * 2;
      const deg = (a * 180) / Math.PI;
      expect(deg > 36 && deg < 144).toBe(false);
    }
  });

  it('starts new courses on top as the pile grows', () => {
    expect(woodpileSlot(500).y).toBeGreaterThan(woodpileSlot(0).y);
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
