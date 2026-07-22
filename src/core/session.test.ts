import { describe, expect, it } from 'vitest';
import { generateLog } from './log';
import { makeRound, pieceVolume } from './split';
import {
  bundleAssignments,
  CORD_M3,
  cords,
  deserialize,
  newSession,
  nextBundleSlot,
  recordStacked,
  serialize,
  takeSeed,
} from './session';

describe('session', () => {
  it('hands out sequential seeds', () => {
    const s = newSession(100);
    expect(takeSeed(s)).toBe(100);
    expect(takeSeed(s)).toBe(101);
  });

  it('measures progress in cords of stacked volume', () => {
    const s = newSession(1);
    const piece = makeRound(generateLog(7));
    recordStacked(s, piece);
    expect(s.volume).toBeCloseTo(pieceVolume(piece));
    expect(s.stacked).toHaveLength(1);
    s.volume = CORD_M3;
    expect(cords(s)).toBeCloseTo(1);
  });

  it('round-trips through serialize/deserialize', () => {
    const s = newSession(5);
    recordStacked(s, makeRound(generateLog(9)));
    s.mode = 'swing';
    s.sound = false;
    s.logsSplit = 3;
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it('groups stacked pieces into one bundle per log', () => {
    const p = (seed: number) => ({ r: 0.15, len: 0.4, span: Math.PI / 2, seed });
    expect(bundleAssignments([p(1), p(1), p(1), p(1), p(2), p(2)])).toEqual([
      { bundle: 0, k: 0 }, { bundle: 0, k: 1 }, { bundle: 0, k: 2 }, { bundle: 0, k: 3 },
      { bundle: 1, k: 0 }, { bundle: 1, k: 1 },
    ]);
    expect(bundleAssignments([])).toEqual([]);
  });

  it('advances the bundle cursor only when the log changes', () => {
    expect(nextBundleSlot(null, null, 7)).toEqual({ bundle: 0, k: 0 });
    expect(nextBundleSlot({ bundle: 0, k: 0 }, 7, 7)).toEqual({ bundle: 0, k: 1 });
    expect(nextBundleSlot({ bundle: 0, k: 3 }, 7, 8)).toEqual({ bundle: 1, k: 0 });
  });

  it('rejects corrupt or foreign save data', () => {
    expect(deserialize('not json')).toBeNull();
    expect(deserialize('{"v":99}')).toBeNull();
    expect(deserialize('{"v":1,"volume":"a lot"}')).toBeNull();
    expect(
      deserialize('{"v":1,"volume":0,"logsSplit":0,"nextSeed":1,"stacked":[{"r":1}]}'),
    ).toBeNull();
  });
});
