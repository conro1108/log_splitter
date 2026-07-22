import { describe, expect, it } from 'vitest';
import { generateLog } from './log';
import { makeRound, pieceVolume } from './split';
import {
  CORD_M3,
  cords,
  deserialize,
  newSession,
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

  it('rejects corrupt or foreign save data', () => {
    expect(deserialize('not json')).toBeNull();
    expect(deserialize('{"v":99}')).toBeNull();
    expect(deserialize('{"v":1,"volume":"a lot"}')).toBeNull();
    expect(
      deserialize('{"v":1,"volume":0,"logsSplit":0,"nextSeed":1,"stacked":[{"r":1}]}'),
    ).toBeNull();
  });
});
