import { describe, expect, it } from 'vitest';
import { describeLog, generateLog, SPECIES } from './log';

describe('generateLog', () => {
  it('is deterministic for a given seed', () => {
    expect(generateLog(42)).toEqual(generateLog(42));
  });

  it('produces different logs for different seeds', () => {
    expect(generateLog(1)).not.toEqual(generateLog(2));
  });

  it('stays within physical bounds across many seeds', () => {
    for (let seed = 0; seed < 300; seed++) {
      const log = generateLog(seed);
      expect(log.radius).toBeGreaterThanOrEqual(0.13);
      expect(log.radius).toBeLessThanOrEqual(0.2);
      expect(log.length).toBeGreaterThanOrEqual(0.34);
      expect(log.length).toBeLessThanOrEqual(0.44);
      expect(SPECIES[log.species]).toBeDefined();
      expect(Math.abs(log.twist)).toBeLessThanOrEqual(SPECIES[log.species].twistMax);
      for (const k of log.knots) {
        expect(k.angle).toBeGreaterThanOrEqual(0);
        expect(k.angle).toBeLessThan(Math.PI * 2);
        expect(k.z).toBeGreaterThan(0);
        expect(k.z).toBeLessThan(1);
        expect(k.hardness).toBeGreaterThan(0);
        expect(k.hardness).toBeLessThanOrEqual(1);
      }
    }
  });

  it('generates every species eventually', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed++) seen.add(generateLog(seed).species);
    expect(seen).toEqual(new Set(['pine', 'oak', 'elm']));
  });
});

describe('describeLog', () => {
  it('names condition, species and size', () => {
    const log = { ...generateLog(1), species: 'oak' as const, seasoned: true, radius: 0.15 };
    expect(describeLog(log)).toBe('Seasoned Oak · 12in');
  });
});
