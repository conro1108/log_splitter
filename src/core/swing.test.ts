import { describe, expect, it } from 'vitest';
import { analyzeSwing, type SwingSample } from './swing';

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

  it('rejects a push with no pull-back', () => {
    const r = analyzeSwing(
      gesture([[400, 500, 0], [400, 400, 60], [400, 250, 120], [400, 100, 180]]),
      H,
    );
    expect(r.valid).toBe(false);
  });

  it('rejects a drive that is too slow to be a swing', () => {
    const r = analyzeSwing(
      gesture([
        [400, 300, 0], [400, 500, 200],
        [400, 400, 800], [400, 250, 1400], [400, 100, 2000],
      ]),
      H,
    );
    expect(r.valid).toBe(false);
  });
});
