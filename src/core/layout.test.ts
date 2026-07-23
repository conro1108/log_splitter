import { describe, expect, it } from 'vitest';
import { unsplitPilePos, UNSPLIT_PILE_SIZE, woodpileSlot } from './layout';

describe('woodpileSlot', () => {
  it('is deterministic', () => {
    expect(woodpileSlot(14)).toEqual(woodpileSlot(14));
  });

  it('keeps the heap a compact mound behind the block', () => {
    // every billet stays within a bounded footprint around one center — a heap,
    // not a rick sprawling around the whole arc
    const c = woodpileSlot(0);
    let cx = 0, cz = 0;
    for (let i = 0; i < 40; i++) { cx += woodpileSlot(i).x; cz += woodpileSlot(i).z; }
    cx /= 40; cz /= 40;
    for (let i = 0; i < 40; i++) {
      const s = woodpileSlot(i);
      expect(Math.hypot(s.x - cx, s.z - cz)).toBeLessThan(0.95);
    }
    expect(c).toBeDefined();
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

  it('grows upward as it fills — later billets pile on top', () => {
    // the base course sits near the ground; a much later billet sits higher
    expect(woodpileSlot(0).y).toBeLessThan(0.1);
    expect(woodpileSlot(30).y).toBeGreaterThan(woodpileSlot(0).y + 0.15);
  });

  it('tumbles each billet — no two share a pose', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const s = woodpileSlot(i);
      seen.add(`${s.x.toFixed(3)},${s.y.toFixed(3)},${s.z.toFixed(3)}`);
    }
    expect(seen.size).toBe(60);
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
