import { describe, expect, it } from 'vitest';
import { analyzeSwing, faultMessage, pullFraction, type SwingSample } from './swing';

const H = 800;

function gesture(points: Array<[number, number, number]>): SwingSample[] {
  return points.map(([x, y, t]) => ({ x, y, t }));
}

describe('analyzeSwing', () => {
  it('rejects gestures with too few samples', () => {
    expect(analyzeSwing(gesture([[0, 0, 0], [0, 10, 5]]), H).valid).toBe(false);
  });

  it('scores a fast straight pull-back-and-drive as powerful and accurate', () => {
    const r = analyzeSwing(
      gesture([
        [400, 300, 0], [400, 400, 80], [400, 500, 160], // pull back
        [400, 380, 220], [400, 240, 280], [400, 100, 340], // drive
      ]),
      H,
    );
    expect(r.valid).toBe(true);
    expect(r.power).toBeGreaterThan(0.9);
    expect(r.accuracy).toBeGreaterThan(0.95);
    expect(Math.abs(r.lateral)).toBeLessThan(0.05);
  });

  it('penalizes a wobbly drive', () => {
    const straight = analyzeSwing(
      gesture([
        [400, 300, 0], [400, 500, 150],
        [400, 400, 220], [400, 280, 280], [400, 100, 350],
      ]),
      H,
    );
    const wobbly = analyzeSwing(
      gesture([
        [400, 300, 0], [400, 500, 150],
        [460, 400, 220], [330, 280, 280], [420, 100, 350],
      ]),
      H,
    );
    expect(wobbly.valid).toBe(true);
    expect(wobbly.accuracy).toBeLessThan(straight.accuracy);
  });

  it('reports sideways drift as lateral offset', () => {
    const r = analyzeSwing(
      gesture([
        [400, 300, 0], [400, 500, 150],
        [430, 380, 220], [470, 240, 280], [500, 100, 340],
      ]),
      H,
    );
    expect(r.valid).toBe(true);
    expect(r.lateral).toBeGreaterThan(0.15);
  });

  it('rejects a push with no pull-back, and says so', () => {
    const r = analyzeSwing(
      gesture([[400, 500, 0], [400, 400, 60], [400, 250, 120], [400, 100, 180]]),
      H,
    );
    expect(r.valid).toBe(false);
    expect(r.fault).toBe('no-pullback');
  });

  it('rejects a wind-up that was never driven, and says so', () => {
    const r = analyzeSwing(
      gesture([[400, 300, 0], [400, 400, 80], [400, 480, 160], [400, 500, 240]]),
      H,
    );
    expect(r.valid).toBe(false);
    expect(r.fault).toBe('no-drive');
  });

  it('rejects a drive that is too slow to be a swing, and says so', () => {
    const r = analyzeSwing(
      gesture([
        [400, 300, 0], [400, 500, 200],
        [400, 400, 800], [400, 250, 1400], [400, 100, 2000],
      ]),
      H,
    );
    expect(r.valid).toBe(false);
    expect(r.fault).toBe('too-slow');
  });

  it('accepts an ordinary unhurried mouse drag', () => {
    // a real desktop gesture: ~90px down, ~150px up over a third of a second
    const r = analyzeSwing(
      gesture([
        [400, 380, 0], [400, 430, 90], [400, 470, 170],
        [400, 400, 260], [400, 320, 330], [400, 250, 400],
      ]),
      H,
    );
    expect(r.valid).toBe(true);
    expect(r.power).toBeGreaterThan(0);
  });

  it('every fault has a message telling the player what to do', () => {
    for (const f of ['no-pullback', 'no-drive', 'too-slow'] as const) {
      expect(faultMessage(f).length).toBeGreaterThan(0);
    }
  });
});

describe('pullFraction', () => {
  it('is zero before the drag moves', () => {
    expect(pullFraction(gesture([[400, 300, 0]]), H)).toBe(0);
    expect(pullFraction(gesture([[400, 300, 0], [400, 300, 20]]), H)).toBe(0);
  });

  it('grows as the wind-up is dragged down, and saturates', () => {
    const quarter = pullFraction(gesture([[400, 300, 0], [400, 350, 40]]), H);
    const half = pullFraction(gesture([[400, 300, 0], [400, 400, 80]]), H);
    expect(quarter).toBeGreaterThan(0);
    expect(half).toBeGreaterThan(quarter);
    expect(pullFraction(gesture([[400, 300, 0], [400, 999, 200]]), H)).toBe(1);
  });

  it('holds the deepest point of the pull, not the latest', () => {
    const held = pullFraction(
      gesture([[400, 300, 0], [400, 450, 60], [400, 380, 120]]),
      H,
    );
    expect(held).toBeCloseTo(pullFraction(gesture([[400, 300, 0], [400, 450, 60]]), H));
  });
});
